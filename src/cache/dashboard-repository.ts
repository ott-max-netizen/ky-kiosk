import type { DashboardData } from "../data/types";
import { validateCachedDashboard } from "../data/validate";

const DB_NAME = "ku-infoekraan";
const DB_STORE = "cache";
const DB_KEY = "dashboard-data-v6";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB avamine ebaõnnestus"));
  });
}

export class DashboardRepository {
  async get(): Promise<DashboardData | null> {
    try {
      const db = await openDatabase();
      const value = await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readonly");
        const request = transaction.objectStore(DB_STORE).get(DB_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error("Vahemälu lugemine ebaõnnestus"));
      });
      db.close();
      return validateCachedDashboard(value);
    } catch {
      return null;
    }
  }

  async set(value: DashboardData): Promise<void> {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(value, DB_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Vahemällu salvestamine ebaõnnestus"));
      });
    } finally {
      db.close();
    }
  }
}

export const DASHBOARD_CACHE_CONTRACT = { dbName: DB_NAME, store: DB_STORE, key: DB_KEY } as const;
