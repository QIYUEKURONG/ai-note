"use client";

import { useEffect, useRef } from "react";

export function DropdownPanel(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!ref.current || ref.current.contains(target)) return;
      const host = ref.current.closest(".tb-dropdown");
      if (host && host.contains(target)) return;
      props.onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      ref={ref}
      className={`dropdown-panel ${props.align === "right" ? "align-right" : ""}`}
      style={{ width: props.width ?? 360 }}
    >
      <div className="dropdown-panel-head">
        <strong>{props.title}</strong>
        <button type="button" className="icon-btn" onClick={props.onClose} aria-label="关闭">
          ✕
        </button>
      </div>
      <div className="dropdown-panel-body">{props.children}</div>
    </div>
  );
}
