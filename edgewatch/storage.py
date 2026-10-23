"""SQLite telemetry store and persistent, hysteretic alert state machine."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import csv
import io
import json
import math
from pathlib import Path
import sqlite3
import time

from .settings import Settings

DEVICES = ("NODE-A", "NODE-B")  # Synthetic-only demo identifiers.
CHANNELS = tuple(f"probe_{n}_c" for n in range(1, 6))
ALL_CHANNELS = (*CHANNELS, "ambient_c")


def _utc(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class TelemetryStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        path = Path(settings.db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        with self.connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    received_at REAL NOT NULL,
                    device TEXT NOT NULL,
                    probe_1_c REAL NOT NULL, probe_2_c REAL NOT NULL,
                    probe_3_c REAL NOT NULL, probe_4_c REAL NOT NULL,
                    probe_5_c REAL NOT NULL, ambient_c REAL NOT NULL,
                    source TEXT NOT NULL, rssi REAL, snr REAL
                );
                CREATE INDEX IF NOT EXISTS idx_readings_device_time
                    ON readings(device, received_at DESC);
                CREATE TABLE IF NOT EXISTS alarm_state (
                    device TEXT NOT NULL, channel TEXT NOT NULL,
                    kind TEXT NOT NULL, state TEXT NOT NULL,
                    PRIMARY KEY(device,channel,kind)
                );
                CREATE TABLE IF NOT EXISTS alert_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    occurred_at REAL NOT NULL,
                    device TEXT NOT NULL, channel TEXT NOT NULL,
                    kind TEXT NOT NULL, severity TEXT NOT NULL,
                    detail TEXT NOT NULL, reading_c REAL
                );
            """)

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _state(conn, device, channel, kind):
        row = conn.execute("SELECT state FROM alarm_state WHERE device=? AND channel=? AND kind=?",
                           (device, channel, kind)).fetchone()
        return row[0] if row else "normal"

    @staticmethod
    def _set_state(conn, device, channel, kind, new_state):
        conn.execute("""INSERT INTO alarm_state(device,channel,kind,state) VALUES(?,?,?,?)
            ON CONFLICT(device,channel,kind) DO UPDATE SET state=excluded.state""",
                     (device, channel, kind, new_state))

    @staticmethod
    def _event(conn, when, device, channel, kind, severity, detail, value=None):
        conn.execute("""INSERT INTO alert_events(occurred_at,device,channel,kind,severity,detail,reading_c)
                        VALUES (?,?,?,?,?,?,?)""",
                     (when, device, channel, kind, severity, detail, value))

    def ingest(self, device: str, readings: dict, *, source: str, rssi=None, snr=None, now=None):
        if not (device and isinstance(device, str) and len(device) <= 64):
            raise ValueError("Device must be a nonempty identifier up to 64 characters")
        if source not in ("simulation", "chirpstack-mqtt"):
            raise ValueError("Unsupported source")
        values = {}
        for channel in ALL_CHANNELS:
            val = readings.get(channel)
            if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val):
                raise ValueError(f"Invalid numeric reading for {channel}")
            if not -80 <= val <= 150:
                raise ValueError(f"Reading out of demonstration range: {channel}")
            values[channel] = round(float(val), 2)
        timestamp = time.time() if now is None else float(now)
        with self.connect() as conn:
            conn.execute("""INSERT INTO readings(received_at,device,probe_1_c,probe_2_c,probe_3_c,probe_4_c,
                probe_5_c,ambient_c,source,rssi,snr) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (timestamp, device, *(values[c] for c in ALL_CHANNELS), source, rssi, snr))
            if self._state(conn, device, "device", "connectivity") == "offline":
                self._event(conn, timestamp, device, "device", "TRANSMITTER_RECOVERED", "info",
                            "Telemetry resumed after a missed-reading alarm")
                self._set_state(conn, device, "device", "connectivity", "normal")
            for ch in CHANNELS:
                self._evaluate_temperature(conn, device, ch, values[ch], timestamp)

    def _evaluate_temperature(self, conn, device, channel, value, when):
        prior = self._state(conn, device, channel, "temperature")
        s = self.settings
        if value >= s.critical_c:
            level = "critical"
        elif value >= s.warning_c:
            level = "warning"
        else:
            level = "normal"
        # Keep an existing alarm active until the reading falls below its recovery band.
        if prior == "critical" and value >= s.critical_c - s.recovery_margin_c:
            level = "critical"
        elif prior == "warning" and value >= s.warning_c - s.recovery_margin_c and level == "normal":
            level = "warning"
        if prior == level:
            return
        if level == "normal":
            kind, severity = "TEMPERATURE_RECOVERED", "info"
            detail = f"{channel} returned below its recovery threshold"
        else:
            kind, severity = "HIGH_TEMPERATURE", level
            limit = s.critical_c if level == "critical" else s.warning_c
            detail = f"{channel} at {value:.1f}°C; {level} threshold {limit:.1f}°C"
        self._event(conn, when, device, channel, kind, severity, detail, value)
        self._set_state(conn, device, channel, "temperature", level)

    def check_stale(self, now=None):
        when = time.time() if now is None else float(now)
        with self.connect() as conn:
            device_rows = conn.execute("SELECT device,MAX(received_at) as last_seen FROM readings GROUP BY device").fetchall()
            for row in device_rows:
                device = row["device"]
                if when-row["last_seen"] > self.settings.stale_seconds:
                    if self._state(conn, device, "device", "connectivity") != "offline":
                        self._event(conn, when, device, "device", "TRANSMITTER_OFFLINE", "critical",
                                    f"No telemetry for over {self.settings.stale_seconds}s")
                        self._set_state(conn, device, "device", "connectivity", "offline")

    def snapshot(self, now=None):
        when = time.time() if now is None else float(now)
        with self.connect() as conn:
            device_rows = conn.execute("""SELECT r.* FROM readings r INNER JOIN
                (SELECT device, MAX(id) id FROM readings GROUP BY device) latest ON latest.id=r.id
                ORDER BY r.device""").fetchall()
            active_rows = conn.execute("SELECT device,channel,kind,state FROM alarm_state WHERE state!='normal'").fetchall()
            total = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
            active = [dict(r) for r in active_rows]
            devices = []
            for r in device_rows:
                age = max(0, when-r["received_at"])
                offline = age > self.settings.stale_seconds
                devices.append({"name": r["device"], "last_seen": _utc(r["received_at"]),
                    "age_seconds": round(age, 1), "online": not offline,
                    "values": {ch: r[ch] for ch in ALL_CHANNELS},
                    "rssi": r["rssi"], "snr": r["snr"], "source": r["source"]})
            return {"timestamp": _utc(when), "devices": devices, "total_readings": total,
                    "active_alarms": active, "warning_c": self.settings.warning_c,
                    "critical_c": self.settings.critical_c, "stale_seconds": self.settings.stale_seconds,
                    "synthetic_demo": all(d["source"] == "simulation" for d in devices)}

    def history(self, device, limit=80):
        limit = max(1, min(int(limit), 500))
        with self.connect() as conn:
            rows = conn.execute("""SELECT received_at,probe_1_c,probe_2_c,probe_3_c,probe_4_c,probe_5_c,ambient_c
                                  FROM readings WHERE device=? ORDER BY id DESC LIMIT ?""", (device, limit)).fetchall()
        return [{"time": _utc(r["received_at"]), **{ch: r[ch] for ch in ALL_CHANNELS}} for r in reversed(rows)]

    def alerts(self, limit=35):
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM alert_events ORDER BY id DESC LIMIT ?", (max(1,min(limit,100)),)).fetchall()
        return [{"id":r["id"], "time":_utc(r["occurred_at"]), "device":r["device"],
                 "channel":r["channel"], "kind":r["kind"], "severity":r["severity"],
                 "detail":r["detail"], "reading_c":r["reading_c"]} for r in rows]

    def csv_bytes(self):
        out = io.StringIO()
        writer = csv.writer(out)
        cols = ["timestamp_utc", "device", *ALL_CHANNELS, "source", "rssi", "snr"]
        writer.writerow(cols)
        with self.connect() as conn:
            cursor = conn.execute("SELECT * FROM readings ORDER BY id")
            for row in cursor:
                writer.writerow([_utc(row["received_at"]), row["device"],
                                *(row[ch] for ch in ALL_CHANNELS), row["source"], row["rssi"], row["snr"]])
        return out.getvalue().encode("utf-8-sig")  # Excel-compatible UTF-8 CSV
