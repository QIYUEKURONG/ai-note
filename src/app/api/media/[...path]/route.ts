import fs from "node:fs";
import { mimeFromPath, resolveStoredFile } from "@/lib/storage";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_: Request, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  const relative = `storage/images/${parts.join("/")}`;
  const absolute = resolveStoredFile(relative);
  if (!absolute) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = fs.readFileSync(absolute);
  return new Response(bytes, {
    headers: {
      "Content-Type": mimeFromPath(absolute),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
