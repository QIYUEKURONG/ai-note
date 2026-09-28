import type { TipTapDoc, TipTapNode } from "@/lib/document";

export function replaceQuote(doc: TipTapDoc, quote: string, suggestion: string): TipTapDoc | null {
  const needle = quote.trim();
  const nextText = suggestion.trim();
  if (!needle || !nextText) return null;
  const clone = structuredClone(doc) as TipTapDoc;
  const pieces: TipTapNode[] = [];
  collectText(clone, pieces);
  const joined = pieces.map((node) => node.text ?? "").join("");
  const index = joined.indexOf(needle);
  if (index < 0) return null;
  const end = index + needle.length;
  let cursor = 0;
  let inserted = false;
  for (const node of pieces) {
    const text = node.text ?? "";
    const pieceStart = cursor;
    const pieceEnd = cursor + text.length;
    const overlapStart = Math.max(index, pieceStart);
    const overlapEnd = Math.min(end, pieceEnd);
    if (overlapStart < overlapEnd) {
      const localStart = overlapStart - pieceStart;
      const localEnd = overlapEnd - pieceStart;
      const before = text.slice(0, localStart);
      const after = text.slice(localEnd);
      node.text = inserted ? before + after : before + nextText + after;
      inserted = true;
    }
    cursor = pieceEnd;
  }
  pruneEmptyText(clone);
  return inserted ? clone : null;
}

function collectText(node: TipTapNode, pieces: TipTapNode[]) {
  if (typeof node.text === "string") pieces.push(node);
  for (const child of node.content ?? []) collectText(child, pieces);
}

function pruneEmptyText(node: TipTapNode) {
  if (!node.content) return;
  node.content = node.content.filter((child) => {
    pruneEmptyText(child);
    if (child.type === "text") return Boolean(child.text);
    return true;
  });
}
