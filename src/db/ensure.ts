import Database from "better-sqlite3";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    content_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS note_settings (
    note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    preset TEXT NOT NULL DEFAULT 'paper',
    background TEXT NOT NULL,
    font_family TEXT NOT NULL,
    font_size INTEGER NOT NULL DEFAULT 18,
    text_color TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    code_theme TEXT NOT NULL DEFAULT 'paper',
    line_height REAL NOT NULL DEFAULT 1.7,
    page_width INTEGER NOT NULL DEFAULT 720,
    custom_colors_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    block_id TEXT,
    text TEXT NOT NULL,
    color TEXT NOT NULL,
    from_pos INTEGER,
    to_pos INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_results (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    speculation_spans_json TEXT NOT NULL DEFAULT '[]',
    source_content_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS generated_images (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    style TEXT NOT NULL,
    visual_type TEXT NOT NULL,
    generation_model TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    file_path TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 1024,
    height INTEGER NOT NULL DEFAULT 1024,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS image_pins (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    edge TEXT NOT NULL,
    t REAL NOT NULL,
    offset_px REAL NOT NULL DEFAULT 28,
    scale REAL NOT NULL DEFAULT 1,
    z_index INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS check_sessions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    overall_score REAL,
    knowledge_point_scores_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS check_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES check_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options_json TEXT,
    expected_points_json TEXT NOT NULL DEFAULT '[]',
    user_answer TEXT,
    evaluation_json TEXT,
    score REAL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    current_level INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'in_progress',
    result_json TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS interview_turns (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    level INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_tasks (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input_json TEXT NOT NULL DEFAULT '{}',
    result_ref TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_points (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'suggested',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS point_notes (
    point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    PRIMARY KEY (point_id, note_id)
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_edges (
    id TEXT PRIMARY KEY,
    from_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    to_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'suggested',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mastery (
    point_id TEXT PRIMARY KEY REFERENCES knowledge_points(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'unknown',
    score REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS study_records (
    id TEXT PRIMARY KEY,
    point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    score REAL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'suggested',
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    remind_at INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS review_items (
    id TEXT PRIMARY KEY,
    point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    score REAL,
    comment TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS merge_drafts (
    id TEXT PRIMARY KEY,
    source_ids_json TEXT NOT NULL DEFAULT '[]',
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    duplicates_json TEXT NOT NULL DEFAULT '[]',
    conflicts_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  )`,
];

export function ensureSchema(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const statement of STATEMENTS) {
    sqlite.exec(statement);
  }
}
