# Pimoroni Badger 2040W E-Ink Screen Front End Component

![Badger 2040W showing flight data](../../badger2040w_with_plane_info.jpg)

This is a front end for the local aircraft tracking project that uses the [Badger 2040W](https://shop.pimoroni.com/products/badger-2040-w) from [Pimoroni](https://shop.pimoroni.com/).  This is an all in one device that has a [Raspberry Pi Pico W](https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html) built into it, along with an e-ink display, some buttons and a programmable LED.  Right now this project doesn't use the buttons or the LED, but I might extend it to do so in future.

The code for this component is written in [MicroPython](https://micropython.org/).  I used Pimoroni's build of MicroPython ([.uf2 files here](https://github.com/pimoroni/pimoroni-pico/blob/main/setting-up-micropython.md)) as it gives me access to their excellent [software libraries](https://github.com/pimoroni/badger2040) for working with the Badger and its screen.

**Full disclosure -** I didn't buy the Badger 2040W with my own money, it was given to me by Pimoroni to do some projects with.  However, I definitely recommend it, it's a great value all in one piece of kit!

## Setup

TODO

## How it Works

TODO

## Installing the Code on the Badger 2040W

TODO

## Running the Front End

The Raspberry Pi Pico W is a microcontroller - there's no operating system, so basically your code is the only thing running on it. Once you've installed the code on the Badger 2040W, all you need to do is connect power to it using a USB->Micro USB cable.  It'll then boot up, connect to the wifi first then Redis second, then poll the Redis Stream.  Once a new flight appears in the stream, the display will update with the flight details.

Example boot up sequence:

![eink demo](../../badger2040w.gif)