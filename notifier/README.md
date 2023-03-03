# Notifier Component

TODO introduction...

## Setup

To set this up you'll need the following:

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* A fully set up and working instance of both the receiver component ([read about this here](../receiver/README.md)) and the enricher component ([read more about this here](../enricher/README.md)).  Both of these other components need to be connected to the same Redis Stack instance you are using for this component.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).

Finally, install the dependencies:

```
npm install
```

## Running the Notifier

Start the enricher component like this:

```
npm start
```

TODO what happens...