"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedImageRow, ImagePinRow } from "@/db/schema";
import {
  connectorPoints,
  layoutToPin,
  pinToLayout,
  type ImagePinPosition,
} from "@/domain/pins";
import { mediaUrl } from "@/lib/client";
import { HungImage } from "./HungImage";

export type HungItem = GeneratedImageRow & { pin: ImagePinRow | null };

export function PaperStage(props: {
  themeVars: Record<string, string>;
  images: HungItem[];
  children: React.ReactNode;
  onMovePin: (pinId: string, position: ImagePinPosition) => void;
  onOpenImage: (image: HungItem) => void;
}) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [paperSize, setPaperSize] = useState({ width: 720, height: 900 });

  useEffect(() => {
    const node = paperRef.current;
    if (!node) return;
    const sync = () =>
      setPaperSize({ width: node.offsetWidth, height: node.offsetHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hanging = useMemo(
    () =>
      props.images
        .filter((item) => item.pin)
        .map((item) => {
          const pin = item.pin!;
          const position: ImagePinPosition = {
            edge: pin.edge as ImagePinPosition["edge"],
            t: pin.t,
            offsetPx: pin.offsetPx,
            scale: pin.scale,
            zIndex: pin.zIndex,
          };
          const layout = pinToLayout(position, paperSize.width, paperSize.height);
          return { item, pin: position, layout, pinId: pin.id };
        }),
    [props.images, paperSize],
  );

  return (
    <div className={`paper-stage ${hanging.length ? "has-pins" : ""}`} style={props.themeVars}>
      <div className="paper-origin">
        <svg className="pin-line" aria-hidden>
          {hanging.map(({ pin, layout, pinId }) => {
            const line = connectorPoints(pin, layout, paperSize.width, paperSize.height);
            return (
              <line
                key={pinId}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(44,36,27,0.35)"
                strokeWidth="1"
              />
            );
          })}
        </svg>
        {hanging.map(({ item, layout, pin, pinId }) => (
          <HungImage
            key={item.id}
            src={mediaUrl(item.filePath)}
            layout={layout}
            zIndex={pin.zIndex}
            onClick={() => props.onOpenImage(item)}
            onDrag={(x, y) => {
              const next = layoutToPin(
                x,
                y,
                paperSize.width,
                paperSize.height,
                pin.scale,
                pin.zIndex,
              );
              props.onMovePin(pinId, next);
            }}
            onScale={(scale) => {
              props.onMovePin(pinId, { ...pin, scale });
            }}
          />
        ))}
        <div className="paper" ref={paperRef}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
