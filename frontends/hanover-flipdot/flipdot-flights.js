import FlipDot from 'flipdot-display';
import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const SIGN_ROWS = parseInt(process.env.SIGN_ROWS, 10);
const SIGN_COLS = parseInt(process.env.SIGN_COLS, 10);
const SIGN_DEVICE = process.env.SIGN_DEVICE;
const SIGN_ADDRESS = parseInt(process.env.SIGN_ADDRESS, 10);
const SIGN_FLIP_INTERVAL = parseInt(process.env.SIGN_FLIP_INTERVAL, 10);
const SIGN_REPEATS = parseInt(process.env.SIGN_REPEATS, 10);

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

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

console.log('Listening for flights...');
await redisClient.subscribe('interestingflights', (msg) => {
  const flightData = JSON.parse(msg);
  console.log(flightData);

  const dataToDisplay = [
    `${flightData.operator_iata}${flightData.flight_number}`,
    `${flightData.origin_iata} - ${flightData.destination_iata}`,
    flightData.aircraft_type,
    flightData.registration,
    `${flightData.altitude}FT`
  ];

  // TODO send this to the Hanover sign!
  console.log(dataToDisplay);
});