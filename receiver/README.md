# Radio Receiver Component

This is the radio receiver component.  It uses the [SBS1 module](https://www.npmjs.com/package/sbs1) to talk to [dump1090](https://github.com/MalcolmRobb/dump1090), which in turn talks to the software defined radio USB stick.  Basically, it turns radio messages from passing aircraft into objects that we can use in Node.js applications.

Whenever it receives a message, this component writes some of the data to [Redis Hashes](https://redis.io/docs/data-types/hashes/), updates the last updated timestamp field and resets the time to live on the flight in Redis to an hour.  This ensures that flights that have passed by and aren't in range of the radio any more naturally disappear from the dataset in Redis.

If a flight callsign is detected, this component also adds information about this flight to a queue.  The queue is implemented as a [Redis List](https://redis.io/docs/data-types/lists/), and is used to pass requests to the "enricher" component which gets more information about the flight using the FlightAware API.  This is a paid API, so to make sure that we don't call it repeatedly for the same flight, this component sets a Redis key for each flight ID that it puts in the queue.  These keys expire after a time, and if subsequent requests to get information for that flight occur in this period, they aren't added to the queue.

## Setup

To set this up you'll need the following:

* A running copy of [dump1090](https://github.com/MalcolmRobb/dump1090) (start it with `dump1090 --net --interactive`).  You'll have to compile this from source.
* An appropriate software defined radio USB stick connected to your machine.  I use [this one](https://www.radarbox.com/flightstick1090), but others are available.
* An appropriate aerial for your software defined radio.  I use [this one](https://www.ebay.co.uk/itm/284156504809), but others are available.
* [Node.js](https://nodejs.org/) version 14.5.0 or higher (I've tested this with version 16.5.1).
* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* Optional but useful, a copy of [RedisInsight](https://redis.com/redis-enterprise/redis-insight/) so that you can inspect the data in Redis.

Before running the code, connect to your Redis Stack instance using eiher redis-cli or RedisInsight and run the Redis command contained in the file `index.redis`.  When run, this command should return `OK` and will create a search index for the flight data that we'll query from another component of the system.

To run the receiver code, first configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).  You shouldn't need to change the values for `SBS_HOST` and `SBS_PORT` so long as dump1090 is running on the same machine as this project runs on.

Finally, install the dependencies:

```
npm install
```

## Running the Radio Receiver 

Start the receiver component like this:

```
npm start
```

If the receiver connects to your dump1090 instance correctly, you should see lots of message output similar to the following:

```
{
  message_type: 'MSG',
  transmission_type: 3,
  session_id: '111',
  aircraft_id: '11111',
  hex_ident: '4079D3',
  flight_id: '111111',
  generated_date: '2023/02/16',
  generated_time: '13:29:11.085',
  logged_date: '2023/02/16',
  logged_time: '13:29:11.081',
  callsign: null,
  altitude: 35550,
  ground_speed: null,
  track: null,
  lat: 52.79475,
  lon: -0.88573,
  vertical_rate: null,
  squawk: null,
  alert: null,
  emergency: null,
  spi: null,
  is_on_ground: false
}
```

The there are different types of message (`transmission_type` will vary) but all have the same schema.  Fields that are populated for some message types may not be for others.

Verify that data appears in Redis using [RedisInsight](https://redis.com/redis-enterprise/redis-insight/) or the redis-cli.  You should see Hashes appear in Redis whose keys begin with `flight:`.  Here's an example:

```
 > hgetall flight:405456
1) "hex_ident"
2) "405456"
3) "last_updated"
4) "1676913496856"
5) "altitude"
6) "27025"
7) "callsign"
8) "SHT13K"
9) "lat"
10) "52.67772"
11) "lon"
12) "-1.77076"
```

Some fields may be missing, this means that those data items haven't been received for that flight yet.  When a `callsign` field is seen for a given flight, it is also stored in the Hash.  The `callsign` and `hex_ident` are then put on the Redis List whose key is `flightawarequeue`.  This acts as a queue of requests for the "enricher" component to go get additional flight data from the FlightAware API.  To ensure that we don't flood the FlightAware API with requests for a flight that we recently got the data for, a Redis key `flightaware:recent:<callsign>` is set.  This has an expiry of one hour, and if this key is present for a given flight, we don't add the request to the queue.

## How it Works

Here's a high level run through of how the code works...

First, two connections are established:

* One is to the "SBS" data port wherever dump1090 is running (hostname and port are configurable in the `.env` file - see `SBS_HOST` and `SBS_PORT`).  
* The other is a Redis connection, connecting to Redis with the credentials provided in the `REDIS_URL` setting in the `.env` file.

Messages from dump1090 are received as events, so the code listens for these with the SBS client instance:

```javascript
sbs1Client.on('message', async (msg) => {
  console.log(msg);
  // Do stuff, msg is a flat name/value pair JSON object with flight data...
};
```

Whenever a message is received, the code uses the `hex_ident` property to identify the aircraft, and that is used as part of the key to store data about the flight in a Redis hash.

The code then checks for the presence of various fields in the received `msg` object, building up a `msgData` object containing key/value pairs to persist to a Redis hash.

This data is persisted to Redis using the [`HSET`](https://redis.io/commands/hset/) and [`EXPIRE`](https://redis.io/commands/expire/) commands:

```javascript
await redisClient.hSet(flightKey, msgData);
redisClient.expire(flightKey, FLIGHT_RETENTION_PERIOD);
```

The hash is also set to expire after a time period, unless further messages about the aircraft are received (these will update the expiry time).

If the message data contains a `callsign` (the field that identifies the flight, rather than the aircraft (identified by `hex_ident`)), then the receiver will also put this flight in the queue for the [enricher](../enricher) component to work on.  However, it will only add the flight to the queue if it hasn't previously done so in the last hour.  This is to prevent duplicate lookups of a flight in FlightAware as their API costs money to use after a certain level of usage.

The code checks if a flight's details have been requested before using the Redis [`SET`](https://redis.io/commands/set/) command, with some modifiers:

```javascript
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
```

Here's how it works:

* First, we attempt to set a key in Redis named `flightaware:recent:<callsign>` which is used to remember that we've recently requested this flight.  We set the value of this key to be the last updated timestamp for the flight, but it could be any value as we're using the presence or absence of the key to indicate what to do next, we never actually use the value.
* When calling `SET`, we pass in a couple of modifiers: `NX: true` means only set the key if it doesn't exist already.  `EX: <duration>` tells Redis to expire the key (essentially consider it deleted) after a certain number of seconds have passed.
* We store the value of this command in `response` -- this will either be `OK` (the key was created, so we're asking for this flight for the first time recently) or `null` (the key already exists, so we have asked for this flight recently).
* If we haven't asked for this flight recently, the `hex_ident` and `callsign` are placed in an object that is then stringified and put on the queue for the enricher component to pick up, using the Redis [LPUSH](https://redis.io/commands/lpush/) command.