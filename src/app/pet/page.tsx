"use client";

import { useEffect, useRef, useState } from "react";
import { CompanionBody } from "@/features/pet/AiPet";
import { PetFigure } from "@/features/pet/PetFigure";
import { useCompanion } from "@/features/pet/useCompanion";
import { usePetKind } from "@/features/pet/usePetKind";
import { api } from "@/lib/client";

function tell(message: string) {
  const bridge = (
    window as unknown as {
      webkit?: { messageHandlers?: { pet?: { postMessage: (value: string) => void } } };
    }
  ).webkit?.messageHandlers?.pet;
  bridge?.postMessage(message);
}

export default function DesktopPetPage() {
  const companion = useCompanion();
  const kind = usePetKind();
  const [menu, setMenu] = useState(false);
  const moved = useRef(false);

  useEffect(() => {
    tell(menu ? "size:392,320" : "size:146,136");
  }, [menu]);

  function onPetPointerDown(event: React.PointerEvent) {
    const startX = event.screenX;
    const startY = event.screenY;
    moved.current = false;
    tell("drag-start");
    function onMove(next: PointerEvent) {
      const dx = next.screenX - startX;
      const dy = next.screenY - startY;
      if (Math.hypot(dx, dy) > 4) moved.current = true;
      if (moved.current) tell(`move:${Math.round(dx)},${Math.round(dy)}`);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener(
      "pointerup",
      () => window.removeEventListener("pointermove", onMove),
      { once: true },
    );
  }

  const noteId = companion.reminder?.noteId || companion.question?.noteId || companion.space?.notes[0]?.id || "";

  async function openHref(href: string) {
    await api("/api/pet/jump", { method: "POST", body: JSON.stringify({ href }) });
    tell("raise");
  }

  return (
    <main className={`desktop-pet-root ${menu ? "is-open" : ""}`}>
      {menu ? (
        <div className="desktop-pet-card">
          <CompanionBody companion={companion} onOpenNote={(href) => void openHref(href)} />
          <div className="pet-actions">
            <button type="button" onClick={() => void openHref(noteId ? `/notes/${noteId}` : "/")}>
              回到笔记
            </button>
            <button type="button" onClick={() => tell("close")}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="desktop-pet-hit"
        aria-label="伙伴"
        onPointerDown={onPetPointerDown}
        onClick={() => {
          if (!moved.current) setMenu((open) => !open);
        }}
      >
        <PetFigure mood={companion.mood} kind={kind} />
      </button>
    </main>
  );
}
