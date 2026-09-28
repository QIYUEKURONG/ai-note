export type PinEdge = "left" | "right" | "top";

export type ImagePinPosition = {
  edge: PinEdge;
  t: number;
  offsetPx: number;
  scale: number;
  zIndex: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function defaultPinForIndex(index: number): ImagePinPosition {
  const edges: PinEdge[] = ["right", "left", "top"];
  const edge = edges[index % edges.length];
  const slot = Math.floor(index / edges.length);
  return {
    edge,
    t: clamp(0.22 + slot * 0.24, 0.12, 0.88),
    offsetPx: 28,
    scale: 1,
    zIndex: index + 1,
  };
}

export type PinLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function pinToLayout(
  pin: ImagePinPosition,
  paperWidth: number,
  paperHeight: number,
  baseSize = 168,
): PinLayout {
  const width = baseSize * pin.scale;
  const height = baseSize * pin.scale * 0.75;
  if (pin.edge === "top") {
    return {
      left: pin.t * paperWidth - width / 2,
      top: -pin.offsetPx - height,
      width,
      height,
    };
  }
  if (pin.edge === "left") {
    return {
      left: -pin.offsetPx - width,
      top: pin.t * paperHeight - height / 2,
      width,
      height,
    };
  }
  return {
    left: paperWidth + pin.offsetPx,
    top: pin.t * paperHeight - height / 2,
    width,
    height,
  };
}

export function layoutToPin(
  x: number,
  y: number,
  paperWidth: number,
  paperHeight: number,
  scale: number,
  zIndex: number,
  baseSize = 168,
): ImagePinPosition {
  const width = baseSize * scale;
  const height = baseSize * scale * 0.75;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const distLeft = Math.abs(cx - 0);
  const distRight = Math.abs(cx - paperWidth);
  const distTop = Math.abs(cy - 0);
  const nearest = Math.min(distLeft, distRight, distTop);
  if (nearest === distTop && cy < paperHeight * 0.28) {
    return {
      edge: "top",
      t: clamp(cx / paperWidth, 0.08, 0.92),
      offsetPx: clamp(-y - height, 12, 120),
      scale,
      zIndex,
    };
  }
  if (distLeft < distRight) {
    return {
      edge: "left",
      t: clamp(cy / paperHeight, 0.08, 0.92),
      offsetPx: clamp(-x - width, 12, 160),
      scale,
      zIndex,
    };
  }
  return {
    edge: "right",
    t: clamp(cy / paperHeight, 0.08, 0.92),
    offsetPx: clamp(x - paperWidth, 12, 160),
    scale,
    zIndex,
  };
}

export function connectorPoints(
  pin: ImagePinPosition,
  layout: PinLayout,
  paperWidth: number,
  paperHeight: number,
): { x1: number; y1: number; x2: number; y2: number } {
  if (pin.edge === "top") {
    return {
      x1: layout.left + layout.width / 2,
      y1: layout.top + layout.height,
      x2: pin.t * paperWidth,
      y2: 0,
    };
  }
  if (pin.edge === "left") {
    return {
      x1: layout.left + layout.width,
      y1: layout.top + layout.height / 2,
      x2: 0,
      y2: pin.t * paperHeight,
    };
  }
  return {
    x1: layout.left,
    y1: layout.top + layout.height / 2,
    x2: paperWidth,
    y2: pin.t * paperHeight,
  };
}
