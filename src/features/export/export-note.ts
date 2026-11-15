import { calloutKind, displayedCalloutLabel, markerGlyph } from "@/domain/blocks";
import { documentToText, type TipTapDoc, type TipTapNode } from "@/lib/document";

export function exportFilename(title: string, extension: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${cleaned || "笔记"}.${extension}`;
}

function marks(text: string, node: TipTapNode, mode: "md" | "html"): string {
  let next = text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "code") next = mode === "md" ? `\`${next}\`` : `<code>${next}</code>`;
    else if (mark.type === "bold") next = mode === "md" ? `**${next}**` : `<strong>${next}</strong>`;
    else if (mark.type === "italic") next = mode === "md" ? `*${next}*` : `<em>${next}</em>`;
    else if (mark.type === "strike") next = mode === "md" ? `~~${next}~~` : `<s>${next}</s>`;
    else if (mark.type === "underline") next = `<u>${next}</u>`;
    else if (mark.type === "highlight") next = mode === "md" ? `==${next}==` : `<mark>${next}</mark>`;
    else if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "");
      next = mode === "md" ? `[${next}](${href})` : `<a href="${escapeHtml(href)}">${next}</a>`;
    }
  }
  return next;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(node: TipTapNode, mode: "md" | "html"): string {
  if (node.type === "hardBreak") return mode === "md" ? "\n" : "<br>";
  if (node.type === "text") return marks(mode === "html" ? escapeHtml(node.text ?? "") : (node.text ?? ""), node, mode);
  return (node.content ?? []).map((child) => inline(child, mode)).join("");
}

function blockMarkdown(node: TipTapNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
    const glyph = markerGlyph(typeof node.attrs?.parallel === "string" ? node.attrs.parallel : null);
    const text = inline(node, "md");
    const title = glyph ? `${glyph} ${text}`.trim() : text;
    return `${"#".repeat(level)} ${title}\n\n`;
  }
  if (node.type === "paragraph") return `${inline(node, "md")}\n\n`;
  if (node.type === "callout") {
    const kind = calloutKind(typeof node.attrs?.kind === "string" ? node.attrs.kind : "note");
    const label = displayedCalloutLabel(kind, node.attrs?.label);
    const title = label === displayedCalloutLabel(kind, null) ? kind : `${kind} ${label}`;
    const inner = (node.content ?? []).map(blockMarkdown).join("").trim();
    return `:::${title}\n${inner}\n:::\n\n`;
  }
  if (node.type === "blockquote") {
    const inner = (node.content ?? []).map(blockMarkdown).join("").trim();
    return `${inner.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const ordered = node.type === "orderedList";
    const glyph = ordered ? null : markerGlyph(typeof node.attrs?.marker === "string" ? node.attrs.marker : null);
    const items = (node.content ?? []).map((item, index) => {
      const body = (item.content ?? []).map(blockMarkdown).join("").trim();
      const lines = body.split("\n");
      const marker = ordered ? `${index + 1}. ` : glyph ? `${glyph} ` : "- ";
      return lines.map((line, lineIndex) => (lineIndex === 0 ? marker + line : `  ${line}`)).join("\n");
    });
    return `${items.join("\n")}\n\n`;
  }
  if (node.type === "codeBlock") {
    const code = (node.content ?? []).map((child) => child.text ?? "").join("");
    return `\`\`\`\n${code}\n\`\`\`\n\n`;
  }
  if (node.type === "horizontalRule") return "---\n\n";
  if (node.type === "image") return `![](${String(node.attrs?.src ?? "")})\n\n`;
  if (node.type === "table") return `${tableMarkdown(node)}\n\n`;
  return (node.content ?? []).map(blockMarkdown).join("");
}

function tableMarkdown(node: TipTapNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) => inline(cell, "md").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim()),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const next = [...row];
    while (next.length < width) next.push("");
    return next;
  });
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const rule = `| ${padded[0].map(() => "---").join(" | ")} |`;
  return [line(padded[0]), rule, ...padded.slice(1).map(line)].join("\n");
}

function blockHtml(node: TipTapNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
    const parallel = markerGlyph(typeof node.attrs?.parallel === "string" ? node.attrs.parallel : null)
      ? ` data-parallel="${escapeHtml(String(node.attrs?.parallel))}"`
      : "";
    return `<h${level}${parallel}>${inline(node, "html")}</h${level}>`;
  }
  if (node.type === "paragraph") return `<p>${inline(node, "html")}</p>`;
  if (node.type === "callout") {
    const kind = calloutKind(typeof node.attrs?.kind === "string" ? node.attrs.kind : "note");
    const label = escapeHtml(displayedCalloutLabel(kind, node.attrs?.label));
    const inner = (node.content ?? []).map(blockHtml).join("");
    return `<aside class="callout callout-${kind}" data-callout="${kind}" data-label="${label}"><span class="callout-label">${label}</span><div class="callout-body">${inner}</div></aside>`;
  }
  if (node.type === "blockquote") {
    return `<blockquote>${(node.content ?? []).map(blockHtml).join("")}</blockquote>`;
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const ordered = node.type === "orderedList";
    const tag = ordered ? "ol" : "ul";
    const marker = !ordered && markerGlyph(typeof node.attrs?.marker === "string" ? node.attrs.marker : null)
      ? ` data-marker="${escapeHtml(String(node.attrs?.marker))}"`
      : "";
    const items = (node.content ?? []).map((item) => `<li>${(item.content ?? []).map(blockHtml).join("")}</li>`).join("");
    return `<${tag}${marker}>${items}</${tag}>`;
  }
  if (node.type === "codeBlock") {
    const code = escapeHtml((node.content ?? []).map((child) => child.text ?? "").join(""));
    return `<pre><code>${code}</code></pre>`;
  }
  if (node.type === "horizontalRule") return "<hr>";
  if (node.type === "image") {
    return `<img src="${escapeHtml(String(node.attrs?.src ?? ""))}" alt="">`;
  }
  if (node.type === "table") return tableHtml(node);
  return (node.content ?? []).map(blockHtml).join("");
}

function tableHtml(node: TipTapNode): string {
  const rows = node.content ?? [];
  if (!rows.length) return "";
  const header = rows[0]?.content?.[0]?.type === "tableHeader";
  const renderRow = (row: TipTapNode, tag: string) =>
    `<tr>${(row.content ?? []).map((cell) => `<${tag}>${inline(cell, "html")}</${tag}>`).join("")}</tr>`;
  const head = header ? `<thead>${renderRow(rows[0], "th")}</thead>` : "";
  const bodyRows = header ? rows.slice(1) : rows;
  const body = bodyRows.length ? `<tbody>${bodyRows.map((row) => renderRow(row, "td")).join("")}</tbody>` : "";
  return `<table>${head}${body}</table>`;
}

export function noteToMarkdown(title: string, doc: TipTapDoc, imageSrcs: string[] = []): string {
  const body = (doc.content ?? []).map(blockMarkdown).join("").trim();
  const figures = imageSrcs.filter(Boolean).map((src) => `![](${src})`).join("\n\n");
  return [`# ${title.trim() || "未命名笔记"}`, "", body, figures].filter((part) => part !== "").join("\n\n").trim() + "\n";
}

export function noteToHtml(title: string, doc: TipTapDoc, imageSrcs: string[] = []): string {
  const safeTitle = escapeHtml(title.trim() || "未命名笔记");
  const body = (doc.content ?? []).map(blockHtml).join("");
  const figures = imageSrcs.filter(Boolean).map((src) => `<img src="${escapeHtml(src)}" alt="">`).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  body { margin: 0; background: #fff; color: #2c241b; font-family: Palatino, "Songti SC", serif; }
  article { max-width: 720px; margin: 0 auto; padding: 48px 40px 72px; font-size: 18px; line-height: 1.7; }
  h1 { font-weight: 500; font-size: 32px; margin: 0 0 24px; }
  h2, h3 { font-weight: 500; }
  img { display: block; max-width: 100%; height: auto; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 20px; }
  th, td { text-align: left; vertical-align: baseline; padding: 8px 16px 8px 0; border-bottom: 1px solid #e4d8c8; }
  th { font-weight: 600; }
  pre { background: #f6f1ea; padding: 14px 16px; overflow: auto; border-radius: 8px; }
  blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #e4d8c8; color: #5c5148; }
  aside.callout { position: relative; margin: 16px 0; padding: 32px 16px 12px; border-radius: 14px; border: 1px solid #e4d8c8; background: #f6f0e6; }
  aside.callout .callout-label { position: absolute; top: 9px; left: 14px; font-size: 11px; letter-spacing: 0.12em; color: #8a7560; }
  aside.callout .callout-label::before { content: "✎ "; }
  aside.callout-idea { background: #fbf6d4; border-color: #ead9a0; }
  aside.callout-idea .callout-label { color: #9a7420; }
  aside.callout-idea .callout-label::before { content: "✦ "; }
  aside.callout-tip { background: #eef6e8; border-color: #c9ddb8; }
  aside.callout-tip .callout-label { color: #4f7a45; }
  aside.callout-tip .callout-label::before { content: "🍃 "; }
  aside.callout-caution { background: #fbeee6; border-color: #f0cfc0; }
  aside.callout-caution .callout-label { color: #a85a42; }
  aside.callout-caution .callout-label::before { content: "! "; }
  aside.callout-example { background: #eaf2f8; border-color: #c9d8e6; }
  aside.callout-example .callout-label { color: #3f6484; }
  aside.callout-example .callout-label::before { content: "例 "; }
  aside.callout-aside { background: transparent; border-style: dashed; }
  aside.callout-aside .callout-label { color: #7a7168; }
  aside.callout-aside .callout-label::before { content: "… "; }
  ul[data-marker] { list-style: none; padding-left: 0.2em; }
  ul[data-marker] > li { position: relative; padding-left: 1.5em; }
  ul[data-marker] > li::before { position: absolute; left: 0; }
  ul[data-marker="heart"] > li::before { content: "♥"; color: #d4537e; }
  ul[data-marker="tree"] > li::before { content: "🌲"; }
  ul[data-marker="star"] > li::before { content: "★"; color: #c48a1a; }
  ul[data-marker="flower"] > li::before { content: "✿"; color: #c45b78; }
  ul[data-marker="clover"] > li::before { content: "🍀"; }
  ul[data-marker="spark"] > li::before { content: "✦"; color: #c47b12; }
  h1[data-parallel]::before, h2[data-parallel]::before, h3[data-parallel]::before { margin-right: 0.3em; font-size: 0.8em; }
  [data-parallel="heart"]::before { content: "♥"; color: #d4537e; }
  [data-parallel="tree"]::before { content: "🌲"; }
  [data-parallel="star"]::before { content: "★"; color: #c48a1a; }
  [data-parallel="flower"]::before { content: "✿"; color: #c45b78; }
  [data-parallel="clover"]::before { content: "🍀"; }
  [data-parallel="spark"]::before { content: "✦"; color: #c47b12; }
  mark { background: #f4d35e; }
  @media print { article { max-width: none; } }
</style>
</head>
<body>
<article>
<h1>${safeTitle}</h1>
${body}
${figures}
</article>
</body>
</html>`;
}

export function noteToPlainText(title: string, doc: TipTapDoc): string {
  return `${title.trim() || "未命名笔记"}\n\n${documentToText(doc)}\n`;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "导出 PDF");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.visibility = "hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const images = Array.from(doc.images);
  const ready = Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  );
  void ready.then(() => {
    win.focus();
    win.print();
  });
  win.onafterprint = () => frame.remove();
}
