"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { HIGHLIGHT_COLORS, parseDocument, type TipTapDoc } from "@/lib/document";
import type { ReviewMark } from "@/domain/review";

declare global {
  interface Window {
    mindbookInsertImage?: (src: string) => void;
  }
}

export type EditorReview = {
  marks: ReviewMark[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

const reviewPluginKey = new PluginKey("review-marks");

function reviewExtension(reviewRef: { current: EditorReview | null }) {
  return Extension.create({
    name: "reviewMarks",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: reviewPluginKey,
          props: {
            decorations(state) {
              const review = reviewRef.current;
              const open = review?.marks.filter((mark) => mark.status === "open") ?? [];
              if (!open.length) return DecorationSet.empty;
              const pieces: Array<{ from: number; text: string }> = [];
              state.doc.descendants((node, pos) => {
                if (node.isText && node.text) pieces.push({ from: pos, text: node.text });
              });
              const joined = pieces.map((piece) => piece.text).join("");
              const decos = [];
              for (const mark of open) {
                const needle = mark.quote.trim();
                const index = needle ? joined.indexOf(needle) : -1;
                if (index < 0) continue;
                const end = index + needle.length;
                let cursor = 0;
                for (const piece of pieces) {
                  const pieceStart = cursor;
                  const pieceEnd = cursor + piece.text.length;
                  const overlapStart = Math.max(index, pieceStart);
                  const overlapEnd = Math.min(end, pieceEnd);
                  if (overlapStart < overlapEnd) {
                    decos.push(
                      Decoration.inline(
                        piece.from + (overlapStart - pieceStart),
                        piece.from + (overlapEnd - pieceStart),
                        {
                          class: `review-mark review-${mark.kind}${review?.activeId === mark.id ? " is-active" : ""}`,
                          "data-review-id": mark.id,
                        },
                      ),
                    );
                  }
                  cursor = pieceEnd;
                }
              }
              return DecorationSet.create(state.doc, decos);
            },
            handleClick(_view, _pos, event) {
              const target = event.target;
              if (!(target instanceof Element)) return false;
              const id = target.closest("[data-review-id]")?.getAttribute("data-review-id");
              if (!id) return false;
              reviewRef.current?.onSelect(id);
              return true;
            },
          },
        }),
      ];
    },
  });
}

type StyleId = "title" | "heading" | "subheading" | "body" | "quote" | "code";

const STYLES: Array<{ id: StyleId; label: string; preview: string }> = [
  { id: "title", label: "标题", preview: "Title" },
  { id: "heading", label: "一级标题", preview: "Heading" },
  { id: "subheading", label: "二级标题", preview: "Subheading" },
  { id: "body", label: "正文", preview: "Body" },
  { id: "quote", label: "引用", preview: "Quote" },
  { id: "code", label: "代码块", preview: "Code" },
];

function clipboardImage(data: DataTransfer | null): File | null {
  if (!data) return null;
  const fromFiles = Array.from(data.files).find((file) => file.type.startsWith("image/"));
  if (fromFiles) return fromFiles;
  for (const item of Array.from(data.items)) {
    if (item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

async function uploadPastedImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/media", { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || "图片没有存下来");
  return data.url;
}

function insertUploadedImage(view: EditorView, file: File) {
  const image = view.state.schema.nodes.image;
  if (!image) return;
  void uploadPastedImage(file)
    .then((src) => {
      if (view.isDestroyed) return;
      view.dispatch(view.state.tr.replaceSelectionWith(image.create({ src })));
      view.focus();
    })
    .catch(() => {
      // Leave the note unchanged when the file cannot be stored.
    });
}

const storingImages = new Set<string>();

function storeTemporaryImages(view: EditorView) {
  const sources: string[] = [];
  view.state.doc.descendants((node) => {
    if (node.type.name !== "image") return;
    const src = String(node.attrs.src ?? "");
    if ((src.startsWith("blob:") || src.startsWith("data:image/")) && !storingImages.has(src)) {
      sources.push(src);
    }
  });
  for (const src of sources) {
    storingImages.add(src);
    void fetch(src)
      .then((response) => response.blob())
      .then((blob) => uploadPastedImage(new File([blob], "screenshot.png", { type: blob.type || "image/png" })))
      .then((url) => {
        if (view.isDestroyed) return;
        let pos = -1;
        view.state.doc.descendants((node, position) => {
          if (node.type.name === "image" && node.attrs.src === src) pos = position;
        });
        const node = pos >= 0 ? view.state.doc.nodeAt(pos) : null;
        if (!node || pos < 0) return;
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url }));
      })
      .finally(() => storingImages.delete(src));
  }
}

const persistImages = Extension.create({
  name: "persistImages",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view() {
          return {
            update(view) {
              queueMicrotask(() => {
                if (!view.isDestroyed) storeTemporaryImages(view);
              });
            },
          };
        },
      }),
    ];
  },
});

export function plainSelection(state: EditorState): string {
  const { from, to, empty } = state.selection;
  if (empty) return "";
  let text = "";
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.text.length);
    if (start < end) text += node.text.slice(start - pos, end - pos);
  });
  const trimmed = text.trim();
  return trimmed.length >= 2 ? trimmed : "";
}

export function BlockEditor(props: {
  contentJson: string;
  onChange: (doc: TipTapDoc) => void;
  onSelectionChange?: (text: string) => void;
  review?: EditorReview | null;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const styleRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<EditorReview | null>(props.review ?? null);
  reviewRef.current = props.review ?? null;
  const selectionCb = useRef(props.onSelectionChange);
  selectionCb.current = props.onSelectionChange;
  const reviewSignature = `${props.review?.activeId ?? ""}|${
    props.review?.marks.map((mark) => `${mark.id}:${mark.status}:${mark.quote}`).join("||") ?? ""
  }`;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, dropcursor: false }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      persistImages,
      Placeholder.configure({ placeholder: "写下你真正理解过的内容…" }),
      reviewExtension(reviewRef),
    ],
    content: parseDocument(props.contentJson),
    editorProps: {
      attributes: { class: "mind-editor" },
      handlePaste(view, event) {
        const file = clipboardImage(event.clipboardData);
        if (!file) return false;
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text.trim()) return false;
        event.preventDefault();
        insertUploadedImage(view, file);
        return true;
      },
      handleDrop(view, event) {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
          item.type.startsWith("image/"),
        );
        if (!file) return false;
        event.preventDefault();
        insertUploadedImage(view, file);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      props.onChange(instance.getJSON() as TipTapDoc);
    },
    onSelectionUpdate: ({ editor: instance }) => {
      selectionCb.current?.(plainSelection(instance.state));
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    selectionCb.current?.(plainSelection(editor.state));
    const previous = window.mindbookInsertImage;
    window.mindbookInsertImage = (src: string) => {
      if (!src || editor.isDestroyed) return;
      editor.chain().focus().setImage({ src }).run();
    };
    return () => {
      if (window.mindbookInsertImage) delete window.mindbookInsertImage;
      if (previous) window.mindbookInsertImage = previous;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      editor.view.dispatch(editor.state.tr.setMeta(reviewPluginKey, reviewSignature));
    } catch {
      // Editor view is not mounted yet.
    }
  }, [editor, reviewSignature]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (styleRef.current && !styleRef.current.contains(target)) setStyleOpen(false);
      if (highlightRef.current && !highlightRef.current.contains(target)) setHighlightOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!editor) return null;
  const ed = editor;

  function currentStyle(): StyleId {
    if (ed.isActive("heading", { level: 1 })) return "title";
    if (ed.isActive("heading", { level: 2 })) return "heading";
    if (ed.isActive("heading", { level: 3 })) return "subheading";
    if (ed.isActive("blockquote")) return "quote";
    if (ed.isActive("codeBlock")) return "code";
    return "body";
  }

  function applyStyle(id: StyleId) {
    const chain = ed.chain().focus();
    if (id === "title") chain.setHeading({ level: 1 }).run();
    else if (id === "heading") chain.setHeading({ level: 2 }).run();
    else if (id === "subheading") chain.setHeading({ level: 3 }).run();
    else if (id === "quote") chain.setParagraph().toggleBlockquote().run();
    else if (id === "code") chain.setParagraph().toggleCodeBlock().run();
    else chain.setParagraph().run();
    setStyleOpen(false);
  }

  function setLink() {
    const href = window.prompt("链接地址", ed.getAttributes("link").href ?? "https://");
    if (href === null) return;
    if (!href) {
      ed.chain().focus().unsetLink().run();
      return;
    }
    ed.chain().focus().setLink({ href }).run();
  }

  function addImage() {
    const src = window.prompt("图片地址");
    if (src) ed.chain().focus().setImage({ src }).run();
  }

  const activeStyle = currentStyle();
  const activeStyleLabel = STYLES.find((item) => item.id === activeStyle)?.label ?? "正文";

  return (
    <>
      <div className="notes-toolbar">
        <div className="notes-toolbar-scroll">
          <div className="tb-dropdown" ref={styleRef}>
            <button
              type="button"
              className={`tb-btn tb-aa ${styleOpen ? "is-open" : ""}`}
              onClick={() => {
                setStyleOpen((v) => !v);
                setHighlightOpen(false);
              }}
              title="段落样式"
            >
              <span className="aa-mark">Aa</span>
              <span className="aa-label">{activeStyleLabel}</span>
              <span className="chev">▾</span>
            </button>
            {styleOpen ? (
              <div className="tb-menu style-menu">
                {STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`style-item style-${item.id} ${activeStyle === item.id ? "is-active" : ""}`}
                    onClick={() => applyStyle(item.id)}
                  >
                    <span className="style-preview">{item.preview}</span>
                    <span className="style-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`tb-btn ${ed.isActive("bold") ? "is-active" : ""}`}
            onClick={() => ed.chain().focus().toggleBold().run()}
            title="粗体"
          >
            B
          </button>
          <button
            type="button"
            className={`tb-btn ${ed.isActive("italic") ? "is-active" : ""}`}
            onClick={() => ed.chain().focus().toggleItalic().run()}
            title="斜体"
          >
            I
          </button>
          <button
            type="button"
            className={`tb-btn ${ed.isActive("strike") ? "is-active" : ""}`}
            onClick={() => ed.chain().focus().toggleStrike().run()}
            title="删除线"
          >
            S
          </button>
          <button
            type="button"
            className={`tb-btn ${ed.isActive("bulletList") ? "is-active" : ""}`}
            onClick={() => ed.chain().focus().toggleBulletList().run()}
            title="无序列表"
          >
            ≡
          </button>
          <button
            type="button"
            className={`tb-btn ${ed.isActive("orderedList") ? "is-active" : ""}`}
            onClick={() => ed.chain().focus().toggleOrderedList().run()}
            title="有序列表"
          >
            1.
          </button>
          <button type="button" className="tb-btn" onClick={() => ed.chain().focus().setHorizontalRule().run()} title="分割线">
            —
          </button>
          <button type="button" className="tb-btn" onClick={setLink} title="链接">
            链
          </button>
          <button type="button" className="tb-btn" onClick={addImage} title="插入图片">
            图
          </button>

          <div className="tb-dropdown" ref={highlightRef}>
            <button
              type="button"
              className={`tb-btn ${highlightOpen ? "is-open" : ""}`}
              onClick={() => {
                setHighlightOpen((v) => !v);
                setStyleOpen(false);
              }}
              title="高亮"
            >
              <span className="swatch" style={{ background: HIGHLIGHT_COLORS.yellow }} />
              <span className="chev">▾</span>
            </button>
            {highlightOpen ? (
              <div className="tb-menu highlight-menu">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                  <button
                    key={name}
                    type="button"
                    className="highlight-item"
                    onClick={() => {
                      ed.chain().focus().toggleHighlight({ color }).run();
                      setHighlightOpen(false);
                    }}
                  >
                    <span className="swatch lg" style={{ background: color }} />
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

      </div>
      <EditorContent editor={ed} />
    </>
  );
}
