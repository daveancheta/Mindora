let sessionKey: CryptoKey | null = null;
const LOCK_EVENT = "mindspace:lock-vault";

export function getVaultSessionKey() { return sessionKey; }
export function setVaultSessionKey(key: CryptoKey) { sessionKey = key; }
export function lockVaultSession() {
  sessionKey = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCK_EVENT));
}
export function vaultLockEvent() { return LOCK_EVENT; }
