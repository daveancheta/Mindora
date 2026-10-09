"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { DEFAULT_VAULT, type VaultData } from "@/lib/chat/types";
import { readVault, unlockVault, vaultExists, writeVault } from "@/lib/storage/encrypted-vault";
import { getVaultSessionKey, setVaultSessionKey, vaultLockEvent } from "@/lib/storage/vault-session";

type VaultContextValue = { vault: VaultData; save: (next: VaultData) => Promise<void>; key: CryptoKey };
const VaultContext = createContext<VaultContextValue | null>(null);

export function PrivateVaultGate({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null); const [vault, setVault] = useState(DEFAULT_VAULT);
  const [loading, setLoading] = useState(true); const [exists, setExists] = useState(false); const [passphrase, setPassphrase] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void vaultExists().then((found) => { if (active) setExists(found); }).catch(() => { if (active) setError("Encrypted browser storage is unavailable. Enable IndexedDB in this browser."); });
    const session = getVaultSessionKey();
    if (session) void readVault(session).then((data) => { if (active) { setKey(session); setVault(data); } }).catch((cause: Error) => { if (active) { setError(cause.message); setKey(null); } }).finally(() => { if (active) setLoading(false); });
    else setLoading(false);
    const clear = () => { setKey(null); setVault(DEFAULT_VAULT); setPassphrase(""); };
    window.addEventListener(vaultLockEvent(), clear);
    return () => { active = false; window.removeEventListener(vaultLockEvent(), clear); };
  }, []);
  const save = useCallback(async (next: VaultData) => { if (!key) throw new Error("Unlock your private vault before saving."); await writeVault(key, next); setVault(next); }, [key]);
  const value = useMemo(() => key ? { key, vault, save } : null, [key, vault, save]);
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const result = await unlockVault(passphrase); const data = await readVault(result.key); setVaultSessionKey(result.key); setKey(result.key); setVault(data); setExists(true); setPassphrase(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not unlock the encrypted vault."); }
    finally { setLoading(false); }
  }
  if (value) return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
  return <div className="vault-gate"><form className="vault-card" onSubmit={(event) => void unlock(event)}><LockKeyhole className="vault-icon"/><h2>{exists ? "Unlock your private space" : "Create your private space"}</h2><p>Your journal, mood entries, and assessment answers are encrypted on this device. The same passphrase unlocks your conversations. It is never stored by MindSpace.</p><label className="field-label" htmlFor="private-vault-key">Vault passphrase</label><input id="private-vault-key" className="field-input" type="password" autoComplete="current-password" minLength={12} maxLength={256} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="At least 12 characters" disabled={loading}/>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary" disabled={loading || passphrase.length < 12}>{loading ? "Unlocking…" : exists ? "Unlock encrypted data" : "Create encrypted vault"}</button><p className="security-note smalltext muted">A forgotten passphrase cannot be reset. Locking removes the key from this tab’s memory.</p></form></div>;
}

export function usePrivateVault() { const value = useContext(VaultContext); if (!value) throw new Error("This feature needs the private vault gate."); return value; }
