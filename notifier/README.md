# Notifier Component

TODO introduction...

## Setup

To set this up you'll need the following:

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* A fully set up and working instance of both the receiver component ([read about this here](../receiver/README.md)) and the enricher component ([read more about this here](../enricher/README.md)).  Both of these other components need to be connected to the same Redis Stack instance you are using for this component.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).

If you want to change the interval at which this component checks Redis for interesting flights, adjust the value of `QUERY_INTERVAL` in `.env` to be the number of milliseconds you want to use.  The default is 30,000 (30 seconds).

Finally, install the dependencies:

```
npm install
```

## Running the Notifier

Start the notifier component like this:

```
npm start
```

Every so often (currently 30 seconds hard coded, might make this configurable in future) the notifier wakes up and runs a `FT.AGGREGATE` query against the flight data stored in Redis Hashes.  This query searches for the most recently updated flight that's within a given distance of a location (distance and location currently hard coded to be 20,000 metres and central Nottingham, England - may make these configurable in future).  The flight must also be "interesting" which means that the aircraft type needs to be one that I am interested in.  These types are also hard coded (at the moment) but I may make them configurable in future.  The values are ICAO codes - [list here on Wikipedia](https://en.wikipedia.org/wiki/List_of_aircraft_type_designators).

Whenever the query returns a flight, its data is published on a [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/) channel called `interestingflights`.  The payload looks like this (stringified JSON) - a passing British Airways A380 headed to San Francisco:

```
"{\"redisKey\":\"flight:406D1A\",\"hex_ident\":\"406D1A\",\"last_updated\":\"1678118550403\",\"altitude\":\"29125\",\"callsign\":\"BAW28K\",\"registration\":\"G-XLEJ\",\"origin_iata\":\"LHR\",\"origin_name\":\"London Heathrow\",\"destination_iata\":\"SFO\",\"destination_name\":\"San Francisco Int'l\",\"aircraft_type\":\"A388\",\"operator_iata\":\"BA\",\"flight_number\":\"287\",\"lat\":\"52.93562\",\"lon\":\"-1.13638\",\"position\":\"-1.13638,52.93562\"}"
```

The idea is that interested front ends will subscribe to the `interestingflights` channel, and display the information received in a way appropriate to the front end.  If the front end needs more information than that contained in the pub/sub message, it can use the value of `redisKey` to obtain the key name of the Redis hash containing the data in Redis, and directly access this.  In the above example, the key is `flight:406D1A`.

