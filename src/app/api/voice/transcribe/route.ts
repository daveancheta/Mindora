import { NextRequest, NextResponse } from "next/server";
import { whisperEndpoint } from "@/lib/voice/schema";
import { rateLimited, sameOrigin } from "@/lib/ai/http-guards";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  if (rateLimited(request, 12, 60_000)) return NextResponse.json({ error: "Too many transcription requests. Pause and try again shortly." }, { status: 429 });
  const length = Number(request.headers.get("content-length") ?? 0); if (length > 16_000_000) return NextResponse.json({ error: "That recording is too large. Keep voice notes under 30 seconds." }, { status: 413 });
  let form: FormData; try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid audio upload." }, { status: 400 }); }
  const endpointResult = whisperEndpoint.safeParse(form.get("endpoint"));
  const file = form.get("audio");
  const mediaType = file instanceof File ? file.type.split(";")[0] : "";
  if (!endpointResult.success || !(file instanceof File) || file.size < 1 || file.size > 15_000_000 || !["audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg"].includes(mediaType)) return NextResponse.json({ error: "Audio must be a supported recording under 15 MB, with a valid local Whisper.cpp endpoint." }, { status: 400 });
  const extension = mediaType === "audio/ogg" ? "ogg" : mediaType === "audio/wav" ? "wav" : mediaType === "audio/mp4" ? "mp4" : mediaType === "audio/mpeg" ? "mp3" : "webm";
  const relay = new FormData(); relay.append("file", file, `recording.${extension}`); relay.append("response_format", "json"); relay.append("temperature", "0.0");
  try {
    const response = await fetch(`${endpointResult.data}/inference`, { method: "POST", body: relay, signal: AbortSignal.any([request.signal, AbortSignal.timeout(75_000)]), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: `Whisper.cpp could not transcribe this recording (${response.status}). Check its model and audio format.` }, { status: 502 });
    const raw: unknown = await response.json();
    const parsed = z.object({ text: z.string().max(8_000) }).passthrough().safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Whisper.cpp returned an unexpected transcript." }, { status: 502 });
    return NextResponse.json({ text: parsed.data.text.trim() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Transcription timed out. Try a shorter voice note or smaller local model." }, { status: 504 });
    return NextResponse.json({ error: "Whisper.cpp is unavailable. Check the local service and try again." }, { status: 503 });
  }
}
