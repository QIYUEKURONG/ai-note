import { isOrganizeKind } from "@/domain/organize-kinds";
import { deleteAIResult, getNote, listAIResults } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  return json({ results: listAIResults(id) });
}

export async function POST(request: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const body = (await request.json()) as { kind?: string; selection?: string };
  if (!body.kind || !isOrganizeKind(body.kind)) return badRequest("请选择整理方式");
  const selection = typeof body.selection === "string" ? body.selection.slice(0, 4000) : "";
  const task = enqueueTask({
    noteId: id,
    type: "generate_summary",
    payload: { kind: body.kind, selection },
  });
  return json({ task }, 202);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const resultId = url.searchParams.get("resultId");
  if (!resultId) return badRequest("缺少结果");
  if (!deleteAIResult(resultId, id)) return notFound("结果不存在");
  return json({ ok: true });
}
