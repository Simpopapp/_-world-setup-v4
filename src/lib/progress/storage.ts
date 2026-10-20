// Armazenamento local resiliente (PRD D5): leitura/escrita versionadas, quarentena para dados
// ilegíveis ou de versão futura (nunca sobrescreve), detecção de quota e aviso preventivo.
import type { StorageLike } from "./storage-like";

/** Versão do envelope interno de cada registro. Versão futura → quarentena. */
export const STORAGE_VERSION = 1 as const;

export const KEYS = {
  snapshots: "pte-hub:v1:snapshots",
  aggregates: "pte-hub:v1:aggregates",
  log: "pte-hub:v1:log",
  meta: "pte-hub:v1:meta",
  studie: "pte-hub:v1:studie",
  quarantine: "pte-hub:v1:quarantine",
  importUndo: "pte-hub:v1:import-undo",
  sessions: "pte-hub:v1:sessions",
  notes: "pte-hub:v1:notes",
} as const;

interface Envelope<T> {
  v: number;
  data: T;
}

export type ReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "corrupt" | "future"; quarantined: boolean };

function quarantine(storage: StorageLike, key: string, raw: string): boolean {
  try {
    const existing = storage.getItem(KEYS.quarantine);
    const entries: Record<string, string> = existing
      ? (JSON.parse(existing) as Record<string, string>)
      : {};
    entries[key] = raw;
    storage.setItem(KEYS.quarantine, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/** Lê um registro versionado. Dados ilegíveis/versão futura vão para quarentena, nunca sobrescritos. */
export function readStore<T>(storage: StorageLike, key: string): ReadResult<T> {
  const raw = storage.getItem(key);
  if (raw === null || raw === "") return { ok: false, reason: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", quarantined: quarantine(storage, key, raw) };
  }
  const env = parsed as Partial<Envelope<T>> | null;
  if (!env || typeof env !== "object" || !("v" in env) || typeof env.v !== "number") {
    return { ok: false, reason: "corrupt", quarantined: quarantine(storage, key, raw) };
  }
  if (env.v > STORAGE_VERSION) {
    return { ok: false, reason: "future", quarantined: quarantine(storage, key, raw) };
  }
  if (!("data" in env)) {
    return { ok: false, reason: "corrupt", quarantined: quarantine(storage, key, raw) };
  }
  return { ok: true, value: env.data as T };
}

export type WriteResult = { ok: true } | { ok: false; quota: boolean };

/** Escreve um registro versionado; falha (inclusive quota) NUNCA é silenciosa. */
export function writeStore<T>(storage: StorageLike, key: string, value: T): WriteResult {
  const payload: Envelope<T> = { v: STORAGE_VERSION, data: value };
  try {
    storage.setItem(key, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name ?? "";
    return { ok: false, quota: name === "QuotaExceededError" || /quota/i.test(String(name)) };
  }
}

/** Tamanho aproximado (bytes UTF-8) de todas as chaves de progresso. */
export function storageUsageBytes(storage: StorageLike): number {
  const encoder = new TextEncoder();
  let total = 0;
  for (const key of Object.values(KEYS)) {
    const raw = storage.getItem(key);
    if (raw !== null) total += encoder.encode(key).length + encoder.encode(raw).length;
  }
  return total;
}

export const ESTIMATED_QUOTA_BYTES = 5 * 1024 * 1024; // limite prático do localStorage
export const QUOTA_WARN_FRACTION = 0.8;

export interface QuotaStatus {
  bytes: number;
  fraction: number;
  warn: boolean;
}

/** Aviso preventivo de quota: >80% do orçamento estimado (PRD D5). */
export function quotaStatus(storage: StorageLike): QuotaStatus {
  const bytes = storageUsageBytes(storage);
  const fraction = bytes / ESTIMATED_QUOTA_BYTES;
  return { bytes, fraction, warn: fraction >= QUOTA_WARN_FRACTION };
}
