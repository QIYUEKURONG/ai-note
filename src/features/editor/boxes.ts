import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import BulletList from "@tiptap/extension-bullet-list";
import Heading from "@tiptap/extension-heading";
import { TextSelection } from "@tiptap/pm/state";
import { calloutLabel, displayedCalloutLabel, sectionListIndexes, type BlockRef, type CalloutKind, type MarkerId } from "@/domain/blocks";

function storedCalloutLabel(kind: string, value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === calloutLabel(kind)) return null;
  return trimmed.slice(0, 40);
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "note",
        parseHTML: (element) => element.getAttribute("data-callout") || "note",
        renderHTML: (attributes) => {
          const kind = String(attributes.kind ?? "note");
          return {
            "data-callout": kind,
            class: `callout callout-${kind}`,
          };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => {
          const kind = element.getAttribute("data-callout") || "note";
          const label = element.getAttribute("data-label");
          return storedCalloutLabel(kind, label ?? "");
        },
        renderHTML: (attributes) => ({
          "data-label": displayedCalloutLabel(String(attributes.kind ?? "note"), attributes.label),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("aside");
      const label = document.createElement("span");
      label.className = "callout-label";
      label.contentEditable = "true";
      label.spellcheck = false;
      label.setAttribute("role", "textbox");
      label.setAttribute("aria-label", "框的标题");
      const body = document.createElement("div");
      body.className = "callout-body";
      dom.append(label, body);

      const paint = (current: typeof node) => {
        const kind = String(current.attrs.kind ?? "note");
        dom.dataset.callout = kind;
        dom.className = `callout callout-${kind}`;
        if (document.activeElement === label) return;
        const text = displayedCalloutLabel(kind, current.attrs.label);
        if (label.textContent !== text) label.textContent = text;
      };
      paint(node);

      const commit = () => {
        const pos = getPos();
        if (typeof pos !== "number" || editor.isDestroyed) return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current || current.type.name !== "callout") return;
        const kind = String(current.attrs.kind ?? "note");
        const stored = storedCalloutLabel(kind, label.textContent ?? "");
        if ((current.attrs.label ?? null) === stored) {
          if (!stored && document.activeElement !== label) label.textContent = calloutLabel(kind);
          return;
        }
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, label: stored }));
      };

      label.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          label.blur();
        }
      });
      label.addEventListener("paste", (event) => {
        event.preventDefault();
        const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ").trim();
        if (!text) return;
        document.execCommand("insertText", false, text);
      });
      label.addEventListener("input", commit);
      label.addEventListener("blur", commit);

      return {
        dom,
        contentDOM: body,
        update(updated) {
          if (updated.type.name !== "callout") return false;
          paint(updated);
          return true;
        },
        stopEvent(event) {
          return label.contains(event.target as globalThis.Node);
        },
        ignoreMutation(mutation) {
          return label.contains(mutation.target);
        },
      };
    };
  },
});

export const MarkedHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      parallel: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-parallel"),
        renderHTML: (attributes) => {
          if (!attributes.parallel) return {};
          return { "data-parallel": attributes.parallel };
        },
      },
    };
  },
});

export const MarkedBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      marker: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-marker"),
        renderHTML: (attributes) => {
          if (!attributes.marker) return {};
          return { "data-marker": attributes.marker };
        },
      },
    };
  },
});

function stampHeading(editor: Editor, pos: number, marker: MarkerId | null) {
  const { state, view } = editor;
  const heading = state.doc.nodeAt(pos);
  if (!heading || heading.type.name !== "heading") return;
  const $pos = state.doc.resolve(pos);
  const blocks: BlockRef[] = [];
  const positions: number[] = [];
  $pos.parent.forEach((node, offset) => {
    positions.push($pos.start() + offset);
    blocks.push({
      type: node.type.name,
      level: node.type.name === "heading" ? Number(node.attrs.level ?? 1) : undefined,
    });
  });
  const headingIndex = positions.indexOf(pos);
  if (headingIndex < 0) return;
  const targets = sectionListIndexes(blocks, headingIndex).map((index) => positions[index]);
  let tr = state.tr;
  for (const target of [...targets].reverse()) {
    const node = tr.doc.nodeAt(target);
    if (!node) continue;
    tr = tr.setNodeMarkup(target, undefined, { ...node.attrs, marker });
  }
  tr = tr.setNodeMarkup(pos, undefined, { ...heading.attrs, parallel: marker });
  if (!targets.length && marker) {
    const paragraph = state.schema.nodes.paragraph;
    const listItem = state.schema.nodes.listItem;
    const bulletList = state.schema.nodes.bulletList;
    if (paragraph && listItem && bulletList) {
      const list = bulletList.create({ marker }, listItem.create(null, paragraph.create()));
      const insertAt = pos + heading.nodeSize;
      tr = tr.insert(insertAt, list);
      const cursor = Math.min(insertAt + 3, tr.doc.content.size);
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor)));
    }
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

export function applyParallelMarker(editor: Editor, marker: MarkerId | null) {
  if (editor.isDestroyed) return;
  const { $from } = editor.state.selection;
  let listPos: number | null = null;
  let headingPos: number | null = null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "bulletList" && listPos === null) listPos = $from.before(depth);
    if (name === "heading" && headingPos === null) headingPos = $from.before(depth);
  }
  if (listPos !== null) {
    const node = editor.state.doc.nodeAt(listPos);
    if (!node) return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(listPos, undefined, { ...node.attrs, marker }));
    editor.view.focus();
    return;
  }
  if (headingPos !== null) {
    stampHeading(editor, headingPos, marker);
    return;
  }
  if (!editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
  if (!marker || !editor.isActive("bulletList")) return;
  editor.chain().focus().updateAttributes("bulletList", { marker }).run();
}

export function applyCallout(editor: Editor, kind: CalloutKind) {
  if (editor.isDestroyed) return;
  if (editor.isActive("callout", { kind })) {
    editor.chain().focus().lift("callout").run();
    return;
  }
  if (editor.isActive("callout")) {
    editor.chain().focus().updateAttributes("callout", { kind }).run();
    return;
  }
  if (editor.isActive("heading") && editor.state.selection.empty) {
    const { $from } = editor.state.selection;
    let depth = $from.depth;
    while (depth > 0 && $from.node(depth).type.name !== "heading") depth -= 1;
    if (depth > 0) {
      const pos = $from.after(depth);
      editor
        .chain()
        .focus()
        .insertContentAt(pos, {
          type: "callout",
          attrs: { kind },
          content: [{ type: "paragraph" }],
        })
        .run();
      const node = editor.state.doc.nodeAt(pos);
      if (node?.type.name === "callout") {
        editor.chain().focus().setTextSelection(Math.min(pos + 2, editor.state.doc.content.size)).run();
      }
      return;
    }
  }
  const wrapped = editor.chain().focus().wrapIn("callout", { kind }).run();
  if (!wrapped) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "callout",
        attrs: { kind },
        content: [{ type: "paragraph" }],
      })
      .run();
  }
}
