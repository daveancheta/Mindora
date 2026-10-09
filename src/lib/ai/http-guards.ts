import type { NextRequest } from "next/server";

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const source = new URL(origin);
    const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
    return source.protocol === "http:" && loopback(source.hostname) && source.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
export async function readBoundedJson(request: Request, maxBytes = 48_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error("Request is too large.");
  if (!request.body) throw new Error("Request body is required.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error("Request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(merged));
}
const events = new Map<string, number[]>();
export function rateLimited(request: NextRequest, limit = 24, periodMs = 10 * 60_000) {
  // Standalone local app: use one in-process budget rather than trusting spoofable forwarding headers.
  const key = "local";
  const now = Date.now(); const recent = (events.get(key) ?? []).filter((time) => now - time < periodMs);
  if (recent.length >= limit) { events.set(key, recent); return true; }
  recent.push(now); events.set(key, recent); if (events.size > 1000) for (const [k, times] of events) if (!times.some((time) => now - time < periodMs)) events.delete(k);
  return false;
}
