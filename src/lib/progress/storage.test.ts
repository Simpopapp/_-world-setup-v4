import { describe, expect, it } from "vitest";
import { KEYS, quotaStatus, readStore, storageUsageBytes, writeStore } from "./storage";
import type { StorageLike } from "./storage-like";

function fakeStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe("storage versionado", () => {
  it("leitura vazia é 'empty' (não erro)", () => {
    expect(readStore(fakeStorage(), KEYS.meta)).toEqual({ ok: false, reason: "empty" });
  });

  it("escrita e leitura em roundtrip preservam o valor", () => {
    const storage = fakeStorage();
    expect(writeStore(storage, KEYS.meta, { targetScore: 79 })).toEqual({ ok: true });
    const res = readStore<{ targetScore?: number }>(storage, KEYS.meta);
    expect(res).toEqual({ ok: true, value: { targetScore: 79 } });
  });

  it("JSON ilegível vai para quarentena e NÃO é sobrescrito", () => {
    const storage = fakeStorage({ [KEYS.meta]: "{não é json" });
    const res = readStore(storage, KEYS.meta);
    expect(res.ok).toBe(false);
    if (!res.ok && "quarantined" in res) expect(res.quarantined).toBe(true);
    const quarantine = JSON.parse(storage.getItem(KEYS.quarantine) ?? "{}") as Record<
      string,
      string
    >;
    expect(quarantine[KEYS.meta]).toBe("{não é json");
  });

  it("versão futura vai para quarentena", () => {
    const storage = fakeStorage({
      [KEYS.aggregates]: JSON.stringify({ v: 99, data: { x: 1 } }),
    });
    const res = readStore(storage, KEYS.aggregates);
    expect(res.ok).toBe(false);
    if (!res.ok && "reason" in res) expect(res.reason).toBe("future");
    expect(storage.getItem(KEYS.quarantine)).not.toBeNull();
  });

  it("registro sem envelope (JSON válido mas sem v/data) é 'corrupt'", () => {
    const storage = fakeStorage({ [KEYS.log]: "[1,2,3]" });
    const res = readStore(storage, KEYS.log);
    expect(res.ok).toBe(false);
    if (!res.ok && "reason" in res) expect(res.reason).toBe("corrupt");
  });

  it("falha de quota é reportada (nunca silenciosa)", () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      const e = new Error("exceeded");
      e.name = "QuotaExceededError";
      throw e;
    };
    const res = writeStore(storage, KEYS.snapshots, { a: 1 });
    expect(res).toEqual({ ok: false, quota: true });
  });

  it("uso e aviso preventivo de quota (80%)", () => {
    const storage = fakeStorage({ [KEYS.meta]: "x".repeat(100) });
    expect(storageUsageBytes(storage)).toBeGreaterThan(0);
    const status = quotaStatus(storage);
    expect(status.warn).toBe(false);
    const big = fakeStorage({ [KEYS.snapshots]: "x".repeat(4 * 1024 * 1024) });
    expect(quotaStatus(big).warn).toBe(true);
  });
});
