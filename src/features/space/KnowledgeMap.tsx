"use client";

import { useEffect, useState } from "react";
import { type SpaceEdge, type SpaceNote, type SpacePoint } from "@/domain/knowledge";

export function KnowledgeMap(props: {
  notes: SpaceNote[];
  points: SpacePoint[];
  edges: SpaceEdge[];
  selectedId: string | null;
  focusNoteId?: string | null;
  onOpenNote: (id: string) => void;
  onSelectPoint: (id: string) => void;
  onConfirmEdge: (id: string) => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(props.focusNoteId ?? null);

  useEffect(() => {
    if (props.focusNoteId) setFocusId(props.focusNoteId);
  }, [props.focusNoteId]);

  const focus =
    props.notes.find((note) => note.id === focusId) ??
    props.notes.find((note) => props.points.some((point) => point.noteIds.includes(note.id))) ??
    props.notes[0] ??
    null;
  const mine = focus ? props.points.filter((point) => point.noteIds.includes(focus.id)).slice(0, 8) : [];
  const placed = placeAround(mine);

  return (
    <div className="atlas">
      <div className="atlas-notes">
        {props.notes.slice(0, 12).map((note) => (
          <button
            key={note.id}
            type="button"
            className={focus?.id === note.id ? "is-on" : ""}
            onClick={() => setFocusId(note.id)}
          >
            {note.title || "未命名笔记"}
          </button>
        ))}
      </div>
      {focus ? (
        <div className="atlas-board">
          <svg className="knowledge-map is-focus" viewBox="0 0 760 460" role="img" aria-label="知识地图">
            <rect className="atlas-note" x="292" y="196" width="176" height="52" rx="16" />
            <text className="atlas-note-label" x="380" y="226">
              {(focus.title || "未命名笔记").slice(0, 8)}
            </text>
            {placed.map(({ point, x, y }) => (
              <line key={`link-${point.id}`} x1="380" y1="222" x2={x} y2={y} className="map-link faint" />
            ))}
            {placed.map(({ point, x, y }) => (
              <g
                key={point.id}
                className={`map-node is-point ${point.status} ${point.mastery} ${
                  props.selectedId === point.id ? "is-selected" : ""
                }`}
                transform={`translate(${x} ${y})`}
                onClick={() => props.onSelectPoint(point.id)}
              >
                <circle r="16" />
                <text y="34">{point.label.slice(0, 8)}</text>
              </g>
            ))}
          </svg>
          <div className="atlas-side">
            <button type="button" className="btn" onClick={() => props.onOpenNote(focus.id)}>
              打开笔记
            </button>
            <p>{mine.length === 0 ? "这篇还没有挂上知识点。" : `${mine.length} 个知识点。点圆点看这一条。`}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function placeAround(points: SpacePoint[]) {
  const cx = 380;
  const cy = 222;
  const radius = Math.max(158, 36 + points.length * 18);
  return points.map((point, index) => {
    const angle = -Math.PI / 2 + (index / points.length) * Math.PI * 2;
    return {
      point,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.78,
    };
  });
}
