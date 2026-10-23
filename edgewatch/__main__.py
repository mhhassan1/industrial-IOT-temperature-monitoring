"""CLI entrypoint: python -m edgewatch --mode demo"""
from __future__ import annotations
import argparse
import logging
import os
import threading
from .settings import Settings
from .storage import TelemetryStore
from .simulator import Simulator
from .server import serve


def main(argv=None):
    p = argparse.ArgumentParser(description="EdgeWatch IoT temperature monitoring demo")
    p.add_argument("--mode", choices=("demo","mqtt"), default=os.getenv("EDGEWATCH_MODE","demo"))
    p.add_argument("--host", default=os.getenv("EDGEWATCH_HOST","127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.getenv("EDGEWATCH_PORT","8765")))
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    store = TelemetryStore(Settings())
    sim = None
    stop = threading.Event()
    if args.mode == "demo":
        sim = Simulator(store)
        thread = threading.Thread(target=sim.run, name="synthetic-telemetry", daemon=True)
        thread.start()
    else:
        from .mqtt_bridge import run_mqtt
        thread = threading.Thread(target=run_mqtt, args=(store,stop), name="mqtt-reader",daemon=True)
        thread.start()
    try:
        serve(store, sim, args.host, args.port, demo=args.mode=="demo")
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        if sim: sim.stop.set()
        thread.join(timeout=2)

if __name__ == "__main__": main()
