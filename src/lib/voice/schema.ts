import { z } from "zod";

const localService = (envKey: string, fallback: number, label: string) => z.string().trim().min(1).max(120).transform((value, ctx) => {
  let url: URL;
  try { url = new URL(value); } catch { ctx.addIssue({ code: "custom", message: `Enter a valid local ${label} address.` }); return z.NEVER; }
  const port = Number(url.port || (url.protocol === "http:" ? 80 : 443));
  const ports = (process.env[envKey] ?? String(fallback)).split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0 && item <= 65535);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) || !ports.includes(port) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    ctx.addIssue({ code: "custom", message: `${label} must be HTTP on loopback using an allowed port, with no path or credentials.` }); return z.NEVER;
  }
  return url.origin;
});
export const whisperEndpoint = localService("WHISPER_ALLOWED_PORTS", 8080, "Whisper.cpp");
export const piperEndpoint = localService("PIPER_ALLOWED_PORTS", 5000, "Piper");
export const voiceConfigSchema = z.object({ whisperEndpoint, piperEndpoint }).strict();
export const speakSchema = voiceConfigSchema.extend({ text: z.string().trim().min(1).max(4000), voice: z.string().trim().min(1).max(160).regex(/^[\w.-]+$/), speed: z.number().min(0.5).max(2) }).strict();
