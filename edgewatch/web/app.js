(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const temp = x => typeof x === 'number' ? x.toFixed(1) : '—';
  const niceTime = t => { try { return new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); } catch { return '—'; } };
  const get = async url => { const r=await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); };
  let rendering=false;
  $('clock').textContent=new Date().toLocaleString([], {month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});

  function chart(points) {
    if(points.length < 2) return '<div class="event-empty">Collecting data points…</div>';
    const w=510,h=128, left=16,right=20,top=9,bottom=20;
    const vals=points.flatMap(p=>[p.probe_1_c,p.probe_2_c,p.probe_3_c]).filter(v=>typeof v==='number');
    let min=Math.floor(Math.min(...vals)-1), max=Math.ceil(Math.max(...vals)+1);
    if(max-min < 4){max=min+4;}
    const xy=(idx,val)=>[(left+idx*(w-left-right)/(points.length-1)).toFixed(1),(top+(max-val)*(h-top-bottom)/(max-min)).toFixed(1)];
    const series=(key, cls) => `<path class="${cls}" d="${points.map((p,i)=>{const [x,y]=xy(i,p[key]); return (i===0?'M':'L')+x+','+y;}).join(' ')}"/>`;
    const grid=[0,.5,1].map(f=>`<line class="grid-line" x1="${left}" y1="${top+f*(h-top-bottom)}" x2="${w-right}" y2="${top+f*(h-top-bottom)}"/>`).join('');
    const [first,last]=[niceTime(points[0].time),niceTime(points[points.length-1].time)];
    return `<svg class="chart" role="img" aria-label="Recent synthetic temperature trends" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${series('probe_1_c','trace')}${series('probe_2_c','trace2')}${series('probe_3_c','trace3')}<text x="${left}" y="${h-2}">${esc(first)}</text><text x="${w-right}" y="${h-2}" text-anchor="end">${esc(last)}</text><text x="${w-right}" y="${top+8}" text-anchor="end">${max}°</text><text x="${w-right}" y="${h-bottom-2}" text-anchor="end">${min}°</text></svg>`;
  }

  function deviceCard(d, points, thresholds) {
    const offline=!d.online;
    const probes = ['probe_1_c','probe_2_c','probe_3_c','probe_4_c','probe_5_c','ambient_c'];
    const channels=probes.map((channel,index)=>{
      const value=d.values[channel];
      const hot=index!==5 && value>=thresholds.critical_c;
      return `<div class="sensor ${hot?'hot':''} ${index===5?'ambient':''}"><div class="name">${index===5?'Ambient':'Probe 0'+(index+1)}</div><div class="temp">${temp(value)}<span class="unit">°C</span></div></div>`;
    }).join('');
    return `<article class="device-card"><div class="device-top"><div><div class="device-code">${esc(d.name)}</div><div class="device-caption">Wireless telemetry node / six sensor channels</div></div><span class="livebadge ${offline?'off':''}">${offline?'NO RECENT DATA':'● TRANSMITTING'}</span></div><div class="sensor-grid">${channels}</div><div class="plot-head"><strong>Temperature history</strong><div class="mini-legend"><span class="legend-mark"></span> Probe trends / recent</div></div>${chart(points)}<div class="device-footer"><span>LAST SEEN <b>${esc(niceTime(d.last_seen))}</b></span><span>RSSI <b>${d.rssi === null?'—':esc(d.rssi)+' dBm'}</b></span><span>SNR <b>${d.snr === null?'—':Number(d.snr).toFixed(1)+' dB'}</b></span></div></article>`;
  }

  async function render() {
    if(rendering) return; rendering=true;
    try {
      const data=await get('/api/snapshot');
      const devices=data.devices;
      $('stat-nodes').textContent=`${devices.filter(x=>x.online).length} / ${devices.length||2}`;
      $('stat-probes').textContent=devices.filter(x=>x.online).length*5 + ' / '+(devices.length||2)*5;
      const values=devices.flatMap(d=>[1,2,3,4,5].map(n=>d.values['probe_'+n+'_c']));
      $('stat-peak').textContent=values.length? temp(Math.max(...values))+'°':'—';
      $('stat-alerts').textContent=String(data.active_alarms.length).padStart(2,'0');
      $('threshold-warn').textContent=temp(data.warning_c)+'°C';
      $('threshold-critical').textContent=temp(data.critical_c)+'°C';
      $('last-update').textContent='Updated '+new Date().toLocaleTimeString();
      $('devices').innerHTML= devices.length ? (await Promise.all(devices.map(async d=>{
        const history=await get(`/api/history?device=${encodeURIComponent(d.name)}&limit=45`);
        return deviceCard(d,history.points,data);
      }))).join('') : '<div class="empty">No telemetry yet. Waiting for first message.</div>';
      const response=await get('/api/alerts');
      $('alerts').innerHTML=response.alerts.length ? response.alerts.slice(0,8).map(e=>{
        const severity=e.severity;
        const icon=severity==='critical'?'!':severity==='warning'?'↑':'✓';
        return `<div class="event"><div class="event-symbol ${esc(severity)}">${icon}</div><div class="event-copy"><div class="event-title">${esc(e.kind.replaceAll('_',' '))} · ${esc(e.device)}</div><div class="event-body">${esc(e.detail)}</div></div><div class="event-time">${esc(niceTime(e.time))}</div></div>`;
      }).join('') : '<div class="event-empty">No threshold or connection events detected. Run a demo scenario to exercise the alarm state machine.</div>';
      $('heat').disabled=!data.demo_controls_enabled;
      $('offline').disabled=!data.demo_controls_enabled;
    } catch(e) { $('last-update').textContent='Server unavailable: '+e.message; }
    finally {rendering=false;}
  }

  async function trigger(type,device) {
    try {const res=await fetch(`/api/demo/${type}?device=${encodeURIComponent(device)}`,{method:'POST'});
      const body=await res.json(); if(!res.ok) throw new Error(body.error||res.statusText);
      $('scenario-feedback').textContent=(type==='heat'?'Heat excursion':'Connection interruption')+' activated on '+device+'. Watch the event log.';
      await render();
    } catch(e) {$('scenario-feedback').textContent='Scenario failed: '+e.message;}
  }
  $('heat').addEventListener('click',()=>trigger('heat','NODE-A'));
  $('offline').addEventListener('click',()=>trigger('offline','NODE-B'));
  $('refresh').addEventListener('click',render);
  render(); setInterval(render,5000);
})();
