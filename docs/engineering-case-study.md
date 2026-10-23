# Engineering case study — Edge telemetry from sensor to interface

> Public-safe technical narrative. Describes general engineering challenges validated in a private proof of concept, while distinguishing the independent synthetic GitHub implementation. Do not claim employer endorsement.

## Problem definition

A useful temperature-monitoring system must do more than capture a numerical sensor reading. The complete path includes collecting physical measurements, transporting telemetry over a low-power wireless protocol, authenticating remote devices, decoding payloads, storing readings, presenting history, and detecting missed reporting or abnormal values.

## Bench-validation context (private work; not reproduced here)

In a separate hands-on integration exercise, a two-transmitter temperature system was assembled and validated. Each unit used five temperature measurement channels, with an additional ambient measurement available. The setup combined a wireless gateway, Raspberry Pi edge host, a LoRaWAN network server, MQTT, telemetry decoding, SQLite logging, and event-driven notification tests.

The system was verified in stages: physical sensor readings, radio activation, test uplinks, automatic measurement uplinks, decoded values, dashboard visualization, historical data, and alert behavior. Hardware identifiers, IP addresses, credentials, proprietary manuals, actual telemetry, and deployment-specific configuration have intentionally been omitted.

## Engineering challenges and decisions

| Challenge | Engineering approach | What the public demo shows |
|---|---|---|
| Validate end-to-end flow | Verify each hop before adding dashboard logic | Normalized event ingestion → persistent readings → web API |
| Interpret payloads | Separate network transport from payload decoding | ChirpStack decoded-object adapter with input validation |
| Distinguish fresh from stale data | Compare received timestamps with a configured tolerance | Connectivity state and offline/recovered transitions |
| Avoid warning floods | Introduce state transitions and a recovery margin | Persisted warning/critical/recovered events |
| Enable independent demonstration | Separate the hardware boundary from the UI | Synthetic publisher and scenario controls |
| Support post-test analysis | Record UTC time and sensor values consistently | SQLite history and UTF-8 CSV export |

## Technical responsibilities illustrated

- **Hardware/software integration:** Trace the data path from field sensor to application telemetry.
- **Embedded networking:** Understand LoRaWAN join/security and the distinction between network connectivity and application data.
- **Linux and container operations:** Manage edge applications and services without conflating host and container endpoints.
- **Data engineering:** Preserve structured readings with timestamps and enable repeatable extraction.
- **Software design:** Validate inputs, model alert transitions, and retain reproducible tests.

## Evidence available in this repository

- 15 automated tests across database logic, JSON ingestion, alarm transitions, HTTP endpoints, and CSV export.
- A reproducible dashboard that runs without physical sensors.
- Synthetic test conditions that demonstrate high-temperature and missing-data events.
- A documented optional interface to ChirpStack's JSON MQTT integration.

## Limitations and scope

The public repository is not a copy of the private integration and does not demonstrate that any employer infrastructure is production-ready. The synthetic system is **not** an industrial safety controller and should never be used to make emergency operational decisions. Its warning and critical limits are illustrative test inputs, not safety limits.

## How I would explain this in an interview

> I validated a small end-to-end wireless temperature monitoring proof of concept, then independently built a public, simulated version to show the software architecture. The public demo includes an ingest boundary, SQLite telemetry storage, a configurable state-based alert engine, CSV extraction, and an interactive dashboard. I can walk through how I debugged data transport versus application-layer decoding, and explain why outage detection, logging, and operational ownership need separate design considerations.
