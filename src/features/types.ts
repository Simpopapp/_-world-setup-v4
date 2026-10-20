// Contrato dos motores de prática (PRD D10): toda engine recebe a questão + definição do catálogo
// e devolve uma tentativa normalizada ao shell, que grava no progresso local (SRS + agregados).
import type { TaskDefinition } from "@/domain/task-catalog";
import type { Question, TaskType } from "@/domain/types";
import type { AttemptResult, ErrorTag } from "@/lib/progress/types";

export interface EvaluatorStamp {
  evaluatorId: string;
  promptVersion?: string;
  rubricVersion?: string;
  model?: string;
}

/** Correção objetiva pelo gabarito do item — determinística, sem IA, sem custo de cobrança. */
export const GABARITO_STAMP: EvaluatorStamp = { evaluatorId: "gabarito-local" };

export interface AttemptDraft {
  qid: string;
  type: TaskType;
  result: AttemptResult;
  /** Escala da tentativa do tipo (nunca a estimativa 10–90 — PRD D8). */
  score: number | null;
  /** Certeza da correção: 1 para gabarito determinístico; do modelo para IA. */
  confidence: number | null;
  feedback: string | null;
  evidence: string[];
  /** O que a avaliação por transcrição NÃO mediu (proxy rotulado — PRD D7). */
  unmeasured: string[];
  /** Categorias de erro determinísticas (Fase 7); ausente = sem sinal. */
  errorTags?: ErrorTag[];
  evaluator: EvaluatorStamp;
}

export interface EngineProps {
  question: Question;
  def: TaskDefinition;
  /** O shell grava a tentativa (progresso local + SRS); a engine exibe o resultado e o gabarito. */
  onSubmit: (draft: AttemptDraft) => void;
}
