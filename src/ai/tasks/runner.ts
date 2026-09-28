import { getTask, insertTask, recoverInterruptedTasks, updateTask } from "@/db/repos";
import { now } from "@/lib/id";
import type { AITaskRow } from "@/db/schema";

export type TaskType =
  | "generate_summary"
  | "create_image"
  | "generate_questions"
  | "evaluate_answer"
  | "generate_interview"
  | "review_note"
  | "build_atlas"
  | "find_gaps"
  | "merge_notes"
  | "plan_review"
  | "answer_recall";

export type TaskHandler = (task: AITaskRow) => Promise<string | void>;

const handlers = new Map<string, TaskHandler>();
const queue: string[] = [];
let active = 0;
const MAX_CONCURRENCY = 2;
let recovered = false;

export function registerTaskHandler(type: string, handler: TaskHandler) {
  handlers.set(type, handler);
}

export function enqueueTask(input: {
  noteId?: string | null;
  type: TaskType | string;
  payload: unknown;
}): AITaskRow {
  ensureRecovery();
  const task = insertTask({
    noteId: input.noteId,
    type: input.type,
    inputJson: JSON.stringify(input.payload),
  });
  queue.push(task.id);
  void pump();
  return task;
}

export function retryTask(id: string): AITaskRow | null {
  const task = getTask(id);
  if (!task) return null;
  updateTask(id, {
    status: "pending",
    error: null,
    resultRef: null,
    startedAt: null,
    finishedAt: null,
  });
  queue.push(id);
  void pump();
  return getTask(id);
}

function ensureRecovery() {
  if (recovered) return;
  recoverInterruptedTasks();
  recovered = true;
}

async function pump() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    active += 1;
    void run(id).finally(() => {
      active -= 1;
      void pump();
    });
  }
}

async function run(id: string) {
  const task = getTask(id);
  if (!task) return;
  const handler = handlers.get(task.type);
  if (!handler) {
    updateTask(id, {
      status: "failed",
      error: `未知任务类型：${task.type}`,
      finishedAt: now(),
    });
    return;
  }
  updateTask(id, { status: "running", startedAt: now(), error: null });
  try {
    const resultRef = await handler(task);
    updateTask(id, {
      status: "success",
      resultRef: resultRef ?? null,
      finishedAt: now(),
    });
  } catch (error) {
    updateTask(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "任务失败",
      finishedAt: now(),
    });
  }
}

export function peekQueueLength(): number {
  return queue.length;
}

export function resetRunnerForTests() {
  queue.length = 0;
  active = 0;
  recovered = false;
  handlers.clear();
}
