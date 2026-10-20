// Helpers derivados do manifesto — TODA contagem exibida passa por aqui (PRD D4).
import { bankManifest, type BankManifest } from "@/data/manifest.generated";
import type { Provenance, Section, TaskType } from "@/domain/types";
import { TASK_CATALOG, TASK_BY_ID } from "@/domain/task-catalog";

export type { BankManifest };
export const bank = bankManifest;

/** Contagem de questões de um tipo (0 = tipo "em breve"). */
export function countForType(type: TaskType): number {
  return bank.byType[type] ?? 0;
}

/** Um tipo está disponível para prática só se tiver ao menos 1 questão no banco. */
export function isTypeAvailable(type: TaskType): boolean {
  return countForType(type) > 0;
}

export function countForSection(section: Section): number {
  return bank.bySection[section] ?? 0;
}

export function countForProvenance(provenance: Provenance): number {
  return bank.byProvenance[provenance] ?? 0;
}

/** Catálogo enriquecido com as contagens derivadas do manifesto (nunca números fixos). */
export interface CatalogEntry {
  def: (typeof TASK_CATALOG)[number];
  count: number;
  available: boolean;
}

export function catalogEntries(): CatalogEntry[] {
  return TASK_CATALOG.map((def) => ({
    def,
    count: countForType(def.id),
    available: isTypeAvailable(def.id),
  }));
}

export const TASK_TYPES: TaskType[] = TASK_CATALOG.map((t) => t.id);

export function assertCatalogMatchesBank(): void {
  for (const def of TASK_CATALOG) {
    if (!(def.id in bank.byType)) {
      throw new Error(`tipo do catálogo ausente no manifesto: ${def.id}`);
    }
  }
  if (TASK_BY_ID.size !== TASK_CATALOG.length) {
    throw new Error("catálogo com ids duplicados");
  }
}
