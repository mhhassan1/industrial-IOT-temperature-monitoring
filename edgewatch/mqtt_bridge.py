"""Optional MQTT integration for a separately managed, authorized ChirpStack deployment."""
from __future__ import annotations
import logging
import os
import time
from .ingest import ingest_chirpstack
from .storage import TelemetryStore

log = logging.getLogger(__name__)


def run_mqtt(store: TelemetryStore, stop_event):
    try:
        import paho.mqtt.client as mqtt
    except ImportError as exc:
        raise RuntimeError('MQTT mode requires: pip install -e ".[mqtt]"') from exc
    host = os.getenv("MQTT_HOST", "127.0.0.1")
    port = int(os.getenv("MQTT_PORT", "1883"))
    topic = os.getenv("MQTT_TOPIC", "application/+/device/+/event/up")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    username = os.getenv("MQTT_USERNAME")
    if username:
        client.username_pw_set(username, os.getenv("MQTT_PASSWORD", ""))
    if os.getenv("MQTT_TLS", "false").lower() == "true":
        client.tls_set(ca_certs=os.getenv("MQTT_CA_CERT") or None)

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            log.error("MQTT connection refused: %s", reason_code)
        else:
            log.info("MQTT connected; subscribing to %s", topic)
            client.subscribe(topic, qos=0)

    def on_message(client, userdata, msg):
        try:
            ingest_chirpstack(store, msg.payload)
        except (ValueError, KeyError, TypeError) as e:
            log.warning("Skipped invalid decoded uplink: %s", e)

    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(host, port, 60)
        client.loop_start()
        while not stop_event.wait(3):
            store.check_stale()
    finally:
        client.loop_stop()
        client.disconnect()
