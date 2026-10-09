import { NextRequest, NextResponse } from "next/server";
import { voiceConfigSchema } from "@/lib/voice/schema";
import { rateLimited, readBoundedJson, sameOrigin } from "@/lib/ai/http-guards";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  if (rateLimited(request, 50, 60_000)) return NextResponse.json({ error: "Please wait before checking local voice services again." }, { status: 429 });
  let body: unknown; try { body = await readBoundedJson(request, 2_000); } catch { return NextResponse.json({ error: "Invalid voice configuration." }, { status: 400 }); }
  const parsed = voiceConfigSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid voice configuration." }, { status: 400 });
  const { whisperEndpoint, piperEndpoint } = parsed.data;
  const signal = AbortSignal.timeout(2_500);
  const [whisper, piper] = await Promise.allSettled([
    fetch(whisperEndpoint, { signal, cache: "no-store" }),
    fetch(`${piperEndpoint}/voices`, { signal, cache: "no-store" }),
  ]);
  const whisperAvailable = whisper.status === "fulfilled" && whisper.value.ok;
  let voices: { id: string; label: string }[] = [];
  if (piper.status === "fulfilled" && piper.value.ok) {
    try {
      const data: unknown = await piper.value.json();
      if (data && typeof data === "object") voices = Object.entries(data).flatMap(([id, item]) => {
        if (!/^[\w.-]+$/.test(id)) return [];
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const label = typeof record.name === "string" ? record.name : id;
        return [{ id, label: label.slice(0, 100) }];
      });
    } catch { voices = []; }
  }
  return NextResponse.json({ whisper: whisperAvailable ? "available" : "unavailable", piper: voices.length ? "available" : "unavailable", voices }, { headers: { "Cache-Control": "no-store" } });
}
