// Chamada de avaliação IA para as respostas abertas (PRD D7): a tentativa vai ao servidor com o
// mínimo pedagógico (questão + gabarito + resposta); abstenção é resolvida antes da cobrança.
import { evaluateAttempt } from "@/lib/ai/evaluate.functions";
import { EVALUATOR_CONFIGS } from "@/lib/ai/evaluator-config";
import { TASK_CATALOG } from "@/domain/task-catalog";
import type { TaskType } from "@/domain/types";
import { outcomeFromScore } from "./grading";
import type { AttemptDraft, EvaluatorStamp } from "./types";

export interface OpenEvalInput {
  qid: string;
  type: TaskType;
  /** Conteúdo pedagógico da questão (dado não confiável — vai na cerca do avaliador). */
  question: unknown;
  /** Gabarito/referência (sample, keywords, facts…). */
  reference: unknown;
  /** Resposta do aluno: texto digitado ou transcrição da fala. */
  studentResponse: unknown;
}

export async function evaluateOpen(input: OpenEvalInput): Promise<AttemptDraft> {
  const speechUnmeasured = "pronúncia e prosódia (não medíveis por transcrição)";
  let result: Awaited<ReturnType<typeof evaluateAttempt>>;
  try {
    result = await evaluateAttempt({
      data: {
        type: input.type,
        question: input.question,
        reference: input.reference,
        studentResponse: input.studentResponse,
      },
    });
  } catch {
    // Falha de transporte (rede/servidor): abstenção explícita, nunca nota substituta.
    return {
      qid: input.qid,
      type: input.type,
      result: "abstained",
      score: null,
      confidence: null,
      feedback: "Avaliação indisponível: falha de rede ou do serviço de IA.",
      evidence: [],
      unmeasured: [],
      evaluator: { evaluatorId: "indisponivel" },
    };
  }
  const evaluator: EvaluatorStamp = {
    evaluatorId: result.evaluatorId,
    promptVersion: String(result.promptVersion),
    rubricVersion: String(result.rubricVersion),
    model: result.model,
  };
  if (!result.ok) {
    return {
      qid: input.qid,
      type: input.type,
      result: "abstained",
      score: null,
      confidence: null,
      feedback: result.feedback || `Avaliação indisponível: ${result.error ?? "falha do serviço"}.`,
      evidence: [],
      unmeasured: [],
      evaluator,
    };
  }
  const abstained = result.abstained || result.score === null;
  return {
    qid: input.qid,
    type: input.type,
    result: abstained
      ? "abstained"
      : outcomeFromScore(result.score, EVALUATOR_CONFIGS[input.type].scale),
    score: abstained ? null : result.score,
    confidence: result.confidence === "high" ? 0.9 : result.confidence === "medium" ? 0.6 : 0.3,
    feedback: result.feedback || null,
    evidence: result.evidence,
    unmeasured: [
      ...new Set([
        ...(result.unmeasured ?? []),
        ...(TASK_CATALOG.find((d) => d.id === input.type)?.family === "fala"
          ? [speechUnmeasured]
          : []),
      ]),
    ],
    evaluator,
  };
}
