import type { CardGrid } from "@/domain/image-styles";
import { IMAGE_STYLES } from "@/domain/image-styles";
import type { VisualTypeId } from "@/domain/visual-types";
import type { ChatModel } from "../models";
import { parseJsonFromModel } from "../json";

export type KnowledgeCardCell = {
  title: string;
  body: string;
};

export type KnowledgeCardSpec = {
  grid: CardGrid;
  density: "detailed" | "medium" | "long";
  theme: string;
  font: string;
  background: string;
  color: string;
  border: string;
};

const VISUAL_PROMPT: Record<VisualTypeId, string> = {
  architecture: "技术架构图，模块清晰、连线明确、可阅读的中文标签",
  flowchart: "流程图，步骤从左到右或从上到下，菱形判断、矩形动作",
  timeline: "时间线信息图，按时间或版本推进",
  relation: "关系图，节点与连线表达人物或模块关系",
  "knowledge-card": "知识卡片网格海报，格子对齐，中文必须清晰可读",
  comparison: "对比信息图，左右或表格对照",
  illustration: "叙事插画，不要做成后台示意图",
};

export async function buildImagePrompt(input: {
  chat: ChatModel;
  title: string;
  content: string;
  style: string;
  density: string;
  usage: string;
  visualType: VisualTypeId;
  card?: KnowledgeCardSpec | null;
}): Promise<{ prompt: string; cardCells?: KnowledgeCardCell[] }> {
  const styleLabel = IMAGE_STYLES.find((item) => item.id === input.style)?.label ?? input.style;
  if (input.visualType === "knowledge-card" && input.card) {
    const cells = await extractCardCells({
      chat: input.chat,
      title: input.title,
      content: input.content,
      spec: input.card,
    });
    const cellText = cells
      .map((cell, index) => `${index + 1}. ${cell.title}：${cell.body}`)
      .join("\n");
    const prompt = `一张中文知识卡片海报，标题「${input.title}」。
必须严格排成 ${input.card.grid} 个整齐格子，文字清晰可读，不要乱码，不要英文乱码。
信息密度：${input.card.density}。主题：${input.card.theme}。画风：${styleLabel}。
背景：${input.card.background}。字体感觉：${input.card.font}。主色：${input.card.color}。边框：${input.card.border}。
格子内容：
${cellText}
高质量平面设计，居中构图，适合打印。`;
    return { prompt, cardCells: cells };
  }

  const prompt = await input.chat.complete({
    temperature: 0.6,
    maxTokens: 700,
    messages: [
      {
        role: "system",
        content: `你为字节跳动 Seedream 写中文生图提示词。只输出提示词本身。
视觉类型：${VISUAL_PROMPT[input.visualType]}。
画风：${styleLabel}。信息密度：${input.density}。用途：${input.usage}。
要求中文标签清晰，不要水印，不要 UI 截图。`,
      },
      {
        role: "user",
        content: `标题：${input.title}\n笔记：\n${input.content.slice(0, 6000)}`,
      },
    ],
  });
  return { prompt };
}

async function extractCardCells(input: {
  chat: ChatModel;
  title: string;
  content: string;
  spec: KnowledgeCardSpec;
}): Promise<KnowledgeCardCell[]> {
  const raw = await input.chat.complete({
    temperature: 0.3,
    json: true,
    messages: [
      {
        role: "system",
        content: `把笔记抽成知识卡片格子。返回 JSON：{"cells":[{"title":"...","body":"..."}]}。
格子数量必须正好是 ${input.spec.grid}。密度：${input.spec.density}。中文。body 短句。`,
      },
      {
        role: "user",
        content: `标题：${input.title}\n${input.content.slice(0, 8000)}`,
      },
    ],
  });
  const parsed = parseJsonFromModel<{ cells: KnowledgeCardCell[] }>(raw);
  const cells = Array.isArray(parsed.cells) ? parsed.cells : [];
  return cells.slice(0, input.spec.grid);
}
