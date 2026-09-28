"use client";

import { reviewKindLabel, type ReviewMark } from "@/domain/review";

export function ReviewRail(props: {
  marks: ReviewMark[];
  activeId: string | null;
  busy: boolean;
  notice: string;
  onSelect: (id: string) => void;
  onApply: (mark: ReviewMark) => void;
  onIgnore: (mark: ReviewMark) => void;
  onRerun: () => void;
}) {
  const open = props.marks.filter((mark) => mark.status === "open");
  const closed = props.marks.filter((mark) => mark.status !== "open");
  const active = open.find((mark) => mark.id === props.activeId) ?? null;

  return (
    <aside className="review-rail">
      <header>
        <strong>批注</strong>
        <button type="button" className="text-btn" disabled={props.busy} onClick={props.onRerun}>
          {props.busy ? "阅读中…" : "重新检测"}
        </button>
      </header>
      <p className="review-legend">
        <i className="dot error" /> 错误
        <i className="dot incomplete" /> 不完整
        <i className="dot deepen" /> 待深入
      </p>
      {props.notice ? <p className="review-notice">{props.notice}</p> : null}
      {props.busy && open.length === 0 ? <p className="review-empty">正在顺着正文找值得停下来的地方…</p> : null}
      {!props.busy && open.length === 0 ? (
        <p className="review-empty">这篇笔记上还没有未处理的批注。</p>
      ) : null}
      <ul>
        {open.map((mark) => (
          <li key={mark.id}>
            <button
              type="button"
              className={`review-item review-${mark.kind} ${active?.id === mark.id ? "is-on" : ""}`}
              onClick={() => props.onSelect(mark.id)}
            >
              <span>{reviewKindLabel(mark.kind)}</span>
              {mark.quote}
            </button>
            {active?.id === mark.id ? (
              <div className="review-card">
                <p>{mark.explanation}</p>
                {mark.suggestion ? <blockquote>{mark.suggestion}</blockquote> : null}
                <div className="review-actions">
                  <button type="button" className="btn" disabled={!mark.suggestion} onClick={() => props.onApply(mark)}>
                    修改
                  </button>
                  <button type="button" className="btn ghost" onClick={() => props.onIgnore(mark)}>
                    忽略
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {closed.length > 0 ? <p className="review-closed">已处理 {closed.length} 处</p> : null}
    </aside>
  );
}
