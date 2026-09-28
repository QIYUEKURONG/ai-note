import { getAppSetting } from "@/db/repos";

export function resolveSetting(key: string, envName: string, fallback = ""): string {
  const stored = getAppSetting(key);
  if (stored && stored.trim()) return stored.trim();
  const env = process.env[envName];
  if (env && env.trim()) return env.trim();
  return fallback;
}

export function getDeepSeekKey(): string {
  return resolveSetting("deepseek_api_key", "DEEPSEEK_API_KEY");
}

export function getDeepSeekModel(): string {
  return resolveSetting("deepseek_model", "DEEPSEEK_MODEL", "deepseek-flash");
}

export function getArkKey(): string {
  return resolveSetting("ark_api_key", "ARK_API_KEY");
}

export function getArkBaseUrl(): string {
  return resolveSetting(
    "ark_base_url",
    "ARK_BASE_URL",
    "https://ark.cn-beijing.volces.com/api/v3",
  ).replace(/\/$/, "");
}

export function getArkImageModel(): string {
  return resolveSetting("ark_image_model", "ARK_IMAGE_MODEL", "doubao-seedream-4-5-251128");
}
