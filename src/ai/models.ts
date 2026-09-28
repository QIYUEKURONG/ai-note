export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompleteOptions = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  json?: boolean;
};

export type ChatStreamOptions = ChatCompleteOptions & {
  onDelta?: (text: string) => void;
};

export interface ChatModel {
  complete(options: ChatCompleteOptions): Promise<string>;
  stream(options: ChatStreamOptions): Promise<string>;
}

export type ImageGenerateInput = {
  prompt: string;
  size?: string;
  aspectRatio?: string;
};

export type ImageGenerateResult = {
  bytes: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  model: string;
};

export interface ImageModel {
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>;
}

export interface VideoModel {
  generate?(input: unknown): Promise<unknown>;
}

export interface EmbeddingModel {
  embed?(input: string): Promise<number[]>;
}

export interface SpeechModel {
  transcribe?(input: Buffer): Promise<string>;
}

export interface TTSModel {
  speak?(input: string): Promise<Buffer>;
}

export type AIProvider = {
  chat: ChatModel;
  image: ImageModel;
  video?: VideoModel;
  embedding?: EmbeddingModel;
  speech?: SpeechModel;
  tts?: TTSModel;
};
