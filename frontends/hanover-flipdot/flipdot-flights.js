import * as dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// TODO all the things!!!
// Set up some env vars for port, address, rows, cols for the sign.

// Listen for pub/sub, display on the flipdot.