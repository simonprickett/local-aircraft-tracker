import badger2040w
import json
import secrets
import time
from picoredis import Redis

badger = badger2040w.Badger2040W()
badger.set_font("bitmap8")

def clear_screen():
    badger.set_pen(15)
    badger.clear()

def write_text(text, x, y, s, c):
    badger.set_pen(c)
    badger.text(text, x, y, scale=s)

def show_waiting_message():
    clear_screen()
    write_text("Waiting for flights!", 20, 40, 3, 0)
    badger.update()

clear_screen()
badger.update()

badger.connect()

clear_screen()
write_text("Connected to wifi!", 20, 40, 3, 0)
badger.update()

r = Redis(host=secrets.REDIS_HOST, port=secrets.REDIS_PORT)
if len(secrets.REDIS_PASSWORD) > 0:
    r.auth(secrets.REDIS_PASSWORD)

clear_screen()
write_text("Connected to Redis!", 20, 40, 3, 0)
badger.update()

show_waiting_message()

screen_updated = False

# Begin at the start of the stream...
last_read_id = "0"

while True:
    payload = r.xread("count", "1", "streams", "interestingstream", last_read_id)

    if not payload is None:
        this_flight = payload[0][1][0]
        print(this_flight[1])

        # Convert this list of key then value byte arrays into a dict with strings.
        flight_keys = this_flight[1][::2]
        flight_values = this_flight[1][1::2]
        
        flight_data = dict()

        for n in range(len(flight_keys)):
            flight_data[flight_keys[n].decode('utf-8')] = flight_values[n].decode('utf-8')
        
        print(flight_data)

        clear_screen()
        
        badger.set_pen(0)
        badger.rectangle(0, 0, 160, 130)
        write_text(flight_data["aircraft_type"], 10, 10, 7, 15)
        write_text(flight_data["registration"], 10, 70, 3, 15)
        write_text(f"{flight_data['altitude']}FT", 10, 100, 2, 15)

        write_text(f"{flight_data['operator_iata']}{flight_data['flight_number']}", 180, 10, 4, 0)
        write_text(f"{flight_data['origin_iata']}", 193, 50, 5, 0)
        write_text(f"{flight_data['destination_iata']}", 193, 90, 5, 0)

        badger.update()
        
        screen_updated = True
        time.sleep(10)

        # Update our place in the stream.
        last_read_id = str(this_flight[0].decode("utf-8"))
    else:
        # Nothing to do...
        if screen_updated == True:
            show_waiting_message()
            screen_updated = False
        
        time.sleep(1)