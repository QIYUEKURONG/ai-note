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
        content: [
          text
            ? { type: "paragraph", content: [{ type: "text", text }] }
            : { type: "paragraph" },
        ],
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

export function appendMarkdownBlocks(doc: TipTapDoc, markdown: string, heading: string): TipTapDoc {
  const content = [...(doc.content ?? [])];
  content.push({ type: "horizontalRule" });
  content.push({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: heading }],
  });
  const lines = markdown.split("\n");
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    content.push({
      type: "paragraph",
      content: [{ type: "text", text }],
    });
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) {
      flush();
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    const table = takeMarkdownTable(lines, index);
    if (table) {
      flush();
      content.push(table.table);
      index = table.next - 1;
      continue;
    }
    buffer.push(line.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s+/, "• "));
  }
  flush();
  return { type: "doc", content };
}

export function replaceDocumentFromMarkdown(markdown: string, title: string): TipTapDoc {
  const base = emptyDocument(title);
  return appendMarkdownBlocks({ type: "doc", content: base.content?.slice(0, 1) }, markdown, "正文");
}

export function documentFromOrganizedMarkdown(markdown: string, title: string): TipTapDoc {
  const content: TipTapNode[] = [
    {
      type: "heading",
      attrs: { level: 1 },
      content: title ? [{ type: "text", text: title }] : [],
    },
  ];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    content.push({ type: "paragraph", content: [{ type: "text", text }] });
  };
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("```")) {
      flush();
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const table = takeMarkdownTable(lines, index);
    if (table) {
      flush();
      content.push(table.table);
      index = table.next - 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const level = heading[1].length === 1 ? 2 : heading[1].length === 2 ? 3 : 3;
      content.push({
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }
    buffer.push(trimmed.replace(/^[-*]\s+/, "• "));
  }
  flush();
  return { type: "doc", content };
}
