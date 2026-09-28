export const IMAGE_STYLES = [
  { id: "warm_daily", label: "温馨日常" },
  { id: "cute_cartoon", label: "可爱卡通" },
  { id: "business_minimal", label: "商务简约" },
  { id: "vintage", label: "复古怀旧" },
  { id: "sketch_comic", label: "简笔漫画" },
  { id: "watercolor", label: "水彩插画" },
  { id: "pixel", label: "像素风" },
  { id: "ink_wash", label: "国风水墨" },
  { id: "poster", label: "海报风" },
  { id: "pencil", label: "铅笔素描" },
  { id: "anime", label: "日系动漫" },
  { id: "ai_tools", label: "AI工具风" },
  { id: "futuristic", label: "未来科技" },
  { id: "narrative", label: "叙事插画" },
] as const;

export type ImageStyleId = (typeof IMAGE_STYLES)[number]["id"];

export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1", size: "2048x2048" },
  { id: "4:3", label: "4:3", size: "2304x1728" },
  { id: "3:4", label: "3:4", size: "1728x2304" },
  { id: "16:9", label: "16:9", size: "2560x1440" },
  { id: "9:16", label: "9:16", size: "1440x2560" },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export const DENSITY_OPTIONS = [
  { id: "low", label: "疏朗" },
  { id: "medium", label: "适中" },
  { id: "high", label: "信息密集" },
] as const;

export const USAGE_OPTIONS = [
  { id: "cover", label: "封面" },
  { id: "explain", label: "讲解配图" },
  { id: "review", label: "复习卡片" },
  { id: "poster", label: "海报" },
] as const;

export const CARD_GRIDS = [6, 9, 12, 36] as const;
export type CardGrid = (typeof CARD_GRIDS)[number];

export const CARD_DENSITIES = [
  { id: "detailed", label: "详细清单" },
  { id: "medium", label: "中等清单" },
  { id: "long", label: "长清单" },
] as const;
