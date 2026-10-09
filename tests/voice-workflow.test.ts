import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { voiceConfigSchema, speakSchema } from "@/lib/voice/schema";
import { POST as voiceStatus } from "@/app/api/voice/status/route";
import { POST as transcribe } from "@/app/api/voice/transcribe/route";
import { POST as speak } from "@/app/api/voice/speak/route";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function request(url: string, body: BodyInit, contentType?: string) {
  const headers = new Headers({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" });
  if (contentType) headers.set("content-type", contentType);
  return new Request(url, { method: "POST", headers, body }) as NextRequest;
}

describe("local voice service boundaries", () => {
  it("only accepts the intended loopback speech endpoints", () => {
    assert.equal(voiceConfigSchema.safeParse({ whisperEndpoint: "http://127.0.0.1:8080", piperEndpoint: "http://[::1]:5000" }).success, true);
    for (const endpoint of ["https://127.0.0.1:8080", "http://localhost:8080", "http://127.0.0.1:8081", "http://192.168.1.4:8080", "http://127.0.0.1:8080/admin"]) {
      assert.equal(voiceConfigSchema.safeParse({ whisperEndpoint: endpoint, piperEndpoint: "http://127.0.0.1:5000" }).success, false, endpoint);
    }
    assert.equal(speakSchema.safeParse({ whisperEndpoint: "http://127.0.0.1:8080", piperEndpoint: "http://127.0.0.1:5000", text: "hello", voice: "../../file", speed: 1 }).success, false);
  });

  it("reports local service availability and installed Piper voices", async () => {
    globalThis.fetch = async (input) => String(input).endsWith("/voices")
      ? Response.json({ "en_US-lessac-medium": { name: "English US" } })
      : new Response("local whisper", { status: 200 });
    const response = await voiceStatus(request("http://127.0.0.1:3000/api/voice/status", JSON.stringify({ whisperEndpoint: "http://127.0.0.1:8080", piperEndpoint: "http://127.0.0.1:5000" }), "application/json"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { whisper: "available", piper: "available", voices: [{ id: "en_US-lessac-medium", label: "English US" }] });
  });

  it("relays an in-memory recording to the fixed Whisper inference path", async () => {
    let called = "";
    globalThis.fetch = async (input, init) => { called = String(input); const form = init?.body as FormData; assert.equal(form.get("response_format"), "json"); assert.equal((form.get("file") as File).name, "recording.webm"); return Response.json({ text: "A local transcript." }); };
    const form = new FormData(); form.set("endpoint", "http://127.0.0.1:8080"); form.set("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" }), "mic.webm");
    const response = await transcribe(request("http://127.0.0.1:3000/api/voice/transcribe", form));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { text: "A local transcript." }); assert.equal(called, "http://127.0.0.1:8080/inference");
  });

  it("blocks an arbitrary transcription URL before making a request", async () => {
    let called = false; globalThis.fetch = async () => { called = true; return Response.json({ text: "bad" }); };
    const form = new FormData(); form.set("endpoint", "http://example.com:8080"); form.set("audio", new Blob([new Uint8Array([1])], { type: "audio/webm" }), "mic.webm");
    const response = await transcribe(request("http://127.0.0.1:3000/api/voice/transcribe", form));
    assert.equal(response.status, 400); assert.equal(called, false);
  });

  it("returns local Piper WAV audio and handles missing services", async () => {
    let called = ""; globalThis.fetch = async (input) => { called = String(input); return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "Content-Type": "audio/wav" } }); };
    const response = await speak(request("http://127.0.0.1:3000/api/voice/speak", JSON.stringify({ whisperEndpoint: "http://127.0.0.1:8080", piperEndpoint: "http://127.0.0.1:5000", text: "Hello", voice: "en_US-lessac-medium", speed: 1.1 }), "application/json"));
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "audio/wav"); assert.equal(called, "http://127.0.0.1:5000/synthesize");
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    const down = await voiceStatus(request("http://127.0.0.1:3000/api/voice/status", JSON.stringify({ whisperEndpoint: "http://127.0.0.1:8080", piperEndpoint: "http://127.0.0.1:5000" }), "application/json"));
    assert.deepEqual(await down.json(), { whisper: "unavailable", piper: "unavailable", voices: [] });
  });
});
