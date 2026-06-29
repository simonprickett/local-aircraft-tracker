import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config({ quiet: true });

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUERY_INTERVAL = parseInt(process.env.QUERY_INTERVAL, 10);
const LOCATION_LON = process.env.LOCATION_LON || '-1.148369';
const LOCATION_LAT = process.env.LOCATION_LAT || '52.953150';
const PLANE_POSITIONS_STREAM_KEY = "mappableflights";
const LATEST_UPDATED_COMMAND = [
  'FT.AGGREGATE', 'idx:flights', '*', 'LOAD', '2', '__key', '@aircraft_type', 'FILTER', 'exists(@aircraft_type)', 'SORTBY', '2', '@last_updated', 'DESC', 'LIMIT', '0', '1'
];
const PLANE_POSITIONS_COMMAND = [
  'FT.AGGREGATE', 'idx:flights', '*', 'LOAD', '8', '@position', '@lat', '@lon', '@operator_iata', '@flight_number', '@origin_iata', '@destination_iata', '@last_updated', 'FILTER', 'exists(@position)', 'FILTER', 'exists(@operator_iata)', 'FILTER', 'exists(@origin_iata)', 'FILTER', 'exists(@destination_iata)', 'APPLY', `geodistance(@position, "${LOCATION_LON},${LOCATION_LAT}")`, 'AS', 'dist', 'LIMIT', '0', '9999', 'SORTBY', '2', '@dist', 'ASC'
];

// Sleep for QUERY_INTERVAL milliseconds.
async function sleep() {
  return new Promise((resolve) => {
    setTimeout(resolve, QUERY_INTERVAL);
  });
};

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

while(true) {
  let response = await redisClient.sendCommand(LATEST_UPDATED_COMMAND);

  if (response && response.length == 2 && response[1].length === 6) {
    const redisKey = response[1][1];
    console.log(`Found latest updated flight with enriched data: ${redisKey}`);
    await redisClient.copy(redisKey, `lookup:latest_enriched_flight`, { REPLACE: true });
  }

  // This is pretty naive, we could improve by sending commands in an explicit pipeline.
  response = await redisClient.sendCommand(PLANE_POSITIONS_COMMAND);
  console.log(`Found ${response[0]} nearby flights with enriched data.`);


  if (response && response[0] > 0) {
    // First item is the count, remove it.
    response.shift();

    // Delete any old stream.
    await redisClient.del(PLANE_POSITIONS_STREAM_KEY);

    for (const thisFlight of response) {
      const flightObj = {};
      for (let n = 0  ; n < thisFlight.length; n+=2) {
        const key = thisFlight[n];
        const value = thisFlight[n+1];
        flightObj[key] = value;
      }

      delete flightObj.position; // No need to store this in the stream.

      flightObj['description'] = `${flightObj.operator_iata}${flightObj.flight_number}: ${flightObj.origin_iata}-${flightObj.destination_iata}`;
      flightObj['description_short'] = `${flightObj.operator_iata}${flightObj.flight_number}`;

      // TODO: Consider operator color, aircraft type.

      // TODO: Don't need to log this when we are happy with the data.
      console.log(flightObj);

      // Only add flights updated within the last 5 minutes.
      if (parseInt(flightObj.last_updated) >= Date.now() - (5 * 60 * 1000)) {
        // Add to stream, no need to await this as the order doesn't matter.
        redisClient.xAdd(PLANE_POSITIONS_STREAM_KEY, '*', flightObj);
      }
    }  
  }

  await sleep();
}
