"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, LogOut, Moon, Sun, Hand, MessageCircle, LayoutGrid, WifiOff } from "lucide-react";
import styles from "./dashboard.module.css";
import { ChatList } from "@/components/ChatList";
import { ChatView } from "@/components/ChatView";
import { Pipeline } from "@/components/Pipeline";
import { type Chat, type ClientRow, type Controls, type Msg, ms, dayKey, stageOf, readStore, writeStore } from "@/lib/ui";

const POLL_VISIBLE = 1500;
const POLL_HIDDEN = 8000;

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.getAttribute("data-theme") === "dark"); }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("aarohi-theme", next); } catch {}
  };
  return <button className={styles.iconButton} onClick={toggle} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

export default function DashboardPage() {
  const [authReady, setAuthReady] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Record<string, ClientRow>>({});
  const [messages, setMessages] = useState<Record<string, Msg[]>>({});
  const [controls, setControls] = useState<Controls>({ global: { paused: false, at: "" }, users: {} });
  const [selectedId, setSelectedId] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [view, setView] = useState<"chats" | "pipeline">("chats");
  const [readMap, setReadMap] = useState<Record<string, number>>({});
  const [globalBusy, setGlobalBusy] = useState(false);
  const [toast, setToast] = useState("");
  const cursorRef = useRef<{ sinceId: number; clientsSince: string }>({ sinceId: 0, clientsSince: "" });
  const historyLoaded = useRef<Set<string>>(new Set());
  const pollTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const showToast = useCallback((text: string) => { setToast(text); window.setTimeout(() => setToast(t => (t === text ? "" : t)), 3500); }, []);

  const mergeMessages = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const next = { ...prev };
      const touched = new Set<string>();
      for (const m of incoming) {
        const list = touched.has(m.chatId) ? next[m.chatId] : [...(next[m.chatId] || [])];
        touched.add(m.chatId);
        if (list.some(x => x.id === m.id && x.id > 0)) { next[m.chatId] = list; continue; }
        // A logged admin message replaces its optimistic copy.
        if (m.direction === "admin") {
          const i = list.findIndex(x => x.tempKey && x.text.trim() === m.text.trim());
          if (i >= 0) list.splice(i, 1);
        }
        list.push(m);
        next[m.chatId] = list;
      }
      for (const id of touched) next[id] = next[id].sort((a, b) => (a.id > 0 && b.id > 0 ? a.id - b.id : (ms(a.time) - ms(b.time)) || (a.id - b.id)));
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { sinceId, clientsSince } = cursorRef.current;
      const qs = sinceId ? `?sinceId=${sinceId}&clientsSince=${encodeURIComponent(clientsSince)}` : "";
      const res = await fetch(`/api/dashboard${qs}`, { cache: "no-store" });
      if (res.status === 401) { location.replace("/login"); return; }
      const data = await res.json();
      if (!data.connected) { setConnected(false); setError(data.error || (data.reason === "n8n_not_configured" ? "n8n is not configured in Vercel (N8N_BASE_URL / N8N_API_KEY)." : "Could not reach n8n.")); return; }
      setConnected(true);
      setError("");
      cursorRef.current = { sinceId: data.cursor?.sinceId || sinceId, clientsSince: data.cursor?.clientsSince || clientsSince };
      setControls(data.controls);
      setClients(prev => {
        const next = data.clientsFull ? {} as Record<string, ClientRow> : { ...prev };
        for (const c of data.clients as ClientRow[]) next[c.id] = c;
        return next;
      });
      mergeMessages(data.messages as Msg[]);
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      inFlight.current = false;
    }
  }, [mergeMessages]);

  // Polling loop: fast while the tab is visible, slow in the background, instant on focus.
  // schedule() always clears the previous timer, so only one poll chain can exist.
  useEffect(() => {
    let stopped = false;
    const schedule = (delay: number) => { window.clearTimeout(pollTimer.current); if (!stopped) pollTimer.current = window.setTimeout(tick, delay); };
    const tick = async () => { await poll(); schedule(document.hidden ? POLL_HIDDEN : POLL_VISIBLE); };
    (async () => {
      const auth = await fetch("/api/auth", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
      if (!auth.authenticated) { location.replace("/login"); return; }
      setAuthReady(true);
      setReadMap(readStore());
      schedule(0);
    })();
    const onVisible = () => { if (!document.hidden) schedule(0); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearTimeout(pollTimer.current); document.removeEventListener("visibilitychange", onVisible); };
  }, [poll]);

  // Load the full history of a chat the first time it is opened.
  useEffect(() => {
    if (!selectedId || historyLoaded.current.has(selectedId)) return;
    historyLoaded.current.add(selectedId);
    fetch(`/api/messages?chatId=${selectedId}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.messages) mergeMessages(d.messages); })
      .catch(() => historyLoaded.current.delete(selectedId));
  }, [selectedId, mergeMessages]);

  const chats: Chat[] = useMemo(() => {
    const ids = new Set<string>([...Object.keys(clients), ...Object.keys(messages)]);
    const out: Chat[] = [];
    for (const id of ids) {
      if (!/^\d+$/.test(id)) continue;
      const list = messages[id] || [];
      const client = clients[id];
      const last = list[list.length - 1];
      const lastIn = [...list].reverse().find(m => m.direction === "in");
      const read = readMap[id] || 0;
      const unread = id === selectedId && view === "chats" ? 0 : list.filter(m => m.direction === "in" && m.id > read).length;
      const ctl = controls.users[id];
      out.push({
        id,
        name: client?.name && client.name !== "Telegram user" ? client.name : lastIn?.name || client?.name || "Telegram user",
        phone: client?.phone || "",
        client,
        paused: Boolean(ctl?.paused),
        noKyc: Boolean(ctl?.noKyc),
        last,
        lastTime: last ? ms(last.time) : ms(client?.updatedAt || ""),
        unread,
        stage: stageOf(client),
        days: new Set<string>([...list.map(m => ms(m.time)).filter(Boolean).map(dayKey), ...(client?.updatedAt && ms(client.updatedAt) ? [dayKey(ms(client.updatedAt))] : [])]),
      });
    }
    return out.sort((a, b) => b.lastTime - a.lastTime);
  }, [clients, messages, controls, readMap, selectedId, view]);

  const selected = chats.find(c => c.id === selectedId);
  const selectedMessages = selectedId ? messages[selectedId] || [] : [];

  // Mark the open chat as read up to its newest inbound message.
  useEffect(() => {
    if (!selectedId || view !== "chats") return;
    const maxIn = selectedMessages.reduce((acc, m) => (m.direction === "in" && m.id > acc ? m.id : acc), 0);
    if (maxIn && maxIn > (readMap[selectedId] || 0)) {
      const next = { ...readStore(), [selectedId]: maxIn };
      writeStore(next);
      setReadMap(next);
    }
  }, [selectedId, selectedMessages, readMap, view]);

  const totalUnread = chats.reduce((a, c) => a + c.unread, 0);
  useEffect(() => { document.title = totalUnread ? `(${totalUnread}) Aarohi Control Center` : "Aarohi Control Center"; }, [totalUnread]);

  async function toggleGlobal() {
    const turningOff = !controls.global.paused;
    if (turningOff && !confirm("AI sabke liye band karein?\n\nTask 1 link tak ka onboarding chalta rahega. Uske baad bot kisi ko automatic reply nahi karega, screenshot bhi check nahi karega — aapko khud reply aur task complete karna hoga.")) return;
    setGlobalBusy(true);
    try {
      const r = await fetch("/api/ai-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: "global", action: turningOff ? "pause" : "resume" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || "Could not change global AI");
      setControls(c => ({ ...c, global: { paused: turningOff, at: new Date().toISOString() } }));
      showToast(turningOff ? "Human mode ON — AI sabke liye band" : "AI wapas ON — automation chalu");
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed"); }
    finally { setGlobalBusy(false); }
  }

  async function toggleUser(chat: Chat) {
    const action = chat.paused ? "resume" : "pause";
    const r = await fetch("/api/ai-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: chat.id, action }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(d.detail || d.error || "AI control failed"); return; }
    setControls(c => ({ ...c, users: { ...c.users, [chat.id]: { paused: action === "pause", noKyc: false } } }));
    showToast(action === "pause" ? `AI paused for ${chat.name}` : `AI resumed for ${chat.name}`);
  }

  async function sendMessage(chatId: string, text: string, retryKey?: string) {
    const tempKey = retryKey || `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: Msg = { id: -Date.now(), chatId, name: "Admin", direction: "admin", type: "text", text, fileId: "", time: new Date().toISOString(), status: "manual_admin", local: "sending", tempKey };
    setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []).filter(m => m.tempKey !== tempKey), optimistic] }));
    try {
      const r = await fetch("/api/manual-reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || "Message was not sent");
      // Sent: show as delivered until the logged copy arrives from n8n (then it is replaced).
      setMessages(prev => ({ ...prev, [chatId]: (prev[chatId] || []).map(m => (m.tempKey === tempKey ? { ...m, local: undefined } : m)) }));
      if (!d.logged) showToast("Message bhej diya, par history mein save nahi hua (n8n API).");
      window.setTimeout(poll, 400);
    } catch (e) {
      setMessages(prev => ({ ...prev, [chatId]: (prev[chatId] || []).map(m => (m.tempKey === tempKey ? { ...m, local: "failed" } : m)) }));
      showToast(e instanceof Error ? e.message : "Send failed");
    }
  }

  async function completeTask(chat: Chat, taskId: string, sendMessages: boolean) {
    const r = await fetch("/api/task-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: chat.id, taskId, sendMessages }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || d.error || "Task update failed");
    if (d.failed?.length) showToast(`Task update ho gaya, par message nahi gaya: ${d.failed[0]}`);
    else showToast(sendMessages ? "Task complete ✓ — agla message bhej diya" : "Task complete ✓");
    cursorRef.current = { ...cursorRef.current, clientsSince: "" };
    window.setTimeout(poll, 300);
  }

  async function logout() { await fetch("/api/auth", { method: "DELETE" }); location.replace("/login"); }

  function openChat(id: string) { setSelectedId(id); setMobileChatOpen(true); setView("chats"); }

  if (!authReady) return <main className={styles.loading}><Bot size={26} /><p>Checking admin session…</p></main>;

  const human = controls.global.paused;
  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}><div className={styles.brandMark}><Bot size={20} /></div><div><strong>Aarohi</strong><small>Control Center</small></div></div>
        <nav className={styles.viewTabs}>
          <button className={view === "chats" ? styles.viewTabActive : styles.viewTab} onClick={() => setView("chats")}><MessageCircle size={16} /><span>Chats</span>{totalUnread > 0 && <b>{totalUnread}</b>}</button>
          <button className={view === "pipeline" ? styles.viewTabActive : styles.viewTab} onClick={() => setView("pipeline")}><LayoutGrid size={16} /><span>Tasks</span></button>
        </nav>
        <div className={styles.topRight}>
          <button className={human ? styles.globalOff : styles.globalOn} onClick={toggleGlobal} disabled={globalBusy || !connected} title={human ? "Click karke AI wapas ON karo" : "Click karke AI sabke liye band karo (Human mode)"}>
            <span className={styles.switchTrack}><span className={styles.switchKnob} /></span>
            {human ? <><Hand size={15} /><span>Human mode</span></> : <><Bot size={15} /><span>AI ON</span></>}
          </button>
          <span className={connected ? styles.liveDot : styles.offlineDot} title={connected ? "Live — updates every ~1.5 s" : error}>{connected ? "Live" : <WifiOff size={14} />}</span>
          <ThemeToggle />
          <button className={styles.iconButton} onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
        </div>
      </header>
      {human && <div className={styles.humanBanner}><Hand size={16} /><span><b>Human mode ON:</b> Task 1 link tak onboarding chal raha hai. Uske baad bot kisi ko reply nahi karega — chat se aap khud reply karo aur &quot;Task complete&quot; button se agla task bhejo.</span></div>}
      {connected === false && <div className={styles.errorBanner}><WifiOff size={16} /><span>{error || "n8n se connect nahi ho pa raha."} Retrying…</span></div>}

      {view === "chats" ? (
        <div className={styles.chatLayout}>
          <ChatList chats={chats} selectedId={selectedId} onOpen={openChat} hidden={mobileChatOpen} loading={connected === null} />
          <ChatView
            chat={selected}
            messages={selectedMessages}
            visible={mobileChatOpen}
            globalHuman={human}
            onBack={() => setMobileChatOpen(false)}
            onSend={sendMessage}
            onToggleAi={toggleUser}
            onCompleteTask={completeTask}
            connected={Boolean(connected)}
          />
        </div>
      ) : (
        <Pipeline chats={chats} onOpen={openChat} />
      )}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </main>
  );
}
