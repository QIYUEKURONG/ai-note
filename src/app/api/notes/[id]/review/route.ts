import { parseStoredReview, type ReviewStatus } from "@/domain/review";
import { getNote, listAIResults, updateAIResultBody } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const task = enqueueTask({
    noteId: id,
    type: "review_note",
    payload: {},
  });
  return json({ task }, 202);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const body = (await request.json()) as {
    resultId?: string;
    markId?: string;
    status?: ReviewStatus;
  };
  if (!body.resultId || !body.markId) return badRequest("缺少批注");
  if (body.status !== "ignored" && body.status !== "applied") return badRequest("无法更新批注");
  const result = listAIResults(id).find((item) => item.id === body.resultId && item.kind === "annotation");
  if (!result) return notFound("批注不存在");
  const marks = parseStoredReview(result.body).map((mark) =>
    mark.id === body.markId ? { ...mark, status: body.status! } : mark,
  );
  if (!updateAIResultBody(result.id, id, JSON.stringify({ marks }))) return badRequest("更新失败");
  return json({ ok: true });
}
