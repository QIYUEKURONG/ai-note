import { and, desc, eq, or } from "drizzle-orm";
import {
  asRelation,
  masteryFromScore,
  type AtlasDraft,
  type GapDraft,
  type MasteryLevel,
  type MergeDraft,
  type ReviewPrompt,
  type SpaceSnapshot,
} from "@/domain/knowledge";
import { documentFromOrganizedMarkdown } from "@/lib/document";
import { createId, now } from "@/lib/id";
import { getDb } from "./client";
import { createNote, listNotes, updateNote } from "./repos";
import {
  knowledgeEdges,
  knowledgeGaps,
  knowledgePoints,
  mastery,
  mergeDrafts,
  pointNotes,
  reminders,
  reviewItems,
  studyRecords,
} from "./schema";

function parseStringList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseConflicts(raw: string): Array<{ topic: string; detail: string }> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { topic?: unknown; detail?: unknown };
      if (typeof row.topic !== "string" || typeof row.detail !== "string") return [];
      return [{ topic: row.topic, detail: row.detail }];
    });
  } catch {
    return [];
  }
}

function matchNote(title: string, notes: Array<{ id: string; title: string }>) {
  const wanted = title.trim().toLowerCase();
  if (!wanted) return null;
  return (
    notes.find((note) => note.title.trim().toLowerCase() === wanted) ??
    notes.find((note) => {
      const current = note.title.trim().toLowerCase();
      return current.length >= 2 && (wanted.includes(current) || current.includes(wanted));
    }) ??
    null
  );
}

function pointIsLived(pointId: string): boolean {
  const db = getDb();
  const state = db.select().from(mastery).where(eq(mastery.pointId, pointId)).get();
  if (state && state.level !== "unknown") return true;
  const done = db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.pointId, pointId), eq(reviewItems.status, "done")))
    .get();
  if (done) return true;
  const edge = db
    .select()
    .from(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.status, "confirmed"),
        or(eq(knowledgeEdges.fromPointId, pointId), eq(knowledgeEdges.toPointId, pointId)),
      ),
    )
    .get();
  return Boolean(edge);
}

export function setMastery(pointId: string, level: MasteryLevel, score: number, source: string) {
  const db = getDb();
  const existing = db.select().from(mastery).where(eq(mastery.pointId, pointId)).get();
  const row = { level, score, source, updatedAt: now() };
  if (existing) {
    db.update(mastery).set(row).where(eq(mastery.pointId, pointId)).run();
    return;
  }
  db.insert(mastery).values({ pointId, ...row }).run();
}

export function recordStudy(input: {
  pointId?: string | null;
  noteId?: string | null;
  kind: string;
  prompt: string;
  answer?: string;
  score?: number | null;
}) {
  getDb()
    .insert(studyRecords)
    .values({
      id: createId(),
      pointId: input.pointId ?? null,
      noteId: input.noteId ?? null,
      kind: input.kind,
      prompt: input.prompt.slice(0, 400),
      answer: (input.answer ?? "").slice(0, 2000),
      score: input.score ?? null,
      createdAt: now(),
    })
    .run();
}

export function getSpace(): SpaceSnapshot {
  const db = getDb();
  const library = listNotes();
  const notes = library.map((note) => ({
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
    excerpt: note.contentText.replace(/\s+/g, " ").trim().slice(0, 80),
  }));
  const titleOf = new Map(notes.map((note) => [note.id, note.title]));
  const pointRows = db.select().from(knowledgePoints).all();
  const links = db.select().from(pointNotes).all();
  const masteryRows = db.select().from(mastery).all();
  const edgeRows = db.select().from(knowledgeEdges).all();
  const gapRows = db.select().from(knowledgeGaps).orderBy(desc(knowledgeGaps.createdAt)).all();
  const reviewRows = db.select().from(reviewItems).orderBy(desc(reviewItems.createdAt)).all();
  const reminderRows = db.select().from(reminders).orderBy(reminders.remindAt).all();
  const draftRows = db.select().from(mergeDrafts).orderBy(desc(mergeDrafts.createdAt)).all();
  const studyRows = db.select().from(studyRecords).orderBy(desc(studyRecords.createdAt)).limit(12).all();
  const masteryByPoint = new Map(masteryRows.map((row) => [row.pointId, row]));
  const notesByPoint = new Map<string, string[]>();
  for (const link of links) {
    const list = notesByPoint.get(link.pointId) ?? [];
    list.push(link.noteId);
    notesByPoint.set(link.pointId, list);
  }
  const labelOf = new Map(pointRows.map((point) => [point.id, point.label]));
  const pending = reviewRows.filter((row) => row.status === "pending");
  const done = reviewRows.filter((row) => row.status === "done").slice(0, 4);
  return {
    notes,
    points: pointRows.map((row) => {
      const state = masteryByPoint.get(row.id);
      const level = state?.level;
      const masteryLevel: MasteryLevel =
        level === "learning" || level === "shaky" || level === "mastered" || level === "unknown"
          ? level
          : "unknown";
      return {
        id: row.id,
        label: row.label,
        summary: row.summary,
        status: row.status === "confirmed" ? "confirmed" : "suggested",
        noteIds: notesByPoint.get(row.id) ?? [],
        mastery: masteryLevel,
        score: state?.score ?? 0,
      };
    }),
    edges: edgeRows.map((row) => ({
      id: row.id,
      fromId: row.fromPointId,
      toId: row.toPointId,
      relation: asRelation(row.relation),
      reason: row.reason,
      status: row.status === "confirmed" ? "confirmed" : "suggested",
    })),
    gaps: gapRows
      .filter((row) => row.status === "suggested" || row.status === "created")
      .map((row) => ({
        id: row.id,
        label: row.label,
        reason: row.reason,
        status: row.status === "created" ? "created" : "suggested",
        noteId: row.noteId,
      })),
    reviews: [...pending, ...done].map((row) => ({
      id: row.id,
      pointId: row.pointId,
      pointLabel: labelOf.get(row.pointId) ?? "知识点",
      noteId: row.noteId,
      prompt: row.prompt,
      dueAt: row.dueAt,
      status: row.status === "done" ? "done" : "pending",
      score: row.score,
      comment: row.comment,
    })),
    reminders: reminderRows
      .filter((row) => row.status === "pending")
      .map((row) => ({
        id: row.id,
        noteId: row.noteId,
        title: titleOf.get(row.noteId) ?? row.label,
        label: row.label,
        remindAt: row.remindAt,
      })),
    drafts: draftRows
      .filter((row) => row.status === "draft")
      .slice(0, 3)
      .map((row) => {
        const sourceIds = parseStringList(row.sourceIdsJson);
        return {
          id: row.id,
          title: row.title,
          body: row.body,
          sourceIds,
          sourceTitles: sourceIds.map((id) => titleOf.get(id) ?? "笔记"),
          duplicates: parseStringList(row.duplicatesJson),
          conflicts: parseConflicts(row.conflictsJson),
        };
      }),
    recentStudy: studyRows.map((row) => ({
      noteId: row.noteId,
      pointId: row.pointId,
      kind: row.kind,
      createdAt: row.createdAt,
      score: row.score,
    })),
  };
}

export function applyAtlas(draft: AtlasDraft, notes: Array<{ id: string; title: string }>) {
  const db = getDb();
  const existing = db.select().from(knowledgePoints).all();
  for (const point of existing) {
    if (point.status !== "suggested" || pointIsLived(point.id)) continue;
    db.delete(knowledgePoints).where(eq(knowledgePoints.id, point.id)).run();
  }
  db.delete(knowledgeEdges).where(eq(knowledgeEdges.status, "suggested")).run();
  const byLabel = new Map<string, { id: string; status: string }>();
  for (const point of db.select().from(knowledgePoints).all()) {
    byLabel.set(point.label.toLowerCase(), { id: point.id, status: point.status });
  }
  for (const point of draft.points) {
    let found = byLabel.get(point.label.toLowerCase());
    if (!found) {
      const id = createId();
      const stamp = now();
      db.insert(knowledgePoints)
        .values({
          id,
          label: point.label,
          summary: point.summary,
          status: "suggested",
          createdAt: stamp,
          updatedAt: stamp,
        })
        .run();
      found = { id, status: "suggested" };
      byLabel.set(point.label.toLowerCase(), found);
    } else if (found.status !== "confirmed" && point.summary) {
      db.update(knowledgePoints)
        .set({ summary: point.summary, updatedAt: now() })
        .where(eq(knowledgePoints.id, found.id))
        .run();
    }
    for (const title of point.noteTitles) {
      const note = matchNote(title, notes);
      if (!note) continue;
      db.insert(pointNotes)
        .values({ pointId: found.id, noteId: note.id })
        .onConflictDoNothing()
        .run();
    }
  }
  for (const edge of draft.edges) {
    const from = byLabel.get(edge.from.toLowerCase());
    const to = byLabel.get(edge.to.toLowerCase());
    if (!from || !to) continue;
    const duplicate = db
      .select()
      .from(knowledgeEdges)
      .where(
        and(
          eq(knowledgeEdges.fromPointId, from.id),
          eq(knowledgeEdges.toPointId, to.id),
          eq(knowledgeEdges.relation, edge.relation),
        ),
      )
      .get();
    if (duplicate) continue;
    db.insert(knowledgeEdges)
      .values({
        id: createId(),
        fromPointId: from.id,
        toPointId: to.id,
        relation: edge.relation,
        reason: edge.reason,
        status: "suggested",
        createdAt: now(),
      })
      .run();
  }
}

export function confirmPoint(id: string): boolean {
  const db = getDb();
  const row = db.select().from(knowledgePoints).where(eq(knowledgePoints.id, id)).get();
  if (!row) return false;
  db.update(knowledgePoints)
    .set({ status: "confirmed", updatedAt: now() })
    .where(eq(knowledgePoints.id, id))
    .run();
  return true;
}

export function confirmEdge(id: string): boolean {
  const db = getDb();
  const row = db.select().from(knowledgeEdges).where(eq(knowledgeEdges.id, id)).get();
  if (!row) return false;
  db.update(knowledgeEdges).set({ status: "confirmed" }).where(eq(knowledgeEdges.id, id)).run();
  return true;
}

export function applyGaps(gaps: GapDraft[]) {
  const db = getDb();
  db.delete(knowledgeGaps).where(eq(knowledgeGaps.status, "suggested")).run();
  const kept = db.select().from(knowledgeGaps).all();
  const taken = new Set(kept.map((gap) => gap.label.toLowerCase()));
  for (const gap of gaps) {
    if (taken.has(gap.label.toLowerCase())) continue;
    db.insert(knowledgeGaps)
      .values({
        id: createId(),
        label: gap.label,
        reason: gap.reason,
        status: "suggested",
        noteId: null,
        createdAt: now(),
      })
      .run();
  }
}

export function acceptGap(id: string): { noteId: string } | null {
  const db = getDb();
  const gap = db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, id)).get();
  if (!gap || gap.status !== "suggested") return null;
  const note = createNote(gap.label);
  const body = `## 为什么要补\n\n${gap.reason}\n\n## 先写在这里\n\n把已经知道的，和还不确定的，分开写。`;
  updateNote(note.id, {
    contentJson: JSON.stringify(documentFromOrganizedMarkdown(body, note.title)),
  });
  db.update(knowledgeGaps)
    .set({ status: "created", noteId: note.id })
    .where(eq(knowledgeGaps.id, id))
    .run();
  return { noteId: note.id };
}

export function dismissGap(id: string): boolean {
  const db = getDb();
  const gap = db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, id)).get();
  if (!gap || gap.status !== "suggested") return false;
  db.update(knowledgeGaps).set({ status: "dismissed" }).where(eq(knowledgeGaps.id, id)).run();
  return true;
}

export function applyReviewPlan(items: ReviewPrompt[]) {
  const db = getDb();
  const points = db.select().from(knowledgePoints).all();
  const links = db.select().from(pointNotes).all();
  for (const item of items) {
    const point = points.find((row) => row.label.toLowerCase() === item.point.toLowerCase());
    if (!point) continue;
    const pending = db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.pointId, point.id), eq(reviewItems.status, "pending")))
      .get();
    if (pending) continue;
    db.insert(reviewItems)
      .values({
        id: createId(),
        pointId: point.id,
        noteId: links.find((link) => link.pointId === point.id)?.noteId ?? null,
        prompt: item.prompt,
        dueAt: now(),
        status: "pending",
        score: null,
        comment: "",
        createdAt: now(),
      })
      .run();
  }
}

export function getReviewItem(id: string) {
  const db = getDb();
  const item = db.select().from(reviewItems).where(eq(reviewItems.id, id)).get();
  if (!item) return null;
  const point = db.select().from(knowledgePoints).where(eq(knowledgePoints.id, item.pointId)).get() ?? null;
  return { item, point };
}

export function completeReview(id: string, score: number, comment: string, answer: string): boolean {
  const packed = getReviewItem(id);
  if (!packed || packed.item.status !== "pending") return false;
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  getDb()
    .update(reviewItems)
    .set({ status: "done", score: bounded, comment: comment.slice(0, 400) })
    .where(eq(reviewItems.id, id))
    .run();
  setMastery(packed.item.pointId, masteryFromScore(bounded), bounded, "recall");
  recordStudy({
    pointId: packed.item.pointId,
    noteId: packed.item.noteId,
    kind: "recall",
    prompt: packed.item.prompt,
    answer,
    score: bounded,
  });
  return true;
}

export function saveMergeDraft(sourceIds: string[], draft: MergeDraft): string {
  const id = createId();
  getDb()
    .insert(mergeDrafts)
    .values({
      id,
      sourceIdsJson: JSON.stringify(sourceIds),
      title: draft.title,
      body: draft.body,
      duplicatesJson: JSON.stringify(draft.duplicates),
      conflictsJson: JSON.stringify(draft.conflicts),
      status: "draft",
      noteId: null,
      createdAt: now(),
    })
    .run();
  return id;
}

export function acceptMergeDraft(id: string): { noteId: string } | null {
  const db = getDb();
  const draft = db.select().from(mergeDrafts).where(eq(mergeDrafts.id, id)).get();
  if (!draft || draft.status !== "draft") return null;
  const note = createNote(draft.title || "合并笔记");
  updateNote(note.id, {
    contentJson: JSON.stringify(documentFromOrganizedMarkdown(draft.body, note.title)),
  });
  db.update(mergeDrafts)
    .set({ status: "created", noteId: note.id })
    .where(eq(mergeDrafts.id, id))
    .run();
  return { noteId: note.id };
}

export function discardMergeDraft(id: string): boolean {
  const db = getDb();
  const draft = db.select().from(mergeDrafts).where(eq(mergeDrafts.id, id)).get();
  if (!draft || draft.status !== "draft") return false;
  db.update(mergeDrafts).set({ status: "discarded" }).where(eq(mergeDrafts.id, id)).run();
  return true;
}

export function createReminder(noteId: string, remindAt: number, label: string): string {
  const id = createId();
  getDb()
    .insert(reminders)
    .values({
      id,
      noteId,
      remindAt,
      label: label.slice(0, 80),
      status: "pending",
      createdAt: now(),
    })
    .run();
  return id;
}

export function touchReminder(id: string, op: "done" | "snooze"): boolean {
  const db = getDb();
  const row = db.select().from(reminders).where(eq(reminders.id, id)).get();
  if (!row || row.status !== "pending") return false;
  if (op === "done") {
    db.update(reminders).set({ status: "done" }).where(eq(reminders.id, id)).run();
    return true;
  }
  db.update(reminders)
    .set({ remindAt: now() + 60 * 60 * 1000 })
    .where(eq(reminders.id, id))
    .run();
  return true;
}

export function pointsForNote(noteId: string) {
  const db = getDb();
  const links = db.select().from(pointNotes).where(eq(pointNotes.noteId, noteId)).all();
  if (links.length === 0) return [];
  return db.select().from(knowledgePoints).all().filter((point) => links.some((link) => link.pointId === point.id));
}

export function applyCheckScore(noteId: string, score: number) {
  recordStudy({ noteId, kind: "check", prompt: "总结检测", score });
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  for (const point of pointsForNote(noteId)) {
    const current = getDb().select().from(mastery).where(eq(mastery.pointId, point.id)).get();
    const next =
      current && current.level !== "unknown" ? Math.round(current.score * 0.45 + bounded * 0.55) : bounded;
    setMastery(point.id, masteryFromScore(next), next, "check");
  }
}

export function applyInterviewSignal(
  noteId: string,
  report: { summary?: string; weakPoints?: string[]; mastery?: string },
) {
  recordStudy({
    noteId,
    kind: "interview",
    prompt: report.summary || "面试",
    answer: report.mastery || "",
  });
  const weaks = (report.weakPoints ?? []).map((item) => item.trim()).filter(Boolean);
  for (const point of pointsForNote(noteId)) {
    const hit = weaks.some((item) => item.includes(point.label) || point.label.includes(item));
    if (hit) setMastery(point.id, "shaky", 52, "interview");
  }
}
