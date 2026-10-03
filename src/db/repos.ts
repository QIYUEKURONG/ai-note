import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "./client";
import {
  aiResults,
  aiTasks,
  appSettings,
  checkQuestions,
  checkSessions,
  generatedImages,
  highlights,
  imagePins,
  interviewSessions,
  interviewTurns,
  noteSettings,
  notes,
  type AIResultRow,
  type AITaskRow,
  type CheckQuestionRow,
  type CheckSessionRow,
  type GeneratedImageRow,
  type ImagePinRow,
  type InterviewSessionRow,
  type InterviewTurnRow,
  type NoteRow,
  type NoteSettingsRow,
} from "./schema";
import { createId, hashContent, now } from "@/lib/id";
import {
  documentToText,
  emptyDocument,
  extractHighlights,
  parseDocument,
  type TipTapDoc,
} from "@/lib/document";
import { themeFromPreset, type NoteTheme } from "@/domain/themes";
import { defaultPinForIndex, type ImagePinPosition } from "@/domain/pins";

export type NoteRecord = NoteRow & {
  settings: NoteSettingsRow;
  highlights: Array<{ id: string; text: string; color: string }>;
};

function persistHighlights(noteId: string, doc: TipTapDoc) {
  const db = getDb();
  db.delete(highlights).where(eq(highlights.noteId, noteId)).run();
  const extracted = extractHighlights(doc);
  const createdAt = now();
  for (const item of extracted) {
    db.insert(highlights)
      .values({
        id: createId(),
        noteId,
        text: item.text,
        color: item.color,
        createdAt,
      })
      .run();
  }
}

export function listNotes(): NoteRow[] {
  return getDb()
    .select()
    .from(notes)
    .where(isNull(notes.deletedAt))
    .orderBy(desc(notes.updatedAt))
    .all();
}

export function getNote(id: string): NoteRecord | null {
  const db = getDb();
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note || note.deletedAt) return null;
  const settings =
    db.select().from(noteSettings).where(eq(noteSettings.noteId, id)).get() ??
    insertDefaultSettings(id);
  const marks = db.select().from(highlights).where(eq(highlights.noteId, id)).all();
  return {
    ...note,
    settings,
    highlights: marks.map((item) => ({ id: item.id, text: item.text, color: item.color })),
  };
}

function insertDefaultSettings(noteId: string): NoteSettingsRow {
  const theme = themeFromPreset("paper");
  const row: NoteSettingsRow = {
    noteId,
    preset: theme.preset,
    background: theme.background,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    textColor: theme.textColor,
    accentColor: theme.accentColor,
    codeTheme: theme.codeTheme,
    lineHeight: theme.lineHeight,
    pageWidth: theme.pageWidth,
    customColorsJson: theme.customColorsJson,
  };
  getDb().insert(noteSettings).values(row).run();
  return row;
}

export function createNote(title = "未命名笔记"): NoteRecord {
  const id = createId();
  const createdAt = now();
  const doc = emptyDocument(title);
  const contentJson = JSON.stringify(doc);
  const contentText = documentToText(doc);
  getDb()
    .insert(notes)
    .values({
      id,
      title,
      contentJson,
      contentText,
      contentHash: hashContent(contentText),
      isFavorite: false,
      createdAt,
      updatedAt: createdAt,
    })
    .run();
  insertDefaultSettings(id);
  persistHighlights(id, doc);
  return getNote(id)!;
}

export function updateNote(
  id: string,
  patch: {
    title?: string;
    contentJson?: string;
    isFavorite?: boolean;
  },
): NoteRecord | null {
  const existing = getNote(id);
  if (!existing) return null;
  const nextTitle = patch.title ?? existing.title;
  const nextJson = patch.contentJson ?? existing.contentJson;
  const doc = parseDocument(nextJson);
  const contentText = documentToText(doc);
  getDb()
    .update(notes)
    .set({
      title: nextTitle,
      contentJson: nextJson,
      contentText,
      contentHash: hashContent(contentText),
      isFavorite: patch.isFavorite ?? existing.isFavorite,
      updatedAt: now(),
    })
    .where(eq(notes.id, id))
    .run();
  persistHighlights(id, doc);
  return getNote(id);
}

export function softDeleteNote(id: string): boolean {
  const existing = getNote(id);
  if (!existing) return false;
  getDb()
    .update(notes)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(eq(notes.id, id))
    .run();
  return true;
}

export function updateNoteSettings(noteId: string, theme: NoteTheme): NoteSettingsRow {
  const row: NoteSettingsRow = {
    noteId,
    preset: theme.preset,
    background: theme.background,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    textColor: theme.textColor,
    accentColor: theme.accentColor,
    codeTheme: theme.codeTheme,
    lineHeight: theme.lineHeight,
    pageWidth: theme.pageWidth,
    customColorsJson: theme.customColorsJson,
  };
  getDb()
    .insert(noteSettings)
    .values(row)
    .onConflictDoUpdate({
      target: noteSettings.noteId,
      set: row,
    })
    .run();
  getDb().update(notes).set({ updatedAt: now() }).where(eq(notes.id, noteId)).run();
  return row;
}

export function listAIResults(noteId: string): AIResultRow[] {
  return getDb()
    .select()
    .from(aiResults)
    .where(eq(aiResults.noteId, noteId))
    .orderBy(desc(aiResults.createdAt))
    .all();
}

export function insertAIResult(input: {
  noteId: string;
  kind: string;
  body: string;
  speculationSpansJson: string;
  sourceContentHash: string;
}): AIResultRow {
  const row: AIResultRow = {
    id: createId(),
    createdAt: now(),
    ...input,
  };
  getDb().insert(aiResults).values(row).run();
  return row;
}

export function updateAIResultBody(id: string, noteId: string, body: string): boolean {
  const result = getDb()
    .update(aiResults)
    .set({ body })
    .where(and(eq(aiResults.id, id), eq(aiResults.noteId, noteId)))
    .run();
  return result.changes > 0;
}

export function deleteAIResult(id: string, noteId: string): boolean {
  const result = getDb()
    .delete(aiResults)
    .where(and(eq(aiResults.id, id), eq(aiResults.noteId, noteId)))
    .run();
  return result.changes > 0;
}

export function listImages(noteId: string): Array<GeneratedImageRow & { pin: ImagePinRow | null }> {
  const db = getDb();
  const images = db
    .select()
    .from(generatedImages)
    .where(eq(generatedImages.noteId, noteId))
    .orderBy(desc(generatedImages.createdAt))
    .all();
  return images.map((image) => ({
    image,
    pin: db.select().from(imagePins).where(eq(imagePins.imageId, image.id)).get() ?? null,
  })).map(({ image, pin }) => ({ ...image, pin }));
}

export function insertGeneratedImage(input: {
  noteId: string;
  prompt: string;
  style: string;
  visualType: string;
  generationModel: string;
  aspectRatio: string;
  filePath: string;
  width: number;
  height: number;
  metadataJson: string;
}): { image: GeneratedImageRow; pin: ImagePinRow } {
  const db = getDb();
  const image: GeneratedImageRow = {
    id: createId(),
    createdAt: now(),
    ...input,
  };
  db.insert(generatedImages).values(image).run();
  const count = db
    .select()
    .from(imagePins)
    .where(eq(imagePins.noteId, input.noteId))
    .all().length;
  const position = defaultPinForIndex(count);
  const pin: ImagePinRow = {
    id: createId(),
    imageId: image.id,
    noteId: input.noteId,
    ...position,
  };
  db.insert(imagePins).values(pin).run();
  return { image, pin };
}

export function copyGeneratedImageToNote(imageId: string, noteId: string): GeneratedImageRow | null {
  const source = getImage(imageId);
  if (!source || !getNote(noteId)) return null;
  const copied = insertGeneratedImage({
    noteId,
    prompt: source.prompt,
    style: source.style,
    visualType: source.visualType,
    generationModel: source.generationModel,
    aspectRatio: source.aspectRatio,
    filePath: source.filePath,
    width: source.width,
    height: source.height,
    metadataJson: source.metadataJson,
  });
  return copied.image;
}

export function updateImagePin(pinId: string, position: ImagePinPosition): ImagePinRow | null {
  getDb()
    .update(imagePins)
    .set(position)
    .where(eq(imagePins.id, pinId))
    .run();
  return getDb().select().from(imagePins).where(eq(imagePins.id, pinId)).get() ?? null;
}

export function getImage(id: string): (GeneratedImageRow & { pin: ImagePinRow | null }) | null {
  const image = getDb().select().from(generatedImages).where(eq(generatedImages.id, id)).get();
  if (!image) return null;
  const pin = getDb().select().from(imagePins).where(eq(imagePins.imageId, id)).get() ?? null;
  return { ...image, pin };
}

export function updateGeneratedImageFile(
  id: string,
  patch: { filePath: string; prompt: string; generationModel: string; width?: number; height?: number },
): GeneratedImageRow | null {
  getDb()
    .update(generatedImages)
    .set(patch)
    .where(eq(generatedImages.id, id))
    .run();
  return getDb().select().from(generatedImages).where(eq(generatedImages.id, id)).get() ?? null;
}

export function deleteGeneratedImage(id: string, noteId: string): boolean {
  const result = getDb()
    .delete(generatedImages)
    .where(and(eq(generatedImages.id, id), eq(generatedImages.noteId, noteId)))
    .run();
  return result.changes > 0;
}

export function insertCheckSession(input: {
  noteId: string;
  questions: Array<{
    type: string;
    difficulty: string;
    prompt: string;
    options?: unknown;
    expectedPoints: unknown;
  }>;
}): { session: CheckSessionRow; questions: CheckQuestionRow[] } {
  const session: CheckSessionRow = {
    id: createId(),
    noteId: input.noteId,
    overallScore: null,
    knowledgePointScoresJson: "{}",
    createdAt: now(),
  };
  const db = getDb();
  db.insert(checkSessions).values(session).run();
  const questions = input.questions.map((item) => {
    const row: CheckQuestionRow = {
      id: createId(),
      sessionId: session.id,
      type: item.type,
      difficulty: item.difficulty,
      prompt: item.prompt,
      optionsJson: item.options ? JSON.stringify(item.options) : null,
      expectedPointsJson: JSON.stringify(item.expectedPoints),
      userAnswer: null,
      evaluationJson: null,
      score: null,
      createdAt: now(),
    };
    db.insert(checkQuestions).values(row).run();
    return row;
  });
  return { session, questions };
}

export function listCheckSessions(noteId: string): CheckSessionRow[] {
  return getDb()
    .select()
    .from(checkSessions)
    .where(eq(checkSessions.noteId, noteId))
    .orderBy(desc(checkSessions.createdAt))
    .all();
}

export function getCheckSession(id: string): {
  session: CheckSessionRow;
  questions: CheckQuestionRow[];
} | null {
  const session = getDb().select().from(checkSessions).where(eq(checkSessions.id, id)).get();
  if (!session) return null;
  const questions = getDb()
    .select()
    .from(checkQuestions)
    .where(eq(checkQuestions.sessionId, id))
    .all();
  return { session, questions };
}

export function saveQuestionEvaluation(input: {
  questionId: string;
  userAnswer: string;
  evaluationJson: string;
  score: number;
}): CheckQuestionRow | null {
  getDb()
    .update(checkQuestions)
    .set({
      userAnswer: input.userAnswer,
      evaluationJson: input.evaluationJson,
      score: input.score,
    })
    .where(eq(checkQuestions.id, input.questionId))
    .run();
  return getDb().select().from(checkQuestions).where(eq(checkQuestions.id, input.questionId)).get() ?? null;
}

export function updateCheckSessionScores(
  sessionId: string,
  overallScore: number,
  knowledgePointScoresJson: string,
): void {
  getDb()
    .update(checkSessions)
    .set({ overallScore, knowledgePointScoresJson })
    .where(eq(checkSessions.id, sessionId))
    .run();
}

export function deleteCheckSession(id: string, noteId: string): boolean {
  const result = getDb()
    .delete(checkSessions)
    .where(and(eq(checkSessions.id, id), eq(checkSessions.noteId, noteId)))
    .run();
  return result.changes > 0;
}

export function insertInterviewSession(noteId: string): InterviewSessionRow {
  const row: InterviewSessionRow = {
    id: createId(),
    noteId,
    currentLevel: 1,
    status: "in_progress",
    resultJson: null,
    createdAt: now(),
    completedAt: null,
  };
  getDb().insert(interviewSessions).values(row).run();
  return row;
}

export function listInterviewSessions(noteId: string): InterviewSessionRow[] {
  return getDb()
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.noteId, noteId))
    .orderBy(desc(interviewSessions.createdAt))
    .all();
}

export function getInterviewSession(id: string): {
  session: InterviewSessionRow;
  turns: InterviewTurnRow[];
} | null {
  const session = getDb().select().from(interviewSessions).where(eq(interviewSessions.id, id)).get();
  if (!session) return null;
  const turns = getDb()
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, id))
    .all();
  return { session, turns };
}

export function addInterviewTurn(input: {
  sessionId: string;
  role: "interviewer" | "candidate";
  level: number;
  content: string;
}): InterviewTurnRow {
  const row: InterviewTurnRow = {
    id: createId(),
    createdAt: now(),
    ...input,
  };
  getDb().insert(interviewTurns).values(row).run();
  return row;
}

export function updateInterviewSession(
  id: string,
  patch: Partial<Pick<InterviewSessionRow, "currentLevel" | "status" | "resultJson" | "completedAt">>,
): InterviewSessionRow | null {
  getDb().update(interviewSessions).set(patch).where(eq(interviewSessions.id, id)).run();
  return getDb().select().from(interviewSessions).where(eq(interviewSessions.id, id)).get() ?? null;
}

export function deleteInterviewSession(id: string, noteId: string): boolean {
  const result = getDb()
    .delete(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.noteId, noteId)))
    .run();
  return result.changes > 0;
}

export function insertTask(input: {
  noteId?: string | null;
  type: string;
  inputJson: string;
}): AITaskRow {
  const row: AITaskRow = {
    id: createId(),
    noteId: input.noteId ?? null,
    type: input.type,
    status: "pending",
    inputJson: input.inputJson,
    resultRef: null,
    error: null,
    createdAt: now(),
    startedAt: null,
    finishedAt: null,
  };
  getDb().insert(aiTasks).values(row).run();
  return row;
}

export function getTask(id: string): AITaskRow | null {
  return getDb().select().from(aiTasks).where(eq(aiTasks.id, id)).get() ?? null;
}

export function listActiveTasks(noteId: string): AITaskRow[] {
  return getDb()
    .select()
    .from(aiTasks)
    .where(eq(aiTasks.noteId, noteId))
    .orderBy(desc(aiTasks.createdAt))
    .all()
    .filter((task) => task.status === "pending" || task.status === "running")
    .slice(0, 8);
}

export function updateTask(
  id: string,
  patch: Partial<Pick<AITaskRow, "status" | "resultRef" | "error" | "startedAt" | "finishedAt">>,
): AITaskRow | null {
  getDb().update(aiTasks).set(patch).where(eq(aiTasks.id, id)).run();
  return getTask(id);
}

export function recoverInterruptedTasks(): void {
  const db = getDb();
  const running = db.select().from(aiTasks).where(eq(aiTasks.status, "running")).all();
  for (const task of running) {
    db.update(aiTasks)
      .set({ status: "failed", error: "进程中断，请重试", finishedAt: now() })
      .where(eq(aiTasks.id, task.id))
      .run();
  }
}

export function getAppSetting(key: string): string | null {
  return getDb().select().from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? null;
}

export function setAppSetting(key: string, value: string): void {
  getDb()
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value },
    })
    .run();
}

export function allAppSettings(): Record<string, string> {
  const rows = getDb().select().from(appSettings).all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
