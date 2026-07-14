/**
 * CommandCenterOverview - pixel-accurate copy of "Command Center - Design 1"
 * Sales tab: Skylead API stats, Agent Fleet (modal), SDR table, Campaign Brief
 * Recruiting tab: KPIs, Performance Tracker, Campaigns table, Role Brief
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../LoginGate';

// ─── Animations injected once ────────────────────────────────────────────────
const STYLES = `
@keyframes cc-pulse { 0%{transform:scale(.7);opacity:.7} 80%,100%{transform:scale(1.8);opacity:0} }
@keyframes cc-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
@keyframes cc-fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
@keyframes cc-modalIn { from{opacity:0;transform:scale(.97) translateY(12px)} to{opacity:1;transform:none} }
@keyframes cc-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
.cc-skel {
  background: linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.10) 50%,rgba(255,255,255,.04) 75%);
  background-size: 600px 100%;
  animation: cc-shimmer 1.6s infinite linear;
  border-radius: 5px;
}
.cc-root { min-height:100vh; background:linear-gradient(180deg,#05123F 0%,#020A28 100%); color:#EAF0FF; font-family:'Inter',system-ui,sans-serif; }
.cc-sect-label { font:600 11px/1 'Inter',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#06E5EC; margin-bottom:12px; }
.cc-sect-label-purple { font:600 11px/1 'Inter',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#A5B4FC; margin-bottom:12px; }
.brief-card:hover .brief-card-delete { opacity:1 !important; }
`;

// ─── Agent metadata ───────────────────────────────────────────────────────────
// Sales agents only — Zara and Camilla live in the Recruiting tab
const AGENTS = [
  { id:'laura',   label:'Laura',   initial:'L',  role:'BB · Sales Outreach',  color:'#06E5EC', bg:'rgba(6,229,236,.16)',  border:'rgba(6,229,236,.5)',   grad:'linear-gradient(90deg,#003BDF,#06E5EC)', width:'72%', cardBorder:'rgba(6,229,236,.25)', status:'active'  },
  { id:'darren',  label:'Darren',  initial:'D',  role:'MZ · SDR',             color:'#4D8DFF', bg:'rgba(77,141,255,.16)', border:'rgba(77,141,255,.5)',  grad:'linear-gradient(90deg,#003BDF,#4D8DFF)', width:'58%', cardBorder:'rgba(255,255,255,.08)', status:'active'  },
];

// ─── Utility ─────────────────────────────────────────────────────────────────
function fmtN(n) { if (n==null) return '-'; if (n>=1e6) return `${(n/1e6).toFixed(1)}M`; if (n>=1000) return n.toLocaleString(); return String(n); }
function fmtD(n) { return n ? `$${Number(n).toFixed(2)}` : '$0.00'; }
function ago(ts) {
  if (!ts) return '-';
  const m = Math.floor((Date.now()-new Date(ts))/60000);
  if (m<1) return 'just now'; if (m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if (h<24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useSkyleadStats(period='7d', startDate=null, endDate=null) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true); setData(null);
    const p=new URLSearchParams({period});
    if(startDate&&endDate){p.set('startDate',startDate);p.set('endDate',endDate);}
    fetch(`/api/skylead/stats?${p}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[period,startDate,endDate]);
  return {data,loading};
}
function useSdrPerf(period='7d', startDate=null, endDate=null) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true); setData(null);
    const params=new URLSearchParams({period});
    if(startDate&&endDate){ params.set('startDate',startDate); params.set('endDate',endDate); }
    fetch(`/api/skylead/sdr-summary?${params}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[period,startDate,endDate]);
  return {data,loading};
}
function useCampaignRank(period='all', startDate=null, endDate=null) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true); setData(null);
    const p=new URLSearchParams({period,limit:5});
    if(startDate&&endDate){p.set('startDate',startDate);p.set('endDate',endDate);}
    fetch(`/api/skylead/campaigns?${p}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[period,startDate,endDate]);
  return {data,loading};
}
function useMeetingsBreakdown(period='all', startDate=null, endDate=null) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true); setData(null);
    const p=new URLSearchParams({period});
    if(startDate&&endDate){p.set('startDate',startDate);p.set('endDate',endDate);}
    fetch(`/api/skylead/meetings-breakdown?${p}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[period,startDate,endDate]);
  return {data,loading};
}
function useSandbox(period='all', startDate=null, endDate=null, reload=0) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true); setData(null);
    const p=new URLSearchParams({period});
    if(startDate&&endDate){p.set('startDate',startDate);p.set('endDate',endDate);}
    fetch(`/api/skylead/sandbox?${p}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[period,startDate,endDate,reload]);
  return {data,setData,loading};
}
function useFollowUps() {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/hubspot/followups',{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ setData(j); setLoading(false); }).catch(()=>setLoading(false));
  },[]);
  return {data,loading};
}
function useAgentModal(agentId) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if (!agentId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/pg/activities?agent=${agentId}&limit=20`,{headers:authHeaders()}).then(r=>r.json()).catch(()=>({activities:[]})),
      fetch(`/api/pg/tasks?agent=${agentId}&limit=20`,{headers:authHeaders()}).then(r=>r.json()).catch(()=>({tasks:[]})),
      fetch(`/api/pg/cost-summary?agent=${agentId}`,{headers:authHeaders()}).then(r=>r.json()).catch(()=>({})),
    ]).then(([a,t,c])=>{
      setData({activities:a?.activities||a||[],tasks:t?.tasks||t||[],costs:c||{}});
      setLoading(false);
    });
  },[agentId]);
  return {data,loading};
}

// ─── Agent Fleet Modal ────────────────────────────────────────────────────────
function AgentModal({agent,onClose}) {
  const {data,loading}=useAgentModal(agent?.id);
  const [tab,setTab]=useState('activities');
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{ if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  },[onClose]);
  if(!agent) return null;
  const acts=data?.activities||[]; const tasks=data?.tasks||[]; const costs=data?.costs||{};
  return (
    <div ref={ref} onClick={e=>{ if(e.target===ref.current) onClose(); }}
      style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(2,8,20,.72)',backdropFilter:'blur(8px)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:24,animation:'cc-fadeIn .18s ease'}}>
      <div style={{width:'100%',maxWidth:640,maxHeight:'85vh',background:'#0a1338',
        border:'1px solid rgba(255,255,255,.12)',borderRadius:16,display:'flex',flexDirection:'column',
        boxShadow:'0 30px 80px rgba(0,0,0,.6)',animation:'cc-modalIn .22s ease',overflow:'hidden'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:13,padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
          <div style={{width:42,height:42,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
            font:'800 16px Inter,sans-serif',color:agent.color,background:agent.bg,border:`2px solid ${agent.border}`}}>
            {agent.initial}
          </div>
          <div style={{flex:1}}>
            <div style={{font:'700 17px Inter,sans-serif',color:'#fff'}}>{agent.label}</div>
            <div style={{font:'12px Inter,sans-serif',color:'#9FB0D8',marginTop:3}}>{agent.role}</div>
          </div>
          <button onClick={onClose} style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',
            borderRadius:8,cursor:'pointer',color:'#9FB0D8',fontSize:16,border:'1px solid rgba(255,255,255,.1)',background:'none'}}>✕</button>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
          {['activities','tasks','costs'].map(t=>{
            const active=tab===t;
            return <button key={t} onClick={()=>setTab(t)} style={{
              padding:'10px 20px',border:'none',cursor:'pointer',textTransform:'capitalize',
              background:active?`${agent.color}12`:'transparent',
              borderBottom:active?`2px solid ${agent.color}`:'2px solid transparent',
              font:`${active?700:400} 12px Inter,sans-serif`,color:active?agent.color:'#7E8DB5',transition:'all .15s'}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>;
          })}
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
          {loading && [1,2,3,4].map(i=><div key={i} className="cc-skel" style={{height:44,marginBottom:8}}/>)}
          {!loading && tab==='activities' && (acts.length===0
            ? <div style={{textAlign:'center',color:'#7E8DB5',padding:40,font:'13px Inter,sans-serif'}}>No recent activities</div>
            : acts.map((a,i)=>(
              <div key={i} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:i<acts.length-1?'1px solid rgba(255,255,255,.05)':'none',alignItems:'flex-start'}}>
                <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:`${agent.color}18`,
                  display:'flex',alignItems:'center',justifyContent:'center',font:'12px Inter,sans-serif',color:agent.color}}>
                  {(a.category||'A')[0].toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{font:'600 12px/1.3 Inter,sans-serif',color:'#EAF0FF',marginBottom:3}}>{a.title||a.description||'Activity'}</div>
                  <div style={{font:'10px Inter,sans-serif',color:'#7E8DB5'}}>{a.category} · {ago(a.created_at||a.timestamp)}</div>
                </div>
                {a.time_saved_min&&<span style={{font:'10px Inter,sans-serif',color:'#2DD4BF',padding:'2px 8px',borderRadius:20,background:'rgba(45,212,191,.1)',whiteSpace:'nowrap',flexShrink:0}}>-{a.time_saved_min}m</span>}
              </div>
            ))
          )}
          {!loading && tab==='tasks' && (tasks.length===0
            ? <div style={{textAlign:'center',color:'#7E8DB5',padding:40,font:'13px Inter,sans-serif'}}>No tasks found</div>
            : tasks.map((t,i)=>{
              const sc=t.status==='done'?'#2DD4BF':t.status==='in_progress'?'#06E5EC':t.status==='blocked'?'#EF4444':'#7E8DB5';
              return <div key={i} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:i<tasks.length-1?'1px solid rgba(255,255,255,.05)':'none',alignItems:'flex-start'}}>
                <span style={{width:8,height:8,borderRadius:'50%',marginTop:5,flexShrink:0,background:sc,boxShadow:`0 0 6px ${sc}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{font:'600 12px/1.3 Inter,sans-serif',color:'#EAF0FF',marginBottom:3}}>{t.title||t.task_title||'Task'}</div>
                  <div style={{font:'10px Inter,sans-serif',color:'#7E8DB5'}}>{t.category} · {t.status} · {ago(t.created_at)}</div>
                </div>
              </div>;
            })
          )}
          {!loading && tab==='costs' && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[['Today',costs.today],['This Month',costs.mtd],['All Time',costs.inception]].map(([l,v])=>(
                <div key={l} style={{textAlign:'center',padding:'14px 10px',borderRadius:10,
                  background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{font:`700 20px Inter,sans-serif`,color:agent.color}}>{fmtD(v)}</div>
                  <div style={{font:'9px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em',marginTop:6}}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sales Tab ───────────────────────────────────────────────────────────────
const MEETINGS_DATA = [
  {name:'CET Designer',pct:82},
  {name:'SAP ERP Consultant',pct:64},
  {name:'RCM Specialist',pct:48},
  {name:'Digital Ops',pct:30},
  {name:'BIM Modeler',pct:18},
];
const LOW_CAMPS = [
  {name:'Digital Ops / Automation',metric:'5.2%',reason:'ICP too broad - tighten to 3PL',color:'#F5B945'},
  {name:'AI Talent - General',metric:'3.1%',reason:'Offer unclear - rewrite value prop',color:'#F2667A'},
  {name:'BIM Modeler Outreach',metric:'4.8%',reason:'Low hiring signal in segment',color:'#F5B945'},
];
const CAMPAIGNS = [
  // Laura — Bold Business
  {num:1,sdr:'Laura',title:'Digital Ops / Automation Analyst',sub:'3PL / Freight Logistics · 50–500 employees · US',color:'#06E5EC'},
  {num:2,sdr:'Laura',title:'RCM Specialist',sub:'Hospitals, Health Systems & ASCs · 50–500 employees',color:'#4D8DFF'},
  {num:3,sdr:'Laura',title:'Senior Accountant / FP&A Analyst',sub:'PE Portfolio Companies · $100M–$2B AUM',color:'#8B7CF6'},
  {num:4,sdr:'Laura',title:'Enterprise ERP Consultant (SAP)',sub:'Manufacturing & Distribution · SAP ECC End of Life 2027',color:'#F5B945'},
  {num:5,sdr:'Laura',title:'AI Ops Analyst',sub:'B2B SaaS / Fintech / Insurtech · 50–300 employees',color:'#f97316'},
  {num:6,sdr:'Laura',title:'E-Commerce Analytics Analyst',sub:'D2C E-Commerce · Shopify/BigCommerce · >$5M GMV',color:'#f43f5e'},
  {num:7,sdr:'Laura',title:'Healthcare IT Support Analyst',sub:'Multi-location Practices, DSOs, PT/Urgent Care Chains',color:'#a78bfa'},
  {num:8,sdr:'Laura',title:'CET Designer / Space Planning Specialist',sub:'Commercial Furniture Dealers & AEC · 50–500 employees',color:'#3B82F6'},
  // Darren — Mercury Z
  {num:1,sdr:'Darren',title:'Fiber Optic Fusion Splicer / Field Technician',sub:'Fiber Carriers, ISPs, EPC Firms & Broadband Contractors',color:'#2DD4BF'},
  {num:2,sdr:'Darren',title:'Customer Success Operations Analyst',sub:'B2B SaaS / Subscription · Post-Series A · 30–300 employees',color:'#06E5EC'},
  {num:3,sdr:'Darren',title:'Finance & Accounting Ops Specialist',sub:'SMBs & PE-Backed Portfolio Companies · 15–200 employees',color:'#F5B945'},
  {num:4,sdr:'Darren',title:'HR & People Ops Coordinator',sub:'High-Growth Startups · Series A–C · 50–300 employees',color:'#f97316'},
  {num:5,sdr:'Darren',title:'Software QA / Test Ops Analyst',sub:'Product-Led SaaS · 30–300 employees · $3M–$50M ARR',color:'#8B7CF6'},
  {num:6,sdr:'Darren',title:'Sales Ops & CRM Admin Specialist',sub:'Inside Sales Teams · B2B · 20–250 employees',color:'#4D8DFF'},
  {num:7,sdr:'Darren',title:'DWDM / Optical Transport Engineer',sub:'Carriers, Hyperscale DCI, Fiber Operators · 400G/800G',color:'#f43f5e'},
  {num:8,sdr:'Darren',title:'NOC Engineer / Network Operations Center Analyst',sub:'Telecom Carriers, ISPs, Broadband Operators · 25–2,000',color:'#a78bfa'},
];
// PEOPLE is now dynamic — built from loaded briefs (see filteredCamps below)
const SEQUENCE = [
  {n:'1',title:'LinkedIn CR + Note',meta:'Day 1',body:'Hiring signal opener - personalized to role.',color:'#06E5EC'},
  {n:'2',title:'Email - Value prop',meta:'Day 3',body:'60% cost reduction hook + case study link.',color:'#5AC8FA'},
  {n:'3',title:'LinkedIn follow-up',meta:'Day 7',body:'Proof point - existing client + results.',color:'#2DD4BF'},
  {n:'4',title:'Final email - CTA',meta:'Day 14',body:'Calendly link + last-chance framing.',color:'#F5B945'},
];

const PERIODS=[{id:'today',label:'Today'},{id:'7d',label:'Last 7 days'},{id:'30d',label:'Last 30 days'},{id:'all',label:'All time'}];

// ─── Task List Section ─────────────────────────────────────────────────────
const STATUS_CFG={
  pending:   {label:'Pending',   color:'#F5B945', bg:'rgba(245,185,69,.12)'},
  captured:  {label:'Captured',  color:'#4D8DFF', bg:'rgba(77,141,255,.12)'},
  done:      {label:'Done',      color:'#2DD4BF', bg:'rgba(45,212,191,.12)'},
  dismissed: {label:'Dismissed', color:'#7E8DB5', bg:'rgba(126,141,181,.1)'},
};
const TASK_TYPES=['Next Action','Project'];
const HORIZONS=['Ground','Horizon 1','Horizon 2','Horizon 3','Horizon 4','Horizon 5'];

const TASK_PER_PAGE=10;
function TaskListSection({authHeaders}){
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filterStatus,setFilterStatus]=useState('all');
  const [search,setSearch]=useState('');
  const [taskPage,setTaskPage]=useState(0);
  const [modal,setModal]=useState(null); // null | {mode:'add'} | {mode:'edit', task}
  const [saving,setSaving]=useState(false);
  const BLANK={description:'',status:'pending',task_type:'Next Action',horizon:'Ground',
    accountable_person:'',due_date_suggestion:'',priority_score:'',details:''};
  const [form,setForm]=useState(BLANK);

  const load=()=>{
    setLoading(true);
    fetch('/api/user-tasks?limit=200',{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(j?.tasks) setTasks(j.tasks); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const openAdd=()=>{ setForm(BLANK); setModal({mode:'add'}); };
  const openEdit=(t)=>{ setForm({
    description:t.description||'', status:t.status||'pending',
    task_type:t.task_type||'Next Action', horizon:t.horizon||'Ground',
    accountable_person:t.accountable_person||'', due_date_suggestion:t.due_date_suggestion||'',
    priority_score:t.priority_score||'', details:t.details||'',
  }); setModal({mode:'edit',task:t}); };

  const handleSave=async(e)=>{
    e.preventDefault(); setSaving(true);
    try{
      const body={...form, priority_score:form.priority_score?Number(form.priority_score):null};
      const isEdit=modal.mode==='edit';
      const res=await fetch(isEdit?`/api/user-tasks/${modal.task.id}`:'/api/user-tasks',{
        method:isEdit?'PATCH':'POST',
        headers:{...authHeaders(),'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      if(res.ok){ setModal(null); load(); }
    }finally{ setSaving(false); }
  };

  const handleDelete=async(id)=>{
    if(!window.confirm('Delete this task?')) return;
    await fetch(`/api/user-tasks/${id}`,{method:'DELETE',headers:authHeaders()});
    setTasks(prev=>prev.filter(t=>t.id!==id));
  };

  const handleStatusToggle=async(task)=>{
    const next=task.status==='done'?'pending':'done';
    await fetch(`/api/user-tasks/${task.id}`,{
      method:'PATCH',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body:JSON.stringify({status:next}),
    });
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,status:next}:t));
  };

  const filtered=tasks
    .filter(t=>filterStatus==='all'||t.status===filterStatus)
    .filter(t=>!search||t.description.toLowerCase().includes(search.toLowerCase())||(t.accountable_person||'').toLowerCase().includes(search.toLowerCase()));
  const taskPages=Math.ceil(filtered.length/TASK_PER_PAGE);
  const pagedTasks=filtered.slice(taskPage*TASK_PER_PAGE,(taskPage+1)*TASK_PER_PAGE);

  const fi={width:'100%',boxSizing:'border-box',padding:'8px 12px',borderRadius:8,
    border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.04)',
    color:'#EAF0FF',font:'13px Inter,sans-serif',outline:'none'};
  const lbl={font:'600 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',
    color:'#7E8DB5',marginBottom:5,display:'block'};

  return (
    <div style={{marginTop:32,marginBottom:32}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div className="cc-sect-label" style={{marginBottom:0}}>Task list</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Search */}
          <div style={{position:'relative'}}>
            <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7E8DB5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e=>{ setSearch(e.target.value); setTaskPage(0); }} placeholder="Search tasks…"
              style={{paddingLeft:30,paddingRight:search?24:10,height:32,borderRadius:8,
                border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',
                color:'#EAF0FF',font:'13px Inter,sans-serif',outline:'none',width:180}}/>
            {search&&<span onClick={()=>{ setSearch(''); setTaskPage(0); }} style={{position:'absolute',right:8,top:'50%',
              transform:'translateY(-50%)',color:'#7E8DB5',cursor:'pointer',fontSize:14}}>×</span>}
          </div>
          {/* Status filter */}
          <select value={filterStatus} onChange={e=>{ setFilterStatus(e.target.value); setTaskPage(0); }}
            style={{height:32,padding:'0 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
              background:'rgba(255,255,255,.05)',color:'#EAF0FF',font:'12px Inter,sans-serif',outline:'none'}}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_CFG).map(([k,v])=>(
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Add button */}
          <button onClick={openAdd}
            style={{display:'inline-flex',alignItems:'center',gap:6,height:32,padding:'0 14px',
              borderRadius:8,border:'1px solid rgba(6,229,236,.4)',background:'rgba(6,229,236,.08)',
              color:'#06E5EC',font:'600 12px Inter,sans-serif',cursor:'pointer'}}>
            <span style={{fontSize:16,lineHeight:1}}>+</span> New Task
          </button>
        </div>
      </div>

      {/* Task cards */}
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,overflow:'hidden'}}>
        {/* Table header */}
        <div style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 100px 100px 130px',
          padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'rgba(2,8,32,.3)'}}>
          {['','Task / Description','Type','Horizon','Assigned to','Due','Status'].map((h,i)=>(
            <span key={i} style={{font:'600 10px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',color:'#7E8DB5'}}>{h}</span>
          ))}
        </div>

        {loading
          ? [1,2,3].map(i=>(
              <div key={i} style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                <div className="cc-skel" style={{height:16,width:'60%'}}/>
              </div>
            ))
          : filtered.length===0
            ? <div style={{padding:32,textAlign:'center',font:'13px Inter,sans-serif',color:'#7E8DB5'}}>
                {search||filterStatus!=='all'?'No matching tasks.':'No tasks yet. Click “+ New Task” to add one.'}
              </div>
            : pagedTasks.map(t=>{
                const sc=STATUS_CFG[t.status]||STATUS_CFG.pending;
                return (
                  <div key={t.id} style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 90px 100px 100px 130px',
                    alignItems:'center',padding:'11px 16px',
                    borderBottom:'1px solid rgba(255,255,255,.05)',
                    opacity:t.status==='dismissed'?.5:1,
                    transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {/* Checkbox */}
                    <span onClick={()=>handleStatusToggle(t)} style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{width:16,height:16,borderRadius:4,border:`2px solid ${t.status==='done'?'#2DD4BF':'rgba(255,255,255,.25)'}`,
                        background:t.status==='done'?'#2DD4BF':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
                        {t.status==='done'&&<svg width="9" height="9" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                      </span>
                    </span>
                    {/* Description + details */}
                    <div style={{minWidth:0,paddingRight:12}}>
                      <div style={{font:'13px Inter,sans-serif',color:t.status==='done'?'#7E8DB5':'#EAF0FF',
                        textDecoration:t.status==='done'?'line-through':'none',
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        title={t.description}>{t.description}</div>
                      {t.details&&(
                        <div style={{font:'11px/1.4 Inter,sans-serif',color:'#7E8DB5',
                          marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                          title={t.details}>{t.details}</div>
                      )}
                    </div>
                    {/* Type */}
                    <span style={{font:'11px Inter,sans-serif',color:'#9FB0D8'}}>{t.task_type||'—'}</span>
                    {/* Horizon */}
                    <span style={{font:'11px Inter,sans-serif',color:'#9FB0D8'}}>{t.horizon||'—'}</span>
                    {/* Assigned */}
                    <span style={{font:'11px Inter,sans-serif',color:'#9FB0D8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.accountable_person||'—'}</span>
                    {/* Due */}
                    <span style={{font:'11px Inter,sans-serif',color:t.due_date_suggestion?'#F5B945':'#7E8DB5'}}>{t.due_date_suggestion||'—'}</span>
                    {/* Status + actions */}
                    <span style={{display:'flex',alignItems:'center',gap:6,overflow:'visible'}}>
                      <span style={{font:'700 10px Inter,sans-serif',padding:'2px 8px',borderRadius:20,
                        color:sc.color,background:sc.bg,textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>
                        {sc.label}
                      </span>
                      <button onClick={()=>openEdit(t)} title="Edit"
                        style={{width:22,height:22,borderRadius:5,border:'1px solid rgba(255,255,255,.12)',
                          background:'rgba(255,255,255,.06)',color:'#9FB0D8',cursor:'pointer',fontSize:11,
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✎</button>
                      <button onClick={()=>handleDelete(t.id)} title="Delete"
                        style={{width:22,height:22,borderRadius:5,border:'1px solid rgba(242,102,122,.25)',
                          background:'rgba(242,102,122,.06)',color:'#F2667A',cursor:'pointer',fontSize:13,
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                    </span>
                  </div>
                );
              })
        }
      </div>

      {/* Count */}
      {!loading&&filtered.length>0&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
          <span style={{font:'11px Inter,sans-serif',color:'#7E8DB5'}}>
            {filtered.length} task{filtered.length!==1?'s':''}
            {filterStatus!=='all'?` · filtered by ${STATUS_CFG[filterStatus]?.label}`:''}
          </span>
          {taskPages>1&&<Pager page={taskPage} setPage={setTaskPage} total={filtered.length} perPage={TASK_PER_PAGE}/>}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={()=>setModal(null)}>
          <div style={{width:'100%',maxWidth:560,background:'#080f2a',border:'1px solid rgba(255,255,255,.12)',
            borderRadius:14,boxShadow:'0 40px 80px rgba(0,0,0,.7)',overflow:'hidden'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
              <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>
                {modal.mode==='edit'?'Edit Task':'New Task'}
              </div>
              <button onClick={()=>setModal(null)}
                style={{background:'none',border:'none',color:'#7E8DB5',fontSize:20,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <form onSubmit={handleSave} style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={lbl}>Description *</label>
                <textarea required rows={3} value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  style={{...fi,resize:'vertical',fontFamily:'Inter,sans-serif'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={lbl}>Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{...fi,height:38}}>
                    {Object.entries(STATUS_CFG).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Task Type</label>
                  <select value={form.task_type} onChange={e=>setForm(f=>({...f,task_type:e.target.value}))} style={{...fi,height:38}}>
                    {TASK_TYPES.map(t=>(<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Horizon</label>
                  <select value={form.horizon} onChange={e=>setForm(f=>({...f,horizon:e.target.value}))} style={{...fi,height:38}}>
                    {HORIZONS.map(h=>(<option key={h} value={h}>{h}</option>))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Assigned To</label>
                  <input value={form.accountable_person} onChange={e=>setForm(f=>({...f,accountable_person:e.target.value}))}
                    placeholder="e.g. Abhinanda" style={fi}/>
                </div>
                <div>
                  <label style={lbl}>Due</label>
                  <input value={form.due_date_suggestion} onChange={e=>setForm(f=>({...f,due_date_suggestion:e.target.value}))}
                    placeholder="e.g. today, ASAP, 2026-07-15" style={fi}/>
                </div>
                <div>
                  <label style={lbl}>Priority (1–100)</label>
                  <input type="number" min="1" max="100" value={form.priority_score}
                    onChange={e=>setForm(f=>({...f,priority_score:e.target.value}))} style={fi}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Details</label>
                <textarea rows={2} value={form.details} onChange={e=>setForm(f=>({...f,details:e.target.value}))}
                  style={{...fi,resize:'vertical',fontFamily:'Inter,sans-serif'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
                <button type="button" onClick={()=>setModal(null)}
                  style={{padding:'8px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
                    background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{padding:'8px 24px',borderRadius:8,border:'none',
                    background:saving?'rgba(6,229,236,.4)':'#06E5EC',
                    color:'#000814',font:'700 13px Inter,sans-serif',cursor:saving?'default':'pointer'}}>
                  {saving?'Saving…':modal.mode==='edit'?'Save Changes':'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

function SalesTab({modalAgent,setModalAgent}) {
  const [period,setPeriod]=useState('7d');

  // ── Sales overview calendar (sp = sales picker) ──
  const today=new Date();
  const [spOpen,setSpOpen]=useState(false);
  const [spY,setSpY]=useState(today.getFullYear());
  const [spM,setSpM]=useState(today.getMonth());
  const [spStart,setSpStart]=useState(null);
  const [spEnd,setSpEnd]=useState(null);
  const [spPhase,setSpPhase]=useState('start');
  const spRef=useRef();

  // ── SDR date-range picker + period pill state ──
  const [sdrPeriod,setSdrPeriod]=useState('7d');
  const [dpOpen,setDpOpen]=useState(false);
  const [dpY,setDpY]=useState(today.getFullYear());
  const [dpM,setDpM]=useState(today.getMonth());
  const [dpStart,setDpStart]=useState(null);
  const [dpEnd,setDpEnd]=useState(null);
  const [dpPhase,setDpPhase]=useState('start');
  const dpRef=useRef();

  // Sales effective params: calendar overrides pills
  const spEffectivePeriod = (spStart&&spEnd) ? 'all' : period;
  const spEffectiveStart  = (spStart&&spEnd) ? spStart : null;
  const spEffectiveEnd    = (spStart&&spEnd) ? spEnd   : null;

  // SDR effective params: calendar overrides pills
  const sdrEffectivePeriod = (dpStart&&dpEnd) ? 'all' : sdrPeriod;
  const sdrEffectiveStart  = (dpStart&&dpEnd) ? dpStart : null;
  const sdrEffectiveEnd    = (dpStart&&dpEnd) ? dpEnd   : null;

  // ─ All useState declarations before any hooks ─
  const [sbOpen,setSbOpen]=useState(null);
  const [sdrPage,setSdrPage]=useState(0);
  const [sbPage,setSbPage]=useState(0);
  const [sbSearch,setSbSearch]=useState('');
  const SDR_PER_PAGE=10;
  const SB_PER_PAGE=5;
  const FU_PER_PAGE=5;
  const [p1Page,setP1Page]=useState(0);
  const [p2Page,setP2Page]=useState(0);
  const [fu1Search,setFu1Search]=useState('');
  const [fu2Search,setFu2Search]=useState('');
  const [campIdx,setCampIdx]=useState(0);
  const [campEdits,setCampEdits]=useState({});   // overrides keyed by campIdx
  const [customCampaigns,setCustomCampaigns]=useState([]); // ALL briefs loaded from DB (built-ins + user-created)
  const [briefsLoading,setBriefsLoading]=useState(true); // loading state for DB briefs
  const [briefsSeeded,setBriefsSeeded]=useState(false); // whether built-ins have been seeded to DB
  const [deletedCampIndexes,setDeletedCampIndexes]=useState(new Set()); // kept for legacy compat — no longer primary
  const [briefEditOpen,setBriefEditOpen]=useState(false);
  const [briefNewOpen,setBriefNewOpen]=useState(false);
  // Drag-to-reorder state for campaign brief cards
  const [dragIdx,setDragIdx]=useState(null);
  const [dragOverIdx,setDragOverIdx]=useState(null);
  const [reorderMode,setReorderMode]=useState(false);
  const [briefToDelete,setBriefToDelete]=useState(null); // {_gi, _dbId, title} — drives confirm modal
  const [exportOpen,setExportOpen]=useState(false);
  const [seqOpen,setSeqOpen]=useState(null); // index of expanded sequence step
  const [sbReload,setSbReload]=useState(0);
  const [campModal,setCampModal]=useState(null);
  const [campSaving,setCampSaving]=useState(false);
  const [campError,setCampError]=useState('');
  const [campDeleting,setCampDeleting]=useState(null);
  const [sbCallModal,setSbCallModal]=useState(false); // standalone add-call-log from sandbox
  const [sbCallForm,setSbCallForm]=useState({
    account_id:'',campaign_name:'',contact_name:'',contact_title:'',contact_company:'',
    contact_linkedin:'',call_date:new Date().toISOString().split('T')[0],outcome:'completed',notes:'',
  });
  const [sbCallSaving,setSbCallSaving]=useState(false);
  const [sbCallCampNames,setSbCallCampNames]=useState([]); // campaign names for the selected SDR
  const [sbCallCampQ,setSbCallCampQ]=useState('');
  const [sbCallCampOpen,setSbCallCampOpen]=useState(false);
  const [campNames,setCampNames]=useState([]);       // all campaign names from Skylead
  const [campNameQ,setCampNameQ]=useState('');       // combobox search query
  const [campNameOpen,setCampNameOpen]=useState(false); // combobox dropdown open
  const [person,setPerson]=useState('All');
  const [syncing,setSyncing]=useState(false);
  const [syncDone,setSyncDone]=useState(false);
  const [repliesModal,setRepliesModal]=useState(null);
  const [repliesDrill,setRepliesDrill]=useState(null);
  const [callsModal,setCallsModal]=useState(null);
  const [callRecords,setCallRecords]=useState(null);
  const [addingCall,setAddingCall]=useState(false);
  const [editingCallId,setEditingCallId]=useState(null);
  const [callForm,setCallForm]=useState({
    campaign_name:'',contact_name:'',contact_title:'',contact_company:'',
    contact_linkedin:'',call_date:new Date().toISOString().split('T')[0],outcome:'completed',notes:'',
  });
  const [sbSyncDone,setSbSyncDone]=useState(false);

  const CAMP_FORM_BLANK={campaign_name:'',account_id:'',activity:'',target_icp:'',channel:'LinkedIn + Email',connections_requested:'',
    connection_requests_accepted:'',connection_replies:'',emails_sent:'',
    created_at:new Date().toISOString().split('T')[0]};

  // ─ Data hooks (all state declared above) ─
  const {data:sky,loading:skyLoad}=useSkyleadStats(spEffectivePeriod,spEffectiveStart,spEffectiveEnd);
  const {data:mtgBk,loading:mtgBkLoad}=useMeetingsBreakdown(spEffectivePeriod,spEffectiveStart,spEffectiveEnd);
  const {data:sdr,loading:sdrLoad}=useSdrPerf(sdrEffectivePeriod,sdrEffectiveStart,sdrEffectiveEnd);
  const {data:campRank,loading:campLoad}=useCampaignRank(spEffectivePeriod,spEffectiveStart,spEffectiveEnd);
  const {data:sbData,setData:setSbData,loading:sbLoad}=useSandbox(spEffectivePeriod,spEffectiveStart,spEffectiveEnd,sbReload);
  const {data:followUps,loading:followUpsLoad}=useFollowUps();

  const CAMP_COLORS_REF=['#06E5EC','#4D8DFF','#8B7CF6','#F5B945','#f97316','#f43f5e','#a78bfa','#3B82F6','#2DD4BF','#ec4899'];

  const loadBriefs=()=>{
    setBriefsLoading(true);
    fetch('/api/campaign-briefs',{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{
        if(!j?.briefs) return;
        const loaded=j.briefs.map((b,i)=>{
          const brief=b.brief_json||{};
          return {
            _dbId:     b.campaign_id,
            num:       i+1, // will be renumbered by display position
            sdr:       b.assignee||brief.sdr||'Laura',
            assignee:  b.assignee||brief.sdr||'Laura',
            title:     b.campaign_name,
            sub:       b.target_icp||brief.sub||'',
            color:     brief.color||CAMP_COLORS_REF[i%CAMP_COLORS_REF.length],
            sort_order:b.sort_order,
            hiring:    brief.hiring!==undefined ? brief.hiring : null,
            ...brief,
          };
        });
        setCustomCampaigns(loaded);
        setCampEdits(prev=>{
          const next={...prev};
          loaded.forEach((c,i)=>{ if(!next[i]) next[i]=c; });
          return next;
        });
      })
      .catch(()=>{})
      .finally(()=>setBriefsLoading(false));
  };

  useEffect(()=>{
    // Load briefs directly from DB — no seeding, DB is source of truth
    setBriefsSeeded(true);
    loadBriefs();
  },[]);

  // Reset pages when filters change
  useEffect(()=>{ setSdrPage(0); },[sdrEffectivePeriod,sdrEffectiveStart,sdrEffectiveEnd]);
  useEffect(()=>{ setSbPage(0); setSbOpen(null); },[spEffectivePeriod,spEffectiveStart,spEffectiveEnd,sbReload]);
  useEffect(()=>{ setSeqOpen(null); },[campIdx]);
  useEffect(()=>{
    // When person filter changes, jump to first campaign in that filter
    const first=person==='All'?0:customCampaigns.findIndex(c=>(c.sdr||c.assignee)===person);
    setCampIdx(first>=0?first:0);
  },[person]);

  const openAddCamp=()=>setCampModal({mode:'add',form:{...CAMP_FORM_BLANK}});
  const openEditCamp=(c,agent)=>setCampModal({
    mode:'edit',
    campaign_id: agent.campaign_id,
    form:{
      campaign_name:                c.name,
      account_id:                   String(agent.account_id),
      activity:                     agent.activity||'',
      target_icp:                   c.target_icp||'',
      channel:                      c.channel||'LinkedIn + Email',
      connections_requested:        String(agent.cr_sent||0),
      connection_requests_accepted: String(agent.cr_accepted||0),
      connection_replies:           String(agent.replies||0),
      emails_sent:                  String(agent.emails||0),
      created_at:                   new Date().toISOString().split('T')[0],
    },
  });

  const handleSaveCamp=async(e)=>{
    e.preventDefault(); setCampSaving(true); setCampError('');
    try{
      const {mode,campaign_id,form}=campModal;
      const body={...form,
        account_id:                   Number(form.account_id),
        connections_requested:        Number(form.connections_requested)||0,
        connection_requests_accepted: Number(form.connection_requests_accepted)||0,
        connection_replies:           Number(form.connection_replies)||0,
        emails_sent:                  Number(form.emails_sent)||0,
      };
      const url=mode==='edit'
        ?`/api/sales-dashboard/campaigns/${campaign_id}`
        :'/api/sales-dashboard/campaigns';
      const res=await fetch(url,{
        method:mode==='edit'?'PATCH':'POST',
        headers:{...authHeaders(),'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      if(res.ok){
        const saved=await res.json().catch(()=>({}));
        const {mode,campaign_id:editId,form}=campModal;
        const SDR_NAMES={32887:'Abhinanda Deb',32871:'Lenore Kopko',32894:'George Georgiou',32891:'Laura Petersen',32893:'Darren Stuart',33364:'Mariana Lopez',33347:'Bob Toll'};
        const aid=Number(form.account_id);
        const agentName=SDR_NAMES[aid]||'Unknown';
        if(mode==='add'){
          // Inject new campaign directly into local state — no re-fetch needed.
          // The row is already in the DB; re-fetching just risks it being filtered out by date.
          const newCamp={
            name:       form.campaign_name,
            target_icp: form.target_icp||'',
            channel:    form.channel||'LinkedIn + Email',
            is_manual:  true,
            reply_pct:  0,
            key_metric: '0% reply rate',
            agents:[{agent:agentName,account_id:aid,campaign_id:saved.campaign_id||editId,
              activity:form.activity||'',cr_sent:Number(form.connections_requested)||0,
              cr_accepted:Number(form.connection_requests_accepted)||0,
              replies:Number(form.connection_replies)||0,emails:Number(form.emails_sent)||0,
              li_out:0,calls:0,actual_meetings:0,campaigns:1,accept_pct:'—',reply_pct:'—'}],
            totals:{cr_sent:Number(form.connections_requested)||0,cr_accepted:Number(form.connection_requests_accepted)||0,
              replies:Number(form.connection_replies)||0,emails:Number(form.emails_sent)||0,
              li_out:0,calls:0,actual_meetings:0,campaigns:1,accept_pct:'—',reply_pct:'—'},
          };
          setSbData(prev=>({ ...(prev||{}), campaigns:[newCamp,...((prev?.campaigns)||[])] }));
        } else {
          // Edit: just trigger a re-fetch so stats are accurate
          setSbReload(k=>k+1);
        }
        setCampModal(null); setCampNameOpen(false); setCampNameQ(''); setSbOpen(null);
      } else {
        const errData=await res.json().catch(()=>({}));
        setCampError(errData.error||`Save failed (HTTP ${res.status}). Please try again.`);
      }
    }catch(err){
      setCampError(err.message||'Network error. Please check your connection and try again.');
    }finally{setCampSaving(false);}
  };

  const handleDeleteCamp=async(campaign_id)=>{
    if(!window.confirm('Delete this campaign? This cannot be undone.')) return;
    setCampDeleting(campaign_id);
    try{
      await fetch(`/api/sales-dashboard/campaigns/${campaign_id}`,{method:'DELETE',headers:authHeaders()});
      setSbOpen(null); setSbReload(k=>k+1);
    }finally{setCampDeleting(null);}
  };
  // Load campaign names when modal opens or account changes
  useEffect(()=>{
    if(!campModal) return;
    const aid=campModal.form.account_id;
    const url=aid
      ?`/api/skylead/campaign-names?account_id=${aid}`
      :'/api/skylead/campaign-names';
    fetch(url,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(j?.names) setCampNames(j.names); })
      .catch(()=>{});
  },[campModal?.form?.account_id, campModal!=null]);

  // Load campaign names for sb call log when account changes
  useEffect(()=>{
    if(!sbCallModal||!sbCallForm.account_id) return;
    fetch(`/api/skylead/campaign-names?account_id=${sbCallForm.account_id}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(j?.names) setSbCallCampNames(j.names); })
      .catch(()=>{});
  },[sbCallModal,sbCallForm.account_id]);

  const handleSbCallSubmit=async(e)=>{
    e.preventDefault(); setSbCallSaving(true);
    try{
      const res=await fetch('/api/sales-dashboard/call-records',{
        method:'POST',
        headers:{...authHeaders(),'Content-Type':'application/json'},
        body:JSON.stringify({...sbCallForm,account_id:Number(sbCallForm.account_id)||null}),
      });
      if(res.ok){
        const rec=await res.json();
        setCallRecords(prev=>[rec,...(prev||[])]);
        setSbCallModal(false);
        setSbCallForm({
          account_id:'',campaign_name:'',contact_name:'',contact_title:'',contact_company:'',
          contact_linkedin:'',call_date:new Date().toISOString().split('T')[0],outcome:'completed',notes:'',
        });
        setSbCallCampNames([]);
        setSbCallCampQ('');
      }
    }finally{setSbCallSaving(false);}
  };

  const handleSync=async()=>{
    if(syncing||syncDone) return;
    setSyncing(true);
    try{
      const r=await fetch('/api/skylead/trigger-sync',{method:'POST',headers:authHeaders()});
      if(r.ok){
        setSyncing(false);
        setSyncDone(true);
        setTimeout(()=>setSyncDone(false), 3000); // revert after 3s
      } else {
        setSyncing(false);
      }
    }catch(e){
      setSyncing(false);
    }
  };

  // close pickers on outside click
  useEffect(()=>{
    if(!dpOpen)return;
    const h=e=>{ if(dpRef.current&&!dpRef.current.contains(e.target)) setDpOpen(false); };
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[dpOpen]);
  useEffect(()=>{
    if(!spOpen)return;
    const h=e=>{ if(spRef.current&&!spRef.current.contains(e.target)) setSpOpen(false); };
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[spOpen]);

  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDp=d=>{ if(!d)return''; const [,m,dd]=d.split('-'); return `${MONTHS_SHORT[+m-1]} ${+dd}`; };

  // ── SDR picker helpers ──
  const dpLabel=dpStart&&dpEnd?`${fmtDp(dpStart)} — ${fmtDp(dpEnd)}`:dpStart?`${fmtDp(dpStart)} — select end`:'Custom range';

  const dpWeeks=(()=>{
    const first=new Date(dpY,dpM,1).getDay();
    const days=new Date(dpY,dpM+1,0).getDate();
    const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];
    const weeks=[];
    for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
    return weeks;
  })();

  const dpPickDay=day=>{
    if(!day)return;
    const iso=`${dpY}-${String(dpM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(dpPhase==='start'){ setDpStart(iso); setDpEnd(null); setDpPhase('end'); }
    else{ if(iso<dpStart){ setDpStart(iso); setDpPhase('end'); } else{ setDpEnd(iso); setDpPhase('start'); setDpOpen(false); } }
  };

  const dpDayStyle=day=>{
    if(!day)return{visibility:'hidden'};
    const iso=`${dpY}-${String(dpM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isSt=iso===dpStart, isEn=iso===dpEnd;
    const inRange=dpStart&&dpEnd&&iso>dpStart&&iso<dpEnd;
    return{
      width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
      margin:'1px auto',cursor:'pointer',fontSize:13,fontFamily:'Inter,sans-serif',
      background:isSt||isEn?'#4446DB':inRange?'rgba(68,70,219,.15)':'transparent',
      color:isSt||isEn?'#fff':inRange?'#4446DB':'#1F2A44',
      fontWeight:isSt||isEn?700:400,
    };
  };

  // ── Sales picker helpers (sp) ──
  const spLabel=spStart&&spEnd?`${fmtDp(spStart)} — ${fmtDp(spEnd)}`:spStart?`${fmtDp(spStart)} — select end`:'Custom range';

  const spWeeks=(()=>{
    const first=new Date(spY,spM,1).getDay();
    const days=new Date(spY,spM+1,0).getDate();
    const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];
    const weeks=[];
    for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
    return weeks;
  })();

  const spPickDay=day=>{
    if(!day)return;
    const iso=`${spY}-${String(spM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(spPhase==='start'){ setSpStart(iso); setSpEnd(null); setSpPhase('end'); }
    else{ if(iso<spStart){ setSpStart(iso); setSpPhase('end'); } else{ setSpEnd(iso); setSpPhase('start'); setSpOpen(false); } }
  };

  const spDayStyle=day=>{
    if(!day)return{visibility:'hidden'};
    const iso=`${spY}-${String(spM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isSt=iso===spStart, isEn=iso===spEnd;
    const inRange=spStart&&spEnd&&iso>spStart&&iso<spEnd;
    return{
      width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
      margin:'1px auto',cursor:'pointer',fontSize:13,fontFamily:'Inter,sans-serif',
      background:isSt||isEn?'#4446DB':inRange?'rgba(68,70,219,.15)':'transparent',
      color:isSt||isEn?'#fff':inRange?'#4446DB':'#1F2A44',
      fontWeight:isSt||isEn?700:400,
    };
  };

  // ── SDR modal state ──
  // (repliesModal, repliesDrill, callsModal, callRecords, addingCall, editingCallId, callForm declared above)
  const startEditCall=(r)=>{
    setEditingCallId(r.id);
    setCallForm({
      campaign_name:   r.campaign_name   ||'',
      contact_name:    r.contact_name    ||'',
      contact_title:   r.contact_title   ||'',
      contact_company: r.contact_company ||'',
      contact_linkedin:r.contact_linkedin||'',
      call_date:       r.call_date?(r.call_date.split?.('T')[0]||r.call_date):'',
      outcome:         r.outcome         ||'completed',
      notes:           r.notes           ||'',
    });
  };
  const cancelEditCall=()=>{
    setEditingCallId(null);
    setCallForm({campaign_name:'',contact_name:'',contact_title:'',contact_company:'',
      contact_linkedin:'',call_date:new Date().toISOString().split('T')[0],outcome:'completed',notes:''});
  };

  // Fetch call records whenever the modal opens, using the period embedded in the modal object
  useEffect(()=>{
    if(!callsModal) return;
    const p=new URLSearchParams();
    if(callsModal._period) p.set('period',callsModal._period);
    if(callsModal._start)  p.set('startDate',callsModal._start);
    if(callsModal._end)    p.set('endDate',callsModal._end);
    fetch(`/api/skylead/sdr-summary?${p}`,{headers:authHeaders()})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(j?.call_records) setCallRecords(j.call_records); })
      .catch(()=>{});
  },[callsModal]);

  const callModalRecords=callsModal&&callRecords
    ?(()=>{
        const list=callsModal.campaign_list||[];
        // Sandbox: single campaign — filter strictly by campaign_name
        if(list.length===1){
          const name=list[0].campaign_name;
          return name
            ?callRecords.filter(r=>r.campaign_name===name)
            :callRecords.filter(r=>r.account_id===callsModal.account_id);
        }
        // SDR table: multiple campaigns — filter by account_id
        // (call_records already date-filtered by the API)
        return callRecords.filter(r=>r.account_id===callsModal.account_id);
      })()
    :[];

  const handleAddCall=async(e)=>{
    e.preventDefault(); setAddingCall(true);
    try{
      if(editingCallId){
        // Edit mode — PATCH existing record
        const res=await fetch(`/api/sales-dashboard/call-records/${editingCallId}`,{
          method:'PATCH',
          headers:{...authHeaders(),'Content-Type':'application/json'},
          body:JSON.stringify(callForm),
        });
        if(res.ok){
          const updated=await res.json();
          setCallRecords(prev=>(prev||[]).map(r=>r.id===editingCallId?updated:r));
          cancelEditCall();
        }
      } else {
        // Add mode — POST new record
        const res=await fetch('/api/sales-dashboard/call-records',{
          method:'POST',
          headers:{...authHeaders(),'Content-Type':'application/json'},
          body:JSON.stringify({...callForm,account_id:callsModal?.account_id}),
        });
        if(res.ok){
          const rec=await res.json();
          setCallRecords(prev=>[rec,...(prev||[])]);
          setCallForm(p=>({...p,contact_name:'',contact_title:'',contact_company:'',contact_linkedin:'',notes:''}));
        }
      }
    }finally{setAddingCall(false);}
  };

  const handleDeleteCall=async(id)=>{
    if(!window.confirm('Delete this call record?'))return;
    await fetch(`/api/sales-dashboard/call-records/${id}`,{method:'DELETE',headers:authHeaders()});
    setCallRecords(prev=>(prev||[]).filter(r=>r.id!==id));
  };

  const s=sky||{};
  const v=l=>skyLoad?<span className="cc-skel" style={{display:'inline-block',width:60,height:40}}/>:l;

  const CAMP_DEFAULTS=[
    // L1 — Digital Ops / Automation Analyst
    {icp:[{label:'Industry',value:'3PL / Freight Logistics'},{label:'Company Size',value:'50–500 employees'},{label:'Geography',value:'US'},{label:'Tech Stack',value:'McLeod / TMW / MercuryGate TMS · Power Automate · Zapier'},{label:'Revenue',value:'$10M–$200M'},{label:'Trigger',value:'PE-backed or recent acquisition'}],
     personas:['COO / VP Ops (primary)','Director of Freight Ops','Director of Transportation','Head of Last-Mile','VP of Technology','GM'],
     signals:['Apollo: Logistics & SC, COO/VP Ops, 50–500 employees','Job postings for Ops Coordinator or Logistics Analyst at 3PLs','Intent data on freight automation / TMS integration','PE-backed 3PLs acquired in last 24 months'],
     hook:'Manual freight exception tracking, check-calls, appointment scheduling, and detention billing eat 3–5 hrs/dispatcher/day. Labor scales linearly until someone automates it.',
     valueProp:'Offshore Digital Ops Analyst who maps workflows and builds automations using existing tools (Power Automate, Zapier, TMS APIs) at a fraction of onshore cost — in-seat within 2–3 weeks.'},
    // L2 — RCM Specialist
    {icp:[{label:'Industry',value:'Hospitals, Health Systems & ASCs'},{label:'Company Size',value:'50–500 employees'},{label:'Geography',value:'US'},{label:'Tech Stack',value:'Epic · Cerner · athenahealth · Meditech'},{label:'Revenue',value:'$20M–$300M NPR'},{label:'Trigger',value:'AR days >50, denial rate >8%, RCM turnover'}],
     personas:['VP / Director of Revenue Cycle (primary)','Director of Patient Financial Services','CFO / VP Finance','Director of Coding & Billing / HIM','COO','CEO / Administrator'],
     signals:['Apollo: Hospital & HC, 50–500, Director of Revenue Cycle','Job postings for RCM Specialist / Denial Management / Prior Auth Specialist','HFMA member directory'],
     hook:'RCM turnover runs 30–40% annually. Prior auth requirements up 20%+ YoY. Onshore RCM hires cost $45K–$70K and take 60–90 days, leaving cash on the table.',
     valueProp:'Dedicated offshore RCM Specialists — ICD-10 certified, trained on Epic/Cerner/Meditech — handling denial management, prior auth follow-up, AR recovery. In-seat 2–3 weeks at 40–55% of onshore cost.'},
    // L3 — Senior Accountant / FP&A Analyst
    {icp:[{label:'Industry',value:'PE Portfolio Companies'},{label:'Company Size',value:'PE firms · 5–20 portfolio companies'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'NetSuite · QuickBooks · Sage Intacct'},{label:'Revenue',value:'$100M–$2B AUM'},{label:'Trigger',value:'0–24 months post-acquisition'}],
     personas:['Operating Partner / VP Portfolio Ops (primary)','Chief of Staff / Portfolio COO','Principal / Sr. Associate Ops','CFO / VP Finance at portco','Controller','Head of Finance Transformation'],
     signals:['Pitchbook / Crunchbase: PE firms with deals closed last 12 months','LinkedIn: Operating Partner / VP Portfolio Ops at PE firms','Portfolio company financial standup signals'],
     hook:'PE firms close a deal and immediately need financial standup in 100 days. Onshore accounting takes 60–90 days to recruit at $90K–$130K/yr. One OP relationship = 5–15 placements over a fund cycle.',
     valueProp:'Dedicated offshore Senior Accountants / FP&A Analysts inside portco ERP systems within 2 weeks at 40–60% of onshore cost.'},
    // L4 — Enterprise ERP Consultant (SAP)
    {icp:[{label:'Industry',value:'Manufacturing & Distribution'},{label:'Company Size',value:'200–1,000 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'SAP ECC 6.0 (no S/4HANA migration started)'},{label:'Revenue',value:'$50M–$500M'},{label:'Trigger',value:'SAP ECC End of Life — January 2027'}],
     personas:['CIO / VP IT / Director IT (primary)','Director Enterprise Apps / Head of Business Systems','SAP Program Manager','Director of Digital Transformation','CFO','COO / VP Ops'],
     signals:['ZoomInfo / Apollo: Mfg/Distribution, 200–1K, SAP ECC in tech stack','Job postings for SAP Basis Admin / FICO Analyst / ERP PM','Intent data on SAP migration / S4HANA','G2 / Gartner SAP ECC reviewers'],
     hook:'SAP ends Extended Maintenance for ECC 6.0 in January 2027. Onshore SAP consultant day rates at $250–$400/hr at peak saturation. 18-month window creates natural urgency.',
     valueProp:'Certified SAP S/4HANA consultants (FICO, MM, PP, SD, WM) embedded into migration programs at 50–65% of onshore day rates. Greenfield, brownfield, selective data transition.'},
    // L5 — AI Ops Analyst
    {icp:[{label:'Industry',value:'B2B SaaS / Fintech / Insurtech'},{label:'Company Size',value:'50–300 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'OpenAI · LangChain · Pinecone · Weaviate'},{label:'Revenue',value:'$5M–$100M ARR'},{label:'Trigger',value:'AI feature live in production, no dedicated AI Ops hire'}],
     personas:['VP / Director of Engineering (primary)','CTO (<100 employees)','Head of AI / Director of ML','Director of Platform Engineering','Chief AI Officer','Head of Product'],
     signals:['Apollo: B2B SaaS, 50–300, OpenAI / LangChain stack','LinkedIn: “AI-powered” in product description, no ML Engineer on staff','ProductHunt / G2: recent AI launches','Job postings for ML Engineer at small SaaS'],
     hook:'Companies with AI in production hit “Day 2” problems — model drift, prompt failures, hallucinations, API cost blowouts, monitoring gaps. Onshore AI Ops costs $140K–$180K.',
     valueProp:'Dedicated offshore AI Ops Analysts who monitor LLM pipeline performance, manage prompt versioning, track model drift, handle vector DB maintenance, and optimize API costs — at 50% of onshore cost.'},
    // L6 — E-Commerce Analytics Analyst
    {icp:[{label:'Industry',value:'D2C E-Commerce · Shopify/BigCommerce brands'},{label:'Company Size',value:'20–200 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Shopify · Klaviyo · GA4 · Meta Ads'},{label:'Revenue',value:'>$5M GMV'},{label:'Trigger',value:'VC/PE funded last 24 months or Shopify Plus tier'}],
     personas:['COO / Head of E-Commerce Ops (primary)','VP / Director of Growth','Director of Performance Marketing / Head of Paid Acquisition','Head of Analytics / BI Manager','CFO','Founder / CEO'],
     signals:['Shopify Plus brand list','Apollo: Retail/E-Commerce, 20–200, Shopify+Klaviyo+GA4','Job postings for Data / E-Commerce / Growth Analyst','Crunchbase: VC-backed D2C Series A/B last 24 months'],
     hook:'D2C brands above $5M GMV making inventory and ad spend decisions on gut feel. Data sits disconnected across Shopify, Klaviyo, GA4, Meta Ads. Onshore data analyst costs $70K–$100K.',
     valueProp:'Dedicated offshore E-Commerce Analytics Analysts who build and maintain dashboards, cohort reports, LTV models, ad attribution reporting — embedded into Shopify/Klaviyo/GA4/Meta — updated weekly.'},
    // L7 — Healthcare IT Support Analyst
    {icp:[{label:'Industry',value:'Multi-location Practices, DSOs, PT/Urgent Care Chains'},{label:'Company Size',value:'3–30 locations'},{label:'Geography',value:'US'},{label:'Tech Stack',value:'Epic · Athena · eClinicalWorks · Dentrix · Curve'},{label:'Revenue',value:'$5M–$50M'},{label:'Trigger',value:'Recent acquisition or IT support job postings'}],
     personas:['Practice Administrator / Office Manager (primary)','Director / VP of Operations','VP / Director of IT','Regional Director','COO','Director of Clinical Informatics / EHR Administrator'],
     signals:['Apollo: Healthcare/Medical Practice, multi-location, Practice Admin/Dir Ops','Job postings for IT Support / Help Desk / EHR Specialist at medical groups','Glassdoor staff reviews mentioning EHR issues','Cross-target with Campaign c2 DSO list'],
     hook:'Multi-location practices share one overwhelmed IT person across 5–10 locations. Onshore IT support costs $60K–$90K/technician. First response is always a voicemail.',
     valueProp:'Dedicated offshore Healthcare IT Support Analysts — trained on Epic/Athena/Dentrix, HIPAA-compliant, US business hours — handling Tier 1/2 tickets, user onboarding, EHR troubleshooting, device mgmt at 40–60% of onshore cost.'},
    // L8 — CET Designer
    {icp:[{label:'Industry',value:'Contract Furniture Dealerships'},{label:'Company Size',value:'50–500 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'CET Commercial Interiors · ProjectMatrix · e-automate'},{label:'Revenue',value:'$2M–$30M'},{label:'Trigger',value:'Project volume spike / space plan backlog'}],
     personas:['President / Owner / Principal (primary)','VP / Director of Sales','Design Manager / Director of Design','COO / Director of Operations','Project Manager','AE / Senior AE'],
     signals:['LinkedIn title search for “CET Designer” / “Space Planner” to identify ICP companies','Manufacturer dealer locators (Steelcase, Haworth, MillerKnoll)','Apollo: Office Furniture/Commercial Interiors, 50–500, President/Owner/VP Sales','Job postings for CET Designer / Space Planner'],
     hook:'CET-proficient designers are scarce and slow to hire onshore ($55K–$80K, 60–90 day ramp). When project volume spikes, space plans pile up and proposals go out late. One delayed RFP can cost a $200K–$500K project.',
     valueProp:'Dedicated offshore CET Designer / Space Planning Specialists — trained in CET Designer (Configura), AutoCAD, furniture specification — handling floor plans, space plans, finish/fabric spec, proposal drawings. In-seat 2–3 weeks at 40–55% of onshore cost.'},
    // D1 — Fiber Optic Fusion Splicer
    {icp:[{label:'Industry',value:'Fiber Carriers, ISPs, EPC Firms, BEAD Awardees'},{label:'Company Size',value:'50–5,000+ employees'},{label:'Geography',value:'US'},{label:'Tech Stack',value:'SM/MM/Ribbon/FTTX · Aerial/Underground'},{label:'Revenue',value:'$5M–$500M+'},{label:'Trigger',value:'BEAD buildout / 400G expansion / fusion splicer job postings'}],
     personas:['Director / VP of Field Operations (primary)','VP / Director of Network Construction','VP / Director of Engineering','Program / Project Manager – Fiber Deployment','HR Director / Talent Acquisition','Director of Field Services'],
     signals:['LinkedIn job postings for Fusion Splicer / OSP Technician','BEAD award recipients in active deployment phase','FTTH / FTTX build announcements','Repeat postings open 30+ days'],
     hook:'Certified BICSI/FOA fusion splicers are in critical short supply nationally. BEAD buildouts running concurrently across 40+ states. Demand projects 58K new fiber tech positions by 2032 with ~178K worker shortfall.',
     valueProp:'National bench of deployment-ready fusion splicers — BICSI/FOA certified, SM/MM/ribbon/FTTX/aerial/underground — deployable in 1–2 weeks vs. 6–12 week hiring cycle. 600+ nationwide infrastructure professionals. Variable project cost, no FTE overhead.'},
    // D2 — Customer Success Operations Analyst
    {icp:[{label:'Industry',value:'B2B SaaS, HR Tech, Legal Tech, PropTech'},{label:'Company Size',value:'30–300 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Gainsight · ChurnZero · Salesforce · Zendesk · Intercom'},{label:'Revenue',value:'$3M–$50M ARR'},{label:'Trigger',value:'NRR below 110%, churn spike, CS team overwhelmed'}],
     personas:['VP / Director of Customer Success (primary)','Chief Customer Officer','Director of CS Ops','VP of Renewals','COO / Head of Operations','Head of Onboarding / Director of Implementation'],
     signals:['Apollo: B2B SaaS, 30–300, VP/Dir of CS','Job postings for CS Coordinator / CS Ops Analyst','Gainsight / ChurnZero users on G2'],
     hook:'CSMs spend 40–50% of their time on operational tasks instead of customer relationships. One churn event costs 12× the monthly contract value in recovery effort.',
     valueProp:'Dedicated offshore CS Ops Analysts — health score monitoring, QBR deck prep, renewal calendar management, onboarding task tracking, Gainsight/Salesforce hygiene — at 40–55% of onshore cost. In-seat within 2 weeks.'},
    // D3 — Finance & Accounting Ops Specialist
    {icp:[{label:'Industry',value:'Professional Services, Agency, Construction, Retail'},{label:'Company Size',value:'15–200 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'QuickBooks · Xero · NetSuite · Sage'},{label:'Revenue',value:'$3M–$50M'},{label:'Trigger',value:'Controller vacancy, bookkeeper turnover, month-end close delays'}],
     personas:['CEO / Owner / Founder (primary)','CFO / VP Finance','Controller / Director of Accounting','COO / Director of Operations','Managing Partner','Operating Partner (PE)'],
     signals:['Apollo: Professional Services/Agency/Construction, 15–200, CEO/CFO/Controller','Job postings for Bookkeeper / Staff Accountant','PE portco signals via Pitchbook'],
     hook:'SMBs bleed cash when bookkeepers quit. Month-end close slips 2–4 weeks. Hiring onshore takes 60–90 days at $55K–$80K/yr for a role that’s 80% transaction processing.',
     valueProp:'Dedicated offshore Finance & Accounting Ops Specialists — QuickBooks/Xero/NetSuite — handling AP/AR, bank reconciliation, month-end close, payroll support. In-seat 2 weeks at 45–60% of onshore cost.'},
    // D4 — HR & People Ops Coordinator
    {icp:[{label:'Industry',value:'SaaS, Fintech, HealthTech, Consumer Tech'},{label:'Company Size',value:'50–300 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Workday · BambooHR · Rippling · Gusto · Greenhouse'},{label:'Revenue',value:'$5M–$100M ARR'},{label:'Trigger',value:'Hiring surge >10 hires/quarter, solo HRBP stretched'}],
     personas:['VP of People / Head of People (primary)','Solo HRBP','Director of Talent / Director of Recruiting','CPO','COO / Head of Operations','CEO / Co-Founder (<50 employees)'],
     signals:['Apollo: SaaS/Fintech/HealthTech, 50–300, VP People/HRBP','Job postings for HR Coordinator / People Ops Coordinator','Greenhouse users on G2','Series A/B funding announcements'],
     hook:'Solo HR team at a 100-person startup doing recruiting coordination, onboarding, benefits admin, compliance, and HRIS simultaneously. Onboarding slips — new hires start with no laptop, no access, no manager meeting.',
     valueProp:'Dedicated offshore HR & People Ops Coordinators — BambooHR/Rippling/Greenhouse/Workday — handling onboarding workflows, HRIS data entry, benefits enrollment coordination, recruiting scheduling. In-seat 2 weeks at 45–60% of onshore cost.'},
    // D5 — Software QA / Test Ops Analyst
    {icp:[{label:'Industry',value:'B2B SaaS, Developer Tools, Productivity SaaS'},{label:'Company Size',value:'30–300 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Jira · TestRail · Selenium · Playwright · Postman · GitHub Actions'},{label:'Revenue',value:'$3M–$50M ARR'},{label:'Trigger',value:'Shipping bugs in prod, no dedicated QA hire'}],
     personas:['VP / Director of Engineering (primary)','Head of QA / Director of QA','CTO (<80 employees)','Head of Product / VP Product','Engineering Manager','Director of Platform'],
     signals:['Apollo: B2B SaaS, 30–300, VP/Dir Engineering','Job postings for QA Engineer / SDET','G2: Jira/TestRail users with no QA role on LinkedIn','GitHub: repos with no test coverage'],
     hook:'QA is either non-existent or done by engineers who resent it. One bad release costs 5–10× the QA hire in churn. Onshore QA engineers cost $90K–$130K and are hard to hire.',
     valueProp:'Dedicated offshore QA / Test Ops Analysts — Selenium/Playwright/TestRail/Jira/Postman — owning regression test suites, manual exploratory testing, API testing, bug triage. In-seat 2 weeks at 50–65% of onshore cost.'},
    // D6 — Sales Ops & CRM Admin Specialist
    {icp:[{label:'Industry',value:'B2B SaaS, Professional Services, Insurance, Financial Services'},{label:'Company Size',value:'20–250 employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Salesforce · HubSpot · Outreach · Salesloft · ZoomInfo'},{label:'Revenue',value:''},{label:'Trigger',value:'CRM data quality issues, job posting for Sales Ops or Salesforce Admin'}],
     personas:['VP / Director of Sales (primary)','Head of Sales Ops / Director of Sales Ops','Revenue Ops Manager / Director of RevOps','CRO','Salesforce Admin / Business Systems Manager','CEO / Founder (<50 employees)'],
     signals:['Apollo: B2B SaaS/Prof Services, 20–250, VP Sales/Sales Ops','Job postings for Sales Ops / Salesforce Admin','Salesforce AppExchange: companies adopting Outreach/Salesloft','G2: Salesforce/HubSpot users reviewing CRM pain points'],
     hook:'AEs spend 20–30% of their week on CRM hygiene and admin. Salesforce Admin costs $80K–$110K onshore; Sales Ops Analyst $70K–$95K. Most mid-market teams can’t afford both.',
     valueProp:'Dedicated offshore Sales Ops & CRM Admin Specialists — Salesforce/HubSpot/Outreach/Salesloft — owning CRM data hygiene, pipeline reporting, lead routing, sequence management, sales admin workflows. In-seat 2 weeks at 45–60% of onshore cost.'},
    // D7 — DWDM / Optical Transport Engineer
    {icp:[{label:'Industry',value:'Tier 1/2 Carriers, Fiber Operators, Hyperscale DCI, MSPs'},{label:'Company Size',value:'100–5,000+ employees'},{label:'Geography',value:'US + Canada'},{label:'Tech Stack',value:'Ciena · Nokia · Infinera · Fujitsu · 400G/800G'},{label:'Revenue',value:'$50M–$5B+'},{label:'Trigger',value:'400G/800G modernization, AI traffic explosion, SONET/TDM sunset'}],
     personas:['VP / Director of Network Engineering / VP of Transport (primary)','Director of Optical Transport / DWDM','Director of Data Center Infrastructure','VP of Network Architecture','CTO / VP Technology (regional operators)','Network Program Manager'],
     signals:['Job postings for DWDM Engineer / Optical Transport Engineer / OTN Engineer','400G / 800G upgrade announcements','DCI expansion / new data center campus announcements','SONET/TDM sunset programs underway','Contract listings on Dice.com / LinkedIn'],
     hook:'AI traffic is breaking transport networks — bandwidth doubling/tripling within months. Multi-vendor DWDM engineers (Ciena + Nokia + Infinera + Fujitsu) are nearly impossible to find. SDN/IP-optical convergence requires hybrid skill sets that are extremely scarce.',
     valueProp:'Specialized DWDM and optical transport engineers — multi-vendor experienced, project-ready, deployed without FTE overhead. Multi-vendor depth across Ciena/Nokia/Infinera/Fujitsu. Legacy SONET/TDM + modern 400G/800G coverage. Shift-flexible project deployment.'},
    // D8 — NOC Engineer
    {icp:[{label:'Industry',value:'Regional ISPs, CLECs, Telecom Carriers, MNSPs, Cable MSOs'},{label:'Company Size',value:'25–2,000 employees'},{label:'Geography',value:'US'},{label:'Tech Stack',value:'SolarWinds · Nagios · PRTG · Spectrum · ServiceNow'},{label:'Revenue',value:'$5M–$500M+'},{label:'Trigger',value:'24x7 NOC coverage gap, BEAD expansion, NOC turnover'}],
     personas:['VP / Director of Network Operations (primary)','VP of Operations / COO at Regional ISP','Director of IT / VP of IT (building/expanding NOC)','NOC Manager / NOC Lead','Director of Managed Services (MNSP)','Director of Infrastructure'],
     signals:['Job postings for NOC Engineer / Network Ops Analyst','ISP/carrier announcing new service territory or expanded coverage','BEAD expansion states','MSPs scaling to new regions','LinkedIn: VP of Network Ops, Dir of IT at telecom/ISP companies'],
     hook:'24x7/365 NOC requires minimum 6–8 FTEs just to cover basic shifts — before PTO, sick leave, holidays, turnover. Most regional ISPs don’t have that bench. NOC turnover is brutal due to rotating shifts and holiday coverage.',
     valueProp:'Pre-vetted, carrier-grade NOC engineers — SolarWinds/Nagios/PRTG/Spectrum/ServiceNow — deployable in 1–2 weeks. Shift-flexible: night shift, weekend, holiday coverage. Telecom stack depth: fiber, DWDM, broadband access (GPON/DOCSIS), routing/switching.'}
  ];
  // All campaigns come from DB only — never fall back to hardcoded list
  const _allCamps=customCampaigns;
  const campBase=_allCamps[campIdx]||_allCamps[0]||{};
  const campOverride=campEdits[campIdx]||{};
  const camp={...campBase,...campOverride};
  const DEFAULT_SEQUENCE=[
    {n:'1',title:'LinkedIn CR + Note',meta:'Day 1',subject:'',
     body:'Hi [First Name],\n\nI noticed [Company] is hiring for [Role] and had a thought — finding candidates with the right tooling background is tough in this market.\n\nWe embed AI-Amplified Talent™ into commercial furniture teams like yours — CET Designers and Space Planners who integrate in days, not months, at 60% less cost.\n\nWorth a quick conversation?\n\nBest,\nLaura Petersen | Bold Business\nlpetersen@boldbusiness.com',color:'#06E5EC'},
    {n:'2',title:'Email — Value prop',meta:'Day 3',subject:'60% cost reduction — [Company] + Bold Business',
     body:'Hi [First Name],\n\nFollowing up on my note. We partner with leading furniture dealers (Steelcase, MillerKnoll, HNI, Teknion) to provide specialized talent that seamlessly integrates with your workflow.\n\nOur 30-day No-Risk Deployment means if the talent isn’t a fit in the first week, we void the invoice.\n\nCase study: https://drive.google.com/file/d/1Sg8zgsLQq2Bzpg2Z_jENrsPuGoKpjlAe/view\n\nBest,\nLaura',color:'#5AC8FA'},
    {n:'3',title:'LinkedIn follow-up',meta:'Day 7',subject:'',
     body:'Hi [First Name] — just circling back on my earlier note. We’ve helped teams like yours reduce staffing costs by 60% while keeping output high.\n\nHappy to share a quick profile if the timing is right. No pressure either way.',color:'#2DD4BF'},
    {n:'4',title:'Final email — CTA',meta:'Day 14',subject:'Last note — [Company] + Bold Business',
     body:'Hi [First Name],\n\nOne more note — if scaling your team is on your radar for this quarter, I’d love to set up a quick 15-minute call.\n\nYou can book directly here: https://calendly.com/lenorekopko\n\nEither way, best of luck with the hiring search.\n\nBest,\nLaura Petersen | Bold Business',color:'#F5B945'},
  ];
  const _defaultContent=CAMP_DEFAULTS[campIdx]||{};
  const campContent={..._defaultContent,...campBase,...campOverride};
  if(!campContent.sequence) campContent.sequence=DEFAULT_SEQUENCE;

  const CAMP_COLORS=['#06E5EC','#4D8DFF','#8B7CF6','#F5B945','#f97316','#f43f5e','#a78bfa','#3B82F6','#2DD4BF','#ec4899'];
  const allCampaigns=_allCamps;
  // Filtered list for display (by SDR selector); maps display index -> global index
  // Renumber cards sequentially within the filtered view
  const filteredCamps=(person==='All'?allCampaigns.map((c,i)=>({...c,_gi:i}))
    :allCampaigns.map((c,i)=>({...c,_gi:i})).filter(c=>{
      const sdrVal=c.sdr||c.assignee;
      return sdrVal===person;
    }))
    .filter(c=>!deletedCampIndexes.has(c._gi))
    .map((c,displayIdx)=>({...c,num:displayIdx+1}));

  // SDR rows - real data only, no placeholder fallback
  const sdrRows=sdr?.agents||[];
  const rows=sdrRows.map(r=>{
    const meta=AGENTS.find(a=>a.label.toLowerCase()===(r.name||'').toLowerCase())||{color:'#7E8DB5',bg:'rgba(255,255,255,.08)',initial:(r.name||'?')[0]};
    return {...meta,...r,
      accept_pct:r.accept_pct||(r.cr_sent?`${Math.round((r.cr_accepted/r.cr_sent)*100)}%`:'-'),
      reply_pct: r.reply_pct ||(r.cr_sent?`${Math.round((r.replies/r.cr_sent)*100)}%`:'-'),
    };
  });
  const pagedSdrRows=rows.slice(sdrPage*SDR_PER_PAGE,(sdrPage+1)*SDR_PER_PAGE);
  const tot={cr_sent:rows.reduce((a,r)=>a+Number(r.cr_sent||0),0),cr_accepted:rows.reduce((a,r)=>a+Number(r.cr_accepted||0),0),
    replies:rows.reduce((a,r)=>a+Number(r.replies||0),0),emails:rows.reduce((a,r)=>a+Number(r.emails||0),0),li_out:rows.reduce((a,r)=>a+Number(r.li_out||0),0),
    campaigns:rows.reduce((a,r)=>a+Number(r.campaigns||0),0),calls:rows.reduce((a,r)=>a+Number(r.calls||0),0)};

  const GC='1.3fr .7fr .8fr .9fr .7fr .8fr .7fr .7fr .7fr .9fr 1fr';
  const TH={font:'600 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5',textAlign:'right'};
  const M={font:'13px/1 monospace',textAlign:'right'};

  // Pill helpers
  const pctToNum=v=>{ if(!v||v==='-') return null; const n=parseFloat(v); return isNaN(n)?null:n; };
  const pctPill=(val,isBold=false)=>{
    const n=pctToNum(val);
    const isDash=n===null;
    const bg=isDash?'rgba(159,176,216,.13)':n===0?'rgba(242,102,122,.18)':n<3?'rgba(242,102,122,.18)':n<10?'rgba(245,185,69,.22)':'rgba(45,212,191,.18)';
    const clr=isDash?'#7E8DB5':n===0?'#F2667A':n<3?'#F2667A':n<10?'#F5B945':'#2DD4BF';
    return <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
      minWidth:52,padding:'3px 10px',borderRadius:20,background:bg,
      font:`${isBold?700:600} 12px/1.4 Inter,sans-serif`,color:clr,whiteSpace:'nowrap'}}>
      {isDash?'—':val}
    </span>;
  };
  const numPill=(val,onClick=null)=>{
    const content=val===null||val===undefined||val==='-'?'—':(typeof val==='number'?val.toLocaleString():val);
    const inner=<span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
      minWidth:36,padding:'3px 10px',borderRadius:20,background:'rgba(159,176,216,.13)',
      font:'600 12px/1.4 Inter,sans-serif',color:'#C8D4F0',whiteSpace:'nowrap'}}>{content}</span>;
    if(!onClick) return inner;
    return <button onClick={onClick} style={{background:'none',border:'none',padding:0,cursor:'pointer',display:'inline-flex'}}>{inner}</button>;
  };

  // ── shared modal overlay style
  const OVL={position:'fixed',inset:0,zIndex:9100,background:'rgba(2,8,32,.72)',backdropFilter:'blur(6px)',
    display:'flex',alignItems:'center',justifyContent:'center',padding:20};
  const MBOX={width:'100%',maxWidth:920,maxHeight:'88vh',background:'#0a1338',border:'1px solid rgba(255,255,255,.12)',
    borderRadius:16,display:'flex',flexDirection:'column',boxShadow:'0 30px 80px rgba(0,0,0,.6)',overflow:'hidden'};
  const MHDR={display:'flex',alignItems:'center',justifyContent:'space-between',
    padding:'16px 22px',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0};
  const XBTN={width:28,height:28,borderRadius:8,border:'1px solid rgba(255,255,255,.1)',background:'none',
    color:'#9FB0D8',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'};

  return (
    <div style={{maxWidth:1380,margin:'0 auto',padding:'18px 24px 40px'}}>

      {/* ═ REPLIES MODAL ═ 3-level drill-down: campaigns → people → thread */}
      {repliesModal&&(
        <div style={OVL} onClick={()=>{setRepliesModal(null);setRepliesDrill(null);}}>
          <div style={{...MBOX,maxWidth:780}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={MHDR}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {/* Back button when drilling into leads or thread */}
                {repliesDrill&&repliesDrill.level!=='campaigns'&&(
                  <button
                    onClick={()=>{
                      if(repliesDrill.level==='thread') setRepliesDrill(d=>({...d,level:'leads',messages:null,lead:null}));
                      else setRepliesDrill(null);
                    }}
                    style={{background:'none',border:'none',color:'#9FB0D8',cursor:'pointer',fontSize:13,
                      display:'flex',alignItems:'center',gap:4,padding:'0 4px',fontFamily:'Inter,sans-serif',fontWeight:600}}
                  >
                    ← Back
                  </button>
                )}
                <div style={{font:'700 17px Inter,sans-serif',color:'#fff'}}>
                  {!repliesDrill&&`Replies — ${repliesModal.name}`}
                  {repliesDrill?.level==='leads'&&`${repliesDrill.campaign?.campaign_name} Threads`}
                  {repliesDrill?.level==='thread'&&(repliesDrill.lead?.fullName||'Thread')}
                </div>
              </div>
              <button style={XBTN} onClick={()=>{setRepliesModal(null);setRepliesDrill(null);}}>&#215;</button>
            </div>

            {/* ─ Level 1: campaign list ─ */}
            {!repliesDrill&&(
              <div style={{overflowY:'auto',padding:'0 0 8px'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'rgba(2,8,32,.4)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                      {['Campaign','Activity','CR Sent','Replies','Reply %'].map(h=>(
                        <th key={h} style={{padding:'10px 16px',font:'600 11px Inter,sans-serif',letterSpacing:'.06em',
                          textTransform:'uppercase',color:'#7E8DB5',textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(repliesModal.campaign_list||[]).filter(c=>Number(c.connection_replies)>0).map((c,i,a)=>{
                      const rate=c.connections_requested>0
                        ?(c.connection_replies/c.connections_requested*100).toFixed(1):null;
                      const pillClr=rate===null?'#7E8DB5':rate>=5?'#2DD4BF':rate>=2?'#F5B945':'#F87171';
                      const pillBg=rate===null?'rgba(126,141,181,.12)':rate>=5?'rgba(45,212,191,.14)':rate>=2?'rgba(245,185,69,.14)':'rgba(248,113,113,.14)';
                      return(
                        <tr key={c.campaign_name}
                          onClick={async()=>{
                            setRepliesDrill({level:'leads',campaign:c,leads:null,loading:true});
                            try{
                              const r=await fetch(
                                `/api/skylead/campaign-leads?campaignId=${c.campaign_id}&accountId=${repliesModal.account_id}`,
                                {headers:authHeaders()}
                              );
                              const j=await r.json();
                              setRepliesDrill(d=>({...d,leads:j.leads||[],loading:false}));
                            }catch(e){
                              setRepliesDrill(d=>({...d,leads:[],loading:false}));
                            }
                          }}
                          style={{borderBottom:i<a.length-1?'1px solid rgba(255,255,255,.05)':'none',
                            cursor:'pointer',transition:'background .12s'}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(6,229,236,.04)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                        >
                          <td style={{padding:'11px 16px',font:'600 13px Inter,sans-serif',color:'#06E5EC',
                            maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                            textDecoration:'underline',textDecorationColor:'rgba(6,229,236,.35)'}}>
                            {c.campaign_name}
                          </td>
                          <td style={{padding:'11px 16px',color:'#9FB0D8',fontSize:12}}>{c.activity||'-'}</td>
                          <td style={{padding:'11px 16px',font:'13px/1 monospace',color:'#EAF0FF',textAlign:'center'}}>{c.connections_requested}</td>
                          <td style={{padding:'11px 16px',font:'700 13px/1 monospace',color:'#2DD4BF',textAlign:'center'}}>{c.connection_replies}</td>
                          <td style={{padding:'11px 16px',textAlign:'center'}}>
                            <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,
                              font:'700 12px/1 monospace',color:pillClr,background:pillBg}}>
                              {rate!==null?`${rate}%`:'-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(repliesModal.campaign_list||[]).filter(c=>Number(c.connection_replies)>0).length===0&&(
                      <tr><td colSpan={5} style={{padding:32,textAlign:'center',color:'#7E8DB5',fontSize:13}}>No replies recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─ Level 2: people list ─ */}
            {repliesDrill?.level==='leads'&&(
              <div style={{overflowY:'auto',flex:1,padding:'8px 0'}}>
                {repliesDrill.loading&&[1,2,3].map(i=>(
                  <div key={i} className="cc-skel" style={{height:64,margin:'8px 22px',borderRadius:10}}/>
                ))}
                {!repliesDrill.loading&&(repliesDrill.leads||[]).length===0&&(
                  <div style={{padding:40,textAlign:'center',color:'#7E8DB5',font:'13px Inter,sans-serif'}}>No replied leads found.</div>
                )}
                {!repliesDrill.loading&&(repliesDrill.leads||[]).map((lead,i,a)=>{
                  const lastDate=lead.stepChangeTimestamp
                    ?new Date(lead.stepChangeTimestamp).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric'})
                    :null;
                  return(
                    <div key={lead.id}
                      onClick={async()=>{
                        setRepliesDrill(d=>({...d,level:'thread',lead,messages:null,loadingThread:true}));
                        try{
                          const r=await fetch(
                            `/api/skylead/lead-thread?leadId=${lead.id}&campaignId=${repliesDrill.campaign?.campaign_id}&accountId=${repliesModal.account_id}`,
                            {headers:authHeaders()}
                          );
                          const j=await r.json();
                          setRepliesDrill(d=>({...d,messages:j.messages||[],loadingThread:false}));
                        }catch(e){
                          setRepliesDrill(d=>({...d,messages:[],loadingThread:false}));
                        }
                      }}
                      style={{display:'flex',alignItems:'center',gap:14,padding:'14px 22px',
                        borderBottom:i<a.length-1?'1px solid rgba(255,255,255,.05)':'none',
                        cursor:'pointer',transition:'background .12s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(6,229,236,.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      {/* Avatar */}
                      <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,overflow:'hidden',
                        background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',
                        font:'700 15px Inter,sans-serif',color:'#9FB0D8'}}>
                        {lead.image
                          ?<img src={lead.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          :(lead.fullName||'?')[0].toUpperCase()
                        }
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{font:'700 14px Inter,sans-serif',color:'#EAF0FF',marginBottom:2}}>{lead.fullName}</div>
                        <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {[lead.occupation,lead.company].filter(Boolean).join(' @ ')}
                        </div>
                        {lastDate&&<div style={{font:'11px Inter,sans-serif',color:'#5B7099',marginTop:2}}>Last Message: {lastDate}</div>}
                      </div>
                      <span style={{color:'#7E8DB5',fontSize:16,flexShrink:0}}>›</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─ Level 3: conversation thread ─ */}
            {repliesDrill?.level==='thread'&&(
              <div style={{overflowY:'auto',flex:1,padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
                {repliesDrill.loadingThread&&[1,2].map(i=>(
                  <div key={i} className="cc-skel" style={{height:80,borderRadius:12}}/>
                ))}
                {!repliesDrill.loadingThread&&(repliesDrill.messages||[]).length===0&&(
                  <div style={{textAlign:'center',color:'#7E8DB5',font:'13px Inter,sans-serif',padding:'40px 0'}}>
                    No message content available.
                  </div>
                )}
                {!repliesDrill.loadingThread&&(repliesDrill.messages||[]).map((msg,i)=>{
                  const isSent=msg.sender==='laura'||msg.sender==='agent';
                  const ts=msg.timestamp?new Date(msg.timestamp).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric'}):null;
                  return(
                    <div key={msg.id||i} style={{display:'flex',flexDirection:'column',
                      alignItems:isSent?'flex-end':'flex-start'}}>
                      {ts&&<div style={{font:'10px Inter,sans-serif',color:'#5B7099',marginBottom:4,
                        textAlign:isSent?'right':'left'}}>{ts}</div>}
                      <div style={{
                        maxWidth:'72%',padding:'12px 16px',borderRadius:isSent?'16px 16px 4px 16px':'16px 16px 16px 4px',
                        background:isSent?'rgba(59,130,246,.85)':'rgba(255,255,255,.08)',
                        font:'13px/1.55 Inter,sans-serif',
                        color:isSent?'#fff':'#EAF0FF',
                        border:isSent?'none':'1px solid rgba(255,255,255,.08)',
                        boxShadow:isSent?'0 2px 12px rgba(59,130,246,.25)':'none',
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═ STANDALONE ADD CALL LOG MODAL (sandbox) ═ */}
      {sbCallModal&&(
        <div style={OVL} onClick={()=>setSbCallModal(false)}>
          <div style={{...MBOX,maxWidth:580}} onClick={e=>e.stopPropagation()}>
            <div style={MHDR}>
              <div style={{font:'700 17px Inter,sans-serif',color:'#fff'}}>Log a Call</div>
              <button style={XBTN} onClick={()=>setSbCallModal(false)}>×</button>
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'20px 24px'}}>
              <form onSubmit={handleSbCallSubmit}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

                  {/* SDR selector */}
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>SDR *</label>
                    <select required value={sbCallForm.account_id}
                      onChange={e=>setSbCallForm(p=>({...p,account_id:e.target.value,campaign_name:''}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                      <option value="">Select SDR...</option>
                      {[
                        {id:32887,name:'Abhinanda Deb'},{id:32871,name:'Lenore Kopko'},
                        {id:32894,name:'George Georgiou'},{id:32891,name:'Laura Petersen'},
                        {id:32893,name:'Darren Stuart'},{id:33364,name:'Mariana Lopez'},
                        {id:33347,name:'Bob Toll'},
                      ].map(a=>(
                        <option key={a.id} value={String(a.id)} style={{background:'#0d1a42'}}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Campaign name combobox */}
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4,position:'relative'}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Campaign Name</label>
                    <input
                      value={sbCallForm.campaign_name}
                      placeholder={sbCallForm.account_id?'Type to search or enter manually':'Select an SDR first'}
                      autoComplete="off"
                      onFocus={()=>{ setSbCallCampQ(sbCallForm.campaign_name); setSbCallCampOpen(true); }}
                      onBlur={()=>setTimeout(()=>setSbCallCampOpen(false),180)}
                      onChange={e=>{
                        const v=e.target.value;
                        setSbCallForm(p=>({...p,campaign_name:v}));
                        setSbCallCampQ(v);
                        setSbCallCampOpen(true);
                      }}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                        font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                    {sbCallCampOpen&&(()=>{
                      const q=(sbCallCampQ||'').toLowerCase();
                      const filtered=sbCallCampNames.filter(n=>n.toLowerCase().includes(q)).slice(0,100);
                      if(!filtered.length) return null;
                      return(
                        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
                          background:'#0d1a42',border:'1px solid rgba(255,255,255,.15)',
                          borderRadius:8,boxShadow:'0 8px 32px rgba(0,0,0,.5)',
                          maxHeight:200,overflowY:'auto',marginTop:2}}>
                          {filtered.map(n=>(
                            <div key={n}
                              onMouseDown={e=>{
                                e.preventDefault();
                                setSbCallForm(p=>({...p,campaign_name:n}));
                                setSbCallCampOpen(false);
                              }}
                              style={{padding:'9px 12px',font:'13px Inter,sans-serif',color:'#EAF0FF',
                                cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)'}}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(6,229,236,.1)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              {n}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Contact Name */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Contact Name *</label>
                    <input required value={sbCallForm.contact_name}
                      onChange={e=>setSbCallForm(p=>({...p,contact_name:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>

                  {/* Title */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Title</label>
                    <input value={sbCallForm.contact_title}
                      onChange={e=>setSbCallForm(p=>({...p,contact_title:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>

                  {/* Company */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Company</label>
                    <input value={sbCallForm.contact_company}
                      onChange={e=>setSbCallForm(p=>({...p,contact_company:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>

                  {/* LinkedIn */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>LinkedIn URL</label>
                    <input type="url" value={sbCallForm.contact_linkedin}
                      onChange={e=>setSbCallForm(p=>({...p,contact_linkedin:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>

                  {/* Call Date */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Call Date *</label>
                    <input type="date" required value={sbCallForm.call_date}
                      onChange={e=>setSbCallForm(p=>({...p,call_date:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>

                  {/* Outcome */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Outcome</label>
                    <select value={sbCallForm.outcome}
                      onChange={e=>setSbCallForm(p=>({...p,outcome:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                      {['completed','positive','neutral','negative','voicemail','no-answer','scheduled'].map(o=>(
                        <option key={o} value={o} style={{background:'#0d1a42',textTransform:'capitalize'}}>{o}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Notes</label>
                    <textarea rows={3} value={sbCallForm.notes}
                      onChange={e=>setSbCallForm(p=>({...p,notes:e.target.value}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                        font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)',
                        resize:'vertical',fontFamily:'Inter,sans-serif'}}/>
                  </div>
                </div>

                <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
                  <button type="button" onClick={()=>setSbCallModal(false)}
                    style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
                      background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>
                    Cancel
                  </button>
                  <button type="submit" disabled={sbCallSaving}
                    style={{padding:'9px 26px',borderRadius:8,border:'none',
                      background:'linear-gradient(135deg,#4446DB,#6366F1)',
                      color:'#fff',font:'700 13px Inter,sans-serif',cursor:'pointer',opacity:sbCallSaving?.6:1}}>
                    {sbCallSaving?'Saving...':'Save Call Log'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═ CAMPAIGN BRIEF EDIT MODAL ═ */}
      {briefEditOpen&&(()=>{
        const def=CAMP_DEFAULTS[campIdx]||{};
        const ov=campEdits[campIdx]||{};
        const merged={...(_allCamps[campIdx]||{}),...def,...ov};
        // local form state handled via a child component to avoid re-render issues
        const BriefEditForm=()=>{
          const defSeq=merged.sequence||DEFAULT_SEQUENCE;
          const EDIT_SDR_OPTIONS=['Laura','Darren','Abhinanda','Lenore','George','Bob','Cathy','Mariana'];
          const EDIT_SDR_ACC={'Laura':32891,'Darren':32893,'Abhinanda':32887,'Lenore':32871,'George':32894,'Bob':33347,'Cathy':33361,'Mariana':33364};
          const [form,setForm]=useState({
            title:merged.title||'', sub:merged.sub||'',
            assignee:_allCamps[campIdx]?.assignee||_allCamps[campIdx]?.sdr||'Laura',
            hook:merged.hook||'', valueProp:merged.valueProp||'',
            personas:(merged.personas||[]).join('\n'),
            signals:(merged.signals||[]).join('\n'),
            icp:(merged.icp||[]).map(r=>`${r.label}: ${r.value}`).join('\n'),
            sequence:defSeq.map(s=>({...s})),
            hiring:merged.hiring!==undefined ? merged.hiring : null,
          });
          const [tab,setTab]=useState('brief'); // 'brief' | 'sequence'
          const [seqTab,setSeqTab]=useState(0);
          const setStep=(i,key,val)=>setForm(f=>({...f,sequence:f.sequence.map((s,j)=>j===i?{...s,[key]:val}:s)}));

          const fi={width:'100%',boxSizing:'border-box',
            background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',
            borderRadius:8,color:'#EAF0FF',font:'13px/1.6 Inter,sans-serif',
            padding:'9px 13px',outline:'none',resize:'vertical',transition:'border-color .15s'};
          const inp={...fi,resize:'none'};
          const lbl={font:'600 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',
            color:'#7E8DB5',marginBottom:6,display:'block'};
          const field=(label,node)=>(
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              <label style={lbl}>{label}</label>{node}
            </div>
          );
          const [saving,setSaving]=useState(false);
          const save=async()=>{
            setSaving(true);
            const icp=(form.icp||'').split('\n').filter(Boolean).map(line=>{
              const idx=line.indexOf(':'); if(idx<0) return {label:line,value:''};
              return {label:line.slice(0,idx).trim(),value:line.slice(idx+1).trim()};
            });
            const updatedContent={
              title:form.title,sub:form.sub,hook:form.hook,valueProp:form.valueProp,
              personas:form.personas.split('\n').filter(Boolean),
              signals:form.signals.split('\n').filter(Boolean),
              icp,sequence:form.sequence,
              hiring:form.hiring,
            };
            setCampEdits(prev=>({...prev,[campIdx]:updatedContent}));
            // All campaigns are now DB-backed — always persist the edit
            const dbId=customCampaigns[campIdx]?._dbId;
            if(dbId){
              await fetch(`/api/campaign-briefs/${dbId}`,{
                method:'PATCH',
                headers:{...authHeaders(),'Content-Type':'application/json'},
                body:JSON.stringify({
                  campaign_name: form.title,
                  target_icp:   form.sub,
                  assignee:     form.assignee,
                  account_id:   EDIT_SDR_ACC[form.assignee]||32891,
                  brief_json:   {...updatedContent, color:_allCamps[campIdx]?.color, sdr:form.assignee},
                }),
              }).catch(()=>{});
              // Update local state
              setCustomCampaigns(prev=>prev.map((c,i)=>i===campIdx?{...c,title:form.title,sub:form.sub,assignee:form.assignee,sdr:form.assignee,...updatedContent,hiring:form.hiring}:c));
            }
            setBriefEditOpen(false);
            setSaving(false);
          };

          const STEP_COLORS=['#06E5EC','#5AC8FA','#2DD4BF','#F5B945'];
          const curStep=form.sequence[seqTab]||{};

          return (
            <div style={OVL} onClick={()=>setBriefEditOpen(false)}>
              <div style={{width:'100%',maxWidth:980,maxHeight:'92vh',background:'#080f2a',
                border:'1px solid rgba(255,255,255,.1)',borderRadius:16,display:'flex',
                flexDirection:'column',boxShadow:'0 40px 100px rgba(0,0,0,.7)',overflow:'hidden'}}
                onClick={e=>e.stopPropagation()}>

                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'18px 28px',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
                  <div>
                    <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>Edit Campaign Brief</div>
                    <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5',marginTop:3}}>{camp.title}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {/* Tabs */}
                    {['brief','sequence'].map(t=>(
                      <button key={t} onClick={()=>setTab(t)} style={{
                        padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',
                        background:tab===t?'rgba(6,229,236,.15)':'transparent',
                        color:tab===t?'#06E5EC':'#7E8DB5',
                        font:`${tab===t?700:400} 12px Inter,sans-serif`,transition:'all .15s'}}>
                        {t==='brief'?'Brief':'Sequence'}
                      </button>
                    ))}
                    <div style={{width:1,height:20,background:'rgba(255,255,255,.1)',margin:'0 4px'}}/>
                    <button style={XBTN} onClick={()=>setBriefEditOpen(false)}>×</button>
                  </div>
                </div>

                {/* Body */}
                <div style={{overflowY:'auto',flex:1,padding:'24px 28px'}}>

                  {tab==='brief'&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                      {/* Left col */}
                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        {/* Assignee + title row — same layout as New Brief form */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,alignItems:'end'}}>
                          {field('Assignee (SDR)',
                            <select value={form.assignee} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))} style={{...inp,resize:'none',background:'#0d1a42'}}>
                              {EDIT_SDR_OPTIONS.map(o=><option key={o} value={o} style={{background:'#0d1a42'}}>{o}</option>)}
                            </select>)}
                          {field('Campaign title',
                            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp} placeholder="Campaign title"/>)}
                        </div>
                        {field('Subtitle / segment',
                          <input value={form.sub} onChange={e=>setForm(f=>({...f,sub:e.target.value}))} style={inp} placeholder="AEC · 50-500 employees · US"/>)}
                        {field('Hiring signal',
                          <div style={{display:'flex',gap:8}}>
                            {[{val:true,label:'Yes'},{val:false,label:'No'},{val:null,label:'N/A'}].map(opt=>(
                              <button key={String(opt.val)} onClick={()=>setForm(f=>({...f,hiring:opt.val}))}
                                type="button"
                                style={{
                                  padding:'6px 16px',borderRadius:20,cursor:'pointer',border:'none',
                                  background:form.hiring===opt.val
                                    ?(opt.val===true?'#22C55E':opt.val===false?'#EF4444':'rgba(255,255,255,.15)')
                                    :'rgba(255,255,255,.06)',
                                  color:form.hiring===opt.val
                                    ?(opt.val===null?'#EAF0FF':'#000814')
                                    :'#7E8DB5',
                                  font:`${form.hiring===opt.val?700:400} 12px Inter,sans-serif`,
                                  transition:'all .15s'}}>
                                {opt.label}
                              </button>
                            ))}
                          </div>)}
                        {field('ICP fields',
                          <div>
                            <div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line · format: Label: Value</div>
                            <textarea rows={7} value={form.icp} onChange={e=>setForm(f=>({...f,icp:e.target.value}))} style={fi} placeholder="Industry: AEC\nCompany Size: 11-500"/>
                          </div>)}
                        {field('Sourcing signals',
                          <div>
                            <div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line</div>
                            <textarea rows={5} value={form.signals} onChange={e=>setForm(f=>({...f,signals:e.target.value}))} style={fi} placeholder="Job posts: CET Designer"/>
                          </div>)}
                      </div>
                      {/* Right col */}
                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        {field('Target personas',
                          <div>
                            <div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line</div>
                            <textarea rows={6} value={form.personas} onChange={e=>setForm(f=>({...f,personas:e.target.value}))} style={fi} placeholder="VP of Operations\nDesign Manager"/>
                          </div>)}
                        {field('Hook — the pain',
                          <textarea rows={4} value={form.hook} onChange={e=>setForm(f=>({...f,hook:e.target.value}))} style={fi}/>)}
                        {field('Value proposition',
                          <textarea rows={6} value={form.valueProp} onChange={e=>setForm(f=>({...f,valueProp:e.target.value}))} style={fi}/>)}
                      </div>
                    </div>
                  )}

                  {tab==='sequence'&&(
                    <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:20,minHeight:400}}>
                      {/* Step sidebar */}
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {form.sequence.map((step,i)=>(
                          <button key={i} onClick={()=>setSeqTab(i)} style={{
                            display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                            borderRadius:10,border:`1px solid ${seqTab===i?STEP_COLORS[i%4]+'55':'rgba(255,255,255,.07)'}`,
                            background:seqTab===i?`${STEP_COLORS[i%4]}12`:'rgba(255,255,255,.02)',
                            cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                            <span style={{width:24,height:24,borderRadius:'50%',
                              background:STEP_COLORS[i%4],color:'#0a0f22',flexShrink:0,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              font:'800 11px Inter,sans-serif'}}>{i+1}</span>
                            <div style={{minWidth:0}}>
                              <div style={{font:`${seqTab===i?700:500} 12px Inter,sans-serif`,
                                color:seqTab===i?STEP_COLORS[i%4]:'#cdd6ee',
                                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{step.title||`Step ${i+1}`}</div>
                              <div style={{font:'10px Inter,sans-serif',color:'#7E8DB5'}}>{step.meta}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* Step editor */}
                      <div style={{display:'flex',flexDirection:'column',gap:14,
                        background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.07)',
                        borderRadius:12,padding:'20px 22px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          {field('Step title',
                            <input value={curStep.title||''} onChange={e=>setStep(seqTab,'title',e.target.value)}
                              style={inp} placeholder="e.g. LinkedIn CR + Note"/>)}
                          {field('Timing',
                            <input value={curStep.meta||''} onChange={e=>setStep(seqTab,'meta',e.target.value)}
                              style={inp} placeholder="e.g. Day 1"/>)}
                        </div>
                        {field(
                          <span>Subject line <span style={{color:'#4a5568',fontWeight:400,textTransform:'none',letterSpacing:0}}>· email steps only</span></span>,
                          <input value={curStep.subject||''} onChange={e=>setStep(seqTab,'subject',e.target.value)}
                            style={inp} placeholder="Leave blank for LinkedIn steps"/>)}
                        {field('Message body',
                          <textarea rows={12} value={curStep.body||''}
                            onChange={e=>setStep(seqTab,'body',e.target.value)} style={fi}
                            placeholder="Write the full outreach message here..."/>)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'16px 28px',borderTop:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
                  <span style={{font:'12px Inter,sans-serif',color:'#4a5568'}}>Changes apply immediately to the Campaign Brief card</span>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>setBriefEditOpen(false)}
                      style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',
                        background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>Discard</button>
                    <button onClick={save} disabled={saving}
                      style={{padding:'9px 24px',borderRadius:8,border:'none',background:saving?'rgba(6,229,236,.4)':'#06E5EC',
                        color:'#000814',font:'700 13px Inter,sans-serif',cursor:saving?'default':'pointer',letterSpacing:'.01em'}}>{saving?'Saving…':'Save changes'}</button>
                  </div>
                </div>
              </div>
            </div>
          );
        };
        return <BriefEditForm key={campIdx}/>;
      })()}

      {/* ═ NEW CAMPAIGN BRIEF MODAL ═ */}
      {briefNewOpen&&(()=>{
        const NewBriefForm=()=>{
          const nextNum=allCampaigns.length+1;
          const nextColor=CAMP_COLORS[allCampaigns.length%CAMP_COLORS.length];
          const SDR_OPTIONS=['Laura','Darren','Abhinanda','Lenore','George','Bob','Cathy','Mariana'];
          const [form,setForm]=useState({
            title:'',sub:'',hook:'',valueProp:'',assignee:'Laura',
            personas:'',signals:'',
            icp:'Industry: \nCompany Size: \nGeography: \nTech Stack: \nRevenue: \nTrigger: Currently hiring',
            sequence:DEFAULT_SEQUENCE.map(s=>({...s})),
            hiring:null,
          });
          const [tab,setTab]=useState('brief');
          const [seqTab,setSeqTab]=useState(0);
          const setStep=(i,key,val)=>setForm(f=>({...f,sequence:f.sequence.map((s,j)=>j===i?{...s,[key]:val}:s)}));
          const fi={width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,.04)',
            border:'1px solid rgba(255,255,255,.1)',borderRadius:8,color:'#EAF0FF',
            font:'13px/1.6 Inter,sans-serif',padding:'9px 13px',outline:'none',resize:'vertical'};
          const inp={...fi,resize:'none'};
          const lbl={font:'600 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:6,display:'block'};
          const field=(label,node)=>(<div style={{display:'flex',flexDirection:'column',gap:0}}><label style={lbl}>{label}</label>{node}</div>);
          const STEP_COLORS=['#06E5EC','#5AC8FA','#2DD4BF','#F5B945'];
          const curStep=form.sequence[seqTab]||{};
          const SDR_ACC={'Laura':32891,'Darren':32893,'Abhinanda':32887,'Lenore':32871,'George':32894,'Bob':33347,'Cathy':33361,'Mariana':33364};
          const [saving,setSaving]=useState(false);
          const [saveErr,setSaveErr]=useState('');
          const save=async()=>{
            if(!form.title.trim()) return;
            setSaving(true); setSaveErr('');
            const icp=(form.icp||'').split('\n').filter(Boolean).map(line=>{
              const idx=line.indexOf(':'); if(idx<0) return {label:line,value:''};
              return {label:line.slice(0,idx).trim(),value:line.slice(idx+1).trim()};
            });
            const chosenColor=CAMP_COLORS_REF[allCampaigns.length%CAMP_COLORS_REF.length];
            const briefContent={
              sdr:form.assignee||'Laura', color:chosenColor,
              title:form.title,sub:form.sub,hook:form.hook,valueProp:form.valueProp,
              personas:form.personas.split('\n').filter(Boolean),
              signals:form.signals.split('\n').filter(Boolean),
              icp, sequence:form.sequence,
              hiring:form.hiring,
            };
            try{
              const res=await fetch('/api/campaign-briefs',{
                method:'POST',
                headers:{...authHeaders(),'Content-Type':'application/json'},
                body:JSON.stringify({
                  campaign_name: form.title,
                  account_id:   SDR_ACC[form.assignee]||32891,
                  target_icp:   form.sub,
                  channel:      'LinkedIn + Email',
                  assignee:     form.assignee||'Laura',
                  brief_json:   briefContent,
                }),
              });
              const j=await res.json();
              if(j.ok){
                const newCamp={
                  _dbId:     j.brief.campaign_id,
                  num:       nextNum,
                  title:     form.title,
                  sub:       form.sub,
                  color:     chosenColor,
                  sdr:       form.assignee||'Laura',
                  assignee:  form.assignee||'Laura',
                  sort_order:j.brief.sort_order,
                  hiring:    form.hiring,
                  ...briefContent,
                };
                setCustomCampaigns(prev=>[...prev,newCamp]);
                setCampEdits(prev=>({...prev,[allCampaigns.length]:briefContent}));
                setCampIdx(allCampaigns.length);
                setBriefNewOpen(false);
              } else {
                setSaveErr(j.error||'Save failed. Please try again.');
              }
            }catch(err){ setSaveErr(err.message||'Network error.'); }
            finally{ setSaving(false); }
          };
          return (
            <div style={OVL} onClick={()=>setBriefNewOpen(false)}>
              <div style={{width:'100%',maxWidth:980,maxHeight:'92vh',background:'#080f2a',
                border:'1px solid rgba(255,255,255,.1)',borderRadius:16,display:'flex',
                flexDirection:'column',boxShadow:'0 40px 100px rgba(0,0,0,.7)',overflow:'hidden'}}
                onClick={e=>e.stopPropagation()}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'18px 28px',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{width:26,height:26,borderRadius:'50%',background:nextColor,color:'#0a0f22',
                        display:'flex',alignItems:'center',justifyContent:'center',font:'800 12px Inter,sans-serif'}}>{nextNum}</span>
                      <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>New Campaign Brief</div>
                    </div>
                    <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5',marginTop:3,paddingLeft:36}}>Fill in the brief details and outreach sequence</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {['brief','sequence'].map(t=>(
                      <button key={t} onClick={()=>setTab(t)} style={{
                        padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',
                        background:tab===t?'rgba(6,229,236,.15)':'transparent',
                        color:tab===t?'#06E5EC':'#7E8DB5',
                        font:`${tab===t?700:400} 12px Inter,sans-serif`,transition:'all .15s'}}>
                        {t==='brief'?'Brief':'Sequence'}
                      </button>
                    ))}
                    <div style={{width:1,height:20,background:'rgba(255,255,255,.1)',margin:'0 4px'}}/>
                    <button style={XBTN} onClick={()=>setBriefNewOpen(false)}>×</button>
                  </div>
                </div>
                {/* Body */}
                <div style={{overflowY:'auto',flex:1,padding:'24px 28px'}}>
                  {tab==='brief'&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        {/* Assignee + title row */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,alignItems:'end'}}>
                          {field('Assignee (SDR)',
                            <select value={form.assignee} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))} style={{...inp,resize:'none',background:'#0d1a42'}}>
                              {SDR_OPTIONS.map(s=><option key={s} value={s} style={{background:'#0d1a42'}}>{s}</option>)}
                            </select>)}
                          {field('Campaign title',
                            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp} placeholder="e.g. CET Designer / Space Planner"/>)}
                        </div>
                        {field('Subtitle / segment',
                          <input value={form.sub} onChange={e=>setForm(f=>({...f,sub:e.target.value}))} style={inp} placeholder="e.g. AEC · 50-500 employees · US"/>)}
                        {field('Hiring signal',
                          <div style={{display:'flex',gap:8}}>
                            {[{val:true,label:'Yes'},{val:false,label:'No'},{val:null,label:'N/A'}].map(opt=>(
                              <button key={String(opt.val)} onClick={()=>setForm(f=>({...f,hiring:opt.val}))}
                                type="button"
                                style={{
                                  padding:'6px 16px',borderRadius:20,cursor:'pointer',border:'none',
                                  background:form.hiring===opt.val
                                    ?(opt.val===true?'#22C55E':opt.val===false?'#EF4444':'rgba(255,255,255,.15)')
                                    :'rgba(255,255,255,.06)',
                                  color:form.hiring===opt.val
                                    ?(opt.val===null?'#EAF0FF':'#000814')
                                    :'#7E8DB5',
                                  font:`${form.hiring===opt.val?700:400} 12px Inter,sans-serif`,
                                  transition:'all .15s'}}>
                                {opt.label}
                              </button>
                            ))}
                          </div>)}
                        {field('ICP fields',
                          <div><div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line · Label: Value</div>
                            <textarea rows={7} value={form.icp} onChange={e=>setForm(f=>({...f,icp:e.target.value}))} style={fi}/></div>)}
                        {field('Sourcing signals',
                          <div><div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line</div>
                            <textarea rows={5} value={form.signals} onChange={e=>setForm(f=>({...f,signals:e.target.value}))} style={fi} placeholder="Job posts: CET Designer"/></div>)}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        {field('Target personas',
                          <div><div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginBottom:6}}>One per line</div>
                            <textarea rows={6} value={form.personas} onChange={e=>setForm(f=>({...f,personas:e.target.value}))} style={fi} placeholder="VP of Operations"/></div>)}
                        {field('Hook — the pain',
                          <textarea rows={4} value={form.hook} onChange={e=>setForm(f=>({...f,hook:e.target.value}))} style={fi} placeholder="What problem does the prospect have?"/>)}
                        {field('Value proposition',
                          <textarea rows={6} value={form.valueProp} onChange={e=>setForm(f=>({...f,valueProp:e.target.value}))} style={fi} placeholder="How does Bold Business solve it?"/>)}
                      </div>
                    </div>
                  )}
                  {tab==='sequence'&&(
                    <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:20,minHeight:400}}>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {form.sequence.map((step,i)=>(
                          <button key={i} onClick={()=>setSeqTab(i)} style={{
                            display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                            borderRadius:10,border:`1px solid ${seqTab===i?STEP_COLORS[i%4]+'55':'rgba(255,255,255,.07)'}`,
                            background:seqTab===i?`${STEP_COLORS[i%4]}12`:'rgba(255,255,255,.02)',
                            cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                            <span style={{width:24,height:24,borderRadius:'50%',
                              background:STEP_COLORS[i%4],color:'#0a0f22',flexShrink:0,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              font:'800 11px Inter,sans-serif'}}>{i+1}</span>
                            <div style={{minWidth:0}}>
                              <div style={{font:`${seqTab===i?700:500} 12px Inter,sans-serif`,
                                color:seqTab===i?STEP_COLORS[i%4]:'#cdd6ee',
                                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{step.title||`Step ${i+1}`}</div>
                              <div style={{font:'10px Inter,sans-serif',color:'#7E8DB5'}}>{step.meta}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:14,
                        background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.07)',
                        borderRadius:12,padding:'20px 22px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          {field('Step title',<input value={curStep.title||''} onChange={e=>setStep(seqTab,'title',e.target.value)} style={inp} placeholder="LinkedIn CR + Note"/>)}
                          {field('Timing',<input value={curStep.meta||''} onChange={e=>setStep(seqTab,'meta',e.target.value)} style={inp} placeholder="Day 1"/>)}
                        </div>
                        {field(<span>Subject line <span style={{color:'#4a5568',fontWeight:400,textTransform:'none',letterSpacing:0}}>· email steps only</span></span>,
                          <input value={curStep.subject||''} onChange={e=>setStep(seqTab,'subject',e.target.value)} style={inp} placeholder="Leave blank for LinkedIn steps"/>)}
                        {field('Message body',
                          <textarea rows={12} value={curStep.body||''} onChange={e=>setStep(seqTab,'body',e.target.value)} style={fi} placeholder="Write the full outreach message here..."/>)}
                      </div>
                    </div>
                  )}
                </div>
                {/* Footer */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'16px 28px',borderTop:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <span style={{font:'12px Inter,sans-serif',color:'#4a5568'}}>Assigned to <strong style={{color:CAMP_COLORS_REF[allCampaigns.length%CAMP_COLORS_REF.length]}}>{form.assignee||'Laura'}</strong> · will appear in the campaign selector</span>
                    {saveErr&&<span style={{color:'#F2667A',font:'12px Inter,sans-serif'}}>{saveErr}</span>}
                  </div>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>{setBriefNewOpen(false);setSaveErr('');}} 
                      style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',
                        background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>Cancel</button>
                    <button onClick={save} disabled={!form.title.trim()||saving}
                      style={{padding:'9px 24px',borderRadius:8,border:'none',
                        background:(form.title.trim()&&!saving)?'#06E5EC':'rgba(6,229,236,.3)',
                        color:'#000814',font:'700 13px Inter,sans-serif',cursor:(form.title.trim()&&!saving)?'pointer':'default',
                        letterSpacing:'.01em'}}>{saving?'Saving…':'Create brief'}</button>
                  </div>
                </div>
              </div>
            </div>
          );
        };
        return <NewBriefForm key="new-brief"/>;
      })()}

      {/* ═ EXPORT CAMPAIGNS MODAL ═ */}
      {exportOpen&&(()=>{
        const ExportModal=()=>{
          const [fmt,setFmt]=useState('docx');
          const [sel,setSel]=useState(()=>{
            const s={}; allCampaigns.forEach((_,i)=>{ s[i]=true; }); return s;
          });
          const [exporting,setExporting]=useState(false);
          const [done,setDone]=useState(false);

          const toggleAll=v=>{ const s={}; allCampaigns.forEach((_,i)=>{ s[i]=v; }); setSel(s); };
          const allOn=Object.values(sel).every(Boolean);
          const selCount=Object.values(sel).filter(Boolean).length;

          const getCampContent=(idx)=>{
            const base=allCampaigns[idx]||{};
            const ov=campEdits[idx]||{};
            const def=CAMP_DEFAULTS[idx]||{};
            const c={...def,...base,...ov};
            if(!c.sequence) c.sequence=DEFAULT_SEQUENCE;
            return c;
          };

          const doExport=async()=>{
            setExporting(true);
            const indices=Object.entries(sel).filter(([,v])=>v).map(([k])=>Number(k));
            if(fmt==='docx') await exportDocx(indices);
            else await exportPdf(indices);
            setExporting(false); setDone(true);
          };

          const exportDocx=async(indices)=>{
            const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
              Table, TableRow, TableCell, WidthType, Packer } = await import('docx');
            const { saveAs } = await import('file-saver');

            const h=(text,level=1)=>new Paragraph({heading:level===1?HeadingLevel.HEADING_1:level===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,children:[new TextRun({text,bold:true})]});
            const p=(text,opts={})=>new Paragraph({children:[new TextRun({text,...opts})],spacing:{after:120}});
            const hr=()=>new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'CCCCCC'}},spacing:{after:200}});
            const bullet=(text)=>new Paragraph({bullet:{level:0},children:[new TextRun({text,size:20})],spacing:{after:60}});

            const sections=[];
            for(const idx of indices){
              const c=getCampContent(idx);
              const camp=allCampaigns[idx];
              sections.push(
                h(`${camp.num}. ${c.title||camp.title}`,1),
                p(c.sub||camp.sub||'',{italics:true,color:'666666'}),
                new Paragraph({spacing:{after:200}}),
                h('Ideal Customer Profile',2),
                ...( c.icp||[]).map(r=>p(`${r.label}: ${r.value}`,{bold:false})),
                new Paragraph({spacing:{after:200}}),
                h('Target Personas',2),
                ...(c.personas||[]).map(bullet),
                new Paragraph({spacing:{after:200}}),
                h('Sourcing Signals',2),
                ...(c.signals||[]).map(bullet),
                new Paragraph({spacing:{after:200}}),
                h('Hook — The Pain',2),
                p(c.hook||''),
                new Paragraph({spacing:{after:200}}),
                h('Value Proposition',2),
                p(c.valueProp||''),
                new Paragraph({spacing:{after:200}}),
                h('4-Touch Outreach Sequence',2),
                ...(c.sequence||[]).flatMap((s,i)=>[
                  h(`Step ${i+1}: ${s.title} — ${s.meta}`,3),
                  ...(s.subject?[p(`Subject: ${s.subject}`,{italics:true})]:[]),
                  ...( s.body||'').split('\n').map(line=>line?p(line):new Paragraph({spacing:{after:80}})),
                  new Paragraph({spacing:{after:160}}),
                ]),
                hr(),
                new Paragraph({spacing:{after:400}}),
              );
            }

            const doc=new Document({sections:[{properties:{},children:sections}],
              creator:'Bold Business',description:'Campaign Briefs'});
            const blob=await Packer.toBlob(doc);
            saveAs(blob,`campaign-briefs-${new Date().toISOString().slice(0,10)}.docx`);
          };

          const exportPdf=async(indices)=>{
            const { jsPDF } = await import('jspdf');
            const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
            const PW=190, ML=10, MR=200;
            let y=20;
            const checkPage=(h=10)=>{ if(y+h>280){ doc.addPage(); y=20; } };
            const heading=(text,sz=14,bold=true)=>{
              checkPage(sz+4); doc.setFont('helvetica',bold?'bold':'normal');
              doc.setFontSize(sz); doc.setTextColor(20,20,20);
              doc.text(text,ML,y); y+=sz*0.5+4;
            };
            const body=(text,sz=10,color=[60,60,60])=>{
              doc.setFont('helvetica','normal'); doc.setFontSize(sz); doc.setTextColor(...color);
              const lines=doc.splitTextToSize(text||'',PW);
              checkPage(lines.length*sz*0.5+2);
              doc.text(lines,ML,y); y+=lines.length*sz*0.45+3;
            };
            const rule=()=>{ checkPage(6); doc.setDrawColor(200,200,200); doc.line(ML,y,MR,y); y+=8; };

            for(let ii=0;ii<indices.length;ii++){
              const idx=indices[ii]; if(ii>0){ doc.addPage(); y=20; }
              const c=getCampContent(idx); const camp=allCampaigns[idx];
              heading(`${camp.num}. ${c.title||camp.title}`,15);
              body(c.sub||camp.sub||'',10,[120,120,120]);
              y+=4;
              heading('Ideal Customer Profile',12);
              (c.icp||[]).forEach(r=>body(`• ${r.label}: ${r.value}`,10));
              y+=3;
              heading('Target Personas',12);
              (c.personas||[]).forEach(r=>body(`• ${r}`,10));
              y+=3;
              heading('Sourcing Signals',12);
              (c.signals||[]).forEach(r=>body(`→ ${r}`,10));
              y+=3;
              heading('Hook — The Pain',12);
              body(c.hook||'',10);
              y+=3;
              heading('Value Proposition',12);
              body(c.valueProp||'',10);
              y+=3;
              heading('4-Touch Outreach Sequence',12);
              (c.sequence||[]).forEach((s,i)=>{
                heading(`Step ${i+1}: ${s.title} — ${s.meta}`,11,true);
                if(s.subject) body(`Subject: ${s.subject}`,9,[90,90,140]);
                body(s.body||'',9);
                y+=2;
              });
              rule();
            }
            doc.save(`campaign-briefs-${new Date().toISOString().slice(0,10)}.pdf`);
          };

          const btnStyle=(active)=>({
            flex:1,padding:'10px 0',borderRadius:8,cursor:'pointer',
            border:`1px solid ${active?'#06E5EC':'rgba(255,255,255,.1)'}`,
            background:active?'rgba(6,229,236,.12)':'rgba(255,255,255,.03)',
            color:active?'#06E5EC':'#7E8DB5',font:`${active?700:500} 13px Inter,sans-serif`,
            transition:'all .15s',
          });

          return (
            <div style={OVL} onClick={()=>setExportOpen(false)}>
              <div style={{width:'100%',maxWidth:620,background:'#080f2a',
                border:'1px solid rgba(255,255,255,.1)',borderRadius:16,
                boxShadow:'0 40px 100px rgba(0,0,0,.7)',overflow:'hidden'}}
                onClick={e=>e.stopPropagation()}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'18px 24px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
                  <div>
                    <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>⤓ Export Campaign Briefs</div>
                    <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5',marginTop:3}}>Download as Word document or PDF</div>
                  </div>
                  <button style={XBTN} onClick={()=>setExportOpen(false)}>×</button>
                </div>

                <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>
                  {/* Format picker */}
                  <div>
                    <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>Format</div>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setFmt('docx')} style={btnStyle(fmt==='docx')}>📝 Word (.docx)</button>
                      <button onClick={()=>setFmt('pdf')} style={btnStyle(fmt==='pdf')}>📄 PDF (.pdf)</button>
                    </div>
                  </div>

                  {/* Campaign selector */}
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5'}}>
                        Campaigns <span style={{color:'#4a5568',fontWeight:400,textTransform:'none',letterSpacing:0}}>({selCount} selected)</span>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>toggleAll(true)} style={{font:'11px Inter,sans-serif',color:'#06E5EC',background:'none',border:'none',cursor:'pointer',padding:0}}>Select all</button>
                        <span style={{color:'#4a5568'}}>·</span>
                        <button onClick={()=>toggleAll(false)} style={{font:'11px Inter,sans-serif',color:'#7E8DB5',background:'none',border:'none',cursor:'pointer',padding:0}}>None</button>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:0,
                      border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden',maxHeight:340,overflowY:'auto'}}>
                      {allCampaigns.map((c,i)=>{
                        const on=sel[i];
                        return (
                          <label key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
                            borderBottom:i<allCampaigns.length-1?'1px solid rgba(255,255,255,.05)':'none',
                            cursor:'pointer',background:on?'rgba(6,229,236,.04)':'transparent',transition:'background .12s'}}>
                            <input type="checkbox" checked={!!on} onChange={e=>setSel(p=>({...p,[i]:e.target.checked}))}
                              style={{accentColor:'#06E5EC',width:15,height:15,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                {c.sdr&&<span style={{font:'600 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',
                                  color:c.sdr==='Laura'?'#06E5EC':'#F5B945',flexShrink:0}}>{c.sdr}</span>}
                                <span style={{font:'600 13px Inter,sans-serif',color:on?'#EAF0FF':'#9FB0D8',
                                  whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.num}. {c.title}</span>
                              </div>
                              <div style={{font:'11px Inter,sans-serif',color:'#4a5568',marginTop:1,
                                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.sub}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'16px 24px',borderTop:'1px solid rgba(255,255,255,.07)'}}>
                  {done
                    ?<span style={{font:'13px Inter,sans-serif',color:'#2DD4BF'}}>✓ Download started</span>
                    :<span style={{font:'12px Inter,sans-serif',color:'#4a5568'}}>{selCount} campaign{selCount!==1?'s':''} selected</span>
                  }
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>setExportOpen(false)}
                      style={{padding:'9px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',
                        background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>Cancel</button>
                    <button onClick={doExport} disabled={exporting||selCount===0}
                      style={{padding:'9px 24px',borderRadius:8,border:'none',
                        background:selCount>0?'#06E5EC':'rgba(6,229,236,.3)',
                        color:'#000814',font:'700 13px Inter,sans-serif',
                        cursor:selCount>0?'pointer':'default',letterSpacing:'.01em'}}>
                      {exporting?'Generating...':done?'Download again':`Export ${selCount} brief${selCount!==1?'s':''}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        };
        return <ExportModal key="export"/>;
      })()}

      {/* ═ ADD/EDIT CAMPAIGN MODAL ═ */}
      {campModal&&(
        <div style={OVL} onClick={()=>{setCampModal(null);setCampNameOpen(false);setCampNameQ('');}}>
          <div style={{...MBOX,maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={MHDR}>
              <div style={{font:'700 17px Inter,sans-serif',color:'#fff'}}>
                {campModal.mode==='edit'?'Edit Campaign':'Add Campaign'}
              </div>
              <button style={XBTN} onClick={()=>{setCampModal(null);setCampNameOpen(false);setCampNameQ('');setCampError('');}}>×</button>
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'20px 24px'}}>
              <form onSubmit={handleSaveCamp}>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {/* Campaign name — combobox: dropdown + free-type */}
                  <div style={{display:'flex',flexDirection:'column',gap:4,position:'relative'}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Campaign Name *</label>
                    <input
                      required
                      value={campModal.form.campaign_name}
                      placeholder="Type to search or enter a new name"
                      autoComplete="off"
                      onFocus={()=>{ setCampNameQ(campModal.form.campaign_name); setCampNameOpen(true); }}
                      onBlur={()=>setTimeout(()=>setCampNameOpen(false),180)}
                      onChange={e=>{
                        const v=e.target.value;
                        setCampModal(m=>({...m,form:{...m.form,campaign_name:v}}));
                        setCampNameQ(v);
                        setCampNameOpen(true);
                      }}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                        font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                    {campNameOpen&&(()=>{
                      const q=(campNameQ||'').toLowerCase();
                      const filtered=campNames.filter(n=>n.toLowerCase().includes(q)).slice(0,100);
                      if(!filtered.length) return null;
                      return(
                        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
                          background:'#0d1a42',border:'1px solid rgba(255,255,255,.15)',
                          borderRadius:8,boxShadow:'0 8px 32px rgba(0,0,0,.5)',
                          maxHeight:220,overflowY:'auto',marginTop:2}}>
                          {filtered.map(n=>(
                            <div key={n}
                              onMouseDown={e=>{
                                e.preventDefault();
                                setCampModal(m=>({...m,form:{...m.form,campaign_name:n}}));
                                setCampNameOpen(false);
                              }}
                              style={{padding:'9px 12px',font:'13px Inter,sans-serif',color:'#EAF0FF',
                                cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)',
                                transition:'background .1s'}}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(6,229,236,.1)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              {n}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {/* SDR / Account */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>SDR (Account) *</label>
                    <select required value={campModal.form.account_id}
                      onChange={e=>setCampModal(m=>({...m,form:{...m.form,account_id:e.target.value}}))}
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                      <option value="">Select SDR...</option>
                      {[
                        {id:32887,name:'Abhinanda Deb'},{id:32871,name:'Lenore Kopko'},
                        {id:32894,name:'George Georgiou'},{id:32891,name:'Laura Petersen'},
                        {id:32893,name:'Darren Stuart'},{id:33364,name:'Mariana Lopez'},
                        {id:33347,name:'Bob Toll'},
                      ].map(a=>(
                        <option key={a.id} value={String(a.id)} style={{background:'#0d1a42'}}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Target ICP */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Target ICP</label>
                    <input value={campModal.form.target_icp}
                      onChange={e=>setCampModal(m=>({...m,form:{...m.form,target_icp:e.target.value}}))}
                      placeholder="e.g. Commercial Furniture Dealers · 50–500 employees · US"
                      style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                  </div>
                  {/* Channel + Activity + Date row */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Channel</label>
                      <select value={campModal.form.channel}
                        onChange={e=>setCampModal(m=>({...m,form:{...m.form,channel:e.target.value}}))}
                        style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                        {['LinkedIn + Email','LinkedIn','Email','InMail','Cold Call','Multi-channel'].map(ch=>(
                          <option key={ch} value={ch} style={{background:'#0d1a42'}}>{ch}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Activity</label>
                      <input value={campModal.form.activity}
                        onChange={e=>setCampModal(m=>({...m,form:{...m.form,activity:e.target.value}}))}
                        placeholder="e.g. CR, Email, InMail"
                        style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Launch Date</label>
                      <input type="date" value={campModal.form.created_at}
                        onChange={e=>setCampModal(m=>({...m,form:{...m.form,created_at:e.target.value}}))}
                        style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                    </div>
                  </div>
                  {/* Stats grid */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    {[
                      ['CR Sent','connections_requested'],
                      ['CR Accepted','connection_requests_accepted'],
                      ['Replies','connection_replies'],
                      ['Emails Sent','emails_sent'],
                    ].map(([lbl,key])=>(
                      <div key={key} style={{display:'flex',flexDirection:'column',gap:4}}>
                        <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>{lbl}</label>
                        <input type="number" min="0" value={campModal.form[key]}
                          onChange={e=>setCampModal(m=>({...m,form:{...m.form,[key]:e.target.value}}))}
                          style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
                  <button type="button" onClick={()=>{setCampModal(null);setCampNameOpen(false);setCampNameQ('');setCampError('');}}
                    style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'none',
                      color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>
                    Cancel
                  </button>
                  <button type="submit" disabled={campSaving}
                    style={{padding:'9px 26px',borderRadius:8,border:'none',
                      background:'linear-gradient(135deg,#4446DB,#6366F1)',
                      color:'#fff',font:'700 13px Inter,sans-serif',cursor:'pointer',opacity:campSaving?.6:1}}>
                    {campError&&<div style={{color:'#F2667A',font:'12px Inter,sans-serif',marginBottom:12,padding:'8px 10px',background:'rgba(242,102,122,.1)',borderRadius:6,border:'1px solid rgba(242,102,122,.25)'}}>{campError}</div>}
                    {campSaving?'Saving...':(campModal.mode==='edit'?'Save Changes':'Add Campaign')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═ CALLS MODAL ═ */}
      {callsModal&&(
        <div style={OVL} onClick={()=>{setCallsModal(null);cancelEditCall();}}>
          <div style={MBOX} onClick={e=>e.stopPropagation()}>
            <div style={MHDR}>
              <div style={{font:'700 17px Inter,sans-serif',color:'#fff'}}>Call Records - {callsModal.name}</div>
              <button style={XBTN} onClick={()=>{setCallsModal(null);cancelEditCall();}}>×</button>
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'16px 22px'}}>
              {/* ── Log / Edit form (top) ── */}
              <form onSubmit={handleAddCall} style={{marginBottom:20,paddingBottom:20,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.08em'}}>
                    {editingCallId?'Edit Call Record':'Log a Call'}
                  </div>
                  {editingCallId&&(
                    <button type="button" onClick={cancelEditCall}
                      style={{font:'600 12px Inter,sans-serif',color:'#9FB0D8',background:'none',border:'1px solid rgba(255,255,255,.12)',
                        borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>
                      Cancel
                    </button>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[['Campaign','select'],['Contact Name *','text'],['Title','text'],['Company','text'],['LinkedIn URL','url'],['Call Date *','date']].map(([lbl,type])=>{
                    const key={Campaign:'campaign_name','Contact Name *':'contact_name',Title:'contact_title',Company:'contact_company','LinkedIn URL':'contact_linkedin','Call Date *':'call_date'}[lbl];
                    return(
                      <div key={lbl} style={{display:'flex',flexDirection:'column',gap:4}}>
                        <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>{lbl}</label>
                        {type==='select'
                          ?<select value={callForm.campaign_name} onChange={e=>setCallForm(p=>({...p,campaign_name:e.target.value}))}
                              style={{padding:'8px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                              <option value="">Select campaign...</option>
                              {(callsModal.campaign_list||[]).map(c=>(
                                <option key={c.campaign_name} value={c.campaign_name} style={{background:'#0d1a42'}}>{c.campaign_name}</option>
                              ))}
                            </select>
                          :<input type={type} value={callForm[key]||''} required={lbl.includes('*')}
                              onChange={e=>setCallForm(p=>({...p,[key]:e.target.value}))}
                              style={{padding:'8px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)'}}/>
                        }
                      </div>
                    );
                  })}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Outcome</label>
                    <select value={callForm.outcome} onChange={e=>setCallForm(p=>({...p,outcome:e.target.value}))}
                        style={{padding:'8px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42'}}>
                      {['completed','positive','neutral','negative','voicemail','no-answer','scheduled'].map(o=>(
                        <option key={o} value={o} style={{background:'#0d1a42',textTransform:'capitalize'}}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4}}>
                    <label style={{font:'700 11px Inter,sans-serif',color:'#7E8DB5',textTransform:'uppercase',letterSpacing:'.06em'}}>Notes</label>
                    <textarea rows={3} value={callForm.notes} onChange={e=>setCallForm(p=>({...p,notes:e.target.value}))}
                        style={{padding:'8px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)',resize:'vertical',fontFamily:'Inter,sans-serif'}}/>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
                  <button type="submit" disabled={addingCall}
                      style={{padding:'9px 26px',borderRadius:9,border:'none',
                        background:editingCallId?'linear-gradient(135deg,#059669,#10b981)':'linear-gradient(135deg,#4446DB,#6366F1)',
                        color:'#fff',font:'700 13px Inter,sans-serif',cursor:'pointer',opacity:addingCall?.6:1}}>
                    {addingCall?(editingCallId?'Saving...':'Saving...'):(editingCallId?'Save Changes':'Log Call')}
                  </button>
                </div>
              </form>

              {/* ── Call records list (below form) ── */}
              {callModalRecords.length===0
                ?<p style={{color:'#7E8DB5',fontSize:13,textAlign:'center',padding:'24px 0'}}>No calls logged yet.</p>
                :<div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {callModalRecords.map(r=>{
                    const isEditing=editingCallId===r.id;
                    const outClr={completed:'#059669',positive:'#059669',neutral:'#d97706',negative:'#dc2626',voicemail:'#7c3aed','no-answer':'#9ca3af',scheduled:'#2563eb'}[r.outcome]||'#6b7280';
                    return(
                      <div key={r.id} style={{border:`1px solid ${isEditing?'rgba(99,102,241,.5)':'rgba(255,255,255,.08)'}`,borderRadius:10,padding:'12px 14px',
                        background:isEditing?'rgba(99,102,241,.07)':'rgba(255,255,255,.02)',transition:'all .15s'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                          <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
                            <span style={{font:'700 14px Inter,sans-serif',color:'#fff'}}>{r.contact_name||'-'}</span>
                            {r.contact_title&&<span style={{font:'12px Inter,sans-serif',color:'#9FB0D8'}}>{r.contact_title}</span>}
                            {r.contact_company&&<span style={{font:'12px Inter,sans-serif',color:'#9FB0D8'}}>@ {r.contact_company}</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                            {r.call_date&&<span style={{font:'600 11px Inter,sans-serif',color:'#9FB0D8',background:'rgba(255,255,255,.08)',padding:'2px 8px',borderRadius:20}}>{r.call_date?.split?.('T')[0]||r.call_date}</span>}
                            <span style={{font:'700 11px Inter,sans-serif',color:'#fff',background:outClr,padding:'2px 8px',borderRadius:20,textTransform:'capitalize'}}>{r.outcome}</span>
                            {r.contact_linkedin&&<a href={r.contact_linkedin} target="_blank" rel="noreferrer" style={{font:'600 11px Inter,sans-serif',color:'#06E5EC',background:'rgba(6,229,236,.1)',padding:'2px 8px',borderRadius:20,textDecoration:'none',border:'1px solid rgba(6,229,236,.2)'}}>LinkedIn</a>}
                            {/* Edit button */}
                            <button onClick={()=>isEditing?cancelEditCall():startEditCall(r)}
                              title={isEditing?'Cancel edit':'Edit'}
                              style={{background:isEditing?'rgba(99,102,241,.2)':'rgba(255,255,255,.06)',border:`1px solid ${isEditing?'rgba(99,102,241,.5)':'rgba(255,255,255,.12)'}`,
                                width:26,height:26,borderRadius:6,color:isEditing?'#818CF8':'#9FB0D8',cursor:'pointer',
                                fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {isEditing?'✕':'✎'}
                            </button>
                            {/* Delete button */}
                            <button onClick={()=>handleDeleteCall(r.id)}
                              style={{background:'none',border:'none',width:24,height:24,borderRadius:'50%',
                                color:'rgba(255,255,255,.25)',cursor:'pointer',fontSize:16,
                                display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                          </div>
                        </div>
                        {r.campaign_name&&<div style={{marginTop:7,font:'600 11px Inter,sans-serif',color:'#06E5EC',background:'rgba(6,229,236,.1)',display:'inline-block',padding:'2px 10px',borderRadius:20}}>{r.campaign_name}</div>}
                        {r.notes&&<p style={{margin:'6px 0 0',font:'italic 12px Inter,sans-serif',color:'#9FB0D8',lineHeight:1.6}}>{r.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* 1 ── Sales overview label + period selector + sync ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <div className="cc-sect-label" style={{marginBottom:0}}>Sales overview</div>
        {/* Period pills + custom range — Sales overview */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',gap:4,background:'rgba(255,255,255,.04)',border:'1px solid rgba(124,124,245,.25)',borderRadius:10,padding:4}}>
            {PERIODS.map(p=>{
              const active=period===p.id&&!(spStart&&spEnd);
              return(
                <button key={p.id} onClick={()=>{
                  setPeriod(p.id);
                  setSpStart(null); setSpEnd(null); setSpPhase('start');
                }} style={{
                  padding:'5px 12px',border:'none',cursor:'pointer',borderRadius:7,
                  background:active?'rgba(124,124,245,.3)':'transparent',
                  font:`${active?700:500} 11px/1 Inter,sans-serif`,
                  color:active?'#EAF0FF':'#7E8DB5',transition:'all .15s'}}>
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* Sales custom date-range picker */}
          <div style={{position:'relative'}} ref={spRef}>
            <div onClick={()=>setSpOpen(o=>!o)}
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'7px 13px',
                background:(spStart&&spEnd)?'rgba(124,124,245,.18)':'rgba(255,255,255,.04)',
                border:(spStart&&spEnd)?'1px solid rgba(124,124,245,.7)':'1px solid rgba(124,124,245,.35)',
                borderRadius:10,color:'#EAF0FF',font:'600 13px/1 Inter,sans-serif',cursor:'pointer',
                transition:'all .15s'}}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth={2}>
                <rect x={3} y={4} width={18} height={18} rx={2}/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {spLabel}
            </div>
            {spOpen&&(
              <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:60,width:310,
                background:'#fff',borderRadius:16,boxShadow:'0 24px 60px rgba(2,8,32,.45)',padding:18}}>
                {/* Month nav */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div onClick={()=>{ if(spM===0){setSpM(11);setSpY(y=>y-1);}else setSpM(m=>m-1); }}
                    style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,cursor:'pointer',color:'#4446DB',fontSize:18}}>‹</div>
                  <div style={{font:'700 15px Inter,sans-serif',color:'#1F2A44',whiteSpace:'nowrap'}}>{MONTHS[spM]} {spY}</div>
                  <div onClick={()=>{ if(spM===11){setSpM(0);setSpY(y=>y+1);}else setSpM(m=>m+1); }}
                    style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,cursor:'pointer',color:'#4446DB',fontSize:18}}>›</div>
                </div>
                {/* Day-of-week header */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:8}}>
                  {['S','M','T','W','T','F','S'].map((d,i)=>(
                    <span key={i} style={{textAlign:'center',font:'700 13px Inter,sans-serif',color:'#9AA3B8'}}>{d}</span>
                  ))}
                </div>
                {/* Weeks */}
                {spWeeks.map((wk,wi)=>(
                  <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:3}}>
                    {wk.map((day,di)=>(
                      <div key={di} onClick={()=>spPickDay(day)} style={spDayStyle(day)}>{day||''}</div>
                    ))}
                  </div>
                ))}
                {/* Footer */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  marginTop:12,paddingTop:12,borderTop:'1px solid #EEF1F6'}}>
                  <span onClick={()=>{ setSpStart(null);setSpEnd(null);setSpPhase('start');setSpOpen(false); }}
                    style={{cursor:'pointer',font:'700 14px Inter,sans-serif',letterSpacing:'.04em',color:'#4446DB'}}>CLEAR</span>
                  <span style={{font:'italic 400 13px Inter,sans-serif',color:'#9AA3B8'}}>
                    {spPhase==='start'?'Click a start date':'Click an end date'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2 ── Key metrics - single consolidated card ── */}
      <div style={{background:'linear-gradient(135deg,rgba(0,59,223,.22),rgba(6,229,236,.07))',
        border:'1px solid rgba(6,229,236,.24)',borderRadius:12,padding:'18px 22px',marginBottom:26,overflowX:'auto'}}>
        {/* CSS-grid layout: 9 equal columns, 3 fixed rows (label / value / sub)
             so every number sits on the exact same baseline regardless of label length */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(9,1fr)',
          gridTemplateRows:'36px 56px 20px',
          columnGap:0,
          minWidth:860,
        }}>
          {[
            {label:'Contacts reached',  val:s.new_contacts??s.cr_sent,                          sub:s.total_campaigns?`${s.total_campaigns} campaigns`:null, sc:'#2DD4BF'},
            {label:'Responses received',val:s.total_replies,                                     sub:'from all channels', sc:'#2DD4BF'},
            {label:'Emails sent',       val:s.emails_sent,                                       sub:null},
            {label:'Reply rate',        val:s.reply_rate!=null?`${s.reply_rate}%`:null,          sub:'from emails sent',  sc:'#2DD4BF'},
            {label:'Bounce / opt-out',  val:s.bounce_rate!=null?`${s.bounce_rate}%`:null,        sub:'email health',      sc:'#8FA9CC'},
            {label:'CR sent',           val:s.cr_sent,                                           sub:null,                sc:'#8FA9CC'},
            {label:'CR accepted %',     val:s.accept_rate!=null?`${s.accept_rate}%`:null,        sub:s.cr_accepted!=null?`${s.cr_accepted} accepted`:null, sc:'#2DD4BF'},
            {label:'Meetings booked',   val:s.meetings_booked,                                   sub:'pipeline',          sc:'#B2F7F9'},
            {label:'Actual meetings',   val:s.actual_meetings??0,                               sub:'vs. booked',        sc:'#B2F7F9'},
          ].flatMap((m,i)=>[
            /* Row 1 - label */
            <div key={`l${i}`} style={{
              gridRow:1, gridColumn:i+1,
              padding:'0 18px',
              borderLeft:i>0?'1px solid rgba(255,255,255,.1)':'none',
              font:'600 11px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',
              color:'#8FA9CC',lineHeight:1.25,
              display:'flex',alignItems:'flex-start',paddingTop:0,
            }}>{m.label}</div>,
            /* Row 2 - value */
            <div key={`v${i}`} style={{
              gridRow:2, gridColumn:i+1,
              padding:'0 18px',
              borderLeft:i>0?'1px solid rgba(255,255,255,.1)':'none',
              display:'flex',alignItems:'center',
            }}>
              {skyLoad
                ? <div className="cc-skel" style={{height:46,width:70}}/>
                : <div style={{font:'700 46px/1 Inter,sans-serif',color:'#fff'}}>{m.val!=null?fmtN(m.val):'-'}</div>}
            </div>,
            /* Row 3 - sub */
            <div key={`s${i}`} style={{
              gridRow:3, gridColumn:i+1,
              padding:'0 18px',
              borderLeft:i>0?'1px solid rgba(255,255,255,.1)':'none',
              font:'12px Inter,sans-serif',color:m.sc||'#2DD4BF',
              display:'flex',alignItems:'flex-start',
            }}>{m.sub||''}</div>,
          ])}
        </div>
      </div>

      {/* 3 ── Campaign performance sandbox ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div className="cc-sect-label" style={{marginBottom:0}}>Campaign performance sandbox</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{position:'relative',flexShrink:0}}>
            <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7E8DB5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={sbSearch}
              onChange={e=>{ setSbSearch(e.target.value); setSbPage(0); }}
              placeholder="Search campaigns…"
              style={{paddingLeft:30,paddingRight:sbSearch?24:10,height:32,borderRadius:8,
                border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',
                color:'#EAF0FF',font:'13px Inter,sans-serif',outline:'none',width:200}}/>
            {sbSearch&&(
              <span onClick={()=>{ setSbSearch(''); setSbPage(0); }}
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                  color:'#7E8DB5',cursor:'pointer',fontSize:14,lineHeight:1}}>×</span>
            )}
          </div>
          <button onClick={()=>setSbCallModal(true)}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,
              border:'1px solid rgba(245,185,69,.4)',background:'rgba(245,185,69,.08)',
              color:'#F5B945',font:'600 12px Inter,sans-serif',cursor:'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(245,185,69,.16)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(245,185,69,.08)';}}>
            <span style={{fontSize:16,lineHeight:1}}>+</span> Add Call Log
          </button>
          <button onClick={openAddCamp}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,
              border:'1px solid rgba(6,229,236,.4)',background:'rgba(6,229,236,.08)',
              color:'#06E5EC',font:'600 12px Inter,sans-serif',cursor:'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(6,229,236,.16)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(6,229,236,.08)';}}>
            <span style={{fontSize:16,lineHeight:1}}>+</span> Add Campaign
          </button>
        </div>
      </div>
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,overflow:'hidden',marginBottom:26}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1.7fr 1.1fr 1fr .9fr 90px',
          padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'rgba(2,8,32,.3)'}}>
          {['Campaign name','Target ICP','Channel','Key metric','Status',''].map((h,i)=>(
            <span key={i} style={{font:'600 11px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',color:'#7E8DB5'}}>{h}</span>
          ))}
        </div>
        {sbLoad
          ? [1,2,3,4,5].map(i=>(
              <div key={i} style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                <div className="cc-skel" style={{height:18,width:'55%'}}/>
              </div>
            ))
          : (sbData?.campaigns||[]).length===0
            ? <div style={{padding:32,textAlign:'center',font:'13px Inter,sans-serif',color:'#7E8DB5'}}>No campaigns found for this date range.</div>
            : (()=>{
                const sbCamps=(sbData.campaigns||[]).filter(c=>!sbSearch||c.name.toLowerCase().includes(sbSearch.toLowerCase())||(c.target_icp||'').toLowerCase().includes(sbSearch.toLowerCase()));
                const sbPaged=sbCamps.slice(sbPage*SB_PER_PAGE,(sbPage+1)*SB_PER_PAGE);
                return <>{ sbPaged.map((c,i)=>{
                const open=sbOpen===i;
                const rp=c.reply_pct||0;
                const status=rp>=15?'Lean in':rp>=5?'Steady':rp>2?'Sandbox testing':'Pivot required';
                const sc=rp>=15?'#06E5EC':rp>=5?'#F5B945':rp>2?'#4D8DFF':'#F2667A';
                const sbg=rp>=15?'rgba(6,229,236,.15)':rp>=5?'rgba(245,185,69,.15)':rp>2?'rgba(77,141,255,.15)':'rgba(242,102,122,.15)';
                const mc=rp>=15?'#06E5EC':rp>=5?'#F5B945':'#F2667A';
                const AC=['#06E5EC','#4D8DFF','#8B7CF6','#2DD4BF','#F5B945','#F2667A','#B79CFF'];
                const AB=['rgba(6,229,236,.16)','rgba(77,141,255,.16)','rgba(139,124,246,.16)','rgba(45,212,191,.16)','rgba(245,185,69,.14)','rgba(242,102,122,.15)','rgba(183,156,255,.16)'];
                const t=c.totals||{};
                return (
                  <div key={i} style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1.7fr 1.1fr 1fr .9fr 90px',
                        alignItems:'center',padding:'13px 16px',
                        background:open?'rgba(6,229,236,.06)':'transparent',transition:'background .12s'}}>
                      <span onClick={()=>setSbOpen(open?null:i)} style={{font:'600 15px Inter,sans-serif',color:'#EAF0FF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                        {c.name}
                        {c.is_manual&&<span style={{fontSize:9,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',padding:'2px 6px',borderRadius:4,background:'rgba(139,124,246,.2)',color:'#8B7CF6',flexShrink:0,border:'1px solid rgba(139,124,246,.3)'}}>Manual</span>}
                      </span>
                      <span onClick={()=>setSbOpen(open?null:i)} style={{font:'13px Inter,sans-serif',color:'#9FB0D8',cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={c.target_icp||'—'}>{c.target_icp||<span style={{color:'#4a5568',fontStyle:'italic'}}>—</span>}</span>
                      <span onClick={()=>setSbOpen(open?null:i)} style={{font:'13px Inter,sans-serif',color:'#EAF0FF',cursor:'pointer'}}>{c.channel||'LinkedIn + Email'}</span>
                      <span onClick={()=>setSbOpen(open?null:i)} style={{font:'700 14px Inter,sans-serif',fontFamily:'monospace',color:mc,cursor:'pointer'}}>{c.key_metric}</span>
                      <span onClick={()=>setSbOpen(open?null:i)} style={{cursor:'pointer'}}><span style={{font:'700 11px Inter,sans-serif',textTransform:'uppercase',letterSpacing:'.03em',padding:'3px 9px',borderRadius:20,color:sc,background:sbg}}>{status}</span></span>
                      {/* Actions: edit + delete + expand */}
                      <span style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                        <button
                          onClick={e=>{e.stopPropagation();openEditCamp(c,(c.agents||[])[0]||{});}}
                          title="Edit campaign"
                          style={{width:26,height:26,borderRadius:6,border:'1px solid rgba(255,255,255,.12)',
                            background:'rgba(255,255,255,.06)',color:'#9FB0D8',cursor:'pointer',
                            fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          ✎
                        </button>
                        <button
                          onClick={e=>{e.stopPropagation();handleDeleteCamp((c.agents||[])[0]?.campaign_id);}}
                          title="Delete campaign"
                          disabled={campDeleting===(c.agents||[])[0]?.campaign_id}
                          style={{width:26,height:26,borderRadius:6,border:'1px solid rgba(242,102,122,.25)',
                            background:'rgba(242,102,122,.06)',color:'#F2667A',cursor:'pointer',
                            fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                            opacity:campDeleting===(c.agents||[])[0]?.campaign_id?.4:1}}>
                          ×
                        </button>
                        <span onClick={()=>setSbOpen(open?null:i)} style={{fontSize:15,color:'#7E8DB5',cursor:'pointer',width:20,textAlign:'center'}}>{open?'⌃':'⌄'}</span>
                      </span>
                    </div>
                    {open&&(
                      <div style={{padding:'6px 16px 16px',background:'rgba(2,8,32,.35)'}}>
                        <div style={{font:'600 11px Inter,sans-serif',letterSpacing:'.08em',textTransform:'uppercase',color:'#06E5EC',margin:'10px 0 8px'}}>Performance by SDR</div>
                        <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'12px 14px',overflowX:'auto'}}>
                          <div style={{display:'grid',gridTemplateColumns:GC,paddingBottom:9,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                            <span style={{font:'600 11px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5'}}>Agent</span>
                            {['Camp','CR Sent','Accept','Acc%','Replies','Rep%','Calls','Actual Mtgs','Emails','LI out'].map(h=>(
                              <span key={h} style={{font:'600 11px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5',textAlign:'right'}}>{h}</span>
                            ))}
                          </div>
                          {(c.agents||[]).map((r,j)=>{
                            // Build synthetic SDR row for replies/calls modals
                            const sbSdrRow = {
                              name:        r.agent,
                              account_id:  r.account_id,
                              campaign_list: [{
                                campaign_id:                  r.campaign_id,
                                campaign_name:                c.name,
                                account_id:                   r.account_id,
                                connections_requested:        r.cr_sent,
                                connection_requests_accepted: r.cr_accepted,
                                connection_replies:           r.replies,
                                emails_sent:                  r.emails,
                                activity:                     r.activity || '',
                                calls:                        r.calls,
                              }],
                            };
                            return (
                            <div key={j} style={{display:'grid',gridTemplateColumns:GC,alignItems:'center',padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                              <span style={{display:'flex',alignItems:'center',gap:7,font:'600 14px Inter,sans-serif',color:'#fff'}}>
                                <span style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',font:'800 11px Inter,sans-serif',color:AC[j%7],background:AB[j%7]}}>{(r.agent||'?')[0].toUpperCase()}</span>
                                {r.agent}
                              </span>
                              <span style={{...M,color:'#EAF0FF'}}>{r.campaigns||'-'}</span>
                              <span style={{...M,color:'#06E5EC'}}>{(r.cr_sent||0).toLocaleString()}</span>
                              <span style={{...M,color:'#EAF0FF'}}>{(r.cr_accepted||0).toLocaleString()}</span>
                              <span style={{textAlign:'right'}}>{pctPill(r.accept_pct)}</span>
                              <span style={{textAlign:'right'}}>{numPill(r.replies,r.replies>0?e=>{e.stopPropagation();setRepliesModal(sbSdrRow);setRepliesDrill(null);}:null)}</span>
                              <span style={{textAlign:'right'}}>{pctPill(r.reply_pct)}</span>
                              <span style={{textAlign:'right'}}>{numPill(r.calls,r.calls>0?e=>{e.stopPropagation();setCallsModal({...sbSdrRow,_period:spEffectivePeriod,_start:spEffectiveStart,_end:spEffectiveEnd});}:null)}</span>
                              <span style={{...M,color:'#2DD4BF'}}>{(r.actual_meetings||0).toLocaleString()}</span>
                              <span style={{...M,color:'#06E5EC'}}>{(r.emails||0).toLocaleString()}</span>
                              <span style={{...M,color:'#EAF0FF'}}>{(r.li_out||0).toLocaleString()}</span>
                            </div>
                            );
                          })}
                          {(()=>{
                            // Campaign-total row: one entry per agent merged into a list for drill-down
                            const totalSdrRows = (c.agents||[]).map(r=>({
                              campaign_id:                  r.campaign_id,
                              campaign_name:                c.name,
                              account_id:                   r.account_id,
                              connections_requested:        r.cr_sent,
                              connection_requests_accepted: r.cr_accepted,
                              connection_replies:           r.replies,
                              emails_sent:                  r.emails,
                              activity:                     r.activity || '',
                              calls:                        r.calls,
                            }));
                            // Use the first agent's account_id for the modal; replies modal shows per-campaign list
                            const firstAgent = (c.agents||[])[0] || {};
                            const totRepliesSdrRow = {
                              name: c.name,
                              account_id: firstAgent.account_id,
                              campaign_list: totalSdrRows,
                            };
                            const totCallsSdrRow = { ...totRepliesSdrRow };
                            return (
                          <div style={{display:'grid',gridTemplateColumns:GC,alignItems:'center',padding:'10px 0 2px',borderTop:'1px solid rgba(255,255,255,.12)',marginTop:2}}>
                            <span style={{font:'700 14px Inter,sans-serif',color:'#fff'}}>Campaign total</span>
                            <span style={{...M,color:'#fff'}}>{t.campaigns||'-'}</span>
                            <span style={{...M,color:'#fff'}}>{(t.cr_sent||0).toLocaleString()}</span>
                            <span style={{...M,color:'#fff'}}>{(t.cr_accepted||0).toLocaleString()}</span>
                            <span style={{textAlign:'right'}}>{pctPill(t.accept_pct,true)}</span>
                            <span style={{textAlign:'right'}}>{numPill(t.replies,t.replies>0?e=>{e.stopPropagation();setRepliesModal(totRepliesSdrRow);setRepliesDrill(null);}:null)}</span>
                            <span style={{textAlign:'right'}}>{pctPill(t.reply_pct,true)}</span>
                            <span style={{textAlign:'right'}}>{numPill(t.calls,t.calls>0?e=>{e.stopPropagation();setCallsModal({...totCallsSdrRow,_period:spEffectivePeriod,_start:spEffectiveStart,_end:spEffectiveEnd});}:null)}</span>
                            <span style={{...M,color:'#2DD4BF'}}>{(t.actual_meetings||0).toLocaleString()}</span>
                            <span style={{...M,color:'#fff'}}>{(t.emails||0).toLocaleString()}</span>
                            <span style={{...M,color:'#fff'}}>{(t.li_out||0).toLocaleString()}</span>
                          </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}<Pager page={sbPage} setPage={setSbPage} total={sbCamps.length} perPage={SB_PER_PAGE}/></>;
              })()
        }
      </div>

      {/* 4 ── 3-col: Meetings booked | Top campaigns | Low campaigns ── */}
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr',gap:12,marginBottom:26}}>
        {/* Meetings booked */}
        <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:16}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:13}}>
            <div style={{font:'700 14px Inter,sans-serif',color:'#fff'}}>Meetings booked</div>
            <div style={{font:'700 20px Inter,sans-serif',color:'#06E5EC'}}>{skyLoad?'...':(s.meetings_booked??'-')}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {mtgBkLoad
              ? [1,2,3].map(i=><div key={i} className="cc-skel" style={{height:28,borderRadius:6}}/>)
              : (mtgBk?.items||[]).length===0
                ? <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5'}}>No calls logged yet</div>
                : (mtgBk.items||[]).map((m,i)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',font:'13px Inter,sans-serif',marginBottom:4}}>
                      <span style={{color:'#EAF0FF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'75%'}}>{m.name}</span>
                      <span style={{color:'#06E5EC',fontWeight:700,marginLeft:8}}>{m.booked}</span>
                    </div>
                    <div style={{height:5,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${m.pct}%`,background:'linear-gradient(90deg,#003BDF,#06E5EC)',borderRadius:3,transition:'width .4s ease'}}/>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
        {/* Top-performing campaigns */}
        <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:16}}>
          <div style={{font:'600 12px Inter,sans-serif',letterSpacing:'.08em',textTransform:'uppercase',color:'#06E5EC',marginBottom:12}}>Top-performing campaigns</div>
          {campLoad
            ? [1,2,3].map(i=><div key={i} className="cc-skel" style={{height:38,marginBottom:14,borderRadius:7}}/>)
            : (campRank?.top||[]).length===0
              ? <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5'}}>No data yet</div>
              : <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {(campRank.top||[]).map((c,i)=>{
                    const mx=campRank.top[0]?.reply_pct||1;
                    const bw=mx>0?Math.round((c.reply_pct/mx)*100):0;
                    return (
                      <div key={c.id||i} style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{font:'700 14px/1.35 Inter,sans-serif',color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name}</div>
                          <div style={{height:4,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden',marginTop:9}}>
                            <div style={{height:'100%',width:`${bw}%`,background:'linear-gradient(90deg,#003BDF,#06E5EC)',borderRadius:3,transition:'width .4s'}}/>
                          </div>
                        </div>
                        <div style={{textAlign:'right',whiteSpace:'nowrap'}}>
                          <div style={{font:'700 15px Inter,sans-serif',color:'#06E5EC'}}>{c.reply_pct}% reply</div>
                          <div style={{font:'12px Inter,sans-serif',color:'#9FB0D8',marginTop:6}}>{c.agent} · {c.cr_sent} CR</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          }
        </div>
        {/* Low-performing campaigns */}
        <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{font:'700 15px Inter,sans-serif',color:'#fff'}}>Low-performing campaigns</div>
            {!campLoad&&<span style={{font:'700 12px Inter,sans-serif',padding:'2px 9px',borderRadius:20,background:'rgba(245,185,69,.15)',color:'#F5B945'}}>{campRank?.low?.length??0}</span>}
          </div>
          {campLoad
            ? [1,2,3].map(i=><div key={i} className="cc-skel" style={{height:38,marginBottom:12,borderRadius:7}}/>)
            : (campRank?.low||[]).length===0
              ? <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5'}}>No campaigns ≤ 2% reply rate</div>
              : <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {(campRank.low||[]).map((c,i)=>{
                    const clr=c.reply_pct===0?'#F2667A':c.reply_pct<=1?'#F87171':'#F5B945';
                    return (
                      <div key={c.id||i} style={{display:'flex',gap:9,alignItems:'flex-start'}}>
                        <span style={{width:8,height:8,borderRadius:'50%',marginTop:6,flexShrink:0,background:clr}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}>
                            <span style={{font:'600 14px Inter,sans-serif',color:'#EAF0FF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.name}</span>
                            <span style={{font:'700 15px/1 monospace',whiteSpace:'nowrap',color:clr,flexShrink:0}}>{c.reply_pct}% reply</span>
                          </div>
                          <div style={{font:'14px Inter,sans-serif',color:'#7E8DB5',marginTop:3}}>{c.agent} · {c.cr_sent} CR sent</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          }
        </div>
      </div>

      {/* 5 ── SDR performance summary ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="cc-sect-label" style={{marginBottom:0}}>SDR performance summary</div>
          <span style={{font:'13px Inter,sans-serif',color:'#7E8DB5'}}>Calls &amp; replies open detail modals</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Period pills - same style as Sales overview */}
          <div style={{display:'flex',gap:4,background:'rgba(255,255,255,.04)',border:'1px solid rgba(124,124,245,.25)',borderRadius:10,padding:4}}>
            {PERIODS.map(p=>{
              const active=sdrPeriod===p.id&&!(dpStart&&dpEnd);
              return(
                <button key={p.id} onClick={()=>{
                  setSdrPeriod(p.id);
                  // Clear calendar range when a pill is picked
                  setDpStart(null); setDpEnd(null); setDpPhase('start');
                }} style={{
                  padding:'5px 12px',border:'none',cursor:'pointer',borderRadius:7,
                  background:active?'rgba(124,124,245,.3)':'transparent',
                  font:`${active?700:500} 11px/1 Inter,sans-serif`,
                  color:active?'#EAF0FF':'#7E8DB5',transition:'all .15s'}}>
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* Calendar date-range picker - matches Design 1 exactly */}
          <div style={{position:'relative'}} ref={dpRef}>
            <div onClick={()=>setDpOpen(o=>!o)}
              style={{display:'inline-flex',alignItems:'center',gap:10,padding:'8px 14px',
                background:(dpStart&&dpEnd)?'rgba(124,124,245,.18)':'rgba(255,255,255,.04)',
                border:(dpStart&&dpEnd)?'1px solid rgba(124,124,245,.7)':'1px solid rgba(124,124,245,.45)',
                borderRadius:10,color:'#EAF0FF',font:'600 14px/1 monospace',cursor:'pointer'}}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth={2}>
                <rect x={3} y={4} width={18} height={18} rx={2}/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {dpLabel}
            </div>
            {dpOpen&&(
              <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:60,width:320,
                background:'#fff',borderRadius:16,boxShadow:'0 24px 60px rgba(2,8,32,.45)',padding:18}}>
                {/* Month nav */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div onClick={()=>{ if(dpM===0){setDpM(11);setDpY(y=>y-1);}else setDpM(m=>m-1); }}
                    style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',
                      borderRadius:8,cursor:'pointer',color:'#4446DB',fontSize:18}}>‹</div>
                  <div style={{font:'700 15px Inter,sans-serif',color:'#1F2A44',whiteSpace:'nowrap'}}>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'][dpM]} {dpY}
                  </div>
                  <div onClick={()=>{ if(dpM===11){setDpM(0);setDpY(y=>y+1);}else setDpM(m=>m+1); }}
                    style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',
                      borderRadius:8,cursor:'pointer',color:'#4446DB',fontSize:18}}>›</div>
                </div>
                {/* Day-of-week header */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:8}}>
                  {['S','M','T','W','T','F','S'].map((d,i)=>(
                    <span key={i} style={{textAlign:'center',font:'700 13px Inter,sans-serif',color:'#9AA3B8'}}>{d}</span>
                  ))}
                </div>
                {/* Weeks */}
                {dpWeeks.map((wk,wi)=>(
                  <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:3}}>
                    {wk.map((day,di)=>(
                      <div key={di} onClick={()=>dpPickDay(day)} style={dpDayStyle(day)}>{day||''}</div>
                    ))}
                  </div>
                ))}
                {/* Footer */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  marginTop:12,paddingTop:12,borderTop:'1px solid #EEF1F6'}}>
                  <span onClick={()=>{ setDpStart(null);setDpEnd(null);setDpPhase('start');setDpOpen(false);setSdrPeriod('7d'); }}
                    style={{cursor:'pointer',font:'700 14px Inter,sans-serif',letterSpacing:'.04em',color:'#4446DB'}}>CLEAR</span>
                  <span style={{font:'italic 400 14px Inter,sans-serif',color:'#9AA3B8'}}>
                    {dpPhase==='start'?'Click a start date':'Click an end date'}
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* Sync button — inline with filters */}
          <button
            onClick={handleSync}
            disabled={syncing||syncDone}
            title={syncing?'Syncing…':syncDone?'Done!':'Sync from Skylead'}
            style={{
              display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
              padding:'7px 14px',borderRadius:10,border:'none',
              cursor:(syncing||syncDone)?'default':'pointer',
              font:'600 12px Inter,sans-serif',
              transition:'background .25s, color .25s',
              background: syncDone
                ? 'rgba(45,212,191,.18)'
                : syncing
                ? 'rgba(16,185,129,.08)'
                : 'rgba(16,185,129,.12)',
              color: syncDone ? '#2DD4BF' : syncing ? '#6ee7b7' : '#34D399',
              minWidth:120,
            }}>
            {syncDone ? (
              /* Checkmark — appears after sync completes */
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Synced!
              </>
            ) : syncing ? (
              /* Spinning loader */
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  style={{animation:'cc-spin 0.8s linear infinite'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Syncing…
              </>
            ) : (
              /* Default state */
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Sync Skylead
              </>
            )}
          </button>
        </div>
      </div>
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:'14px 16px',marginBottom:26,overflowX:'auto'}}>
        {sdrLoad
          ? [1,2,3,4].map(i=><div key={i} className="cc-skel" style={{height:36,marginBottom:8}}/>)
          : <>
            <div style={{display:'grid',gridTemplateColumns:GC,paddingBottom:9,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
              <span style={{...TH,textAlign:'left'}}>Agent</span>
              {['Camp','CR Sent','Accept','Acc%','Replies','Rep%','Calls','Emails','LI out'].map(h=>(
                <span key={h} style={TH}>{h}</span>
              ))}
            </div>
            {pagedSdrRows.map((r,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:GC,alignItems:'center',padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                <span style={{display:'flex',alignItems:'center',gap:7,font:'600 16px Inter,sans-serif',color:'#fff'}}>
                  <span style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',font:'800 13px Inter,sans-serif',color:r.color,background:r.bg}}>{r.initial}</span>
                  {r.name}
                </span>
                <span style={{font:'16px/1 monospace',color:'#EAF0FF',textAlign:'right'}}>{r.campaigns??'-'}</span>
                <span style={{font:'16px/1 monospace',color:'#06E5EC',textAlign:'right'}}>{fmtN(r.cr_sent)}</span>
                <span style={{font:'16px/1 monospace',color:'#EAF0FF',textAlign:'right'}}>{fmtN(r.cr_accepted)}</span>
                <span style={{textAlign:'right'}}>{pctPill(r.accept_pct)}</span>
                <span style={{textAlign:'right'}}>{numPill(r.replies,()=>{setRepliesModal(r);setRepliesDrill(null);})}</span>
                <span style={{textAlign:'right'}}>{pctPill(r.reply_pct)}</span>
                <span style={{textAlign:'right'}}>{numPill(r.calls,()=>setCallsModal({...r,_period:sdrEffectivePeriod,_start:sdrEffectiveStart,_end:sdrEffectiveEnd}))}</span>
                <span style={{font:'16px/1 monospace',color:'#06E5EC',textAlign:'right'}}>{fmtN(r.emails)}</span>
                <span style={{font:'16px/1 monospace',color:'#EAF0FF',textAlign:'right'}}>{fmtN(r.li_out)}</span>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:GC,alignItems:'center',padding:'10px 0 2px',borderTop:'1px solid rgba(255,255,255,.12)',marginTop:2}}>
              <span style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>Fleet total</span>
              <span style={{font:'16px/1 monospace',color:'#fff',textAlign:'right'}}>{tot.campaigns||'-'}</span>
              <span style={{font:'16px/1 monospace',color:'#fff',textAlign:'right'}}>{fmtN(tot.cr_sent)||'-'}</span>
              <span style={{font:'16px/1 monospace',color:'#fff',textAlign:'right'}}>{fmtN(tot.cr_accepted)||'-'}</span>
              <span style={{textAlign:'right'}}>{pctPill(tot.cr_sent?`${Math.round(tot.cr_accepted/tot.cr_sent*100)}%`:'-',true)}</span>
              <span style={{textAlign:'right'}}>{numPill(tot.replies)}</span>
              <span style={{textAlign:'right'}}>{pctPill(tot.cr_sent?`${Math.round(tot.replies/tot.cr_sent*100)}%`:'-',true)}</span>
              <span style={{textAlign:'right'}}>{numPill(tot.calls)}</span>
              <span style={{font:'16px/1 monospace',color:'#fff',textAlign:'right'}}>{fmtN(tot.emails)||'-'}</span>
              <span style={{font:'16px/1 monospace',color:'#fff',textAlign:'right'}}>{fmtN(tot.li_out)||'-'}</span>
            </div>
            <Pager page={sdrPage} setPage={setSdrPage} total={rows.length} perPage={SDR_PER_PAGE}/>
          </>
        }
      </div>

      {/* 6 ── Agent fleet · live status ── */}
      <div className="cc-sect-label">Agent fleet · live status</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:26}}>
        {AGENTS.map(ag=>(
          <div key={ag.id} onClick={()=>setModalAgent(ag)}
            style={{background:'rgba(255,255,255,.035)',border:`1px solid ${ag.cardBorder}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 4px 20px ${ag.color}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:34,height:34,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',font:'800 15px Inter,sans-serif',color:ag.color,background:ag.bg,border:`2px solid ${ag.border}`}}>{ag.initial}</div>
              <div style={{flex:1}}>
                <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>{ag.label}</div>
              </div>
              <span style={{width:7,height:7,borderRadius:'50%',background:ag.status==='active'?'#2DD4BF':'#F5B945',boxShadow:`0 0 8px ${ag.status==='active'?'#2DD4BF':'#F5B945'}`}}/>
            </div>
          </div>
        ))}
      </div>

      {/* 7 ── Follow-Up Command Center ── */}
      <div className="cc-sect-label">Follow-Up Command Center</div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{font:'700 15px Inter,sans-serif',letterSpacing:'.02em',color:'#06E5EC'}}>Deal Follow-up</div>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7E8DB5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={fu1Search} onChange={e=>{setFu1Search(e.target.value);setP1Page(0);}} placeholder="Search contacts, deals…"
            style={{paddingLeft:30,paddingRight:fu1Search?24:10,height:32,borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
              background:'rgba(255,255,255,.05)',color:'#EAF0FF',font:'13px Inter,sans-serif',outline:'none',width:220}}/>
          {fu1Search&&<span onClick={()=>{setFu1Search('');setP1Page(0);}} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'#7E8DB5',cursor:'pointer',fontSize:14}}>×</span>}
        </div>
      </div>
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,overflow:'hidden',marginBottom:22}}>
        <div style={{display:'grid',gridTemplateColumns:'1.1fr 1.4fr 1fr 1.8fr 1.1fr',padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'rgba(2,8,32,.3)'}}>
          {['Contact','Deal','Deal stage','Note','Last updated'].map(h=>(
            <span key={h} style={{font:'600 13px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',color:'#7E8DB5'}}>{h}</span>
          ))}
        </div>
        {followUpsLoad&&[1,2,3].map(i=>(
          <div key={i} style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
            <div className="cc-skel" style={{height:18,width:'60%'}}/>
          </div>
        ))}
        {!followUpsLoad&&(()=>{
          const q=fu1Search.toLowerCase();
          const fu1Filtered=(followUps?.priority1||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.stage?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          if(fu1Filtered.length===0) return <div style={{padding:28,textAlign:'center',font:'13px Inter,sans-serif',color:'#7E8DB5'}}>{fu1Search?'No results found.':'No tagged follow-ups found in HubSpot.'}</div>;
          return null;
        })()}
        {!followUpsLoad&&(()=>{
          const q=fu1Search.toLowerCase();
          const fu1Filtered=(followUps?.priority1||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.stage?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          return fu1Filtered.slice(p1Page*FU_PER_PAGE,(p1Page+1)*FU_PER_PAGE).map((r,i,a)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1.1fr 1.4fr 1fr 1.8fr 1.1fr',alignItems:'center',padding:'13px 16px',
            borderBottom:i<a.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
            <span style={{font:'600 14px Inter,sans-serif',color:'#EAF0FF'}}>{r.name}</span>
            {r.hs_url
              ?<a href={r.hs_url} target="_blank" rel="noopener noreferrer"
                  style={{font:'14px Inter,sans-serif',color:'#06E5EC',textDecoration:'none',overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}
                  onMouseEnter={e=>e.target.style.textDecoration='underline'}
                  onMouseLeave={e=>e.target.style.textDecoration='none'}>{r.company}</a>
              :<span style={{font:'14px Inter,sans-serif',color:'#cdd6ee',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.company}</span>}
            <span><span style={{font:'700 10px Inter,sans-serif',textTransform:'uppercase',letterSpacing:'.03em',
              padding:'3px 9px',borderRadius:20,color:r.stageClr,background:r.stageBg,whiteSpace:'nowrap'}}>{r.stage}</span></span>
            <span style={{font:'13px/1.5 Inter,sans-serif',color:r.note?'#9FB0D8':'#4a5170',fontStyle:r.note?'normal':'italic'}}>
              {r.note||'—'}
            </span>
            <span style={{font:'13px Inter,sans-serif',color:'#9FB0D8'}}>{r.last_modified}</span>
          </div>
        ))})()}
        {!followUpsLoad&&(()=>{
          const q=fu1Search.toLowerCase();
          const fu1Filtered=(followUps?.priority1||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.stage?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          return fu1Filtered.length>FU_PER_PAGE?<div style={{padding:'8px 16px'}}><Pager page={p1Page} setPage={setP1Page} total={fu1Filtered.length} perPage={FU_PER_PAGE}/></div>:null;
        })()}
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{font:'700 15px Inter,sans-serif',letterSpacing:'.02em',color:'#06E5EC'}}>Task List Follow-up</div>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7E8DB5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={fu2Search} onChange={e=>{setFu2Search(e.target.value);setP2Page(0);}} placeholder="Search contacts, deals…"
            style={{paddingLeft:30,paddingRight:fu2Search?24:10,height:32,borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
              background:'rgba(255,255,255,.05)',color:'#EAF0FF',font:'13px Inter,sans-serif',outline:'none',width:220}}/>
          {fu2Search&&<span onClick={()=>{setFu2Search('');setP2Page(0);}} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'#7E8DB5',cursor:'pointer',fontSize:14}}>×</span>}
        </div>
      </div>
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,overflow:'hidden',marginBottom:26}}>
        <div style={{display:'grid',gridTemplateColumns:'1.2fr 1.6fr 1.1fr 2.1fr',padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'rgba(2,8,32,.3)'}}>
          {['Contact','Deal','Follow-up date','Note'].map(h=>(
            <span key={h} style={{font:'600 13px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',color:'#7E8DB5'}}>{h}</span>
          ))}
        </div>
        {followUpsLoad&&[1,2,3].map(i=>(
          <div key={i} style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
            <div className="cc-skel" style={{height:18,width:'70%'}}/>
          </div>
        ))}
        {!followUpsLoad&&(()=>{
          const q=fu2Search.toLowerCase();
          const fu2Filtered=(followUps?.priority2||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.date?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          if(fu2Filtered.length===0) return <div style={{padding:28,textAlign:'center',font:'13px Inter,sans-serif',color:'#7E8DB5'}}>{fu2Search?'No results found.':'No active deals needing follow-up found.'}</div>;
          return null;
        })()}
        {!followUpsLoad&&(()=>{
          const q=fu2Search.toLowerCase();
          const fu2Filtered=(followUps?.priority2||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.date?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          return fu2Filtered.slice(p2Page*FU_PER_PAGE,(p2Page+1)*FU_PER_PAGE).map((r,i,a)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1.2fr 1.6fr 1.1fr 2.1fr',alignItems:'center',padding:'14px 16px',
            borderBottom:i<a.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
            <span style={{font:'600 14px Inter,sans-serif',color:'#EAF0FF'}}>{r.name}</span>
            {r.hs_url
              ?<a href={r.hs_url} target="_blank" rel="noopener noreferrer"
                  style={{font:'14px Inter,sans-serif',color:'#06E5EC',textDecoration:'none',overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}
                  onMouseEnter={e=>e.target.style.textDecoration='underline'}
                  onMouseLeave={e=>e.target.style.textDecoration='none'}>{r.company}</a>
              :<span style={{font:'14px Inter,sans-serif',color:'#cdd6ee',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.company}</span>}
            <span style={{font:'13px/1 monospace',color:r.date&&r.date.includes('overdue')?'#F2667A':'#9FB0D8',whiteSpace:'nowrap'}}>{r.date||'-'}</span>
            <span style={{font:'13px/1.5 Inter,sans-serif',color:'#9FB0D8'}}>{r.note}</span>
          </div>
        ))})()}
        {!followUpsLoad&&(()=>{
          const q=fu2Search.toLowerCase();
          const fu2Filtered=(followUps?.priority2||[]).filter(r=>!q||r.name?.toLowerCase().includes(q)||r.company?.toLowerCase().includes(q)||r.date?.toLowerCase().includes(q)||r.note?.toLowerCase().includes(q));
          return fu2Filtered.length>FU_PER_PAGE?<div style={{padding:'8px 16px'}}><Pager page={p2Page} setPage={setP2Page} total={fu2Filtered.length} perPage={FU_PER_PAGE}/></div>:null;
        })()}
      </div>


      {/* ── Campaign Brief ── */}
      <div className="cc-sect-label">Campaign brief</div>

{/* Campaign selector */}
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:'18px 20px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}>
          <div style={{font:'700 13px Inter,sans-serif',letterSpacing:'.09em',textTransform:'uppercase',color:'#9FB0D8'}}>
            {person==='All'?'All Campaigns':`${person}'s Campaigns`}
            {reorderMode&&<span style={{marginLeft:10,font:'500 11px Inter,sans-serif',color:'#F5B945',textTransform:'none',letterSpacing:'normal'}}>‹ drag cards to reorder ›</span>}
          </div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
            {(['All',...Array.from(new Set(customCampaigns.map(c=>c.assignee||c.sdr).filter(Boolean))).sort()]).map(p=>{
              const active=person===p;
              return <button key={p} onClick={()=>setPerson(p)} style={{
                padding:'5px 12px',borderRadius:20,cursor:'pointer',
                border:active?'none':`1px solid rgba(255,255,255,.12)`,
                background:active?'#06E5EC':'transparent',
                font:`${active?700:400} 11px/1 Inter,sans-serif`,
                color:active?'#000':'#7E8DB5',transition:'all .15s'}}>
                {p}
              </button>;
            })}
            <button onClick={()=>setReorderMode(m=>!m)} style={{
              padding:'4px 10px',borderRadius:6,cursor:'pointer',
              border:`1px solid ${reorderMode?'rgba(245,185,69,.5)':'rgba(255,255,255,.12)'}`,
              background:reorderMode?'rgba(245,185,69,.1)':'transparent',
              font:'600 10px Inter,sans-serif',
              color:reorderMode?'#F5B945':'#7E8DB5',transition:'all .15s'}}>
              {reorderMode?'Done':'⠿ Reorder'}
            </button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {filteredCamps.map((c,di)=>{
            const active=campIdx===c._gi;
            const isDragging=dragIdx===di;
            const isDragOver=dragOverIdx===di&&dragIdx!==di;
            return <div key={c._gi}
              draggable={reorderMode}
              onDragStart={reorderMode?(e)=>{ e.dataTransfer.effectAllowed='move'; setDragIdx(di); }:undefined}
              onDragEnter={reorderMode?()=>setDragOverIdx(di):undefined}
              onDragOver={reorderMode?(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }:undefined}
              onDragLeave={reorderMode?()=>setDragOverIdx(null):undefined}
              onDrop={reorderMode?async(e)=>{
                e.preventDefault();
                if(dragIdx===null||dragIdx===di){ setDragIdx(null); setDragOverIdx(null); return; }
                const fromGi=filteredCamps[dragIdx]?._gi;
                const toGi=filteredCamps[di]?._gi;
                if(fromGi===undefined||toGi===undefined){ setDragIdx(null); setDragOverIdx(null); return; }
                const newAll=[...customCampaigns];
                const [moved]=newAll.splice(fromGi,1);
                newAll.splice(toGi,0,moved);
                const renumbered=newAll.map((c,i)=>({...c,num:i+1,sort_order:i+1}));
                setCustomCampaigns(renumbered);
                if(campIdx===fromGi) setCampIdx(toGi);
                else if(fromGi<toGi&&campIdx>fromGi&&campIdx<=toGi) setCampIdx(campIdx-1);
                else if(fromGi>toGi&&campIdx<fromGi&&campIdx>=toGi) setCampIdx(campIdx+1);
                setDragIdx(null); setDragOverIdx(null);
                const orderPayload=renumbered.map((c,i)=>({id:c._dbId,sort_order:i+1})).filter(x=>x.id!=null);
                fetch('/api/campaign-briefs/reorder',{
                  method:'POST',
                  headers:{...authHeaders(),'Content-Type':'application/json'},
                  body:JSON.stringify({order:orderPayload}),
                }).catch(()=>{});
              }:undefined}
              onDragEnd={reorderMode?()=>{ setDragIdx(null); setDragOverIdx(null); }:undefined}
              onClick={!reorderMode?()=>setCampIdx(c._gi):undefined}
              className="brief-card"
              style={{
                position:'relative',
                padding:'12px 14px',borderRadius:10,
                cursor:reorderMode?'grab':'pointer',
                background:isDragOver?`${c.color}22`:active?`${c.color}12`:'rgba(255,255,255,.025)',
                border:`1px solid ${isDragOver?c.color:active?c.color+'55':'rgba(255,255,255,.08)'}`,
                transition:'all .15s',opacity:isDragging?0.4:1,
                transform:isDragOver?'scale(1.02)':'none',
                userSelect:'none'}}>
              {/* Delete button — circle ×, top-right, hover-only */}
              {!reorderMode&&(
                <button
                  onClick={e=>{ e.stopPropagation(); setBriefToDelete({_gi:c._gi,_dbId:c._dbId,title:c.title}); }}
                  title="Delete brief"
                  className="brief-card-delete"
                  style={{
                    position:'absolute',top:7,right:7,
                    width:18,height:18,borderRadius:'50%',
                    border:'1px solid rgba(242,102,122,.5)',
                    background:'rgba(13,26,66,.9)',
                    color:'#F2667A',cursor:'pointer',
                    fontSize:12,lineHeight:'16px',padding:0,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    opacity:0,transition:'opacity .15s',flexShrink:0,
                    backdropFilter:'blur(4px)',
                  }}
                >×</button>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                <span style={{font:'700 10px Inter,sans-serif',padding:'2px 7px',borderRadius:20,
                  background:`${c.color}18`,color:c.color,textTransform:'uppercase',letterSpacing:'.04em'}}>
                  {c.num}. {c.sdr||c.assignee||'Laura'}
                </span>
                {reorderMode&&<span style={{color:'#7E8DB5',fontSize:14,lineHeight:1,cursor:'grab'}}>::</span>}
              </div>
              <div style={{font:'700 13px/1.35 Inter,sans-serif',color:active?c.color:'#EAF0FF',marginBottom:2}}>{c.title}</div>
              <div style={{font:'11px/1.5 Inter,sans-serif',color:active?c.color+'cc':'#9FB0D8',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{c.sub}</div>
              {c.hiring!==null&&c.hiring!==undefined&&(
                <div style={{marginTop:5,display:'inline-flex',alignItems:'center',gap:4,
                  padding:'2px 7px',borderRadius:20,
                  background:c.hiring?'rgba(34,197,94,.12)':'rgba(239,68,68,.1)',
                  border:`1px solid ${c.hiring?'rgba(34,197,94,.3)':'rgba(239,68,68,.25)'}`,
                  font:'600 10px Inter,sans-serif',
                  color:c.hiring?'#22C55E':'#EF4444',
                  whiteSpace:'nowrap'}}>
                  <span style={{fontSize:8}}>{c.hiring?'●':'○'}</span>
                  Hiring: {c.hiring?'Yes':'No'}
                </div>
              )}
            </div>;
          })}
          {!reorderMode&&<div onClick={()=>setBriefNewOpen(true)} style={{
            padding:'12px 14px',borderRadius:10,cursor:'pointer',
            background:'rgba(255,255,255,.015)',
            border:'1px dashed rgba(255,255,255,.15)',transition:'all .15s',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,minHeight:64}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(6,229,236,.06)';e.currentTarget.style.borderColor='rgba(6,229,236,.3)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.015)';e.currentTarget.style.borderColor='rgba(255,255,255,.15)';}}
          >
            <span style={{font:'22px Inter,sans-serif',color:'rgba(255,255,255,.25)',lineHeight:1}}>+</span>
            <span style={{font:'600 11px Inter,sans-serif',color:'rgba(255,255,255,.3)'}}>New brief</span>
          </div>}
        </div>
      </div>

      {/* Campaign Brief action buttons */}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:12}}>
        <span onClick={()=>setBriefEditOpen(true)} style={{font:'600 10px Inter,sans-serif',color:'#9FB0D8',padding:'5px 11px',
          border:'1px solid rgba(255,255,255,.12)',borderRadius:8,cursor:'pointer'}}>✎ Edit</span>
        <span onClick={()=>setExportOpen(true)} style={{font:'600 10px Inter,sans-serif',
          color:'#06E5EC',padding:'5px 11px',
          border:'1px solid rgba(6,229,236,.35)',borderRadius:8,cursor:'pointer',
          background:'rgba(6,229,236,.07)'}}>&#x2913; Export</span>
      </div>

      {/* ═ DELETE BRIEF CONFIRM MODAL ═ */}
      {briefToDelete&&(
        <div style={OVL} onClick={()=>setBriefToDelete(null)}>
          <div style={{background:'#0d1a42',border:'1px solid rgba(242,102,122,.3)',borderRadius:14,
            padding:'32px 28px',maxWidth:420,width:'100%',boxShadow:'0 24px 80px rgba(0,0,0,.7)'}}
            onClick={e=>e.stopPropagation()}>
            {/* Icon */}
            <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(242,102,122,.12)',
              border:'1px solid rgba(242,102,122,.3)',display:'flex',alignItems:'center',
              justifyContent:'center',marginBottom:16,fontSize:20}}>&#x26A0;&#xFE0F;</div>
            <div style={{font:'700 16px Inter,sans-serif',color:'#fff',marginBottom:8}}>Delete campaign brief?</div>
            <div style={{font:'13px/1.6 Inter,sans-serif',color:'#9FB0D8',marginBottom:24}}>
              <strong style={{color:'#EAF0FF'}}>{briefToDelete.title}</strong> will be permanently removed.
              This cannot be undone.
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setBriefToDelete(null)}
                style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
                  background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={async()=>{
                const {_gi,_dbId,title}=briefToDelete;
                setBriefToDelete(null);
                // Navigate away if deleting the active card
                if(campIdx===_gi){
                  const allIdxs=_allCamps.map((_,i)=>i).filter(i=>i!==_gi);
                  setCampIdx(allIdxs.length>0?allIdxs[0]:0);
                }
                // Persist to DB first, then reload from DB (never rely on local filter)
                if(_dbId) await fetch(`/api/campaign-briefs/${_dbId}`,{method:'DELETE',headers:authHeaders()}).catch(()=>{});
                loadBriefs();
              }}
                style={{padding:'9px 24px',borderRadius:8,border:'none',
                  background:'#F2667A',color:'#fff',font:'700 13px Inter,sans-serif',cursor:'pointer'}}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brief detail card */}
      <div style={{position:'relative',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',
        borderRadius:12,padding:22,overflow:'hidden'}}>
        {/* Accent top bar */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:camp.color}}/>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{font:'700 18px Inter,sans-serif',color:'#fff'}}>{camp.title}</div>
            <div style={{font:'12px Inter,sans-serif',color:'#9FB0D8',marginTop:3}}>
              Active focus · {camp.sdr||person} · {camp.sub}
            </div>
          </div>
          <span style={{font:'700 10px Inter,sans-serif',padding:'4px 11px',borderRadius:20,
            background:`${camp.color}16`,color:camp.color,textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>
            Active focus
          </span>
        </div>
        <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>
          Ideal customer profile
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {(campContent.icp||[]).map(({label,value})=>(
            <div key={label} style={{background:'rgba(255,255,255,.03)',borderRadius:8,padding:11}}>
              <div style={{font:'600 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5'}}>{label}</div>
              <div style={{font:'600 12px Inter,sans-serif',color:'#EAF0FF',marginTop:3}}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
          <div>
            <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>
              Target personas
            </div>
            {(campContent.personas||[]).map(p=>(
              <div key={p} style={{font:'13px/1.95 Inter,sans-serif',color:'#cdd6ee'}}>• {p}</div>
            ))}
          </div>
          <div>
            <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>
              Sourcing signals
            </div>
            {(campContent.signals||[]).map(s=>(
              <div key={s} style={{font:'13px/1.75 Inter,sans-serif',color:'#cdd6ee'}}>→ {s}</div>
            ))}
          </div>
        </div>
        {/* Hook */}
        <div style={{background:'rgba(6,229,236,.06)',borderLeft:'3px solid rgba(6,229,236,.5)',
          borderRadius:'0 8px 8px 0',padding:'13px 15px',marginBottom:12,font:'13px/1.6 Inter,sans-serif',color:'#cdd6ee'}}>
          <strong style={{color:'#fff'}}>Hook - the pain.</strong>{' '}
          {campContent.hook}
        </div>
        {/* Value prop */}
        <div style={{background:'rgba(0,59,223,.1)',borderLeft:'3px solid rgba(77,141,255,.6)',
          borderRadius:'0 8px 8px 0',padding:'13px 15px',marginBottom:20,font:'13px/1.6 Inter,sans-serif',color:'#cdd6ee'}}>
          <strong style={{color:'#fff'}}>Value proposition.</strong>{' '}
          {campContent.valueProp}
        </div>
        {/* 4-touch sequence */}
        <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:12}}>
          4-touch outreach sequence
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {(campContent.sequence||DEFAULT_SEQUENCE).map((step,i,arr)=>{
            const open=seqOpen===i;
            const bodyLines=(step.body||'').split('\n');
            return (
              <div key={i} style={{display:'flex',gap:0,position:'relative'}}>
                {/* Left timeline */}
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:44,flexShrink:0,paddingTop:2}}>
                  <span style={{width:28,height:28,borderRadius:'50%',background:step.color,color:'#0a0f22',
                    display:'flex',alignItems:'center',justifyContent:'center',font:'800 13px Inter,sans-serif',flexShrink:0,zIndex:1}}>
                    {i+1}
                  </span>
                  {i<arr.length-1&&(
                    <div style={{width:2,flex:1,minHeight:16,background:'rgba(255,255,255,.08)',margin:'4px 0'}}/>
                  )}
                </div>
                {/* Content */}
                <div style={{flex:1,paddingBottom:i<arr.length-1?20:0}}>
                  {/* Header row */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:open?12:0,paddingTop:4}}>
                    <div>
                      <div style={{font:'700 14px Inter,sans-serif',color:'#fff',cursor:'pointer'}} onClick={()=>setSeqOpen(open?null:i)}>{step.title}</div>
                      <div style={{font:'12px Inter,sans-serif',color:'#7E8DB5',marginTop:2}}>{step.meta}</div>
                    </div>
                    <button onClick={()=>setSeqOpen(open?null:i)}
                      style={{flexShrink:0,width:28,height:28,borderRadius:'50%',border:'1px solid rgba(255,255,255,.12)',
                        background:'rgba(255,255,255,.04)',color:'#9FB0D8',font:'14px Inter,sans-serif',
                        cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',
                        transform:open?'rotate(180deg)':'none'}}>
                      ▾
                    </button>
                  </div>
                  {/* Expanded content */}
                  {open&&(
                    <div style={{marginBottom:4}}>
                      {step.subject&&(
                        <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',
                          borderRadius:8,padding:'10px 14px',marginBottom:14}}>
                          <div style={{font:'600 9px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',
                            color:'#7E8DB5',marginBottom:4}}>Subject line</div>
                          <div style={{font:'700 13px Inter,sans-serif',color:'#EAF0FF'}}>{step.subject}</div>
                        </div>
                      )}
                      <div style={{font:'13px/1.75 Inter,sans-serif',color:'#cdd6ee'}}>
                        {bodyLines.map((line,li)=>(
                          line===''?<br key={li}/>
                            :<p key={li} style={{margin:'0 0 0 0'}}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Task List ── */}
      <TaskListSection authHeaders={authHeaders}/>

      {/* ── Library ── */}
      {(()=>{
        const LIBRARY_KEY='cc_library_links_v1';
        const loadLinks=()=>{ try{ return JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]'); }catch{ return []; } };
        const [libLinks,setLibLinks]=useState(loadLinks);
        const [libModal,setLibModal]=useState(false);
        const [libForm,setLibForm]=useState({title:'',url:'',type:'sheet'});
        const [libEdit,setLibEdit]=useState(null); // index being edited

        const saveLinks=(next)=>{ setLibLinks(next); localStorage.setItem(LIBRARY_KEY,JSON.stringify(next)); };

        const openAdd=()=>{ setLibForm({title:'',url:'',type:'sheet'}); setLibEdit(null); setLibModal(true); };
        const openEdit=(i)=>{ setLibForm({...libLinks[i]}); setLibEdit(i); setLibModal(true); };
        const deleteLink=(i)=>{ const next=[...libLinks]; next.splice(i,1); saveLinks(next); };
        const handleLibSave=(e)=>{
          e.preventDefault();
          if(!libForm.title.trim()||!libForm.url.trim()) return;
          const next=[...libLinks];
          if(libEdit!==null) next[libEdit]={...libForm};
          else next.push({...libForm});
          saveLinks(next);
          setLibModal(false);
        };

        const TYPE_META={
          sheet: { label:'Spreadsheet', icon:(
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>), color:'#34a853', bg:'rgba(52,168,83,.12)', border:'rgba(52,168,83,.25)' },
          doc: { label:'Document', icon:(
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>), color:'#4285f4', bg:'rgba(66,133,244,.12)', border:'rgba(66,133,244,.25)' },
          other: { label:'Link', icon:(
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>), color:'#F5B945', bg:'rgba(245,185,69,.12)', border:'rgba(245,185,69,.25)' },
        };

        return (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,marginTop:32}}>
              <div className="cc-sect-label" style={{marginBottom:0}}>Library</div>
              <button onClick={openAdd}
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,
                  border:'1px solid rgba(6,229,236,.4)',background:'rgba(6,229,236,.08)',
                  color:'#06E5EC',font:'600 12px Inter,sans-serif',cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(6,229,236,.16)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(6,229,236,.08)'}>
                <span style={{fontSize:16,lineHeight:1}}>+</span> Add link
              </button>
            </div>

            {libLinks.length===0
              ? <div style={{padding:'24px',textAlign:'center',background:'rgba(255,255,255,.02)',
                  border:'1px dashed rgba(255,255,255,.1)',borderRadius:12,marginBottom:32,
                  font:'13px Inter,sans-serif',color:'#4a5568'}}>
                  No links yet — click <span style={{color:'#06E5EC'}}>+ Add link</span> to add a spreadsheet or doc
                </div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12,marginBottom:32}}>
                  {libLinks.map((lk,i)=>{
                    const m=TYPE_META[lk.type]||TYPE_META.other;
                    return (
                      <div key={i} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${m.border}`,
                        borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,
                        position:'relative',transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background=m.bg;e.currentTarget.style.transform='translateY(-1px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.03)';e.currentTarget.style.transform='';}}
                      >
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:9}}>
                            <span style={{color:m.color,flexShrink:0,display:'flex'}}>{m.icon}</span>
                            <div>
                              <div style={{font:'600 13px Inter,sans-serif',color:'#EAF0FF',lineHeight:1.3}}>{lk.title}</div>
                              <div style={{font:'10px Inter,sans-serif',color:m.color,marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>{m.label}</div>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:4,flexShrink:0}}>
                            <button onClick={()=>openEdit(i)} title="Edit"
                              style={{width:24,height:24,borderRadius:6,border:'1px solid rgba(255,255,255,.1)',
                                background:'rgba(255,255,255,.04)',color:'#7E8DB5',cursor:'pointer',
                                display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>✎</button>
                            <button onClick={()=>deleteLink(i)} title="Remove"
                              style={{width:24,height:24,borderRadius:6,border:'1px solid rgba(242,102,122,.2)',
                                background:'rgba(242,102,122,.06)',color:'#F2667A',cursor:'pointer',
                                display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,lineHeight:1}}>×</button>
                          </div>
                        </div>
                        <a href={lk.url} target="_blank" rel="noopener noreferrer"
                          style={{font:'11px Inter,sans-serif',color:'#7E8DB5',textDecoration:'none',
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                            display:'block',padding:'6px 10px',borderRadius:6,
                            background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.06)',
                            transition:'color .12s'}}
                          onMouseEnter={e=>e.currentTarget.style.color=m.color}
                          onMouseLeave={e=>e.currentTarget.style.color='#7E8DB5'}>
                          ↗ Open link
                        </a>
                      </div>
                    );
                  })}
                </div>
            }

            {/* Add / Edit modal */}
            {libModal&&(
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9000,
                display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
                onClick={()=>setLibModal(false)}>
                <div style={{background:'#080f2a',border:'1px solid rgba(255,255,255,.12)',
                  borderRadius:16,padding:'28px 28px 24px',width:'100%',maxWidth:440,
                  boxShadow:'0 40px 80px rgba(0,0,0,.6)'}}
                  onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                    <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>
                      {libEdit!==null?'Edit link':'Add link'}
                    </div>
                    <button onClick={()=>setLibModal(false)}
                      style={{width:28,height:28,borderRadius:8,border:'1px solid rgba(255,255,255,.12)',
                        background:'rgba(255,255,255,.06)',color:'#9FB0D8',cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>
                  </div>
                  <form onSubmit={handleLibSave}>
                    <div style={{display:'flex',flexDirection:'column',gap:14}}>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        <label style={{font:'700 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5'}}>Title *</label>
                        <input required value={libForm.title} onChange={e=>setLibForm(f=>({...f,title:e.target.value}))}
                          placeholder="e.g. CET Designers Tracker"
                          style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                            font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)',outline:'none'}}/>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        <label style={{font:'700 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5'}}>URL *</label>
                        <input required value={libForm.url} onChange={e=>setLibForm(f=>({...f,url:e.target.value}))}
                          placeholder="https://docs.google.com/..."
                          style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                            font:'13px Inter,sans-serif',color:'#EAF0FF',background:'rgba(255,255,255,.05)',outline:'none'}}/>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        <label style={{font:'700 10px Inter,sans-serif',letterSpacing:'.07em',textTransform:'uppercase',color:'#7E8DB5'}}>Type</label>
                        <select value={libForm.type} onChange={e=>setLibForm(f=>({...f,type:e.target.value}))}
                          style={{padding:'9px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,
                            font:'13px Inter,sans-serif',color:'#EAF0FF',background:'#0d1a42',outline:'none'}}>
                          <option value="sheet" style={{background:'#0d1a42'}}>Spreadsheet</option>
                          <option value="doc" style={{background:'#0d1a42'}}>Document</option>
                          <option value="other" style={{background:'#0d1a42'}}>Other link</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
                      <button type="button" onClick={()=>setLibModal(false)}
                        style={{padding:'9px 20px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',
                          background:'none',color:'#9FB0D8',font:'600 13px Inter,sans-serif',cursor:'pointer'}}>
                        Cancel
                      </button>
                      <button type="submit"
                        style={{padding:'9px 26px',borderRadius:8,border:'none',
                          background:'linear-gradient(135deg,#4446DB,#6366F1)',
                          color:'#fff',font:'700 13px Inter,sans-serif',cursor:'pointer'}}>
                        {libEdit!==null?'Save changes':'Add link'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Email Domains ── */}
      {(()=>{
        const COMPANIES=[
          {
            name:'Mercury Z',
            color:'#06E5EC',
            bg:'rgba(6,229,236,.08)',
            border:'rgba(6,229,236,.25)',
            domains:[
              {domain:'mzintl.com',  label:'Mercury Z International'},
              {domain:'mzglobal.net',label:'Mercury Z Global'},
            ],
          },
          {
            name:'Bold Business',
            color:'#8B7CF6',
            bg:'rgba(139,124,246,.08)',
            border:'rgba(139,124,246,.25)',
            domains:[
              {domain:'boldbusiness.com',label:'Bold Business'},
            ],
          },
        ];
        const [openCo,setOpenCo]=useState(null);
        return (
          <>
            <div className="cc-sect-label" style={{marginTop:32}}>Email sending domains</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:32}}>
              {COMPANIES.map(co=>{
                const isOpen=openCo===co.name;
                return (
                  <div key={co.name}
                    onClick={()=>setOpenCo(isOpen?null:co.name)}
                    style={{background:isOpen?co.bg:'rgba(255,255,255,.03)',border:`1px solid ${isOpen?co.border:'rgba(255,255,255,.08)'}`,
                      borderRadius:12,padding:'18px 20px',position:'relative',overflow:'hidden',
                      cursor:'pointer',transition:'all .18s'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 4px 20px ${co.color}22`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                    {/* accent bar */}
                    <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:co.color}}/>
                    {/* header */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <div style={{font:'700 15px Inter,sans-serif',color:co.color,marginBottom:4}}>{co.name}</div>
                        <div style={{font:'11px Inter,sans-serif',color:'#7E8DB5'}}>{co.domains.length} domain{co.domains.length!==1?'s':''}</div>
                      </div>
                      <span style={{color:'#7E8DB5',fontSize:12,transition:'transform .18s',
                        display:'inline-block',transform:isOpen?'rotate(180deg)':'rotate(0deg)'}}>▼</span>
                    </div>
                    {/* expanded domain list */}
                    {isOpen&&(
                      <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:10}}>
                        {co.domains.map(d=>(
                          <div key={d.domain} style={{background:'rgba(255,255,255,.04)',borderRadius:8,
                            padding:'12px 14px',border:'1px solid rgba(255,255,255,.07)'}}>
                            <div style={{font:'600 9px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',
                              color:'#7E8DB5',marginBottom:5}}>{d.label}</div>
                            <div style={{font:'700 15px Inter,sans-serif',color:co.color,fontFamily:'monospace'}}>{d.domain}</div>
                            <div style={{marginTop:7,display:'flex',alignItems:'center',gap:6}}>
                              <span style={{width:7,height:7,borderRadius:'50%',background:'#2DD4BF',display:'inline-block'}}/>
                              <span style={{font:'11px Inter,sans-serif',color:'#2DD4BF'}}>Active</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

    </div>
  );
}

// ─── Recruiting Tab ───────────────────────────────────────────────────────────
const REC_KPI=[
  {label:'Open reqs',   val:'18',  sub:'6 priority',       color:'#fff',  subColor:'#5AC8FA'},
  {label:'Sourced',     val:'642', sub:'↑ 9%',             color:'#fff',  subColor:'#2DD4BF'},
  {label:'Submittals',  val:'96',  sub:'15% of sourced',   color:'#fff',  subColor:'#7E8DB5'},
  {label:'Interviews',  val:'41',  sub:'43% advance',      color:'#5AC8FA',subColor:'#2DD4BF'},
  {label:'Placements',  val:'12',  sub:'this week',        color:'#fff',  subColor:'#7E8DB5'},
  {label:'Time-to-Fill',val:'22d', sub:'avg days',         color:'#A5B4FC',subColor:'#7E8DB5',highlight:true},
];
const REC_ROWS=[
  {name:'Sarah M.',role:'CET Designer',client:'Steelcase',   midStage:'Phone Screen', midA:5, midT:5, endStage:'Client Interview', endA:4, endT:8,  note:'On track mid-week', noteColor:'#7E8DB5'},
  {name:'James T.',role:'Sales Coordinator',client:'MillerKnoll',midStage:'Submission',midA:3,midT:6, endStage:'Offer',            endA:1, endT:6,  note:'Behind on end goal',noteColor:'#7E8DB5'},
  {name:'Priya N.',role:'RCM Analyst',client:'HCA Health',   midStage:'Sourcing',     midA:12,midT:10,endStage:'Submission',        endA:5, endT:5,  note:'Ahead of pace',     noteColor:'#2DD4BF'},
];
function pBar(a,t,h=4){
  const pct=t?Math.min(100,Math.round((a/t)*100)):0;
  const col=pct>=100?'#2DD4BF':pct>=50?'#F5B945':'#F2667A';
  return {pct,col};
}
const STAGE_MID={color:'#818CF8',bg:'rgba(129,140,248,.14)'};
const STAGE_END={color:'#5AC8FA',bg:'rgba(90,200,250,.14)'};
const REC_CAMP_COLS='1fr 1.7fr 1.2fr 1.1fr .7fr .7fr .8fr .7fr';
const REC_CAMPS=[
  {date:'Jun 30',campaign:'CET Designer Outreach',     account:'Steelcase',   rec:'Sarah M.',  recColor:'#A5B4FC',cr:142,email:418,inmail:96},
  {date:'Jun 29',campaign:'Sales Coordinator Sourcing',account:'MillerKnoll', rec:'James T.',  recColor:'#5AC8FA',cr:98, email:305,inmail:61},
  {date:'Jun 28',campaign:'RCM Analyst Pipeline',      account:'HCA Health',  rec:'Priya N.',  recColor:'#2DD4BF',cr:176,email:512,inmail:88},
  {date:'Jun 28',campaign:'ERP Consultant Search',     account:'Mercury Z',   rec:'Marco D.',  recColor:'#F5B945',cr:54, email:187,inmail:33},
];

function RecruitingTab({ setModalAgent }) {
  const [filter,setFilter]=useState('Weekly');
  const recGridCols='1fr 1.1fr 1fr 1.1fr .95fr 1.1fr .95fr 1.2fr';
  const hdr9={font:'600 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5'};

  const REC_AGENTS = [
    { id:'zara',    label:'Zara',    initial:'Z', role:'BB · Healthcare', color:'#f43f5e', bg:'rgba(244,63,94,.16)',  border:'rgba(244,63,94,.5)',  grad:'linear-gradient(90deg,#9f1239,#f43f5e)', width:'55%', cardBorder:'rgba(244,63,94,.25)',  status:'active', task:'RCM Specialist sourcing' },
    { id:'camilla', label:'Camilla', initial:'C', role:'BB · Finance',   color:'#eab308', bg:'rgba(234,179,8,.14)',  border:'rgba(234,179,8,.45)', grad:'linear-gradient(90deg,#92400e,#eab308)', width:'36%', cardBorder:'rgba(255,255,255,.08)', status:'idle',   task:'Idle · FP&A queued' },
  ];

  return (
    <div style={{maxWidth:1380,margin:'0 auto',padding:'18px 24px 40px'}}>

      {/* ── Recruiting Agent Fleet (same cards as Sales tab) ── */}
      <div className="cc-sect-label">Agent fleet · live status</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:26}}>
        {REC_AGENTS.map(ag=>(
          <div key={ag.id} onClick={()=>setModalAgent(ag)}
            style={{background:'rgba(255,255,255,.035)',border:`1px solid ${ag.cardBorder}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 4px 20px ${ag.color}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:34,height:34,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',font:'800 15px Inter,sans-serif',color:ag.color,background:ag.bg,border:`2px solid ${ag.border}`}}>{ag.initial}</div>
              <div style={{flex:1}}>
                <div style={{font:'700 16px Inter,sans-serif',color:'#fff'}}>{ag.label}</div>
              </div>
              <span style={{width:7,height:7,borderRadius:'50%',background:ag.status==='active'?'#2DD4BF':'#F5B945',boxShadow:`0 0 8px ${ag.status==='active'?'#2DD4BF':'#F5B945'}`}}/>
            </div>
          </div>
        ))}
      </div>
      {/* KPI strip */}
      <div className="cc-sect-label-purple">Recruiting overview · last 7 days</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:26}}>
        {REC_KPI.map((k,i)=>(
          <div key={i} style={{
            background:k.highlight?'linear-gradient(135deg,rgba(129,140,248,.25),rgba(129,140,248,.08))':'rgba(255,255,255,.035)',
            border:`1px solid ${k.highlight?'rgba(129,140,248,.4)':'rgba(255,255,255,.08)'}`,
            borderRadius:12,padding:14}}>
            <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.08em',textTransform:'uppercase',color:'#7E8DB5'}}>{k.label}</div>
            <div style={{font:`700 24px Inter,sans-serif`,color:k.color,marginTop:5}}>{k.val}</div>
            <div style={{font:'11px Inter,sans-serif',color:k.subColor,marginTop:3}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Recruiter performance tracker */}
      <div className="cc-sect-label-purple">Recruiter performance tracker · goal tracking</div>
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:16,marginBottom:26}}>
        {/* Controls */}
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:14}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6,minWidth:150,font:'600 11px Inter,sans-serif',
            color:'#EAF0FF',padding:'6px 11px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,background:'rgba(255,255,255,.05)'}}>
            All recruiters ▾
          </span>
          <span style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',
            border:'1px solid rgba(255,255,255,.12)',borderRadius:8,color:'#7E8DB5',fontSize:13,cursor:'pointer'}}>↻</span>
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            {['Today','Weekly','Monthly'].map(t=>{
              const active=filter===t;
              return <span key={t} onClick={()=>setFilter(t)} style={{
                font:'800 10px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',cursor:'pointer',
                padding:'5px 12px',borderRadius:20,
                ...(active?{color:'#fff',background:'linear-gradient(135deg,#4446DB,#003BDF)'}:{color:'#7E8DB5',border:'1px solid rgba(255,255,255,.1)'})}}>
                {t}
              </span>;
            })}
          </div>
          <span style={{width:'100%',font:'10px monospace',color:'#7E8DB5',textAlign:'right'}}>
            2026-06-27 → 2026-07-03 · 3 goals
          </span>
        </div>
        {/* Table header */}
        <div style={{display:'grid',gridTemplateColumns:recGridCols,paddingBottom:9,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <span style={hdr9}>Recruiter</span>
          <span style={hdr9}>Role</span>
          <span style={hdr9}>Client</span>
          <span style={{...hdr9,color:'#818CF8'}}>Mid-week stage</span>
          <span style={{...hdr9,color:'#818CF8',textAlign:'center'}}>Mid A/T</span>
          <span style={{...hdr9,color:'#5AC8FA'}}>End-week stage</span>
          <span style={{...hdr9,color:'#5AC8FA',textAlign:'center'}}>End A/T</span>
          <span style={hdr9}>Notes</span>
        </div>
        {/* Rows */}
        {REC_ROWS.map((r,i)=>{
          const mid=pBar(r.midA,r.midT); const end=pBar(r.endA,r.endT);
          return (
            <div key={i} style={{display:'grid',gridTemplateColumns:recGridCols,alignItems:'center',
              padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
              <span style={{font:'600 12px Inter,sans-serif',color:'#fff'}}>{r.name}</span>
              <span style={{font:'12px Inter,sans-serif',color:'#9FB0D8'}}>{r.role}</span>
              <span style={{font:'12px Inter,sans-serif',color:'#9FB0D8'}}>{r.client}</span>
              <span>
                <span style={{font:'700 9px Inter,sans-serif',textTransform:'uppercase',padding:'3px 8px',
                  borderRadius:6,background:STAGE_MID.bg,color:STAGE_MID.color}}>{r.midStage}</span>
              </span>
              <span style={{textAlign:'center'}}>
                <div style={{font:'12px monospace',color:mid.col}}>
                  <strong style={{font:'800 13px Inter,sans-serif'}}>{r.midA}</strong>{' '}
                  <span style={{color:'#7E8DB5'}}>/ {r.midT}</span>
                </div>
                <div style={{height:4,background:'rgba(255,255,255,.06)',borderRadius:2,overflow:'hidden',margin:'3px auto 0',maxWidth:60}}>
                  <div style={{height:'100%',width:`${mid.pct}%`,background:mid.col}}/>
                </div>
                <div style={{font:'9px Inter,sans-serif',color:'#7E8DB5',marginTop:2}}>{mid.pct}%</div>
              </span>
              <span>
                <span style={{font:'700 9px Inter,sans-serif',textTransform:'uppercase',padding:'3px 8px',
                  borderRadius:6,background:STAGE_END.bg,color:STAGE_END.color}}>{r.endStage}</span>
              </span>
              <span style={{textAlign:'center'}}>
                <div style={{font:'12px monospace',color:end.col}}>
                  <strong style={{font:'800 13px Inter,sans-serif'}}>{r.endA}</strong>{' '}
                  <span style={{color:'#7E8DB5'}}>/ {r.endT}</span>
                </div>
                <div style={{height:4,background:'rgba(255,255,255,.06)',borderRadius:2,overflow:'hidden',margin:'3px auto 0',maxWidth:60}}>
                  <div style={{height:'100%',width:`${end.pct}%`,background:end.col}}/>
                </div>
                <div style={{font:'9px Inter,sans-serif',color:'#7E8DB5',marginTop:2}}>{end.pct}%</div>
              </span>
              <span style={{font:'11px Inter,sans-serif',color:r.noteColor}}>{r.note}</span>
            </div>
          );
        })}
        {/* Legend */}
        <div style={{display:'flex',gap:16,justifyContent:'flex-end',alignItems:'center',marginTop:12}}>
          <span style={{font:'700 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5'}}>Goal %</span>
          {[['#2DD4BF','≥ 100%'],['#F5B945','50-99%'],['#F2667A','< 50%']].map(([c,l])=>(
            <span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,font:'10px Inter,sans-serif',color:'#9FB0D8'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:c}}/>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Recruiting Campaigns header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:16}}>
        <div>
          <div style={{font:'700 22px Inter,sans-serif',color:'#fff',letterSpacing:'-.01em'}}>Recruiting Campaigns</div>
          <div style={{font:'13px Inter,sans-serif',color:'#9FB0D8',marginTop:3}}>Track reach and engagement across your recruitment campaigns.</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:3,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:3}}>
            {['Today','Weekly','Monthly'].map(t=>{
              const active=filter===t;
              return <span key={t} onClick={()=>setFilter(t)} style={{
                font:'800 10px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',cursor:'pointer',
                padding:'6px 13px',borderRadius:18,
                ...(active?{color:'#fff',background:'linear-gradient(135deg,#4446DB,#003BDF)'}:{color:'#7E8DB5'})}}>
                {t}
              </span>;
            })}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 13px',
            background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,
            font:'600 11px monospace',color:'#EAF0FF'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Jun 28, 2026 <span style={{color:'#7E8DB5'}}>-</span> Jul 04, 2026
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16}}>
        {[
          {title:'Total CR Sent',   val:'1,284',color:'#06E5EC',grad:'linear-gradient(135deg,rgba(0,59,223,.18),rgba(6,229,236,.08))',border:'rgba(6,229,236,.2)'},
          {title:'Total Emails Sent',val:'3,910',color:'#4D8DFF',grad:'linear-gradient(135deg,rgba(77,141,255,.16),rgba(77,141,255,.05))',border:'rgba(77,141,255,.2)'},
          {title:'Total InMail / LinkedIn',val:'742',color:'#A5B4FC',grad:'linear-gradient(135deg,rgba(129,140,248,.18),rgba(129,140,248,.05))',border:'rgba(129,140,248,.22)'},
        ].map((c,i)=>(
          <div key={i} style={{background:c.grad,border:`1px solid ${c.border}`,borderRadius:12,padding:'18px 20px'}}>
            <div style={{font:'600 11px Inter,sans-serif',letterSpacing:'.04em',color:'#9FB0D8'}}>{c.title}</div>
            <div style={{font:`700 30px Inter,sans-serif`,color:c.color,marginTop:6}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Campaign entries table */}
      <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:16,marginBottom:26}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:14}}>
          <span style={{flex:1,minWidth:200,display:'flex',alignItems:'center',gap:9,padding:'9px 13px',
            border:'1px solid rgba(255,255,255,.12)',borderRadius:10,color:'#7E8DB5',font:'13px Inter,sans-serif'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Search by campaign or recruiter...
          </span>
          <span style={{display:'inline-flex',alignItems:'center',gap:10,font:'600 12px Inter,sans-serif',
            color:'#EAF0FF',padding:'9px 14px',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,
            background:'rgba(255,255,255,.04)',minWidth:170,cursor:'pointer'}}>
            All Recruiters <span style={{marginLeft:'auto',color:'#7E8DB5'}}>▾</span>
          </span>
        </div>
        {/* Header */}
        <div style={{display:'grid',gridTemplateColumns:REC_CAMP_COLS,paddingBottom:10,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          {['Date','Campaign','Account','Recruiter','CR','Email','InMail','Actions'].map((h,i)=>(
            <span key={h} style={{font:'600 9px Inter,sans-serif',letterSpacing:'.06em',textTransform:'uppercase',
              color:'#7E8DB5',textAlign:i>=4?'right':'left'}}>{h}</span>
          ))}
        </div>
        {REC_CAMPS.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:REC_CAMP_COLS,alignItems:'center',
            padding:'12px 0',borderBottom:i<REC_CAMPS.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
            <span style={{font:'11px monospace',color:'#9FB0D8'}}>{r.date}</span>
            <span style={{font:'600 12px Inter,sans-serif',color:'#EAF0FF'}}>{r.campaign}</span>
            <span style={{font:'12px Inter,sans-serif',color:'#9FB0D8'}}>{r.account}</span>
            <span style={{font:'12px Inter,sans-serif',color:r.recColor}}>{r.rec}</span>
            <span style={{font:'12px monospace',color:'#06E5EC',textAlign:'right'}}>{r.cr}</span>
            <span style={{font:'12px monospace',color:'#4D8DFF',textAlign:'right'}}>{r.email}</span>
            <span style={{font:'12px monospace',color:'#A5B4FC',textAlign:'right'}}>{r.inmail}</span>
            <span style={{textAlign:'right',font:'13px Inter,sans-serif',color:'#7E8DB5',cursor:'pointer'}}>✎ ⨯</span>
          </div>
        ))}
      </div>

      {/* Role brief */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div className="cc-sect-label-purple" style={{marginBottom:0}}>Role brief</div>
        <div style={{display:'flex',gap:8}}>
          {['✎ Edit','⠿ Reorder','⎙ Print'].map(b=>(
            <span key={b} style={{font:'600 10px Inter,sans-serif',color:'#9FB0D8',padding:'5px 11px',
              border:'1px solid rgba(255,255,255,.12)',borderRadius:8,cursor:'pointer'}}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{background:'rgba(255,255,255,.03)',borderTop:'3px solid #818CF8',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:22}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{font:'700 18px Inter,sans-serif',color:'#fff'}}>CET Designer / Space Planning Specialist</div>
            <div style={{font:'12px Inter,sans-serif',color:'#9FB0D8',marginTop:3}}>Open req · Steelcase · Sarah M. · 6 submitted of 8 target</div>
          </div>
          <span style={{font:'700 10px Inter,sans-serif',padding:'4px 11px',borderRadius:20,
            background:'rgba(129,140,248,.16)',color:'#A5B4FC',textTransform:'uppercase',letterSpacing:'.04em'}}>
            Priority req
          </span>
        </div>
        <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>Ideal candidate profile</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[['Core skills','CET · 20-20 · AutoCAD'],['Experience','3 - 5 years'],['Location','US · Remote'],
            ['Comp range','$65K - $85K'],['Engagement','Full-time · Managed'],['Start','Within 30 days']].map(([l,v])=>(
            <div key={l} style={{background:'rgba(255,255,255,.03)',borderRadius:8,padding:11}}>
              <div style={{font:'600 9px Inter,sans-serif',letterSpacing:'.05em',textTransform:'uppercase',color:'#7E8DB5'}}>{l}</div>
              <div style={{font:'600 12px Inter,sans-serif',color:'#EAF0FF',marginTop:3}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
          <div>
            <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>Must-have qualifications</div>
            <div style={{font:'13px/2 Inter,sans-serif',color:'#cdd6ee'}}>
              • Hands-on CET Designer / 20-20 <span style={{color:'#7E8DB5'}}>(required)</span><br/>
              • Commercial furniture / dealer experience<br/>
              • Space planning &amp; rendering portfolio<br/>
              • English fluency · client-facing<br/>
              • Available US business hours
            </div>
          </div>
          <div>
            <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:10}}>Sourcing channels</div>
            <div style={{font:'13px/1.7 Inter,sans-serif',color:'#cdd6ee'}}>
              → LinkedIn Recruiter: "CET Designer", "20-20"<br/>
              → Apollo: skills = CET, space planning<br/>
              → Internal referral network<br/>
              → Niche AEC / interiors job boards
            </div>
          </div>
        </div>
        <div style={{background:'rgba(129,140,248,.08)',borderLeft:'3px solid rgba(129,140,248,.6)',
          borderRadius:'0 8px 8px 0',padding:'13px 15px',marginBottom:12,font:'13px/1.6 Inter,sans-serif',color:'#cdd6ee'}}>
          <strong style={{color:'#fff'}}>Candidate pitch.</strong>{' '}
          Stable, fully-managed engagement with a US dealer - consistent CET / space-planning work, modern tooling, and a team that invests in your growth. No agency churn.
        </div>
        <div style={{background:'rgba(0,59,223,.1)',borderLeft:'3px solid rgba(77,141,255,.6)',
          borderRadius:'0 8px 8px 0',padding:'13px 15px',marginBottom:20,font:'13px/1.6 Inter,sans-serif',color:'#cdd6ee'}}>
          <strong style={{color:'#fff'}}>Why Bold Business.</strong>{' '}
          We place specialists into long-term embedded roles - not one-off contracts - with managed support, fair comp, and real career progression.
        </div>
        <div style={{font:'600 10px Inter,sans-serif',letterSpacing:'.1em',textTransform:'uppercase',color:'#7E8DB5',marginBottom:12}}>4-touch candidate outreach</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {n:'1',title:'LinkedIn InMail',   meta:'Day 1',                color:'#818CF8',body:"Personalized note on their CET / 20-20 work."},
            {n:'2',title:'Email follow-up',   meta:'Day 3 · role one-pager',color:'#5AC8FA',body:'Share comp range, engagement model, team.'},
            {n:'3',title:'Screening call',    meta:'Day 5 · 20 min',        color:'#2DD4BF',body:'Skills, availability, portfolio walkthrough.'},
            {n:'4',title:'Submit to client',  meta:'Day 7 · with notes',    color:'#F5B945',body:'Package profile + screen notes to Steelcase.'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,.03)',borderRadius:8,padding:13}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{width:22,height:22,borderRadius:'50%',background:s.color,color:'#0a0f22',
                  display:'flex',alignItems:'center',justifyContent:'center',font:'800 11px Inter,sans-serif',flexShrink:0}}>
                  {s.n}
                </span>
                <div>
                  <div style={{font:'700 11px Inter,sans-serif',color:'#fff'}}>{s.title}</div>
                  <div style={{font:'9px Inter,sans-serif',color:'#7E8DB5'}}>{s.meta}</div>
                </div>
              </div>
              <div style={{font:'11px/1.5 Inter,sans-serif',color:'#9FB0D8'}}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
function Pager({page,setPage,total,perPage}){
  const pages=Math.ceil(total/perPage);
  if(pages<=1) return null;
  const btn=(label,disabled,onClick)=>(
    <button onClick={onClick} disabled={disabled} style={{
      padding:'4px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,.12)',
      background:disabled?'transparent':'rgba(255,255,255,.05)',
      color:disabled?'rgba(255,255,255,.2)':'#9FB0D8',
      font:'600 11px Inter,sans-serif',cursor:disabled?'default':'pointer',transition:'all .15s',
    }}>{label}</button>
  );
  const pageBtn=(i)=>(
    <button key={i} onClick={()=>setPage(i)} style={{
      width:28,height:26,borderRadius:6,border:i===page?'none':'1px solid rgba(255,255,255,.12)',
      background:i===page?'#06E5EC':'rgba(255,255,255,.05)',
      color:i===page?'#000':'#9FB0D8',
      font:`${i===page?700:400} 11px Inter,sans-serif`,cursor:'pointer',transition:'all .15s',
    }}>{i+1}</button>
  );
  // sliding window of up to 5 pages around current
  const WINDOW=2;
  const start=Math.max(0,Math.min(page-WINDOW,pages-WINDOW*2-1));
  const end=Math.min(pages-1,start+WINDOW*2);
  const pageNums=[];
  for(let i=start;i<=end;i++) pageNums.push(i);
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4,marginTop:10,paddingTop:8,borderTop:'1px solid rgba(255,255,255,.06)',flexWrap:'wrap'}}>
      <span style={{font:'11px Inter,sans-serif',color:'#7E8DB5',marginRight:6}}>
        {page*perPage+1}–{Math.min((page+1)*perPage,total)} of {total}
      </span>
      {btn('«',page===0,()=>setPage(0))}
      {btn('‹',page===0,()=>setPage(p=>Math.max(0,p-1)))}
      {start>0&&<span style={{color:'#7E8DB5',font:'11px Inter,sans-serif',padding:'0 2px'}}>…</span>}
      {pageNums.map(i=>pageBtn(i))}
      {end<pages-1&&<span style={{color:'#7E8DB5',font:'11px Inter,sans-serif',padding:'0 2px'}}>…</span>}
      {btn('›',page===pages-1,()=>setPage(p=>Math.min(pages-1,p+1)))}
      {btn('»',page===pages-1,()=>setPage(pages-1))}
    </div>
  );
}

export default function CommandCenterOverview() {
  const [mode,setMode]=useState('sales');
  const [modalAgent,setModalAgent]=useState(null);

  return (
    <>
      <style>{STYLES}</style>
      <div className="cc-root">

        {/* Sales / Recruiting toggle */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 24px 0',maxWidth:1380,margin:'0 auto'}}>
          <div style={{display:'flex',gap:6,background:'rgba(255,255,255,.04)',
            border:'1px solid rgba(255,255,255,.08)',borderRadius:13,padding:5}}>
            {[
              {id:'sales',      label:'Sales',
                icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>},
              {id:'recruiting', label:'Recruiting',
                icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
            ].map(m=>{
              const active=mode===m.id;
              return <div key={m.id} onClick={()=>setMode(m.id)} style={{
                display:'inline-flex',alignItems:'center',gap:9,padding:'9px 20px',borderRadius:9,cursor:'pointer',
                background:active?(m.id==='sales'?'rgba(0,59,223,.45)':'rgba(124,58,237,.4)'):'transparent',
                font:`${active?700:500} 13px/1 Inter,sans-serif`,color:active?'#fff':'#7E8DB5',transition:'all .18s'}}>
                {m.icon}{m.label}
              </div>;
            })}
          </div>
          <div style={{marginLeft:'auto',font:'12px Inter,sans-serif',color:'#7E8DB5'}}>
            {mode==='sales'?'AI SDR fleet · outreach campaigns · live performance':'Recruiter performance · goal tracking · role briefs'}
          </div>
        </div>

        {mode==='sales'    && <SalesTab modalAgent={modalAgent} setModalAgent={setModalAgent}/>}
        {mode==='recruiting'&& <RecruitingTab setModalAgent={setModalAgent}/>}
      </div>

      {/* Agent modal */}
      {modalAgent && <AgentModal agent={modalAgent} onClose={()=>setModalAgent(null)}/>}

      {/* Floating chat button */}
      <button style={{position:'fixed',bottom:24,right:24,zIndex:9000,
        width:52,height:52,borderRadius:'50%',background:'#7C3AED',border:'none',
        color:'#fff',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:'0 4px 24px rgba(124,58,237,.45)',transition:'transform .2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
        onMouseLeave={e=>e.currentTarget.style.transform=''}>
        💬
      </button>
    </>
  );
}
