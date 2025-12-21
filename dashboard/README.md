# Dashboard Assistant and Grafana Dashboard

TODO overview...

## Setup (Dashboard Assistant Component)

To set this up you'll need the following:

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* Fully set up and working instances of the receiver and enricher components ([reciever instructions](../receiver/README.md), [enricher instructions](../enricher/README.md)) which are also connected to the same Redis Stack instance you are using for this component.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).

Finally, install the dependencies:

```
npm install
```

## Running the Dashboad Assistant

Start the dashboard assistant component like this:

```
npm start
```

TODO example output...

Stop the dashboard assistant by pressing `Ctrl-C`.