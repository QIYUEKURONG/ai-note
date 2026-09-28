"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function JumpHome() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/pet") return;
    const timer = window.setInterval(() => {
      void api<{ href: string | null }>("/api/pet/jump")
        .then((res) => {
          if (res.href) router.push(res.href);
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [pathname, router]);

  return null;
}
