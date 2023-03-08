import FlipDot from 'flipdot-display';
import * as dotenv from 'dotenv';
import { createClient } from 'redis';
import { Mutex} from 'async-mutex';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const SIGN_ROWS = parseInt(process.env.SIGN_ROWS, 10);
const SIGN_COLS = parseInt(process.env.SIGN_COLS, 10);
const SIGN_DEVICE = process.env.SIGN_DEVICE;
const SIGN_ADDRESS = parseInt(process.env.SIGN_ADDRESS, 10);
const SIGN_FLIP_INTERVAL = parseInt(process.env.SIGN_FLIP_INTERVAL, 10);
const SIGN_REPEATS = parseInt(process.env.SIGN_REPEATS, 10);

async function sleep(millis) {
  return new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
}

function calculatePixelWidth(msg) {
  let pixelCount = 0;

  for (const char of msg) {
    // Regular chars 9 pixels wide, a space is 1.
    pixelCount += (char === ' ' ? 1 : 9);
  }

  return pixelCount;
}

const flippy = new FlipDot(SIGN_DEVICE, SIGN_ADDRESS, SIGN_ROWS, SIGN_COLS);

flippy.on('error', (err) => {
  console.error('Flippy Error:');
  console.error(err);
});

flippy.once('open', () => {
  console.log(`Connected to flip dot device at ${SIGN_DEVICE}.`);
});

// The sign takes a long time to update, so let's use a Mutex in case subsequent
// flight details arrive while we are showing one...
// https://www.npmjs.com/package/async-mutex
const signMutex = new Mutex();

async function displayData(lines) {
  await signMutex.runExclusive(async () => {
    for (let n = 0; n < SIGN_REPEATS; n++) {
      for (const line of lines) {
        const xOffset = Math.floor((SIGN_COLS - calculatePixelWidth(line)) / 2);
        flippy.writeText(line, { font: 'Banner3' }, [0, xOffset], false, true);
        flippy.send();
        await sleep(SIGN_FLIP_INTERVAL);
      }

      flippy.fill(0xFF);
      if (n < SIGN_REPEATS) {
        await sleep(SIGN_FLIP_INTERVAL);
      }
    }
  });
}

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();
console.log('Connected to Redis, listening for flights...');

await redisClient.subscribe('interestingflights', async (msg) => {
  const flightData = JSON.parse(msg);
  console.log(flightData);

  const dataToDisplay = [
    `${flightData.operator_iata}${flightData.flight_number}`,
    `${flightData.origin_iata} - ${flightData.destination_iata}`,
    flightData.aircraft_type,
    flightData.registration,
    `${flightData.altitude}FT`
  ];

  await displayData(dataToDisplay);
});
