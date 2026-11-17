import Image from "@tiptap/extension-image";

export const MIN_IMAGE_WIDTH = 120;
export const MAX_IMAGE_WIDTH = 960;
export const NOTE_IMAGE_PREVIEW_EVENT = "mindbook:preview-image";

export function nextImageWidth(current: number, direction: "in" | "out"): number {
  const next = direction === "in" ? current * 1.25 : current * 0.8;
  return Math.round(Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, next)));
}

/** True when growing the inline image would stay inside the paper column. */
export function inlineGrowthVisible(renderedWidth: number, columnWidth: number): boolean {
  if (renderedWidth <= 0 || columnWidth <= 0) return true;
  return renderedWidth < columnWidth - 8;
}

export function fittedImageSize(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const maxW = Math.max(1, viewportWidth);
  const maxH = Math.max(1, viewportHeight);
  if (naturalWidth <= 0 || naturalHeight <= 0) return { width: Math.round(maxW), height: Math.round(maxH) };
  const scale = Math.min(maxW / naturalWidth, maxH / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

export function requestImagePreview(src: string) {
  if (!src || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTE_IMAGE_PREVIEW_EVENT, { detail: { src } }));
}

function zoomButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "note-image-zoom-btn";
  button.textContent = label;
  button.addEventListener("mousedown", (event) => event.preventDefault());
  return button;
}

export const ZoomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-width");
          const value = raw ? Number(raw) : NaN;
          return Number.isFinite(value) ? value : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { "data-width": String(attributes.width) };
        },
      },
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "note-image";
      const img = document.createElement("img");
      img.draggable = false;
      const controls = document.createElement("div");
      controls.className = "note-image-zoom";
      const shrink = zoomButton("缩小");
      const grow = zoomButton("放大");
      controls.append(shrink, grow);
      dom.append(img, controls);

      img.title = "点击放大";
      img.alt = img.alt || "笔记图片";

      const apply = (current: typeof node) => {
        img.src = String(current.attrs.src ?? "");
        const alt = String(current.attrs.alt ?? "");
        if (alt) img.alt = alt;
        const width = Number(current.attrs.width);
        if (width > 0) dom.style.width = `${width}px`;
        else dom.style.removeProperty("width");
      };
      apply(node);

      const openPreview = () => {
        const src = img.currentSrc || img.src;
        if (src) requestImagePreview(src);
      };
      img.addEventListener("click", (event) => {
        event.preventDefault();
        openPreview();
      });

      const resize = (direction: "in" | "out") => {
        const pos = getPos();
        if (typeof pos !== "number" || editor.isDestroyed) return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current) return;
        const rendered = img.getBoundingClientRect().width;
        const column = dom.parentElement?.clientWidth ?? 0;
        if (direction === "in" && !inlineGrowthVisible(rendered, column)) {
          openPreview();
          return;
        }
        const base = Number(current.attrs.width) || rendered || 320;
        const width = nextImageWidth(base, direction);
        if (direction === "in" && width <= base) {
          openPreview();
          return;
        }
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, width }),
        );
      };
      shrink.addEventListener("click", (event) => {
        event.preventDefault();
        resize("out");
      });
      grow.addEventListener("click", (event) => {
        event.preventDefault();
        resize("in");
      });

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "image") return false;
          apply(updated);
          return true;
        },
        stopEvent(event) {
          return controls.contains(event.target as Node);
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
