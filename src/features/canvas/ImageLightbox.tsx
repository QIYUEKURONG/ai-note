"use client";

import { mediaUrl } from "@/lib/client";
import type { HungItem } from "./PaperStage";

export function ImageLightbox(props: {
  image: HungItem;
  onClose: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
}) {
  const src = mediaUrl(props.image.filePath);
  return (
    <div className="lightbox">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="原图预览" />
      <div className="lightbox-bar">
        <a className="btn ghost" href={src} target="_blank" rel="noreferrer">
          查看原图
        </a>
        <a className="btn ghost" href={src} download>
          下载
        </a>
        <button className="btn ghost" onClick={props.onRegenerate}>
          重新生成
        </button>
        <button className="btn danger" onClick={props.onDelete}>
          删除
        </button>
        <button className="btn" onClick={props.onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
