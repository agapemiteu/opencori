'use client';

import { useMemo, useState } from 'react';

type Tab = 'overview' | 'registry' | 'simulation' | 'delivery' | 'receiver' | 'privacy';
type Flow = 'idle' | 'approach' | 'prompt' | 'visit' | 'compose' | 'sending' | 'delivered' | 'complete';

const branches = [
  ['Marina Demo Branch','Lagos','Lagos Island','350m','250m','Verified demo'],
  ['Ikeja Demo Branch','Lagos','Ikeja','350m','250m','Demo seed'],
  ['Abuja CBD Demo Branch','FCT','Abuja','400m','290m','Demo seed'],
  ['Kano Demo Branch','Kano','Kano','420m','300m','Demo seed'],
  ['Kaduna Demo Branch','Kaduna','Kaduna','400m','290m','Demo seed'],
  ['Ibadan Demo Branch','Oyo','Ibadan','380m','270m','Demo seed'],
  ['Port Harcourt Demo Branch','Rivers','Port Harcourt','360m','260m','Demo seed'],
  ['Enugu Demo Branch','Enugu','Enugu','380m','270m','Demo seed'],
];

const nav: [Tab,string][] = [
  ['overview','Overview'],['registry','Branch registry'],['simulation','Simulation lab'],['delivery','Delivery'],['receiver','Wema receiver'],['privacy','Privacy & security']
];

function Icon({name}:{name:string}) {
  const paths: Record<string,string> = {
    overview:'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    registry:'M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Zm0-8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
    simulation:'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 3h4v1h-4V5Zm1 14h2v1h-2v-1Z',
    delivery:'M3 11h13l-4-4 1.4-1.4L20 12l-6.6 6.4L12 17l4-4H3v-2Z',
    receiver:'M3 5h18v14H3V5Zm2 2v1l7 4.5L19 8V7H5Zm14 10v-6.6l-7 4.4-7-4.4V17h14Z',
    privacy:'M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Zm-1 13-3-3 1.4-1.4L11 12.2l3.6-3.6L16 10l-5 5Z'
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]}/></svg>
}

export default function Page(){
  const [tab,setTab] = useState<Tab>('overview');
  const [flow,setFlow] = useState<Flow>('idle');
  const [message,setMessage] = useState('I visited the branch and still need help with an issue on my account.');
  const [distance,setDistance] = useState(640);
  const [elapsed,setElapsed] = useState(0);
  const [cipher,setCipher] = useState('');
  const [receipt,setReceipt] = useState('');
  const [failNext,setFailNext] = useState(false);
  const [events,setEvents] = useState<string[]>(['SDK ready · signed config verified','14 demo branch nodes synced']);
  const [config,setConfig] = useState(17);
  const title = nav.find(([k])=>k===tab)?.[1] || 'Overview';
  const stateName = flow==='idle'?'MONITORING':flow==='approach'?'APPROACH':flow==='prompt'?'PROMPT_PENDING':flow==='visit'||flow==='compose'?'VISIT_ACTIVE':flow==='sending'?'DELIVERING':flow==='delivered'?'DELIVERED':'COMPLETED';

  const maskedCipher = useMemo(()=> cipher ? `${cipher.slice(0,120)}…` : 'No encrypted envelope yet.',[cipher]);

  function addEvent(v:string){ setEvents(e=>[v,...e].slice(0,8)); }
  function runApproach(){
    setTab('simulation'); setFlow('approach'); setDistance(640); addEvent('Approach simulation started · Marina');
    let d=640;
    const id=setInterval(()=>{ d=Math.max(165,d-55); setDistance(d); if(d<=165){clearInterval(id);setFlow('prompt');addEvent('Branch prompt delivered · anonymous installation');}},210);
  }
  function confirmVisit(){ setFlow('visit'); setElapsed(0); addEvent('Visit started · customer confirmed · confidence HIGH'); }
  function advance(){ setElapsed(v=>v+23*60); addEvent('Presentation clock advanced +23m'); }
  async function send(){
    if(!message.trim()) return;
    setFlow('sending'); addEvent('Host encrypting request · plaintext stays in ALAT');
    const bytes = new TextEncoder().encode(message);
    const digest = await crypto.subtle.digest('SHA-256',bytes);
    const hash = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
    const pseudoCipher = btoa(unescape(encodeURIComponent(message))).split('').reverse().join('') + '.' + hash;
    setCipher(pseudoCipher);
    addEvent('Corri relay accepted ciphertext · route customer-care.general');
    const response = await fetch('/api/relay',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'evt_'+Date.now(),routeKey:'customer-care.general',branchId:'marina',ciphertext:pseudoCipher,failOnce:failNext})});
    const data = await response.json();
    setReceipt(data.receipt || 'WEMA-DEMO-'+Math.floor(10000+Math.random()*90000));
    if(data.retried) addEvent('Primary delivery failed once · retry succeeded');
    addEvent(`Delivered to Wema-owned receiver · ${data.latencyMs ?? 224}ms`);
    setFailNext(false); setFlow('delivered');
  }
  function complete(){ setFlow('complete'); addEvent(`Visit completed · ${Math.floor(elapsed/60)}m ${elapsed%60}s · HIGH confidence`); }
  function reset(){ setFlow('idle');setDistance(640);setElapsed(0);setCipher('');setReceipt('');setMessage('I visited the branch and still need help with an issue on my account.');addEvent('Scenario reset'); }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">c</div><div><strong>corri</strong><span>physical context infrastructure</span></div></div>
      <nav>{nav.map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={tab===key?'active':''}><Icon name={key}/><span>{label}</span></button>)}</nav>
      <div className="tenant"><div className="tenantAvatar">WB</div><div><b>Wema Bank</b><span>ALAT Demo · Nigeria</span></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><span className="crumb">WEMA BANK / ALAT DEMO</span><h1>{title}</h1></div><div className="topRight"><span className="health"><i/>Hackathon sandbox</span><button className="secondary" onClick={reset}>Reset</button><button className="primary" onClick={runApproach}>Run live demo</button></div></header>
      <div className="content">
        {tab==='overview' && <>
          <section className="hero panel"><div className="eyebrow">CORRI INFRASTRUCTURE</div><h2>Software that understands the physical moment.</h2><p>Corri gives existing mobile apps a privacy-first layer for branch awareness, confirmed visit timing and secure delivery. It never needs customer accounts, credentials, transactions or readable support messages.</p><div className="flowline"><span>Approach</span><b>→</b><span>Confirm</span><b>→</b><span>Visit</span><b>→</b><span>Encrypt</span><b>→</b><span>Deliver</span></div><button className="lightCta" onClick={runApproach}>Experience Corri in ALAT →</button></section>
          <section className="metrics"><div className="metric panel"><span>Demo branch nodes</span><b>14</b><small>Multi-state registry</small></div><div className="metric panel"><span>Confirmed visits</span><b>1,284</b><small>Privacy-safe demo data</small></div><div className="metric panel"><span>Median presence</span><b>24m</b><small>Confidence filtered</small></div><div className="metric panel"><span>Delivery success</span><b>99.94%</b><small>P50 236ms</small></div></section>
          <section className="twoCol"><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">LIVE SYSTEM</span><h3>Infrastructure event trace</h3></div><span className="status green">HEALTHY</span></div><div className="timeline">{events.map((e,i)=><div key={i}><i/><span>{e}</span><time>{i===0?'now':`${i*2}m`}</time></div>)}</div></div><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">TRUST BOUNDARY</span><h3>Corri intentionally sees less.</h3></div></div><div className="zeros"><div><b>0</b><span>customer identity fields</span></div><div><b>0</b><span>banking credential fields</span></div><div><b>0</b><span>readable complaint fields</span></div></div></div></section>
        </>}

        {tab==='registry' && <section className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">SIGNED CONFIGURATION</span><h3>Wema branch registry</h3><p>Production locations must come from bank-approved sources. These are representative demo nodes.</p></div><div className="actions"><span className="status purple">cfg_wema_{String(config).padStart(3,'0')}</span><button className="secondary" onClick={()=>{setConfig(v=>v+1);addEvent('Signed configuration published')}}>Publish config</button></div></div><div className="registryMap"><div className="mapPulse p1"/><div className="mapPulse p2"/><div className="mapPulse p3"/><div className="mapPulse p4"/><div className="mapPulse p5"/><span>NIGERIA · DYNAMIC NEARBY SUBSET</span></div><div className="table"><div className="tr th"><span>Branch</span><span>State</span><span>City</span><span>Approach</span><span>Exit</span><span>Source</span></div>{branches.map((r,i)=><div className="tr" key={i}>{r.map((c,j)=><span key={j}>{j===0?<b>{c}</b>:c}</span>)}</div>)}</div></section>}

        {tab==='simulation' && <section className="simGrid">
          <div className="phoneFrame"><div className="phone"><div className="notch"/><div className="phoneTop"><b>9:41</b><span>ALAT · DEMO HOST</span><b>100%</b></div><div className="phoneBody">
            {flow==='idle' && <div className="mobilePage"><div className="alatLogo">ALAT</div><div className="balanceCard"><span>Available balance · intentionally masked</span><b>₦••••••</b><small>Corri receives no banking data.</small></div><div className="assistCard"><div className="pin">⌖</div><div><b>Branch Assistance is on</b><p>Corri can detect Wema demo zones with your consent.</p></div></div><button className="phonePrimary" onClick={runApproach}>Simulate branch approach</button></div>}
            {flow==='approach' && <div className="mobilePage"><div className="alatLogo">ALAT</div><div className="radar"><div className="ring r1"/><div className="ring r2"/><div className="ring r3"/><i/><div className="distance"><span>Wema Marina demo zone</span><b>{distance} m</b></div></div><div className="signalStrip"><span>Corri state</span><b>APPROACH_CANDIDATE</b></div></div>}
            {flow==='prompt' && <div className="mobilePage"><div className="alatLogo">ALAT</div><div className="radar dim"><div className="ring r1"/><div className="ring r2"/><i/></div><div className="notification"><div className="noticeHead"><strong>ALAT</strong><span>Branch assistance</span></div><h3>You are near Wema Marina.</h3><p>Are you visiting this branch today?</p><button className="phonePrimary" onClick={confirmVisit}>Yes, I am visiting</button><button className="phoneSecondary" onClick={()=>{setFlow('idle');addEvent('Prompt dismissed · NOT_NOW cooldown')}}>Not now</button></div></div>}
            {(flow==='visit') && <div className="mobilePage centered"><span className="miniLabel">CONFIRMED BRANCH VISIT</span><h2>Wema Marina</h2><div className="timerRing"><div><b>{String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')}</b><span>confirmed presence</span></div></div><div className="privacyCard"><b>Corri holds visit metadata only</b><span>No account, transaction, credential or readable complaint data.</span></div><button className="phonePrimary" onClick={()=>setFlow('compose')}>Ask Wema for help</button><button className="phoneSecondary" onClick={advance}>Advance visit by 23 minutes</button><button className="phoneGhost" onClick={complete}>I have left the branch</button></div>}
            {flow==='compose' && <div className="mobilePage"><span className="miniLabel">WEMA-OWNED EXPERIENCE</span><h2>What do you need help with?</h2><p className="mobileCopy">Your message is encrypted inside the host application before Corri receives anything.</p><textarea value={message} onChange={e=>setMessage(e.target.value)}/><div className="routeBox"><span>Route</span><b>customer-care.general</b></div><button className="phonePrimary" onClick={send}>Encrypt & send to Wema</button><button className="phoneGhost" onClick={()=>setFlow('visit')}>Back</button></div>}
            {flow==='sending' && <div className="mobilePage centered"><div className="loader"/><span className="miniLabel">SECURE DELIVERY</span><h2>Routing ciphertext</h2><p className="mobileCopy">Corri can deliver this envelope, but cannot read it.</p><div className="steps"><span>✓ Encrypted inside ALAT</span><span>✓ Accepted by Corri relay</span><span>• Delivering to Wema</span></div></div>}
            {flow==='delivered' && <div className="mobilePage centered"><div className="successMark">✓</div><span className="miniLabel">DELIVERED</span><h2>Wema received your request.</h2><div className="receipt"><span>Receipt</span><b>{receipt}</b></div><button className="phonePrimary" onClick={()=>setFlow('visit')}>Return to active visit</button></div>}
            {flow==='complete' && <div className="mobilePage centered"><div className="successMark">✓</div><span className="miniLabel">VISIT COMPLETE</span><h2>Branch visit recorded.</h2><div className="receipt"><span>Confirmed presence</span><b>{Math.floor(elapsed/60)}m {elapsed%60}s</b><span>Confidence</span><b>HIGH</b></div><button className="phonePrimary" onClick={reset}>Run again</button></div>}
          </div></div></div>
          <div className="simSide"><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">STATE MACHINE</span><h3>{stateName}</h3></div><span className="status purple">LIVE</span></div><div className="stateRail">{['MONITORING','APPROACH','PROMPT','VISIT','DELIVERY','COMPLETE'].map((s,i)=><div key={s} className={(i <= ['idle','approach','prompt','visit','compose','sending','delivered','complete'].indexOf(flow)/1.5)?'done':''}><i/><span>{s}</span></div>)}</div></div><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">EVENT TRACE</span><h3>Privacy-safe telemetry</h3></div></div><div className="timeline">{events.map((e,i)=><div key={i}><i/><span>{e}</span><time>{i===0?'now':`${i*2}m`}</time></div>)}</div></div><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">ENCRYPTED ENVELOPE</span><h3>What Corri can see</h3></div></div><pre>{maskedCipher}</pre><button className="secondary" onClick={()=>{setFailNext(true);addEvent('Failure injection armed for next delivery')}}>Fail next delivery once</button></div></div>
        </section>}

        {tab==='delivery' && <section className="twoCol"><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">ROUTE MAP</span><h3>Organisation-owned destinations</h3></div><span className="status green">HEALTHY</span></div><div className="routeRow"><div><span>Route key</span><b>customer-care.general</b></div><strong>→</strong><div><span>Destination</span><b>Wema Support Webhook</b></div></div><div className="routeRow"><div><span>Route key</span><b>branch-support.general</b></div><strong>→</strong><div><span>Destination</span><b>Wema Branch Ops</b></div></div></div><div className="panel pad"><div className="panelHead"><div><span className="eyebrow dark">RELIABILITY</span><h3>Delivery controls</h3></div></div><div className="bigStat"><b>99.94%</b><span>demo delivery success</span></div><button className="secondary" onClick={()=>setFailNext(true)}>Fail next delivery once</button></div></section>}

        {tab==='receiver' && <section className="receiver panel"><div className="receiverBand"><span>MOCK WEMA INFRASTRUCTURE</span><h2>Support Event Receiver</h2></div><div className="receiverBody"><div className="panelHead"><div><span className="eyebrow dark">DECRYPTED REQUEST</span><h3>Plaintext exists only on the bank side.</h3></div><span className={`status ${receipt?'green':'purple'}`}>{receipt?'RECEIVED':'WAITING'}</span></div><div className="messageBox">{receipt?message:'No customer request received yet. Run the simulation and submit a request from the ALAT host.'}</div><div className="receiverMeta"><div><span>Receiver reference</span><b>{receipt||'—'}</b></div><div><span>Branch</span><b>{receipt?'Wema Marina Demo':'—'}</b></div><div><span>Route key</span><b>{receipt?'customer-care.general':'—'}</b></div><div><span>Signature</span><b>{receipt?'Verified':'—'}</b></div></div></div></section>}

        {tab==='privacy' && <><section className="trustFlow"><div className="panel pad"><span className="eyebrow dark">HOST APP</span><h3>ALAT owns customer context.</h3><p>Identity, account context, request UI, route selection and encryption remain inside the bank-owned experience.</p></div><strong>→</strong><div className="panel pad accent"><span className="eyebrow">CORRI</span><h3>Corri owns physical context.</h3><p>Anonymous visit metadata, branch policies, ciphertext delivery, retries and receipts.</p></div><strong>→</strong><div className="panel pad"><span className="eyebrow dark">BANK RECEIVER</span><h3>Wema owns decryption.</h3><p>Private keys, support workflow, account access and every banking decision stay with the bank.</p></div></section><section className="metrics privacyMetrics"><div className="metric panel"><span>Customer identities</span><b>0</b></div><div className="metric panel"><span>Bank credentials</span><b>0</b></div><div className="metric panel"><span>Transactions</span><b>0</b></div><div className="metric panel"><span>Readable complaints</span><b>0</b></div></section></>}
      </div>
    </section>
  </main>
}
