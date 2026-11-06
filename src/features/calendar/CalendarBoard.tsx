"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  SLIP_COLORS,
  dayNumber,
  formatDayTitle,
  formatMonthTitle,
  formatShortDay,
  mergeSlipText,
  monthGrid,
  monthKey,
  orderSlips,
  shiftMonth,
  todayKey,
  type SlipColor,
} from "@/domain/calendar";
import { api } from "@/lib/client";
import type { CalendarSlipRow } from "@/db/schema";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const COLOR_LABEL: Record<SlipColor, string> = {
  cream: "纸色",
  butter: "暖黄",
  mint: "薄荷",
  sky: "天蓝",
  blush: "浅粉",
};

type Pending = { kind: "delete"; id: string } | { kind: "merge" } | { kind: "note" } | null;

function clock(ms: number) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function onEnter(event: React.KeyboardEvent<HTMLTextAreaElement>, save: () => void) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  save();
}

export function CalendarBoard() {
  const router = useRouter();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month };
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const [slips, setSlips] = useState<CalendarSlipRow[]>([]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [color, setColor] = useState<SlipColor>("cream");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editColor, setEditColor] = useState<SlipColor>("cream");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const from = cells[0]?.day ?? today;
  const to = cells[cells.length - 1]?.day ?? today;
  const rangeRef = useRef({ from, to });
  rangeRef.current = { from, to };

  const reload = useCallback(async () => {
    const range = rangeRef.current;
    const data = await api<{ slips: CalendarSlipRow[] }>(`/api/slips?from=${range.from}&to=${range.to}`);
    setSlips(data.slips);
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ slips: CalendarSlipRow[] }>(`/api/slips?from=${from}&to=${to}`);
        if (!cancelled) {
          setSlips(data.slips);
          setError("");
        }
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "日历没有打开");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    setPicked((current) => current.filter((id) => slips.some((slip) => slip.id === id)));
  }, [slips]);

  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "没有完成");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function openDay(day: string) {
    const [year, month] = day.split("-").map(Number);
    setCursor({ year, month });
    setSelectedDay(day);
    setEditingId(null);
  }

  function goMonth(delta: number) {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    const grid = monthGrid(next.year, next.month);
    setCursor(next);
    setSelectedDay((day) => (grid.some((cell) => cell.day === day) ? day : `${monthKey(next.year, next.month)}-01`));
    setEditingId(null);
  }

  function togglePick(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleDay(day: string) {
    const ids = slips.filter((slip) => slip.day === day).map((slip) => slip.id);
    if (ids.length === 0) return;
    setPicked((current) => {
      const all = ids.every((id) => current.includes(id));
      return all ? current.filter((id) => !ids.includes(id)) : [...current, ...ids.filter((id) => !current.includes(id))];
    });
  }

  function saveEdit() {
    if (!editingId || !draft.trim()) return;
    const id = editingId;
    const body = draft;
    const nextColor = editColor;
    void run(async () => {
      await api(`/api/slips/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body, color: nextColor }),
      });
      setEditingId(null);
      await reload();
    });
  }

  const daySlips = slips.filter((slip) => slip.day === selectedDay).sort((a, b) => a.createdAt - b.createdAt);
  const pickedSlips = orderSlips(slips.filter((slip) => picked.includes(slip.id)));
  const pickedDays = [...new Set(pickedSlips.map((slip) => slip.day))];
  const preview = mergeSlipText(pickedSlips);
  const dayAllPicked = daySlips.length > 0 && daySlips.every((slip) => picked.includes(slip.id));
  const monthCount = slips.filter((slip) => slip.day.startsWith(`${monthKey(cursor.year, cursor.month)}-`)).length;

  if (!ready) return <div className="space-loading">正在打开日历…</div>;

  return (
    <div className="space cal">
      <header className="space-head">
        <div>
          <p className="space-kicker">日历便签</p>
          <h1>{formatMonthTitle(cursor.year, cursor.month)}</h1>
        </div>
        <div className="cal-nav">
          <Link href="/" className="btn ghost cal-home">
            空间
          </Link>
          <button type="button" className="btn ghost cal-step" aria-label="上个月" onClick={() => goMonth(-1)}>
            ‹
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const [year, month] = today.split("-").map(Number);
              setCursor({ year, month });
              setSelectedDay(today);
              setEditingId(null);
            }}
          >
            今天
          </button>
          <button type="button" className="btn ghost cal-step" aria-label="下个月" onClick={() => goMonth(1)}>
            ›
          </button>
        </div>
      </header>
      <p className="space-lead">
        把当天的灵感记成一句话。有字的日期右上角可以选中那一天，选中两天就能合并。这个月 {monthCount} 条。
      </p>
      {error ? <p className="cal-error">{error}</p> : null}

      <div className="cal-layout">
        <div>
          <div className="cal-weekdays">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((cell) => {
              const items = slips.filter((slip) => slip.day === cell.day);
              const extra = Math.max(0, items.length - 2);
              const pickedCount = items.filter((slip) => picked.includes(slip.id)).length;
              return (
                <div
                  key={cell.day}
                  className={[
                    "cal-cell",
                    cell.inMonth ? "" : "is-out",
                    cell.day === today ? "is-today" : "",
                    cell.day === selectedDay ? "is-on" : "",
                    pickedCount > 0 && pickedCount === items.length ? "is-picked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="cal-open"
                    aria-pressed={cell.day === selectedDay}
                    aria-label={formatDayTitle(cell.day)}
                    onClick={() => openDay(cell.day)}
                  >
                    <span className="cal-num">{dayNumber(cell.day)}</span>
                    {items.slice(0, 2).map((slip) => (
                      <span key={slip.id} className="cal-preview">
                        <i className={`tone-${slip.color}`} />
                        {slip.body.replace(/\s+/g, " ")}
                      </span>
                    ))}
                    {extra > 0 ? <span className="cal-more">还有 {extra} 条</span> : null}
                    {items.length > 0 ? (
                      <span className="cal-dots" aria-hidden>
                        {items.slice(0, 3).map((slip) => (
                          <i key={slip.id} className={`tone-${slip.color}`} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                  {items.length > 0 ? (
                    <button
                      type="button"
                      className={
                        pickedCount === items.length
                          ? "cal-day-check is-on"
                          : pickedCount > 0
                            ? "cal-day-check is-some"
                            : "cal-day-check"
                      }
                      aria-pressed={pickedCount === items.length}
                      aria-label={
                        pickedCount === items.length
                          ? `取消${formatShortDay(cell.day)}`
                          : `选中${formatShortDay(cell.day)}`
                      }
                      onClick={() => toggleDay(cell.day)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <section className="day-sheet" aria-label={formatDayTitle(selectedDay)}>
          <header>
            <h2>
              {formatDayTitle(selectedDay)}
              {selectedDay === today ? " · 今天" : ""}
            </h2>
            {daySlips.length > 0 ? (
              <button type="button" className="slip-mini" onClick={() => toggleDay(selectedDay)}>
                {dayAllPicked ? "取消这天" : "选中这天"}
              </button>
            ) : null}
            <span>{daySlips.length ? `${daySlips.length} 条` : "还没记"}</span>
          </header>

          {daySlips.length === 0 ? <p className="space-empty">这一天还空着。写下一句就好。</p> : null}

          <div className="slip-stack">
            {daySlips.map((slip) => {
              const editing = editingId === slip.id;
              const tone = (SLIP_COLORS as readonly string[]).includes(slip.color) ? slip.color : "cream";
              return (
                <article
                  key={slip.id}
                  className={`slip-paper tone-${editing ? editColor : tone}${picked.includes(slip.id) ? " is-picked" : ""}`}
                >
                  <header>
                    <button
                      type="button"
                      className={picked.includes(slip.id) ? "slip-check is-on" : "slip-check"}
                      aria-pressed={picked.includes(slip.id)}
                      aria-label={picked.includes(slip.id) ? "取消选择" : "选中这条便签"}
                      onClick={() => togglePick(slip.id)}
                    />
                    <time>{clock(slip.createdAt)}</time>
                    {editing ? (
                      <button type="button" className="slip-mini" onClick={saveEdit}>
                        完成
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="slip-mini"
                        onClick={() => {
                          setEditingId(slip.id);
                          setDraft(slip.body);
                          setEditColor((SLIP_COLORS as readonly string[]).includes(slip.color) ? (slip.color as SlipColor) : "cream");
                        }}
                      >
                        改
                      </button>
                    )}
                    <button type="button" className="slip-mini danger" onClick={() => setPending({ kind: "delete", id: slip.id })}>
                      删除
                    </button>
                  </header>
                  {editing ? (
                    <>
                      <ColorDots value={editColor} onChange={setEditColor} />
                      <textarea
                        autoFocus
                        value={draft}
                        aria-label="修改便签"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => onEnter(event, saveEdit)}
                      />
                    </>
                  ) : (
                    <p>{slip.body}</p>
                  )}
                </article>
              );
            })}
          </div>

          <form
            className={`slip-composer tone-${color}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!text.trim()) return;
              void run(async () => {
                await api("/api/slips", {
                  method: "POST",
                  body: JSON.stringify({ day: selectedDay, body: text, color }),
                });
                setText("");
                await reload();
              });
            }}
          >
            <ColorDots value={color} onChange={setColor} />
            <textarea
              value={text}
              aria-label="新的便签"
              placeholder={selectedDay === today ? "今天的一句话" : "这一天的一句话"}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) =>
                onEnter(event, () => {
                  event.currentTarget.form?.requestSubmit();
                })
              }
            />
            <footer>
              <span>回车记下</span>
              <button type="submit" className="btn" disabled={busy || !text.trim()}>
                记下
              </button>
            </footer>
          </form>
        </section>
      </div>

      {picked.length > 0 ? (
        <div className="cal-mergebar">
          <span>
            已选 {pickedDays.map((day) => formatShortDay(day)).join("、")}
            {pickedDays.length < 2 ? "，再选一天" : ""}
          </span>
          <button
            type="button"
            className="btn"
            disabled={busy || picked.length < 2}
            title={picked.length < 2 ? "再选一天就能合并" : "合成一条便签"}
            onClick={() => setPending({ kind: "merge" })}
          >
            合并
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setPending({ kind: "note" })}>
            收成笔记
          </button>
          <button type="button" className="btn ghost" onClick={() => setPicked([])}>
            取消
          </button>
        </div>
      ) : null}

      {pending?.kind === "delete" ? (
        <ConfirmDialog
          title="去掉这条便签？"
          message="删掉之后就找不回来了。"
          onClose={() => setPending(null)}
          onConfirm={() => {
            const id = pending.id;
            setPending(null);
            void run(async () => {
              await api(`/api/slips/${id}`, { method: "DELETE" });
              setEditingId((current) => (current === id ? null : current));
              setPicked((current) => current.filter((item) => item !== id));
              await reload();
            });
          }}
        />
      ) : null}
      {pending?.kind === "merge" ? (
        <ConfirmDialog
          title="合并这些便签？"
          message="选中的这些天会合成一条，写在最晚的那一天。原来的便签会去掉。"
          detail={preview}
          confirmLabel="合并"
          tone="primary"
          onClose={() => setPending(null)}
          onConfirm={() => {
            const ids = pickedSlips.map((slip) => slip.id);
            setPending(null);
            void run(async () => {
              const data = await api<{ slip: CalendarSlipRow }>("/api/slips/merge", {
                method: "POST",
                body: JSON.stringify({ ids, mode: "slip" }),
              });
              const [year, month] = data.slip.day.split("-").map(Number);
              setPicked([]);
              setEditingId(null);
              setSelectedDay(data.slip.day);
              if (year === cursor.year && month === cursor.month) await reload();
              else setCursor({ year, month });
            });
          }}
        />
      ) : null}
      {pending?.kind === "note" ? (
        <ConfirmDialog
          title="收成一篇笔记？"
          message="会按日期生成一篇新笔记。日历上的便签还留着。"
          detail={preview}
          confirmLabel="收成笔记"
          tone="primary"
          onClose={() => setPending(null)}
          onConfirm={() => {
            const ids = pickedSlips.map((slip) => slip.id);
            setPending(null);
            void run(async () => {
              const data = await api<{ noteId: string }>("/api/slips/merge", {
                method: "POST",
                body: JSON.stringify({ ids, mode: "note" }),
              });
              setPicked([]);
              router.push(`/notes/${data.noteId}`);
            });
          }}
        />
      ) : null}
    </div>
  );
}

function ColorDots(props: { value: SlipColor; onChange: (color: SlipColor) => void }) {
  return (
    <div className="color-dots">
      {SLIP_COLORS.map((item) => (
        <button
          key={item}
          type="button"
          className={props.value === item ? `tone-${item} is-on` : `tone-${item}`}
          aria-label={COLOR_LABEL[item]}
          aria-pressed={props.value === item}
          onClick={() => props.onChange(item)}
        />
      ))}
    </div>
  );
}
