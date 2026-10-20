// Sessão retomável (Fase 7 — PRD s8.2): o estado da sessão vive na camada de progresso local e
// sobrevive ao recarregamento. A tentativa continua sendo gravada normalmente (SRS + agregados).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle, ListChecks, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer, EmptyState } from "@/components/app-shell";
import { TASK_BY_ID } from "@/domain/task-catalog";
import type { TaskType } from "@/domain/types";
import { loadQuestions } from "@/lib/bank/loader";
import { ENGINE_BY_TYPE } from "@/features/registry";
import { NotesPanel } from "@/features/notas";
import type { AttemptDraft } from "@/features/types";
import { progress } from "@/lib/progress/client";
import type { PracticeSession } from "@/lib/progress/types";
import { recordAndNotify } from "@/hooks/use-progress";

export const Route = createFileRoute("/sessao/$sessionId")({
  head: ({ params }) => ({
    meta: [
      { title: "Sessão de treino — PTE Master Hub" },
      {
        name: "description",
        content: `Sessão ${params.sessionId} retomável — feche e volte quando quiser: o estado fica no navegador.`,
      },
      { property: "og:title", content: "Sessão de treino — PTE Master Hub" },
      {
        property: "og:description",
        content: "Sessão de treino retomável — o estado sobrevive ao recarregamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionPage,
});

function questionsOf(type: TaskType) {
  return queryOptions({
    queryKey: ["questions", type],
    queryFn: () => loadQuestions(type),
  });
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  // Leitura em useEffect (nunca no render — SSR não tem localStorage).
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSession(progress.getSession(sessionId));
    setLoaded(true);
  }, [sessionId]);

  if (!loaded) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-sm text-muted-foreground">Carregando sessão…</p>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer>
        <EmptyState
          title="Sessão não encontrada"
          description="Esta sessão não existe (ou foi removida ao abrir um backup). Inicie uma nova pela Home ou pelo catálogo."
          action={
            <Link
              to="/catalogo"
              className="inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ir ao catálogo
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (session.status === "concluida" || session.cursor >= session.queue.length) {
    return <SessionSummary session={session} onDismiss={dismissSession(sessionId, navigate)} />;
  }

  return <SessionRunner session={session} onSessionChange={setSession} />;
}

function dismissSession(sessionId: string, navigate: ReturnType<typeof useNavigate>) {
  return () => {
    progress.deleteSession(sessionId);
    void navigate({ to: "/" });
  };
}

/** Runner: pratica queue[cursor] com a engine do tipo; cada envio grava tentativa + sessão. */
function SessionRunner({
  session,
  onSessionChange,
}: {
  session: PracticeSession;
  onSessionChange: (session: PracticeSession) => void;
}) {
  const qid = session.queue[session.cursor]!;
  const snapshot = progress.getSnapshot(qid);
  const type: TaskType | undefined = snapshot?.type ?? session.taskType;
  const navigate = useNavigate();

  if (!type) {
    return (
      <PageContainer>
        <EmptyState
          title="Item sem tipo conhecido"
          description="Esta sessão contém um item que não está mais no banco (ou o progresso foi importado sem o snapshot dele). Encerre a sessão e inicie uma nova."
          action={
            <button
              type="button"
              onClick={() => {
                progress.updateSession(session.id, { status: "concluida" });
                void navigate({ to: "/" });
              }}
              className="inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground"
            >
              Encerrar sessão
            </button>
          }
        />
      </PageContainer>
    );
  }

  return <SessionRunnerLoaded session={session} type={type} onSessionChange={onSessionChange} />;
}

function SessionRunnerLoaded({
  session,
  type,
  onSessionChange,
}: {
  session: PracticeSession;
  type: TaskType;
  onSessionChange: (session: PracticeSession) => void;
}) {
  const { data: questions } = useSuspenseQuery(questionsOf(type));
  const def = TASK_BY_ID.get(type)!;
  const qid = session.queue[session.cursor]!;
  const question = questions.find((q) => q.id === qid);
  const Engine = ENGINE_BY_TYPE[type];

  if (!question || !Engine) {
    return (
      <PageContainer>
        <EmptyState
          title="Item indisponível nesta sessão"
          description="A questão desta posição não está mais no banco. Encerre a sessão e inicie uma nova pela Home."
          action={<EndButton sessionId={session.id} />}
        />
      </PageContainer>
    );
  }

  const handleSubmit = (draft: AttemptDraft) => {
    recordAndNotify({
      qid: draft.qid,
      type: draft.type,
      result: draft.result,
      ...(draft.score !== null ? { score: draft.score } : {}),
      ...(draft.confidence !== null ? { confidence: draft.confidence } : {}),
      provenance: question.provenance,
      ...(draft.errorTags && draft.errorTags.length > 0 ? { errorTags: draft.errorTags } : {}),
      evaluatorId: draft.evaluator.evaluatorId,
      ...(draft.evaluator.promptVersion ? { promptVersion: draft.evaluator.promptVersion } : {}),
      ...(draft.evaluator.rubricVersion ? { rubricVersion: draft.evaluator.rubricVersion } : {}),
      ...(draft.evaluator.model ? { model: draft.evaluator.model } : {}),
    });
    // A tentativa entra na sessão imediatamente; o cursor avança no clique de "Próxima",
    // para que o feedback (e o gabarito, pós-envio) permaneça visível até a navegação.
    const answered = {
      ...session.answered,
      [qid]: { result: draft.result, score: draft.score, at: Date.now() },
    };
    const updated = { ...session, answered };
    progress.updateSession(session.id, { answered });
    onSessionChange(updated);
  };

  const advance = () => {
    const next = session.cursor + 1;
    const done = next >= session.queue.length;
    progress.updateSession(
      session.id,
      done ? { cursor: next, status: "concluida" } : { cursor: next },
    );
    onSessionChange({ ...session, cursor: next, ...(done ? { status: "concluida" } : {}) });
  };

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{session.title}</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {def.label}
          </h1>
          <p className="text-xs text-muted-foreground">
            Questão {session.cursor + 1} de {session.queue.length} · respostas nesta sessão:{" "}
            {Object.keys(session.answered).length}
          </p>
        </div>
        <EndButton sessionId={session.id} />
      </div>

      {/* Progresso da fila: pontinho por item, preenchido quando respondido. */}
      <div
        aria-label={`Progresso da sessão: ${Object.keys(session.answered).length} de ${session.queue.length} respondidas`}
        className="mb-4 flex flex-wrap gap-1"
      >
        {session.queue.map((item, i) => {
          const answeredItem = session.answered[item];
          return (
            <span
              key={item}
              title={
                answeredItem
                  ? `Item ${i + 1}: ${answeredItem.result}`
                  : i === session.cursor
                    ? `Item ${i + 1}: atual`
                    : `Item ${i + 1}: pendente`
              }
            >
              {answeredItem ? (
                <CheckCircle2
                  className={`size-3.5 ${
                    answeredItem.result === "correct" ? "text-success" : "text-warning"
                  }`}
                />
              ) : (
                <Circle className="size-3.5 text-muted-foreground/40" />
              )}
            </span>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/50 p-5 sm:p-7">
        <Engine
          key={`engine-${question.id}`}
          question={question}
          def={def}
          onSubmit={handleSubmit}
        />
        <NotesPanel qid={question.id} />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={advance}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {session.cursor + 1 >= session.queue.length ? "Concluir sessão" : "Próxima"}{" "}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </PageContainer>
  );
}

function EndButton({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        progress.updateSession(sessionId, { status: "concluida" });
        void navigate({ to: "/" });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
    >
      <LogOut className="size-3.5" /> Encerrar sessão
    </button>
  );
}

/** Resumo honesto ao concluir: só o que de fato aconteceu nas tentativas desta sessão. */
function SessionSummary({
  session,
  onDismiss,
}: {
  session: PracticeSession;
  onDismiss: () => void;
}) {
  const counts = { correct: 0, partial: 0, incorrect: 0, abstained: 0 };
  for (const entry of Object.values(session.answered)) {
    if (entry.result in counts) counts[entry.result as keyof typeof counts] += 1;
  }
  const total = Object.keys(session.answered).length;
  return (
    <PageContainer>
      <EmptyState
        title="Sessão concluída"
        description={`${total} de ${session.queue.length} itens responderam a esta sessão. Cada tentativa já está no seu progresso (SRS e agregados) — nada foi contado duas vezes.`}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ListChecks className="size-3.5" /> Voltar ao início
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center rounded-md border border-input bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Remover da lista
            </button>
          </div>
        }
      />
      {total > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="Corretas" value={counts.correct} />
          <SummaryCard label="Parciais" value={counts.partial} />
          <SummaryCard label="Incorretas" value={counts.incorrect} />
          <SummaryCard label="Não avaliadas" value={counts.abstained} />
        </div>
      ) : null}
    </PageContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-center">
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
