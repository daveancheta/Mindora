export interface StorageAdapter { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T): Promise<void>; remove(key: string): Promise<void>; }
/** Browser local storage is accessed only after a client calls these methods. */
export const browserStorage: StorageAdapter = {
  async get<T>(key: string) { if (typeof window === "undefined") return null; const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : null; },
  async set<T>(key: string, value: T) { if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value)); },
  async remove(key: string) { if (typeof window !== "undefined") window.localStorage.removeItem(key); },
};
