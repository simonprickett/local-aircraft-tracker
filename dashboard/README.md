# Dashboard Assistant and Grafana Dashboard

This is the Dashboard Assistant component. TODO overview...

## Setup (Dashboard Assistant Component)

To set this up you'll need the following:

* A [Redis 8](https://redis.io/tutorials/howtos/quick-start/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis Docker image ([here](https://hub.docker.com/_/redis)) or use the Docker Compose file at the root of this repository.
* Fully set up and working instances of the receiver and enricher components ([reciever instructions](../receiver/README.md), [enricher instructions](../enricher/README.md)) which are also connected to the same Redis instance you are using for this component.

First, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).  Optionally, you can also change the value of `QUERY_INTERVAL` - this is how long the dashboard assistant sleeps between running Redis commands.  The default is 1 second, which should be fine for everyday use.

Finally, install the dependencies:

```
npm install
```

## Running the Dashboad Assistant

Start the dashboard assistant component like this:

```
npm start
```

If the receiver and enricher are also running, you can expect to see output similar to this:

```
Found latest updated flight with enriched data: flight:4078EF
Found 14 nearby flights with enriched data.
{
  lat: '53.05014',
  lon: '-1.83693',
  operator_iata: 'U2',
  flight_number: '2004',
  origin_iata: 'AGP',
  destination_iata: 'MAN',
  dist: '47334.4',
  description: 'U22004: AGP-MAN',
  description_short: 'U22004'
}
```

Stop the dashboard assistant by pressing `Ctrl-C`.

## Setup (Grafana)

TODO