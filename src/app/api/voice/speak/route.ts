import { NextRequest, NextResponse } from "next/server";
import { speakSchema } from "@/lib/voice/schema";
import { rateLimited, readBoundedJson, sameOrigin } from "@/lib/ai/http-guards";

export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  if (rateLimited(request, 20, 60_000)) return NextResponse.json({ error: "Please wait before generating more speech." }, { status: 429 });
  let body: unknown; try { body = await readBoundedJson(request, 8_000); } catch { return NextResponse.json({ error: "Invalid speech request." }, { status: 400 }); }
  const parsed = speakSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid speech request." }, { status: 400 });
  const { piperEndpoint, text, voice, speed } = parsed.data;
  try {
    const response = await fetch(`${piperEndpoint}/synthesize`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/wav" }, body: JSON.stringify({ text, voice, length_scale: 1 / speed }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: `Piper could not synthesize speech (${response.status}). Check the selected local voice.` }, { status: 502 });
    const audio = await response.arrayBuffer(); if (!audio.byteLength || audio.byteLength > 20_000_000) return NextResponse.json({ error: "Piper returned an invalid or oversized audio file." }, { status: 502 });
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Speech generation timed out. Try a shorter response." }, { status: 504 });
    return NextResponse.json({ error: "Piper is unavailable. Check the local service and try again." }, { status: 503 });
  }
}
