import { NextRequest, NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/ai/request-schema";
import { buildSystemPrompt, listOllamaModels, OllamaError, ollamaFetch } from "@/lib/ai/ollama-server";
import { checkSafety } from "@/lib/ai/safety";
import { rateLimited, readBoundedJson, sameOrigin } from "@/lib/ai/http-guards";

export const runtime = "nodejs";
export const maxDuration = 180;
const sseHeaders = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Content-Type-Options": "nosniff" };
function event(data: unknown) { return `data: ${JSON.stringify(data)}\n\n`; }
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  if (rateLimited(request, 60, 60_000)) return NextResponse.json({ error: "Too many messages too quickly. Take a short pause and try again." }, { status: 429 });
  let body: unknown; try { body = await readBoundedJson(request, 48_000); } catch { return NextResponse.json({ error: "Message request was too large or malformed." }, { status: 400 }); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Message request is invalid." }, { status: 400 });
  const input = parsed.data;
  const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
  const safety = lastUser ? checkSafety(lastUser.content) : null;
  if (safety) {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(event({ token: safety.reply, safety: safety.level }))); controller.enqueue(new TextEncoder().encode(event({ done: true }))); controller.close(); } });
    return new Response(stream, { headers: sseHeaders });
  }
  try {
    const installed = await listOllamaModels(input.endpoint);
    if (!installed.some((model) => model.name === input.model)) return NextResponse.json({ error: "That model is no longer installed. Refresh the model list and choose an installed model." }, { status: 409 });
    const timeout = AbortSignal.timeout(180_000); const signal = request.signal.aborted ? request.signal : AbortSignal.any([request.signal, timeout]);
    const modelResponse = await ollamaFetch(input.endpoint, "/api/chat", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, stream: true, messages: [{ role: "system", content: buildSystemPrompt(input.style, input.memories, input.responseLength) }, ...input.messages] }),
    }, 180_000);
    if (!modelResponse.ok) return NextResponse.json({ error: `Ollama could not generate a response (${modelResponse.status}). Check that the model is ready and try again.` }, { status: 502 });
    if (!modelResponse.body) throw new OllamaError("Ollama returned no response stream.");
    const reader = modelResponse.body.getReader(); const decoder = new TextDecoder(); let pending = ""; let total = 0; let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (closed) return;
        try {
          while (true) {
            const lineBreak = pending.indexOf("\n");
            if (lineBreak >= 0) {
              const line = pending.slice(0, lineBreak).trim(); pending = pending.slice(lineBreak + 1); if (!line) continue;
              let chunk: unknown; try { chunk = JSON.parse(line); } catch { controller.enqueue(new TextEncoder().encode(event({ error: "Ollama sent a malformed response. Please retry." }))); controller.close(); closed = true; await reader.cancel(); return; }
              const entry = chunk as { message?: { content?: unknown }; done?: unknown; error?: unknown };
              if (typeof entry.error === "string") { controller.enqueue(new TextEncoder().encode(event({ error: "Ollama reported a generation error. Check the selected model and retry." }))); controller.close(); closed = true; return; }
              if (typeof entry.message?.content === "string" && entry.message.content) { total += entry.message.content.length; if (total > 16_000) { controller.enqueue(new TextEncoder().encode(event({ error: "The response was too long. Please retry with a shorter prompt." }))); controller.close(); closed = true; await reader.cancel(); return; } controller.enqueue(new TextEncoder().encode(event({ token: entry.message.content }))); return; }
              if (entry.done === true) { if (pending.trim()) { try { const last = JSON.parse(pending) as { message?: { content?: unknown } }; if (typeof last.message?.content === "string") controller.enqueue(new TextEncoder().encode(event({ token: last.message.content }))); } catch { /* Ignore an incomplete final NDJSON record. */ } } controller.enqueue(new TextEncoder().encode(event({ done: true }))); controller.close(); closed = true; return; }
              continue;
            }
            const { done, value } = await reader.read();
            if (done) { const rest = pending.trim(); if (rest) { try { const last = JSON.parse(rest) as { message?: { content?: unknown } }; if (typeof last.message?.content === "string") controller.enqueue(new TextEncoder().encode(event({ token: last.message.content }))); } catch { controller.enqueue(new TextEncoder().encode(event({ error: "Ollama ended with a malformed response. Please retry." }))); } } controller.enqueue(new TextEncoder().encode(event({ done: true }))); controller.close(); closed = true; return; }
            pending += decoder.decode(value, { stream: true }); if (pending.length > 65_536) throw new Error("Ollama sent an oversized response record.");
          }
        } catch { if (!closed) { try { controller.enqueue(new TextEncoder().encode(event({ error: "The local connection was interrupted. Retry when Ollama is ready." }))); controller.close(); } catch { /* Client disconnected. */ } closed = true; } }
      },
      async cancel() { closed = true; await reader.cancel().catch(() => undefined); },
    });
    return new Response(stream, { headers: sseHeaders });
  } catch (error) {
    const message = error instanceof OllamaError ? error.message : "Ollama could not be reached. Check the local service and retry.";
    const status = error instanceof OllamaError ? error.status : 503;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
