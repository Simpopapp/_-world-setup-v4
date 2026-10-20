// Função de servidor do avaliador (PRD D7): chamada real ao Lovable AI Gateway com saída
// estruturada estrita, abstenção sem cobrança e versões registradas na tentativa.
import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import {
  EVALUATOR_ID,
  EVALUATOR_CONFIGS,
  EvaluationOutputSchema,
  buildEvaluationMessages,
  normalizeEvaluation,
  shouldAbstain,
  type EvaluationInput,
  type EvaluationOutput,
} from "./evaluator-config";
import { DEFAULT_EVALUATOR_MODEL } from "./gateway.server";

export interface EvaluateResult {
  ok: boolean;
  abstained: boolean;
  reason: string | null;
  score: number | null;
  subscores: { label: string; value: number | null }[] | null;
  evidence: string[];
  feedback: string;
  confidence: "low" | "medium" | "high";
  measured: string[] | null;
  unmeasured: string[] | null;
  /** Identificadores para a tentativa (PRD D7 — reexecução identificável). */
  evaluatorId: string;
  promptVersion: number;
  rubricVersion: number;
  model: string;
  error?: string;
}

export const evaluateAttempt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    // Validação defensiva: o cliente manda exatamente o contrato de EvaluationInput.
    const obj = (data ?? {}) as Record<string, unknown>;
    if (typeof obj["type"] !== "string") throw new Error("tipo de tarefa ausente");
    if (!(obj["type"] in EVALUATOR_CONFIGS))
      throw new Error(`tipo desconhecido: ${String(obj["type"])}`);
    return {
      type: obj["type"] as EvaluationInput["type"],
      question: obj["question"] ?? null,
      reference: obj["reference"] ?? null,
      studentResponse: obj["studentResponse"] ?? null,
    } satisfies EvaluationInput;
  })
  .handler(async ({ data }): Promise<EvaluateResult> => {
    const config = EVALUATOR_CONFIGS[data.type];
    const meta = {
      evaluatorId: EVALUATOR_ID,
      promptVersion: config.version,
      rubricVersion: config.version,
      model: DEFAULT_EVALUATOR_MODEL,
    };

    // Abstenção estrutural ANTES da chamada: resposta vazia não custa cobrança nem nota.
    const abstainReason = shouldAbstain(data, config);
    if (abstainReason) {
      return {
        ok: true,
        abstained: true,
        reason: abstainReason,
        score: null,
        subscores: null,
        evidence: [],
        feedback: `Não avaliado: ${abstainReason}.`,
        confidence: "low",
        measured: null,
        unmeasured: null,
        ...meta,
      };
    }

    // Chave e provedor lidos/criados dentro do request (nunca em escopo de módulo).
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        ...blankResult(data, meta),
        ok: false,
        error: "gateway indisponível: chave ausente",
      };
    }
    const { createLovableAiGatewayProvider } = await import("./gateway.server");
    const provider = createLovableAiGatewayProvider(apiKey, undefined, {
      baseURL: "https://ai.gateway.lovable.dev/v1",
      structuredOutputs: true,
    });

    const { system, user } = buildEvaluationMessages(data);
    try {
      const result = streamText({
        model: provider(DEFAULT_EVALUATOR_MODEL),
        output: Output.object({ schema: EvaluationOutputSchema }),
        system,
        prompt: user,
        maxRetries: 0,
        providerOptions: {
          lovable: { reasoningEffort: "low" },
        },
      });
      // Consumo do stream no servidor (resultado final only).
      const object = await result.output;
      const normalized = normalizeEvaluation(object, data);
      if (!normalized.ok) {
        return {
          ...blankResult(data, meta),
          ok: false,
          error: "saída do avaliador fora do schema",
        };
      }
      const value = normalized.value;
      const abstained = value.abstained || value.score === null;
      return {
        ok: true,
        abstained,
        reason: abstained ? "avaliador absteve (ver feedback)" : null,
        score: abstained ? null : value.score,
        subscores: value.subscores,
        evidence: value.evidence,
        feedback: value.feedback,
        confidence: value.confidence,
        measured: value.measured,
        unmeasured: value.unmeasured,
        ...meta,
      };
    } catch (error) {
      // Erros 4xx (exceto 429/5xx) são terminais: NÃO retry — a UI mostra o motivo (PRD/error contract).
      const message = error instanceof Error ? error.message : "falha desconhecida do gateway";
      return { ...blankResult(data, meta), ok: false, error: message };
    }
  });

function blankResult(
  data: EvaluationInput,
  meta: { evaluatorId: string; promptVersion: number; rubricVersion: number; model: string },
): Omit<EvaluateResult, "ok" | "error"> {
  void data;
  return {
    abstained: true,
    reason: "não avaliado",
    score: null,
    subscores: null,
    evidence: [],
    feedback: "",
    confidence: "low",
    measured: null,
    unmeasured: null,
    ...meta,
  };
}
