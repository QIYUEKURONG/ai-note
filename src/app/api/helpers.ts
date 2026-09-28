import { NextResponse } from "next/server";
import { ensureTaskHandlers } from "@/ai/tasks/handlers";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function notFound(message = "未找到") {
  return json({ error: message }, 404);
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function bootAI() {
  ensureTaskHandlers();
}
