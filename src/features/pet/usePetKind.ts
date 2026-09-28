"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { asPetKind, type PetKind } from "./pets";

export function usePetKind(): PetKind {
  const [kind, setKind] = useState<PetKind>("round");

  useEffect(() => {
    function load() {
      void api<{ settings: { pet_kind?: string } }>("/api/settings")
        .then((res) => setKind(asPetKind(res.settings.pet_kind)))
        .catch(() => undefined);
    }
    load();
    const timer = window.setInterval(load, 3000);
    window.addEventListener("mindbook-pet", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("mindbook-pet", load);
    };
  }, []);

  return kind;
}
