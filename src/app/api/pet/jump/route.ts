import fs from "node:fs";
import path from "node:path";
import { badRequest, json } from "../../helpers";

const file = path.join(process.cwd(), "data", "pet-jump.json");

export async function GET() {
  if (!fs.existsSync(file)) return json({ href: null });
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { href?: string; at?: number };
    fs.unlinkSync(file);
    if (!saved.href || !saved.href.startsWith("/") || Date.now() - (saved.at ?? 0) > 20000) {
      return json({ href: null });
    }
    return json({ href: saved.href });
  } catch {
    return json({ href: null });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { href?: string } | null;
  const href = body?.href ?? "/";
  if (!href.startsWith("/") || href.startsWith("//")) return badRequest("地址无效");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ href, at: Date.now() }));
  return json({ ok: true });
}
