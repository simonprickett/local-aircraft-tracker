import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const SIGN_ROWS = parseInt(process.env.SIGN_ROWS, 10);
const SIGN_COLS = parseInt(process.env.SIGN_COLS, 10);
const SIGN_ADDRESS = parseInt(process.env.SIGN_ADDRESS, 10);
const SIGN_FLIP_INTERVAL = parseInt(process.env.SIGN_FLIP_INTERVAL, 10);
const SIGN_REPEATS = parseInt(process.env.SIGN_REPEATS, 10);

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

await redisClient.subscribe('interestingflights', (msg) => {
  const flightData = JSON.parse(msg);
  console.log(flightData);
});