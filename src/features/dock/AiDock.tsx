"use client";

const ACTIONS = [
  { id: "organize", label: "整理" },
  { id: "image", label: "生图" },
  { id: "check", label: "检测" },
  { id: "interview", label: "面试" },
] as const;

export type DockAction = (typeof ACTIONS)[number]["id"];

export function AiDock(props: { onOpen: (action: DockAction) => void; selection?: string }) {
  const preview = previewSelection(props.selection ?? "");
  return (
    <div className="ai-dock" onMouseDown={(event) => event.preventDefault()}>
      {preview ? <p className="selection-hint">已选中「{preview}」· 整理和生图只处理这段</p> : null}
      <div className="ai-dock-bar" role="toolbar" aria-label="笔记里的 AI">
        {ACTIONS.map((action) => (
          <button key={action.id} type="button" onClick={() => props.onOpen(action.id)}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function previewSelection(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > 18 ? `${flat.slice(0, 18)}…` : flat;
}
