import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Clock, ShieldCheck, ShieldHalf, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { TASK_BY_ID } from "@/domain/task-catalog";
import type { Provenance, TaskType } from "@/domain/types";
import { loadQuestions } from "@/lib/bank/loader";
import { ENGINE_BY_TYPE } from "@/features/registry";
import { NotesPanel } from "@/features/notas";
import type { AttemptDraft } from "@/features/types";
import { recordAndNotify } from "@/hooks/use-progress";

function questionsOf(type: TaskType) {
  return queryOptions({
    queryKey: ["questions", type],
    queryFn: () => loadQuestions(type),
  });
}

export const Route = createFileRoute("/pratica/$type")({
  validateSearch: ({ index }: { index?: string }) => ({ index: index ? Number(index) : 0 }),
  head: ({ params }) => ({
    meta: [
      {
        title: `${TASK_BY_ID.get(params.type as TaskType)?.label ?? "Prática"} — PTE Master Hub`,
      },
      {
        name: "description",
        content: `Treino do tipo ${TASK_BY_ID.get(params.type as TaskType)?.label ?? params.type} com banco auditável e repetição espaçada.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ params, context }) => {
    const type = params.type as TaskType;
    if (!TASK_BY_ID.has(type)) throw notFound();
    void context.queryClient.ensureQueryData(questionsOf(type));
  },
  component: PracticePage,
});

export function PracticePage() {
  const { type } = Route.useParams() as { type: TaskType };
  const { index } = Route.useSearch();
  const def = TASK_BY_ID.get(type)!;
  const { data: questions } = useSuspenseQuery(questionsOf(type));
  const current = questions[Math.min(index, questions.length - 1)];
  const [quotaFailed, setQuotaFailed] = useState(false);

  const handleSubmit = useCallback(
    (draft: AttemptDraft) => {
      const recorded = recordAndNotify({
        qid: draft.qid,
        type: draft.type,
        result: draft.result,
        ...(draft.score !== null ? { score: draft.score } : {}),
        ...(draft.confidence !== null ? { confidence: draft.confidence } : {}),
        provenance: current?.provenance ?? "comunitaria",
        ...(draft.errorTags && draft.errorTags.length > 0 ? { errorTags: draft.errorTags } : {}),
        evaluatorId: draft.evaluator.evaluatorId,
        ...(draft.evaluator.promptVersion ? { promptVersion: draft.evaluator.promptVersion } : {}),
        ...(draft.evaluator.rubricVersion ? { rubricVersion: draft.evaluator.rubricVersion } : {}),
        ...(draft.evaluator.model ? { model: draft.evaluator.model } : {}),
      });
      setQuotaFailed(!recorded.ok);
    },
    [current?.provenance],
  );

  if (!current) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma questão disponível para este tipo ainda.
        </p>
      </PageContainer>
    );
  }

  const Engine = ENGINE_BY_TYPE[type];

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/catalogo"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Catálogo
          </Link>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {def.label}
          </h1>
          <p className="text-xs text-muted-foreground">
            {def.summary} · questão {Math.min(index + 1, questions.length)} de {questions.length}
          </p>
        </div>
        <ProvenanceBadge provenance={current.provenance} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/50 p-5 sm:p-7">
        <TimerBar
          key={`timer-${current.id}`}
          seconds={def.timing.responseSeconds as number | undefined}
          confirmed={def.timing.confirmed}
        />

        {Engine ? (
          <Engine
            key={`engine-${current.id}`}
            question={current}
            def={def}
            onSubmit={handleSubmit}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Motor não disponível para este tipo.</p>
        )}
        {quotaFailed ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive-foreground"
          >
            Não foi possível gravar esta tentativa: armazenamento cheio. Exporte um backup em
            Ajustes — a tentativa NÃO foi registrada.
          </div>
        ) : null}
      </div>

      <NotesPanel qid={current.id} />

      <div className="mt-4 flex items-center justify-between">
        <Link
          to="/pratica/$type"
          params={{ type }}
          search={{ index: Math.max(0, index - 1) }}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors enabled:hover:bg-accent disabled:opacity-40"
        >
          <ArrowLeft className="size-3.5" /> Anterior
        </Link>
        <Link
          to="/pratica/$type"
          params={{ type }}
          search={{ index: Math.min(questions.length - 1, index + 1) }}
          disabled={index >= questions.length - 1}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors enabled:hover:bg-primary/90 disabled:opacity-40"
        >
          Próxima <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </PageContainer>
  );
}

const PROVENANCE_META = {
  verificada: { label: "Origem verificada", Icon: ShieldCheck },
  corroborada: { label: "Origem corroborada", Icon: ShieldHalf },
  comunitaria: { label: "Origem comunitária", Icon: ShieldAlert },
} as const;

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const meta = PROVENANCE_META[provenance];
  const Icon = meta.Icon;
  return (
    <span
      title={meta.label + " — veja /sobre"}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-xs text-muted-foreground"
    >
      <Icon className="size-3.5 text-primary" /> {meta.label}
    </span>
  );
}

function TimerBar({ seconds, confirmed }: { seconds?: number | undefined; confirmed: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    setElapsed(0);
    const started = performance.now();
    const tick = () => {
      setElapsed(Math.floor((performance.now() - started) / 1000));
      raf.current = window.setTimeout(tick, 1000) as unknown as number;
    };
    tick();
    return () => {
      if (raf.current) window.clearTimeout(raf.current);
    };
  }, [seconds]);
  const limit = seconds ?? 120;
  const pct = Math.min(100, Math.round((elapsed / limit) * 100));
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" /> {elapsed}s
        </span>
        <span>
          {confirmed ? `limite de referência: ${limit}s` : `referência (não confirmada): ${limit}s`}
        </span>
      </div>
      <div
        role="timer"
        className="h-1.5 overflow-hidden rounded-full bg-secondary"
        aria-label={`Timer: ${elapsed} de ${limit} segundos`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
