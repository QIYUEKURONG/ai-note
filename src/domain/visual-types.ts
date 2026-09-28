export const VISUAL_TYPES = [
  { id: "architecture", label: "架构图", keywords: ["架构", "组件", "消费者组", "集群", "模块", "分层"] },
  { id: "flowchart", label: "流程图", keywords: ["流程", "步骤", "状态机", "顺序", "如何"] },
  { id: "timeline", label: "时间线", keywords: ["演进", "版本", "年表", "历史", "发展"] },
  { id: "relation", label: "关系图", keywords: ["关系", "人物", "依赖", "交互"] },
  { id: "knowledge-card", label: "知识卡片", keywords: ["考点", "清单", "卡片", "要点", "总结"] },
  { id: "comparison", label: "对比信息图", keywords: ["对比", "区别", "优缺点", "vs", "versus"] },
  { id: "illustration", label: "插画", keywords: [] },
] as const;

export type VisualTypeId = (typeof VISUAL_TYPES)[number]["id"];

export function isVisualType(value: string): value is VisualTypeId {
  return VISUAL_TYPES.some((item) => item.id === value);
}

export function routeVisualType(text: string): VisualTypeId {
  const source = text.toLowerCase();
  let best: VisualTypeId = "illustration";
  let bestScore = 0;
  for (const type of VISUAL_TYPES) {
    if (type.id === "illustration") continue;
    const score = type.keywords.reduce((sum, word) => {
      return sum + (source.includes(word.toLowerCase()) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = type.id;
    }
  }
  return best;
}

export function parseVisualTypeResponse(raw: string): VisualTypeId | null {
  const match = raw.toLowerCase().match(
    /architecture|flowchart|timeline|relation|knowledge-card|comparison|illustration/,
  );
  return match ? (match[0] as VisualTypeId) : null;
}
