import * as dotenv from 'dotenv';
import { createClient, commandOptions } from 'redis';
import fetch from 'node-fetch';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;
const FLIGHTAWARE_QUEUE = 'flightawarequeue';

// Sleep for 5 seconds... used as a lazy way to avoid
// rate limiting on the FlightAware API...
async function sleep() {
  return new Promise((resolve) => {
    setTimeout(resolve, 5000);
  });
};

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

// Loop over entries in the queue, and wait when there are none...
while (true) {
  const response = await redisClient.brPop(
    commandOptions({ isolated: true }),
    FLIGHTAWARE_QUEUE,
    5
  );

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

        for (const flight of flightData.flights) {
          // The response contains an array of recent past, current and
          // planned future flights with this ID.  The one we want is
          // currently in progress, so progress_percent between 1 and 99.
          if (flight.progress_percent > 0 && flight.progress_percent < 100) {
            // Grab the details we want and save them.
            const flightDetails = {
              registration: flight.registration,
              origin_iata: flight.origin.code_iata,
              origin_name: flight.origin.name,
              destination_iata: flight.destination.code_iata,
              destination_name: flight.destination.name,
              aircraft_type: flight.aircraft_type,
              // Consider resolving operator_iata using another FlightAware call
              //  and cache those responses forever?  e.g. U2 -> EASYJET UK LIMITED	
              // Or just get this data from a list online and store it in Redis as
              // static data. https://en.wikipedia.org/wiki/List_of_airline_codes
              // FlightAware URL: https://aeroapi.flightaware.com/aeroapi/operators/U2
              operator_iata: flight.operator_iata || '',
              flight_number: flight.flight_number
            };

            const flightKey = `flight:${msgPayload.hex_ident}`;
            console.log(`Saving details to ${flightKey}...`);
            console.log(flightDetails);
            redisClient.hSet(flightKey, flightDetails);
          }
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
