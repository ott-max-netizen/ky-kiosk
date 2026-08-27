import type { DashboardData } from "../data/types";
import { validateCachedDashboard } from "../data/validate";

const DB_NAME = "ku-infoekraan";
const DB_STORE = "cache";
const DB_KEY = "dashboard-data-v6";
const OPEN_TIMEOUT_MS = 5_000;

/**
 * Avab andmebaasi ja tagastab ühenduse. `onblocked` käivitub siis, kui mõni teine
 * sakk hoiab vana versiooni lahti; ilma ajalimiidita jäi lubadus sellisel juhul
 * igaveseks rippuma ja `bootstrap` ei jõudnud kunagi sünkroonimiseni.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      action();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error("IndexedDB avamine aegus"))),
      OPEN_TIMEOUT_MS,
    );
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error("IndexedDB ei ole saadaval")));
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () =>
      finish(() => {
        const db = request.result;
        // Kui mõni teine sakk uuendab skeemi, sulge ühendus, et mitte blokeerida.
        db.onversionchange = () => db.close();
        resolve(db);
      });
    request.onerror = () => finish(() => reject(request.error ?? new Error("IndexedDB avamine ebaõnnestus")));
    request.onblocked = () => finish(() => reject(new Error("IndexedDB on teise sakiga blokeeritud")));
  });
}

/**
 * Kuvatavate andmete viimane teadaolev hea koopia (C-25).
 *
 * Contract: DB `ku-infoekraan`, store `cache`, võti `dashboard-data-v6`.
 */
export class DashboardRepository {
  async get(): Promise<DashboardData | null> {
    let db: IDBDatabase | null = null;
    try {
      db = await openDatabase();
      const connection = db;
      const value = await new Promise<unknown>((resolve, reject) => {
        const transaction = connection.transaction(DB_STORE, "readonly");
        const request = transaction.objectStore(DB_STORE).get(DB_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error("Vahemälu lugemine ebaõnnestus"));
        transaction.onabort = () => reject(transaction.error ?? new Error("Vahemälu lugemine katkes"));
      });
      return validateCachedDashboard(value);
    } catch {
      return null;
    } finally {
      // Varem jäi see ainult õnnestunud teele: iga lugemisviga lekitas ühenduse
      // ja nädalate pikkuse sessiooni jooksul kuhjusid need.
      db?.close();
    }
  }

  async set(value: DashboardData): Promise<void> {
    let db: IDBDatabase | null = null;
    try {
      db = await openDatabase();
      const connection = db;
      await new Promise<void>((resolve, reject) => {
        const transaction = connection.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(value, DB_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Vahemällu salvestamine ebaõnnestus"));
        transaction.onabort = () => reject(transaction.error ?? new Error("Vahemällu salvestamine katkes"));
      });
    } finally {
      db?.close();
    }
  }
}

export const DASHBOARD_CACHE_CONTRACT = { dbName: DB_NAME, store: DB_STORE, key: DB_KEY } as const;
