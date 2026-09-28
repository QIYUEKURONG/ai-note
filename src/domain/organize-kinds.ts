export const ORGANIZE_KINDS = [
  { id: "markdown", label: "Markdown 整理" },
  { id: "one_sentence", label: "一句话总结" },
  { id: "three_sentences", label: "三句话总结" },
  { id: "tldr", label: "TL;DR" },
  { id: "structured", label: "结构化总结" },
  { id: "outline", label: "知识大纲" },
  { id: "mindmap", label: "思维导图结构" },
  { id: "faq", label: "FAQ" },
  { id: "knowledge_card", label: "知识卡片" },
  { id: "eli5", label: "小白解释" },
  { id: "expert", label: "专业解释" },
  { id: "highlights", label: "重点提炼" },
  { id: "comparison", label: "对比表" },
  { id: "timeline", label: "时间线" },
  { id: "process", label: "流程说明" },
] as const;

export type OrganizeKind = (typeof ORGANIZE_KINDS)[number]["id"];

export function isOrganizeKind(value: string): value is OrganizeKind {
  return ORGANIZE_KINDS.some((item) => item.id === value);
}

export function organizeKindLabel(kind: string): string {
  return ORGANIZE_KINDS.find((item) => item.id === kind)?.label ?? kind;
}
