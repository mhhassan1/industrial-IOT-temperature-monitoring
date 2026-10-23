"""Map documented ChirpStack v4 JSON uplinks into vendor-neutral readings."""
from __future__ import annotations
import json
from .storage import ALL_CHANNELS, TelemetryStore


def normalize_chirpstack_uplink(payload: str | bytes | dict) -> dict | None:
    if isinstance(payload, (str, bytes)):
        payload = json.loads(payload)
    if not isinstance(payload, dict) or payload.get("fPort") != 16:
        return None
    info = payload.get("deviceInfo") or {}
    obj = payload.get("object")
    if not isinstance(obj, dict) or not isinstance(info, dict):
        return None  # Requires ChirpStack-side decoding of the vendor payload.
    device = info.get("deviceName")
    if not device or len(str(device)) > 64:
        return None
    if not all(c in obj for c in ALL_CHANNELS):
        return None
    rx = payload.get("rxInfo") or []
    strongest = max(rx, key=lambda r: r.get("rssi", -999)) if isinstance(rx,list) and rx else {}
    return {"device": str(device), "readings": {c:obj[c] for c in ALL_CHANNELS},
            "rssi": strongest.get("rssi"), "snr": strongest.get("snr")}


def ingest_chirpstack(store: TelemetryStore, payload: str | bytes | dict) -> bool:
    sample = normalize_chirpstack_uplink(payload)
    if sample is None:
        return False
    store.ingest(sample["device"], sample["readings"], source="chirpstack-mqtt",
                 rssi=sample["rssi"], snr=sample["snr"])
    return True
