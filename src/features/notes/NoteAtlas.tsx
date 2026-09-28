"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { masteryLabel, type SpaceSnapshot } from "@/domain/knowledge";
import { api } from "@/lib/client";

export function NoteAtlas(props: { noteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    void api<{ space: SpaceSnapshot }>("/api/space")
      .then((data) => setSpace(data.space))
      .catch(() => undefined);
  }, [open, props.noteId]);

  const points = space?.points.filter((point) => point.noteIds.includes(props.noteId)) ?? [];
  const shown = points.slice(0, 6);

  return (
    <>
      <button type="button" className={`text-btn ${open ? "is-on" : ""}`} onClick={() => setOpen((value) => !value)}>
        地图
      </button>
      {open ? (
        <div className="note-atlas">
          <p>这篇笔记上的知识点</p>
          {shown.length === 0 ? <small>生成地图之后，会显示在这里。</small> : null}
          <div className="note-chips">
            {shown.map((point) => (
              <span key={point.id}>
                {point.label}
                <i>{masteryLabel(point.mastery)}</i>
              </span>
            ))}
          </div>
          {points.length > shown.length ? <small>还有 {points.length - shown.length} 个</small> : null}
          <button type="button" className="text-btn" onClick={() => router.push(`/?note=${props.noteId}`)}>
            打开地图
          </button>
          <button type="button" className="text-btn" onClick={() => setOpen(false)}>
            收起
          </button>
        </div>
      ) : null}
    </>
  );
}
