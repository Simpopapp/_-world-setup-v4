import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/simulado")({
  head: () => ({
    meta: [
      { title: "Simulado — PTE Master Hub" },
      {
        name: "description",
        content:
          "Simulado completo do PTE Academic com blueprint honesto: os tempos oficiais ainda serão conferidos antes de rotular como fiel.",
      },
      { property: "og:title", content: "Simulado — PTE Master Hub" },
      {
        property: "og:description",
        content: "Simulado completo com blueprint honesto e tempos a conferir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimuladoPage,
});

function SimuladoPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Simulado completo"
        description="Um exame cronometrado, seção por seção, com relatório ao final. A estrutura abaixo é do formato vigente (07/08/2025) — mas só chamamos de “fiel” depois de conferir os tempos na fonte vigente da Pearson."
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        {(
          [
            [
              "Fala + Escrita",
              "Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Answer Short Question, Summarize Group Discussion, Respond to Situation, Summarize Written Text, Write Essay",
            ],
            [
              "Leitura",
              "Fill in the Blanks (dropdown e arrastar), Reorder Paragraphs, Multiple Choice (single e multiple)",
            ],
            [
              "Listening",
              "Summarize Spoken Text, Multiple Choice, Fill in the Blanks, Highlight Correct Summary, Select Missing Word, Highlight Incorrect Words, Write from Dictation",
            ],
          ] as const
        ).map(([title, body]) => (
          <div key={title} className="rounded-xl border border-border/60 bg-card/50 p-4">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-warning/30 bg-warning/5 p-5">
        <h2 className="mb-1 text-sm font-medium text-warning">Estado honesto: em construção</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O simulado entra depois dos motores por tipo de tarefa (Fase 9 do plano). Antes disso,
          nenhum botão “iniciar simulado” aqui — não lançamos algo que ainda não cumpre o cronômetro
          e o relatório prometidos.
        </p>
      </section>
    </PageContainer>
  );
}
