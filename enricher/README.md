# Enricher Component

This is the "enricher" component.  It pulls entries from a Redis List that is being used as a queue between this component and the [receiver](../receiver) component.  Each entry represents a flight that needs additional data fetching from the [FlightAware Aero API](https://flightaware.com/commercial/aeroapi/).  

This component calls the API to fetch that data, storing it back in the Redis Hash representing the flight.  It also records statistics about the aircraft seen in the following Redis data structures ([see the bonus video for details](https://www.youtube.com/watch?v=ttXq_E4Galw)):

* [Set](https://redis.io/docs/data-types/sets/): The key for this is `stats:planesseen`.  It is used to record the registrations of each plane seen.  We can use the [`SCARD` command](https://redis.io/commands/scard/) to get the cardinality of the Set (how many different planes have we seen), the [`SISMEMBER` command](https://redis.io/commands/sismember/) to see whether we have seen a given registration, and the [`SSCAN`](https://redis.io/commands/sscan/) or [`SMEMBERS`](https://redis.io/commands/smembers/) commands to retrive all of the registrations seen.  The benefit of using a Set here is that we can do all of these things, the downside is that because we keep all of the data the memory used by the Set will grow over time and may become a problem.
* [Hyperloglog](https://redis.io/docs/data-types/probabilistic/hyperloglogs/): The key for this is `stats:planesapprox`.  It is used to approximate the number of different plane registrations we have seen.  We use the [`PFCOUNT` command](https://redis.io/commands/pfcount/) to get the approximation.  The benefit of a Hyperloglog is that it allows us to approximate the number of distinct planes seen without storing the data (it's hashed away) and to a reasonable degree of accuracy.  The downsides include inability to retrieve the original data back from the Hyerloglog and loss of absolute accuracy.
* [Sorted Set](https://redis.io/docs/data-types/sorted-sets/): The key for this is `stats:operators`.  This is used as a scoreboard to track the most frequently seen aircraft operators (Lufthansa, Ryanair, EasyJet, Virgin Atlantic etc) by operator code.  We can use the [`ZRANGE` command](https://redis.io/commands/zrange/) to get slices of this high score table, and the [`ZRANK` command](https://redis.io/commands/zrank/) to see what a given operator's rank is.  The benefit of a Sorted Set is accuracy, the downside can be memory usage for a large data set.
* [Top-K](https://redis.io/docs/data-types/probabilistic/top-k/): The key for this is `stats:aircrafttypes`.  This is also used as a scoreboard, in this case for the different types of aircraft seen (Airbus A319, Boeing 737-800, Embraer 190 etc).  This is a probabilistic data structure, so there's some trade off between accuracy and space required to store the data.  We can retrieve the leaderboard with approximate scores using the [`TOPK.LIST` command](https://redis.io/commands/topk.list/).

## Setup

To set this up you'll need the following:

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* A fully set up and working instance of the receiver component ([read about this here](../receiver/README.md)) which is also connected to the same Redis Stack instance you are using for this component.
* An API key for the [FlightAware Aero API](https://flightaware.com/commercial/aeroapi/).  Note this this is a paid API - you do get some calls without charge but you will need to sign up and provide a payment method.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).  You'll also need to add your FlightAware API key to the `FLIGHTAWARE_API_KEY` field.

Finally, install the dependencies:

```
npm install
```

## Running the Enricher

Start the enricher component like this:

```
npm start
```

The enricher will mostly do nothing, until the [receiver component](../receiver) places a message on the list that the enricher monitors (this list is stored in Redis at key `flightawarequeue`).  When nothing is happening, expect the output to look like this:

```
No new work to do.
No new work to do.
No new work to do.
...
```

Once the receiver has enough data about a flight, it'll place a message on the queue for the enricher to pick up.  This message contains a stringified JSON object that looks like this:

```
{"hex_ident":"3CEE56","callsign":"AHO241N"}'
```

The enricher then passes the `callsign` to the FlightAware API, using the `hex_ident` to identify the Redis hash containing the flight's details.  Additional detail about the flight from FlightAware is then stored in this hash.  

Here's an example of the expected output from the enricher when it has a queue entry to work on:

```
Asking FlightAware for data on SHT4D (400942)
Saving details to flight:400942...
{
  registration: 'G-EUOF',
  origin_iata: 'LHR',
  origin_name: 'London Heathrow',
  destination_iata: 'BHD',
  destination_name: 'George Best Belfast City',
  aircraft_type: 'A319',
  operator_iata: 'BA',
  flight_number: '1420'
}
Entering rate limiter sleep.
Exited rate limiter sleep.
```

Note that after looking up a flight, the enricher sleeps for a couple of seconds.  This is a lazy implementation by me that avoids dealing with FlightAware's API rate limiter by just making sure that the component shouldn't make more than the allowed number of requests per minute.