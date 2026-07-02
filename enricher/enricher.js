import * as dotenv from 'dotenv';
import { createClientPool } from 'redis';

dotenv.config({ quiet: true });

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;
const FLIGHTAWARE_QUEUE = 'flightawarequeue';

// Utility function to get current date in YYYYMMDD format.
function getCurrentDateYYYYMMDD() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

// Sleep for 5 seconds... used as a lazy way to avoid
// rate limiting on the FlightAware API...
async function sleep() {
  return new Promise((resolve) => {
    setTimeout(resolve, 5000);
  });
};

// Load all members of a Redis set into a JavaScript Set and return it.
// Assumes the set is small enough to retrieve in its entirety and that
// all members are strings.
async function loadSetFromRedis(keyName) {
  const members = await redisClient.sMembers(keyName);
  return new Set(members);
}

const redisClient = createClientPool({
  url: REDIS_URL
});

await redisClient.connect();

// Set up the topk for aircraft type tracking - this will
// throw an exception if it already exists.
try {
  await redisClient.topK.reserve('stats:aircrafttypesapprox', 10, {
    width: 400,
    depth: 10,
    decay: 0.9
  });
  console.log('Created TopK for aircraft type stats.');
} catch (e) {
  // TODO this is lazy, check that it really already exists with EXISTS
  // then use this exception catch to report that Bloom might not be installed.
  console.log('TopK for aircraft type stats already exists.');
}

// Load and cache the sets of widebody and quad aircraft types from Redis.
const widebodyTypes = await loadSetFromRedis('types:widebody');
const quadTypes = await loadSetFromRedis('types:quad');

// Loop over entries in the queue, and wait when there are none...
console.log('Checking for work...');

while (true) {
  const response = await redisClient.brPop(FLIGHTAWARE_QUEUE, 5);

  if (response) {
    // Response is an object that looks like this:
    // {
    //   key: 'flightawarequeue',
    //   element: '{"hex_ident":"3CEE56","callsign":"AHO241N"}'
    // }
    const msgPayload = JSON.parse(response.element);
    console.log(`Asking FlightAware for data on ${msgPayload.callsign} (${msgPayload.hex_ident})`);

    const flightAwareAPIURL = `https://aeroapi.flightaware.com/aeroapi/flights/${msgPayload.callsign}?max_pages=1`;

    try {
      const flightAwareResponse = await fetch(flightAwareAPIURL, {
        headers: {
          'x-apikey': FLIGHTAWARE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (flightAwareResponse.status === 200) {
        const flightData = await flightAwareResponse.json();
        let updatedFlight = false;

        // Log that an API call was made for stats purposes.
        redisClient.hIncrBy('stats:flightawareapicalls', getCurrentDateYYYYMMDD(), 1);

        if (flightData.flights) {
          for (const flight of flightData.flights) {
            // The response contains an array of recent past, current and
            // planned future flights with this ID.  The one we want is
            // currently in progress, so progress_percent between 1 and 99.
            if (flight.progress_percent > 0 && flight.progress_percent < 100) {
              // Grab the details we want and save them.
              const flightDetails = {
                registration: flight.registration || '??',
                origin_iata: flight.origin.code_iata || '',
                origin_name: flight.origin.name || '',
                destination_iata: flight.destination.code_iata || '',
                destination_name: flight.destination.name || '',
                aircraft_type: flight.aircraft_type || '',
                operator_iata: flight.operator_iata || '??',
                flight_number: flight.flight_number || '????'
              };

              // Is this a widebody and/or quad?  Using 1 for True, 0 for False.
              flightDetails.is_widebody = widebodyTypes.has(flight.aircraft_type) ? 1 : 0;
              flightDetails.is_quad = quadTypes.has(flight.aircraft_type) ? 1 : 0;

              // TODO look up the operator name and color from the IATA code and log if there is a miss.
              // e.g. HGET operator:VS name -> Virgin Atlantic
              //      HGET operator:VX name -> null            Sadly no more Virgin America :/
              //
              const operatorName = await redisClient.hGet(`operator:${flight.operator_iata}`, 'name');
              if (operatorName) {
                flightDetails.operator_name = operatorName;
              } else {
                console.log(`Missing operator name for IATA: ${flight.operator_iata}`);
                if (flight.operator_iata && flight.operator_iata.length > 0) {
                  redisClient.sAdd('errors:missingoperators', flight.operator_iata);
                }
              }

              // TODO improve this... get it in the same round trip to Redis as the name.
              const operatorColor = await redisClient.hGet(`operator:${flight.operator_iata}`, 'color');
              if (operatorColor) {
                flightDetails.operator_color = operatorColor;
              } else {
                console.log(`Missing operator color for IATA: ${flight.operator_iata}`);
              }

              const flightKey = `flight:${msgPayload.hex_ident}`;
              console.log(`Saving details to ${flightKey}...`);
              console.log(flightDetails);
              redisClient.hSet(flightKey, flightDetails);

              if (flight.registration && flight.registration.length > 0) {
                redisClient.zIncrBy('stats:planesseen', 1, flight.registration);
                redisClient.pfAdd('stats:planesapprox', flight.registration);
              }

              if (flightDetails.operator_name && flightDetails.operator_name.length > 0) {
                redisClient.zIncrBy('stats:operators', 1, flightDetails.operator_name);
              }

              if (flightDetails.origin_iata.length > 0 && flightDetails.destination_iata.length > 0) {
                redisClient.zIncrBy('stats:routes', 1, `${flightDetails.origin_iata}-${flightDetails.destination_iata}`);
                redisClient.zIncrBy('stats:origins', 1, flightDetails.origin_iata);
                redisClient.zIncrBy('stats:destinations', 1, flightDetails.destination_iata);
              }

              if (flight.aircraft_type.length > 0) {
                redisClient.zIncrBy('stats:aircrafttypes', 1, flight.aircraft_type);
                redisClient.topK.incrBy('stats:aircrafttypesapprox', {
                  item: flight.aircraft_type,
                  incrementBy: 1
                });
              }

              updatedFlight = true;
            }
          }
        }

        if (! updatedFlight) {
          console.log(`FlightAware has nothing in flight for ${msgPayload.hex_ident} / ${msgPayload.callsign} right now.`);
        }

      } else {
        console.log(`Error: FlightAware API returned ${flightAwareResponse.status} code.`);
      }
    } catch (e) {
      console.log('Error talking to FlightAware API:');
      console.log(e);
    }

    // Sleep to prevent FlightAware rate limiter kicking in (this is a very 
    // lazy way of dealing with this!).
    console.log('Entering rate limiter sleep.');
    await sleep();
    console.log('Exited rate limiter sleep.');
  } else {
    console.log('No new work to do.');
  }
}
