import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

// TODO do something!!!!