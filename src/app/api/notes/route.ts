import { createNote, listNotes } from "@/db/repos";
import { json } from "../helpers";

export async function GET() {
  return json({ notes: listNotes() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const note = createNote(body.title?.trim() || "未命名笔记");
  return json({ note }, 201);
}
