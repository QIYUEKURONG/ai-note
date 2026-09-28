"use client";

import type { NoteRow } from "@/db/schema";

export function NoteList(props: { notes: NoteRow[]; onCreate: () => void }) {
  return (
    <div className="note-wall">
      <button className="new-card" onClick={props.onCreate} type="button">
        空白纸张，开始写
      </button>
      {props.notes.map((note, index) => (
        <a
          key={note.id}
          href={`/notes/${note.id}`}
          className="note-card"
          style={{ ["--tilt" as string]: `${((index % 5) - 2) * 0.8}deg` }}
        >
          <h2>{note.title || "未命名笔记"}</h2>
          <p>{note.contentText || "还没有写下内容。"}</p>
          <div className="meta">
            <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            {note.isFavorite ? <span className="fav">收藏</span> : <span />}
          </div>
        </a>
      ))}
    </div>
  );
}
