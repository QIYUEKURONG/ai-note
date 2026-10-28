"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/client";
import type { HungItem } from "./PaperStage";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function ImageLightbox(props: {
  image: HungItem;
  notes: Array<{ id: string; title: string }>;
  onClose: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onInsert: (noteId: string) => void;
}) {
  const src = mediaUrl(props.image.filePath);
  const stageRef = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [props.image.id]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((value) => clampZoom(value * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  async function copyImage() {
    const response = await fetch(src);
    const blob = await response.blob();
    const type = blob.type || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    setCopied(true);
  }

  const fitted = zoom <= 1;

  return (
    <div className="lightbox">
      <div className="lightbox-stage" ref={stageRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="原图预览"
          style={{
            width: `${Math.round(72 * zoom)}vw`,
            maxWidth: fitted ? "92vw" : "none",
            maxHeight: fitted ? "78vh" : "none",
          }}
        />
      </div>
      <div className="lightbox-bar">
        <button type="button" className="btn ghost" onClick={() => setZoom((value) => clampZoom(value / 1.25))}>
          缩小
        </button>
        <button type="button" className="btn ghost" onClick={() => setZoom(1)}>
          原始
        </button>
        <button type="button" className="btn ghost" onClick={() => setZoom((value) => clampZoom(value * 1.25))}>
          放大
        </button>
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
