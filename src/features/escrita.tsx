// Motores de escrita (Fase 6c — PRD D10): swt e write_essay, com contadores do formato e
// avaliação IA acionada no envio (abstenção resolvida no servidor antes da cobrança).
import { useState } from "react";
import { AiPending, FeedbackPanel, SubmitRow } from "./feedback";
import { evaluateOpen } from "./ai-evaluate";
import { countWords } from "./grading";
import type { AttemptDraft, EngineProps } from "./types";

export function SwtEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { text: string; keywords: string[]; sample: string };
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);
  const words = countWords(response);
  const outOfRange = words > 0 && (words < 5 || words > 75);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setResponse("");
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Resumo de referência (para estudo):{" "}
            <span className="font-medium text-foreground">{data.sample}</span>
          </p>
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const result = await evaluateOpen({
        qid: question.id,
        type: question.type,
        question: { text: data.text },
        reference: { keywords: data.keywords, sample: data.sample },
        studentResponse: response.trim(),
      });
      setDraft(result);
      onSubmit(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed">{data.text}</p>
      <label className="text-sm font-medium" htmlFor="swt-response">
        Resuma em UMA frase
      </label>
      <textarea
        id="swt-response"
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={4}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
      <p className={`mt-1 text-xs ${outOfRange ? "text-warning" : "text-muted-foreground"}`}>
        {words} palavras · limite do formato: 5–75, em uma única frase
      </p>
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit()}
          hint="Avaliação por IA: cobertura, forma, gramática (escala 0–2)."
        />
      )}
    </div>
  );
}

export function WriteEssayEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { prompt: string; sample?: string };
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);
  const words = countWords(response);
  const outOfRange = words > 0 && (words < 200 || words > 300);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setResponse("");
        }}
        review={
          data.sample ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Redação de referência (para estudo):{" "}
              <span className="font-medium text-foreground">{data.sample}</span>
            </p>
          ) : null
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const result = await evaluateOpen({
        qid: question.id,
        type: question.type,
        question: { prompt: data.prompt },
        reference: data.sample ? { sample: data.sample } : null,
        studentResponse: response.trim(),
      });
      setDraft(result);
      onSubmit(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed">{data.prompt}</p>
      <label className="text-sm font-medium" htmlFor="essay-response">
        Sua dissertação
      </label>
      <textarea
        id="essay-response"
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={12}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
      <p className={`mt-1 text-xs ${outOfRange ? "text-warning" : "text-muted-foreground"}`}>
        {words} palavras · limite do formato: 200–300
      </p>
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit()}
          hint="Avaliação por IA: argumento, estrutura, coerência, vocabulário e gramática (escala 0–100)."
        />
      )}
    </div>
  );
}
