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

def write_text(text):
    badger.set_pen(0)
    badger.text(text, 20, 20, scale=3)

def show_waiting_message():
    clear_screen()
    write_text("Waiting for flights!")
    badger.update()

clear_screen()
badger.update()

badger.connect()

# TODO deal with when it doesn't work...
clear_screen()
write_text("Connected to wifi!")
badger.update()

r = Redis(host=secrets.REDIS_HOST, port=secrets.REDIS_PORT)
r.auth(secrets.REDIS_PASSWORD)

clear_screen()
write_text("Connected to Redis!")
badger.update()

show_waiting_message()

screen_updated = False

# Begin at the start of the stream...
last_read_id = "0"

while True:
    payload = r.xread("count", "1", "streams", "interestingstream", last_read_id)
    print("Payload received:")
    print(payload)
    if not payload is None:
        this_flight = payload[0][1][0]
        print(this_flight)
        
        clear_screen()
        write_text("got data")
        #write_text(f"{msg['origin_iata']} - {msg['destination_iata']}, {msg['registration']}")
        badger.update()
        
        screen_updated = True
        time.sleep(5)

        # Update our place in the stream.
        last_read_id = str(this_flight[0].decode("utf-8"))
    else:
        # Nothing to do...
        if screen_updated == True:
            show_waiting_message()
            screen_updated = False
        
        time.sleep(1)