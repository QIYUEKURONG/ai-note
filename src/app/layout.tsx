import type { Metadata } from "next";
import { AiPet } from "@/features/pet/AiPet";
import { JumpHome } from "@/features/pet/JumpHome";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindBook",
  description: "让知识活起来",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">{children}</div>
        <JumpHome />
        <AiPet />
      </body>
    </html>
  );
}
