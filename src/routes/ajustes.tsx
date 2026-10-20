import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { PageContainer, PageHeader, QuotaWarning } from "@/components/app-shell";
import { progress, notifyProgressChanged } from "@/lib/progress/client";
import { useProgressRevision, useMeta } from "@/hooks/use-progress";
import type { ImportMode } from "@/lib/progress/types";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes e backup — PTE Master Hub" },
      {
        name: "description",
        content:
          "Meta e data da prova, Studie Plus (desligado por padrão) e backup completo do progresso — exportar, importar com prévia e desfazer.",
      },
      { property: "og:title", content: "Ajustes e backup — PTE Master Hub" },
      {
        property: "og:description",
        content: "Metas, Studie Plus e backup completo do progresso local.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AjustesPage,
});

function AjustesPage() {
  const revision = useProgressRevision();
  const meta = useMeta();
  const [target, setTarget] = useState("");
  const [examDate, setExamDate] = useState("");
  const [studie, setStudie] = useState(progress.getStudie());
  const [preview, setPreview] = useState<
    | { kind: "ok"; data: Exclude<ReturnType<typeof progress.previewImport>, { error: string }> }
    | { kind: "error"; error: string }
    | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [usageFraction, setUsageFraction] = useState(0);

  useEffect(() => {
    const m = progress.getMeta();
    setTarget(m.targetScore ? String(m.targetScore) : "");
    setExamDate(m.examDate ?? "");
    setUsageFraction(progress.quota().fraction);
  }, [revision]);

  function saveMeta() {
    const base = progress.getMeta();
    const nextMeta: typeof base = { ...base };
    if (target) nextMeta.targetScore = Number(target);
    else delete nextMeta.targetScore;
    if (examDate) nextMeta.examDate = examDate;
    else delete nextMeta.examDate;
    const res = progress.setMeta(nextMeta);
    setNotice(res.ok ? "Meta salva." : "Espaço cheio: não foi possível salvar. Exporte um backup.");
    notifyProgressChanged();
  }

  function updateStudie(patch: Partial<typeof studie>) {
    const next = { ...studie, ...patch };
    const res = progress.setStudie(next);
    if (res.ok) {
      setStudie(next);
      notifyProgressChanged();
    }
  }

  function exportBackup() {
    const envelope = progress.exportBackup();
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pte-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Backup exportado.");
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const previewResult = progress.previewImport(text);
    if ("error" in previewResult) {
      setPreview({ kind: "error", error: previewResult.error });
    } else {
      setPreview({ kind: "ok", data: previewResult });
    }
  }

  function applyImport(mode: ImportMode) {
    const res = progress.applyImport(mode);
    if (res.ok) {
      setPreview(null);
      setNotice(`Backup aplicado (${mode}). Use “Desfazer importação” se algo ficou errado.`);
      notifyProgressChanged();
    } else if ("quota" in res && res.quota) {
      setNotice("Espaço cheio: a importação não foi concluída. Nada foi perdido.");
    } else {
      setNotice("Nenhuma prévia pendente. Escolha o arquivo de novo.");
    }
  }

  function undoImport() {
    const ok = progress.undoImport();
    setNotice(ok ? "Importação desfeita — estado anterior restaurado." : "Nada para desfazer.");
    if (ok) notifyProgressChanged();
  }

  function resetAll() {
    const confirmed = window.confirm(
      "Isso apaga TODO o progresso deste navegador. Exporte um backup antes. Continuar?",
    );
    if (!confirmed) return;
    const res = progress.resetAll();
    setNotice(res.ok ? "Progresso apagado." : "Não foi possível apagar (armazenamento cheio).");
    notifyProgressChanged();
  }

  return (
    <PageContainer>
      <PageHeader
        title="Ajustes e backup"
        description="Tudo fica neste navegador. O backup é a sua cópia de segurança — exporte de vez em quando."
      />

      <QuotaWarning fraction={usageFraction} />

      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-primary"
        >
          {notice}
        </p>
      ) : null}

      {/* Meta */}
      <section
        aria-labelledby="meta-titulo"
        className="mb-6 rounded-xl border border-border/60 bg-card/50 p-5"
      >
        <h2 id="meta-titulo" className="mb-3 text-sm font-medium text-foreground">
          Meta e prova
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Nota alvo (escala oficial)
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Sem meta</option>
              <option value="50">50</option>
              <option value="58">58</option>
              <option value="65">65</option>
              <option value="79">79</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Data da prova
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <button
          onClick={saveMeta}
          className="mt-3 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Salvar meta
        </button>
      </section>

      {/* Backup */}
      <section
        aria-labelledby="backup-titulo"
        className="mb-6 rounded-xl border border-border/60 bg-card/50 p-5"
      >
        <h2 id="backup-titulo" className="mb-1 text-sm font-medium text-foreground">
          Backup do progresso
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Exportar gera um arquivo JSON com todo o progresso. Importar primeiro mostra uma prévia —
          você escolhe mesclar ou substituir, e pode desfazer depois.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportBackup}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="size-3.5" /> Exportar backup
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Upload className="size-3.5" /> Escolher arquivo…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              void onFileChosen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {preview?.kind === "error" ? (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            Arquivo inválido:{" "}
            {preview.error === "future"
              ? "foi gerado por uma versão mais nova do app."
              : preview.error === "schema"
                ? "não tem o formato de backup deste app."
                : "não consegui ler o JSON."}
          </p>
        ) : null}

        {preview?.kind === "ok" ? (
          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
            <p className="text-xs text-muted-foreground">
              Backup de {preview.data.exportedAt.slice(0, 10)} · {preview.data.snapshotCount}{" "}
              questões ({preview.data.newSnapshots} novas, {preview.data.updatedSnapshots} para
              atualizar) · {preview.data.logCount} registros de log
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => applyImport("mesclar")}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Mesclar (mantém o local)
              </button>
              <button
                onClick={() => applyImport("substituir")}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Substituir (usa o backup)
              </button>
              <button
                onClick={() => setPreview(null)}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <button
            onClick={undoImport}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <RotateCcw className="size-3.5" /> Desfazer importação
          </button>
        </div>
      </section>

      {/* Studie Plus */}
      <section
        aria-labelledby="studie-titulo"
        className="mb-6 rounded-xl border border-border/60 bg-card/50 p-5"
      >
        <h2 id="studie-titulo" className="mb-1 text-sm font-medium text-foreground">
          Studie Plus
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Extras de estudo (tradução de palavras e frases, pronúncia) — desligado por padrão para
          manter o treino fiel ao exame.
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          {(
            [
              ["enabled", "Pack ativado"],
              ["wordTranslation", "Tradução de palavras"],
              ["phraseTranslation", "Tradução de frases"],
              ["pronunciation", "Treino de pronúncia"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-muted-foreground"
            >
              <input
                type="checkbox"
                checked={studie[key]}
                onChange={(e) =>
                  updateStudie({ [key]: e.target.checked } as Partial<typeof studie>)
                }
                className="size-4 accent-[var(--primary)]"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Zona de perigo */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="mb-1 text-sm font-medium text-destructive-foreground">Zona de perigo</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Apaga snapshots, agregados, log, meta e preferências deste navegador. O backup exportado
          não é afetado.
        </p>
        <button
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-background px-3.5 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" /> Apagar todo o progresso
        </button>
      </section>
    </PageContainer>
  );
}
