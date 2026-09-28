"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TaskToast } from "@/components/TaskToast";
import {
  masteryFromScore,
  masteryLabel,
  type SpacePoint,
  type SpaceSnapshot,
} from "@/domain/knowledge";
import { api, touchSpace } from "@/lib/client";
import type { AITaskRow } from "@/db/schema";
import { KnowledgeMap } from "./KnowledgeMap";

export function KnowledgeSpace(props: {
  onOpen: (id: string, mode?: "interview" | "check") => void;
  onCreate: () => void;
  onLibraryChange: () => void;
}) {
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);
  const [task, setTask] = useState<AITaskRow | null>(null);
  const [error, setError] = useState("");
  const [tray, setTray] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusReview, setFocusReview] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [confirm, setConfirm] = useState<"merge" | "accept" | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ space: SpaceSnapshot }>("/api/space");
    setSpace(data.space);
  }, []);

  useEffect(() => {
    setFocusNoteId(new URLSearchParams(window.location.search).get("note"));
  }, []);

  useEffect(() => {
    void load().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "知识空间没有打开");
    });
  }, [load]);

  useEffect(() => {
    if (space?.drafts[0]) setMergeOpen(true);
  }, [space?.drafts[0]?.id]);

  useEffect(() => {
    function onTouch() {
      void load();
    }
    window.addEventListener("mindbook-space", onTouch);
    return () => window.removeEventListener("mindbook-space", onTouch);
  }, [load]);

  useEffect(() => {
    if (!task || task.status === "success" || task.status === "failed") return;
    const timer = window.setInterval(async () => {
      const res = await api<{ task: AITaskRow }>(`/api/tasks/${task.id}`);
      setTask(res.task);
      if (res.task.status === "success" || res.task.status === "failed") {
        await load();
        touchSpace();
        if (res.task.status === "success" && res.task.type === "merge_notes") setTray([]);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [task, load]);

  const pending = task && task.status !== "success" && task.status !== "failed";
  const recent = useMemo(() => {
    if (!space) return [];
    const ids: string[] = [];
    for (const row of space.recentStudy) {
      if (row.noteId && !ids.includes(row.noteId)) ids.push(row.noteId);
    }
    for (const note of space.notes) {
      if (!ids.includes(note.id)) ids.push(note.id);
    }
    return ids
      .map((id) => space.notes.find((note) => note.id === id))
      .filter((note): note is SpaceSnapshot["notes"][number] => Boolean(note))
      .slice(0, 4);
  }, [space]);

  async function run(body: Record<string, unknown>) {
    setError("");
    try {
      const res = await api<{ task?: AITaskRow; space?: SpaceSnapshot; noteId?: string }>("/api/space", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.task) setTask(res.task);
      if (res.space) setSpace(res.space);
      if (res.noteId) props.onLibraryChange();
      touchSpace();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "没有完成");
    }
  }

  function addTray(id: string) {
    setTray((current) => (current.includes(id) || current.length >= 6 ? current : [...current, id]));
  }

  if (!space) {
    return <div className="space-loading">正在打开知识空间…</div>;
  }

  if (space.notes.length === 0) {
    return (
      <div className="browser-empty">
        <h1>知识会从一篇笔记开始</h1>
        <p>写下来之后，这里会慢慢长出地图、缺口和该复习的问题。</p>
        <button className="btn" onClick={props.onCreate}>
          新建笔记
        </button>
      </div>
    );
  }

  const now = Date.now();
  const dueReminders = space.reminders.filter((item) => item.remindAt <= now);
  const dueReviews = space.reviews.filter((item) => item.status === "pending");
  const selected = space.points.find((point) => point.id === selectedId) ?? null;
  const draft = space.drafts[0] ?? null;

  return (
    <div className="space">
      <header className="space-head">
        <div>
          <p className="space-kicker">知识空间</p>
          <h1>这些笔记，正在长成一个体系</h1>
        </div>
        <button type="button" className="btn ghost" onClick={() => setMergeOpen((open) => !open)}>
          合并笔记{draft ? " · 有草稿" : ""}
        </button>
      </header>

      {dueReminders.length > 0 || dueReviews.length > 0 ? (
        <section className="today-strip">
          <span>今天</span>
          {dueReminders.map((item) => (
            <button key={item.id} type="button" onClick={() => props.onOpen(item.noteId)}>
              {item.title || "笔记"} 到时间了
            </button>
          ))}
          {dueReviews.length > 0 ? (
            <button type="button" onClick={() => setFocusReview(dueReviews[0].id)}>
              {dueReviews.length} 个知识点要回忆
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="space-block">
        <header>
          <h2>最近学习</h2>
        </header>
        <div className="slip-row">
          {recent.map((note) => (
            <button key={note.id} type="button" className="slip" onClick={() => props.onOpen(note.id)}>
              <strong>{note.title || "未命名笔记"}</strong>
              <p>{note.excerpt || "还没有正文"}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-block map-sheet">
        <header>
          <h2>知识地图</h2>
          <button className="btn ghost" disabled={Boolean(pending)} onClick={() => void run({ action: "atlas" })}>
            {space.points.length > 0 ? "重新生成" : "生成地图"}
          </button>
        </header>
        <p className="space-lead">一次只展开一篇。点上面的笔记，圆点就是这篇里的知识点，再点开看详情。</p>
        <KnowledgeMap
          notes={space.notes}
          points={space.points}
          edges={space.edges}
          selectedId={selectedId}
          focusNoteId={focusNoteId}
          onOpenNote={(id) => props.onOpen(id)}
          onSelectPoint={setSelectedId}
          onConfirmEdge={(id) => void run({ action: "confirm-edge", edgeId: id })}
        />
        {selected ? (
          <PointCard
            point={selected}
            notes={space.notes}
            onOpen={props.onOpen}
            onConfirm={() => void run({ action: "confirm-point", pointId: selected.id })}
          />
        ) : null}
      </section>

      <div className="space-split">
        <section className="quiet-card" id="review-block">
          <header>
            <h2>待复习</h2>
            <button className="btn ghost" disabled={Boolean(pending)} onClick={() => void run({ action: "review-plan" })}>
              排今天的复习
            </button>
          </header>
          <p className="space-lead">用提问检查掌握程度。答完会记到这个知识点上，下一轮地图和面试都会看到。</p>
          {dueReviews.length === 0 ? <p className="space-empty">今天还没有要回忆的问题。</p> : null}
          {dueReviews.map((item) => (
            <article key={item.id} className={`recall ${focusReview === item.id ? "is-focus" : ""}`}>
              <small>{item.pointLabel}</small>
              <p>{item.prompt}</p>
              <textarea
                value={answers[item.id] ?? ""}
                placeholder="先试着答，再看笔记"
                onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
              />
              <div className="recall-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={Boolean(pending) || !(answers[item.id] ?? "").trim()}
                  onClick={() =>
                    void run({ action: "answer-review", itemId: item.id, answer: answers[item.id] ?? "" })
                  }
                >
                  回答
                </button>
                {item.noteId ? (
                  <button type="button" className="text-btn" onClick={() => props.onOpen(item.noteId!, "interview")}>
                    去面试
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {space.reviews
            .filter((item) => item.status === "done")
            .slice(0, 2)
            .map((item) => (
              <p key={item.id} className="recall-done">
                {item.pointLabel} · {item.score ?? 0} 分 · {masteryLabel(masteryFromScore(item.score ?? 0))}
                {item.comment ? `。${item.comment}` : ""}
              </p>
            ))}
        </section>

        <section className="quiet-card">
          <header>
            <h2>还缺什么</h2>
            <button className="btn ghost" disabled={Boolean(pending)} onClick={() => void run({ action: "gaps" })}>
              看看缺口
            </button>
          </header>
          {space.gaps.length === 0 ? <p className="space-empty">地图形成之后，这里会指出还没写到的关键知识。</p> : null}
          {space.gaps.map((gap) => (
            <article key={gap.id} className="gap-card">
              <strong>{gap.label}</strong>
              <p>{gap.reason}</p>
              {gap.status === "created" && gap.noteId ? (
                <button type="button" className="text-btn" onClick={() => props.onOpen(gap.noteId!)}>
                  打开学习笔记
                </button>
              ) : (
                <div className="recall-actions">
                  <button type="button" className="btn" onClick={() => void run({ action: "create-gap", gapId: gap.id })}>
                    写成笔记
                  </button>
                  <button type="button" className="text-btn" onClick={() => void run({ action: "dismiss-gap", gapId: gap.id })}>
                    先不用
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>

      {mergeOpen ? (
      <section
        className={`merge-tray ${over ? "is-over" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const id = event.dataTransfer.getData("text/plain");
          if (id) addTray(id);
        }}
      >
        <header>
          <h2>合并笔记</h2>
          <p>勾选或从左侧拖入两篇以上。生成前会再问一次。原来的笔记不会被改动。</p>
        </header>
        <div className="merge-picks">
          {space.notes.map((note) => {
            const on = tray.includes(note.id);
            return (
              <button
                key={note.id}
                type="button"
                className={on ? "is-on" : ""}
                onClick={() =>
                  setTray((current) =>
                    current.includes(note.id) ? current.filter((item) => item !== note.id) : [...current, note.id].slice(0, 6),
                  )
                }
              >
                {on ? "已选 · " : ""}
                {note.title || "未命名笔记"}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn"
          disabled={Boolean(pending) || tray.length < 2}
          onClick={() => setConfirm("merge")}
        >
          生成合并稿
        </button>
        {draft ? (
          <article className="merge-draft">
            <strong>{draft.title}</strong>
            <p className="space-lead">来自 {draft.sourceTitles.join("、")}。原文不会被覆盖。</p>
            {draft.conflicts.length > 0 ? (
              <ul>
                {draft.conflicts.map((item) => (
                  <li key={item.topic}>
                    <b>{item.topic}</b> {item.detail}
                  </li>
                ))}
              </ul>
            ) : null}
            {draft.duplicates.length > 0 ? <p>重复过的：{draft.duplicates.join("、")}</p> : null}
            <pre>{draft.body.slice(0, 700)}</pre>
            <div className="recall-actions">
              <button type="button" className="btn" onClick={() => setConfirm("accept")}>
                留下这篇新笔记
              </button>
              <button type="button" className="text-btn" onClick={() => void run({ action: "discard-merge", draftId: draft.id })}>
                放弃这份稿
              </button>
            </div>
          </article>
        ) : null}
      </section>
      ) : null}

      {confirm === "merge" ? (
        <ConfirmDialog
          title="生成一份合并稿？"
          message={`将把${tray
            .map((id) => space.notes.find((note) => note.id === id)?.title || "笔记")
            .map((title) => `「${title}」`)
            .join("、")}整理成一篇新稿。原来的笔记会原样保留，不会被覆盖。`}
          confirmLabel="生成合并稿"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const ids = tray;
            setConfirm(null);
            void run({ action: "merge", noteIds: ids });
          }}
        />
      ) : null}
      {confirm === "accept" && draft ? (
        <ConfirmDialog
          title="留下这篇新笔记？"
          message="会新建一篇笔记。原来参与合并的笔记仍然保留，不会被替换。"
          confirmLabel="新建笔记"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const id = draft.id;
            setConfirm(null);
            void run({ action: "accept-merge", draftId: id });
          }}
        />
      ) : null}
      {error ? <p className="space-error">{error}</p> : null}
      <TaskToast
        task={task}
        onRetry={() => {
          if (!task) return;
          void api<{ task: AITaskRow }>(`/api/tasks/${task.id}`, { method: "POST" }).then((res) => setTask(res.task));
        }}
      />
    </div>
  );
}

function PointCard(props: {
  point: SpacePoint;
  notes: SpaceSnapshot["notes"];
  onOpen: (id: string) => void;
  onConfirm: () => void;
}) {
  const linked = props.point.noteIds
    .map((id) => props.notes.find((note) => note.id === id))
    .filter((note): note is SpaceSnapshot["notes"][number] => Boolean(note));
  return (
    <div className="point-card">
      <div>
        <strong>{props.point.label}</strong>
        <small>
          {props.point.status === "suggested" ? "建议" : "已确认"} · {masteryLabel(props.point.mastery)}
        </small>
      </div>
      <p>{props.point.summary}</p>
      <div className="recall-actions">
        {linked.map((note) => (
          <button key={note.id} type="button" className="text-btn" onClick={() => props.onOpen(note.id)}>
            {note.title}
          </button>
        ))}
        {props.point.status === "suggested" ? (
          <button type="button" className="btn" onClick={props.onConfirm}>
            确认这条知识
          </button>
        ) : null}
      </div>
    </div>
  );
}
