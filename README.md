# MindSpace AI

A local-first companion that routes chat only to a loopback Ollama service. No cloud model, analytics SDK, account system, or remote data store is configured.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use `npm run typecheck`, `npm run lint`, and `npm run build` for checks.

## Foundation layout

- `src/app/api/chat`: validated same-origin streaming relay to Ollama's local `/api/chat` endpoint.
- `src/app/api/ollama/models`: lists installed local chat models through `/api/tags`; there are no model-management routes.
- `src/lib/ai`: loopback validation, request schemas, companion prompt, and model-independent safety routing.
- `src/components/local-chat.tsx`: conversation controls, model/style settings, explicit memories, and local export.
- `src/lib/storage/encrypted-vault.ts`: encrypted IndexedDB vault.

## Local data and privacy boundary

Conversation history and user-authored memories are encrypted in the browser's IndexedDB with AES-256-GCM. A passphrase is converted to an encryption key using PBKDF2 (310,000 SHA-256 iterations). The passphrase and key are not persisted; the key is held only in the current tab's memory. Reloading requires unlocking the vault again. A forgotten passphrase cannot be reset. Export creates a plaintext JSON file only after the user explicitly chooses Export.

The server does not store conversations. For each chat request, the browser sends the active conversation context, selected style, and enabled memories to this app's loopback-only API relay. The relay forwards them to the user's loopback Ollama endpoint. Do not expose the Next.js server or Ollama port to a network. This is at-rest protection against copied browser storage, not protection from malware, a compromised browser/extension, a person using an unlocked tab, weak passphrases, or unencrypted exports/backups. IndexedDB is not inherently encrypted; the application encrypts its vault records before writing them.

The app only checks installed models and streams chat. It never invokes Ollama model download/delete operations and never falls back to cloud inference. By default, only port `11434` is accepted. For an intentionally custom local Ollama port, configure a private server environment variable such as `OLLAMA_ALLOWED_PORTS=11434,11435`; the browser setting must still use a loopback IP and an allowed port. Ensure the Ollama model itself is local and use Ollama's own controls for its service exposure.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

To test the full API workflow with a running local Ollama instance and the installed `llama3.2:latest` model, start `npm run dev` in one terminal and run `npm run test:chat` in another. The test sends only a short synthetic greeting prompt to the local model.
