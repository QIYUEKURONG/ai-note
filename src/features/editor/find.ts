import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const findPluginKey = new PluginKey("note-find");

export type FindState = { query: string; active: number };

/** Case-insensitive hits. Indexes stay valid when lowercasing does not change length. */
export function findInText(text: string, query: string): Array<{ start: number; end: number }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hay = text.toLowerCase();
  if (hay.length !== text.length || needle.length !== query.trim().length) return [];
  const hits: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    hits.push({ start: at, end: at + needle.length });
    from = at + needle.length;
  }
  return hits;
}

export function findExtension(findRef: { current: FindState }) {
  return Extension.create({
    name: "noteFind",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: findPluginKey,
          props: {
            decorations(state) {
              const query = findRef.current.query.trim();
              if (!query) return DecorationSet.empty;
              const active = findRef.current.active;
              const decos: Decoration[] = [];
              let index = 0;
              state.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;
                for (const hit of findInText(node.text, query)) {
                  decos.push(
                    Decoration.inline(pos + hit.start, pos + hit.end, {
                      class: index === active ? "find-hit is-current" : "find-hit",
                    }),
                  );
                  index += 1;
                }
              });
              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}
