import type { ChatModel } from "../models";
import { parseJsonFromModel } from "../json";
import {
  normalizeAtlas,
  normalizeGaps,
  normalizeMerge,
  normalizeReviewPlan,
  type AtlasDraft,
  type GapDraft,
  type MergeDraft,
  type ReviewPrompt,
} from "@/domain/knowledge";

function packNotes(notes: Array<{ title: string; content: string }>, perNote = 1200, total = 10000): string {
  let used = 0;
  const parts: string[] = [];
  for (const note of notes) {
    if (used >= total) break;
    const body = note.content.replace(/\s+/g, " ").trim().slice(0, perNote);
    parts.push(`# ${note.title}\n${body || "（这篇还没有正文）"}`);
    used += body.length;
  }
  return parts.join("\n\n");
}

export async function proposeAtlas(input: {
  chat: ChatModel;
  notes: Array<{ title: string; content: string }>;
}): Promise<AtlasDraft> {
  const raw = await input.chat.complete({
    temperature: 0.3,
    json: true,
    messages: [
      {
        role: "system",
        content: `你在阅读同一个人的多篇笔记，整理一张知识地图。结果是建议，不是定论。
返回 JSON：{"points":[{"label":"知识点","summary":"一句话","noteTitles":["笔记标题"]}],"edges":[{"from":"知识点","to":"知识点","relation":"related|depends|contains|prerequisite","reason":"为什么"}]}
relation 含义：prerequisite 表示 from 是 to 的前置知识；depends 表示 from 依赖 to；contains 表示 from 包含 to；related 表示相关。
noteTitles 必须原样来自给出的笔记标题。不要编造笔记里没有的事实。知识点要具体，不要用“概述”这种空词。中文。`,
      },
      { role: "user", content: packNotes(input.notes) },
    ],
  });
  return normalizeAtlas(parseJsonFromModel(raw));
}

export async function proposeGaps(input: {
  chat: ChatModel;
  brief: string;
}): Promise<GapDraft[]> {
  const raw = await input.chat.complete({
    temperature: 0.4,
    json: true,
    messages: [
      {
        role: "system",
        content: `根据这个人已经写下的知识点，指出还缺的关键知识。这是建议。
返回 JSON：{"gaps":[{"label":"缺失的知识点","reason":"为什么缺了它，已有的知识就还不完整"}]}
不要重复已经掌握或已经写下的知识点。每条原因要提到已有知识。最多 5 条。中文。`,
      },
      { role: "user", content: input.brief },
    ],
  });
  return normalizeGaps(parseJsonFromModel(raw));
}

export async function proposeMerge(input: {
  chat: ChatModel;
  notes: Array<{ title: string; content: string }>;
}): Promise<MergeDraft> {
  const raw = await input.chat.complete({
    temperature: 0.3,
    json: true,
    messages: [
      {
        role: "system",
        content: `把多篇笔记合并成一篇新笔记的草稿。不要假设会覆盖原文。
返回 JSON：{"title":"新标题","body":"Markdown 正文","duplicates":["重复的说法"],"conflicts":[{"topic":"冲突点","detail":"两边分别怎么说"}]}
保留各自独有的事实。重复的只写一次。笔记之间说法不一致时写入 conflicts，不要擅自抹平。正文用 Markdown。中文。`,
      },
      { role: "user", content: packNotes(input.notes, 1800, 14000) },
    ],
  });
  return normalizeMerge(parseJsonFromModel(raw));
}

export async function proposeReviewPlan(input: {
  chat: ChatModel;
  brief: string;
}): Promise<ReviewPrompt[]> {
  const raw = await input.chat.complete({
    temperature: 0.4,
    json: true,
    messages: [
      {
        role: "system",
        content: `为这个人安排今天的回忆，而不是让他重读笔记。
返回 JSON：{"items":[{"point":"已有知识点名称","prompt":"一个需要主动回忆才能回答的问题"}]}
point 必须来自给出的知识点名称。优先问还不稳、学习中、或最近面试和检测里薄弱的点。问题要短，能口头回答。最多 5 题。中文。`,
      },
      { role: "user", content: input.brief },
    ],
  });
  return normalizeReviewPlan(parseJsonFromModel(raw));
}
