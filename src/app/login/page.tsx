"use client";
import { useEffect, useState } from "react";
import { Bot, ShieldCheck, Eye, EyeOff, LoaderCircle } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const [password,setPassword] = useState("");
  const [show,setShow] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [configured,setConfigured] = useState<boolean|null>(null);
  useEffect(()=>{fetch("/api/auth",{cache:"no-store"}).then(r=>r.json()).then(d=>{setConfigured(d.passwordConfigured);if(d.authenticated)location.replace("/");}).catch(()=>setConfigured(false));},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Login failed");location.replace("/");}catch(e){setError(e instanceof Error?e.message:"Unable to log in");}finally{setBusy(false);}}
  return <main className={styles.page}><div className={styles.glow}/><section className={styles.card}><div className={styles.logo}><Bot size={26}/></div><div className={styles.eyebrow}>PRIVATE ADMIN SPACE</div><h1>Aarohi Control Center</h1><p className={styles.subtitle}>Sign in to manage conversations, inspect task progress, and control the assistant.</p>{configured===false&&<div className={styles.setup}><ShieldCheck size={17}/><span>Admin password is not configured on the server yet. Add <code>DASHBOARD_ADMIN_PASSWORD</code> and <code>DASHBOARD_SESSION_SECRET</code> in Vercel environment variables.</span></div>}<form onSubmit={submit}><label htmlFor="password">Admin password</label><div className={styles.password}><input id="password" type={show?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter admin password" required/><button type="button" onClick={()=>setShow(!show)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{error&&<div className={styles.error}>{error}</div>}<button className={styles.submit} type="submit" disabled={busy||configured===false}>{busy?<LoaderCircle className={styles.spin} size={18}/>:"Sign in"}{!busy&&<span>→</span>}</button></form><div className={styles.safe}><ShieldCheck size={15}/> Protected with an HTTP-only admin session</div></section><footer>Private operations dashboard · Aarohi</footer></main>;
}
