import {
  appendMarkdownBlocks,
  documentFromOrganizedMarkdown,
  parseDocument,
  replaceDocumentFromMarkdown,
} from "@/lib/document";
import { getNote, listActiveTasks, listAIResults, listCheckSessions, listImages, listInterviewSessions, softDeleteNote, updateNote } from "@/db/repos";
import { badRequest, json, notFound } from "../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const note = getNote(id);
  if (!note) return notFound("笔记不存在");
  return json({
    note,
    images: listImages(id),
    results: listAIResults(id),
    checks: listCheckSessions(id),
    interviews: listInterviewSessions(id),
    tasks: listActiveTasks(id),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getNote(id);
  if (!existing) return notFound("笔记不存在");
  const body = (await request.json()) as {
    title?: string;
    contentJson?: string;
    isFavorite?: boolean;
    insertMarkdown?: string;
    insertHeading?: string;
    replaceMarkdown?: string;
    applyMarkdown?: string;
  };
  let contentJson = body.contentJson;
  if (body.insertMarkdown) {
    const doc = appendMarkdownBlocks(
      parseDocument(existing.contentJson),
      body.insertMarkdown,
      body.insertHeading ?? "AI 整理",
    );
    contentJson = JSON.stringify(doc);
  }
  if (body.replaceMarkdown) {
    const doc = replaceDocumentFromMarkdown(
      body.replaceMarkdown,
      body.title ?? existing.title,
    );
    contentJson = JSON.stringify(doc);
  }
  if (body.applyMarkdown) {
    const doc = documentFromOrganizedMarkdown(body.applyMarkdown, body.title ?? existing.title);
    contentJson = JSON.stringify(doc);
  }
  const note = updateNote(id, {
    title: body.title,
    contentJson,
    isFavorite: body.isFavorite,
  });
  return json({ note });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  if (!softDeleteNote(id)) return badRequest("删除失败");
  return json({ ok: true });
}
