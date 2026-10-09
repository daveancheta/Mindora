import { DEFAULT_VAULT, type VaultData } from "@/lib/chat/types";

const DB_NAME = "mindspace-private-vault";
const STORE = "sealed-record";
const ID = "vault";
const CHECK = "MindSpace private vault key check · v1";
type Sealed = { id: string; salt: number[]; checkIv: number[]; check: number[]; iv: number[]; data: number[] };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Encrypted browser storage is unavailable in this environment."));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open encrypted local storage."));
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode); const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error("Could not access the encrypted vault."));
    tx.oncomplete = () => db.close(); tx.onerror = () => reject(new Error("Could not write the encrypted vault."));
  });
}
function bytes(values: number[]): Uint8Array<ArrayBuffer> { return Uint8Array.from(values); }
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
}
async function decrypt(key: CryptoKey, iv: number[], data: number[]) { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv) }, key, bytes(data))); }

/** Creates the vault once, or unlocks it. The raw password and CryptoKey never leave this tab. */
export async function unlockVault(passphrase: string): Promise<{ key: CryptoKey; isNew: boolean }> {
  if (passphrase.length < 12 || passphrase.length > 256) throw new Error("Use a passphrase between 12 and 256 characters.");
  const existing = await transact<Sealed | undefined>("readonly", (store) => store.get(ID));
  if (existing) {
    try { const key = await derive(passphrase, bytes(existing.salt)); const plaintext = await decrypt(key, existing.checkIv, existing.check); if (new TextDecoder().decode(plaintext) !== CHECK) throw new Error(); return { key, isNew: false }; }
    catch { throw new Error("That passphrase did not unlock this vault. It cannot be reset because the app never stores it."); }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await derive(passphrase, salt);
  const check = await encrypt(key, new TextEncoder().encode(CHECK)); const vault = await encrypt(key, new TextEncoder().encode(JSON.stringify(DEFAULT_VAULT)));
  await transact<IDBValidKey>("readwrite", (store) => store.put({ id: ID, salt: Array.from(salt), checkIv: check.iv, check: check.data, ...vault } satisfies Sealed));
  return { key, isNew: true };
}
export async function vaultExists() { return Boolean(await transact<Sealed | undefined>("readonly", (store) => store.get(ID))); }
export async function readVault(key: CryptoKey): Promise<VaultData> {
  const record = await transact<Sealed | undefined>("readonly", (store) => store.get(ID));
  if (!record) throw new Error("The encrypted vault was deleted. Create a new one to continue.");
  try {
    const raw = JSON.parse(new TextDecoder().decode(await decrypt(key, record.iv, record.data))) as Partial<VaultData>;
    if (!Array.isArray(raw.conversations) || !Array.isArray(raw.memories) || typeof raw.memoryEnabled !== "boolean") throw new Error();
    return raw as VaultData;
  } catch { throw new Error("The encrypted vault could not be read. Your data has not been changed."); }
}
export async function writeVault(key: CryptoKey, vault: VaultData) {
  const current = await transact<Sealed | undefined>("readonly", (store) => store.get(ID));
  if (!current) throw new Error("The vault was deleted. Create a new vault before saving.");
  const sealed = await encrypt(key, new TextEncoder().encode(JSON.stringify(vault)));
  await transact<IDBValidKey>("readwrite", (store) => store.put({ ...current, ...sealed } satisfies Sealed));
}
export async function permanentlyDeleteVault() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME); request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Could not permanently delete the local vault."));
    request.onblocked = () => reject(new Error("Close other MindSpace tabs, then try deleting the vault again."));
  });
}
