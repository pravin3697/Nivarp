// Native browser IndexedDB storage engine (Safe for SSR & Turbopack)
const DB_NAME = 'NivarpClientDB';
const STORE_NAME = 'journal_store';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, val: any): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function idbDelete(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function idbClear(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}