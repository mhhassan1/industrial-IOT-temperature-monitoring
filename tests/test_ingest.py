import json
import tempfile
import unittest
from pathlib import Path
from edgewatch.ingest import ingest_chirpstack, normalize_chirpstack_uplink
from edgewatch.settings import Settings
from edgewatch.storage import TelemetryStore

BASE={"deviceInfo":{"deviceName":"LAB-NODE"},"fPort":16,"object":{**{f"probe_{n}_c":21.0+n/10 for n in range(1,6)}, "ambient_c":22.0},"rxInfo":[{"rssi":-70,"snr":7},{"rssi":-52,"snr":11}]}

class ChirpStackTests(unittest.TestCase):
    def test_valid_payload(self):
        r=normalize_chirpstack_uplink(json.dumps(BASE))
        self.assertEqual(r["device"], "LAB-NODE")
        self.assertEqual(r["readings"]["probe_5_c"], 21.5)
        self.assertEqual(r["rssi"], -52)

    def test_skip_non_temperature_port(self):
        self.assertIsNone(normalize_chirpstack_uplink({**BASE,"fPort":42}))

    def test_skip_unparsed_payload(self):
        self.assertIsNone(normalize_chirpstack_uplink({"deviceInfo":{"deviceName":"X"},"fPort":16,"data":"AA=="}))

    def test_ingest_into_db(self):
        with tempfile.TemporaryDirectory() as tmp:
            db=TelemetryStore(Settings(db_path=str(Path(tmp)/"test.db")))
            self.assertTrue(ingest_chirpstack(db, BASE))
            self.assertEqual(db.snapshot()["devices"][0]["source"],"chirpstack-mqtt")

if __name__=="__main__": unittest.main()
