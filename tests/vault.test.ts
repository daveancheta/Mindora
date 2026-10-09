import "fake-indexeddb/auto";
import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import { permanentlyDeleteVault, readVault, unlockVault, vaultExists, writeVault } from "../src/lib/storage/encrypted-vault.ts";

const passphrase = "test-only-random-vault-passphrase-2026";

test("encrypted vault creates, encrypts, reloads, rejects wrong passphrases, and permanently deletes", async () => {
  assert.equal(await vaultExists(), false);
  const created = await unlockVault(passphrase);
  assert.equal(created.isNew, true);
  const initial = await readVault(created.key);
  initial.conversations.push({ id: "test-convo", title: "Synthetic hello", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), messages: [{ id: "m1", role: "user", content: "Synthetic private content for storage test", createdAt: new Date(0).toISOString() }] });
  initial.memories.push({ id: "memory1", text: "Synthetic explicit memory", updatedAt: new Date(0).toISOString() });
  initial.memoryEnabled = true;
  await writeVault(created.key, initial);

  const rawDatabase = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("mindspace-private-vault", 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const rawRecord = await new Promise<unknown>((resolve, reject) => { const req = rawDatabase.transaction("sealed-record", "readonly").objectStore("sealed-record").get("vault"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  rawDatabase.close();
  assert.equal(JSON.stringify(rawRecord).includes("Synthetic private content for storage test"), false);
  assert.equal(JSON.stringify(rawRecord).includes("Synthetic explicit memory"), false);

  await assert.rejects(unlockVault("wrong-test-passphrase-2026"), /did not unlock/);
  const unlocked = await unlockVault(passphrase);
  assert.equal(unlocked.isNew, false);
  const restored = await readVault(unlocked.key);
  assert.equal(restored.conversations[0]?.messages[0]?.content, "Synthetic private content for storage test");
  assert.equal(restored.memories[0]?.text, "Synthetic explicit memory");
  assert.equal(restored.memoryEnabled, true);

  await permanentlyDeleteVault();
  assert.equal(await vaultExists(), false);
});

after(async () => { try { if (await vaultExists()) await permanentlyDeleteVault(); } catch { /* Test cleanup only. */ } });
