import type { ChatModel } from "../models";
import { parseJsonFromModel } from "../json";

export type InterviewReport = {
  mastery: string;
  weakPoints: string[];
  suggestions: string[];
  summary: string;
};

const LEVEL_LABEL: Record<number, string> = {
  1: "基础问题",
  2: "原理问题",
  3: "场景问题",
  4: "源码问题",
  5: "追问",
};

export async function nextInterviewQuestion(input: {
  chat: ChatModel;
  title: string;
  content: string;
  level: number;
  history: Array<{ role: string; content: string }>;
}): Promise<{ question: string; nextLevel: number; shouldEnd: boolean }> {
  const raw = await input.chat.complete({
    temperature: 0.5,
    json: true,
    thinking: input.level >= 4,
    messages: [
      {
        role: "system",
        content: `你是严格但克制的面试官，只围绕用户笔记提问。当前关卡 Level ${input.level}：${LEVEL_LABEL[input.level]}。
返回 JSON：{"question":"...","nextLevel":1-5,"shouldEnd":false}
如果用户已完整走完 5 级或明显无法继续，shouldEnd 为 true，question 仍给一句收束。
一次只问一个问题。中文。不要表扬套话。`,
      },
      {
        role: "user",
        content: `笔记标题：${input.title}\n笔记：\n${input.content.slice(0, 7000)}\n\n对话：\n${input.history
          .map((item) => `${item.role}: ${item.content}`)
          .join("\n")}`,
      },
    ],
  });
  const parsed = parseJsonFromModel<{
    question: string;
    nextLevel?: number;
    shouldEnd?: boolean;
  }>(raw);
  return {
    question: parsed.question,
    nextLevel: Math.max(1, Math.min(5, Number(parsed.nextLevel) || input.level)),
    shouldEnd: Boolean(parsed.shouldEnd),
  };
}

export async function finishInterview(input: {
  chat: ChatModel;
  title: string;
  history: Array<{ role: string; content: string }>;
}): Promise<InterviewReport> {
  const raw = await input.chat.complete({
    temperature: 0.3,
    json: true,
    thinking: true,
    messages: [
      {
        role: "system",
        content: `根据面试对话写结论。返回 JSON：
{"mastery":"知识掌握情况","weakPoints":["薄弱知识点"],"suggestions":["建议继续学习"],"summary":"总评"}
中文，具体，不要空话。`,
      },
      {
        role: "user",
        content: `笔记：${input.title}\n${input.history.map((item) => `${item.role}: ${item.content}`).join("\n")}`,
      },
    ],
  });
  const parsed = parseJsonFromModel<InterviewReport>(raw);
  return {
    mastery: parsed.mastery ?? "",
    weakPoints: parsed.weakPoints ?? [],
    suggestions: parsed.suggestions ?? [],
    summary: parsed.summary ?? "",
  };
}
