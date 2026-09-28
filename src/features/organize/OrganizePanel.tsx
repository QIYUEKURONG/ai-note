"use client";

import { ORGANIZE_KINDS, organizeKindLabel, type OrganizeKind } from "@/domain/organize-kinds";
import type { AIResultRow } from "@/db/schema";

export function OrganizePanel(props: {
  kind: OrganizeKind;
  onKind: (kind: OrganizeKind) => void;
  onRun: () => void;
  results: AIResultRow[];
  onInsert: (result: AIResultRow) => void;
  onReplace: (result: AIResultRow) => void;
  onCopy: (result: AIResultRow) => void;
  onDelete: (result: AIResultRow) => void;
  compact?: boolean;
}) {
  return (
    <div className={props.compact ? "panel-compact" : "side-panel"}>
      {!props.compact ? <h3>AI 整理</h3> : null}
      <p className="panel-hint">结果独立保存，不会自动覆盖原文。推断处标为 [AI推测]。</p>
      <div className="kind-list compact-kinds">
        {ORGANIZE_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={props.kind === item.id ? "choice selected" : "choice"}
            onClick={() => props.onKind(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn" onClick={props.onRun}>
          开始整理
        </button>
      </div>
      {props.results.map((result) => (
        <article key={result.id} className="result">
          <strong>{organizeKindLabel(result.kind)}</strong>
          <div
            dangerouslySetInnerHTML={{
              __html: escapeHtml(result.body).replaceAll(
                "[AI推测]",
                '<span class="spec">[AI推测]</span>',
              ),
            }}
          />
          <div className="actions">
            <button className="btn ghost" onClick={() => props.onCopy(result)}>
              复制
            </button>
            <button className="btn ghost" onClick={() => props.onInsert(result)}>
              插入
            </button>
            <button className="btn ghost" onClick={() => props.onReplace(result)}>
              替换原文
            </button>
            <button className="btn danger" onClick={() => props.onDelete(result)}>
              删除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br/>");
}
