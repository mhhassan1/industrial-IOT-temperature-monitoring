/**
 * EdgeWatch browser-only demo engine.
 * ALL readings, identifiers, timestamps, and radio metrics are fabricated.
 * No network, MQTT, hardware, or storage permissions are used.
 */
export const NODE_IDS = ["NODE-A", "NODE-B"];
export const DEFAULT_WARNING_C = 32;
export const DEFAULT_CRITICAL_C = 40;
export const SENSOR_COUNT = 5;

const fmt = value => Number(value.toFixed(1));
const severityRank = {normal: 0, warning: 1, critical: 2};
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}
export function classifyTemperature(temp, warning, critical, prior = "normal", hysteresis = 2) {
  if (!Number.isFinite(temp)) return 'normal';
  if (prior === 'critical' && temp >= critical - hysteresis) return 'critical';
  if (temp >= critical) return 'critical';
  if (prior !== 'normal' && temp >= warning - hysteresis) return 'warning';
  return temp >= warning ? 'warning' : 'normal';
}
export function csvCell(value) {
  let str = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}
export function readingsToCSV(history) {
  const headers = ['timestamp_utc','device','probe_1_c','probe_2_c','probe_3_c','probe_4_c','probe_5_c','ambient_c','rssi_dbm','snr_db'];
  const rows = history.map(entry => [new Date(entry.timestamp).toISOString(), entry.id, ...entry.probes, entry.ambient, entry.rssi, entry.snr]);
  return [headers.join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n') + '\r\n';
}
export class EdgeWatchSimulation {
  constructor({now = Date.now(), seed = 6272026, warningC = DEFAULT_WARNING_C, criticalC = DEFAULT_CRITICAL_C} = {}) {
    this.origin = now;
    this.time = now;
    this.rng = seededRandom(seed);
    this.warningC = warningC;
    this.criticalC = criticalC;
    this.intervalSeconds = 5;
    this.offlineAfterSeconds = 15;
    this.rows = [];
    this.events = [];
    this.nextEvent = 1;
    this.steps = 0;
    this.heatUntil = 0;
    this.heating = false;
    this.offlineUntil = 0;
    this.offlineScenario = false;
    this.nodes = NODE_IDS.map((id,index) => ({id, label:index ? 'Remote enclosure' : 'Test enclosure', probes:[22.1,22.4,22.2,22.3,22.5].map(v=>v+index*.2), ambient:22.0+index*.3, rssi:-51-index*10, snr:10.5-index*1.1, lastSeen:now, status:'online', severity: Array(5).fill('normal'), sequence:0 }));
    // Prepopulate history without simulating physical transmission for screenshot/graph usability.
    for(let t=80;t>0;t--){
      const when=now - t*5000;
      NODE_IDS.forEach((id,index)=>{
        const phase=t/4+index;
        const base=22.1+index*.25;
        const probes=Array.from({length:5},(_,i)=>fmt(base+.3*Math.sin(phase+i*.4)+this.rng()*.15));
        this.rows.push({timestamp:when,id,probes,ambient:fmt(base+.25),rssi:-51-index*10,snr:10.5-index*1.1});
      });
    }
    this.addEvent('info','Simulation ready','Two synthetic nodes are sending fabricated telemetry.');
  }
  addEvent(type,title,description, id=null) {
    this.events.unshift({eventId:this.nextEvent++, type,title,description, id, time:this.time});
    if(this.events.length>120) this.events.length=120;
  }
  get nodeA(){return this.nodes[0];}
  get nodeB(){return this.nodes[1];}
  triggerHeat(){
    this.heating=true;
    this.heatUntil=this.steps+15;
    this.addEvent('scenario','Heat scenario triggered','Synthetic heating applied to NODE-A / Probe 3.', 'NODE-A');
  }
  triggerOffline(){
    this.offlineScenario=true;
    this.offlineUntil=this.steps+17;
    this.addEvent('scenario','Connectivity scenario triggered','NODE-B readings intentionally suspended.', 'NODE-B');
  }
  reset(){
    this.heating=false;
    this.heatUntil=0;
    this.offlineScenario=false;
    this.offlineUntil=0;
    this.nodes.forEach((n,idx)=>{
      for(let i=0;i<5;i++){
        if(n.severity[i]!=='normal') this.addEvent('recovery',`${n.id} · Probe ${i+1} restored`,'Scenario reset to nominal readings.',n.id);
        n.probes[i]=fmt(22.2+idx*.2+i*.07);
      }
      if(n.status==='offline') this.addEvent('recovery',`${n.id} connection restored`,'Scenario reset.',n.id);
      n.severity.fill('normal');n.status='online';n.lastSeen=this.time;
    });
    this.addEvent('info','Scenarios reset','All synthetic nodes restored to normal operation.');
  }
  setThresholds(warning,critical){
    if(!Number.isFinite(warning)||!Number.isFinite(critical)||warning<10||critical>120||warning+1>critical) throw new RangeError('Warning must be at least 10°C; critical must exceed warning by 1°C and be at most 120°C.');
    this.warningC=warning;this.criticalC=critical;
    this.addEvent('info','Alarm thresholds updated',`Warning ${warning}°C · Critical ${critical}°C.`);
  }
  tick(){
    this.steps++;
    this.time += this.intervalSeconds*1000;
    const heatActive=this.heating && this.steps < this.heatUntil;
    if(this.heating && !heatActive) this.heating=false;
    const offlineActive=this.offlineScenario && this.steps < this.offlineUntil;
    if(this.offlineScenario && !offlineActive) this.offlineScenario=false;
    for(const [index,node] of this.nodes.entries()){
      if(index===1 && offlineActive){
        if(this.time-node.lastSeen>=this.offlineAfterSeconds*1000 && node.status!=='offline'){
          node.status='offline';
          this.addEvent('offline', 'NODE-B telemetry missing',`No synthetic uplink for ${this.offlineAfterSeconds} seconds.`,node.id);
        }
        continue;
      }
      if(node.status==='offline'){
        node.status='online';
        this.addEvent('recovery',`${node.id} connection restored`,'Synthetic telemetry delivery resumed.',node.id);
      }
      node.sequence++;
      node.lastSeen=this.time;
      const base=22.2+index*.2;
      for(let p=0;p<5;p++){
        const jitter=(this.rng()-.5)*.32;
        const previous=node.probes[p];
        const target=heatActive && index===0 && p===2 ? 48+this.rng()*3 : base+(p%3)*.12+Math.sin(this.steps/5+p)*.25;
        // Make the scenario immediately observable, but decay progressively.
        const factor=heatActive&&index===0&&p===2 ? .72 : .25;
        node.probes[p]=fmt(previous+(target-previous)*factor+jitter);
        const previousSeverity=node.severity[p];
        const current=classifyTemperature(node.probes[p],this.warningC,this.criticalC,previousSeverity);
        node.severity[p]=current;
        if(current!==previousSeverity){
          const label=`${node.id} · Probe ${p+1}`;
          if(current==='normal') this.addEvent('recovery',`${label} recovered`,`Now ${node.probes[p]}°C; below alarm reset limit.`,node.id);
          else if(severityRank[current]>severityRank[previousSeverity]) this.addEvent(current,`${label} ${current} threshold`,`Reading ${node.probes[p]}°C · ${current==='critical'?this.criticalC:this.warningC}°C threshold.`,node.id);
          else this.addEvent('warning',`${label} de-escalated`,`Reading ${node.probes[p]}°C; above warning threshold.`,node.id);
        }
      }
      node.ambient=fmt(node.ambient+(base-.2-node.ambient)*.2+(this.rng()-.5)*.1);
      node.rssi=Math.max(-90,Math.min(-43,Math.round(node.rssi+(this.rng()-.5)*3)));
      node.snr=fmt(Math.max(4,Math.min(14,node.snr+(this.rng()-.5)*.8)));
      this.rows.push({timestamp:this.time,id:node.id,probes:[...node.probes],ambient:node.ambient,rssi:node.rssi,snr:node.snr});
    }
    if(this.rows.length>1800) this.rows.splice(0,this.rows.length-1800);
    return this.snapshot();
  }
  snapshot(){
    const active=this.events.filter(e=>(e.type==='warning'||e.type==='critical'||e.type==='offline')).length;
    const hot=this.nodes.flatMap(n=>n.severity).filter(s=>s==='critical').length;
    const warning=this.nodes.flatMap(n=>n.severity).filter(s=>s==='warning').length;
    return {time:this.time,nodes:this.nodes,history:this.rows,events:this.events,warningC:this.warningC,criticalC:this.criticalC,activeAlarms:hot+warning+this.nodes.filter(n=>n.status==='offline').length,peakTemp:Math.max(...this.nodes.flatMap(n=>n.probes)),onlineNodes:this.nodes.filter(n=>n.status==='online').length,simulated:true};
  }
}
