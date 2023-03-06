# Enricher Component

TODO introduction...

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