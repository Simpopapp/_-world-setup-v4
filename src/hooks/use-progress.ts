// Hooks de progresso: leitura SEMPRE em useEffect (nunca no render — SSR não tem localStorage).
import { useEffect, useState } from "react";
import { notifyProgressChanged, onProgressChanged, progress } from "@/lib/progress/client";
import type {
  PracticeSession,
  ProgressAggregates,
  QuestionSnapshot,
  StudentMeta,
} from "@/lib/progress/types";

/** Re-render em qualquer mudança de progresso. */
export function useProgressRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => onProgressChanged(() => setRevision((r) => r + 1)), []);
  return revision;
}

/** Contagem da fila do dia (itens vencidos) — o badge global. */
export function useDueCount(): number {
  const revision = useProgressRevision();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(dueCount());
  }, [revision]);
  return count ?? 0;
}

export function dueCount(): number {
  const now = Date.now();
  const snapshots = progress.allSnapshots();
  return Object.values(snapshots).filter((s) => s.dueAt <= now).length;
}

/** Snapshots por tipo (para diagnóstico/fila). */
export function useSnapshots(): Record<string, QuestionSnapshot> | null {
  const revision = useProgressRevision();
  const [snapshots, setSnapshots] = useState<Record<string, QuestionSnapshot> | null>(null);
  useEffect(() => {
    setSnapshots(progress.allSnapshots());
  }, [revision]);
  return snapshots;
}

export function useAggregates(): ProgressAggregates | null {
  const revision = useProgressRevision();
  const [aggregates, setAggregates] = useState<ProgressAggregates | null>(null);
  useEffect(() => {
    setAggregates(progress.getAggregates());
  }, [revision]);
  return aggregates;
}

/** Sessões retomáveis (Fase 7), mais recentes primeiro. */
export function useSessions(): PracticeSession[] | null {
  const revision = useProgressRevision();
  const [sessions, setSessions] = useState<PracticeSession[] | null>(null);
  useEffect(() => {
    setSessions(progress.listSessions());
  }, [revision]);
  return sessions;
}

export function useMeta(): StudentMeta | null {
  const revision = useProgressRevision();
  const [meta, setMeta] = useState<StudentMeta | null>(null);
  useEffect(() => {
    setMeta(progress.getMeta());
  }, [revision]);
  return meta;
}

/** Wrapper que grava e notifica os widgets. */
export function recordAndNotify(
  input: Parameters<typeof progress.recordAttempt>[0],
  now?: number,
): { ok: boolean; quota?: boolean } {
  const res = progress.recordAttempt(input, now);
  if (res.ok) notifyProgressChanged();
  return res;
}
