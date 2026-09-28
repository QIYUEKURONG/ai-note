import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  contentJson: text("content_json").notNull(),
  contentText: text("content_text").notNull().default(""),
  contentHash: text("content_hash").notNull(),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const noteSettings = sqliteTable("note_settings", {
  noteId: text("note_id")
    .primaryKey()
    .references(() => notes.id, { onDelete: "cascade" }),
  preset: text("preset").notNull().default("paper"),
  background: text("background").notNull(),
  fontFamily: text("font_family").notNull(),
  fontSize: integer("font_size").notNull().default(18),
  textColor: text("text_color").notNull(),
  accentColor: text("accent_color").notNull(),
  codeTheme: text("code_theme").notNull().default("paper"),
  lineHeight: real("line_height").notNull().default(1.7),
  pageWidth: integer("page_width").notNull().default(720),
  customColorsJson: text("custom_colors_json").notNull().default("{}"),
});

export const highlights = sqliteTable("highlights", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  blockId: text("block_id"),
  text: text("text").notNull(),
  color: text("color").notNull(),
  fromPos: integer("from_pos"),
  toPos: integer("to_pos"),
  createdAt: integer("created_at").notNull(),
});

export const aiResults = sqliteTable("ai_results", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  speculationSpansJson: text("speculation_spans_json").notNull().default("[]"),
  sourceContentHash: text("source_content_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const generatedImages = sqliteTable("generated_images", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  style: text("style").notNull(),
  visualType: text("visual_type").notNull(),
  generationModel: text("generation_model").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  filePath: text("file_path").notNull(),
  width: integer("width").notNull().default(1024),
  height: integer("height").notNull().default(1024),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const imagePins = sqliteTable("image_pins", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => generatedImages.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  edge: text("edge").notNull(),
  t: real("t").notNull(),
  offsetPx: real("offset_px").notNull().default(28),
  scale: real("scale").notNull().default(1),
  zIndex: integer("z_index").notNull().default(1),
});

export const checkSessions = sqliteTable("check_sessions", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  overallScore: real("overall_score"),
  knowledgePointScoresJson: text("knowledge_point_scores_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const checkQuestions = sqliteTable("check_questions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => checkSessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  difficulty: text("difficulty").notNull(),
  prompt: text("prompt").notNull(),
  optionsJson: text("options_json"),
  expectedPointsJson: text("expected_points_json").notNull().default("[]"),
  userAnswer: text("user_answer"),
  evaluationJson: text("evaluation_json"),
  score: real("score"),
  createdAt: integer("created_at").notNull(),
});

export const interviewSessions = sqliteTable("interview_sessions", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  currentLevel: integer("current_level").notNull().default(1),
  status: text("status").notNull().default("in_progress"),
  resultJson: text("result_json"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export const interviewTurns = sqliteTable("interview_turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  level: integer("level").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const aiTasks = sqliteTable("ai_tasks", {
  id: text("id").primaryKey(),
  noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  inputJson: text("input_json").notNull().default("{}"),
  resultRef: text("result_ref"),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const knowledgePoints = sqliteTable("knowledge_points", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  summary: text("summary").notNull().default(""),
  status: text("status").notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pointNotes = sqliteTable(
  "point_notes",
  {
    pointId: text("point_id")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.pointId, table.noteId] })],
);

export const knowledgeEdges = sqliteTable("knowledge_edges", {
  id: text("id").primaryKey(),
  fromPointId: text("from_point_id")
    .notNull()
    .references(() => knowledgePoints.id, { onDelete: "cascade" }),
  toPointId: text("to_point_id")
    .notNull()
    .references(() => knowledgePoints.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("suggested"),
  createdAt: integer("created_at").notNull(),
});

export const mastery = sqliteTable("mastery", {
  pointId: text("point_id")
    .primaryKey()
    .references(() => knowledgePoints.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("unknown"),
  score: real("score").notNull().default(0),
  source: text("source").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});

export const studyRecords = sqliteTable("study_records", {
  id: text("id").primaryKey(),
  pointId: text("point_id").references(() => knowledgePoints.id, { onDelete: "set null" }),
  noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  prompt: text("prompt").notNull().default(""),
  answer: text("answer").notNull().default(""),
  score: real("score"),
  createdAt: integer("created_at").notNull(),
});

export const knowledgeGaps = sqliteTable("knowledge_gaps", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("suggested"),
  noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  remindAt: integer("remind_at").notNull(),
  label: text("label").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});

export const reviewItems = sqliteTable("review_items", {
  id: text("id").primaryKey(),
  pointId: text("point_id")
    .notNull()
    .references(() => knowledgePoints.id, { onDelete: "cascade" }),
  noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(),
  dueAt: integer("due_at").notNull(),
  status: text("status").notNull().default("pending"),
  score: real("score"),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const mergeDrafts = sqliteTable("merge_drafts", {
  id: text("id").primaryKey(),
  sourceIdsJson: text("source_ids_json").notNull().default("[]"),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  duplicatesJson: text("duplicates_json").notNull().default("[]"),
  conflictsJson: text("conflicts_json").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
});

export type NoteRow = typeof notes.$inferSelect;
export type NoteSettingsRow = typeof noteSettings.$inferSelect;
export type GeneratedImageRow = typeof generatedImages.$inferSelect;
export type ImagePinRow = typeof imagePins.$inferSelect;
export type AIResultRow = typeof aiResults.$inferSelect;
export type AITaskRow = typeof aiTasks.$inferSelect;
export type CheckSessionRow = typeof checkSessions.$inferSelect;
export type CheckQuestionRow = typeof checkQuestions.$inferSelect;
export type InterviewSessionRow = typeof interviewSessions.$inferSelect;
export type InterviewTurnRow = typeof interviewTurns.$inferSelect;

