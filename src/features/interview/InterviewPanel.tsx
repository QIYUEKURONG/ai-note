"use client";

import { useEffect, useRef } from "react";
import type { InterviewSessionRow, InterviewTurnRow } from "@/db/schema";

export function InterviewPanel(props: {
  sessions: InterviewSessionRow[];
  active: { session: InterviewSessionRow; turns: InterviewTurnRow[] } | null;
  answer: string;
  busy: boolean;
  onAnswer: (value: string) => void;
  onStart: () => void;
  onSend: () => void;
  onFinish: () => void;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const report = props.active?.session.resultJson
    ? (JSON.parse(props.active.session.resultJson) as {
        mastery?: string;
        weakPoints?: string[];
        suggestions?: string[];
        summary?: string;
      })
    : null;
  const turns = props.active?.turns ?? [];

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns.length, props.busy, report?.summary]);

  return (
    <section className="interview-page">
      <div className="interview-scroll" ref={scroller}>
        {!props.active ? (
          <div className="interview-start">
            <h2>就这篇笔记，开始一场面试</h2>
            <p>AI 会从基础问到追问。答完可以看到现在的掌握情况，然后回到原文。</p>
            <button type="button" className="btn" disabled={props.busy} onClick={props.onStart}>
              {props.busy ? "正在出题…" : "开始面试"}
            </button>
          </div>
        ) : (
          <div className="interview-thread">
            {turns.map((turn) => (
              <article key={turn.id} className={turn.role === "candidate" ? "turn mine" : "turn"}>
                <small>{turn.role === "interviewer" ? `面试官 · Level ${turn.level}` : "你"}</small>
                <p>{turn.content}</p>
              </article>
            ))}
            {props.busy ? <p className="interview-wait">面试官在想下一问…</p> : null}
            {report ? (
              <article className="mastery">
                <small>掌握情况</small>
                <h3>{report.mastery}</h3>
                {report.summary ? <p>{report.summary}</p> : null}
                {report.weakPoints?.length ? <p>还可以再看：{report.weakPoints.join("、")}</p> : null}
                {report.suggestions?.length ? <p>接下来：{report.suggestions.join("、")}</p> : null}
              </article>
            ) : null}
          </div>
        )}
      </div>

      {props.active && props.active.session.status !== "completed" ? (
        <form
          className="interview-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!props.busy && props.answer.trim()) props.onSend();
          }}
        >
          <textarea
            rows={3}
            value={props.answer}
            placeholder="用自己的话回答"
            onChange={(event) => props.onAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!props.busy && props.answer.trim()) props.onSend();
              }
            }}
          />
          <div>
            <button type="button" className="text-btn" disabled={props.busy} onClick={props.onFinish}>
              结束并看掌握情况
            </button>
            <button type="submit" className="btn" disabled={props.busy || !props.answer.trim()}>
              回答
            </button>
          </div>
        </form>
      ) : null}

      {props.sessions.length > 0 ? (
        <div className="interview-past">
          {props.sessions.map((session) => (
            <button key={session.id} type="button" onClick={() => props.onOpen(session.id)}>
              {session.status === "completed" ? "已结束" : "进行中"} · Level {session.currentLevel}
            </button>
          ))}
          {props.active ? (
            <button type="button" onClick={props.onStart} disabled={props.busy}>
              新的一场
            </button>
          ) : null}
          {props.active ? (
            <button type="button" className="danger" onClick={() => props.onDelete(props.active!.session.id)}>
              删除这场
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
