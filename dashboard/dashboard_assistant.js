import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config({ quiet: true });

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUERY_INTERVAL = parseInt(process.env.QUERY_INTERVAL, 10);
const AGGREGATE_COMMAND = [
  "FT.AGGREGATE", "idx:flights", "*", "LOAD", "2", "__key", "@aircraft_type", "FILTER", "exists(@aircraft_type)", "SORTBY", "2", "@last_updated", "DESC", "LIMIT", "0", "1"
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
  const response = await redisClient.sendCommand(AGGREGATE_COMMAND);

  console.log(response[1])
  if (response && response.length == 2 && response[1].length === 6) {
    const redisKey = response[1][1];
    console.log(`Found latest updated flight with enriched data: ${redisKey}`);
    await redisClient.copy(redisKey, `lookup:latest_enriched_flight`, { REPLACE: true });
  }

  await sleep();
}
