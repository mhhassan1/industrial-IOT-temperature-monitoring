# EdgeWatch · Browser-only interactive demo

**A static, hardware-free simulation of an industrial temperature monitoring interface.**

This is intentionally separate from the Python/SQLite project in the repository. It has no backend, no sensors, no mailbox access, no MQTT connection, no telemetry ingestion, and no production alarm delivery. All identifiers, time series, signal quality metrics, and incident reports are generated locally in the visitor's browser.

## Explore

- Live synthetic telemetry from NODE-A and NODE-B (five probes and one ambient reading per node)
- Alarm states with configurable warning/critical thresholds and 2°C recovery hysteresis
- Interactive heat excursion and missing-node scenarios, and manual restoration
- Historical telemetry graph with selectable device and time range
- CSV download of current synthetic history
- Desktop/mobile layout, keyboard focus states, accessible labels

## Run locally

Serve the `demo` directory with any static web server (ES module imports require HTTP(S) rather than `file://`):

```bash
cd demo
python -m http.server 8000
```

Visit http://127.0.0.1:8000.

## Test

Node.js 20+:

```bash
node --test demo/tests/engine.test.mjs
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). A GitHub Pages action is included but only runs manually after Pages is enabled; it will **not** change repository visibility or publish without user action.

## Security / scope

No real device, employer information, hardcoded credentials, private IPs, or production telemetry are in this demonstration. It is not engineered or certified for physical protection or safety monitoring. Do not mistake the five-second simulated measurement interval for the cadence of physical radio hardware.
