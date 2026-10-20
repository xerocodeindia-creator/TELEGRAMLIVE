"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Bot, CheckCheck, ChevronRight, CirclePause, CirclePlay, Clock3, MessageCircle, Search, Send, ShieldCheck, Users, WalletCards, AlertTriangle, Image as ImageIcon, Menu, X, RefreshCw, LogOut } from "lucide-react";
import styles from "./dashboard.module.css";

type Task = "Angel One" | "Choice FinX" | "Bajaj";
type Message = { direction: "user" | "bot" | "admin"; text: string; time: string; kind?: "image" | "text"; fileId?: string };
type Client = { id: string; name: string; username: string; phone: string; task: Task; status: string; last: string; paused: boolean; progress: number; completedTaskIds?: string[]; currentTaskId?: string; proofStatus?: string; stateWarning?: boolean; messages: Message[] };
const sampleClients: Client[] = [
 {id:"764203918",name:"Rahul Das",username:"@rahul_das",phone:"•••••••248",task:"Choice FinX",status:"Proof received",last:"1 min ago",paused:false,progress:1,messages:[{direction:"user",text:"Account activation in progress ka screenshot bheja.",time:"10:41",kind:"image"},{direction:"bot",text:"Screenshot mil gaya, ab main status check kar rahi hoon.",time:"10:41"},{direction:"bot",text:"Choice FinX ka onboarding status detect hua. Agla task process ho raha hai.",time:"10:42"}]},
 {id:"738194205",name:"Priya Ghosh",username:"@priya_ghosh",phone:"•••••••901",task:"Angel One",status:"Waiting for profile proof",last:"4 min ago",paused:false,progress:0,messages:[{direction:"bot",text:"Neeche More par tap kijiye, phir Profile kholkar Client ID wala screenshot bhejiye.",time:"10:32"},{direction:"user",text:"Home page screenshot",time:"10:34",kind:"image"}]},
 {id:"790512468",name:"Aman Khan",username:"@aman_k",phone:"•••••••416",task:"Bajaj",status:"AI paused by admin",last:"12 min ago",paused:true,progress:2,messages:[{direction:"user",text:"Account submitted ka screenshot bheja.",time:"10:18",kind:"image"},{direction:"bot",text:"Bajaj ka status mil gaya. Final approval ka status confirm hone par update milega.",time:"10:18"}]},
 {id:"715638204",name:"Sneha Paul",username:"@sneha_p",phone:"•••••••332",task:"Angel One",status:"Task 1 complete",last:"28 min ago",paused:false,progress:1,messages:[{direction:"user",text:"Profile screenshot with Client ID",time:"09:53",kind:"image"},{direction:"bot",text:"Screenshot check ho gaya. Ab Choice FinX Task 2 share kar rahi hoon.",time:"09:54"}]}
];
const taskSteps: Task[] = ["Angel One","Choice FinX","Bajaj"];
const taskIds = ["task_1_angel_one","task_2_choice_finx","task_3"];

export default function DashboardPage() {
 const [clients,setClients] = useState(sampleClients);
 const [selectedId,setSelectedId] = useState(sampleClients[0].id);
 const [search,setSearch] = useState("");
 const [filter,setFilter] = useState("All users");
 const [selectedTaskTab,setSelectedTaskTab] = useState(0);
 const [message,setMessage] = useState("");
 const [notice,setNotice] = useState("Checking admin session and n8n connection…");
 const [mobileNav,setMobileNav] = useState(false);
 const [connected,setConnected] = useState(false);
 const [busy,setBusy] = useState(false);
 const [loading,setLoading] = useState(false);
 const [authReady,setAuthReady] = useState(false);
 const selected = clients.find(c=>c.id===selectedId) || clients[0];

 const refresh = useCallback(async (silent=false) => {
  if(!silent) setLoading(true);
  try {
   const auth=await fetch("/api/auth",{cache:"no-store"}).then(r=>r.json());
   if(!auth.authenticated){location.replace("/login");return;}
   setAuthReady(true);
   const response=await fetch("/api/dashboard",{cache:"no-store"});
   const data=await response.json();
   if(!response.ok) throw new Error(data.error||"Unable to load dashboard");
   if(!data.connected){setConnected(false);setNotice("n8n connection is not configured yet. Sample data is shown; no real conversations are being displayed.");return;}
   setConnected(true);
   setNotice(data.messagesConfigured?"Connected to n8n. Message log is available.":"Connected to progress/submission tables. Full conversation history still needs message logging in n8n.");
   const rows=Array.isArray(data.clients)?data.clients:[];
   const messageRows=Array.isArray(data.messages)?data.messages:[];
   const asMillis=(value:any)=>{if(value===null||value===undefined||value==="")return 0;const n=Number(value);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(String(value));return Number.isFinite(d)?d:0;};
   const mapped:Client[]=rows.filter((r:any)=>/^\\d+$/.test(String(r.client_id||""))).map((r:any)=>{
    let completed:any[]=[];try{const parsed=JSON.parse(r.completed_tasks||"[]");if(Array.isArray(parsed))completed=parsed.map(String);}catch{}
    const completedTaskIds=taskIds.filter(id=>completed.includes(id));
    const currentTaskId=String(r.current_task||"");
    const currentIndex=taskIds.indexOf(currentTaskId);
    const task:Task=currentTaskId.includes("choice")?"Choice FinX":currentTaskId.includes("task_3")||currentTaskId==="completed"?"Bajaj":"Angel One";
    const clientId=String(r.client_id);
    const clientMessages:Message[]=messageRows
      .filter((m:any)=>String(m.chat_id||"")===clientId)
      .map((m:any,index:number)=>({m,index,stamp:asMillis(m.event_time)||asMillis(m.createdAt)||index}))
      .sort((a:any,b:any)=>a.stamp-b.stamp||a.index-b.index)
      .map(({m,stamp}:any)=>({direction:String(m.direction)==="inbound"?"user":String(m.direction)==="outbound"?"bot":"admin",text:String(m.text||m.caption||((m.message_type==="photo"||m.message_type==="document")?"Attachment received":"")),time:new Date(stamp||Date.now()).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),kind:(m.message_type==="photo"||m.message_type==="document"||m.file_id)?"image":"text",fileId:m.file_id?String(m.file_id):undefined}))
      .filter((m:Message)=>Boolean(m.text)||m.kind==="image");
    const proofStatus=String(r.proof_status||"not_submitted");
    const expectedIndex=completedTaskIds.length;
    const stateWarning=currentIndex>=0 && currentIndex!==expectedIndex && currentTaskId!=="completed";
    return {id:clientId,name:String(r.first_name||"Telegram user"),username:"",phone:r.phone_number?String(r.phone_number):"",task,status:stateWarning?"Task state mismatch — needs review":String(r.flow_step||proofStatus||"Active"),last:r.updatedAt?new Date(r.updatedAt).toLocaleString():"Recently active",paused:Boolean(r.ai_paused),progress:completedTaskIds.length,completedTaskIds,currentTaskId,proofStatus,stateWarning,messages:clientMessages};
   });
   if(mapped.length){setClients(mapped);if(!mapped.some(c=>c.id===selectedId))setSelectedId(mapped[0].id);}
   else setClients([]);
  } catch(e){setConnected(false);setNotice(e instanceof Error?e.message:"Unable to load data.");}
  finally{setLoading(false);}
 },[selectedId]);
 useEffect(()=>{refresh(false);const timer=setInterval(()=>refresh(true),3000);return()=>clearInterval(timer);},[refresh]);

 async function togglePause(c:Client){
  const action=c.paused?"resume":"pause";setBusy(true);
  try{const r=await fetch("/api/ai-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:c.id,action})});const d=await r.json();if(!r.ok)throw new Error(d.error||"AI control could not be updated");setClients(prev=>prev.map(x=>x.id===c.id?{...x,paused:action==="pause",status:action==="pause"?"AI paused by admin":x.status}:x));setNotice(action==="pause"?"AI paused for this client.":"AI resumed for this client.");}
  catch(e){setNotice(e instanceof Error?e.message:"AI control is not connected.");}
  finally{setBusy(false);}
 }
 async function sendReply(){
  if(!message.trim())return;setBusy(true);
  try{const r=await fetch("/api/manual-reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:selected.id,text:message.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Message was not sent");setClients(prev=>prev.map(x=>x.id===selected.id?{...x,messages:[...x.messages,{direction:"admin",text:message.trim(),time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}]}:x));setMessage("");setNotice("Manual reply sent to Telegram.");}
  catch(e){setNotice(e instanceof Error?e.message:"Manual reply could not be sent.");}
  finally{setBusy(false);}
 }
 async function logout(){await fetch("/api/auth",{method:"DELETE"});location.replace("/login");}
 const filtered=useMemo(()=>clients.filter(c=>(c.name.toLowerCase().includes(search.toLowerCase())||c.id.includes(search)||c.username.toLowerCase().includes(search.toLowerCase()))&&(filter==="All users"||(filter==="AI paused"&&c.paused)||(filter==="Needs attention"&&/proof|waiting|error|attention/i.test(c.status)))),[clients,search,filter]);
 const active=clients.filter(c=>!c.paused).length;
 const proofCount=clients.filter(c=>/proof|complete/i.test(c.status)).length;
 const attention=clients.filter(c=>/proof|waiting|error|attention/i.test(c.status)).length;
 if(!authReady)return <main className={styles.loading}><Bot size={24}/><p>Checking admin session…</p></main>;
 return <main className={styles.shell}>
  <aside className={`${styles.sidebar} ${mobileNav?styles.sidebarOpen:""}`}>
   <div className={styles.brand}><div className={styles.brandMark}><Bot size={22}/></div><div><strong>Aarohi</strong><small>Control Center</small></div><button className={styles.iconButton+" "+styles.closeNav} onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
   <div className={styles.workspace}><span className={styles.onlineDot}></span><div><b>Client Progress Manager</b><small>Telegram automation</small></div><ChevronRight size={16}/></div>
   <div className={styles.navLabel}>WORKSPACE</div><button className={`${styles.navItem} ${styles.navActive}`}><MessageCircle size={18}/> Live conversations <span className={styles.navCount}>{active}</span></button>
   <button className={styles.navItem}><Users size={18}/> Client progress</button><button className={styles.navItem}><Activity size={18}/> AI activity</button><button className={styles.navItem}><AlertTriangle size={18}/> Errors & alerts <span className={styles.alertCount}>{attention}</span></button>
   <div className={styles.navLabel}>TASK PIPELINE</div>{taskSteps.map((t,i)=><div key={t} className={styles.pipeline}><span className={styles.pipelineNumber}>{i+1}</span><span>{t}</span><span className={styles.pipelineLine}></span></div>)}
   <div className={styles.sidebarFoot}><ShieldCheck size={16}/><span>Admin workspace<br/><small>Secure access required</small></span></div>
  </aside>
  {mobileNav&&<button className={styles.backdrop} onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
  <section className={styles.mainArea}>
   <header className={styles.topbar}><button className={styles.iconButton+" "+styles.menuButton} onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><div className={styles.crumb}>Workspace <ChevronRight size={14}/> <b>Live conversations</b></div><div className={styles.topRight}><span className={styles.previewPill}><span></span>{connected?"n8n connected":"Preview / partial"}</span><button className={styles.iconButton} onClick={()=>refresh(false)} aria-label="Refresh" disabled={loading}><RefreshCw size={17}/></button><button className={styles.iconButton} onClick={logout} aria-label="Log out"><LogOut size={17}/></button><div className={styles.avatar}>AD</div></div></header>
   <div className={styles.content}>
    <div className={styles.pageHead}><div><div className={styles.eyebrow}>OVERVIEW / OPERATIONS</div><h1>Live conversations</h1><p>Monitor chats, task progress and AI activity from one place.</p></div><button className={styles.secondaryButton} onClick={()=>refresh(false)}><RefreshCw size={15}/>{loading?"Syncing…":"Sync status"}</button></div>
    <div className={styles.notice}><Activity size={17}/><span>{notice}</span></div>
    <div className={styles.metrics}><Metric icon={<Users/>} label="Total clients" value={String(clients.length)} foot={connected?"From n8n":"Sample records"}/><Metric icon={<MessageCircle/>} label="Active conversations" value={String(active)} foot={connected?"Current control state":"Sample records"}/><Metric icon={<CheckCheck/>} label="Proofs / completions" value={String(proofCount)} foot={connected?"From workflow status":"Sample records"}/><Metric icon={<AlertTriangle/>} label="Needs attention" value={String(attention)} foot={connected?"From workflow status":"Sample records"}/></div>
    <div className={styles.workspaceGrid}>
     <section className={styles.panel}><div className={styles.panelHead}><div><h2>Conversations</h2><p>Select a client to inspect the chat</p></div><span className={styles.liveTag}><span></span>{connected?"Connected":"Preview"}</span></div>
      <div className={styles.filters}><div className={styles.search}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, username, Telegram ID"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All users</option><option>AI paused</option><option>Needs attention</option></select></div>
      <div className={styles.clientList}>{filtered.map(c=><button key={c.id} onClick={()=>{setSelectedId(c.id);setMessage("");}} className={`${styles.clientRow} ${selectedId===c.id?styles.clientSelected:""}`}><div className={styles.clientAvatar}>{c.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div><div className={styles.clientMeta}><strong>{c.name}</strong><small>{c.username||("Telegram ID "+c.id)} · {c.last}</small><span>{c.status}</span></div><div className={styles.rowStatus}><i className={c.paused?styles.pausedDot:styles.activeDot}></i></div></button>)}{filtered.length===0&&<div className={styles.noClients}>No clients found for this filter.</div>}</div>
     </section>
     {selected&&<section className={styles.panel+" "+styles.chatPanel}>
      <div className={styles.chatHead}><div className={styles.clientAvatar+" "+styles.bigAvatar}>{selected.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div><div className={styles.chatTitle}><h2>{selected.name}</h2><p>Telegram ID {selected.id}</p><div className={styles.chips}><span className={styles.taskChip}>{selected.task}</span><span className={selected.paused?styles.pausedChip:styles.activeChip}>{selected.paused?"AI paused":"AI active / unknown"}</span></div></div><button disabled={busy||!connected} onClick={()=>togglePause(selected)} className={selected.paused?styles.resumeButton:styles.pauseButton}>{selected.paused?<CirclePlay size={16}/>:<CirclePause size={16}/>} {selected.paused?"Resume AI":"Pause AI"}</button></div>
      <div className={styles.chatDetails}><span><WalletCards size={14}/>{selected.phone||"Phone not captured"}</span><span><Clock3 size={14}/>Last active {selected.last}</span></div>
      <div className={styles.messages}>{selected.messages.length?selected.messages.map((m,i)=><div key={i} className={`${styles.messageRow} ${m.direction==="user"?styles.incoming:styles.outgoing}`}><div className={styles.messageBubble}><small>{m.direction==="user"?"USER":m.direction==="admin"?"YOU · ADMIN":"AAROHI AI"} · {m.time}</small>{m.kind==="image"&&(m.fileId?<img className={styles.telegramImage} src={`/api/telegram-file?file_id=${encodeURIComponent(m.fileId)}`} alt="Telegram screenshot attachment" loading="lazy"/>:<div className={styles.imagePlaceholder}><ImageIcon size={28}/><span>Attachment image unavailable (no Telegram file ID)</span></div>)}<p>{m.text}</p></div></div>):<div className={styles.emptyChat}><MessageCircle size={24}/><b>No message log connected</b><span>Connect inbound and outbound message logging in n8n to show the full chat here.</span></div>}</div>
      <div className={styles.composer}><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a manual reply…" rows={2}/><button onClick={sendReply} disabled={!message.trim()||busy||!connected}><Send size={17}/>Send reply</button></div><div className={styles.chatDisclaimer}>Manual send requires a server-side Telegram token. AI pause is disabled until n8n checks persisted per-user control state.</div>
     </section>}
    </div>
    <section className={styles.progressPanel}><div className={styles.panelHead}><div><h2>Task progress</h2><p>Live status from the selected client’s n8n record</p></div>{selected&&<span className={styles.taskChip}>Client #{selected.id.slice(-4)}</span>}</div>{selected?.stateWarning&&<div className={styles.pipelineWarning}><AlertTriangle size={16}/><span>Database mismatch: current task is {selected.currentTaskId}, but completed tasks list says {selected.completedTaskIds.length} completed. Later tasks remain locked until state is corrected.</span></div>}<div className={styles.progressGrid}>{taskSteps.map((t,i)=>{const taskId=taskIds[i];const completed=selected?.completedTaskIds||[];const done=!!selected&&completed.includes(taskId);const priorDone=i===0||!!selected&&taskIds.slice(0,i).every(id=>completed.includes(id));const current=!!selected&&!done&&priorDone&&!selected.stateWarning;const pending=!!selected&&!done&&priorDone&&/pending|submitted|review/i.test(selected.proofStatus||"");const label=done?"Complete":pending?"Proof pending":current?"In progress":"Locked";const detail=done?"Recorded in completed_tasks":pending?"Waiting for proof review":current?"Current task — awaiting submission":"Complete the previous task first";return <div key={t} className={styles.progressCard}><div className={styles.progressTop}><span className={done?styles.doneIcon:current||pending?styles.currentIcon:styles.todoIcon}>{done?<CheckCheck size={18}/>:current||pending?<Clock3 size={18}/>:<span>{i+1}</span>}</span><span className={done?styles.doneLabel:current||pending?styles.currentLabel:styles.todoLabel}>{label}</span></div><h3>{t}</h3><p>{detail}</p></div>})}</div></section>
    <section className={styles.progressPanel}><div className={styles.panelHead}><div><h2>Task completion tabs</h2><p>Clients appear in each tab only after that task ID is recorded as completed in n8n.</p></div></div><div className={styles.taskTabs}>{taskSteps.map((task,i)=>{const taskId=taskIds[i];const completedClients=clients.filter(c=>c.completedTaskIds?.includes(taskId));return <button key={taskId} className={selectedTaskTab===i?styles.taskTabActive:styles.taskTab} onClick={()=>setSelectedTaskTab(i)}>{`Task ${i+1}: ${task}`}<span>{completedClients.length}</span></button>})}</div><div className={styles.taskTabResults}>{clients.filter(c=>c.completedTaskIds?.includes(taskIds[selectedTaskTab])).length===0?<div className={styles.emptyChat}><Users size={22}/><b>No completed clients yet</b><span>When a client completes this task and n8n records it in completed_tasks, they will appear here automatically.</span></div>:clients.filter(c=>c.completedTaskIds?.includes(taskIds[selectedTaskTab])).map(c=><div className={styles.taskCompletedRow} key={c.id}><div className={styles.clientAvatar}>{c.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div><div className={styles.clientMeta}><strong>{c.name}</strong><small>Telegram ID {c.id} · {c.phone||"Phone not captured"}</small><span>Completed {taskSteps[selectedTaskTab]}</span></div><CheckCheck size={18}/></div>)}</div></section>
     <footer className={styles.footer}>Aarohi Control Center <span>·</span> Data refreshes every 15 seconds <span>·</span> {connected?"n8n progress connected":"Demo records only"}</footer>
   </div>
  </section>
 </main>;
}
function Metric({icon,label,value,foot}:{icon:ReactNode;label:string;value:string;foot:string}){return <div className={styles.metric}><div className={styles.metricTop}><span>{label}</span><div className={styles.metricIcon}>{icon}</div></div><strong>{value}</strong><small>{foot}</small></div>;}
