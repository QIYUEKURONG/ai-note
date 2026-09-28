import {
  deleteInterviewSession,
  getInterviewSession,
  getNote,
  listInterviewSessions,
} from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId) {
    const packed = getInterviewSession(sessionId);
    if (!packed) return notFound("面试不存在");
    return json(packed);
  }
  return json({ sessions: listInterviewSessions(id) });
}

export async function POST(request: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    answer?: string;
    finish?: boolean;
  };
  const task = enqueueTask({
    noteId: id,
    type: "generate_interview",
    payload: body,
  });
  return json({ task }, 202);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return badRequest("缺少场次");
  if (!deleteInterviewSession(sessionId, id)) return notFound("面试不存在");
  return json({ ok: true });
}
