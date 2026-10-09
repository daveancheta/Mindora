import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.MINDSPACE_TEST_URL ?? "http://127.0.0.1:3000";
const origin = base;
const post = (route, body, headers = {}) => fetch(`${base}${route}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(190_000) });

test("Ollama is reachable and lists installed chat models", async () => {
  const response = await post("/api/ollama/models", { endpoint: "http://127.0.0.1:11434" });
  if (response.status !== 200) assert.fail(`Ollama model list failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  assert.equal(data.connected, true);
  assert.ok(data.models.some((model) => model.name === "llama3.2:latest"), "Expected installed local Llama model");
  assert.equal(data.models.some((model) => model.name.includes("nomic-embed")), false, "Embedding model should not be offered for chat");
});

test("malicious endpoint and cross-origin requests are rejected before network access", async () => {
  const external = await post("/api/ollama/models", { endpoint: "http://example.com" });
  assert.equal(external.status, 400);
  const foreignOrigin = await post("/api/ollama/models", { endpoint: "http://127.0.0.1:11434" }, { Origin: "https://untrusted.invalid" });
  assert.equal(foreignOrigin.status, 403);
  const noOrigin = await fetch(`${base}/api/ollama/models`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: "http://127.0.0.1:11434" }) });
  assert.equal(noOrigin.status, 403);
});

test("stopped Ollama is accurately shown as unavailable", async (context) => {
  const response = await post("/api/ollama/models", { endpoint: "http://[::1]:11434" });
  if (response.status === 200) return context.skip("Ollama is also listening on IPv6 loopback in this environment.");
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.connected, false);
  assert.match(data.error, /could not be reached|running/i);
  assert.deepEqual(data.models, []);
});

test("uninstalled model is rejected and urgent safety response does not depend on model availability", async () => {
  const uninstalled = await post("/api/chat", { endpoint: "http://127.0.0.1:11434", model: "not-installed-please-do-not-download", style: "friendly", messages: [{ role: "user", content: "Hello there" }], memories: [] });
  assert.equal(uninstalled.status, 409);
  const urgent = await post("/api/chat", { endpoint: "http://127.0.0.1:11434", model: "not-installed-please-do-not-download", style: "friendly", messages: [{ role: "user", content: "I'm going to kill myself tonight" }], memories: [] });
  assert.equal(urgent.status, 200);
  const body = await urgent.text();
  assert.match(body, /"safety":"urgent"/);
  assert.match(body, /local emergency number/i);
});

test("full conversation streams a real response from the selected local Ollama model", { timeout: 190_000 }, async () => {
  const response = await post("/api/chat", { endpoint: "http://127.0.0.1:11434", model: "llama3.2:latest", style: "friendly", messages: [{ role: "user", content: "In one brief friendly sentence, say hello and ask how my day is going." }], memories: [] });
  if (response.status !== 200) assert.fail(`Local chat failed: ${response.status} ${await response.text()}`);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const events = (await response.text()).split("\n\n").filter(Boolean).map((frame) => JSON.parse(frame.replace(/^data:\s*/, "")));
  const answer = events.map((entry) => entry.token ?? "").join("");
  assert.ok(answer.trim().length > 3, "Ollama should return generated text");
  assert.equal(events.at(-1)?.done, true, "Stream should end cleanly");
  assert.equal(events.some((entry) => entry.error), false);
});
