import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const AGGREGATE_COMMAND = ["ft.aggregate", "idx:flights", "*", "load", "4", "@__key", "@position", "@aircraft_type", "@last_updated", "filter", "@last_updated > 0", "filter", "exists(@position)", "filter", "exists(@aircraft_type)", "filter", "@aircraft_type == 'A388' || @aircraft_type == 'A35K' || @aircraft_type == 'A359' || @aircraft_type == 'A346' || @aircraft_type == 'A343' || @aircraft_type == 'A332' || @aircraft_type == 'A333' || @aircraft_type == 'A339' || @aircraft_type == 'A337' || @aircraft_type == 'A306' || @aircraft_type == 'A30B' || @aircraft_type == 'A3ST' || @aircraft_type == 'B788' || @aircraft_type == 'B789' || @aircraft_type == 'B78X' || @aircraft_type == 'B744' || @aircraft_type == 'B748' || @aircraft_type == 'B752' || @aircraft_type == 'B753' || @aircraft_type == 'B762' || @aircraft_type == 'B763' || @aircraft_type == 'B764' || @aircraft_type == 'B772' || @aircraft_type == 'B773' || @aircraft_type == 'B77W' || @aircraft_type == 'B77L'", "apply", "geodistance(@position, \"-1.148369,52.953150\")", "as", "dist", "filter", "@dist < 20000", "sortby", "2", "@last_updated", "desc", "limit", "0", "1"];

// Sleep for 30 seconds...
async function sleep() {
  return new Promise((resolve) => {
    setTimeout(resolve, 30000);
  });
};

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

while(true) {
  // Run the aggregate query to find the latest "interesting" plane...
  const response = await redisClient.sendCommand(AGGREGATE_COMMAND);
  console.log(response);

  if (response.length === 2) {
    // Update the timestamp for next time...
    const updatedTimestamp = response[1][7];
    AGGREGATE_COMMAND[10] = `@last_updated > ${updatedTimestamp}`;

    // Get more information about the interesting flight...
    const redisKey = response[1][1];
    const flightDetails = await redisClient.hGetAll(redisKey);

    console.log(flightDetails);

    // Notify interested front ends...
    const payload = {
      redisKey,
      ...flightDetails
    };

    redisClient.publish('interestingflights', JSON.stringify(payload));
  } else {
    console.log('No new matches.');
  }

  await sleep();
}