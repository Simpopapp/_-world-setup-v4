// Smoke-test real do Lovable AI Gateway: avalia 1 item read_mcq_single com resposta correta.
// Uso: bun scripts/ai-smoke.ts
import { NoObjectGeneratedError, Output, streamText } from "ai";
import {
  EvaluationOutputSchema,
  buildEvaluationMessages,
  type EvaluationInput,
} from "../src/lib/ai/evaluator-config";
import { createLovableAiGatewayProvider } from "../src/lib/ai/gateway.server";

const input: EvaluationInput = {
  type: "read_mcq_single",
  question: {
    passage:
      "Muitos oceanos do mundo estão ficando mais ácidos à medida que absorvem CO2 da atmosfera.",
    question: "Qual é a ideia principal do texto?",
    options: [
      "A pesca está diminuindo em todo o mundo.",
      "A absorção de CO2 está tornando os oceanos mais ácidos.",
      "O nível do mar está subindo rapidamente.",
      "Os oceanos estão ficando mais quentes.",
    ],
  },
  reference: { answer: 1 },
  studentResponse: 1,
};

async function main() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const provider = createLovableAiGatewayProvider(apiKey, undefined, {
    baseURL: "https://ai.gateway.lovable.dev/v1",
    structuredOutputs: true,
  });
  const { system, user } = buildEvaluationMessages(input);
  const result = streamText({
    model: provider("openai/gpt-6-astra"),
    output: Output.object({ schema: EvaluationOutputSchema }),
    system,
    prompt: user,
    maxRetries: 0,
    providerOptions: { lovable: { reasoningEffort: "low" } },
  });
  const object = await result.output;
  console.log("RUN_ID:", provider.getRunId());
  console.log("SAIDA:", JSON.stringify(object, null, 2));
  if (object.abstained || object.score === null)
    throw new Error("avaliador absteve inesperadamente");
  if (object.score < 0.5) throw new Error("resposta correta não recebeu nota alta");
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error("SMOKE FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
