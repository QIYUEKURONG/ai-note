"use client";

import { useRef } from "react";
import type { PinLayout } from "@/domain/pins";

export function HungImage(props: {
  src: string;
  layout: PinLayout;
  zIndex: number;
  onClick: () => void;
  onDrag: (x: number, y: number) => void;
  onScale: (scale: number) => void;
}) {
  const dragging = useRef(false);
  const origin = useRef({ x: 0, y: 0, left: 0, top: 0 });

  return (
    <div
      className="hung"
      style={{
        left: props.layout.left,
        top: props.layout.top,
        width: props.layout.width,
        height: props.layout.height,
        zIndex: props.zIndex + 3,
        transform: `rotate(${props.layout.left < 0 ? -2.2 : 1.6}deg)`,
      }}
      onPointerDown={(event) => {
        dragging.current = true;
        origin.current = {
          x: event.clientX,
          y: event.clientY,
          left: props.layout.left,
          top: props.layout.top,
        };
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        props.onDrag(
          origin.current.left + (event.clientX - origin.current.x),
          origin.current.top + (event.clientY - origin.current.y),
        );
      }}
      onPointerUp={(event) => {
        const moved =
          Math.abs(event.clientX - origin.current.x) + Math.abs(event.clientY - origin.current.y);
        dragging.current = false;
        if (moved < 4) props.onClick();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={props.src} alt="AI 生成图片" />
      <button
        type="button"
        className="resize-handle"
        aria-label="调整大小"
        onPointerDown={(event) => {
          event.stopPropagation();
          const startX = event.clientX;
          const startWidth = props.layout.width;
          const target = event.currentTarget;
          target.setPointerCapture(event.pointerId);
          const move = (moveEvent: PointerEvent) => {
            const nextWidth = Math.max(96, startWidth + (moveEvent.clientX - startX));
            props.onScale(nextWidth / 168);
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      />
    </div>
  );
}
