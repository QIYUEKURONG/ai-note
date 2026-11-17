"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fittedImageSize } from "./zoom-image";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 5;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function NoteImagePreview(props: { src: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setFitted(null);
  }, [props.src]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

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

  function measure(image: HTMLImageElement) {
    const stage = stageRef.current?.getBoundingClientRect();
    const maxW = Math.max(1, (stage?.width ?? window.innerWidth) - 48);
    const maxH = Math.max(1, (stage?.height ?? window.innerHeight) - 24);
    setFitted(fittedImageSize(image.naturalWidth, image.naturalHeight, maxW, maxH));
  }

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) measure(image);
  }, [props.src]);

  const width = fitted ? Math.round(fitted.width * zoom) : undefined;

  return createPortal(
    <div className="lightbox note-preview" role="dialog" aria-modal="true" aria-label="图片预览">
      <div
        className="lightbox-stage"
        ref={stageRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div className="note-preview-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={props.src}
            alt="放大预览"
            data-fitted={fitted ? "true" : undefined}
            style={width ? { width, maxWidth: "none", maxHeight: "none" } : undefined}
            onLoad={(event) => measure(event.currentTarget)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
      <div className="lightbox-bar">
        <button type="button" className="btn ghost" onClick={() => setZoom((value) => clampZoom(value / 1.25))}>
          缩小
        </button>
        <button type="button" className="btn ghost" onClick={() => setZoom(1)}>
          适合屏幕
        </button>
        <button type="button" className="btn ghost" onClick={() => setZoom((value) => clampZoom(value * 1.25))}>
          放大
        </button>
        <button type="button" className="btn" onClick={props.onClose}>
          关闭
        </button>
      </div>
    </div>,
    document.body,
  );
}
