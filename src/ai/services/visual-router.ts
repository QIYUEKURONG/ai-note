import { parseVisualTypeResponse, routeVisualType, type VisualTypeId } from "@/domain/visual-types";
import type { ChatModel } from "../models";

export async function decideVisualType(input: {
  chat: ChatModel;
  title: string;
  content: string;
  preferred?: VisualTypeId | null;
}): Promise<VisualTypeId> {
  if (input.preferred) return input.preferred;
  const fallback = routeVisualType(`${input.title}\n${input.content}`);
  try {
    const raw = await input.chat.complete({
      temperature: 0,
      maxTokens: 64,
      messages: [
        {
          role: "system",
          content:
            "根据笔记选择最合适的视觉类型。只返回一个英文 id：architecture, flowchart, timeline, relation, knowledge-card, comparison, illustration。",
        },
        {
          role: "user",
          content: `${input.title}\n${input.content.slice(0, 4000)}`,
        },
      ],
    });
    return parseVisualTypeResponse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
