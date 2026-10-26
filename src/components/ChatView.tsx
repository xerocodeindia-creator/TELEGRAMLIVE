"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Bot, Check, CheckCheck, CirclePause, CirclePlay, Clock3, AlertCircle, Send, ChevronDown, X, Zap, ImageOff, MessageCircle, CircleCheckBig, Phone, Hash } from "lucide-react";
import styles from "@/app/dashboard.module.css";
import { type Chat, type Msg, TASKS, avatarColor, dayKey, dayLabel, fullDate, initials, isMedia, ms, timeOf } from "@/lib/ui";
import { QUICK_REPLIES } from "@/lib/task-messages";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : <Fragment key={i}>{p}</Fragment>))}</>;
}

function Photo({ fileId, onOpen, onLoad }: { fileId: string; onOpen: (src: string) => void; onLoad: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/telegram-file?file_id=${encodeURIComponent(fileId)}`;
  if (failed) return <div className={styles.photoFailed}><ImageOff size={22} /><span>Image load nahi hui</span></div>;
  return <button type="button" className={styles.photoButton} onClick={() => onOpen(src)}><img src={src} alt="Screenshot" loading="lazy" onLoad={onLoad} onError={() => setFailed(true)} /></button>;
}

type Props = {
  chat?: Chat;
  messages: Msg[];
  visible: boolean;
  globalHuman: boolean;
  connected: boolean;
  onBack: () => void;
  onSend: (chatId: string, text: string, retryKey?: string) => Promise<void>;
  onToggleAi: (chat: Chat) => Promise<void>;
  onCompleteTask: (chat: Chat, taskId: string, sendMessages: boolean) => Promise<void>;
};

export function ChatView({ chat, messages, visible, globalHuman, connected, onBack, onSend, onToggleAi, onCompleteTask }: Props) {
  const [draft, setDraft] = useState("");
  const [lightbox, setLightbox] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(0);
  const lastCount = useRef(0);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const drafts = useRef<Record<string, string>>({});
  const prevChat = useRef("");
  useEffect(() => {
    // Keep a separate unsent draft per chat.
    if (prevChat.current) drafts.current[prevChat.current] = draft;
    prevChat.current = chat?.id || "";
    setDraft(chat ? drafts.current[chat.id] || "" : "");
    setShowQuick(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setNewBelow(0);
  }, []);

  // New chat opened: jump to the newest message (and again after images settle).
  useLayoutEffect(() => {
    lastCount.current = messages.length;
    scrollToBottom();
    const t = window.setTimeout(() => scrollToBottom(), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, visible]);

  // New messages: follow them if the admin is at the bottom, otherwise count them.
  useEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added <= 0) return;
    const mine = messages[messages.length - 1]?.direction === "admin";
    if (atBottom.current || mine) window.requestAnimationFrame(() => scrollToBottom(true));
    else setNewBelow(n => n + added);
  }, [messages, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (atBottom.current) setNewBelow(0);
  };

  // Auto-grow the composer.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [draft]);

  const grouped = useMemo(() => {
    const out: { day: string; label: string; items: { m: Msg; first: boolean; last: boolean }[] }[] = [];
    messages.forEach((m, i) => {
      const t = ms(m.time) || Date.now();
      const key = dayKey(t);
      if (!out.length || out[out.length - 1].day !== key) out.push({ day: key, label: dayLabel(t), items: [] });
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const sameAsPrev = prev && prev.direction === m.direction && dayKey(ms(prev.time) || 0) === key && ms(m.time) - ms(prev.time) < 5 * 60000;
      const sameAsNext = next && next.direction === m.direction && dayKey(ms(next.time) || 0) === key && ms(next.time) - ms(m.time) < 5 * 60000;
      out[out.length - 1].items.push({ m, first: !sameAsPrev, last: !sameAsNext });
    });
    return out;
  }, [messages]);

  if (!chat) {
    return (
      <section className={`${styles.chatPane} ${styles.chatEmptyPane} ${visible ? "" : styles.mobileHidden}`}>
        <div className={styles.chatPlaceholder}><MessageCircle size={42} /><b>Chat select karo</b><span>Left list se kisi bhi user par click karo — messages yahan live dikhenge.</span></div>
      </section>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text || !connected) return;
    setDraft("");
    drafts.current[chat.id] = "";
    setShowQuick(false);
    onSend(chat.id, text);
    textRef.current?.focus();
  };

  const currentTaskIndex = chat.stage.index;
  const canComplete = currentTaskIndex >= 0 && currentTaskIndex <= 2;
  const aiState = chat.noKyc ? "Blocked (No KYC)" : chat.paused ? "AI paused" : globalHuman ? "Human mode" : "AI active";

  return (
    <section className={`${styles.chatPane} ${visible ? "" : styles.mobileHidden}`}>
      <header className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <span className={styles.avatar} style={{ background: avatarColor(chat.id) }}>{initials(chat.name)}</span>
        <div className={styles.chatTitle}>
          <strong>{chat.name}</strong>
          <span className={styles.chatSub}>
            <span><Hash size={12} />{chat.id}</span>
            {chat.phone && <a href={`tel:${chat.phone}`}><Phone size={12} />{chat.phone}</a>}
          </span>
        </div>
        <div className={styles.chatActions}>
          <span className={`${styles.aiBadge} ${chat.noKyc ? styles.aiBlocked : chat.paused || globalHuman ? styles.aiPaused : styles.aiActive}`}>{aiState}</span>
          {canComplete && <button className={styles.completeButton} onClick={() => setTaskModal(true)} disabled={!connected} title="Current task complete mark karo aur agla task bhejo"><CircleCheckBig size={16} /><span>Task {currentTaskIndex + 1} complete</span></button>}
          <button className={chat.paused ? styles.resumeButton : styles.pauseButton} disabled={aiBusy || !connected} onClick={async () => { setAiBusy(true); try { await onToggleAi(chat); } finally { setAiBusy(false); } }} title={chat.paused ? "Is user ke liye AI chalu karo" : "Sirf is user ke liye AI band karo"}>
            {chat.paused ? <CirclePlay size={16} /> : <CirclePause size={16} />}<span>{chat.paused ? "Resume AI" : "Pause AI"}</span>
          </button>
        </div>
      </header>
      <div className={styles.progressStrip}>
        {TASKS.map((t, i) => {
          const done = chat.client?.completed.includes(t.id);
          const current = !done && i === currentTaskIndex;
          return <span key={t.id} className={done ? styles.stepDone : current ? styles.stepCurrent : styles.stepTodo}>{done ? <Check size={12} /> : i + 1} {t.name}</span>;
        })}
        {chat.stage.key === "onboarding" && <span className={styles.stepOnboarding}>Onboarding</span>}
      </div>

      <div className={styles.messageScroll} ref={scrollRef} onScroll={onScroll}>
        {messages.length === 0 && <div className={styles.noMessages}>Is chat mein abhi koi message record nahi hua.</div>}
        {grouped.map(g => (
          <Fragment key={g.day}>
            <div className={styles.daySeparator}><span>{g.label}</span></div>
            {g.items.map(({ m, first, last }) => {
              const out = m.direction !== "in";
              const media = isMedia(m);
              return (
                <div key={m.tempKey || m.id} className={`${styles.bubbleRow} ${out ? styles.rowOut : styles.rowIn} ${first ? styles.groupFirst : ""}`}>
                  <div className={`${styles.bubble} ${m.direction === "in" ? styles.bubbleIn : m.direction === "admin" ? styles.bubbleAdmin : styles.bubbleBot} ${last ? styles.bubbleTail : ""} ${media ? styles.bubbleMedia : ""}`} title={fullDate(m.time)}>
                    {first && out && <span className={styles.sender}>{m.direction === "admin" ? (m.status === "manual_admin_task" ? "You · task update" : "You") : <><Bot size={11} /> Aarohi bot</>}</span>}
                    {media && (m.fileId ? <Photo fileId={m.fileId} onOpen={setLightbox} onLoad={() => { if (atBottom.current) scrollToBottom(); }} /> : <div className={styles.photoFailed}><ImageOff size={22} /><span>Attachment</span></div>)}
                    {!media && !m.text && m.type !== "text" && <span className={styles.mediaNote}>🎙️ {m.type} message</span>}
                    {m.text && <p className={styles.bubbleText}><Linkified text={m.text} /></p>}
                    <span className={styles.meta}>
                      {timeOf(m.time)}
                      {out && (m.local === "sending" ? <Clock3 size={12} /> : m.local === "failed" ? <AlertCircle size={12} className={styles.failedIcon} /> : m.direction === "admin" ? <CheckCheck size={13} className={styles.tickBlue} /> : <Check size={13} />)}
                    </span>
                    {m.local === "failed" && <button className={styles.retry} onClick={() => onSend(chat.id, m.text, m.tempKey)}>Send failed — retry</button>}
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {newBelow > 0 && <button className={styles.jumpButton} onClick={() => scrollToBottom(true)}><ChevronDown size={16} />{newBelow} new</button>}

      <footer className={styles.composer}>
        {showQuick && (
          <div className={styles.quickPanel}>
            {QUICK_REPLIES.map(q => <button key={q.label} onClick={() => { setDraft(q.text); setShowQuick(false); textRef.current?.focus(); }}>{q.label}</button>)}
          </div>
        )}
        <div className={styles.composerRow}>
          <button className={showQuick ? styles.quickToggleActive : styles.quickToggle} onClick={() => setShowQuick(v => !v)} title="Quick replies" aria-label="Quick replies"><Zap size={18} /></button>
          <textarea
            ref={textRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); send(); } }}
            placeholder={connected ? "Message likho…" : "Offline — reconnecting…"}
            title="Enter = send, Shift+Enter = new line"
            rows={1}
          />
          <button className={styles.sendButton} onClick={send} disabled={!draft.trim() || !connected} aria-label="Send"><Send size={18} /></button>
        </div>
      </footer>

      {lightbox && <div className={styles.lightbox} onClick={() => setLightbox("")}><button aria-label="Close"><X size={22} /></button><img src={lightbox} alt="Screenshot full size" onClick={e => e.stopPropagation()} /></div>}
      {taskModal && canComplete && <TaskModal chat={chat} taskIndex={currentTaskIndex} onClose={() => setTaskModal(false)} onConfirm={onCompleteTask} />}
    </section>
  );
}

function TaskModal({ chat, taskIndex, onClose, onConfirm }: { chat: Chat; taskIndex: number; onClose: () => void; onConfirm: Props["onCompleteTask"] }) {
  const [sendNext, setSendNext] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const task = TASKS[taskIndex];
  const nextText: ReactNode = taskIndex === 0 ? "WhatsApp group message + Task 2 (Choice FinX) link" : taskIndex === 1 ? "\"2nd task complete\" message + Task 3 (Bajaj) link" : "Bajaj completion message";
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Task {taskIndex + 1} ({task.name}) complete?</h3>
        <p><b>{chat.name}</b> ka Task {taskIndex + 1} complete mark hoga{taskIndex < 2 ? ` aur user Task ${taskIndex + 2} par chala jayega` : " aur saare tasks done ho jayenge"}.</p>
        <label className={styles.checkLine}><input type="checkbox" checked={sendNext} onChange={e => setSendNext(e.target.checked)} /> User ko bhejo: {nextText}</label>
        {err && <div className={styles.modalError}>{err}</div>}
        <div className={styles.modalActions}>
          <button className={styles.ghostButton} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={styles.primaryButton} disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await onConfirm(chat, task.id, sendNext); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Yes, complete"}</button>
        </div>
      </div>
    </div>
  );
}
