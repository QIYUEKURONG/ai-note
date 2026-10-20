"use client";

import { useState, type ReactNode } from "react";
import { ORGANIZE_KINDS, organizeKindLabel, type OrganizeKind } from "@/domain/organize-kinds";
import { documentFromOrganizedMarkdown, type TipTapNode } from "@/lib/document";
import type { AIResultRow } from "@/db/schema";

const FOCUS: Array<{ id: OrganizeKind; hint: string }> = [
  { id: "study_note", hint: "小标题、代码框、重点词，适合复习" },
  { id: "code_box", hint: "把代码和命令放进独立的框" },
  { id: "key_terms", hint: "给必须记住的词标上重点" },
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
  images?: TipTapNode[];
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
          {props.images?.length ? (
            <div className="sheet-images">
              {props.images.map((image, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${String(image.attrs?.src ?? "")}-${index}`} src={String(image.attrs?.src ?? "")} alt="" />
              ))}
            </div>
          ) : null}
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
            <RichMarkdown markdown={active.body} images={props.scoped ? [] : props.images ?? []} />
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

function RichMarkdown(props: { markdown: string; images: TipTapNode[] }) {
  const nodes = documentFromOrganizedMarkdown(props.markdown, "", props.images).content?.slice(1) ?? [];
  return (
    <div className="sheet-rich">
      {nodes.map((node, index) => (
        <RichNode key={index} node={node} />
      ))}
    </div>
  );
}

function RichNode(props: { node: TipTapNode }) {
  const node = props.node;
  const children = node.content?.map((child, index) => <RichNode key={index} node={child} />) ?? null;
  if (node.type === "heading") {
    const level = Number(node.attrs?.level ?? 2);
    if (level <= 2) return <h3>{children}</h3>;
    return <h4>{children}</h4>;
  }
  if (node.type === "paragraph") return <p>{children}</p>;
  if (node.type === "bulletList") return <ul>{children}</ul>;
  if (node.type === "orderedList") return <ol>{children}</ol>;
  if (node.type === "listItem") return <li>{children}</li>;
  if (node.type === "blockquote") return <blockquote>{children}</blockquote>;
  if (node.type === "horizontalRule") return <hr />;
  if (node.type === "hardBreak") return <br />;
  if (node.type === "codeBlock") {
    const text = node.content?.map((child) => child.text ?? "").join("") ?? "";
    const language = String(node.attrs?.language ?? "");
    return (
      <pre>
        {language ? <span className="code-lang">{language}</span> : null}
        {text}
      </pre>
    );
  }
  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    if (!src) return null;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" />;
  }
  if (node.type === "table") return <table><tbody>{children}</tbody></table>;
  if (node.type === "tableRow") return <tr>{children}</tr>;
  if (node.type === "tableHeader") return <th>{children}</th>;
  if (node.type === "tableCell") return <td>{children}</td>;
  if (node.type === "text") return <MarkedText text={node.text ?? ""} marks={node.marks} />;
  return children ? <>{children}</> : null;
}

function MarkedText(props: { text: string; marks?: TipTapNode["marks"] }) {
  const parts = props.text.split("[AI推测]");
  let body: ReactNode = parts.map((part, index) => (
    <span key={index}>
      {index > 0 ? <span className="spec">[AI推测]</span> : null}
      {part}
    </span>
  ));
  for (const mark of props.marks ?? []) {
    if (mark.type === "bold") body = <strong>{body}</strong>;
    else if (mark.type === "italic") body = <em>{body}</em>;
    else if (mark.type === "strike") body = <s>{body}</s>;
    else if (mark.type === "code") body = <code>{body}</code>;
    else if (mark.type === "highlight") {
      body = <mark style={{ background: String(mark.attrs?.color ?? "#f4d35e") }}>{body}</mark>;
    }
  }
  return <>{body}</>;
}
