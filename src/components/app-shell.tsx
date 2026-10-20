// Shell comum do app: cabeçalho com navegação + badge global da "Fila do dia", rodapé e página.
import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useDueCount } from "@/hooks/use-progress";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/diagnostico", label: "Diagnóstico" },
  { to: "/progresso", label: "Progresso" },
  { to: "/simulado", label: "Simulado" },
  { to: "/ajustes", label: "Ajustes" },
] as const;

export function AppHeader() {
  const location = useLocation();
  const due = useDueCount();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <span className="text-sm">PTE Master Hub</span>
        </Link>

        <nav aria-label="Navegação principal" className="ml-auto min-w-0 overflow-x-auto">
          <ul className="flex items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={[
                      "inline-flex items-center rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {due > 0 ? (
          <Link
            to="/"
            className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
            aria-label={`Fila do dia: ${due} ${due === 1 ? "revisão vencida" : "revisões vencidas"}`}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-warning" />
            Fila do dia · {due}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-border/30 py-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          PTE Master Hub — preparo para o PTE Academic. Estimativas de treino, não notas oficiais.
        </p>
        <p>
          Progresso guardado neste navegador.{" "}
          <Link to="/sobre" className="underline-offset-2 hover:underline">
            Privacidade e honestidade
          </Link>
        </p>
      </div>
    </footer>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>;
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Estado vazio com mensagem honesta (nada de dados fingidos). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Aviso quando a gravação pode falhar por quota (PRD D5 — nunca silencioso). */
export function QuotaWarning({ fraction }: { fraction: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(fraction >= 0.8);
  }, [fraction]);
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-warning-foreground"
    >
      Espaço de armazenamento quase cheio neste navegador ({Math.round(fraction * 100)}%). Exporte
      um backup em Ajustes para não perder progresso.
    </div>
  );
}
