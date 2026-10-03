import { saveImageFile } from "@/lib/storage";
import { badRequest, json } from "../helpers";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return badRequest("请粘贴一张图片");
  }
  if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
    return badRequest("图片太大");
  }
  const filePath = saveImageFile(Buffer.from(await file.arrayBuffer()), file.type);
  const name = filePath.replace(/^storage\/images\//, "");
  return json({ url: `/api/media/${name}` });
}
