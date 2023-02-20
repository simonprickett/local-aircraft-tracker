# Radio Receiver Component

This is the radio receiver component.  It uses the [SBS1 module](https://www.npmjs.com/package/sbs1) to talk to [dump1090](https://github.com/MalcolmRobb/dump1090), which in turn talks to the software defined radio USB stick.  Basically, it turns radio messages from passing aircraft into objects that we can use in Node.js applications.

Whenever it receives a message, this component writes some of the data to [Redis Hashes](https://redis.io/docs/data-types/hashes/), updates the last updated timestamp field and resets the time to live on the flight in Redis to an hour.  This ensures that flights that have passed by and aren't in range of the radio any more naturally disappear from the dataset in Redis.

If a flight callsign is detected, this component also adds information about this flight to a queue.  The queue is implemented as a [Redis List](https://redis.io/docs/data-types/lists/), and is used to pass requests to the "enricher" component which gets more information about the flight using the FlightAware API.  This is a paid API, so to make sure that we don't call it repeatedly for the same flight, this component sets a Redis key for each flight ID that it puts in the queue.  These keys expire after a time, and if subsequent requests to get information for that flight occure in this period, they aren't added to the queue.

## Setup

To set this up you'll need the following:

* A running copy of [dump1090](https://github.com/MalcolmRobb/dump1090) (start it with `dump1090 --net --interactive`).  You'll have to compile this from source.
* An appropriate software defined radio USB stick connected to your machine.  I use [this one](https://www.radarbox.com/flightstick1090), but others are available.
* An appropriate aerial for your software defined radio.  I use [this one](https://www.ebay.co.uk/itm/284156504809), but others are available.
* [Node.js](https://nodejs.org/) version 14.5.0 or higher (I've tested this with version 16.5.1).
* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).  You shouldn't need to change the values for `SBS_HOST` and `SBS_PORT` so long as dump1090 is running on the same machine as this project runs on.

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

TODO... proper README!