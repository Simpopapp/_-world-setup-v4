// Provedor do Lovable AI Gateway (somente-servidor): Chat Completions compatível com saída
// estruturada estrita. O provedor é criado DENTRO de cada request (nunca em escopo de módulo).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export const LOVABLE_AIG_BASE_URL = "https://ai.gateway.lovable.dev/v1";

/** Modelo padrão do gateway para chamadas de chat/texto sem preferência do usuário. */
export const DEFAULT_EVALUATOR_MODEL = "openai/gpt-6-astra";

export function createLovableAiGatewayProvider(
  lovableApiKey: string,
  initialRunId: string | undefined,
  options: { baseURL: string; structuredOutputs?: boolean },
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: `${options.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });

  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}
