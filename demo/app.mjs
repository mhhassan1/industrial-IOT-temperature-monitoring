import {EdgeWatchSimulation, readingsToCSV} from './sim-engine.mjs';

const sim = new EdgeWatchSimulation();
const $ = id => document.getElementById(id);
let paused = false;
let toastHandle;
let renderVersion = 0;
const colors = {warning:'#edc182', critical:'#ff7f88', offline:'#ff7f88', recovery:'#a9f2d3', scenario:'#6eced5', info:'#a9f2d3'};

const degrees = n => (Number.isFinite(n) ? n.toFixed(1) : '—');
const timeString = ms => new Date(ms).toLocaleTimeString('en-US',{timeZone:'UTC',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
function toast(message){
  const el=$('toast');el.textContent=message;el.classList.add('visible');
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('visible'),3600);
}
function icon(name){return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;}
function safeString(str){return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function nodeHtml(node){
  const status=node.status==='online';
  const last = new Date(node.lastSeen).toISOString().slice(11,19)+'Z';
  const sensors=node.probes.map((v,i)=>`<div class="sensor ${node.severity[i]==='critical'?'critical':node.severity[i]==='warning'?'warn':''}"><div class="sensor-label">Probe ${i+1}</div><div class="sensor-number">${degrees(v)}<small>°C</small></div></div>`).join('');
  return `<article class="node-card ${status?'':'state-offline'}" data-device="${node.id}" aria-label="${node.id} synthetic sensor node">
    <div class="node-head"><div><div class="node-id">${node.id}</div><div class="node-sub">${safeString(node.label)} · 5 probes + ambient</div></div><span class="node-badge ${status?'':'offline'}">${status?'●  RECEIVING':'!  NO DATA'}</span></div>
    <div class="sensor-grid">${sensors}<div class="sensor ambient"><div class="sensor-label">Ambient</div><div class="sensor-number">${degrees(node.ambient)}<small>°C</small></div></div></div>
    <div class="node-meta"><span>RSSI <b>${node.rssi} dBm</b></span><span>SNR <b>${degrees(node.snr)} dB</b></span><span>LAST RX <b>${last}</b></span><span>FCNT <b>#${node.sequence}</b></span></div>
  </article>`;
}
function renderEvents(snapshot){
  $('event-total').textContent=`${snapshot.events.length} event${snapshot.events.length!==1?'s':''}`;
  $('nav-alert').textContent=String(snapshot.activeAlarms);
  $('event-list').innerHTML = snapshot.events.slice(0,8).map(e=>{
    const symbol=(e.type==='critical'||e.type==='offline')?'alert':(e.type==='scenario')?'activity':(e.type==='warning')?'thermo':'check';
    return `<div class="event"><span class="event-icon ${e.type}">${icon(symbol)}</span><div class="event-content"><div class="event-title">${safeString(e.title)}</div><div class="event-desc">${safeString(e.description)}</div></div><div class="event-time">${timeString(e.time)}Z</div></div>`;
  }).join('');
}
const SVG_NS='http://www.w3.org/2000/svg';
function svgNode(tag, attrs={}, text=null){
  const el=document.createElementNS(SVG_NS,tag);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
  if(text!==null)el.textContent=String(text);
  return el;
}
function renderChart(snapshot){
  const target=$('trend-graph');
  const nodeId=$('chart-node').value;
  const minutes=Number($('chart-window').value);
  $('trend-title-node').textContent=`/ ${nodeId}`;
  const rows=snapshot.history.filter(r=>r.id===nodeId&&r.timestamp>=snapshot.time-minutes*60000);
  while(target.firstChild)target.removeChild(target.firstChild);
  const W=960,H=220,L=43,R=14,T=18,B=21;
  if(rows.length<2)return;
  const values=rows.flatMap(r=>[r.probes[0],r.probes[2],r.ambient]);
  const lo=Math.floor(Math.min(...values,snapshot.warningC - 7)-1);
  const hi=Math.ceil(Math.max(...values, snapshot.warningC + 3)+2);
  const lower=Math.max(0,lo), upper=Math.max(lower+8,hi);
  const plotW=W-L-R,plotH=H-T-B;
  const start=rows[0].timestamp,end=rows[rows.length-1].timestamp;
  const x=timestamp=>L+((timestamp-start)/(end-start||1))*plotW;
  const y=v=>T+(1-(v-lower)/(upper-lower))*plotH;
  for(let i=0;i<=4;i++){
    const val=lower+(upper-lower)*(4-i)/4;
    const yy=T+plotH*i/4;
    target.append(svgNode('line',{x1:L,x2:W-R,y1:yy,y2:yy,class:'gridline'}));
    target.append(svgNode('text',{x:3,y:yy+3,class:'axis-text'},`${val.toFixed(0)}°`));
  }
  if(snapshot.warningC>lower&&snapshot.warningC<upper){
    const ty=y(snapshot.warningC);
    target.append(svgNode('line',{x1:L,x2:W-R,y1:ty,y2:ty,class:'threshold-line'}));
  }
  const traces=[{get:r=>r.probes[0],stroke:'#a9f2d3'},{get:r=>r.probes[2],stroke:'#68ced5'},{get:r=>r.ambient,stroke:'#aab3ff'}];
  for(const trace of traces){
    const points=rows.map((r,i)=>`${i?'L':'M'}${x(r.timestamp).toFixed(2)} ${y(trace.get(r)).toFixed(2)}`).join(' ');
    target.append(svgNode('path',{d:points,class:'trend-path',stroke:trace.stroke}));
    const last=rows.at(-1);
    target.append(svgNode('circle',{cx:x(last.timestamp),cy:y(trace.get(last)),r:3.3,fill:trace.stroke,stroke:'#0e1c29','stroke-width':2}));
  }
  $('chart-left').textContent=timeString(start).slice(0,5);
  $('chart-right').textContent=timeString(end).slice(0,5);
  target.setAttribute('aria-label',`${nodeId} simulated temperature chart with ${rows.length} samples. Latest probe 1 ${degrees(rows.at(-1).probes[0])} degrees Celsius.`);
}
function render(){
  const snapshot=sim.snapshot();
  $('clock').textContent=`UTC ${timeString(snapshot.time)}`;
  $('updated').textContent=`${timeString(snapshot.time)} UTC`;
  $('kpi-nodes').innerHTML=`${snapshot.onlineNodes} <span>/ 2</span>`;
  $('kpi-nodes-sub').className='kpi-sub '+(snapshot.onlineNodes===2?'good':'bad');
  $('kpi-nodes-sub').innerHTML=`<span class="tiny-dot"></span> ${snapshot.onlineNodes===2?'All nodes reporting':`${2-snapshot.onlineNodes} node missing data`}`;
  $('kpi-peak').innerHTML=`${degrees(snapshot.peakTemp)}<span> °C</span>`;
  $('kpi-alerts').innerHTML=`${snapshot.activeAlarms}<span> active</span>`;
  $('kpi-alerts-sub').className='kpi-sub '+(snapshot.activeAlarms?'bad':'good');
  $('kpi-alerts-sub').innerHTML=`<span class="tiny-dot"></span> ${snapshot.activeAlarms?'Requires review':'All readings nominal'}`;
  $('node-cards').innerHTML=snapshot.nodes.map(nodeHtml).join('');
  renderEvents(snapshot);renderChart(snapshot);
  renderVersion++;
  document.documentElement.dataset.renderVersion=String(renderVersion);
}
function tick(times=1){for(let i=0;i<times;i++)sim.tick();render();}
$('heat').addEventListener('click',()=>{sim.triggerHeat();tick(3);toast('Synthetic heat excursion started on NODE-A / Probe 3.');});
$('outage').addEventListener('click',()=>{sim.triggerOffline();tick(3);toast('Synthetic NODE-B uplink outage detected.');});
$('restore').addEventListener('click',()=>{sim.reset();tick(1);toast('Synthetic scenarios reset.');});
$('chart-node').addEventListener('change',render);
$('chart-window').addEventListener('change',render);
$('apply').addEventListener('click',()=>{
  const w=Number($('warning').value),c=Number($('critical').value);
  try {sim.setThresholds(w,c);$('settings-help').textContent=`Applied: ${w}°C warning · ${c}°C critical · 2°C reset margin`; $('settings-help').classList.remove('invalid');tick(1);toast('Demo thresholds updated.');}
  catch(err){$('settings-help').textContent=err.message;$('settings-help').classList.add('invalid');}
});
$('pause').addEventListener('click',()=>{
  paused=!paused;
  $('pause').innerHTML=`${icon(paused?'play':'pause')} <span>${paused?'Resume simulation':'Pause simulation'}</span>`;
  toast(paused?'Simulation paused.':'Simulation resumed.');
});
$('export').addEventListener('click',()=>{
  const text=readingsToCSV(sim.rows);
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`edgewatch-synthetic-readings-${new Date(sim.time).toISOString().slice(0,10)}.csv`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`Exported ${sim.rows.length} synthetic readings as CSV.`);
});
const navs=[...document.querySelectorAll('.navlink')];
navs.forEach(a=>a.addEventListener('click',()=>{navs.forEach(b=>b.classList.remove('active'));a.classList.add('active');}));
// All state is intentionally ephemeral and stays in this browser tab.
window.__edgewatchDemo={snapshot:()=>sim.snapshot(),tick:(n=1)=>tick(n),reset:()=>{sim.reset();render();}};
render();
setInterval(()=>{if(!paused)tick(1);},2000);
