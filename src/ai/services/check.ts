import type { ChatModel } from "../models";
import { parseJsonFromModel } from "../json";

export type GeneratedQuestion = {
  type: "true-false" | "multiple-choice" | "short-answer" | "scenario";
  difficulty: "basic" | "understanding" | "application";
  prompt: string;
  options?: string[];
  expectedPoints: string[];
  knowledgePoint: string;
};

export type AnswerEvaluation = {
  correct: string[];
  incorrect: string[];
  missing: string[];
  score: number;
  comment: string;
};

export async function generateCheckQuestions(input: {
  chat: ChatModel;
  title: string;
  content: string;
}): Promise<GeneratedQuestion[]> {
  const raw = await input.chat.complete({
    temperature: 0.4,
    json: true,
    messages: [
      {
        role: "system",
        content: `你是学习检测出题器，目的是检测用户是否真的理解笔记，不是刁难。
返回 JSON：{"questions":[...]}。
至少 4 题，覆盖 true-false, multiple-choice, short-answer, scenario。
difficulty 只能是 basic, understanding, application。
multiple-choice 必须有 options 数组。expectedPoints 是采分点。knowledgePoint 是知识点名。中文。`,
      },
      {
        role: "user",
        content: `标题：${input.title}\n笔记：\n${input.content.slice(0, 8000)}`,
      },
    ],
  });
  const parsed = parseJsonFromModel<{ questions: GeneratedQuestion[] }>(raw);
  return (parsed.questions ?? []).slice(0, 8);
}

export async function evaluateAnswer(input: {
  chat: ChatModel;
  question: GeneratedQuestion;
  answer: string;
}): Promise<AnswerEvaluation> {
  const raw = await input.chat.complete({
    temperature: 0.2,
    json: true,
    thinking: true,
    messages: [
      {
        role: "system",
        content: `评价用户是否理解该问题。返回 JSON：
{"correct":["..."],"incorrect":["..."],"missing":["..."],"score":0-100,"comment":"..."}
分数是 0 到 100 的整数。中文。`,
      },
      {
        role: "user",
        content: `题目：${input.question.prompt}\n题型：${input.question.type}\n采分点：${input.question.expectedPoints.join("；")}\n用户回答：${input.answer}`,
      },
    ],
  });
  const parsed = parseJsonFromModel<AnswerEvaluation>(raw);
  return {
    correct: parsed.correct ?? [],
    incorrect: parsed.incorrect ?? [],
    missing: parsed.missing ?? [],
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    comment: parsed.comment ?? "",
  };
}
