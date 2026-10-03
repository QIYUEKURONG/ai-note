"use client";

import { useEffect, useMemo, useState } from "react";
import type { NoteRow } from "@/db/schema";
import { GearIcon, TrashIcon } from "@/components/Icons";
import { ApiKeysPanel } from "@/features/settings/ApiKeysPanel";
import {
  filterNotes,
  formatNoteTime,
  orderNotesByRecent,
  previewText,
  pushRecentNoteId,
  readRecentNoteIds,
  type NoteFilter,
} from "./browse";

export function NotesSidebar(props: {
  notes: NoteRow[];
  activeId?: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void;
  creating?: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [apiOpen, setApiOpen] = useState(false);

  useEffect(() => {
    setRecentIds(props.activeId ? pushRecentNoteId(props.activeId) : readRecentNoteIds());
  }, [props.notes, props.activeId]);

  const ordered = useMemo(
    () => orderNotesByRecent(filterNotes(props.notes, { query, filter, recentIds }), recentIds),
    [props.notes, query, filter, recentIds],
  );

  return (
    <aside className={`notes-sidebar ${props.compact ? "is-compact" : ""}`}>
      <div className="sidebar-brand">
        <div>
          <div className="sidebar-logo">MindBook</div>
          <div className="sidebar-sub">笔记</div>
        </div>
        <div className="sidebar-brand-actions">
          <button
            type="button"
            className="icon-btn"
            title="设置"
            aria-label="设置"
            onClick={() => setApiOpen(true)}
          >
            <GearIcon />
          </button>
          <button className="btn" disabled={props.creating} onClick={props.onCreate}>
            {props.creating ? "…" : "新建"}
          </button>
        </div>
      </div>

      <label className="sidebar-search">
        <span className="search-icon">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索"
          autoComplete="off"
        />
        {query ? (
          <button type="button" className="clear-search" onClick={() => setQuery("")}>
            清除
          </button>
        ) : null}
      </label>

      <div className="sidebar-filters">
        {(
          [
            ["all", "全部"],
            ["favorites", "收藏"],
            ["recent", "最近"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "filter-chip active" : "filter-chip"}
            onClick={() => setFilter(id)}
          >
            {label}
            {id === "all" ? <span className="count">{props.notes.length}</span> : null}
            {id === "favorites" ? (
              <span className="count">{props.notes.filter((n) => n.isFavorite).length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="sidebar-list">
        {ordered.length === 0 ? (
          <div className="sidebar-empty">
            {query ? "没有匹配的笔记" : filter === "favorites" ? "还没有收藏" : "还没有笔记"}
          </div>
        ) : (
          ordered.map((note) => (
                <div
                  key={note.id}
                  className={
                    note.id === props.activeId ? "note-row-wrap is-active" : "note-row-wrap"
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", note.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <button
                    type="button"
                    className="note-row"
                    onClick={() => {
                      setRecentIds(pushRecentNoteId(note.id));
                      props.onOpen(note.id);
                    }}
                  >
                    <div className="note-row-top">
                      <strong>{note.title || "未命名笔记"}</strong>
                      <time>{formatNoteTime(note.updatedAt)}</time>
                    </div>
                    <p>{previewText(note.contentText)}</p>
                    {note.isFavorite ? <span className="row-fav">★</span> : null}
                  </button>
                  {props.onDelete ? (
                    <button
                      type="button"
                      className="note-row-trash"
                      title="删除"
                      aria-label="删除笔记"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onDelete?.(note.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  ) : null}
                </div>
          ))
        )}
      </div>

      {apiOpen ? (
        <div className="modal-back" onClick={() => setApiOpen(false)}>
          <div className="modal api-settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h4>设置</h4>
              <button type="button" className="btn ghost" onClick={() => setApiOpen(false)}>
                关闭
              </button>
            </div>
            <ApiKeysPanel />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
