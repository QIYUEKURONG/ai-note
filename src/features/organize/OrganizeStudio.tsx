"use client";

import { useState } from "react";
import { ORGANIZE_KINDS, organizeKindLabel, type OrganizeKind } from "@/domain/organize-kinds";
import type { AIResultRow } from "@/db/schema";

const FOCUS: Array<{ id: OrganizeKind; hint: string }> = [
  { id: "markdown", hint: "整理成可以读下去的正文" },
  { id: "structured", hint: "分层、分点，留下骨架" },
  { id: "outline", hint: "从标题看到知识树" },
  { id: "knowledge_card", hint: "适合回头复习的卡片" },
  { id: "mindmap", hint: "用缩进写出分支" },
  { id: "comparison", hint: "把差异并排放在一起" },
  { id: "timeline", hint: "按先后把事情排开" },
  { id: "eli5", hint: "用更直白的话再说一遍" },
];

const FOCUS_IDS = new Set(FOCUS.map((item) => item.id));

export function OrganizeStudio(props: {
  title: string;
  source: string;
  kind: OrganizeKind;
  onKind: (kind: OrganizeKind) => void;
  onRun: () => void;
  running: boolean;
  results: AIResultRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onApply: (result: AIResultRow) => void;
  onBack: () => void;
  scoped?: boolean;
  notice?: string;
}) {
  const [more, setMore] = useState(false);
  const active = props.scoped
    ? props.results.find((item) => item.id === props.activeId) ?? null
    : props.results.find((item) => item.id === props.activeId) ??
      props.results.find((item) => item.kind === props.kind) ??
      null;
  const extras = ORGANIZE_KINDS.filter((item) => !FOCUS_IDS.has(item.id));
  const extraOpen = more || extras.some((item) => item.id === props.kind);
  const kindMeta = FOCUS.find((item) => item.id === props.kind);

  return (
    <section className="mode-page">
      <header className="mode-bar">
        <button type="button" className="text-btn" onClick={props.onBack}>
          返回
        </button>
        <div className="mode-bar-title">
          <strong>AI 整理</strong>
          <span>{props.scoped ? "只整理选中的这段" : "确认后才会写回正文"}</span>
        </div>
        <div className="mode-bar-actions">
          <button type="button" className="btn ghost" onClick={props.onBack}>
            不应用
          </button>
          <button
            type="button"
            className="btn"
            disabled={!active || props.running}
            onClick={() => active && props.onApply(active)}
          >
            {props.scoped ? "替换选中" : "应用到正文"}
          </button>
        </div>
      </header>

      <div className="kind-row">
        {FOCUS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={props.kind === item.id ? "kind-pill is-on" : "kind-pill"}
            onClick={() => props.onKind(item.id)}
          >
            {organizeKindLabel(item.id)}
          </button>
        ))}
        <button type="button" className="kind-pill is-quiet" onClick={() => setMore((open) => !open)}>
          {extraOpen ? "收起" : "更多"}
        </button>
        {extraOpen
          ? extras.map((item) => (
              <button
                key={item.id}
                type="button"
                className={props.kind === item.id ? "kind-pill is-on" : "kind-pill is-quiet"}
                onClick={() => props.onKind(item.id)}
              >
                {item.label}
              </button>
            ))
          : null}
      </div>
      <p className="mode-lead">
        {props.scoped ? "笔记的其他内容不会被整理。 " : ""}
        {kindMeta?.hint ?? "选一种方式，在右边看结果。"}
      </p>
      {props.notice ? <p className="selection-hint">{props.notice}</p> : null}

      <div className="organize-split">
        <article className="sheet">
          <header>{props.scoped ? "选中" : "原文"}</header>
          <h2>{props.title || "未命名笔记"}</h2>
          <div className="sheet-body">{props.source.trim() || "这篇笔记还没有正文。"}</div>
        </article>
        <article className="sheet sheet-result">
          <header>
            <span>{active ? organizeKindLabel(active.kind) : "整理结果"}</span>
            <button type="button" className="text-btn" disabled={props.running} onClick={props.onRun}>
              {props.running ? "整理中…" : active ? "重新整理" : "开始整理"}
            </button>
          </header>
          {props.running && !active ? <div className="sheet-wait">正在阅读这篇笔记…</div> : null}
          {active ? (
            <div
              className="sheet-body"
              dangerouslySetInnerHTML={{
                __html: escapeHtml(active.body).replaceAll(
                  "[AI推测]",
                  '<span class="spec">[AI推测]</span>',
                ),
              }}
            />
          ) : !props.running ? (
            <div className="sheet-wait">
              {props.scoped
                ? "结果先停在这里。点「替换选中」只改这一段，笔记其余部分不动。"
                : "结果会先停在这里。点「应用到正文」才会替换原文，点「返回」则什么都不改。"}
            </div>
          ) : null}
          {!props.scoped && props.results.filter((item) => item.kind === props.kind).length > 1 ? (
            <div className="sheet-history">
              {props.results
                .filter((item) => item.kind === props.kind)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === active?.id ? "is-on" : ""}
                    onClick={() => props.onSelect(item.id)}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </button>
                ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br/>");
}
