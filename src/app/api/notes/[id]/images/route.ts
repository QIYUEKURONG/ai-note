import { copyGeneratedImageToNote, deleteGeneratedImage, getNote, listImages } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { bootAI, badRequest, json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  return json({ images: listImages(id) });
}

export async function POST(request: Request, ctx: Ctx) {
  bootAI();
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const body = await request.json();
  if (typeof body.copyImageId === "string" && body.copyImageId) {
    const image = copyGeneratedImageToNote(body.copyImageId, id);
    if (!image) return notFound("图片不存在");
    return json({ image });
  }
  const task = enqueueTask({
    noteId: id,
    type: "create_image",
    payload: body,
  });
  return json({ task }, 202);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const imageId = new URL(request.url).searchParams.get("imageId");
  if (!imageId) return badRequest("缺少图片");
  if (!deleteGeneratedImage(imageId, id)) return notFound("图片不存在");
  return json({ ok: true });
}
