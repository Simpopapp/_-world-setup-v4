import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageContainer, PageHeader, EmptyState } from "@/components/app-shell";
import { TASK_BY_ID } from "@/domain/task-catalog";
import { ABILITY_LABELS } from "@/domain/ability-matrix";
import {
  abilityEstimates,
  dailyAccuracySeries,
  estimateBasis,
  estimateReadiness,
  estimateTrend,
  ESTIMATE_LABEL,
  type ScoringInput,
} from "@/domain/scoring";
import { useAggregates, useAttemptLog, useSnapshots } from "@/hooks/use-progress";
import { getLocalDayKey, streakFromDays } from "@/lib/progress/day";
import { catalogEntries } from "@/lib/bank/manifest";
import type { Section } from "@/domain/types";

export const Route = createFileRoute("/progresso")({
  head: () => ({
    meta: [
      { title: "Progresso — PTE Master Hub" },
      {
        name: "description",
        content:
          "Estimativas de treino (10–90) rotuladas, evolução por dia, lacunas de cobertura e relatório exportável — tudo derivado das suas tentativas reais, salvas apenas no seu navegador.",
      },
      { property: "og:title", content: "Progresso — PTE Master Hub" },
      {
        property: "og:description",
        content: "Estimativas de treino, evolução e relatório exportável, derivados das suas tentativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressoPage,
});

const SECTION_LABELS: Record<Section, string> = {
  speaking: "Fala",
  writing: "Escrita",
  reading: "Leitura",
  listening: "Listening",
};

const TREND_LABELS: Record<string, string> = {
  subindo: "subindo",
  estavel: "estável",
  caindo: "caindo",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  baixa: "confiança baixa",
  media: "confiança média",
  alta: "confiança alta",
};

function ProgressoPage() {
  const aggregates = useAggregates();
  const snapshots = useSnapshots();
  const log = useAttemptLog();

  const scoringInput: ScoringInput | null = useMemo(() => {
    if (!aggregates || !log) return null;
    return { byType: aggregates.byType, log, now: Date.now() };
  }, [aggregates, log]);

  const estimates = scoringInput ? abilityEstimates(scoringInput) : null;
  const readiness = scoringInput ? estimateReadiness(scoringInput) : null;
  const trend = scoringInput ? estimateTrend(scoringInput) : null;
  const basis = estimateBasis();

  const chartData = useMemo(() => {
    if (!scoringInput) return [];
    return dailyAccuracySeries(scoringInput.log, 14, scoringInput.now);
  }, [scoringInput]);
  const hasChartSignals = chartData.some((p) => p.signals > 0);

  const totalAttempts = snapshots
    ? Object.values(snapshots).reduce((acc, s) => acc + s.attempts, 0)
    : 0;
  const studied = new Set(aggregates?.studiedDays ?? []);
  const hasData = log !== null && (log.length > 0 || totalAttempts > 0);

  // Lacunas de cobertura: tipos do catálogo ainda sem nenhuma tentativa (contagem do manifesto).
  const gaps = aggregates
    ? catalogEntries().filter((entry) => !aggregates.byType?.[entry.def.id])
    : [];

  return (
    <PageContainer>
      <PageHeader
        title="Progresso"
        description="Tudo aqui nasce das suas tentativas reais, calculado no seu navegador. Estimativas aparecem rotuladas como “estimativa de treino” — nunca como nota oficial do exame."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
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

      {/* ===== Estimativa de treino (escala 10–90) — sempre rotulada (PRD D8) ===== */}
      <section aria-labelledby="estimativa-treino" className="mb-8">
        <h2 id="estimativa-treino" className="mb-1 text-sm font-medium text-foreground">
          Estimativa de treino (escala 10–90)
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {ESTIMATE_LABEL}, nunca nota oficial. Abstenções não contam como erro (ficam “sem sinal”).
          {basis.approximate
            ? ` Os pesos vêm da matriz tarefa×habilidade, ainda aproximada — fonte: ${basis.source}${basis.confirmedAt ? "" : " (fonte oficial ainda não confirmada)"}.`
            : ""}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(estimates ?? []).map((estimate) => (
            <div
              key={estimate.ability}
              className="rounded-xl border border-border/60 bg-card/50 p-4"
              data-testid={`estimativa-${estimate.ability}`}
            >
              <p className="text-xs text-muted-foreground">{estimate.abilityLabel}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {estimate.score !== null ? String(estimate.score) : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ESTIMATE_LABEL} ·{" "}
                {estimate.score !== null
                  ? CONFIDENCE_LABELS[estimate.confidence]
                  : "sem sinal ainda"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {estimate.attemptsUsed > 0
                  ? `base: ${estimate.attemptsUsed} tentativa(s) em ${estimate.typesUsed.length} tipo(s)`
                  : "treine tipos desta habilidade para gerar sinal"}
              </p>
            </div>
          ))}
          <div
            className="rounded-xl border border-border/60 bg-card/50 p-4"
            data-testid="prontidao"
          >
            <p className="text-xs text-muted-foreground">Prontidão</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {readiness?.value !== null && readiness?.value !== undefined
                ? String(readiness.value)
                : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {ESTIMATE_LABEL} ·{" "}
              {readiness?.value !== null && readiness?.value !== undefined
                ? CONFIDENCE_LABELS[readiness.confidence]
                : "sem sinal ainda"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {trend
                ? `tendência: ${TREND_LABELS[trend] ?? trend} · desempenho recente ponderado + tendência + confiança`
                : "desempenho recente ponderado + tendência + confiança"}
            </p>
          </div>
        </div>
      </section>

      {/* ===== Evolução: acurácia por dia local (log truncável — passado distante pode sumir) ===== */}
      <section aria-labelledby="evolucao" className="mb-8">
        <h2 id="evolucao" className="mb-1 text-sm font-medium text-foreground">
          Evolução (últimos 14 dias)
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Acurácia diária das tentativas (parciais valem metade). O log guarda as tentativas mais
          recentes — dias sem registro ficam sem linha, nunca com zero inventado.
        </p>
        {hasChartSignals ? (
          <div className="h-56 rounded-xl border border-border/60 bg-card/40 p-4 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  tickFormatter={(day: string) => day.slice(5)}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "acurácia"]}
                  labelFormatter={(day) => String(day)}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem tentativas nos últimos 14 dias — o gráfico aparece quando houver sinal real.
          </p>
        )}
      </section>

      {/* ===== Lacunas de cobertura: tipos sem nenhuma tentativa ===== */}
      <section aria-labelledby="lacunas" className="mb-8">
        <h2 id="lacunas" className="mb-1 text-sm font-medium text-foreground">
          Lacunas de cobertura
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Tipos que você ainda não praticou. A contagem entre parênteses vem do banco importado
          (manifesto gerado).
        </p>
        {gaps.length === 0 ? (
          <p className="text-xs text-success">Todos os tipos do catálogo já têm ao menos uma tentativa.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {gaps.map(({ def, count }) => (
              <Link
                key={def.id}
                to="/pratica/$type"
                params={{ type: def.id }}
                search={{ index: 0 }}
                className="rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {def.label} ({count} no banco · 0 tentativas)
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== Relatório exportável: JSON/CSV com dados reais ===== */}
      <section aria-labelledby="relatorio" className="mb-8">
        <h2 id="relatorio" className="mb-1 text-sm font-medium text-foreground">
          Relatório exportável
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Exporta um retrato (JSON) ou planilha (CSV) com os números desta página — gerados no seu
          navegador, nada sai dele.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasData}
            onClick={() => exportJson(aggregates, log, estimates, readiness, trend)}
            className="rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="exportar-json"
          >
            Baixar JSON
          </button>
          <button
            type="button"
            disabled={!hasData}
            onClick={() => exportCsv(aggregates, log, estimates, readiness)}
            className="rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="exportar-csv"
          >
            Baixar CSV
          </button>
        </div>
        {!hasData ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nada para exportar ainda — faça a primeira tentativa.
          </p>
        ) : null}
      </section>

      {!hasData ? (
        <EmptyState
          title="Sem dados suficientes"
          description="Nenhuma tentativa registrada neste navegador. Treine qualquer tarefa do catálogo — estimativas e evolução aparecem a partir de sinais reais."
        />
      ) : null}
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

// ===== Exportações (dados reais; rodam só no cliente, no clique) =====

type EstimateLike = {
  ability: string;
  abilityLabel: string;
  score: number | null;
  confidence: string;
  attemptsUsed: number;
};
type ReadinessLike = { value: number | null; confidence: string; trend: string | null } | null;

type AggregatesLike = {
  byType: Record<string, { attempts: number; correct: number; partial: number; incorrect: number; abstained: number }>;
  byErrorTag: Record<string, number>;
  studiedDays: string[];
} | null;
type LogLike = { length: number } | null;

function exportJson(
  aggregates: AggregatesLike,
  log: LogLike,
  estimates: EstimateLike[] | null,
  readiness: ReadinessLike,
  trend: string | null,
): void {
  const report = {
    app: "PTE Master Hub",
    geradoEm: new Date().toISOString(),
    escala: "10–90 (estimativa de treino — nunca nota oficial)",
    estimativas,
    prontidao: readiness,
    tendencia: trend,
    porTipo: aggregates?.byType ?? {},
    porCategoriaDeErro: aggregates?.byErrorTag ?? {},
    diasComEstudo: aggregates?.studiedDays ?? [],
    tentativasNoLog: log?.length ?? 0,
    baseMatriz: estimateBasis(),
  };
  download(`relatorio-pte-${getLocalDayKey()}.json`, JSON.stringify(report, null, 2), "application/json");
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(
  aggregates: AggregatesLike,
  log: LogLike,
  estimates: EstimateLike[] | null,
  readiness: ReadinessLike,
): void {
  const lines: string[] = [];
  lines.push("categoria,tipo,secao,tentativas,acertos,parciais,incorretas,abstencoes");
  for (const [type, tally] of Object.entries(aggregates?.byType ?? {})) {
    const def = TASK_BY_ID.get(type as Parameters<typeof TASK_BY_ID.get>[0]);
    lines.push(
      [
        "tipo",
        def?.label ?? type,
        def ? SECTION_LABELS[def.section] : "—",
        tally.attempts,
        tally.correct,
        tally.partial,
        tally.incorrect,
        tally.abstained,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");
  lines.push("habilidade,estimativa_10_90,confianca,tentativas_usadas");
  for (const estimate of estimates ?? []) {
    lines.push(
      [
        estimate.abilityLabel,
        estimate.score !== null ? estimate.score : "sem sinal",
        estimate.confidence,
        estimate.attemptsUsed,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");
  lines.push("prontidao_0_100,confianca,tendencia");
  lines.push(
    [
      readiness?.value !== null && readiness?.value !== undefined ? readiness.value : "sem sinal",
      readiness?.confidence ?? "baixa",
      readiness?.trend ?? "—",
    ]
      .map(csvCell)
      .join(","),
  );
  lines.push("");
  lines.push(`tentativas_no_log,${log?.length ?? 0}`);
  lines.push(`dias_com_estudo,${aggregates?.studiedDays.length ?? 0}`);
  download(`relatorio-pte-${getLocalDayKey()}.csv`, lines.join("\n"), "text/csv");
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
