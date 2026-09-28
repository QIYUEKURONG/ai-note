"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpaceReminder, SpaceReview, SpaceSnapshot } from "@/domain/knowledge";
import type { AITaskRow } from "@/db/schema";
import { api, touchSpace } from "@/lib/client";

export type PetMood = "idle" | "awake" | "think" | "happy";

export function useCompanion() {
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);
  const [answer, setAnswer] = useState("");
  const [task, setTask] = useState<AITaskRow | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ space: SpaceSnapshot }>("/api/space");
    setSpace(data.space);
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
    const timer = window.setInterval(() => void load().catch(() => undefined), 20000);
    function onTouch() {
      void load().catch(() => undefined);
    }
    window.addEventListener("focus", onTouch);
    window.addEventListener("mindbook-space", onTouch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onTouch);
      window.removeEventListener("mindbook-space", onTouch);
    };
  }, [load]);

  useEffect(() => {
    if (!task || task.status === "success" || task.status === "failed") return;
    const timer = window.setInterval(async () => {
      const res = await api<{ task: AITaskRow }>(`/api/tasks/${task.id}`);
      setTask(res.task);
      if (res.task.status === "success" || res.task.status === "failed") {
        setAnswer("");
        await load();
        touchSpace();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [task, load]);

  const now = Date.now();
  const reminder: SpaceReminder | undefined = space?.reminders.find((item) => item.remindAt <= now);
  const question: SpaceReview | undefined = space?.reviews.find((item) => item.status === "pending");
  const busy = Boolean(task && task.status !== "success" && task.status !== "failed");

  async function post(body: Record<string, unknown>) {
    setError("");
    try {
      const res = await api<{ task?: AITaskRow; space?: SpaceSnapshot }>("/api/space", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.task) setTask(res.task);
      if (res.space) setSpace(res.space);
      touchSpace();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "没有完成");
    }
  }

  const mood: PetMood = busy ? "think" : reminder || question ? "awake" : task?.status === "success" ? "happy" : "idle";

  return { space, reminder, question, busy, answer, setAnswer, error, task, post, mood };
}
