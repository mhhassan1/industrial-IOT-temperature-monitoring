import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen, Request
from edgewatch.server import handler_factory
from edgewatch.settings import Settings
from edgewatch.storage import TelemetryStore
from edgewatch.simulator import Simulator

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=TelemetryStore(Settings(db_path=str(Path(self.tmp.name)/"test.db")))
        self.sim=Simulator(self.db)
        self.sim.generate_once()
        self.http=ThreadingHTTPServer(('127.0.0.1',0),handler_factory(self.db,self.sim,demo=True))
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True)
        self.thread.start()
        self.url=f"http://127.0.0.1:{self.http.server_address[1]}"
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join(2);self.tmp.cleanup()
    def test_dashboard(self):
        with urlopen(self.url+'/') as r: self.assertIn(b'EDGEWATCH',r.read())
    def test_json(self):
        with urlopen(self.url+'/api/snapshot') as r: payload=json.load(r)
        self.assertEqual(len(payload['devices']),2)
    def test_simulate_heat(self):
        with urlopen(Request(self.url+'/api/demo/heat?device=NODE-A',data=b'',method='POST')) as r:
            self.assertTrue(json.load(r)['ok'])
        self.sim.generate_once()
        self.assertEqual(self.db.alerts()[0]['severity'],'critical')
    def test_csv(self):
        with urlopen(self.url+'/api/export.csv') as r: self.assertIn(b'NODE-A',r.read())
    def test_bad_endpoint(self):
        with self.assertRaises(HTTPError) as ctx: urlopen(self.url+'/missing')
        self.assertEqual(ctx.exception.code,404)
if __name__=="__main__": unittest.main()
