"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Users, CheckCheck, CirclePause, UserPlus, Trophy } from "lucide-react";
import styles from "@/app/dashboard.module.css";
import { type Chat, TASKS, avatarColor, fullDate, initials, ms, dayKey } from "@/lib/ui";

export function Pipeline({ chats, onOpen }: { chats: Chat[]; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [taskIndex, setTaskIndex] = useState(0);
  const [date, setDate] = useState("");

  const stats = useMemo(() => ({
    total: chats.length,
    onboarding: chats.filter(c => c.stage.key === "onboarding").length,
    t: [0, 1, 2].map(i => chats.filter(c => c.stage.index === i).length),
    done: chats.filter(c => c.stage.key === "done").length,
    paused: chats.filter(c => c.paused).length,
  }), [chats]);

  const rows = useMemo(() => {
    const task = TASKS[taskIndex];
    if (tab === "active") return chats.filter(c => c.stage.index === taskIndex).map(c => ({ c, when: c.lastTime }));
    const stampKey = (["t1", "t2", "t3"] as const)[taskIndex];
    return chats
      .filter(c => c.client?.completed.includes(task.id))
      .map(c => ({ c, when: ms(c.client?.[stampKey] || "") }))
      .filter(r => !date || (r.when && dayKey(r.when) === date))
      .sort((a, b) => b.when - a.when);
  }, [chats, tab, taskIndex, date]);

  return (
    <div className={styles.pipelinePage}>
      <div className={styles.statGrid}>
        <Stat icon={<Users size={18} />} label="Total users" value={stats.total} />
        <Stat icon={<UserPlus size={18} />} label="Onboarding" value={stats.onboarding} />
        {TASKS.map((t, i) => <Stat key={t.id} icon={<span className={styles.statNum}>{i + 1}</span>} label={`On Task ${i + 1} · ${t.name}`} value={stats.t[i]} />)}
        <Stat icon={<Trophy size={18} />} label="All tasks done" value={stats.done} />
        <Stat icon={<CirclePause size={18} />} label="AI paused users" value={stats.paused} />
      </div>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.segment}>
            <button className={tab === "active" ? styles.segmentActive : ""} onClick={() => setTab("active")}>Working on task</button>
            <button className={tab === "completed" ? styles.segmentActive : ""} onClick={() => setTab("completed")}>Completed</button>
          </div>
          {tab === "completed" && <label className={styles.dateFilter}>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} />{date && <button onClick={() => setDate("")}>×</button>}</label>}
        </div>
        <div className={styles.taskTabs}>
          {TASKS.map((t, i) => {
            const count = tab === "active" ? stats.t[i] : chats.filter(c => c.client?.completed.includes(t.id)).length;
            return <button key={t.id} className={taskIndex === i ? styles.taskTabActive : styles.taskTab} onClick={() => setTaskIndex(i)}>Task {i + 1} · {t.name}<span>{count}</span></button>;
          })}
        </div>
        <div className={styles.pipeRows}>
          {rows.length === 0 && <div className={styles.listEmpty}>Is task mein abhi koi user nahi hai.</div>}
          {rows.map(({ c, when }) => (
            <div key={c.id} className={styles.pipeRow}>
              <span className={styles.avatar} style={{ background: avatarColor(c.id) }}>{initials(c.name)}</span>
              <div className={styles.pipeMeta}>
                <strong>{c.name}{c.paused && <CirclePause size={13} className={styles.rowPaused} />}</strong>
                <small>ID {c.id}{c.phone ? ` · ${c.phone}` : ""}</small>
                <small>{tab === "active" ? `Last activity: ${when ? fullDate(new Date(when).toISOString()) : "—"} · proof: ${c.client?.proofStatus || "—"}` : `Completed: ${when ? fullDate(new Date(when).toISOString()) : "date not recorded"}`}</small>
              </div>
              {tab === "completed" && <CheckCheck size={16} className={styles.tickBlue} />}
              <button className={styles.ghostButton} onClick={() => onOpen(c.id)}>Open chat</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className={styles.stat}><div className={styles.statIcon}>{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>;
}
