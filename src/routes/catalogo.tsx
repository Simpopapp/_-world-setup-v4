import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Lock, CirclePlay, ListChecks } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app-shell";
import { catalogEntries, countForProvenance } from "@/lib/bank/manifest";
import { loadQuestions } from "@/lib/bank/loader";
import { progress } from "@/lib/progress/client";
import type { Section } from "@/domain/types";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de tarefas — PTE Master Hub" },
      {
        name: "description",
        content:
          "Os 22 tipos de tarefa do PTE Academic com contagens reais do banco, disponibilidade e origem dos dados.",
      },
      { property: "og:title", content: "Catálogo de tarefas — PTE Master Hub" },
      {
        property: "og:description",
        content: "Os 22 tipos de tarefa do PTE Academic com contagens reais e disponibilidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

const SECTION_LABELS: Record<Section, string> = {
  speaking: "Fala (Speaking)",
  writing: "Escrita (Writing)",
  reading: "Leitura (Reading)",
  listening: "Listening",
};

const SECTION_ORDER: Section[] = ["speaking", "writing", "reading", "listening"];

function CatalogPage() {
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const entries = useMemo(() => catalogEntries(), []);

  const filtered = entries.filter((e) => {
    if (onlyAvailable && !e.available) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      e.def.label.toLowerCase().includes(q) ||
      e.def.summary.toLowerCase().includes(q) ||
      e.def.id.includes(q)
    );
  });

  return (
    <PageContainer>
      <PageHeader
        title="Catálogo de tarefas"
        description="Os 22 tipos pontuados do PTE Academic (formato vigente desde 07/08/2025). Contagens vêm direto do banco — tipos sem questão aparecem como indisponíveis, não como promessa."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tarefa (ex.: Write Essay, WFD…)"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Buscar tarefa"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Só tarefas disponíveis
        </label>
      </div>

      {SECTION_ORDER.map((section) => {
        const sectionEntries = filtered.filter((e) => e.def.section === section);
        if (sectionEntries.length === 0) return null;
        return (
          <section key={section} aria-label={SECTION_LABELS[section]} className="mb-7">
            <h2 className="mb-3 text-sm font-medium text-foreground">
              {SECTION_LABELS[section]}{" "}
              <span className="text-muted-foreground">({sectionEntries.length} tipos)</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sectionEntries.map((e) => (
                <TaskCard key={e.def.id} entry={e} />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma tarefa corresponde à busca.
        </p>
      ) : null}

      <section className="mt-4 rounded-xl border border-border/60 bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium text-foreground">Origem do banco</h2>
        <p className="text-xs text-muted-foreground">
          {countForProvenance("verificada")} verificadas · {countForProvenance("corroborada")}{" "}
          corroboradas · {countForProvenance("comunitaria")} comunitárias — nenhuma questão gerada
          por IA. Detalhes em{" "}
          <Link to="/sobre" className="text-primary underline-offset-2 hover:underline">
            Sobre
          </Link>
          .
        </p>
      </section>
    </PageContainer>
  );
}

function TaskCard({ entry }: { entry: ReturnType<typeof catalogEntries>[number] }) {
  const { def, count, available } = entry;
  const timing = def.timing;
  const navigate = useNavigate();

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{def.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{def.summary}</p>
        </div>
        <span
          className={[
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            available
              ? "border border-success/40 bg-success/10 text-success"
              : "border border-border bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {available ? <CirclePlay className="size-3" /> : <Lock className="size-3" />}
          {available ? `${count} questões` : "em breve"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
        {timing.prepSeconds ? <Chip>Prep {timing.prepSeconds}s</Chip> : null}
        {timing.responseSeconds ? <Chip>{timing.responseSeconds}s de resposta</Chip> : null}
        {timing.audioSeconds ? <Chip>Áudio ~{timing.audioSeconds}s</Chip> : null}
        {timing.wordLimit ? (
          <Chip>
            {timing.wordLimit[0]}–{timing.wordLimit[1]} palavras
          </Chip>
        ) : null}
        {!timing.confirmed ? <Chip tone="warn">tempos não confirmados</Chip> : null}
      </div>
    </>
  );

  if (!available) {
    return (
      <div className="cursor-not-allowed rounded-xl border border-border/40 bg-card/30 p-4 opacity-70">
        {inner}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-primary/40">
      <Link to="/pratica/$type" params={{ type: def.id }} search={{ index: 0 }} className="block">
        {inner}
      </Link>
      <button
        type="button"
        onClick={startSession}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        <ListChecks className="size-3.5" /> Sessão retomável · 10 itens
      </button>
    </div>
  );

  async function startSession() {
    const questions = await loadQuestions(def.id);
    const queue = questions.slice(0, 10).map((q) => q.id);
    if (queue.length === 0) return;
    const created = progress.createSession({
      title: `Sessão · ${def.label}`,
      kind: "tipo",
      taskType: def.id,
      queue,
    });
    if ("id" in created) navigate({ to: "/sessao/$sessionId", params: { sessionId: created.id } });
  }
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span
      className={
        tone === "warn"
          ? "rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning"
          : "rounded border border-border/60 bg-secondary/60 px-1.5 py-0.5"
      }
    >
      {children}
    </span>
  );
}
