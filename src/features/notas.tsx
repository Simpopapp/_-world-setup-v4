// Painel de notas privadas e favoritos por questão (Fase 7 — PRD s8.4).
// Leitura em useEffect (nunca no render — SSR); gravação na camada de progresso com aviso visível.
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { progress, notifyProgressChanged } from "@/lib/progress/client";
import type { NoteEntry } from "@/lib/progress/types";

export function NotesPanel({ qid }: { qid: string }) {
  const [entry, setEntry] = useState<NoteEntry | null>(null);
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const current = progress.getNote(qid);
    setEntry(current);
    setText(current?.note ?? "");
    setSavedAt(null);
  }, [qid]);

  const saveNote = () => {
    const res = progress.setNote(qid, { note: text });
    if (res.ok) {
      notifyProgressChanged();
      setSavedAt(Date.now());
    }
  };

  const toggleFavorite = () => {
    const res = progress.setNote(qid, { favorite: !entry?.favorite });
    if (res.ok) {
      notifyProgressChanged();
      setEntry(progress.getNote(qid));
      setSavedAt(Date.now());
    }
  };

  const favorite = entry?.favorite ?? false;

  return (
    <div className="mt-4 rounded-lg border border-border/40 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={favorite}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Star
            className={`size-3.5 ${favorite ? "fill-warning text-warning" : "text-muted-foreground"}`}
          />
          {favorite ? "Favoritada" : "Favoritar"}
        </button>
        <p className="text-[11px] text-muted-foreground" role="status" aria-live="polite">
          {savedAt
            ? "Nota salva neste navegador."
            : entry?.note
              ? "Nota privada — só você vê."
              : "Nota privada sobre esta questão (opcional)."}
        </p>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={saveNote}
        rows={3}
        aria-label={`Nota privada sobre a questão ${qid}`}
        placeholder="O que você quer lembrar desta questão?"
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
    </div>
  );
}
