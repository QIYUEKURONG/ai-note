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
    return `${"#".repeat(level)} ${inline(node, "md")}\n\n`;
  }
  if (node.type === "paragraph") return `${inline(node, "md")}\n\n`;
  if (node.type === "blockquote") {
    const inner = (node.content ?? []).map(blockMarkdown).join("").trim();
    return `${inner.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const ordered = node.type === "orderedList";
    const items = (node.content ?? []).map((item, index) => {
      const body = (item.content ?? []).map(blockMarkdown).join("").trim();
      const lines = body.split("\n");
      const marker = ordered ? `${index + 1}. ` : "- ";
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
  return (node.content ?? []).map(blockMarkdown).join("");
}

function blockHtml(node: TipTapNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
    return `<h${level}>${inline(node, "html")}</h${level}>`;
  }
  if (node.type === "paragraph") return `<p>${inline(node, "html")}</p>`;
  if (node.type === "blockquote") {
    return `<blockquote>${(node.content ?? []).map(blockHtml).join("")}</blockquote>`;
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const tag = node.type === "orderedList" ? "ol" : "ul";
    const items = (node.content ?? []).map((item) => `<li>${(item.content ?? []).map(blockHtml).join("")}</li>`).join("");
    return `<${tag}>${items}</${tag}>`;
  }
  if (node.type === "codeBlock") {
    const code = escapeHtml((node.content ?? []).map((child) => child.text ?? "").join(""));
    return `<pre><code>${code}</code></pre>`;
  }
  if (node.type === "horizontalRule") return "<hr>";
  if (node.type === "image") {
    return `<img src="${escapeHtml(String(node.attrs?.src ?? ""))}" alt="">`;
  }
  return (node.content ?? []).map(blockHtml).join("");
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
  pre { background: #f6f1ea; padding: 14px 16px; overflow: auto; border-radius: 8px; }
  blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #e4d8c8; color: #5c5148; }
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
