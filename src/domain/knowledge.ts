export const RELATIONS = ["related", "depends", "contains", "prerequisite"] as const;
export type RelationKind = (typeof RELATIONS)[number];
export type MasteryLevel = "unknown" | "learning" | "shaky" | "mastered";

export type AtlasPoint = {
  label: string;
  summary: string;
  noteTitles: string[];
};

export type AtlasEdge = {
  from: string;
  to: string;
  relation: RelationKind;
  reason: string;
};

export type AtlasDraft = {
  points: AtlasPoint[];
  edges: AtlasEdge[];
};

export type GapDraft = {
  label: string;
  reason: string;
};

export type MergeConflict = {
  topic: string;
  detail: string;
};

export type MergeDraft = {
  title: string;
  body: string;
  duplicates: string[];
  conflicts: MergeConflict[];
};

export type ReviewPrompt = {
  point: string;
  prompt: string;
};

export type SpaceNote = {
  id: string;
  title: string;
  updatedAt: number;
  excerpt: string;
};

export type SpacePoint = {
  id: string;
  label: string;
  summary: string;
  status: "suggested" | "confirmed";
  noteIds: string[];
  mastery: MasteryLevel;
  score: number;
};

export type SpaceEdge = {
  id: string;
  fromId: string;
  toId: string;
  relation: RelationKind;
  reason: string;
  status: "suggested" | "confirmed";
};

export type SpaceGap = {
  id: string;
  label: string;
  reason: string;
  status: "suggested" | "created";
  noteId: string | null;
};

export type SpaceReview = {
  id: string;
  pointId: string;
  pointLabel: string;
  noteId: string | null;
  prompt: string;
  dueAt: number;
  status: "pending" | "done";
  score: number | null;
  comment: string;
};

export type SpaceReminder = {
  id: string;
  noteId: string;
  title: string;
  label: string;
  remindAt: number;
};

export type SpaceDraft = {
  id: string;
  title: string;
  body: string;
  sourceIds: string[];
  sourceTitles: string[];
  duplicates: string[];
  conflicts: MergeConflict[];
};

export type SpaceStudy = {
  noteId: string | null;
  pointId: string | null;
  kind: string;
  createdAt: number;
  score: number | null;
};

export type SpaceSnapshot = {
  notes: SpaceNote[];
  points: SpacePoint[];
  edges: SpaceEdge[];
  gaps: SpaceGap[];
  reviews: SpaceReview[];
  reminders: SpaceReminder[];
  drafts: SpaceDraft[];
  recentStudy: SpaceStudy[];
};

export type MapNode = {
  id: string;
  kind: "note" | "point";
  refId: string;
  label: string;
  x: number;
  y: number;
  status?: string;
  mastery?: string;
};

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asRelation(value: unknown): RelationKind {
  return RELATIONS.includes(value as RelationKind) ? (value as RelationKind) : "related";
}

export function relationLabel(relation: string): string {
  if (relation === "depends") return "依赖";
  if (relation === "contains") return "包含";
  if (relation === "prerequisite") return "前置";
  return "相关";
}

export function masteryLabel(level: string): string {
  if (level === "mastered") return "已掌握";
  if (level === "shaky") return "还不太稳";
  if (level === "learning") return "学习中";
  return "还没练过";
}

export function masteryFromScore(score: number): MasteryLevel {
  if (score >= 85) return "mastered";
  if (score >= 60) return "shaky";
  return "learning";
}

export function normalizeAtlas(input: unknown): AtlasDraft {
  const root = asRecord(input);
  const points: AtlasPoint[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(root?.points) ? root.points : []) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clean(row.label, 40);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const noteTitles = (Array.isArray(row.noteTitles) ? row.noteTitles : [])
      .map((title) => clean(title, 80))
      .filter(Boolean)
      .slice(0, 8);
    points.push({ label, summary: clean(row.summary, 180), noteTitles });
    if (points.length >= 24) break;
  }
  const known = new Set(points.map((point) => point.label.toLowerCase()));
  const edges: AtlasEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const item of Array.isArray(root?.edges) ? root.edges : []) {
    const row = asRecord(item);
    if (!row) continue;
    const from = clean(row.from, 40);
    const to = clean(row.to, 40);
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) continue;
    if (!known.has(from.toLowerCase()) || !known.has(to.toLowerCase())) continue;
    const relation = asRelation(row.relation);
    const key = `${from.toLowerCase()}|${to.toLowerCase()}|${relation}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push({ from, to, relation, reason: clean(row.reason, 160) });
    if (edges.length >= 40) break;
  }
  return { points, edges };
}

export function normalizeGaps(input: unknown): GapDraft[] {
  const root = asRecord(input);
  const gaps: GapDraft[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(root?.gaps) ? root.gaps : []) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clean(row.label, 40);
    const reason = clean(row.reason, 220);
    if (!label || !reason || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    gaps.push({ label, reason });
    if (gaps.length >= 5) break;
  }
  return gaps;
}

export function normalizeMerge(input: unknown): MergeDraft {
  const root = asRecord(input);
  const duplicates = (Array.isArray(root?.duplicates) ? root.duplicates : [])
    .map((item) => clean(item, 80))
    .filter(Boolean)
    .slice(0, 8);
  const conflicts: MergeConflict[] = [];
  for (const item of Array.isArray(root?.conflicts) ? root.conflicts : []) {
    const row = asRecord(item);
    if (!row) continue;
    const topic = clean(row.topic, 40);
    const detail = clean(row.detail, 180);
    if (!topic || !detail) continue;
    conflicts.push({ topic, detail });
    if (conflicts.length >= 6) break;
  }
  return {
    title: clean(root?.title, 60) || "合并笔记",
    body: String(root?.body ?? "").trim().slice(0, 12000),
    duplicates,
    conflicts,
  };
}

export function normalizeReviewPlan(input: unknown): ReviewPrompt[] {
  const root = asRecord(input);
  const items: ReviewPrompt[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(root?.items) ? root.items : []) {
    const row = asRecord(item);
    if (!row) continue;
    const point = clean(row.point, 40);
    const prompt = clean(row.prompt, 180);
    if (!point || !prompt || seen.has(point.toLowerCase())) continue;
    seen.add(point.toLowerCase());
    items.push({ point, prompt });
    if (items.length >= 5) break;
  }
  return items;
}

function pushApart(x: number, y: number, placed: Array<{ x: number; y: number }>, gap: number) {
  let nextX = x;
  let nextY = y;
  for (let pass = 0; pass < 10; pass += 1) {
    for (const other of placed) {
      const dx = nextX - other.x;
      const dy = nextY - other.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      if (dist >= gap) continue;
      const push = (gap - dist) / dist;
      nextX += dx * push;
      nextY += dy * push;
    }
  }
  return { x: nextX, y: nextY };
}

export function layoutKnowledge(input: {
  notes: Array<{ id: string; title: string }>;
  points: Array<{ id: string; label: string; noteIds: string[]; status: string; mastery: string }>;
}): MapNode[] {
  const notes = input.notes.slice(0, 16);
  const points = input.points.slice(0, 36);
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(notes.length, 1))));
  const gapX = 240;
  const gapY = 210;
  const notePos = new Map<string, { x: number; y: number }>();
  const placed: Array<{ x: number; y: number }> = [];
  const nodes: MapNode[] = [];
  notes.forEach((note, index) => {
    const spot = { x: 140 + (index % cols) * gapX, y: 120 + Math.floor(index / cols) * gapY };
    notePos.set(note.id, spot);
    placed.push(spot);
    nodes.push({
      id: `note:${note.id}`,
      kind: "note",
      refId: note.id,
      label: note.title || "未命名笔记",
      x: spot.x,
      y: spot.y,
    });
  });
  const rows = Math.ceil(notes.length / cols) || 1;
  points.forEach((point, index) => {
    const anchors = point.noteIds
      .map((id) => notePos.get(id))
      .filter((item): item is { x: number; y: number } => Boolean(item));
    const angle = ((index % 8) / 8) * Math.PI * 2;
    let x = 140 + ((cols - 1) * gapX) / 2 + Math.cos(angle) * 96;
    let y = 120 + rows * gapY + Math.sin(angle) * 72;
    if (anchors.length > 0) {
      x = anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length + Math.cos(angle) * 86;
      y = anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length + Math.sin(angle) * 74;
    }
    const spot = pushApart(x, y, placed, 78);
    placed.push(spot);
    nodes.push({
      id: `point:${point.id}`,
      kind: "point",
      refId: point.id,
      label: point.label,
      x: spot.x,
      y: spot.y,
      status: point.status,
      mastery: point.mastery,
    });
  });
  return nodes;
}
