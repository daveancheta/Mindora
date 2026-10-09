import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { JSDOM } from "jsdom";
import { after, test } from "node:test";
import React from "react";
import { describeMovements, optionalSummary } from "../src/lib/face/signals.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:3000/face-analysis" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  HTMLMediaElement: { value: dom.window.HTMLMediaElement, configurable: true }, Node: { value: dom.window.Node, configurable: true },
  MutationObserver: { value: dom.window.MutationObserver, configurable: true }, localStorage: { value: dom.window.localStorage, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
Object.defineProperty(dom.window.HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
Object.defineProperty(dom.window.HTMLMediaElement.prototype, "pause", { configurable: true, value: () => undefined });
Object.defineProperty(dom.window.HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 2 });
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { FaceAnalysis } = await import("../src/components/face-analysis.tsx");
const originalFetch = globalThis.fetch;
let permissionCalls = 0;
let trackStops = 0;
let workerTerminates = 0;
let fakeWorkerMode: "not-detected" | "movement" | "init-error" = "not-detected";

class TestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { type: string }) {
    if (message.type === "init") setTimeout(() => this.onmessage?.({ data: fakeWorkerMode === "init-error" ? { type: "error", message: "model missing" } : { type: "ready" } } as MessageEvent), 0);
    if (message.type === "frame") setTimeout(() => this.onmessage?.({ data: fakeWorkerMode === "movement" ? { type: "result", hasFace: true, landmarks: [{ x: 0.25, y: 0.3 }, { x: 0.75, y: 0.7 }], categories: [{ name: "mouthSmileLeft", score: 0.95 }] } : { type: "result", hasFace: false, landmarks: [], categories: [] } } as MessageEvent), 0);
  }
  terminate() { workerTerminates++; }
}
Object.defineProperty(globalThis, "Worker", { value: TestWorker, configurable: true });
Object.defineProperty(dom.window, "Worker", { value: TestWorker, configurable: true });
let rafClock = 1000;
const raf = (callback: FrameRequestCallback) => setTimeout(() => callback(rafClock += 500), 1) as unknown as number;
const cancelRaf = (id: number) => clearTimeout(id);
Object.defineProperty(globalThis, "requestAnimationFrame", { value: raf, configurable: true });
Object.defineProperty(globalThis, "cancelAnimationFrame", { value: cancelRaf, configurable: true });
Object.defineProperty(dom.window, "requestAnimationFrame", { value: raf, configurable: true });
Object.defineProperty(dom.window, "cancelAnimationFrame", { value: cancelRaf, configurable: true });
Object.defineProperty(globalThis, "createImageBitmap", { value: async () => ({ close() {} }), configurable: true });
Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => ({ clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) });

function setMedia(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(dom.window.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
}
function mockAssets(available: boolean) {
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes("/mediapipe/") ? new Response(null, { status: available ? 200 : 404 }) : Response.json({ error: "unexpected request" }, { status: 500 })) as typeof fetch;
}
async function grantConsent() { fireEvent.click(screen.getByRole("checkbox", { name: /understand what this camera feature does/i })); }

test("movement descriptions use cautious labels and smooth blendshape changes", () => {
  const first = describeMovements([{ name: "mouthSmileLeft", score: 0.9 }]);
  assert.deepEqual(first.signals, ["smile-related movement detected"]);
  const second = describeMovements([{ name: "mouthSmileLeft", score: 0 }], first.smoothed);
  assert.deepEqual(second.signals, ["smile-related movement detected"]);
  assert.match(optionalSummary(second.signals), /Smile-related movement detected/);
  assert.doesNotMatch(optionalSummary(second.signals), /happy|sad|emotion|diagnos/i);
});

test("the official model and matching MediaPipe WASM runtime are present locally", () => {
  const model = readFileSync("public/mediapipe/models/face_landmarker.task");
  assert.equal(model.byteLength, 3_758_596);
  assert.equal(createHash("sha256").update(model).digest("hex"), "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff");
  for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
    assert.ok(statSync(`public/mediapipe/wasm/${file}`).size > 0, `${file} is missing`);
  }
  assert.deepEqual([...readFileSync("public/mediapipe/wasm/vision_wasm_internal.wasm").subarray(0, 4)], [0, 97, 115, 109]);
});

test("missing model assets keep camera disabled and do not request permission", async () => {
  permissionCalls = 0; mockAssets(false); setMedia(async () => { permissionCalls++; throw new Error("must not ask"); });
  const rendered = render(React.createElement(FaceAnalysis));
  await screen.findByText("Local model asset unavailable");
  assert.equal((screen.getByRole("button", { name: "Local model missing" }) as HTMLButtonElement).disabled, true);
  assert.equal(permissionCalls, 0);
  cleanup(); rendered.container.remove();
});

test("permission denial is shown without leaving the camera on", async () => {
  mockAssets(true); setMedia(async () => { permissionCalls++; throw new DOMException("denied", "NotAllowedError"); });
  const rendered = render(React.createElement(FaceAnalysis));
  await screen.findByText("Local model assets ready");
  assert.equal(permissionCalls, 0);
  assert.equal(screen.getByRole("switch", { name: "Camera" }).getAttribute("aria-checked"), "false");
  await grantConsent(); fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
  await screen.findByRole("alert");
  assert.match(screen.getByRole("alert").textContent ?? "", /permission was denied or blocked/i);
  assert.equal(permissionCalls, 1);
  assert.equal(screen.getByRole("switch", { name: "Camera" }).getAttribute("aria-checked"), "false");
  cleanup(); rendered.container.remove();
});

test("face-not-detected state is explicit and stopping the camera releases tracks and worker", async () => {
  mockAssets(true); fakeWorkerMode = "not-detected"; permissionCalls = 0; trackStops = 0; workerTerminates = 0;
  const track = { stop() { trackStops++; } };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  setMedia(async () => { permissionCalls++; return stream; });
  const rendered = render(React.createElement(FaceAnalysis));
  await screen.findByText("Local model assets ready"); await grantConsent(); fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
  await screen.findByText("Face not currently visible");
  assert.equal(permissionCalls, 1);
  assert.equal(trackStops, 0);
  fireEvent.click(screen.getByRole("switch", { name: "Camera" }));
  await screen.findByText("Face detection is off");
  assert.equal(trackStops, 1);
  assert.ok(workerTerminates >= 1);
  cleanup(); rendered.container.remove();
});

test("leaving the feature stops an active camera session", async () => {
  mockAssets(true); trackStops = 0; workerTerminates = 0;
  const stream = { getTracks: () => [{ stop() { trackStops++; } }] } as unknown as MediaStream;
  setMedia(async () => stream);
  const rendered = render(React.createElement(FaceAnalysis)); await screen.findByText("Local model assets ready"); await grantConsent(); fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
  await screen.findByText("Camera on · frames processed on this device");
  cleanup(); rendered.container.remove();
  assert.equal(trackStops, 1); assert.ok(workerTerminates >= 1);
});

test("optional AI sharing is a separate opt-in and sends only a transient text summary locally", async () => {
  fakeWorkerMode = "movement"; localStorage.setItem("mindspace.local-settings.v1", JSON.stringify({ endpoint: "http://127.0.0.1:11434", model: "local-test", style: "friendly" }));
  const requests: { url: string; body?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
    if (url.startsWith("/mediapipe/")) return new Response(null, { status: 200 });
    if (url === "/api/ollama/models") return Response.json({ connected: true, models: [{ name: "local-test" }] });
    if (url === "/api/chat") return new Response(`data: ${JSON.stringify({ token: "How are you feeling right now?" })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    throw new Error(`Unexpected network target ${url}`);
  }) as typeof fetch;
  const stream = { getTracks: () => [{ stop() { trackStops++; } }] } as unknown as MediaStream; setMedia(async () => stream);
  const rendered = render(React.createElement(FaceAnalysis)); await screen.findByText("Local model assets ready"); await grantConsent(); fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
  await screen.findByText("Face detected · local processing");
  assert.ok(screen.getByRole("switch", { name: "Share expression summary with my AI companion" }).getAttribute("aria-checked") === "false");
  assert.equal(requests.some((item) => item.url === "/api/chat"), false);
  fireEvent.click(screen.getByRole("switch", { name: "Expression indicators" }));
  await screen.findByText("smile-related movement detected");
  fireEvent.click(screen.getByRole("switch", { name: "Share expression summary with my AI companion" }));
  fireEvent.click(await screen.findByRole("button", { name: "Send optional summary to local AI" }));
  await screen.findByText("How are you feeling right now?");
  const chat = JSON.parse(requests.find((item) => item.url === "/api/chat")!.body!) as { messages: { content: string }[]; memories: string[] };
  assert.match(chat.messages[0]!.content, /smile-related movement detected/i);
  assert.match(chat.messages[0]!.content, /Please ask how I am feeling/);
  assert.deepEqual(chat.memories, []);
  assert.doesNotMatch(chat.messages[0]!.content, /0\.25|0\.75|landmark coordinates|data:image/i);
  assert.ok(requests.every((item) => item.url.startsWith("/mediapipe/") || item.url === "/api/ollama/models" || item.url === "/api/chat"));
  cleanup(); rendered.container.remove();
});

after(() => { globalThis.fetch = originalFetch; cleanup(); dom.window.close(); });
