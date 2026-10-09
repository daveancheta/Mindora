import "fake-indexeddb/auto";
import { strict as assert } from "node:assert";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { after, test } from "node:test";
import React from "react";
import { permanentlyDeleteVault, readVault, unlockVault } from "../src/lib/storage/encrypted-vault.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:3000/chat" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  Node: { value: dom.window.Node, configurable: true }, MutationObserver: { value: dom.window.MutationObserver, configurable: true }, localStorage: { value: dom.window.localStorage, configurable: true },
  crypto: { value: webcrypto, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
Object.defineProperty(dom.window, "crypto", { value: webcrypto, configurable: true });
(dom.window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number; cancelIdleCallback?: (id: number) => void }).requestIdleCallback = (callback) => dom.window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 0);
(dom.window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback = (id) => dom.window.clearTimeout(id);
Object.defineProperty(globalThis, "self", { value: dom.window, configurable: true });
(dom.window.HTMLElement.prototype as HTMLElement & { scrollTo?: () => void }).scrollTo = () => undefined;
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { LocalChat } = await import("../src/components/local-chat.tsx");
const passphrase = "ui-test-only-synthetic-passphrase-2026";
const originalFetch = globalThis.fetch;
let chatRequests = 0;

function mockFetch(mode: "online" | "offline" = "online") {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/ollama/models") {
      if (mode === "offline") return Response.json({ connected: false, models: [], error: "Ollama could not be reached. Check that the local Ollama app is running." }, { status: 503 });
      return Response.json({ connected: true, models: [{ name: "llama3.2:latest", size: 2_000_000_000 }] });
    }
    if (url === "/api/chat") {
      chatRequests += 1;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.endpoint, "http://127.0.0.1:11434");
      assert.equal(body.model, "llama3.2:latest");
      assert.equal(body.messages.at(-1).role, "user");
      const events = [
        { token: "Hey, hello! " }, { token: "How has your day been?" }, { done: true },
      ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
      return new Response(events, { headers: { "Content-Type": "text/event-stream" } });
    }
    throw new Error(`Unexpected client request: ${url}`);
  }) as typeof fetch;
}

async function unlockRenderedChat() {
  const { container } = render(React.createElement(LocalChat));
  const password = await screen.findByLabelText("Vault passphrase");
  fireEvent.change(password, { target: { value: passphrase } });
  fireEvent.submit(password.closest("form")!);
  await screen.findAllByText("A space to talk");
  return container;
}

test("chat UI reports a stopped Ollama service without enabling message sending", async () => {
  mockFetch("offline");
  const container = await unlockRenderedChat();
  await screen.findByText("Ollama isn’t responding");
  assert.equal((screen.getByRole("textbox", { name: "Your message" }) as HTMLTextAreaElement).disabled, true);
  cleanup();
  container.remove();
  await permanentlyDeleteVault();
});

test("a conversation streams, persists encrypted, and can be recovered after remount", async () => {
  mockFetch("online");
  chatRequests = 0;
  const container = await unlockRenderedChat();
  await screen.findByText("Ollama connected");
  const input = screen.getByRole("textbox", { name: "Your message" });
  fireEvent.change(input, { target: { value: "I finally finished my garden project" } });
  fireEvent.submit(input.closest("form")!);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(chatRequests, 1);
  await screen.findByRole("button", { name: "Copy response" });
  assert.match(document.querySelector(".markdown")?.textContent ?? "", /Hey, hello! How has your day been/);
  assert.ok(screen.getAllByText("I finally finished my garden project").length >= 1);
  const key = (await unlockVault(passphrase)).key;
  const saved = await readVault(key);
  assert.equal(saved.conversations.length, 1);
  assert.match(saved.conversations[0]!.title, /I finally finished/);
  assert.equal(saved.conversations[0]!.messages.length, 2);
  assert.match(saved.conversations[0]!.messages[1]!.content, /How has your day been/);

  cleanup(); container.remove();
  const restoredContainer = render(React.createElement(LocalChat)).container;
  const password = await screen.findByLabelText("Vault passphrase");
  fireEvent.change(password, { target: { value: passphrase } });
  fireEvent.submit(password.closest("form")!);
  await screen.findByRole("button", { name: "Copy response" });
  assert.match(document.querySelector(".markdown")?.textContent ?? "", /Hey, hello! How has your day been/);
  assert.ok(screen.getAllByText("I finally finished my garden project").length >= 1);
  cleanup(); restoredContainer.remove();
  await permanentlyDeleteVault();
});

after(async () => { globalThis.fetch = originalFetch; cleanup(); try { await permanentlyDeleteVault(); } catch { /* Test cleanup only. */ } dom.window.close(); });
