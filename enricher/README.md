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

TODO what happens...