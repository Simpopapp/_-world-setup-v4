// Fila do dia real (Fase 7 — PRD D6/s8.3): derivação PURA da fila de revisões vencidas.
// A fila reflete o SRS: somente itens com dueAt vencido entram, na ordem do vencimento mais antigo.
import type { QuestionSnapshot } from "./types";

/** Itens vencidos, ordenados por dueAt (mais antigo primeiro; empate = qid estável), com teto. */
export function buildDueQueue(
  snapshots: Record<string, QuestionSnapshot>,
  now: number,
  options: { limit?: number } = {},
): string[] {
  const limit = options.limit ?? 30;
  return Object.values(snapshots)
    .filter((snapshot) => snapshot.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0))
    .slice(0, limit)
    .map((snapshot) => snapshot.qid);
}
