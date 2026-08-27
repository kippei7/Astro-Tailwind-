import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { connection } from "next/server";
import { createSeed } from "./seed";
import type { StoreData } from "./types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => T): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function ensureStoreFile(): void {
  if (existsSync(STORE_PATH)) return;
  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(createSeed(), null, 2), "utf8");
}

function readStoreSync(): StoreData {
  ensureStoreFile();
  const raw = readFileSync(STORE_PATH, "utf8");
  return JSON.parse(raw) as StoreData;
}

function writeStoreSync(store: StoreData): void {
  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getStore(): Promise<StoreData> {
  await connection();
  return enqueue(() => readStoreSync());
}

export async function updateStore(
  updater: (store: StoreData) => StoreData,
): Promise<StoreData> {
  await connection();
  return enqueue(() => {
    const next = updater(readStoreSync());
    writeStoreSync(next);
    return next;
  });
}

export async function resetStore(): Promise<StoreData> {
  await connection();
  return enqueue(() => {
    const seeded = createSeed();
    writeStoreSync(seeded);
    return seeded;
  });
}
