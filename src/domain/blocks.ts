export const CALLOUTS = [
  { id: "note", label: "便签", preview: "Note" },
  { id: "idea", label: "灵感", preview: "Idea" },
  { id: "tip", label: "窍门", preview: "Tip" },
  { id: "caution", label: "留意", preview: "Watch" },
  { id: "example", label: "例子", preview: "Example" },
  { id: "aside", label: "旁白", preview: "Aside" },
] as const;

export type CalloutKind = (typeof CALLOUTS)[number]["id"];

export const MARKERS = [
  { id: "heart", label: "桃心", glyph: "♥" },
  { id: "tree", label: "小树", glyph: "🌲" },
  { id: "star", label: "星星", glyph: "★" },
  { id: "flower", label: "小花", glyph: "✿" },
  { id: "clover", label: "四叶", glyph: "🍀" },
  { id: "spark", label: "火花", glyph: "✦" },
] as const;

export type MarkerId = (typeof MARKERS)[number]["id"];

export type BlockRef = {
  type: string;
  level?: number;
};

export function calloutKind(value: string): CalloutKind {
  const token = value.trim();
  const found = CALLOUTS.find((item) => item.id === token.toLowerCase() || item.label === token);
  return found?.id ?? "note";
}

export function calloutLabel(kind: string): string {
  return CALLOUTS.find((item) => item.id === kind)?.label ?? "便签";
}

export function displayedCalloutLabel(kind: string, label?: unknown): string {
  const custom = typeof label === "string" ? label.trim() : "";
  return custom || calloutLabel(kind);
}

/** `:::idea 二分` keeps a custom title. A bare kind name stays the default label. */
export function calloutHeading(raw: string): { kind: CalloutKind; label: string | null } {
  const trimmed = raw.trim();
  const space = trimmed.search(/\s/);
  const token = space < 0 ? trimmed : trimmed.slice(0, space);
  const custom = space < 0 ? "" : trimmed.slice(space).trim();
  const kind = calloutKind(token);
  if (!custom || custom === calloutLabel(kind)) return { kind, label: null };
  return { kind, label: custom };
}

export function markerGlyph(id: string | null | undefined): string | null {
  if (!id) return null;
  return MARKERS.find((item) => item.id === id)?.glyph ?? null;
}

export function markerByGlyphPrefix(text: string): { id: MarkerId; rest: string } | null {
  for (const marker of MARKERS) {
    if (text === marker.glyph) return { id: marker.id, rest: "" };
    if (text.startsWith(`${marker.glyph} `) || text.startsWith(`${marker.glyph}\t`)) {
      return { id: marker.id, rest: text.slice(marker.glyph.length).trim() };
    }
  }
  return null;
}

/** Lists that sit under this heading, stopping at the next heading of the same rank or higher. */
export function sectionListIndexes(blocks: BlockRef[], headingIndex: number): number[] {
  const heading = blocks[headingIndex];
  if (!heading || heading.type !== "heading") return [];
  const level = heading.level ?? 1;
  const found: number[] = [];
  let index = headingIndex + 1;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === "heading") {
      const next = block.level ?? 1;
      if (next <= level) break;
      index += 1;
      while (index < blocks.length) {
        const inner = blocks[index];
        if (inner.type === "heading" && (inner.level ?? 1) <= next) break;
        index += 1;
      }
      continue;
    }
    if (block.type === "bulletList") found.push(index);
    index += 1;
  }
  return found;
}
