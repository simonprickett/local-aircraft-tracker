# Dashboard Assistant and Grafana Dashboard

This is the "dashboard assistant" component, along with the Grafana dashboard definitions used to visualize the project's data.

The dashboard assistant's job is to keep a live-updating [Redis Stream](https://redis.io/docs/data-types/streams/) of flight position data topped up, ready for Grafana's [geomap panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/) to plot on a map. It does this by periodically running an `FT.AGGREGATE` query against the same [RediSearch index](../receiver/index.redis) that the [receiver](../receiver) and [enricher](../enricher) components populate, calculating each flight's distance from a configurable point, and rewriting the Stream with the latest set of results. Unlike the [notifier component](../notifier) - which looks for a single "most interesting" flight and pushes it to Pub/Sub and a capped Stream for the physical front ends - the dashboard assistant is only concerned with feeding the Grafana dashboard, and it does so with *every* flight currently tracked, not just "interesting" ones.

It uses the following Redis data structures:

* [Stream](https://redis.io/docs/data-types/streams/): The key for this is `mappableflights`. On every query cycle, the old stream is deleted and repopulated with the current set of trackable flights (position, heading, operator, aircraft type flags, distance, etc). Grafana's [Redis Data Source plugin](https://github.com/RedisGrafana/grafana-redis-datasource) reads this in streaming mode, so the map panel updates live as new entries are appended, rather than waiting for the dashboard's own refresh interval.
* [String](https://redis.io/docs/data-types/strings/): The key for this is `lookup:latest_enriched_flight`. Each cycle, this component finds the most recently updated flight that has enriched data (from the enricher component) and uses the [`COPY` command](https://redis.io/commands/copy/) to duplicate that flight's Hash onto this well-known key. This gives Grafana panels like "Most Recently Seen" a fixed key to query, without needing to know which `flight:<hex_ident>` key is currently the freshest.

## Setup (Dashboard Assistant Component)

To set this up you'll need the following:

* A [Redis 8](https://redis.io/tutorials/howtos/quick-start/) database. Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis Docker image ([here](https://hub.docker.com/_/redis)) or use the Docker Compose file at the root of this repository.
* Fully set up and working instances of the receiver and enricher components ([receiver instructions](../receiver/README.md), [enricher instructions](../enricher/README.md)) which are also connected to the same Redis instance you are using for this component.
* [Node.js](https://nodejs.org/) - this component's `package.json` requires version 24.11.1 or higher.

First, configure the environment by copying `env.example` to `.env`. Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)). Optionally, you can also change the value of `QUERY_INTERVAL` - this is how long the dashboard assistant sleeps between running Redis commands. The default is 1 second, which should be fine for everyday use. Finally, change the values of `LOCATION_LAT` and `LOCATION_LON` to match your location (the defaults point at central Nottingham, England, matching my own receiver's location). These values are used by the `FT.AGGREGATE` query's `geodistance` function to calculate how far away each plane is, in metres.

Finally, install the dependencies:

```bash
npm install
```

## Running the Dashboard Assistant

Start the dashboard assistant component like this:

```bash
npm start
```

If the receiver and enricher are also running, you can expect to see output similar to this on every query cycle:

```
Found latest updated flight with enriched data: flight:4078EF
Found 23 nearby flights with enriched data.
{
  lat: '52.37429',
  lon: '-1.41959',
  track: '312',
  operator_iata: 'U2',
  operator_color: '#FF9830',
  is_widebody: '0',
  is_quad: '0',
  flight_number: '2141',
  origin_iata: 'BFS',
  destination_iata: 'SOU',
  last_updated: '1789123411112',
  aircraft_type: 'A320',
  dist: '15887.82',
  description: 'U22141 BFS-SOU',
  description_short: 'U22141'
}
```

Flights are only written to the `mappableflights` stream if they were updated within the last 5 minutes - anything older is considered stale and left out, so the stream naturally stays current without needing any separate expiry logic.

Stop the dashboard assistant by pressing `Ctrl-C`.

## Cleanup Script

`cleanup.js` resets the Redis dataset back to a clean state. It deletes the working-set keys created by the receiver, enricher, notifier and dashboard assistant components (the `flightawarequeue` and `mappableflights` keys, the various `stats:*` scoreboards, and any `flight:*` and `flightaware:recent:*` keys) - everything except the static lookup data loaded by the enricher's setup step (`types:widebody`, `types:quad`, and the operator data).

**Stop the receiver, enricher, and notifier components before running this**, otherwise they'll immediately start writing new data back into the keys you're trying to clear.

Run it like this:

```bash
npm run cleanup
```

## Setup and Running Grafana

You'll need a Grafana instance (Grafana Cloud, a local Docker container, or a local install like Homebrew's on macOS) with the [Redis Data Source plugin](https://github.com/RedisGrafana/grafana-redis-datasource) installed and configured to point at the same Redis instance the other components use.

This folder contains three dashboard JSON files, but **only one of them is meant to be used**:

* `combined_grafana_dashboard.json` - **this is the dashboard to import and use.** It's titled "Redis Plane Tracker + Map" in Grafana, and combines the flight statistics panels with the live geomap panel that streams from `mappableflights`.
* `plane_tracker_grafana_dashboard.json` and `plane_mapper_grafana_dashboard.json` - earlier, standalone dashboards ("Redis Plane Tracker" and "Redis Plane Mapper" respectively) from before the two were merged. They're kept here for reference/history only - everything they contain now lives in the combined dashboard, so there's no need to import them separately.

Note that `combined_grafana_dashboard.json` is saved as a full Grafana dashboard *resource manifest* (`apiVersion: dashboard.grafana.app/v2`, with `metadata`/`spec` fields), rather than the plain dashboard JSON model that Grafana's "Import dashboard" screen expects - pasting it into that dialog won't work. Instead, apply it using [`gcx`](https://github.com/grafana/gcx), Grafana's unified CLI for managing dashboards, datasources, alerting and other Grafana/Grafana Cloud resources from the command line.

If you're on macOS with Homebrew, install it with:

```bash
brew install grafana/grafana/gcx
```

For other platforms, see the install instructions in the [gcx README](https://github.com/grafana/gcx). Once installed, log in and point it at your Grafana instance (see `gcx login --help`), then create the dashboard:

```bash
gcx dashboards create -f combined_grafana_dashboard.json --api-version dashboard.grafana.app/v2
```

(add `--context <name>` if you have more than one `gcx` context configured, to make sure you're targeting the right Grafana instance). Once created, the dashboard defaults to a 5 second auto-refresh, which is a good match for the dashboard assistant's default 1 second `QUERY_INTERVAL`.
