import { NoteWorkspace } from "@/features/workspace/NoteWorkspace";

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const initialMode = query.mode === "interview" || query.mode === "check" ? query.mode : undefined;
  return <NoteWorkspace noteId={id} initialMode={initialMode} />;
}
