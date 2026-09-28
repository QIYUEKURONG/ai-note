"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { PetFigure } from "./PetFigure";
import { useCompanion } from "./useCompanion";
import { usePetKind } from "./usePetKind";

export function AiPet() {
  const pathname = usePathname();
  const router = useRouter();
  const companion = useCompanion();
  const kind = usePetKind();
  const [open, setOpen] = useState(false);
  const [desktopNote, setDesktopNote] = useState("");
  const [onDesktop, setOnDesktop] = useState(false);
  const { reminder, question } = companion;

  useEffect(() => {
    if (reminder && !onDesktop) setOpen(true);
  }, [reminder?.id, onDesktop]);

  useEffect(() => {
    if (!onDesktop) return;
    const timer = window.setInterval(() => {
      void api<{ running: boolean }>("/api/pet/desktop")
        .then((res) => {
          if (!res.running) setOnDesktop(false);
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [onDesktop]);

  if (pathname === "/pet" || onDesktop) return null;

  async function placeOnDesktop() {
    setDesktopNote("");
    try {
      await api("/api/pet/desktop", { method: "POST" });
      setOnDesktop(true);
      setOpen(false);
    } catch (reason: unknown) {
      setDesktopNote(reason instanceof Error ? reason.message : "没有放到桌面");
    }
  }

  return (
    <div className={`pet-home ${reminder || question ? "is-awake" : ""}`}>
      {open ? (
        <div className="pet-bubble">
          <CompanionBody
            companion={companion}
            onOpenNote={(href) => router.push(href)}
          />
          <div className="pet-actions">
            <button type="button" onClick={() => void placeOnDesktop()}>
              放到桌面
            </button>
          </div>
          {desktopNote ? <small>{desktopNote}</small> : null}
        </div>
      ) : null}
      <button type="button" className="pet" aria-label="学习伙伴" onClick={() => setOpen((value) => !value)}>
        <PetFigure mood={companion.mood} kind={kind} />
      </button>
    </div>
  );
}

export function CompanionBody(props: {
  companion: ReturnType<typeof useCompanion>;
  onOpenNote: (href: string) => void;
}) {
  const { reminder, question, busy, answer, setAnswer, error, task, post } = props.companion;
  if (reminder) {
    return (
      <>
        <p>到时间了，去看《{reminder.title || reminder.label || "笔记"}》。</p>
        <div className="pet-actions">
          <button type="button" onClick={() => props.onOpenNote(`/notes/${reminder.noteId}`)}>
            打开笔记
          </button>
          <button type="button" onClick={() => props.onOpenNote(`/notes/${reminder.noteId}?mode=check`)}>
            复习
          </button>
          <button type="button" onClick={() => props.onOpenNote(`/notes/${reminder.noteId}?mode=interview`)}>
            面试
          </button>
          <button type="button" onClick={() => void post({ action: "reminder", reminderId: reminder.id, op: "snooze" })}>
            一小时后再说
          </button>
          <button type="button" onClick={() => void post({ action: "reminder", reminderId: reminder.id, op: "done" })}>
            知道了
          </button>
        </div>
        {task?.status === "failed" ? <small>{task.error || error}</small> : null}
      </>
    );
  }
  if (question) {
    return (
      <>
        <small>{question.pointLabel}</small>
        <p>{question.prompt}</p>
        <textarea value={answer} placeholder="试着答一下" onChange={(event) => setAnswer(event.target.value)} />
        <div className="pet-actions">
          <button
            type="button"
            disabled={busy || !answer.trim()}
            onClick={() => void post({ action: "answer-review", itemId: question.id, answer })}
          >
            {busy ? "在听…" : "回答"}
          </button>
          {question.noteId ? (
            <button type="button" onClick={() => props.onOpenNote(`/notes/${question.noteId}?mode=interview`)}>
              去面试
            </button>
          ) : null}
        </div>
        {error ? <small>{error}</small> : null}
      </>
    );
  }
  return (
    <>
      <p>我可以待在桌面上。有提醒，或者有要回忆的知识时，我会出声。</p>
      {props.companion.space && props.companion.space.points.length > 0 ? (
        <div className="pet-actions">
          <button type="button" disabled={busy} onClick={() => void post({ action: "review-plan" })}>
            出一道题
          </button>
        </div>
      ) : null}
      {error ? <small>{error}</small> : null}
    </>
  );
}
