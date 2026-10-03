"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedImageRow, ImagePinRow } from "@/db/schema";
import {
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
        {hanging.map(({ item, layout, pin, pinId }, index) => (
          <div
            key={item.id}
            className="hung-rail"
            style={{ left: layout.left, width: layout.width, zIndex: pin.zIndex + 3 }}
          >
          <HungImage
            src={mediaUrl(item.filePath)}
            layout={layout}
            stickTop={72 + index * (Math.min(layout.height, 132) + 14)}
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
          </div>
        ))}
        <div className="paper" ref={paperRef}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
