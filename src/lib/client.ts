export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

export function touchSpace() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mindbook-space"));
}

export function mediaUrl(filePath: string): string {
  const name = filePath.replace(/^storage\/images\//, "");
  return `/api/media/${name}`;
}
