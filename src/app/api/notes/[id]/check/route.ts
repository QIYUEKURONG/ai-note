import { deleteCheckSession, getCheckSession, getNote, listCheckSessions } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId) {
    const packed = getCheckSession(sessionId);
    if (!packed) return notFound("检测不存在");
    return json(packed);
  }
  return json({ sessions: listCheckSessions(id) });
}

export async function POST(_: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const task = enqueueTask({
    noteId: id,
    type: "generate_questions",
    payload: {},
  });
  return json({ task }, 202);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return badRequest("缺少场次");
  if (!deleteCheckSession(sessionId, id)) return notFound("场次不存在");
  return json({ ok: true });
}
