// Aisha: keeps the last dashboard data on this device (IndexedDB), so the app opens instantly
// and only asks the server for what changed. Every call is best-effort: failures just mean no cache.
const DB = "aisha-dashboard", STORE = "snap", KEY = "v1";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSnapshot<T>(): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>(resolve => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve((r.result as T) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function saveSnapshot(value: unknown) {
  try {
    const db = await open();
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {}
}

export async function clearSnapshot() {
  try {
    const db = await open();
    await new Promise<void>(resolve => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch {}
}
