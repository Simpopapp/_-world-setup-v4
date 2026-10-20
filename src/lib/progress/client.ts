// Cliente de progresso do navegador (PRD D5): repositório único sobre localStorage.
// No SSR usa storage em memória (progresso só é lido/gravado no browser, nunca renderizado).
import { createProgressRepository, type ProgressRepository } from "./repository";
import type { StorageLike } from "./storage-like";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function defaultStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      // Sonda de disponibilidade (alguns modos privados lançam ao gravar).
      const probe = "pte-hub::probe";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // cai para memória
  }
  return memoryStorage();
}

export const progress: ProgressRepository = createProgressRepository(defaultStorage());

/** Assinatura simples de mudança de progresso para reativar widgets na UI. */
const listeners = new Set<() => void>();

export function notifyProgressChanged(): void {
  for (const listener of listeners) listener();
}

export function onProgressChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
