import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Layers,
  PlayCircle,
  Target,
  Flame,
  RotateCcw,
} from "lucide-react";
import { PageContainer, PageHeader, EmptyState } from "@/components/app-shell";
import { TASK_BY_ID } from "@/domain/task-catalog";
import { catalogEntries, countForSection } from "@/lib/bank/manifest";
import { buildDueQueue } from "@/lib/progress/queue";
import { progress } from "@/lib/progress/client";
import { useMeta, useSnapshots, useSessions, dueCount } from "@/hooks/use-progress";
import type { Section, TaskType } from "@/domain/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — PTE Master Hub" },
      {
        name: "description",
        content:
          "Sua fila do dia, metas e visão geral do treino para o PTE Academic — 22 tipos de tarefa, progresso salvo no navegador.",
      },
      { property: "og:title", content: "Início — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Sua fila do dia, metas e visão geral do treino para o PTE Academic — progresso salvo no navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const SECTION_LABELS: Record<Section, string> = {
  speaking: "Fala",
  writing: "Escrita",
  reading: "Leitura",
  listening: "Listening",
};

function HomePage() {
  const navigate = useNavigate();
  const snapshots = useSnapshots();
  const meta = useMeta();
  const sessions = useSessions();
  const activeSession = sessions?.find((s) => s.status === "ativa" && s.queue.length > 0);

  const startDueSession = () => {
    if (!snapshots) return;
    const queue = buildDueQueue(snapshots, Date.now());
    if (queue.length === 0) return;
    const created = progress.createSession({
      title: "Fila do dia · revisões vencidas",
      kind: "fila-do-dia",
      queue,
    });
    if ("id" in created)
      void navigate({ to: "/sessao/$sessionId", params: { sessionId: created.id } });
  };

  // Fila do dia agrupada por tipo (derivada de snapshots vencidos — nada inventado).
  const dueByType = new Map<TaskType, number>();
  if (snapshots) {
    const now = Date.now();
    for (const snap of Object.values(snapshots)) {
      if (snap.dueAt <= now) dueByType.set(snap.type, (dueByType.get(snap.type) ?? 0) + 1);
    }
  }
  const dueTotal = dueCount();
  const hasData = snapshots !== null && Object.keys(snapshots).length > 0;
  const sections: Section[] = ["speaking", "writing", "reading", "listening"];
  const entries = catalogEntries();

  return (
    <PageContainer>
      <PageHeader
        title="Seu treino, sem atalho sujo"
        description="Treino por tipo de tarefa com banco auditável, repetição espaçada e estimativas honestas. Seu progresso fica neste navegador — nada é enviado para servidor nenhum."
      >
        {meta?.targetScore ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Target className="size-3.5" /> Meta: {meta.targetScore}
          </span>
        ) : null}
        {meta?.examDate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <CalendarClock className="size-3.5" /> Prova: {meta.examDate}
          </span>
        ) : null}
      </PageHeader>

      {/* Sessão em andamento (retomável — Fase 7) */}
      {activeSession ? (
        <section aria-labelledby="sessao-andamento" className="mb-8">
          <h2 id="sessao-andamento" className="mb-3 text-sm font-medium text-foreground">
            Sessão em andamento
          </h2>
          <Link
            to="/sessao/$sessionId"
            params={{ sessionId: activeSession.id }}
            className="group flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 transition-colors hover:border-primary/60"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{activeSession.title}</p>
              <p className="text-xs text-muted-foreground">
                {Math.min(activeSession.cursor + 1, activeSession.queue.length)} de{" "}
                {activeSession.queue.length} itens · retome de onde parou
              </p>
            </div>
            <RotateCcw className="size-4 text-primary transition-transform group-hover:-rotate-12" />
          </Link>
        </section>
      ) : null}

      {/* Fila do dia */}
      <section aria-labelledby="fila-dia" className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id="fila-dia" className="mb-3 text-sm font-medium text-foreground">
            Fila do dia
          </h2>
          {dueTotal > 0 ? (
            <button
              type="button"
              onClick={startDueSession}
              className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PlayCircle className="size-3.5" /> Iniciar fila do dia
            </button>
          ) : null}
        </div>
        {!hasData ? (
          <EmptyState
            title="Nada vencido ainda — porque você ainda não treinou"
            description="Conclua sua primeira tentativa em qualquer tipo de tarefa e a repetição espaçada monta sua fila automaticamente."
            action={
              <Link
                to="/catalogo"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Escolher uma tarefa <ArrowRight className="size-3.5" />
              </Link>
            }
          />
        ) : dueTotal === 0 ? (
          <EmptyState
            title="Fila em dia"
            description="Nenhuma revisão vencida agora. Volte quando as próximas revisões vencerem — ou treine algo novo para antecipar o ciclo."
            action={
              <Link
                to="/catalogo"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Treinar algo novo
              </Link>
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...dueByType.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const def = TASK_BY_ID.get(type);
                return (
                  <Link
                    key={type}
                    to="/pratica/$type"
                    params={{ type }}
                    search={{ index: 0 }}
                    className="group flex items-center justify-between rounded-xl border border-warning/30 bg-card/50 px-4 py-3 transition-colors hover:border-warning/60"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{def?.label ?? type}</p>
                      <p className="text-xs text-muted-foreground">
                        {SECTION_LABELS[def?.section ?? "reading"]} · {count}{" "}
                        {count === 1 ? "item vencido" : "itens vencidos"}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
          </div>
        )}
      </section>

      {/* Seções */}
      <section aria-labelledby="secoes" className="mb-8">
        <h2 id="secoes" className="mb-3 text-sm font-medium text-foreground">
          As quatro seções do exame
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <Link
              key={section}
              to="/catalogo"
              className="rounded-xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-primary/40"
            >
              <div className="mb-2 flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{SECTION_LABELS[section]}</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {countForSection(section)}
              </p>
              <p className="text-xs text-muted-foreground">
                questões no banco ·{" "}
                {entries.filter((e) => e.def.section === section && e.available).length} tipos
                disponíveis
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Sequência + honestidade */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Flame className="size-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Sequência de estudo</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A sequência e os dias estudados aparecem em{" "}
            <Link to="/progresso" className="text-primary underline-offset-2 hover:underline">
              Progresso
            </Link>
            , contados a partir das suas tentativas reais — nada de pontos por presença.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <p className="mb-2 text-sm font-medium text-foreground">Dados com origem declarada</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cada questão do banco carrega origem auditável. Estimativas de nota só aparecem quando
            houver base mínima — e sempre marcadas como estimativa. Detalhes em{" "}
            <Link to="/sobre" className="text-primary underline-offset-2 hover:underline">
              Sobre
            </Link>
            .
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
