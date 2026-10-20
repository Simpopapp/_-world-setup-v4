// Componentes compartilhados dos motores (PRD D10): painel de resultado pós-envio, botão de envio
// e estado "avaliando". Gabarito e feedback só aparecem DEPOIS do envio (gate da Fase 6).
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { EVALUATOR_CONFIGS } from "@/lib/ai/evaluator-config";
import { GABARITO_STAMP, type AttemptDraft } from "./types";

const RESULT_LABEL = {
  correct: "Correto",
  partial: "Parcialmente correto",
  incorrect: "Incorreto",
  abstained: "Não avaliado",
  revised: "Revisado",
} as const;

const RESULT_CLASS: Record<keyof typeof RESULT_LABEL, string> = {
  correct: "border-success/40 bg-success/10 text-success",
  partial: "border-warning/40 bg-warning/10 text-warning",
  incorrect: "border-destructive/40 bg-destructive/10 text-destructive",
  abstained: "border-border/60 bg-secondary/40 text-muted-foreground",
  revised: "border-border/60 bg-secondary/40 text-muted-foreground",
};

export function formatScore(score: number, max: number): string {
  // Mesma unidade no numerador e no denominador (escala da tentativa), ex.: 0,5/1 · 3/10 · 62/100.
  void max;
  return String(score);
}

export function FeedbackPanel({
  draft,
  review,
  onRetry,
}: {
  draft: AttemptDraft;
  review?: ReactNode;
  onRetry?: () => void;
}) {
  const scale = EVALUATOR_CONFIGS[draft.type].scale;
  const isGabarito = draft.evaluator.evaluatorId === GABARITO_STAMP.evaluatorId;
  return (
    <div className="mt-5 rounded-lg border border-border/60 bg-card/60 p-4" role="status">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            RESULT_CLASS[draft.result]
          }`}
        >
          {RESULT_LABEL[draft.result]}
        </span>
        {draft.score !== null ? (
          <span className="text-xs text-muted-foreground">
            pontuação da tentativa: {formatScore(draft.score, scale[1])} / {scale[1]}
          </span>
        ) : null}
      </div>
      {draft.feedback ? <p className="mt-2 text-sm leading-relaxed">{draft.feedback}</p> : null}
      {draft.evidence.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {draft.evidence.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
      {draft.unmeasured.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Não medido nesta avaliação: {draft.unmeasured.join("; ")}.
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {isGabarito
          ? "Correção determinística pelo gabarito do item."
          : `Avaliação por IA (rubrica v${draft.evaluator.rubricVersion ?? "?"} · modelo ${
              draft.evaluator.model ?? "?"
            }) — estimativa de treino, não nota oficial.`}
      </p>
      {review}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <RotateCcw className="size-3.5" /> Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function SubmitRow({
  disabled,
  onClick,
  label = "Enviar resposta",
  hint,
}: {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors enabled:hover:bg-primary/90 disabled:opacity-40"
      >
        {label}
      </button>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function AiPending() {
  return (
    <p className="mt-4 text-sm text-muted-foreground" role="status">
      Avaliando com IA…
    </p>
  );
}
