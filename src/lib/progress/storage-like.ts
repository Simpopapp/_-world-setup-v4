// Contrato mínimo de storage (jsdom e navegadores o satisfazem; testes podem usar um fake).
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
