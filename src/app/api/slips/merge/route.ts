import { collectSlips, mergeSlips } from "@/db/slips";
import { badRequest, json } from "../../helpers";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown;
    mode?: string;
  };
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length < 80))]
    : [];
  if (ids.length === 0 || ids.length > 40) return badRequest("先选中便签");
  if (body.mode === "note") {
    const noteId = collectSlips(ids);
    if (!noteId) return badRequest("这些便签没能收成笔记");
    return json({ noteId });
  }
  if (ids.length < 2) return badRequest("至少选中两条再合并");
  const slip = mergeSlips(ids);
  if (!slip) return badRequest("这些便签没能合并");
  return json({ slip });
}
