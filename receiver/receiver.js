import * as dotenv from 'dotenv';
import { createClient } from 'redis';
import * as sbs1 from 'sbs1';

dotenv.config({ quiet: true });

const FLIGHT_RETENTION_PERIOD = 60 * 60; // 60 mins.
const FLIGHTAWARE_MAX_REQUEST_AGE = 60 * 60; // 60 mins.
const SBS_HOST = process.env.SBS_HOST || '127.0.0.1';
const SBS_PORT = process.env.SBS_PORT || 30003;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const FLIGHTAWARE_QUEUE = 'flightawarequeue';

// Lua script to update a key only if the new value is greater than the current value.
const getLuaSource = () => `
  local key = KEYS[1]
  local new = ARGV[1]
  local current = redis.call('GET', key)

  if (current == false) or (tonumber(new) > tonumber(current)) then
    redis.call('SET', key, new)
    return 1
  else
    return 0
  end;
`;

const sbs1Client = sbs1.createClient({
  host: SBS_HOST,
  port: SBS_PORT
});

const redisClient = createClient({
  url: REDIS_URL
});

await redisClient.connect();
const updateIfGreaterSha = await redisClient.scriptLoad(getLuaSource());

sbs1Client.on('message', async (msg) => {
  console.log(msg);
  const flightKey = `flight:${msg.hex_ident}`;

  const msgData = {
    hex_ident: msg.hex_ident,
    last_updated: Date.now()
  };

  if (msg.lat && msg.lon) {
    msgData.lat = msg.lat;
    msgData.lon = msg.lon;

    // Also add a field in the format that search expects geo fields in:
    // longitude,latitude
    msgData.position = `${msg.lon},${msg.lat}`;
  }

  if (msg.altitude) {
    msgData.altitude = msg.altitude;
  }

  if (msg.ground_speed) {
    msgData.ground_speed = msg.ground_speed;
  }

  if (msg.callsign) {
    msgData.callsign = msg.callsign.trim();
  }

  if (msg.track) {
    msgData.track = msg.track;
  }

  await redisClient.hSet(flightKey, msgData);
  redisClient.expire(flightKey, FLIGHT_RETENTION_PERIOD);

  if (msgData.callsign) {
    // Only push if we haven't seen this flight recently...
    const response = await redisClient.set(
      `flightaware:recent:${msgData.callsign}`, 
      msgData.last_updated, 
      {
        NX: true,
        EX: FLIGHTAWARE_MAX_REQUEST_AGE
      }
    );

    if (response) {
      // We haven't seen a FlightAware API request for this identifier recently, 
      // so send the hex_ident and callsign values to the enricher
      // component - it needs callsign to pass to the FlightAware API and
      // hex_ident to create the correct Redis key to store the data in...
      const msgPayload = {
        hex_ident: msgData.hex_ident,
        callsign: msgData.callsign
      };

      console.log(`Pushed Flightaware request for ${msgData.callsign}`);
      redisClient.lPush(FLIGHTAWARE_QUEUE, JSON.stringify(msgPayload));
    }
  }

  // Log all messages with dates for stats purposes.
  const dateValue = (msg.logged_date && msg.logged_date.length > 0) 
    ? msg.logged_date.replaceAll('/', '') 
    : new Date().toISOString().slice(0, 10).replaceAll('-', '');
  redisClient.hIncrBy('stats:messagecounts', dateValue, 1);

  // Log max altitude seen.
  if (msgData.altitude) {
    redisClient.evalSha(updateIfGreaterSha, {
      keys: ['stats:maxaltitude'],
      arguments: [msgData.altitude.toString()]
    });
  }

  // Log fastest ground speed seen.
  if (msgData.ground_speed) {
    redisClient.evalSha(updateIfGreaterSha, {
      keys: ['stats:fastestgroundspeed'],
      arguments: [msgData.ground_speed.toString()]
    });
  }
});