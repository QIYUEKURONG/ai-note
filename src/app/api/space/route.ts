import {
  acceptGap,
  acceptMergeDraft,
  confirmEdge,
  confirmPoint,
  createReminder,
  discardMergeDraft,
  dismissGap,
  getSpace,
  touchReminder,
} from "@/db/knowledge";
import { getNote } from "@/db/repos";
import { enqueueTask } from "@/ai/tasks/runner";
import { badRequest, bootAI, json, notFound } from "../helpers";

type Body = {
  action?: string;
  noteIds?: string[];
  draftId?: string;
  pointId?: string;
  edgeId?: string;
  gapId?: string;
  itemId?: string;
  answer?: string;
  noteId?: string;
  remindAt?: number;
  label?: string;
  reminderId?: string;
  op?: string;
};

export async function GET() {
  return json({ space: getSpace() });
}

export async function POST(request: Request) {
  bootAI();
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) return badRequest("请求无效");
  try {
    if (body.action === "atlas") {
      const task = enqueueTask({ type: "build_atlas", payload: {} });
      return json({ task }, 202);
    }
    if (body.action === "gaps") {
      const task = enqueueTask({ type: "find_gaps", payload: {} });
      return json({ task }, 202);
    }
    if (body.action === "review-plan") {
      const task = enqueueTask({ type: "plan_review", payload: {} });
      return json({ task }, 202);
    }
    if (body.action === "merge") {
      const ids = [...new Set((body.noteIds ?? []).filter((id) => typeof id === "string"))];
      if (ids.length < 2) return badRequest("至少拖入两篇笔记");
      if (ids.some((id) => !getNote(id))) return badRequest("有笔记找不到");
      const task = enqueueTask({ type: "merge_notes", payload: { noteIds: ids } });
      return json({ task }, 202);
    }
    if (body.action === "answer-review") {
      const answer = (body.answer ?? "").trim();
      if (!body.itemId || !answer) return badRequest("先写下你的回答");
      const task = enqueueTask({
        type: "answer_recall",
        payload: { itemId: body.itemId, answer: answer.slice(0, 2000) },
      });
      return json({ task }, 202);
    }
    if (body.action === "confirm-point") {
      if (!body.pointId || !confirmPoint(body.pointId)) return notFound("知识点不存在");
      return json({ space: getSpace() });
    }
    if (body.action === "confirm-edge") {
      if (!body.edgeId || !confirmEdge(body.edgeId)) return notFound("关系不存在");
      return json({ space: getSpace() });
    }
    if (body.action === "create-gap") {
      if (!body.gapId) return badRequest("缺少缺口");
      const created = acceptGap(body.gapId);
      if (!created) return badRequest("这条缺口已经处理过了");
      return json({ space: getSpace(), noteId: created.noteId });
    }
    if (body.action === "dismiss-gap") {
      if (!body.gapId || !dismissGap(body.gapId)) return badRequest("这条缺口已经处理过了");
      return json({ space: getSpace() });
    }
    if (body.action === "accept-merge") {
      if (!body.draftId) return badRequest("缺少合并稿");
      const created = acceptMergeDraft(body.draftId);
      if (!created) return badRequest("这份合并稿已经处理过了");
      return json({ space: getSpace(), noteId: created.noteId });
    }
    if (body.action === "discard-merge") {
      if (!body.draftId || !discardMergeDraft(body.draftId)) return badRequest("这份合并稿已经处理过了");
      return json({ space: getSpace() });
    }
    if (body.action === "remind") {
      if (!body.noteId || !getNote(body.noteId)) return notFound("笔记不存在");
      const remindAt = Number(body.remindAt);
      if (!Number.isFinite(remindAt) || remindAt < Date.now() - 60_000) return badRequest("请选一个稍后的时间");
      createReminder(body.noteId, remindAt, body.label ?? "");
      return json({ space: getSpace() });
    }
    if (body.action === "reminder") {
      if (!body.reminderId || (body.op !== "done" && body.op !== "snooze")) return badRequest("请求无效");
      if (!touchReminder(body.reminderId, body.op)) return notFound("提醒不存在");
      return json({ space: getSpace() });
    }
    return badRequest("请求无效");
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "没有完成");
  }
}
