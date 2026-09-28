"use client";

import { ASPECT_RATIOS, IMAGE_STYLES, type AspectRatioId, type ImageStyleId } from "@/domain/image-styles";
import type { VisualTypeId } from "@/domain/visual-types";
import { mediaUrl } from "@/lib/client";
import type { HungItem } from "@/features/canvas/PaperStage";

const FOCUS: Array<{
  style: ImageStyleId;
  visual: VisualTypeId;
  label: string;
  hint: string;
}> = [
  { style: "business_minimal", visual: "knowledge-card", label: "知识卡片", hint: "把要点收成一张卡片" },
  { style: "pencil", visual: "illustration", label: "手绘", hint: "铅笔线稿" },
  { style: "watercolor", visual: "illustration", label: "水彩", hint: "轻薄的颜色" },
  { style: "pixel", visual: "illustration", label: "像素", hint: "小格子里的图解" },
  { style: "business_minimal", visual: "illustration", label: "商务", hint: "干净、少装饰" },
  { style: "ink_wash", visual: "illustration", label: "国风", hint: "水墨留白" },
];

export function ImageStudio(props: {
  style: ImageStyleId;
  aspectRatio: AspectRatioId;
  visualType: VisualTypeId | "auto";
  onStyle: (id: ImageStyleId) => void;
  onAspect: (id: AspectRatioId) => void;
  onVisualType: (id: VisualTypeId | "auto") => void;
  onGenerate: () => void;
  generating: boolean;
  images: HungItem[];
  onOpenImage: (image: HungItem) => void;
  scoped?: boolean;
}) {
  const more = IMAGE_STYLES.filter((item) => !FOCUS.some((focus) => focus.style === item.id));

  return (
    <div className="image-page">
      <p className="mode-lead">
        {props.scoped
          ? "只根据选中的这段作图，不会用到笔记的其他内容。生成后挂在纸边。"
          : "根据这篇笔记出一张图。生成后会挂在正文纸边，点开可以看大图。"}
      </p>
      <div className="style-board">
        {FOCUS.map((item) => {
          const on =
            item.label === "知识卡片"
              ? props.visualType === "knowledge-card"
              : item.label === "商务"
                ? props.visualType === "illustration" && props.style === "business_minimal"
                : props.visualType === item.visual && props.style === item.style;
          return (
            <button
              key={item.label}
              type="button"
              className={`style-card style-${item.style} ${on ? "is-on" : ""}`}
              onClick={() => {
                props.onStyle(item.style);
                props.onVisualType(item.visual);
              }}
            >
              <span className="style-swatch" />
              <strong>{item.label}</strong>
              <em>{item.hint}</em>
            </button>
          );
        })}
      </div>
      <div className="image-tools">
        <div className="segment">
          {ASPECT_RATIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={props.aspectRatio === item.id ? "is-on" : ""}
              onClick={() => props.onAspect(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn" disabled={props.generating} onClick={props.onGenerate}>
          {props.generating ? "正在画…" : "生成并挂到纸边"}
        </button>
      </div>
      <div className="more-styles">
        {more.map((item) => (
          <button
            key={item.id}
            type="button"
            className={props.style === item.id && props.visualType !== "knowledge-card" ? "kind-pill is-on" : "kind-pill is-quiet"}
            onClick={() => {
              props.onStyle(item.id);
              props.onVisualType("illustration");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {props.images.length > 0 ? (
        <div className="image-rail">
          <header>已挂在这篇笔记上</header>
          <div>
            {props.images.map((image) => (
              <button key={image.id} type="button" className="hung-thumb" onClick={() => props.onOpenImage(image)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(image.filePath)} alt="" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mode-lead">还没有挂图。生成之后，回到笔记就能看到它挂在纸边。</p>
      )}
    </div>
  );
}
