# Local Aircraft Tracker with Redis

This repository contains the code used for the Plane Spotting with Redis shows that are part of my [Things on Thursdays live streaming series](https://simonprickett.dev/things-on-thursdays-livestreams/).

## Watch the Videos

The videos for this project can be found on YouTube:

* Episode 1: [Project introduction, live coding the radio receiver component](https://www.youtube.com/watch?v=TCTej1uihG4).
* Episode 2: [Enriching the flight data with the FlightAware API](https://www.youtube.com/watch?v=Qu-_wvSJrdE)
* Episode 3 (Friday 24th Feb): [YouTube](https://www.youtube.com/watch?v=IEx2WgWdhIA)
* Further episodes coming soon, watch the [Redis Developer Relations Streaming Schedule](https://developer.redis.com/redis-live/) for details!

## Project Overview

TODO

## Running it Yourself

TODO

## Example Search Queries from redis-cli

TODO describe these properly...

Which Easyjet (U2) Airbus 319 aircraft have we seen, and where were they going to/from?:

```
ft.search idx:flights "@operator_iata:{U2} @aircraft_type:{A319}" return 3 origin_name destination_name registration limit 0 2
```

Example response:

```
1) "9"
2) "flight:400E59"
3) 1) "origin_name"
   2) "Charles de Gaulle/Roissy"
   3) "destination_name"
   4) "Glasgow Int'l"
   5) "registration"
   6) "G-EZAW"
4) "flight:4010EB"
5) 1) "origin_name"
   2) "London Luton"
   3) "destination_name"
   4) "Inverness"
   5) "registration"
   6) "G-EZBW"
```

Whose Airbus A350-1000 or Boeing 787-9 aircraft have we seen?

```
ft.search idx:flights "@aircraft_type:{A35K|B789}" return 3 operator_iata registration aircraft_type
```

Example response:

```
1) "6"
2) "flight:A31A54"
3) 1) "operator_iata"
   2) "UA"
   3) "registration"
   4) "N29975"
   5) "aircraft_type"
   6) "B789"
4) "flight:C07B42"
5) 1) "operator_iata"
   2) "WS"
   3) "registration"
   4) "C-GURP"
   5) "aircraft_type"
   6) "B789"
6) "flight:407AF3"
7) 1) "operator_iata"
   2) "BA"
   3) "registration"
   4) "G-XWBI"
   5) "aircraft_type"
   6) "A35K"
8) "flight:407AF4"
9) 1) "operator_iata"
   2) "BA"
   3) "registration"
   4) "G-XWBK"
   5) "aircraft_type"
   6) "A35K"
10) "flight:40771A"
11) 1) "operator_iata"
   2) "VS"
   3) "registration"
   4) "G-VDOT"
   5) "aircraft_type"
   6) "A35K"
12) "flight:4077D3"
13) 1) "operator_iata"
   2) "VS"
   3) "registration"
   4) "G-VTEA"
   5) "aircraft_type"
   6) "A35K"
```

Which aircraft have passed within 10 miles of central Nottingham?  Return them sorted by descending altitude.

```
ft.search idx:flights "*" geofilter position -1.148369 52.953150 10 mi return 6 operator_iata flight_number aircraft_type registration altitude destination_iata sortby altitude desc
```

Example response:

```
1) "5"
2) "flight:C02CF1"
3) 1) "altitude"
   2) "31850"
   3) "operator_iata"
   4) "AC"
   5) "flight_number"
   6) "861"
   7) "aircraft_type"
   8) "B77W"
   9) "registration"
   10) "C-FRAM"
   11) "destination_iata"
   12) "YVR"
4) "flight:A9CB18"
5) 1) "altitude"
   2) "31525"
   3) "operator_iata"
   4) "AA"
   5) "flight_number"
   6) "135"
   7) "aircraft_type"
   8) "B77W"
   9) "registration"
   10) "N730AN"
   11) "destination_iata"
   12) "LAX"
6) "flight:405BFD"
7) 1) "altitude"
   2) "27600"
   3) "operator_iata"
   4) "BA"
   5) "flight_number"
   6) "85"
   7) "aircraft_type"
   8) "B772"
   9) "registration"
   10) "G-YMMT"
   11) "destination_iata"
   12) "YVR"
8) "flight:401E80"
9) 1) "altitude"
   2) "2100"
10) "flight:406F33"
11) 1) "altitude"
   2) "1775"
```

Which aircraft are flying at 32,000ft or higher?

```
ft.search idx:flights "@altitude:[32000 +inf]" sortby operator_iata asc return 4 operator_iata destination_name aircraft_type altitude limit 0 3
```

Example response:

```
1) "29"
2) "flight:A80A8F"
3) 1) "operator_iata"
   2) "5X"
   3) "destination_name"
   4) "Cologne Bonn"
   5) "aircraft_type"
   6) "B748"
   7) "altitude"
   8) "37000"
4) "flight:405A48"
5) 1) "operator_iata"
   2) "BA"
   3) "destination_name"
   4) "George Best Belfast City"
   5) "aircraft_type"
   6) "A320"
   7) "altitude"
   8) "33225"
6) "flight:407464"
7) 1) "operator_iata"
   2) "BA"
   3) "destination_name"
   4) "Inverness"
   5) "aircraft_type"
   6) "A20N"
   7) "altitude"
   8) "36750"
```

What different types of aircraft are out there?

```
ft.aggregate idx:flights "*" groupby 1 @aircraft_type reduce count 0 as num sortby 2 @num desc limit 0 9999
```

Example response:

```
1) "19"
2) 1) "aircraft_type"
   2) "null"
   3) "num"
   4) "39"
3) 1) "aircraft_type"
   2) "A320"
   3) "num"
   4) "16"
4) 1) "aircraft_type"
   2) "A319"
   3) "num"
   4) "10"
5) 1) "aircraft_type"
   2) "B738"
   3) "num"
   4) "7"
6) 1) "aircraft_type"
   2) "A20N"
   3) "num"
   4) "5"
7) 1) "aircraft_type"
   2) "A35K"
   3) "num"
   4) "4"
8) 1) "aircraft_type"
   2) "E190"
   3) "num"
   4) "3"
9) 1) "aircraft_type"
   2) "B77W"
   3) "num"
   4) "3"
10) 1) "aircraft_type"
   2) "B788"
   3) "num"
   4) "3"
11) 1) "aircraft_type"
   2) "E145"
   3) "num"
   4) "2"
12) 1) "aircraft_type"
   2) "B789"
   3) "num"
   4) "2"
13) 1) "aircraft_type"
   2) "A333"
   3) "num"
   4) "1"
14) 1) "aircraft_type"
   2) "A21N"
   3) "num"
   4) "1"
15) 1) "aircraft_type"
   2) "B772"
   3) "num"
   4) "1"
16) 1) "aircraft_type"
   2) "A321"
   3) "num"
   4) "1"
17) 1) "aircraft_type"
   2) "BCS3"
   3) "num"
   4) "1"
18) 1) "aircraft_type"
   2) "B77L"
   3) "num"
   4) "1"
19) 1) "aircraft_type"
   2) "B748"
   3) "num"
   4) "1"
20) 1) "aircraft_type"
   2) "AT72"
   3) "num"
   4) "1"
```
