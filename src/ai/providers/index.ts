import type { AIProvider } from "../models";
import { DeepSeekChatModel } from "./deepseek";
import { VolcengineArkImageModel } from "./ark";

export function getAIProvider(): AIProvider {
  return {
    chat: new DeepSeekChatModel(),
    image: new VolcengineArkImageModel(),
  };
}
