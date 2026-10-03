"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/client";
import type { HungItem } from "./PaperStage";

export function ImageLightbox(props: {
  image: HungItem;
  notes: Array<{ id: string; title: string }>;
  onClose: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onInsert: (noteId: string) => void;
}) {
  const src = mediaUrl(props.image.filePath);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyImage() {
    const response = await fetch(src);
    const blob = await response.blob();
    const type = blob.type || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    setCopied(true);
  }

  return (
    <div className="lightbox">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="原图预览" />
      <div className="lightbox-bar">
        <button
          className="btn ghost"
          onClick={() => {
            setCopied(false);
            void copyImage().catch(() => setPicking(true));
          }}
        >
          {copied ? "已复制" : "复制图片"}
        </button>
        <button className="btn ghost" onClick={() => setPicking((open) => !open)}>
          插入到其他笔记
        </button>
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
        {picking ? (
          <div className="insert-menu">
            {props.notes.length === 0 ? (
              <button type="button" disabled>
                没有其他笔记
              </button>
            ) : (
              props.notes.map((note) => (
                <button key={note.id} type="button" onClick={() => props.onInsert(note.id)}>
                  {note.title || "未命名笔记"}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
