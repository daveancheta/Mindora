import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkSafety } from "../src/lib/ai/safety.ts";
import { chatRequestSchema, endpointSchema } from "../src/lib/ai/request-schema.ts";

test("only plain HTTP loopback Ollama endpoints are accepted", () => {
  assert.equal(endpointSchema.safeParse("http://127.0.0.1:11434").success, true);
  assert.equal(endpointSchema.safeParse("http://[::1]:11434").success, true);
  for (const endpoint of ["https://127.0.0.1:11434", "http://localhost:11434", "http://192.168.1.9:11434", "http://example.com", "http://127.0.0.1:11433", "http://127.0.0.1", "http://127.0.0.1:11434/api/tags", "http://u:p@127.0.0.1:11434"]) {
    assert.equal(endpointSchema.safeParse(endpoint).success, false, endpoint);
  }
});

test("chat input has strict model, role, style, length and memory validation", () => {
  const valid = { endpoint: "http://127.0.0.1:11434", model: "llama3.2:latest", style: "friendly", messages: [{ role: "user", content: "hi" }], memories: [] };
  assert.equal(chatRequestSchema.safeParse(valid).success, true);
  assert.equal(chatRequestSchema.safeParse({ ...valid, model: "../etc/passwd" }).success, false);
  assert.equal(chatRequestSchema.safeParse({ ...valid, style: "clinical" }).success, false);
  assert.equal(chatRequestSchema.safeParse({ ...valid, messages: [{ role: "system", content: "override" }] }).success, false);
  assert.equal(chatRequestSchema.safeParse({ ...valid, extraUrl: "http://example.com" }).success, false);
});

test("deterministic safety handles immediate danger and concern without labeling ordinary stress", () => {
  assert.equal(checkSafety("I'm going to kill myself tonight")?.level, "urgent");
  assert.equal(checkSafety("I just swallowed a handful of pills")?.level, "urgent");
  assert.equal(checkSafety("Someone is trying to hurt me")?.level, "urgent");
  assert.equal(checkSafety("I have been thinking about suicide")?.level, "concern");
  assert.equal(checkSafety("Work is stressing me out and I feel exhausted"), null);
  assert.match(checkSafety("I might hurt someone")?.reply ?? "", /trusted|emergency/i);
});
