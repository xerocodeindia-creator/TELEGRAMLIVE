"use client";

import { useMemo, useState } from "react";
import { Search, CirclePause, Ban, Check, CheckCheck, CalendarDays, ChevronLeft, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import styles from "@/app/dashboard.module.css";
import { type Chat, avatarColor, dayKey, initials, listTime, preview } from "@/lib/ui";

// Filters can be combined. Stage filters (Task 1/2/3, Done, New) are OR-ed with each other;
// Unread, Qualified (Task 1 link sent), Trade Qualified (Task 1 completed — stays while on Task 2/3/Done) and AI paused are extra conditions (AND). Example: Unread + Task 2 = unread chats on Task 2.
const STATUS_FILTERS = [
  { key: "unread", label: "Unread" },
  { key: "qualified", label: "Qualified" },
  { key: "tradeQualified", label: "Trade Qualified" },
  { key: "paused", label: "AI paused" },
] as const;
const STAGE_FILTERS = [
  { key: "t1", label: "Task 1" },
  { key: "t2", label: "Task 2" },
  { key: "t3", label: "Task 3" },
  { key: "done", label: "Done" },
  { key: "onboarding", label: "New" },
] as const;
type FilterKey = (typeof STATUS_FILTERS)[number]["key"] | (typeof STAGE_FILTERS)[number]["key"];

const todayKey = () => dayKey(Date.now());
function shiftDay(key: string, delta: number) {
  // key is an IST calendar date; noon UTC of that date stays on the same IST day.
  const t = Date.parse(key + "T12:00:00Z") + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function dateTitle(key: string) {
  if (!key) return "All dates";
  if (key === todayKey()) return "Today";
  if (key === shiftDay(todayKey(), -1)) return "Yesterday";
  return new Date(key + "T12:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ChatList({ chats, selectedId, onOpen, hidden, loading }: { chats: Chat[]; selectedId: string; onOpen: (id: string) => void; hidden: boolean; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<FilterKey[]>([]);
  // Default is always today (not remembered between visits); "" = all dates.
  const [date, setDate] = useState<string>(todayKey);
  // On phones the chips are folded behind a "Filters" button so the chat list gets the screen.
  const [showChips, setShowChips] = useState(false);

  const toggle = (key: FilterKey) => setActive(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const inDate = useMemo(() => (date ? chats.filter(c => c.days.has(date)) : chats), [chats, date]);

  const matches = (c: Chat, keys: FilterKey[]) => {
    const stages = keys.filter(k => STAGE_FILTERS.some(f => f.key === k));
    if (stages.length && !stages.includes(c.stage.key as FilterKey)) return false;
    if (keys.includes("unread") && c.unread === 0) return false;
    if (keys.includes("paused") && !c.paused) return false;
    if (keys.includes("qualified") && !c.qualified) return false;
    if (keys.includes("tradeQualified") && !(c.client?.completed || []).includes("task_1_angel_one")) return false;
    return true;
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inDate.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || c.id.includes(q) || c.phone.includes(q))) return false;
      return matches(c, active);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inDate, query, active]);

  // Count shown on each chip = how many chats you would see if you add that chip to the current selection.
  const countFor = (key: FilterKey) => {
    const isStage = STAGE_FILTERS.some(f => f.key === key);
    const keys = isStage ? [...active.filter(k => !STAGE_FILTERS.some(f => f.key === k)), key] : Array.from(new Set([...active, key]));
    return inDate.filter(c => matches(c, keys)).length;
  };

  const chip = (f: { key: FilterKey; label: string }) => {
    const on = active.includes(f.key);
    const n = countFor(f.key);
    return (
      <button key={f.key} className={on ? styles.chipActive : styles.chip} onClick={() => toggle(f.key)} aria-pressed={on}>
        {on && <Check size={12} />}{f.label}{n ? <span>{n}</span> : null}
      </button>
    );
  };

  return (
    <section className={`${styles.listPane} ${hidden ? styles.mobileHidden : ""}`}>
      <div className={styles.listHead}>
        <div className={styles.search}><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or Telegram ID" /></div>
        <div className={styles.dateBar}>
          <CalendarDays size={15} />
          <button className={styles.dayStep} onClick={() => setDate(d => shiftDay(d || todayKey(), -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <label className={styles.datePick}>
            <span>{dateTitle(date)}</span>
            <input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value)} onClick={e => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch {} }} aria-label="Choose date" />
          </label>
          <button className={styles.dayStep} onClick={() => setDate(d => shiftDay(d || todayKey(), 1))} disabled={!date || date >= todayKey()} aria-label="Next day"><ChevronRight size={16} /></button>
          <span className={styles.dateCount}>{inDate.length} chats</span>
          <button className={active.length || showChips ? styles.filterToggleOn : styles.filterToggle} onClick={() => setShowChips(v => !v)} aria-expanded={showChips}>
            <SlidersHorizontal size={14} />{active.length ? active.length : ""}
          </button>
          {date !== todayKey() && <button className={styles.dateLink} onClick={() => setDate(todayKey())}>Today</button>}
          {date !== "" && <button className={styles.dateLink} onClick={() => setDate("")}>All</button>}
        </div>
        <div className={`${styles.filterRow} ${showChips ? styles.filterRowOpen : ""}`}>
          {STATUS_FILTERS.map(chip)}
          <span className={styles.filterDivider} />
          {STAGE_FILTERS.map(chip)}
          {active.length > 0 && <button className={styles.clearChip} onClick={() => setActive([])}><X size={12} />Clear</button>}
        </div>
      </div>
      <div className={styles.chatRows}>
        {loading && <div className={styles.listEmpty}>Loading chats…</div>}
        {!loading && list.length === 0 && (
          <div className={styles.listEmpty}>
            {date ? `${dateTitle(date)} ko in filters ke saath koi chat nahi mili.` : "Koi chat nahi mili."}
            {(date || active.length > 0) && <div><button className={styles.dateLink} onClick={() => { setDate(""); setActive([]); }}>Saari chats dikhao</button></div>}
          </div>
        )}
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
