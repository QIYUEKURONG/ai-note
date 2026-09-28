import { getCheckSession } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  bootAI();
  const body = (await request.json()) as {
    sessionId?: string;
    questionId?: string;
    answer?: string;
  };
  if (!body.sessionId || !body.questionId || !body.answer?.trim()) {
    return badRequest("请作答");
  }
  if (!getCheckSession(body.sessionId)) return notFound("检测不存在");
  const task = enqueueTask({
    noteId: (await ctx.params).id,
    type: "evaluate_answer",
    payload: body,
  });
  return json({ task }, 202);
}
