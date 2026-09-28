"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotesSidebar } from "@/features/notes/NotesSidebar";
import { KnowledgeSpace } from "@/features/space/KnowledgeSpace";
import { api } from "@/lib/client";
import type { NoteRow } from "@/db/schema";

export default function HomePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string } | null>(null);

  async function load() {
    const data = await api<{ notes: NoteRow[] }>("/api/notes");
    setNotes(data.notes);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createNote() {
    setBusy(true);
    try {
      const data = await api<{ note: NoteRow }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({ title: "未命名笔记" }),
      });
      router.push(`/notes/${data.note.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="browser-shell apple-notes has-sidebar">
      <NotesSidebar
        notes={notes}
        onOpen={(id) => router.push(`/notes/${id}`)}
        onCreate={() => void createNote()}
        creating={busy}
        onDelete={(id) => setConfirm({ id })}
      />
      <main className="browser-main is-space">
        <KnowledgeSpace
          onOpen={(id, mode) => router.push(mode ? `/notes/${id}?mode=${mode}` : `/notes/${id}`)}
          onCreate={() => void createNote()}
          onLibraryChange={() => void load()}
        />
      </main>
      {confirm ? (
        <ConfirmDialog
          title="删除此笔记？"
          message="删除后可从列表中移除。相关 AI 结果也会一起删除。"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const id = confirm.id;
            setConfirm(null);
            await api(`/api/notes/${id}`, { method: "DELETE" });
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
