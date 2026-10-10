"use client";

import { useEffect, useRef, useState } from "react";
import { parseDocument, type TipTapDoc, type TipTapNode } from "@/lib/document";
import { mediaUrl } from "@/lib/client";
import {
  downloadTextFile,
  exportFilename,
  noteToHtml,
  noteToMarkdown,
  noteToPlainText,
  printHtml,
} from "./export-note";

declare global {
  interface Window {
    mindbookExportDone?: (message: string) => void;
    webkit?: {
      messageHandlers?: {
        mindbook?: { postMessage: (body: unknown) => void };
      };
    };
  }
}

function absoluteSrc(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
  if (src.startsWith("/") && typeof window !== "undefined") return `${window.location.origin}${src}`;
  return src;
}

function withAbsoluteImages(doc: TipTapDoc): TipTapDoc {
  const map = (node: TipTapNode): TipTapNode => {
    if (node.type === "image") {
      return { ...node, attrs: { ...node.attrs, src: absoluteSrc(String(node.attrs?.src ?? "")) } };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(map) };
  };
  return { ...doc, content: (doc.content ?? []).map(map) };
}

function sendToApp(body: { kind: string; filename: string; content?: string; html?: string }): boolean {
  const bridge = window.webkit?.messageHandlers?.mindbook;
  if (!bridge) return false;
  bridge.postMessage(body);
  return true;
}

export function ExportMenu(props: {
  title: string;
  contentJson: string;
  images: Array<{ filePath: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.mindbookExportDone = (message: string) => setNotice(message);
    return () => {
      delete window.mindbookExportDone;
    };
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function docAndImages() {
    const doc = withAbsoluteImages(parseDocument(props.contentJson));
    const imageSrcs = props.images.map((image) => absoluteSrc(mediaUrl(image.filePath)));
    return { doc, imageSrcs };
  }

  function save(kind: "md" | "html" | "txt") {
    const { doc, imageSrcs } = docAndImages();
    const filename =
      kind === "md"
        ? exportFilename(props.title, "md")
        : kind === "html"
          ? exportFilename(props.title, "html")
          : exportFilename(props.title, "txt");
    const content =
      kind === "md"
        ? noteToMarkdown(props.title, doc, imageSrcs)
        : kind === "html"
          ? noteToHtml(props.title, doc, imageSrcs)
          : noteToPlainText(props.title, doc);
    setNotice("正在保存…");
    setOpen(false);
    if (sendToApp({ kind: "file", filename, content })) return;
    downloadTextFile(filename, content, kind === "html" ? "text/html" : kind === "md" ? "text/markdown" : "text/plain");
    setNotice("已开始下载");
  }

  function savePdf() {
    const { doc, imageSrcs } = docAndImages();
    const html = noteToHtml(props.title, doc, imageSrcs);
    setNotice("正在生成 PDF…");
    setOpen(false);
    if (sendToApp({ kind: "pdf", filename: exportFilename(props.title, "pdf"), html })) return;
    printHtml(html);
    setNotice("请在打印窗口里选择「存储为 PDF」");
  }

  return (
    <div className="appearance-anchor" ref={rootRef}>
      <button
        type="button"
        className={`text-btn ${open ? "is-on" : ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        导出
      </button>
      {open ? (
        <div className="export-menu" role="menu">
          <button type="button" onClick={savePdf}>
            PDF
            <small>保存到「下载」并打开</small>
          </button>
          <button type="button" onClick={() => save("md")}>
            Markdown
            <small>保存 .md</small>
          </button>
          <button type="button" onClick={() => save("html")}>
            HTML
            <small>保存网页</small>
          </button>
          <button type="button" onClick={() => save("txt")}>
            纯文本
            <small>保存 .txt</small>
          </button>
        </div>
      ) : null}
      {notice ? <div className="export-toast">{notice}</div> : null}
    </div>
  );
}
