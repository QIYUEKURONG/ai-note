import { getNote, updateNoteSettings } from "@/db/repos";
import { isThemePreset, themeFromPreset, type NoteTheme } from "@/domain/themes";
import { json, notFound } from "../../../helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getNote(id)) return notFound("笔记不存在");
  const body = (await request.json()) as Partial<NoteTheme> & { preset?: string };
  const base = isThemePreset(body.preset ?? "")
    ? themeFromPreset(body.preset as never)
    : themeFromPreset("paper");
  const theme: NoteTheme = {
    ...base,
    ...body,
    preset: (body.preset as NoteTheme["preset"]) ?? base.preset,
    customColorsJson: body.customColorsJson ?? "{}",
  };
  const settings = updateNoteSettings(id, theme);
  return json({ settings });
}
