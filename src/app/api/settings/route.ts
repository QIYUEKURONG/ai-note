import { allAppSettings, setAppSetting } from "@/db/repos";
import { json } from "../helpers";

const ALLOWED = [
  "deepseek_api_key",
  "deepseek_model",
  "ark_api_key",
  "ark_base_url",
  "ark_image_model",
  "pet_kind",
] as const;

const PET_KINDS = new Set(["round", "cat", "bird", "dumpling"]);

export async function GET() {
  const settings = allAppSettings();
  return json({
    settings: {
      ...settings,
      deepseek_api_key: settings.deepseek_api_key ? "configured" : "",
      ark_api_key: settings.ark_api_key ? "configured" : "",
      hasDeepSeek: Boolean(settings.deepseek_api_key || process.env.DEEPSEEK_API_KEY),
      hasArk: Boolean(settings.ark_api_key || process.env.ARK_API_KEY),
    },
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  for (const key of ALLOWED) {
    if (typeof body[key] !== "string" || !body[key].trim() || body[key] === "configured") continue;
    if (key === "pet_kind" && !PET_KINDS.has(body[key].trim())) continue;
    setAppSetting(key, body[key].trim());
  }
  return json({ ok: true });
}
