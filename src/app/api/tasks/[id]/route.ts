import { getTask } from "@/db/repos";
import { retryTask } from "@/ai/tasks/runner";
import { bootAI, json, notFound } from "../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const task = getTask(id);
  if (!task) return notFound("任务不存在");
  return json({ task });
}

export async function POST(_: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  const task = retryTask(id);
  if (!task) return notFound("任务不存在");
  return json({ task });
}
