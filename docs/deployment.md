# Developer installation and operations

## Prerequisites

- Python 3.11+ (stdlib only for synthetic demo), or Docker with Compose.
- Browser on the same workstation.
- Optionally a separately managed **authorized** ChirpStack MQTT feed and `paho-mqtt` 2.x.

## Run locally

From the repository root, launch `python -m edgewatch --mode demo`. Open http://127.0.0.1:8765. The simulator emits samples every four seconds. Stop with Ctrl+C. The database is created in `data/`.

For deterministic clean test runs, delete `data/edgewatch.sqlite3` **only when demo is stopped**; that deletes your local demonstration history. Never do this with real data.

Set environment variables in your shell to adjust sample thresholds and stale detection:

| Name | Default | Description |
|---|---|---|
| `EDGEWATCH_MODE` | `demo` | `demo` or optional `mqtt` |
| `EDGEWATCH_DB` | `./data/edgewatch.sqlite3` | SQLite path |
| `EDGEWATCH_HOST` | `127.0.0.1` | Local bind address |
| `EDGEWATCH_PORT` | `8765` | HTTP server port |
| `WARNING_C` | `35` | Illustrative test threshold |
| `CRITICAL_C` | `45` | Illustrative test threshold |
| `RECOVERY_MARGIN_C` | `2` | Hysteresis margin |
| `STALE_SECONDS` | `18` | Synthetic demo missing-data timeout |
| `MQTT_HOST` | `127.0.0.1` | Authorized broker, MQTT mode only |
| `MQTT_PORT` | `1883` | Broker listener, MQTT mode only |
| `MQTT_TOPIC` | `application/+/device/+/event/up` | ChirpStack application topic |
| `MQTT_TLS` | `false` | Use TLS for approved deployment |

Do not interpret threshold values or demo device reporting cadence as characteristics of an actual transmitter.

## Docker Compose

`docker compose up --build -d`, then visit localhost port 8765. `docker compose logs -f dashboard` tails logs, and `docker compose down` stops the stack. Data persists in a named Docker volume. `docker compose down -v` **deletes** the demo volume and data.

## MQTT mode is a developer adapter, not a deployment recipe

The sample MQTT consumer uses Paho MQTT v2, reconnects subscriptions after connecting, and reads ChirpStack's JSON `up` events. To use it, provide a broker you are authorized to access and a working device decoder that supplies all six `object` fields. Do not bind this demo's HTTP endpoint publicly. Do not deploy on employer networks without change approval.

## Troubleshooting

| Observation | Check |
|---|---|
| Dashboard empty | Start simulator; look at `/healthz` and `/api/snapshot` |
| Temperature not changing | Simulator should publish every four seconds; refresh browser |
| No offline alarm yet | Demo loss lasts about 27 sec; default alarm triggers after 18 sec |
| Alarm remains after change | Configured hysteresis can keep prior state until below recovery margin |
| MQTT messages ignored | Check `fPort=16`, `object` fields, JSON format, broker topic |
| CSV has many records | Reads persist across restarts; use a fresh demo data path |
| Docker image cannot serve | Check container logs and host port availability |

## Release safety

Before any public upload, review [publication checklist](publication-checklist.md). All public examples in the project intentionally use synthetic names and measurements.
