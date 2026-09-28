import type { ChatCompleteOptions, ChatModel, ChatStreamOptions } from "../models";
import { getDeepSeekKey, getDeepSeekModel } from "../keys";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500) || response.statusText;
}

export class DeepSeekChatModel implements ChatModel {
  async complete(options: ChatCompleteOptions): Promise<string> {
    const key = getDeepSeekKey();
    if (!key) throw new Error("未配置 DeepSeek API Key");
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        messages: options.messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 4096,
        stream: false,
        thinking: { type: options.thinking ? "enabled" : "disabled" },
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`DeepSeek 请求失败：${await readError(response)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  async stream(options: ChatStreamOptions): Promise<string> {
    const key = getDeepSeekKey();
    if (!key) throw new Error("未配置 DeepSeek API Key");
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        messages: options.messages,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
        thinking: { type: options.thinking ? "enabled" : "disabled" },
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek 流式请求失败：${await readError(response)}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            options.onDelta?.(delta);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
    return full.trim();
  }
}
