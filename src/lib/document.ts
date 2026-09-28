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

export function parseDocument(raw: string): TipTapDoc {
  try {
    const parsed = JSON.parse(raw) as TipTapDoc;
    if (parsed?.type === "doc") return parsed;
  } catch {
    // fall through
  }
  return emptyDocument();
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
  for (const line of lines) {
    if (line.startsWith("```")) {
      flush();
      continue;
    }
    if (line.trim() === "") {
      flush();
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
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      continue;
    }
    if (!trimmed) {
      flush();
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
