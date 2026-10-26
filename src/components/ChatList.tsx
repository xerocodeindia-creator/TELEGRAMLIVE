"use client";

import { useMemo, useState } from "react";
import { Search, CirclePause, Ban, Check, CheckCheck } from "lucide-react";
import styles from "@/app/dashboard.module.css";
import { type Chat, avatarColor, initials, listTime, preview } from "@/lib/ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "t1", label: "Task 1" },
  { key: "t2", label: "Task 2" },
  { key: "t3", label: "Task 3" },
  { key: "done", label: "Done" },
  { key: "new", label: "New" },
  { key: "paused", label: "AI paused" },
] as const;

export function ChatList({ chats, selectedId, onOpen, hidden, loading }: { chats: Chat[]; selectedId: string; onOpen: (id: string) => void; hidden: boolean; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const counts = useMemo(() => ({
    unread: chats.filter(c => c.unread > 0).length,
    t1: chats.filter(c => c.stage.key === "t1").length,
    t2: chats.filter(c => c.stage.key === "t2").length,
    t3: chats.filter(c => c.stage.key === "t3").length,
    done: chats.filter(c => c.stage.key === "done").length,
    new: chats.filter(c => c.stage.key === "onboarding").length,
    paused: chats.filter(c => c.paused).length,
  } as Record<string, number>), [chats]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || c.id.includes(q) || c.phone.includes(q))) return false;
      switch (filter) {
        case "unread": return c.unread > 0;
        case "t1": case "t2": case "t3": case "done": return c.stage.key === filter;
        case "new": return c.stage.key === "onboarding";
        case "paused": return c.paused;
        default: return true;
      }
    });
  }, [chats, query, filter]);

  return (
    <section className={`${styles.listPane} ${hidden ? styles.mobileHidden : ""}`}>
      <div className={styles.listHead}>
        <div className={styles.search}><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or Telegram ID" /></div>
        <div className={styles.filterRow}>
          {FILTERS.map(f => (
            <button key={f.key} className={filter === f.key ? styles.chipActive : styles.chip} onClick={() => setFilter(f.key)}>
              {f.label}{f.key !== "all" && counts[f.key] ? <span>{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.chatRows}>
        {loading && <div className={styles.listEmpty}>Loading chats…</div>}
        {!loading && list.length === 0 && <div className={styles.listEmpty}>Koi chat nahi mili.</div>}
        {list.map(c => (
          <button key={c.id} className={`${styles.chatRow} ${c.id === selectedId ? styles.chatRowActive : ""}`} onClick={() => onOpen(c.id)}>
            <span className={styles.avatar} style={{ background: avatarColor(c.id) }}>{initials(c.name)}</span>
            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <strong>{c.name}</strong>
                {c.paused && (c.noKyc ? <Ban size={13} className={styles.rowBlocked} aria-label="No KYC – blocked" /> : <CirclePause size={13} className={styles.rowPaused} aria-label="AI paused" />)}
                <time className={c.unread ? styles.rowTimeUnread : styles.rowTime}>{listTime(c.lastTime)}</time>
              </span>
              <span className={styles.rowBottom}>
                <span className={styles.rowPreview}>
                  {c.last && c.last.direction !== "in" && (c.last.direction === "admin" ? <CheckCheck size={14} className={styles.tickBlue} /> : <Check size={14} className={styles.tickGray} />)}
                  {preview(c.last)}
                </span>
                <span className={`${styles.stageTag} ${styles["stage_" + c.stage.key]}`}>{c.stage.short}</span>
                {c.unread > 0 && <span className={styles.unread}>{c.unread > 99 ? "99+" : c.unread}</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
