"use client";

// Scans made while the desk is offline wait in IndexedDB (they survive a reload or a closed tab) and are sent,
// with the time they were scanned, once the connection is back.

export type QueuedScan = { id?: number; conferenceId: string; code: string; scannedAt: string };

const DB = "cm-checkin";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function enqueue(scan: Omit<QueuedScan, "id">): Promise<void> {
  await run("readwrite", (store) => store.add(scan));
}

/** The waiting scans for one conference, oldest first. */
export async function pending(conferenceId: string): Promise<QueuedScan[]> {
  const all = await run<QueuedScan[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedScan[]>);
  return all.filter((s) => s.conferenceId === conferenceId).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function remove(id: number): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
