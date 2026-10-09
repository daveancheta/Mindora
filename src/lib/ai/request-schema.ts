import { z } from "zod";

export const endpointSchema = z.string().trim().min(1).max(120).transform((value, ctx) => {
  let url: URL;
  try { url = new URL(value); } catch { ctx.addIssue({ code: "custom", message: "Enter a valid local Ollama address." }); return z.NEVER; }
  const port = Number(url.port || (url.protocol === "http:" ? "80" : "443"));
  const allowedPorts = (process.env.OLLAMA_ALLOWED_PORTS ?? "11434").split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry) && entry > 0 && entry <= 65535);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) || !allowedPorts.includes(port) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    ctx.addIssue({ code: "custom", message: "Ollama must use HTTP on loopback (127.0.0.1 or ::1), with no path or credentials." }); return z.NEVER;
  }
  return url.origin;
});
export const modelsRequestSchema = z.object({ endpoint: endpointSchema }).strict();
export const chatRequestSchema = z.object({
  endpoint: endpointSchema,
  model: z.string().trim().min(1).max(128).regex(/^[\w][\w.:/@+-]*$/),
  style: z.enum(["friendly", "calm", "thoughtful", "encouraging"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }).strict()).min(1).max(80),
  memories: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.messages.reduce((sum, message) => sum + message.content.length, 0) > 32000) ctx.addIssue({ code: "custom", path: ["messages"], message: "Conversation context is too long. Start a new conversation or shorten it." });
});
