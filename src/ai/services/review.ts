import type { ChatModel } from "../models";
import { parseJsonFromModel } from "../json";
import { normalizeReviewDrafts, type ReviewDraft } from "@/domain/review";

export async function reviewNote(input: {
  chat: ChatModel;
  title: string;
  content: string;
}): Promise<ReviewDraft[]> {
  const raw = await input.chat.complete({
    temperature: 0.2,
    json: true,
    messages: [
      {
        role: "system",
        content: `你在批注一篇笔记，帮作者看清哪里错了、哪里没说完、哪里还值得往下想。
返回 JSON：{"marks":[{"quote":"...","kind":"error|incomplete|deepen","explanation":"...","suggestion":"..."}]}
kind 只能是：
- error：事实、逻辑或表述错误
- incomplete：这句话没说完，或关键条件缺失
- deepen：方向对，但需要进一步理解
quote 必须是笔记原文里连续出现的片段，尽量原样复制，长度 8 到 80 个字。
explanation 说明为什么标这里。suggestion 是可以直接替换 quote 的改写，不要加引号或序号。
最多 6 条，只标真正值得停下来的地方。没有问题就返回 {"marks":[]}。中文。`,
      },
      {
        role: "user",
        content: `标题：${input.title}\n笔记：\n${input.content.slice(0, 8000)}`,
      },
    ],
  });
  return normalizeReviewDrafts(parseJsonFromModel<unknown>(raw));
}
