# Testing strategy

Run `python -m unittest discover -s tests -v` from the repository root.

**Current automated coverage (15 tests):**

- Validate and normalize a ChirpStack-like JSON uplink.
- Reject undecoded or non-temperature payloads.
- Insert and retrieve timestamped readings.
- Preserve state across duplicate hot readings (no alert flood).
- Escalate warning to critical.
- Apply recovery hysteresis and emit a recovery event.
- Trigger one missing-data alert and subsequent connectivity recovery.
- Reject missing, nonfinite, and invalid temperature values.
- Export CSV with UTC timestamps.
- Serve HTML, JSON, and CSV endpoints.
- Trigger a synthetic heat scenario and reject unknown routes.

## Manual browser check

1. Start in demo mode.
2. Verify both synthetic nodes appear with five probes and ambient measurements.
3. Trigger **Heat excursion** and verify `HIGH TEMPERATURE` for NODE-A Probe 3.
4. Let the scenario expire and verify a recovery event.
5. Trigger **Node connection loss** for NODE-B and verify stale alarm then recovery.
6. Download CSV and verify no real device identifiers or data.
7. Restart and verify SQLite history persists.

The tests demonstrate deterministic program behavior in a local environment. They do not establish radio-system reliability, sensor accuracy, notification delivery, or safety performance.
