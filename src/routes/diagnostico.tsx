import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader, EmptyState } from "@/components/app-shell";
import { TASK_BY_ID } from "@/domain/task-catalog";
import { useAggregates, useSnapshots } from "@/hooks/use-progress";
import type { ErrorTag } from "@/lib/progress/types";
import type { Section, TaskType } from "@/domain/types";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — PTE Master Hub" },
      {
        name: "description",
        content:
          "Como você está em cada tipo de tarefa do PTE, derivado das suas tentativas reais — sem números inventados.",
      },
      { property: "og:title", content: "Diagnóstico — PTE Master Hub" },
      {
        property: "og:description",
        content: "Desempenho por tipo de tarefa, derivado das suas tentativas reais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagnosticoPage,
});

const SECTION_LABELS: Record<Section, string> = {
  speaking: "Fala",
  writing: "Escrita",
  reading: "Leitura",
  listening: "Listening",
};

function DiagnosticoPage() {
  const snapshots = useSnapshots();
  const aggregates = useAggregates();

  const hasData = snapshots !== null && Object.keys(snapshots).length > 0;
  if (!hasData) {
    return (
      <PageContainer>
        <PageHeader
          title="Diagnóstico"
          description="Um retrato por tipo de tarefa, montado a partir das suas tentativas — quanto mais você treina, mais preciso fica."
        />
        <EmptyState
          title="Sem dados suficientes para um diagnóstico"
          description="O diagnóstico nasce das suas tentativas reais (mínimo de 3 por tipo para exibir tendência). Treine qualquer tarefa no catálogo para começar."
        />
      </PageContainer>
    );
  }

  const byType = aggregates?.byType ?? {};
  const rows = Object.entries(byType)
    .map(([type, tally]) => ({
      type: type as TaskType,
      tally: tally!,
    }))
    .sort((a, b) => b.tally.attempts - a.tally.attempts);

  // Atalho de treino fraco: o tipo com mais respostas incorretas (dados reais, não estimativa).
  const weakest = [...rows]
    .filter((r) => r.tally.incorrect > 0)
    .sort((a, b) => b.tally.incorrect - a.tally.incorrect)[0];
  const weakestType = weakest ? { type: weakest.type, incorrect: weakest.tally.incorrect } : null;

  return (
    <PageContainer>
      <PageHeader
        title="Diagnóstico"
        description="Tentativas por tipo de tarefa. Resultado correto/parcial/incorreto depende do motor de cada tipo — enquanto os motores entram, registramos apenas o que de fato aconteceu."
      />
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Tarefa</th>
              <th className="px-4 py-2.5 font-medium">Seção</th>
              <th className="px-4 py-2.5 text-right font-medium">Tentativas</th>
              <th className="px-4 py-2.5 text-right font-medium">Acertos</th>
              <th className="px-4 py-2.5 text-right font-medium">Lapsos SRS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ type, tally }) => {
              const def = TASK_BY_ID.get(type);
              const snaps = Object.values(snapshots!).filter((s) => s.type === type);
              const lapses = snaps.reduce((acc, s) => acc + s.lapses, 0);
              return (
                <tr key={type} className="border-b border-border/20 last:border-0">
                  <td className="px-4 py-2.5">{def?.label ?? type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {def ? SECTION_LABELS[def.section] : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">{tally.attempts}</td>
                  <td className="px-4 py-2.5 text-right text-success">{tally.correct}</td>
                  <td className="px-4 py-2.5 text-right text-warning">{lapses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Categorias de erro (Fase 7): contagem real das tentativas — ausente = sem sinal ainda. */}
      <section aria-labelledby="categorias-erro" className="mt-8">
        <h2 id="categorias-erro" className="mb-3 text-sm font-medium text-foreground">
          Por categoria de erro
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Cada categoria nasce de comparação determinística com o gabarito do item. "Fluência" só
          aparece quando a avaliação por IA medir fluência — nunca é estimada aqui.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(ERROR_CATEGORY_LABELS) as ErrorTag[]).map((tag) => {
            const count = aggregates?.byErrorTag?.[tag] ?? 0;
            return (
              <div
                key={tag}
                className="rounded-xl border border-border/60 bg-card/40 p-4"
                data-testid={`categoria-${tag}`}
              >
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {count > 0 ? count : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ERROR_CATEGORY_LABELS[tag]}
                  {count === 0 ? " · sem sinal ainda" : ""}
                </p>
              </div>
            );
          })}
        </div>
        {weakestType ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Tipo com mais erros:{" "}
            <Link
              to="/pratica/$type"
              params={{ type: weakestType.type }}
              search={{ index: 0 }}
              className="text-primary underline-offset-2 hover:underline"
            >
              {TASK_BY_ID.get(weakestType.type)?.label ?? weakestType.type} ({weakestType.incorrect}{" "}
              incorretas)
            </Link>
            .
          </p>
        ) : null}
      </section>
    </PageContainer>
  );
}

const ERROR_CATEGORY_LABELS: Record<ErrorTag, string> = {
  conteudo: "Conteúdo",
  fluencia: "Fluência",
  omissao: "Omissão",
  armadilha: "Armadilha",
  palavra: "Palavras erradas",
};
