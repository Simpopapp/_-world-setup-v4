import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/app-shell";
import { useAggregates, useSnapshots } from "@/hooks/use-progress";
import { streakFromDays } from "@/lib/progress/day";

export const Route = createFileRoute("/progresso")({
  head: () => ({
    meta: [
      { title: "Progresso — PTE Master Hub" },
      {
        name: "description",
        content:
          "Sequência de estudo, tentativas e backups do seu treino para o PTE — tudo salvo apenas no seu navegador.",
      },
      { property: "og:title", content: "Progresso — PTE Master Hub" },
      {
        property: "og:description",
        content: "Sequência de estudo e tentativas, salvas apenas no seu navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressoPage,
});

function ProgressoPage() {
  const aggregates = useAggregates();
  const snapshots = useSnapshots();
  const hasData =
    aggregates !== null && aggregates.sessionsStarted + aggregates.studiedDays.length > 0;
  const totalAttempts = snapshots
    ? Object.values(snapshots).reduce((acc, s) => acc + s.attempts, 0)
    : 0;
  const studied = new Set(aggregates?.studiedDays ?? []);

  return (
    <PageContainer>
      <PageHeader
        title="Progresso"
        description="O que está aqui é derivado das suas tentativas reais, calculado no seu navegador. Estimativas de nota só aparecem com base mínima de dados — e sempre rotuladas como estimativa."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card label="Tentativas registradas" value={String(totalAttempts)} />
        <Card
          label="Dias com estudo"
          value={String(studied.size)}
          hint={
            studied.size > 0 ? `sequência atual: ${streakFromDays([...studied])} dia(s)` : undefined
          }
        />
        <Card
          label="Questões tocadas"
          value={snapshots ? String(Object.keys(snapshots).length) : "—"}
        />
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium text-foreground">O que vem depois</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A Fase 8 do plano conecta esta página à evolução por seção, à fila do dia projetada e às
          estimativas de nota (com base mínima declarada). Hoje, os números acima já refletem suas
          tentativas reais — nada foi preenchido para parecer progresso.
        </p>
      </section>
    </PageContainer>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
