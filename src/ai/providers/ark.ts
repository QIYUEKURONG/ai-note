import { ASPECT_RATIOS } from "@/domain/image-styles";
import { getArkBaseUrl, getArkImageModel, getArkKey } from "../keys";
import type { ImageGenerateInput, ImageGenerateResult, ImageModel } from "../models";

function sizeFor(input: ImageGenerateInput): string {
  if (input.size) return input.size;
  const ratio = ASPECT_RATIOS.find((item) => item.id === input.aspectRatio);
  return ratio?.size ?? "2048x2048";
}

async function downloadBytes(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("下载生成图片失败");
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mimeType };
}

function decodeDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return { bytes: Buffer.from(dataUrl, "base64"), mimeType: "image/jpeg" };
  }
  return { bytes: Buffer.from(match[2], "base64"), mimeType: match[1] };
}

export class VolcengineArkImageModel implements ImageModel {
  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const key = getArkKey();
    if (!key) throw new Error("未配置火山方舟 API Key");
    const model = getArkImageModel();
    const response = await fetch(`${getArkBaseUrl()}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        size: sizeFor(input),
        response_format: "url",
        watermark: false,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Seedream 请求失败：${text.slice(0, 500) || response.statusText}`);
    }
    const data = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const item = data.data?.[0];
    if (!item) throw new Error("Seedream 未返回图片");
    const file = item.url
      ? await downloadBytes(item.url)
      : decodeDataUrl(item.b64_json ?? "");
    const [width, height] = sizeFor(input).split("x").map(Number);
    return {
      bytes: file.bytes,
      mimeType: file.mimeType,
      width,
      height,
      model,
    };
  }
}
