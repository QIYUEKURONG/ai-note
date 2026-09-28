import { updateImagePin } from "@/db/repos";
import { json, notFound } from "../../../../helpers";
import type { ImagePinPosition } from "@/domain/pins";

type Ctx = { params: Promise<{ id: string; pinId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { pinId } = await ctx.params;
  const position = (await request.json()) as ImagePinPosition;
  const pin = updateImagePin(pinId, position);
  if (!pin) return notFound("挂载不存在");
  return json({ pin });
}
