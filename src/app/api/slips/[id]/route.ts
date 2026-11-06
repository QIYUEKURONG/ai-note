import { deleteSlip, updateSlip } from "@/db/slips";
import { badRequest, json, notFound } from "../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    body?: string;
    color?: string;
    day?: string;
  };
  const slip = updateSlip(id, body);
  if (!slip) return badRequest("没有改成");
  return json({ slip });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteSlip(id)) return notFound("便签不存在");
  return json({ ok: true });
}
