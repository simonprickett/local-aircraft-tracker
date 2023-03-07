# Notifier Component

This is the "nofifier" component.  Its role in the system is to periodically run a query over the flight data stored in Redis hashes and indexed by the search capability of Redis Stack.  It aims to find the most recently updated flight that is within a given distance of the user's location, and which is considered "interesting".

The current definition of an "interesting" flight is one that's operated by a widebody aircraft.  These are identified using the `aircraft_type` field stored for each flight (this is populated by the [enricher component](../enricher) using the [FlightAware Aero API](https://flightaware.com/commercial/aeroapi/)).  The query that this component runs contains many [ICAO codes](https://en.wikipedia.org/wiki/List_of_aircraft_type_designators) for widebody aircraft variants.

Whenever an "interesting" flight is detected, this component publishes its details on a [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/) channel, so that interested subscribers may receive these details and do with them as they please - without any knowledge of how the rest of the aircraft tracking system is implemented.

## Setup

To set this up you'll need the following:

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* A fully set up and working instance of both the receiver component ([read about this here](../receiver/README.md)) and the enricher component ([read more about this here](../enricher/README.md)).  Both of these other components need to be connected to the same Redis Stack instance you are using for this component.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).

If you want to change the interval at which this component checks Redis for interesting flights, adjust the value of `QUERY_INTERVAL` in `.env` to be the number of milliseconds you want to use.  The default is 30,000 (30 seconds).

By default, this component checks for flights within a 20,000 metre radius of a latitude/longitude point in central Nottingham, England. If you want to change these values, edit `POSITION_RADIUS`, `POSITION_LATITUDE` and `POSITION_LONGITUDE` in `.env` and save your changes.

Finally, install the dependencies:

```
npm install
```

## Running the Notifier

Start the notifier component like this:

```
npm start
```

Every so often (default 30 seconds, see `env.example` for how to override this value) the notifier wakes up and runs a `FT.AGGREGATE` query against the flight data stored in Redis Hashes.  This query searches for the most recently updated flight that's within a given radius of a lat/long position (configurable - see the `env.example` file).  The flight must also be "interesting" which means that the aircraft type needs to be one that I am interested in.  These types are currently hard coded (at the moment) but I may make them configurable in future.  The values are ICAO codes - [list here on Wikipedia](https://en.wikipedia.org/wiki/List_of_aircraft_type_designators).

Whenever the query returns a flight, its data is published on a [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/) channel called `interestingflights`.  The payload looks like this (stringified JSON) - a passing British Airways A380 headed to San Francisco:

```
"{\"redisKey\":\"flight:406D1A\",\"hex_ident\":\"406D1A\",\"last_updated\":\"1678118550403\",\"altitude\":\"29125\",\"callsign\":\"BAW28K\",\"registration\":\"G-XLEJ\",\"origin_iata\":\"LHR\",\"origin_name\":\"London Heathrow\",\"destination_iata\":\"SFO\",\"destination_name\":\"San Francisco Int'l\",\"aircraft_type\":\"A388\",\"operator_iata\":\"BA\",\"flight_number\":\"287\",\"lat\":\"52.93562\",\"lon\":\"-1.13638\",\"position\":\"-1.13638,52.93562\"}"
```

The idea is that interested front ends will subscribe to the `interestingflights` channel, and display the information received in a way appropriate to the front end.  If the front end needs more information than that contained in the pub/sub message, it can use the value of `redisKey` to obtain the key name of the Redis hash containing the data in Redis, and directly access this.  In the above example, the key is `flight:406D1A`.
