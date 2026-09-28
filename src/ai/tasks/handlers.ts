import { isOrganizeKind } from "@/domain/organize-kinds";
import { isVisualType } from "@/domain/visual-types";
import {
  addInterviewTurn,
  getCheckSession,
  getImage,
  getInterviewSession,
  getNote,
  insertAIResult,
  insertCheckSession,
  insertGeneratedImage,
  insertInterviewSession,
  saveQuestionEvaluation,
  updateCheckSessionScores,
  updateGeneratedImageFile,
  updateInterviewSession,
} from "@/db/repos";
import { applyCheckScore, applyInterviewSignal } from "@/db/knowledge";
import { getAIProvider } from "../providers";
import { organizeNote } from "../services/organize";
import { decideVisualType } from "../services/visual-router";
import { buildImagePrompt, type KnowledgeCardSpec } from "../services/prompt-image";
import { evaluateAnswer, generateCheckQuestions } from "../services/check";
import { finishInterview, nextInterviewQuestion } from "../services/interview";
import { reviewNote } from "../services/review";
import { saveImageFile } from "@/lib/storage";
import { createId } from "@/lib/id";
import { answerRecall, buildAtlas, findGaps, mergeNotes, planReview } from "./knowledge-handlers";
import { registerTaskHandler, type TaskHandler } from "./runner";
import type { AITaskRow } from "@/db/schema";

function clipSelection(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 4000);
}

function payload(task: AITaskRow): Record<string, unknown> {
  try {
    return JSON.parse(task.inputJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const generateSummary: TaskHandler = async (task) => {
  const note = task.noteId ? getNote(task.noteId) : null;
  if (!note) throw new Error("笔记不存在");
  const kind = String(payload(task).kind ?? "");
  if (!isOrganizeKind(kind)) throw new Error("未知整理方式");
  const selection = clipSelection(payload(task).selection);
  const result = await organizeNote({
    chat: getAIProvider().chat,
    title: note.title,
    content: selection || note.contentText,
    highlights: selection
      ? note.highlights.map((item) => item.text).filter((text) => selection.includes(text))
      : note.highlights.map((item) => item.text),
    kind,
    onlySelection: Boolean(selection),
  });
  const row = insertAIResult({
    noteId: note.id,
    kind,
    body: result.body,
    speculationSpansJson: result.speculationSpansJson,
    sourceContentHash: note.contentHash,
  });
  return row.id;
};

const createImage: TaskHandler = async (task) => {
  const body = payload(task);
  const note = task.noteId ? getNote(task.noteId) : null;
  if (!note) throw new Error("笔记不存在");
  const preferred = typeof body.visualType === "string" && isVisualType(body.visualType)
    ? body.visualType
    : null;
  const selection = clipSelection(body.selection);
  const source = selection || note.contentText;
  const visualType = await decideVisualType({
    chat: getAIProvider().chat,
    title: note.title,
    content: source,
    preferred,
  });
  const card = (body.card as KnowledgeCardSpec | undefined) ?? null;
  const built = await buildImagePrompt({
    chat: getAIProvider().chat,
    title: note.title,
    content: source,
    style: String(body.style ?? "warm_daily"),
    density: String(body.density ?? "medium"),
    usage: String(body.usage ?? "explain"),
    visualType,
    card: visualType === "knowledge-card" ? card : null,
  });
  const generated = await getAIProvider().image.generate({
    prompt: built.prompt,
    aspectRatio: String(body.aspectRatio ?? "4:3"),
  });
  const filePath = saveImageFile(generated.bytes, generated.mimeType);
  const existingId = typeof body.replaceImageId === "string" ? body.replaceImageId : null;
  if (existingId && getImage(existingId)) {
    updateGeneratedImageFile(existingId, {
      filePath,
      prompt: built.prompt,
      generationModel: generated.model,
      width: generated.width,
      height: generated.height,
    });
    return existingId;
  }
  const saved = insertGeneratedImage({
    noteId: note.id,
    prompt: built.prompt,
    style: String(body.style ?? "warm_daily"),
    visualType,
    generationModel: generated.model,
    aspectRatio: String(body.aspectRatio ?? "4:3"),
    filePath,
    width: generated.width ?? 1024,
    height: generated.height ?? 1024,
    metadataJson: JSON.stringify({
      density: body.density,
      usage: body.usage,
      card,
      cardCells: built.cardCells ?? [],
    }),
  });
  return saved.image.id;
};

const generateQuestions: TaskHandler = async (task) => {
  const note = task.noteId ? getNote(task.noteId) : null;
  if (!note) throw new Error("笔记不存在");
  const questions = await generateCheckQuestions({
    chat: getAIProvider().chat,
    title: note.title,
    content: note.contentText,
  });
  if (questions.length === 0) throw new Error("没有生成出检测题");
  const saved = insertCheckSession({
    noteId: note.id,
    questions: questions.map((item) => ({
      type: item.type,
      difficulty: item.difficulty,
      prompt: item.prompt,
      options: item.options,
      expectedPoints: item.expectedPoints,
    })),
  });
  return saved.session.id;
};

const evaluate: TaskHandler = async (task) => {
  const body = payload(task);
  const sessionId = String(body.sessionId ?? "");
  const questionId = String(body.questionId ?? "");
  const answer = String(body.answer ?? "");
  const packed = getCheckSession(sessionId);
  if (!packed) throw new Error("检测场次不存在");
  const question = packed.questions.find((item) => item.id === questionId);
  if (!question) throw new Error("题目不存在");
  const evaluation = await evaluateAnswer({
    chat: getAIProvider().chat,
    question: {
      type: question.type as never,
      difficulty: question.difficulty as never,
      prompt: question.prompt,
      options: question.optionsJson ? JSON.parse(question.optionsJson) : undefined,
      expectedPoints: JSON.parse(question.expectedPointsJson) as string[],
      knowledgePoint: "",
    },
    answer,
  });
  saveQuestionEvaluation({
    questionId,
    userAnswer: answer,
    evaluationJson: JSON.stringify(evaluation),
    score: evaluation.score,
  });
  const refreshed = getCheckSession(sessionId);
  if (refreshed) {
    const scored = refreshed.questions.filter((item) => item.score != null);
    if (scored.length === refreshed.questions.length) {
      const overall =
        scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length;
      const points: Record<string, number> = {};
      for (const item of scored) {
        const expected = JSON.parse(item.expectedPointsJson) as string[];
        points[expected[0] ?? item.prompt.slice(0, 16)] = item.score ?? 0;
      }
      updateCheckSessionScores(sessionId, Math.round(overall), JSON.stringify(points));
      try {
        applyCheckScore(refreshed.session.noteId, Math.round(overall));
      } catch {
        // 掌握度写回失败时，检测结果本身仍然保留
      }
    }
  }
  return questionId;
};

const reviewAnnotations: TaskHandler = async (task) => {
  const note = task.noteId ? getNote(task.noteId) : null;
  if (!note) throw new Error("笔记不存在");
  const drafts = await reviewNote({
    chat: getAIProvider().chat,
    title: note.title,
    content: note.contentText,
  });
  const marks = drafts.map((draft) => ({
    ...draft,
    id: createId(),
    status: "open" as const,
  }));
  const row = insertAIResult({
    noteId: note.id,
    kind: "annotation",
    body: JSON.stringify({ marks }),
    speculationSpansJson: "[]",
    sourceContentHash: note.contentHash,
  });
  return row.id;
};

const generateInterview: TaskHandler = async (task) => {
  const body = payload(task);
  const note = task.noteId ? getNote(task.noteId) : null;
  if (!note) throw new Error("笔记不存在");
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    sessionId = insertInterviewSession(note.id).id;
  }
  const packed = getInterviewSession(sessionId);
  if (!packed) throw new Error("面试场次不存在");
  if (typeof body.answer === "string" && body.answer.trim()) {
    addInterviewTurn({
      sessionId,
      role: "candidate",
      level: packed.session.currentLevel,
      content: body.answer.trim(),
    });
  }
  const history = getInterviewSession(sessionId)?.turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  })) ?? [];
  const shouldFinish = Boolean(body.finish) || packed.session.currentLevel >= 5 && Boolean(body.answer);
  if (shouldFinish && history.some((item) => item.role === "candidate")) {
    const report = await finishInterview({
      chat: getAIProvider().chat,
      title: note.title,
      history,
    });
    updateInterviewSession(sessionId, {
      status: "completed",
      resultJson: JSON.stringify(report),
      completedAt: Date.now(),
    });
    try {
      applyInterviewSignal(note.id, report);
    } catch {
      // 掌握度写回失败时，面试结果本身仍然保留
    }
    return sessionId;
  }
  const next = await nextInterviewQuestion({
    chat: getAIProvider().chat,
    title: note.title,
    content: note.contentText,
    level: packed.session.currentLevel,
    history,
  });
  addInterviewTurn({
    sessionId,
    role: "interviewer",
    level: packed.session.currentLevel,
    content: next.question,
  });
  if (next.shouldEnd) {
    const report = await finishInterview({
      chat: getAIProvider().chat,
      title: note.title,
      history: [...history, { role: "interviewer", content: next.question }],
    });
    updateInterviewSession(sessionId, {
      status: "completed",
      resultJson: JSON.stringify(report),
      currentLevel: next.nextLevel,
      completedAt: Date.now(),
    });
    try {
      applyInterviewSignal(note.id, report);
    } catch {
      // 掌握度写回失败时，面试结果本身仍然保留
    }
  } else {
    updateInterviewSession(sessionId, { currentLevel: next.nextLevel });
  }
  return sessionId;
};

export function registerAllTaskHandlers() {
  registerTaskHandler("generate_summary", generateSummary);
  registerTaskHandler("create_image", createImage);
  registerTaskHandler("generate_questions", generateQuestions);
  registerTaskHandler("evaluate_answer", evaluate);
  registerTaskHandler("generate_interview", generateInterview);
  registerTaskHandler("review_note", reviewAnnotations);
  registerTaskHandler("build_atlas", buildAtlas);
  registerTaskHandler("find_gaps", findGaps);
  registerTaskHandler("merge_notes", mergeNotes);
  registerTaskHandler("plan_review", planReview);
  registerTaskHandler("answer_recall", answerRecall);
}

let registered = false;
export function ensureTaskHandlers() {
  if (registered) return;
  registerAllTaskHandlers();
  registered = true;
}

export function resetHandlersForTests() {
  registered = false;
}
