import type { OrganizeKind } from "@/domain/organize-kinds";
import { organizeKindLabel } from "@/domain/organize-kinds";
import type { ChatModel } from "../models";
import { splitSpeculation } from "../json";

const KIND_INSTRUCTIONS: Record<OrganizeKind, string> = {
  markdown:
    "把笔记整理为结构清晰的 Markdown，保留事实，补齐小标题。命令、代码、配置、SQL 放进 ``` 围栏代码块。关键术语用 ==术语== 标出，每段不超过 3 处，不要整句高亮。",
  study_note:
    "整理成能直接复习的学习笔记。用 # 做大段、## 做小段，要点用 - 列表。命令、代码、配置放进 ``` 围栏并写上语言名。必须记住的术语、数字、结论用 ==词语== 包起来，每段最多 4 处。易错点单独放进引用块（> ）。不要编造原文没有的事实。",
  code_box:
    "把笔记里的代码、命令、配置、SQL、JSON、接口路径从句子里拆出来，各自放进 ``` 围栏代码块。每个代码块前用一句话说明它做什么。其余内容用小标题和列表保持简短。不要把代码留在普通段落里。",
  key_terms:
    "保留原文的结构和事实，不要改写成另一篇文章。用 ==词语== 标出真正要记住的术语、数字和结论，每段不超过 4 处。不要整句、整段高亮。可以补少量小标题。",
  one_sentence: "用一句话概括笔记核心。",
  three_sentences: "用三句话概括：是什么、为什么重要、关键机制。",
  tldr: "输出 TL;DR，不超过 80 字。",
  structured: "输出结构化总结，包含概念、机制、注意点和例子。",
  outline: "输出层级知识大纲。",
  mindmap: "输出思维导图结构，用缩进表示层级。",
  faq: "把内容整理成 FAQ。",
  knowledge_card: "整理成适合知识卡片的要点列表。",
  eli5: "用小白能懂的语言解释，避免行话。",
  expert: "用专业术语做深入解释，指出原理与边界。",
  highlights: "只提炼最重要的考点与易错点。",
  comparison: "若存在对比概念，输出 Markdown 对比表；否则说明没有可对比项。",
  timeline: "整理成时间线或演进顺序；若无线索则说明。",
  process: "整理成步骤化流程说明。",
};

export async function organizeNote(input: {
  chat: ChatModel;
  title: string;
  content: string;
  highlights: string[];
  kind: OrganizeKind;
  onlySelection?: boolean;
}): Promise<{ body: string; speculationSpansJson: string }> {
  const highlightBlock =
    input.highlights.length > 0
      ? `用户划出的重点：\n${input.highlights.map((item) => `- ${item}`).join("\n")}`
      : "用户没有划重点。";
  const keepImages = input.content.includes("[[图");
  const raw = await input.chat.complete({
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `你是 MindBook 的知识整理器。只基于用户给出的文字整理。
${input.onlySelection ? "你收到的只是笔记里被选中的一段。只整理这一段，不要补写、不要概括选区以外的内容。" : "只基于用户笔记内容整理。"}
如果某句话不是原文直接支持、而是你的推断，必须在该句前加上 [AI推测]。
不要假装那是用户写过的内容。使用中文。整理方式：${organizeKindLabel(input.kind)}。
${KIND_INSTRUCTIONS[input.kind]}
${keepImages ? "原文中的 [[图1]]、[[图2]] 是用户插入的图片。必须原样保留这些标记，各自单独成行，放在相关内容后面。不要删除，不要用文字描述代替图片。" : "不要自己编造 [[图1]] 这种标记。"}`,
      },
      {
        role: "user",
        content: `标题：${input.title}\n\n${input.onlySelection ? "选中片段" : "笔记"}：\n${input.content || "（空）"}\n\n${highlightBlock}`,
      },
    ],
  });
  const split = splitSpeculation(raw);
  return {
    body: split.body,
    speculationSpansJson: JSON.stringify(split.spans),
  };
}
