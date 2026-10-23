import csv
import io
import tempfile
import unittest
from pathlib import Path

from edgewatch.settings import Settings
from edgewatch.storage import TelemetryStore


def sample(probe3=23.0):
    return {**{f"probe_{i}_c": 22.0 + .1*i for i in range(1,6)},
            "probe_3_c":probe3, "ambient_c":22.6}


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cfg = Settings(db_path=str(Path(self.tmp.name)/"test.sqlite3"), warning_c=35,
                       critical_c=45, recovery_margin_c=2, stale_seconds=20)
        self.store = TelemetryStore(cfg)

    def tearDown(self): self.tmp.cleanup()

    def test_insert_and_history(self):
        self.store.ingest("NODE-A",sample(),source="simulation", now=100)
        self.assertEqual(self.store.snapshot(now=104)["total_readings"],1)
        self.assertEqual(self.store.history("NODE-A")[0]["probe_3_c"],23.0)
        self.assertEqual(self.store.snapshot(now=104)["devices"][0]["name"],"NODE-A")

    def test_critical_transition_and_recovery(self):
        self.store.ingest("NODE-A", sample(46),source="simulation",now=100)
        self.store.ingest("NODE-A", sample(48),source="simulation",now=101)
        alerts = self.store.alerts()
        self.assertEqual(len(alerts),1)
        self.assertEqual(alerts[0]["severity"],"critical")
        self.store.ingest("NODE-A", sample(44),source="simulation",now=102)
        self.assertEqual(len(self.store.alerts()),1) # Hysteresis keeps critical active.
        self.store.ingest("NODE-A", sample(22),source="simulation",now=103)
        self.assertEqual(self.store.alerts()[0]["kind"],"TEMPERATURE_RECOVERED")
        self.assertEqual(len(self.store.snapshot(now=104)["active_alarms"]),0)

    def test_warn_escalation(self):
        self.store.ingest("NODE-B",sample(36),source="simulation", now=100)
        self.store.ingest("NODE-B",sample(46),source="simulation", now=102)
        self.assertEqual([a["severity"] for a in reversed(self.store.alerts())], ["warning","critical"])

    def test_transmitter_offline_and_recovery(self):
        self.store.ingest("NODE-A", sample(),source="simulation", now=100)
        self.store.check_stale(now=125)
        self.store.check_stale(now=135)
        self.assertEqual(len(self.store.alerts()),1)
        self.assertEqual(self.store.alerts()[0]["kind"],"TRANSMITTER_OFFLINE")
        self.store.ingest("NODE-A",sample(),source="simulation",now=140)
        self.assertEqual(self.store.alerts()[0]["kind"],"TRANSMITTER_RECOVERED")

    def test_csv_export(self):
        self.store.ingest("NODE-A",sample(),source="simulation",now=100)
        content=self.store.csv_bytes().decode("utf-8-sig")
        rows=list(csv.DictReader(io.StringIO(content)))
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["device"],"NODE-A")
        self.assertEqual(rows[0]["timestamp_utc"],"1970-01-01T00:01:40Z")
        self.assertEqual(rows[0]["probe_3_c"],"23.0")

    def test_refuse_missing_or_invalid_channel(self):
        with self.assertRaises(ValueError):
            self.store.ingest("NODE-A",{"probe_1_c":23},source="simulation")
        with self.assertRaises(ValueError):
            bad=sample();bad["probe_1_c"] =float("nan")
            self.store.ingest("NODE-A",bad,source="simulation")
        self.assertEqual(self.store.snapshot()["total_readings"],0)


if __name__=="__main__": unittest.main()
