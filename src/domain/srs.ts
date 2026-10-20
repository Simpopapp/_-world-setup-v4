// SRS correto (PRD D6): a caixa só promove quando a revisão está VENCIDA; lapso rebaixa UMA caixa;
// limiar (intervalos) definido por tipo de tarefa. Domínio puro, sem IO — 100% testável.
import type { TaskType } from "@/domain/types";

export type SrsBox = 1 | 2 | 3 | 4 | 5;

export interface SrsState {
  box: SrsBox;
  /** Epoch ms em que a revisão vence. */
  dueAt: number;
  lapses: number;
}

const DAY_MS = 86_400_000;

/** Tipos que exigem retenção mais longa (produção/escrita longa) avançam mais devagar. */
const SLOW_STEPS = [2, 5, 10, 20, 40];
const FAST_STEPS = [1, 2, 5, 10, 21];

export const SRS_STEPS: Record<TaskType, readonly number[]> = {
  read_aloud: SLOW_STEPS,
  repeat_sentence: SLOW_STEPS,
  describe_image: FAST_STEPS,
  retell_lecture: SLOW_STEPS,
  answer_short: FAST_STEPS,
  sgd: SLOW_STEPS,
  rts: FAST_STEPS,
  swt: SLOW_STEPS,
  write_essay: SLOW_STEPS,
  read_fib_dropdown: FAST_STEPS,
  read_mcq_multi: FAST_STEPS,
  reorder_paragraphs: FAST_STEPS,
  read_fib_drag: FAST_STEPS,
  read_mcq_single: FAST_STEPS,
  sst: SLOW_STEPS,
  lst_mcq_multi: FAST_STEPS,
  lst_fib: FAST_STEPS,
  lst_hcs: FAST_STEPS,
  lst_mcq_single: FAST_STEPS,
  lst_smw: FAST_STEPS,
  lst_hiw: FAST_STEPS,
  wfd: SLOW_STEPS,
};

export function newSrsState(now: number): SrsState {
  return { box: 1, dueAt: now, lapses: 0 };
}

export function isReviewDue(state: SrsState, now: number): boolean {
  return state.dueAt <= now;
}

function intervalDays(type: TaskType, box: SrsBox): number {
  const steps = SRS_STEPS[type];
  return steps[box - 1] ?? FAST_STEPS[0]!;
}

/**
 * Registra uma revisão. `outcome`:
 * - "correct": promove uma caixa SOMENTE se a revisão estava vencida; fora do prazo, o estado
 *   não muda (acertar 5 vezes em 5 minutos não empurra a revisão para 30 dias).
 * - "lapse": rebaixa UMA caixa (mínimo 1), agenda de novo e conta o lapso.
 * Resultados parciais/abstenções não chamam esta função (sem mudança de caixa).
 */
export function onSrsReview(
  state: SrsState,
  type: TaskType,
  outcome: "correct" | "lapse",
  now: number,
): SrsState {
  if (outcome === "lapse") {
    const box = Math.max(1, state.box - 1) as SrsBox;
    return { box, dueAt: now + intervalDays(type, box) * DAY_MS, lapses: state.lapses + 1 };
  }
  if (!isReviewDue(state, now)) return state;
  const box = Math.min(5, state.box + 1) as SrsBox;
  return { box, dueAt: now + intervalDays(type, box) * DAY_MS, lapses: state.lapses };
}
