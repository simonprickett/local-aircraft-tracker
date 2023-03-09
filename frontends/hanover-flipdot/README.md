# Hanover Flip Dot Sign Front End Component

This is a very specific type of front end for the local aircraft tracking project - it requires an old [Hanover Displays flip dot bus sign](https://www.hanoverdisplays.com/about-us/our-history/).  Flip dots are a kind of electromagnetic pixel that have on and off states.  When in one state, the black side of the dot is showing, in the other state it shows the other side of the dot which has been finished in a bright colour.  Put a load of these together and you have a matrix that can be used to display messages.  It makes a fantastic sound when updating and uses no power to hold its current state.  At the end of the day, this is a gloriously over-engineered pub/sub subscriber :)

These are a little hard to get, but I happened to find one on eBay from a reputable bus parts seller.  Due to the magic of the Node.js community ecosystem, there's [a driver for them](https://www.npmjs.com/package/flipdot-display) that just works and handles the peculiar protocol for us!  There's also good support for using these with Python - maybe we'll look at that in a future project.

Here's an example of the sign working:

TODO EMBED GIF

If you want the glorious sound too, check out the YouTube video.  I wish GitHub would do proper embedding of YouTube videos in README files...

I don't expect anyone else to ever run this code (if you do [I'd love to hear from you](https://simonprickett.dev/contact/)), due to the specific hardware requirements.  In addition to the sign, you need a USB to RS-485 adapter (these are easy to get - [see here](https://www.amazon.co.uk/MODOVER-Converter-Adapter-Supports-Window/dp/B0BS48G5QZ/)) and to wire up the sign's two data lines to it.  Some of these have 2 wire connectors, others 3.  You can use either, but you only need 2 wires.  You'll also need a 20v power supply to power the sign, I initially used a 1A supply and found that wasn't enough - the sign was really sluggish.  It's much happier with 20v/5A.  I just got a laptop type power supply off of eBay and wired a barrel jack connector to the sign.

Even though I don't think you'll be able to run this part of the project, I hope you enjoy seeing it working and can learn a bit from the code about how to receive messages over [Redis pub/sub](https://redis.io/docs/manual/pubsub/) and feed them into a slow updating process (showing all the data on the sign takes a few seconds, so I had to add a mutex to the code to stop subsequent pub/sub messages taking over the sign when flight data from a previous message hasn't been completely displayed yet).  If we wanted to go all in on Redis, we could use a Redis List to queue messages to display instead (I'm doing this elsewhere in this project - using a list as a queue between the [receiver](../../receiver) and [enricher](../../enricher) components).  In this instance, I liked the idea of the in memory mutex for this use case, and again there's a [nice package on npm](https://www.npmjs.com/package/async-mutex) for that which just works.

## Setup

This component must run on the machine that has the RS485 adapter that's wired to the sign connected to it.  I've tested it on Raspberry Pi OS and macOS Ventura.

To set this up you'll need the following software (I'll assume you have the sign, RS-485 adapter and appropriate data and power wiring sorted!):

* A [Redis Stack](https://redis.io/docs/stack/get-started/) database.  Get a free cloud hosted database [here](https://redis.com/try-free), or use the redis-stack Docker image ([here](https://hub.docker.com/r/redis/redis-stack)) or use the Docker compose file at the root of this repository.
* Fully set up and working instances of both the notifier component ([read about this here](../../notifier/README.md)) and the other components of this system that it relies on (covered in the notifier README).

Before running the code, configure the environment by copying `env.example` to `.env`.  Edit this file to contain the Redis connection URL for your Redis instance ([Redis URL format](https://www.iana.org/assignments/uri-schemes/prov/redis)).

You'll also need to set some values relating to the size, device driver and "bus address" of your sign.  These signs are designed to operate on a common data bus as part of a set (e.g. a single bus may have a front destination display, a side destination display and a rear route number display - each a separate flip dot sign chained together with different "bus addresses"):

* `SIGN_DEVICE`: The path to the RS485 USB device.  Mine shows up as `/dev/ttyUSB0` when connected to the Raspberry Pi that I have running in the sign.
* `SIGN_ROWS`: How many rows of flip dots your sign has.  Mine has 7.
* `SIGN_COLS`: How many columns of flip dots your sign has.  Mine has 84.
* `SIGN_ADDRESS`: The bus address number for the sign.  This can be configured with a dial inside the sign.  Mine is set to 6.

If you want to set the time that each part of the message is shown on the sign, adjust the value of `SIGN_FLIP_INTERVAL` accordingly (it's in milliseconds).

If you want to change how many times each message is repeated on the sign, adjust the value of `SIGN_REPEATS`.

Finally, install the dependencies like you would for any other Node.js project:

```
npm install
```

## Running the Front End

Start the front end like this (make sure the flip dot sign has power too, and that the RS485 adapter is connected to the machine that's running the component and correctly wired to the sign):

```
npm start
```

TODO everything else... and show the output!