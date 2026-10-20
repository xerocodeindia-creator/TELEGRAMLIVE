"use client";

import { useMemo, useState } from "react";
import {
  Activity, Bot, CheckCheck, ChevronRight, CirclePause, CirclePlay,
  Clock3, MessageCircle, Search, Send, ShieldCheck, Users, WalletCards,
  AlertTriangle, Image as ImageIcon, Menu, X, RefreshCw, Workflow
} from "lucide-react";
import styles from "./dashboard.module.css";

type Task = "Angel One" | "Choice FinX" | "Bajaj";
type Message = { direction: "user" | "bot" | "admin"; text: string; time: string; kind?: "image" | "text" };
type Client = {
  id: string; name: string; username: string; phone: string; task: Task;
  status: string; last: string; paused: boolean; progress: number; messages: Message[];
};
const sampleClients: Client[] = [
  {id:"764203918",name:"Rahul Das",username:"@rahul_das",phone:"•••••••248",task:"Choice FinX",status:"Proof received",last:"1 min ago",paused:false,progress:1,messages:[
    {direction:"user",text:"Account activation in progress ka screenshot bheja.",time:"10:41",kind:"image"},
    {direction:"bot",text:"Screenshot mil gaya, ab main status check kar rahi hoon.",time:"10:41"},
    {direction:"bot",text:"Choice FinX ka onboarding status detect hua. Agla task process ho raha hai.",time:"10:42"}
  ]},
  {id:"738194205",name:"Priya Ghosh",username:"@priya_ghosh",phone:"•••••••901",task:"Angel One",status:"Waiting for profile proof",last:"4 min ago",paused:false,progress:0,messages:[
    {direction:"bot",text:"Neeche More par tap kijiye, phir Profile kholkar Client ID wala screenshot bhejiye.",time:"10:32"},
    {direction:"user",text:"Home page screenshot",time:"10:34",kind:"image"}
  ]},
  {id:"790512468",name:"Aman Khan",username:"@aman_k",phone:"•••••••416",task:"Bajaj",status:"AI paused by admin",last:"12 min ago",paused:true,progress:2,messages:[
    {direction:"user",text:"Account submitted ka screenshot bheja.",time:"10:18",kind:"image"},
    {direction:"bot",text:"Bajaj ka status mil gaya. Final approval ka status confirm hone par update milega.",time:"10:18"}
  ]},
  {id:"715638204",name:"Sneha Paul",username:"@sneha_p",phone:"•••••••332",task:"Angel One",status:"Task 1 complete",last:"28 min ago",paused:false,progress:1,messages:[
    {direction:"user",text:"Profile screenshot with Client ID",time:"09:53",kind:"image"},
    {direction:"bot",text:"Screenshot check ho gaya. Ab Choice FinX Task 2 share kar rahi hoon.",time:"09:54"}
  ]}
];

const taskSteps: Task[] = ["Angel One","Choice FinX","Bajaj"];

export default function DashboardPage() {
  const [clients,setClients] = useState(sampleClients);
  const [selectedId,setSelectedId] = useState(sampleClients[0].id);
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("All users");
  const [message,setMessage] = useState("");
  const [notice,setNotice] = useState("Preview mode — sample data only. Connect backend to see live Telegram conversations.");
  const [mobileNav,setMobileNav] = useState(false);
  const selected=clients.find(c=>c.id===selectedId) || clients[0];
  const filtered=useMemo(()=>clients.filter(c=>
    (c.name.toLowerCase().includes(search.toLowerCase())||c.id.includes(search)||c.username.toLowerCase().includes(search.toLowerCase())) &&
    (filter==="All users"||(filter==="AI paused"&&c.paused)||(filter==="Needs attention"&&/proof|waiting|error|attention/i.test(c.status)))
  ),[clients,search,filter]);
  function togglePause(c:Client){
    setClients(prev=>prev.map(x=>x.id===c.id?{...x,paused:!x.paused,status:x.paused?x.status.replace("AI paused by admin","Active conversation"):"AI paused by admin"}:x));
    setNotice("Preview only: pause/resume is not connected to n8n yet.");
  }
  function sendReply(){
    if(!message.trim()) return;
    setClients(prev=>prev.map(x=>x.id===selected.id?{...x,messages:[...x.messages,{direction:"admin",text:message.trim(),time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}]}:x));
    setMessage("");
    setNotice("Preview only: reply is shown locally and was NOT sent to Telegram. Connect a protected backend before using live replies.");
  }
  const countActive=clients.filter(c=>!c.paused).length;
  const proofCount=clients.filter(c=>/proof|complete/i.test(c.status)).length;
  const attention=clients.filter(c=>/proof|waiting|error|attention/i.test(c.status)).length;
  return <main className={styles.shell}>
    <aside className={`${styles.sidebar} ${mobileNav?styles.sidebarOpen:""}`}>
      <div className={styles.brand}><div className={styles.brandMark}><Bot size={22}/></div><div><strong>Aarohi</strong><small>Control Center</small></div><button className={styles.iconButton+" "+styles.closeNav} onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className={styles.workspace}><span className={styles.onlineDot}></span><div><b>Client Progress Manager</b><small>Telegram automation</small></div><ChevronRight size={16}/></div>
      <div className={styles.navLabel}>WORKSPACE</div>
      <button className={`${styles.navItem} ${styles.navActive}`}><MessageCircle size={18}/> Live conversations <span className={styles.navCount}>{countActive}</span></button>
      <button className={styles.navItem}><Users size={18}/> Client progress</button>
      <button className={styles.navItem}><Activity size={18}/> AI activity</button>
      <button className={styles.navItem}><AlertTriangle size={18}/> Errors & alerts <span className={styles.alertCount}>{attention}</span></button>
      <div className={styles.navLabel}>TASK PIPELINE</div>
      {taskSteps.map((t,i)=><div key={t} className={styles.pipeline}><span className={styles.pipelineNumber}>{i+1}</span><span>{t}</span><span className={styles.pipelineLine}></span></div>)}
      <div className={styles.sidebarFoot}><ShieldCheck size={16}/><span>Admin workspace<br/><small>Secure access required</small></span></div>
    </aside>
    {mobileNav&&<button className={styles.backdrop} onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <section className={styles.mainArea}>
      <header className={styles.topbar}>
        <button className={styles.iconButton+" "+styles.menuButton} onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button>
        <div className={styles.crumb}>Workspace <ChevronRight size={14}/> <b>Live conversations</b></div>
        <div className={styles.topRight}><span className={styles.previewPill}><span></span> Preview mode</span><button className={styles.iconButton} onClick={()=>setNotice("Preview refreshed. Live connection is not configured.")} aria-label="Refresh"><RefreshCw size={17}/></button><div className={styles.avatar}>AD</div></div>
      </header>
      <div className={styles.content}>
        <div className={styles.pageHead}><div><div className={styles.eyebrow}>OVERVIEW / OPERATIONS</div><h1>Live conversations</h1><p>Monitor chats, task progress and AI activity from one place.</p></div><button className={styles.secondaryButton} onClick={()=>setNotice("Preview mode: connect your authenticated n8n backend for live updates.")}><RefreshCw size={15}/> Sync status</button></div>
        <div className={styles.notice}><Activity size={17}/><span>{notice}</span></div>
        <div className={styles.metrics}>
          <Metric icon={<Users/>} label="Total clients" value={String(clients.length)} foot="Sample records" />
          <Metric icon={<MessageCircle/>} label="Active conversations" value={String(countActive)} foot="Not live-connected" />
          <Metric icon={<CheckCheck/>} label="Proofs / completions" value={String(proofCount)} foot="Sample records" />
          <Metric icon={<AlertTriangle/>} label="Needs attention" value={String(attention)} foot="Sample records" />
        </div>
        <div className={styles.workspaceGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><h2>Conversations</h2><p>Select a client to inspect the chat</p></div><span className={styles.liveTag}><span></span> Preview</span></div>
            <div className={styles.filters}><div className={styles.search}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, username, Telegram ID"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All users</option><option>AI paused</option><option>Needs attention</option></select></div>
            <div className={styles.clientList}>{filtered.map(c=><button key={c.id} onClick={()=>{setSelectedId(c.id);setMessage("");}} className={`${styles.clientRow} ${selectedId===c.id?styles.clientSelected:""}`}><div className={styles.clientAvatar}>{c.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div><div className={styles.clientMeta}><strong>{c.name}</strong><small>{c.username} · {c.last}</small><span>{c.messages[c.messages.length-1]?.text}</span></div><div className={styles.rowStatus}><i className={c.paused?styles.pausedDot:styles.activeDot}></i></div></button>)}</div>
          </section>
          <section className={styles.panel+" "+styles.chatPanel}>
            <div className={styles.chatHead}><div className={styles.clientAvatar+" "+styles.bigAvatar}>{selected.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div><div className={styles.chatTitle}><h2>{selected.name}</h2><p>{selected.username} · Telegram ID {selected.id}</p><div className={styles.chips}><span className={styles.taskChip}>{selected.task}</span><span className={selected.paused?styles.pausedChip:styles.activeChip}>{selected.paused?"AI paused":"AI active"}</span></div></div><button onClick={()=>togglePause(selected)} className={selected.paused?styles.resumeButton:styles.pauseButton}>{selected.paused?<CirclePlay size={16}/>:<CirclePause size={16}/>} {selected.paused?"Resume AI":"Pause AI"}</button></div>
            <div className={styles.chatDetails}><span><WalletCards size={14}/> {selected.phone||"Phone not captured"}</span><span><Clock3 size={14}/> Last active {selected.last}</span></div>
            <div className={styles.messages}>{selected.messages.map((m,i)=><div key={i} className={`${styles.messageRow} ${m.direction==="user"?styles.incoming:styles.outgoing}`}><div className={styles.messageBubble}><small>{m.direction==="user"?"USER":m.direction==="admin"?"YOU · ADMIN":"AAROHI AI"} · {m.time}</small>{m.kind==="image"&&<div className={styles.imagePlaceholder}><ImageIcon size={28}/><span>Screenshot attachment (preview)</span></div>}<p>{m.text}</p></div></div>)}</div>
            <div className={styles.composer}><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={selected.paused?"AI paused — manual reply preview":"Write a manual reply…"} rows={2}/><button onClick={sendReply} disabled={!message.trim()}><Send size={17}/> Send reply</button></div>
            <div className={styles.chatDisclaimer}>Manual replies and AI controls are preview-only until the secure server API is connected.</div>
          </section>
        </div>
        <section className={styles.progressPanel}>
          <div className={styles.panelHead}><div><h2>Task progress</h2><p>Current pipeline state for selected client</p></div><span className={styles.taskChip}>Client #{selected.id.slice(-4)}</span></div>
          <div className={styles.progressGrid}>{taskSteps.map((t,i)=>{const done=i<selected.progress;const current=i===selected.progress;return <div key={t} className={styles.progressCard}><div className={styles.progressTop}><span className={done?styles.doneIcon:current?styles.currentIcon:styles.todoIcon}>{done?<CheckCheck size={18}/>:current?<Clock3 size={18}/>:<span>{i+1}</span>}</span><span className={done?styles.doneLabel:current?styles.currentLabel:styles.todoLabel}>{done?"Complete":current?"In progress":"Locked"}</span></div><h3>{t}</h3><p>{done?"Proof processed":current?"Waiting for next milestone":"Complete previous task first"}</p></div>})}</div>
        </section>
        <footer className={styles.footer}>Aarohi Control Center <span>·</span> Built for your n8n automation <span>·</span> Sample data only</footer>
      </div>
    </section>
  </main>;
}
function Metric({icon,label,value,foot}:{icon:React.ReactNode;label:string;value:string;foot:string}){
  return <div className={styles.metric}><div className={styles.metricTop}><span>{label}</span><div className={styles.metricIcon}>{icon}</div></div><strong>{value}</strong><small>{foot}</small></div>;
}
