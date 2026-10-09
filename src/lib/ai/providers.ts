export type ProviderStatus = "available" | "unavailable" | "loading" | "error";
export interface ChatMessage { role: "user" | "assistant"; content: string; }
export interface LocalLlmProvider { status(): Promise<ProviderStatus>; reply(messages: ChatMessage[]): Promise<string>; }
export interface SpeechRecognitionProvider { status(): ProviderStatus; start(onText: (text: string) => void, onError: (error: Error) => void): void; stop(): void; }
export interface SpeechSynthesisProvider { status(): ProviderStatus; speak(text: string): Promise<void>; stop(): void; }
export interface FaceAnalysisProvider { status(): ProviderStatus; analyze(frame: ImageData): Promise<{ expression?: string }>; }
export const unavailableLlm: LocalLlmProvider = { async status() { return "unavailable"; }, async reply() { throw new Error("No local language model is connected yet."); } };
