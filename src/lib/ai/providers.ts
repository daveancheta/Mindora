export type ProviderStatus = "available" | "unavailable" | "loading" | "error";
export interface ChatMessage { role: "user" | "assistant"; content: string; }
export interface LocalLlmProvider { status(): Promise<ProviderStatus>; reply(messages: ChatMessage[]): Promise<string>; }
export interface SpeechRecognitionProvider { status(): Promise<ProviderStatus>; transcribe(audio: Blob, signal?: AbortSignal): Promise<string>; }
export interface SpeechSynthesisProvider { status(): Promise<ProviderStatus>; voices(): Promise<{ id: string; label: string }[]>; speak(text: string, voice: string, speed?: number, signal?: AbortSignal): Promise<Blob>; }
export interface FaceAnalysisProvider { status(): ProviderStatus; analyze(frame: ImageData): Promise<{ expression?: string }>; }
export const unavailableLlm: LocalLlmProvider = { async status() { return "unavailable"; }, async reply() { throw new Error("No local language model is connected yet."); } };
