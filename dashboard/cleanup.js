// IMPORTANT: Stop the receiver, enricher, and notifier components 
// before running this cleanup script.

import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config({ quiet: true });

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

console.log('Starting Redis cleanup...\n');

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

// Delete simple keys (non-wildcard)
const simpleKeys = [
  'flightawarequeue',
  'mappableflights',
  'lookup:last_enriched_flight',
  'stats:origins',
  'stats:destinations',
  'stats:flightawareapicalls',
  'stats:planesseen',
  'stats:operators',
  'stats:routes',
  'stats:fastestgroundspeed',
  'stats:maxaltitude',
  'stats:messagecounts',
  'stats:aircrafttypes'
];

for (const key of simpleKeys) {
  const result = await redisClient.del(key);
  if (result > 0) {
    console.log(`✓ Deleted key: ${key}`);
  } else {
    console.log(`- Key not found: ${key}`);
  }
}

// Delete wildcard patterns
const wildcardPatterns = [
  'flightaware:recent:*',
  'flight:*'
];

for (const pattern of wildcardPatterns) {
  const keysToDelete = await redisClient.keys(pattern);

  let deletedCount = 0;

  for (const keyBatch of chunk(keysToDelete, 100)) {
    if (keyBatch.length > 0) {
      const deleted = await redisClient.sendCommand(['DEL', ...keyBatch]);
      deletedCount += deleted;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`✓ Deleted ${deletedCount} keys matching pattern: ${pattern}`);
  } else {
    console.log(`- No keys found matching pattern: ${pattern}`);
  }
}

console.log('\nCleanup complete!');
await redisClient.quit();
