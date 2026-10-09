import { NextRequest, NextResponse } from "next/server";
import { modelsRequestSchema } from "@/lib/ai/request-schema";
import { listOllamaModels, OllamaError } from "@/lib/ai/ollama-server";
import { rateLimited, readBoundedJson, sameOrigin } from "@/lib/ai/http-guards";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  if (rateLimited(request, 60)) return NextResponse.json({ error: "Too many connection checks. Try again shortly." }, { status: 429 });
  let body: unknown; try { body = await readBoundedJson(request, 1024); } catch { return NextResponse.json({ connected: false, models: [], error: "Invalid connection request." }, { status: 400 }); }
  const parsed = modelsRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ connected: false, models: [], error: "Use a loopback Ollama address such as http://127.0.0.1:11434." }, { status: 400 });
  try { const models = await listOllamaModels(parsed.data.endpoint); return NextResponse.json({ connected: true, models }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const message = error instanceof OllamaError ? error.message : "Could not check the local Ollama service."; const status = error instanceof OllamaError ? error.status : 503; return NextResponse.json({ connected: false, models: [], error: message }, { status, headers: { "Cache-Control": "no-store" } }); }
}
