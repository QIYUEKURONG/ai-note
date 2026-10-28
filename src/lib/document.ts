export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export type TipTapDoc = {
  type: "doc";
  content?: TipTapNode[];
};

export const HIGHLIGHT_COLORS = {
  yellow: "#f4d35e",
  blue: "#7eb8da",
  green: "#8fbf7f",
  red: "#e07a5f",
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

export function emptyDocument(title = ""): TipTapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: title ? [{ type: "text", text: title }] : [],
      },
      { type: "paragraph" },
    ],
  };
}

export function documentToText(doc: TipTapDoc | TipTapNode): string {
  const parts: string[] = [];
  walkText(doc, parts);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function walkText(node: TipTapNode, parts: string[]) {
  if (node.text) {
    parts.push(node.text);
  }
  if (node.content) {
    for (const child of node.content) {
      walkText(child, parts);
    }
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "listItem" ||
      node.type === "codeBlock" ||
      node.type === "horizontalRule"
    ) {
      parts.push("\n");
    }
  }
}

export type ExtractedHighlight = {
  text: string;
  color: string;
};

export function extractHighlights(doc: TipTapDoc): ExtractedHighlight[] {
  const found: ExtractedHighlight[] = [];
  walkHighlights(doc, found);
  return found;
}

function walkHighlights(node: TipTapNode, found: ExtractedHighlight[]) {
  if (node.text && node.marks) {
    const mark = node.marks.find((m) => m.type === "highlight");
    if (mark) {
      const color = String(mark.attrs?.color ?? HIGHLIGHT_COLORS.yellow);
      found.push({ text: node.text, color });
    }
  }
  if (node.content) {
    for (const child of node.content) walkHighlights(child, found);
  }
}

function keepStoredImage(node: TipTapNode): boolean {
  if (node.type !== "image") return true;
  const src = String(node.attrs?.src ?? "");
  return src.startsWith("/api/media/") || src.startsWith("data:image/") || src.startsWith("http://") || src.startsWith("https://");
}

function withoutDeadImages(node: TipTapNode): TipTapNode | null {
  if (!keepStoredImage(node)) return null;
  if (!node.content) return node;
  return { ...node, content: node.content.flatMap((child) => {
    const next = withoutDeadImages(child);
    return next ? [next] : [];
  }) };
}

/** blob: addresses only exist in the browser tab that created them. */
export function dropDeadImages(doc: TipTapDoc): TipTapDoc {
  return {
    ...doc,
    content: (doc.content ?? []).flatMap((node) => {
      const next = withoutDeadImages(node);
      return next ? [next] : [];
    }),
  };
}

export function parseDocument(raw: string): TipTapDoc {
  try {
    const parsed = JSON.parse(raw) as TipTapDoc;
    if (parsed?.type === "doc") return liftMarkdownTables(dropDeadImages(parsed));
  } catch {
    // fall through
  }
  return emptyDocument();
}

function splitTableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isPipeRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2;
}

type InlineMark = { type: string; attrs?: Record<string, unknown> };

const INLINE_MARKS: Array<{ open: string; close: string; mark: InlineMark }> = [
  { open: "**", close: "**", mark: { type: "bold" } },
  { open: "==", close: "==", mark: { type: "highlight", attrs: { color: HIGHLIGHT_COLORS.yellow } } },
  { open: "~~", close: "~~", mark: { type: "strike" } },
  { open: "`", close: "`", mark: { type: "code" } },
  { open: "*", close: "*", mark: { type: "italic" } },
];

/** `==词==`、`**粗体**`、`` `代码` `` become real marks. Image markers stay as slots. */
export function inlineNodes(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  let buffer = "";
  const pushText = () => {
    if (!buffer) return;
    nodes.push({ type: "text", text: buffer });
    buffer = "";
  };
  for (let index = 0; index < text.length; ) {
    const rest = text.slice(index);
    const marker = /^\[\[图(\d+)\]\]/.exec(rest);
    if (marker) {
      pushText();
      nodes.push({ type: "imageSlot", attrs: { index: Number(marker[1]) } });
      index += marker[0].length;
      continue;
    }
    const picture = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (picture) {
      pushText();
      nodes.push({ type: "image", attrs: { src: picture[2], alt: picture[1] || null } });
      index += picture[0].length;
      continue;
    }
    let matched = false;
    for (const spec of INLINE_MARKS) {
      if (!rest.startsWith(spec.open)) continue;
      const innerStart = spec.open.length;
      const end = rest.indexOf(spec.close, innerStart);
      if (end <= innerStart) continue;
      const inner = rest.slice(innerStart, end);
      if (!inner.trim() || inner.includes("\n")) continue;
      pushText();
      nodes.push({ type: "text", text: inner, marks: [spec.mark] });
      index += end + spec.close.length;
      matched = true;
      break;
    }
    if (matched) continue;
    buffer += text[index];
    index += 1;
  }
  pushText();
  return nodes;
}

function inlineText(text: string): TipTapNode[] {
  return inlineNodes(text).filter((node) => node.type === "text");
}

function blocksFromLines(lines: string[]): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  let inline: TipTapNode[] = [];
  const flush = () => {
    if (!inline.length) return;
    nodes.push({ type: "paragraph", content: inline });
    inline = [];
  };
  lines.forEach((line, lineIndex) => {
    const parts = inlineNodes(line);
    if (lineIndex > 0 && inline.length) inline.push({ type: "hardBreak" });
    for (const part of parts) {
      if (part.type === "image" || part.type === "imageSlot") {
        flush();
        nodes.push(part);
      } else {
        inline.push(part);
      }
    }
  });
  flush();
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

function paragraphFromText(text: string): TipTapNode {
  const content = inlineText(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** Pipe rows in a proportional font never line up. A real table does. */
export function markdownTableNode(source: string): TipTapNode | null {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2 || !lines.every(isPipeRow)) return null;
  const separatorAt = lines.findIndex(isTableSeparator);
  if (separatorAt < 0) return null;
  const columnCount = splitTableCells(lines[separatorAt]).length;
  if (columnCount < 2) return null;
  const rows: TipTapNode[] = [];
  lines.forEach((line, index) => {
    if (index === separatorAt) return;
    const cells = splitTableCells(line);
    const header = index < separatorAt;
    const rowCells: TipTapNode[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const text = cells[column] ?? "";
      rowCells.push({
        type: header ? "tableHeader" : "tableCell",
        content: [paragraphFromText(text)],
      });
    }
    rows.push({ type: "tableRow", content: rowCells });
  });
  if (!rows.length) return null;
  return { type: "table", content: rows };
}

function paragraphSource(node: TipTapNode): string | null {
  if (node.type !== "paragraph") return null;
  if (!node.content?.length) return "";
  let text = "";
  for (const child of node.content) {
    if (child.type === "hardBreak") {
      text += "\n";
      continue;
    }
    if (child.type === "text" && !child.marks?.length) {
      text += child.text ?? "";
      continue;
    }
    return null;
  }
  return text;
}

function takeMarkdownTable(lines: string[], start: number): { table: TipTapNode; next: number } | null {
  if (!isPipeRow(lines[start] ?? "")) return null;
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].trim() && isPipeRow(lines[end + 1])) end += 1;
  const table = markdownTableNode(lines.slice(start, end + 1).join("\n"));
  if (!table) return null;
  return { table, next: end + 1 };
}

function liftNode(node: TipTapNode): TipTapNode {
  if (node.type === "paragraph") return markdownTableNode(paragraphSource(node) ?? "") ?? node;
  if (!node.content) return node;
  return { ...node, content: node.content.map(liftNode) };
}

export function liftMarkdownTables(doc: TipTapDoc): TipTapDoc {
  return { ...doc, content: (doc.content ?? []).map(liftNode) };
}

export function collectImages(doc: TipTapDoc | TipTapNode): TipTapNode[] {
  const images: TipTapNode[] = [];
  const walk = (node: TipTapNode) => {
    if (node.type === "image" && keepStoredImage(node)) {
      images.push({ type: "image", attrs: { ...node.attrs } });
      return;
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return images;
}

/** Plain text for the organizer, with [[图1]] standing in for each stored picture. */
export function noteSourceForOrganize(doc: TipTapDoc): string {
  const parts: string[] = [];
  let count = 0;
  const walk = (node: TipTapNode) => {
    if (node.type === "image" && keepStoredImage(node)) {
      count += 1;
      parts.push(`[[图${count}]]\n`);
      return;
    }
    if (node.text) parts.push(node.text);
    if (!node.content) return;
    for (const child of node.content) walk(child);
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "listItem" ||
      node.type === "codeBlock" ||
      node.type === "horizontalRule"
    ) {
      parts.push("\n");
    }
  };
  walk(doc);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function realizeImages(nodes: TipTapNode[], images: TipTapNode[]): TipTapNode[] {
  const used = new Set<number>();
  const take = (index: number): TipTapNode | null => {
    if (index < 0 || index >= images.length || used.has(index)) return null;
    used.add(index);
    return { type: "image", attrs: { ...images[index].attrs } };
  };
  const walk = (node: TipTapNode): TipTapNode[] => {
    if (node.type === "imageSlot") {
      const image = take(Number(node.attrs?.index) - 1);
      return image ? [image] : [];
    }
    if (node.type === "image") {
      const src = String(node.attrs?.src ?? "");
      const index = images.findIndex(
        (item, itemIndex) => !used.has(itemIndex) && String(item.attrs?.src ?? "") === src,
      );
      if (index >= 0) used.add(index);
      if (!keepStoredImage(node)) return [];
      return [{ type: "image", attrs: { ...node.attrs } }];
    }
    if (!node.content) return [node];
    const content = node.content.flatMap(walk);
    if (node.type !== "paragraph" && node.type !== "heading") {
      return [{ ...node, content }];
    }
    const lifted: TipTapNode[] = [];
    let inline: TipTapNode[] = [];
    const flushInline = () => {
      if (!inline.length) return;
      lifted.push({ ...node, content: inline });
      inline = [];
    };
    for (const child of content) {
      if (child.type === "image") {
        flushInline();
        lifted.push(child);
      } else {
        inline.push(child);
      }
    }
    flushInline();
    return lifted;
  };
  const next = nodes.flatMap(walk);
  images.forEach((image, index) => {
    if (!used.has(index)) next.push({ type: "image", attrs: { ...image.attrs } });
  });
  return next;
}

export function markdownToNodes(markdown: string): TipTapNode[] {
  const lines = markdown.split("\n");
  const nodes: TipTapNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(...blocksFromLines(paragraph));
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    nodes.push({
      type: list.ordered ? "orderedList" : "bulletList",
      content: list.items.map((item) => ({
        type: "listItem",
        content: blocksFromLines([item]),
      })),
    });
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    nodes.push({
      type: "blockquote",
      content: quote.map((line) => paragraphFromText(line)),
    });
    quote = [];
  };
  const flushFlow = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("```")) {
      flushFlow();
      const language = trimmed.slice(3).trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      const text = body.join("\n").replace(/\s+$/, "");
      nodes.push({
        type: "codeBlock",
        attrs: { language: language || null },
        content: text ? [{ type: "text", text }] : [],
      });
      continue;
    }
    if (!trimmed) {
      flushFlow();
      continue;
    }
    const table = takeMarkdownTable(lines, index);
    if (table) {
      flushFlow();
      nodes.push(table.table);
      index = table.next - 1;
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushFlow();
      nodes.push({ type: "horizontalRule" });
      continue;
    }
    const ownLine = /^(?:\[\[图\d+\]\]|!\[[^\]]*\]\([^)\s]+\))$/.test(trimmed)
      ? blocksFromLines([trimmed])
      : null;
    if (ownLine?.length === 1 && (ownLine[0].type === "image" || ownLine[0].type === "imageSlot")) {
      flushFlow();
      nodes.push(ownLine[0]);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushFlow();
      const level = heading[1].length === 1 ? 2 : 3;
      const content = inlineText(heading[2]);
      nodes.push({
        type: "heading",
        attrs: { level },
        content: content.length ? content : [],
      });
      continue;
    }
    const bullet = /^(?:[-*]|•)\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(trimmed);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }
  flushFlow();
  return nodes;
}

export function appendMarkdownBlocks(doc: TipTapDoc, markdown: string, heading: string): TipTapDoc {
  const content = [...(doc.content ?? [])];
  content.push({ type: "horizontalRule" });
  content.push({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: heading }],
  });
  content.push(...markdownToNodes(markdown));
  return { type: "doc", content };
}

export function replaceDocumentFromMarkdown(markdown: string, title: string): TipTapDoc {
  const base = emptyDocument(title);
  return appendMarkdownBlocks({ type: "doc", content: base.content?.slice(0, 1) }, markdown, "正文");
}

export function documentFromOrganizedMarkdown(
  markdown: string,
  title: string,
  images: TipTapNode[] = [],
): TipTapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: title ? [{ type: "text", text: title }] : [],
      },
      ...realizeImages(markdownToNodes(markdown), images),
    ],
  };
}

function isTextNode(node: TipTapNode): boolean {
  return node.type === "text" || (typeof node.text === "string" && !node.content?.length);
}

function flattenText(node: TipTapNode): string {
  if (isTextNode(node)) return node.text ?? "";
  return (node.content ?? []).map(flattenText).join("");
}

function organizedBlocks(markdown: string): TipTapNode[] {
  return documentFromOrganizedMarkdown(markdown, "").content?.slice(1) ?? [];
}

function isVacantContent(type: string, content: TipTapNode[]): boolean {
  if (type === "paragraph" || type === "heading" || type === "codeBlock") {
    return content.every(
      (child) => child.type === "hardBreak" || (child.type === "text" && !child.text) || isVacantNode(child),
    );
  }
  if (type === "listItem" || type === "bulletList" || type === "orderedList" || type === "blockquote") {
    return content.length === 0 || content.every(isVacantNode);
  }
  return false;
}

function isVacantNode(node: TipTapNode): boolean {
  if (node.type === "text") return !node.text;
  if (!node.content) return false;
  return isVacantContent(node.type, node.content);
}

function ensureListItem(content: TipTapNode[]): TipTapNode[] {
  if (!content.length || content[0]?.type === "paragraph") return content;
  return [{ type: "paragraph" }, ...content];
}

/** Pull parsed Markdown blocks out of inline parents so they become real editor blocks. */
function liftInserted(node: TipTapNode, inner: TipTapNode[], inserted: WeakSet<TipTapNode>): TipTapNode[] {
  if (node.type === "tableCell" || node.type === "tableHeader") {
    const content = inner.filter((child) => !isVacantNode(child));
    return [{ ...node, content: content.length ? content : [{ type: "paragraph" }] }];
  }
  const out: TipTapNode[] = [];
  let bucket: TipTapNode[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const content = bucket;
    bucket = [];
    if (isVacantContent(node.type, content)) return;
    const nextContent = node.type === "listItem" ? ensureListItem(content) : content;
    if (!nextContent.length) return;
    out.push({ ...node, content: nextContent });
  };
  for (const child of inner) {
    if (inserted.has(child)) {
      flush();
      out.push(child);
    } else if (!isVacantNode(child)) {
      bucket.push(child);
    }
  }
  flush();
  return out;
}

function rewriteNodes(
  nodes: TipTapNode[],
  rangeStart: number,
  rangeEnd: number,
  state: { cursor: number; placed: boolean },
  blocks: TipTapNode[],
  inserted: WeakSet<TipTapNode>,
): TipTapNode[] {
  const out: TipTapNode[] = [];
  for (const node of nodes) {
    if (isTextNode(node)) {
      const text = node.text ?? "";
      const start = state.cursor;
      const end = start + text.length;
      state.cursor = end;
      const overlapStart = Math.max(rangeStart, start);
      const overlapEnd = Math.min(rangeEnd, end);
      if (overlapStart >= overlapEnd) {
        if (text) out.push(node);
        continue;
      }
      const before = text.slice(0, overlapStart - start);
      const after = text.slice(overlapEnd - start);
      if (before) out.push({ ...node, text: before });
      if (!state.placed) {
        out.push(...blocks);
        state.placed = true;
      }
      if (after) out.push({ ...node, text: after });
      continue;
    }

    const start = state.cursor;
    if (!node.content?.length) {
      const inside = state.cursor > rangeStart && state.cursor < rangeEnd;
      if (!(inside && (node.type === "paragraph" || node.type === "heading"))) out.push(node);
      continue;
    }

    const inner = rewriteNodes(node.content, rangeStart, rangeEnd, state, blocks, inserted);
    const overlaps = start < rangeEnd && state.cursor > rangeStart;
    if (!overlaps) {
      out.push(node);
      continue;
    }
    out.push(...liftInserted(node, inner, inserted));
  }
  return out;
}

/**
 * Replace a selected passage with organized Markdown.
 * The preview parses that Markdown into headings, lists, and code blocks.
 * Writing it back as a plain string leaves the `#` and fences visible in the editor.
 */
export function replaceScopeWithMarkdown(doc: TipTapDoc, quote: string, markdown: string): TipTapDoc | null {
  const needle = quote.trim();
  const blocks = organizedBlocks(markdown.trim());
  if (!needle || !blocks.length) return null;
  const clone = structuredClone(doc) as TipTapDoc;
  const index = flattenText(clone).indexOf(needle);
  if (index < 0) return null;
  const inserted = new WeakSet<TipTapNode>(blocks);
  const state = { cursor: 0, placed: false };
  const content = rewriteNodes(clone.content ?? [], index, index + needle.length, state, blocks, inserted);
  if (!state.placed) return null;
  return { type: "doc", content };
}
