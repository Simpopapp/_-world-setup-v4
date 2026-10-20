import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — PTE Master Hub" },
      {
        name: "description",
        content:
          "Como o PTE Master Hub funciona: banco auditável, estimativas honestas, privacidade total e limites declarados.",
      },
      { property: "og:title", content: "Sobre — PTE Master Hub" },
      {
        property: "og:description",
        content: "Banco auditável, estimativas honestas e privacidade total.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Sobre, com franqueza"
        description="Este app é um instrumento de treino. Aqui está exatamente o que ele é, o que ele não é, e como seus dados são tratados."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card/50 p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">De onde vem o conteúdo</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cada questão traz a origem declarada: <strong>verificada</strong> (fonte oficial ou
            pontuação ≥ 80), <strong>corroborada</strong> (mesmo item em ≥ 2 fontes de operadores
            independentes) ou <strong>comunitária</strong> (fonte de preparo com curadoria, sem
            corroboração). Nenhuma questão é gerada por IA. As fontes ficam no repositório do
            projeto, auditáveis por qualquer pessoa.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">Estimativas ≠ notas oficiais</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            As pontuações do PTE são calculadas pela Pearson. Aqui, qualquer número que pareça nota
            é<strong> estimativa</strong>, rotulada como tal, e só aparece quando há base mínima de
            tentativas. As notas de corte, os tempos e a ordem oficial do exame serão conferidos na
            fonte vigente antes de qualquer simulado ser chamado de “fiel”.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">Privacidade</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Todo o seu progresso fica no armazenamento local deste navegador — sem conta, sem
            servidor, sem telemetria. Faça backup em{" "}
            <Link to="/ajustes" className="text-primary underline-offset-2 hover:underline">
              Ajustes
            </Link>{" "}
            e leve o arquivo com você. Limpar os dados do navegador apaga o progresso.
          </p>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">
            Estudie Plus e acessibilidade
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            O pack de apoio (tradução de palavras e frases, treino de pronúncia) vem desligado por
            padrão: o treino fiel ao exame vem primeiro. Todo o texto do app está em português, com
            rótulos de tarefa mantidos em inglês porque é assim que aparecem na prova.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
