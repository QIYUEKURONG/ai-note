import { listNotes } from "@/db/repos";
import {
  applyAtlas,
  applyGaps,
  applyReviewPlan,
  completeReview,
  getReviewItem,
  getSpace,
  saveMergeDraft,
} from "@/db/knowledge";
import { masteryLabel } from "@/domain/knowledge";
import { getAIProvider } from "../providers";
import { evaluateAnswer } from "../services/check";
import { proposeAtlas, proposeGaps, proposeMerge, proposeReviewPlan } from "../services/knowledge";
import type { TaskHandler } from "./runner";

function readPayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

export const buildAtlas: TaskHandler = async () => {
  const notes = listNotes();
  if (notes.length === 0) throw new Error("还没有笔记");
  const draft = await proposeAtlas({
    chat: getAIProvider().chat,
    notes: notes.map((note) => ({ title: note.title, content: note.contentText })),
  });
  applyAtlas(
    draft,
    notes.map((note) => ({ id: note.id, title: note.title })),
  );
  return "atlas";
};

export const findGaps: TaskHandler = async () => {
  const space = getSpace();
  if (space.points.length === 0) throw new Error("先从笔记里找出知识点");
  const brief = space.points
    .map((point) => {
      const titles = point.noteIds
        .map((id) => space.notes.find((note) => note.id === id)?.title)
        .filter(Boolean)
        .join("、");
      return `${point.label}（${masteryLabel(point.mastery)}）${point.summary}${titles ? `。来自：${titles}` : ""}`;
    })
    .join("\n");
  applyGaps(await proposeGaps({ chat: getAIProvider().chat, brief }));
  return "gaps";
};

export const mergeNotes: TaskHandler = async (task) => {
  const body = readPayload(task.inputJson);
  const ids = Array.isArray(body.noteIds) ? body.noteIds.filter((id): id is string => typeof id === "string") : [];
  const notes = listNotes().filter((note) => ids.includes(note.id));
  if (notes.length < 2) throw new Error("至少需要两篇笔记");
  const draft = await proposeMerge({
    chat: getAIProvider().chat,
    notes: notes.map((note) => ({ title: note.title, content: note.contentText })),
  });
  if (!draft.body.trim()) throw new Error("没有生成可阅读的合并稿");
  return saveMergeDraft(
    notes.map((note) => note.id),
    draft,
  );
};

export const planReview: TaskHandler = async () => {
  const space = getSpace();
  if (space.points.length === 0) throw new Error("先从笔记里找出知识点");
  const brief = [
    ...space.points.map((point) => `${point.label}｜${masteryLabel(point.mastery)}｜${point.score}｜${point.summary}`),
    ...space.recentStudy.map((row) => {
      const label = space.points.find((point) => point.id === row.pointId)?.label ?? "";
      return `记录 ${row.kind} ${label} ${row.score ?? ""}`.trim();
    }),
  ].join("\n");
  applyReviewPlan(await proposeReviewPlan({ chat: getAIProvider().chat, brief }));
  return "review";
};

export const answerRecall: TaskHandler = async (task) => {
  const body = readPayload(task.inputJson);
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const packed = itemId ? getReviewItem(itemId) : null;
  if (!packed?.point) throw new Error("这道题已经不在了");
  if (!answer) throw new Error("先写下你的回答");
  const evaluation = await evaluateAnswer({
    chat: getAIProvider().chat,
    question: {
      type: "short-answer",
      difficulty: "understanding",
      prompt: packed.item.prompt,
      expectedPoints: [packed.point.summary || packed.point.label],
      knowledgePoint: packed.point.label,
    },
    answer,
  });
  completeReview(packed.item.id, evaluation.score, evaluation.comment, answer);
  return packed.item.id;
};
