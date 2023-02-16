import * as dotenv from 'dotenv';
import { createClient } from 'redis';
import * as sbs1 from 'sbs1';

dotenv.config()

const FLIGHT_RETENTION_PERIOD = 60 * 60; // 60 mins.
const SBS_HOST = process.env.SBS_HOST || '127.0.0.1';
const SBS_PORT = process.env.SBS_PORT || 30003;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const sbs1Client = sbs1.createClient({
  host: SBS_HOST,
  port: SBS_PORT
});

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();

sbs1Client.on('message', async (msg) => {
  console.log(msg);
  const flightKey = `flight:${msg.hex_ident}`;

  const msgData = {
    hex_ident: msg.hex_ident,
    aircraft_id: msg.aircraft_id,
    last_updated: Date.now()
  };

  if (msg.lat) {
    msgData.lat = msg.lat;
  }

  if (msg.lon) {
    msgData.lon = msg.lon;
  }

  if (msg.altitude) {
    msgData.altitude = msg.altitude;
  }

  if (msg.callsign) {
    msgData.callsign = msg.callsign.trim();
  }

  await redisClient.hSet(flightKey, msgData);
  redisClient.expire(flightKey, FLIGHT_RETENTION_PERIOD);
});