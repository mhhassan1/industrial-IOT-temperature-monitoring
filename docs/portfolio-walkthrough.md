# EdgeWatch — Portfolio walkthrough

**Live demo:** https://mhhassan1.github.io/industrial-IOT-temperature-monitoring/

## Two-minute evaluator tour

1. Open the live demo. Explain that all readings, sensor identifiers, radio metrics, and events are **synthetic** and generated locally inside the browser.
2. In **Connected sensor nodes**, inspect NODE-A and NODE-B: each has five simulated probes and an ambient channel. Observe the update and signal indicators.
3. In **Scenario lab**, select **Simulate heat excursion**. NODE-A's Probe 3 transitions through temperature severity thresholds, and the event log records the changes.
4. Select **Simulate signal loss**. NODE-B stops generating simulated uplinks and transitions to an offline state after the configured missing-data timeout.
5. Select **Restore normal operation**, switch graph node and history range, modify warning/critical thresholds, and **Export CSV** to inspect fabricated readings.

## Architecture: two complementary demonstrations

The GitHub Pages website is a **static JavaScript simulation**. It requires no backend, messaging broker, real sensors, or customer infrastructure. The separate Python application in this repository demonstrates a local HTTP API, SQLite persistence, synthetic generator, and an optional ChirpStack v4 MQTT uplink adapter (for *authorized* endpoints). GitHub Pages does not run that Python code.

## Design decisions worth discussing in interviews

- **Alarm hysteresis:** A small reset margin helps prevent repetitive warning/critical state changes when readings hover around a threshold.
- **Missed telemetry:** An offline condition means data stopped arriving. It does *not* prove that the sensor itself failed; connectivity, gateway, or ingestion may be responsible.
- **Separating ingest and presentation:** The local Python design normalizes incoming data before storage and visualization, making a synthetic provider and optional MQTT provider easier to compare.
- **Testing:** The Python suite covers ingestion, persistence, and HTTP behavior. The browser simulation suite checks state transitions, heat escalation, missed uplinks, recovery, CSV, and threshold validation.
- **Safe publication:** The public project contains synthetic readings and fabricated node names. It is not a copy of a workplace installation.

## Limits and future work

The GitHub Pages demo keeps its state in the browser tab, so refreshing resets its simulated history. It is not a production remote-monitoring service. It does not deliver email alerts, persist telemetry server-side, authenticate users, verify hardware accuracy, or provide safety-rated protection. No claim is made about deployment reliability on corporate or industrial networks.

Possible extensions: end-to-end MQTT integration tests using an isolated broker, alert acknowledgments and audit trail, operator authentication, structured metrics, and cloud deployment with a documented threat model.

## Portfolio copy

**Short description:** EdgeWatch is an interactive industrial IoT telemetry demo featuring a browser-based two-node sensor simulation, alarm state transitions, missing-uplink detection, historical trends and CSV export, alongside a separately runnable Python/SQLite monitoring backend and optional MQTT ingestion adapter.

**Interview introduction:** “I developed EdgeWatch to demonstrate how an industrial telemetry pipeline handles incoming measurements, sensor connectivity, threshold events and historical analysis. I separated a public, hardware-free simulation from a deeper backend implementation so reviewers could explore the interactions without needing physical equipment. The project also includes automated tests and documents trade-offs and safety limitations.”

Use accurate language when describing contributions and AI assistance, and do not imply that the public simulation itself is deployed on production hardware.
