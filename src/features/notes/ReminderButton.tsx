"use client";

import { useEffect, useRef, useState } from "react";
import { api, touchSpace } from "@/lib/client";

function localStamp(offsetMs: number): string {
  const date = new Date(Date.now() + offsetMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReminderButton(props: { noteId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWhen(localStamp(60 * 60 * 1000));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div className="appearance-anchor" ref={ref}>
      <button
        type="button"
        className={`text-btn ${open ? "is-on" : ""}`}
        onClick={() => {
          setSaved(false);
          setOpen((value) => !value);
        }}
      >
        提醒
      </button>
      {open ? (
        <div className="reminder-card">
          <p>到点后，伙伴会来找你看这篇笔记。</p>
          <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          <button
            type="button"
            className="btn"
            disabled={!when}
            onClick={() => {
              const remindAt = new Date(when).getTime();
              setError("");
              void api("/api/space", {
                method: "POST",
                body: JSON.stringify({
                  action: "remind",
                  noteId: props.noteId,
                  remindAt,
                  label: props.title,
                }),
              })
                .then(() => {
                  setSaved(true);
                  touchSpace();
                })
                .catch((reason: unknown) => {
                  setError(reason instanceof Error ? reason.message : "没有设上");
                });
            }}
          >
            {saved ? "已记下" : "到点提醒我"}
          </button>
          {error ? <small>{error}</small> : null}
        </div>
      ) : null}
    </div>
  );
}
