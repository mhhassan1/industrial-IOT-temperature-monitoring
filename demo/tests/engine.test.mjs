import test from 'node:test';
import assert from 'node:assert/strict';
import {EdgeWatchSimulation, classifyTemperature, readingsToCSV} from '../sim-engine.mjs';

test('two synthetic nodes with five probes plus ambient',()=>{
  const sim=new EdgeWatchSimulation({now:Date.UTC(2026,9,23)});
  assert.equal(sim.snapshot().nodes.length,2);
  assert.ok(sim.nodes.every(n=>n.probes.length===5 && Number.isFinite(n.ambient)));
  assert.equal(sim.snapshot().onlineNodes,2);
  assert.ok(sim.rows.length>=150);
});
test('heat scenario crosses warning then critical threshold',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerHeat();
  for(let i=0;i<3;i++)sim.tick();
  assert.equal(sim.nodeA.severity[2], 'critical');
  assert.ok(sim.events.some(e=>e.type==='critical'&&e.id==='NODE-A'));
  assert.equal(sim.nodeA.severity.filter(s=>s==='critical').length,1);
});
test('critical state suppresses duplicate events while still hot',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerHeat();
  for(let i=0;i<4;i++)sim.tick();
  const count=sim.events.filter(e=>e.type==='critical').length;
  for(let i=0;i<4;i++)sim.tick();
  assert.equal(sim.events.filter(e=>e.type==='critical').length,count);
});
test('heated probe eventually recovers with hysteresis',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerHeat();
  for(let i=0;i<70;i++)sim.tick();
  assert.equal(sim.nodeA.severity[2],'normal');
  assert.ok(sim.events.some(e=>e.type==='recovery'&&e.title.includes('Probe 3')));
});
test('missing uplinks produce exactly one offline event and one recovery',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerOffline();
  for(let i=0;i<5;i++)sim.tick();
  assert.equal(sim.nodeB.status,'offline');
  assert.equal(sim.events.filter(e=>e.type==='offline').length,1);
  for(let i=0;i<20;i++)sim.tick();
  assert.equal(sim.nodeB.status,'online');
  assert.equal(sim.events.filter(e=>e.type==='offline').length,1);
  assert.ok(sim.events.some(e=>e.type==='recovery'&&e.id==='NODE-B'));
});
test('no fabricated uplinks added while NODE-B is offline',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerOffline();
  const before=sim.rows.filter(r=>r.id==='NODE-B').length;
  for(let i=0;i<5;i++)sim.tick();
  assert.equal(sim.rows.filter(r=>r.id==='NODE-B').length,before);
});
test('CSV contains headers and both synthetic devices',()=>{
  const sim=new EdgeWatchSimulation({now:Date.UTC(2026,9,23)});sim.tick();
  const csv=readingsToCSV(sim.rows);
  assert.match(csv,/timestamp_utc,device,probe_1_c/);
  assert.match(csv,/NODE-A/);assert.match(csv,/NODE-B/);
  assert.equal(csv.trim().split('\r\n').length,sim.rows.length+1);
});
test('alert thresholds must be consistent',()=>{
  const sim=new EdgeWatchSimulation();
  assert.throws(()=>sim.setThresholds(50,45),RangeError);
  sim.setThresholds(29,38);
  assert.equal(sim.warningC,29);assert.equal(sim.criticalC,38);
});
test('hysteresis avoids flapping around critical limit',()=>{
  assert.equal(classifyTemperature(39,32,40,'critical',2),'critical');
  assert.equal(classifyTemperature(37.9,32,40,'critical',2),'warning');
  assert.equal(classifyTemperature(29.9,32,40,'warning',2),'normal');
});
test('manual reset restores normal state',()=>{
  const sim=new EdgeWatchSimulation({now:0});sim.triggerHeat();sim.tick();sim.tick();sim.tick();
  sim.triggerOffline();sim.tick();sim.tick();sim.tick();
  assert.ok(sim.snapshot().activeAlarms>0);
  sim.reset();
  assert.equal(sim.snapshot().activeAlarms,0);
  assert.equal(sim.snapshot().onlineNodes,2);
});
