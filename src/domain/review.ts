export const REVIEW_KINDS = ["error", "incomplete", "deepen"] as const;

export type ReviewKind = (typeof REVIEW_KINDS)[number];
export type ReviewStatus = "open" | "ignored" | "applied";

export type ReviewMark = {
  id: string;
  quote: string;
  kind: ReviewKind;
  explanation: string;
  suggestion: string;
  status: ReviewStatus;
};

export type ReviewDraft = Omit<ReviewMark, "id" | "status">;

const KIND_SET = new Set<string>(REVIEW_KINDS);

export function reviewKindLabel(kind: string): string {
  if (kind === "error") return "错误";
  if (kind === "incomplete") return "不完整";
  if (kind === "deepen") return "待深入";
  return kind;
}

export function normalizeReviewDrafts(input: unknown): ReviewDraft[] {
  const list = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { marks?: unknown }).marks)
      ? (input as { marks: unknown[] }).marks
      : [];
  const drafts: ReviewDraft[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quote = String(row.quote ?? "").trim();
    const kind = String(row.kind ?? "");
    const explanation = String(row.explanation ?? "").trim();
    const suggestion = String(row.suggestion ?? "").trim();
    if (quote.length < 4 || quote.length > 180) continue;
    if (!KIND_SET.has(kind)) continue;
    if (!explanation) continue;
    if (seen.has(quote)) continue;
    seen.add(quote);
    drafts.push({ quote, kind: kind as ReviewKind, explanation, suggestion });
    if (drafts.length >= 8) break;
  }
  return drafts;
}

export function parseStoredReview(body: string): ReviewMark[] {
  try {
    const parsed = JSON.parse(body) as { marks?: ReviewMark[] };
    if (!Array.isArray(parsed.marks)) return [];
    return parsed.marks.filter(
      (mark) =>
        Boolean(mark?.id) &&
        Boolean(mark.quote) &&
        KIND_SET.has(mark.kind) &&
        (mark.status === "open" || mark.status === "ignored" || mark.status === "applied"),
    );
  } catch {
    return [];
  }
}
