"""Synthetic telemetry producer; no physical device IDs or proprietary measurements."""
from __future__ import annotations
import math
import random
import threading
import time
from .storage import DEVICES, TelemetryStore


class Simulator:
    def __init__(self, store: TelemetryStore, interval_seconds=4.0):
        self.store = store
        self.interval = interval_seconds
        self.start_time = time.monotonic()
        self.random = random.Random(2026)
        self.heat_until: dict[str,float] = {}
        self.offline_until: dict[str,float] = {}
        self.lock = threading.RLock()
        self.stop = threading.Event()

    def heat(self, device="NODE-A"):
        if device not in DEVICES: raise ValueError("Unknown simulation device")
        with self.lock: self.heat_until[device] = time.monotonic() + 35

    def disconnect(self, device="NODE-B"):
        if device not in DEVICES: raise ValueError("Unknown simulation device")
        with self.lock: self.offline_until[device] = time.monotonic() + 27

    def generate_once(self):
        elapsed = time.monotonic()-self.start_time
        for idx, device in enumerate(DEVICES):
            with self.lock:
                unavailable = time.monotonic() < self.offline_until.get(device,0)
                heated = time.monotonic() < self.heat_until.get(device,0)
            if unavailable: continue
            base = 22.4 + idx*0.7 + 0.58*math.sin(elapsed/38 + idx)
            values = {f"probe_{n}_c":round(base + (n-3)*0.21 + self.random.uniform(-.10,.10), 2)
                      for n in range(1,6)}
            values["ambient_c"] = round(base+0.18+self.random.uniform(-.08,.08),2)
            if heated: values["probe_3_c"] = round(47.8 + .6*math.sin(elapsed/3),2)
            self.store.ingest(device, values, source="simulation", rssi=-58+idx*5, snr=10.8-idx*1.2)
        self.store.check_stale()

    def run(self):
        self.generate_once()
        while not self.stop.wait(self.interval):
            self.generate_once()
