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
    write_text("Waiting for a flight!")
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

while True:
    payload = r.rpop("badger2040w:flights")
        
    if not payload is None:
        msg = json.loads(payload)
        print(payload)
        
        clear_screen()
        write_text(f"{msg['origin_iata']} - {msg['destination_iata']}, {msg['registration']}")
        badger.update()
        
        screen_updated = True
        time.sleep(5)
    else:
        # Nothing to do...
        if screen_updated == True:
            show_waiting_message()
            screen_updated = False
        
        time.sleep(1)