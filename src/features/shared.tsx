// Áudio e captura de fala compartilhados entre os motores (PRD D10):
// - Listening usa TTS do navegador sobre o transcript do banco ("voz real exibida").
// - Fala usa SpeechRecognition quando disponível; sem suporte, digitação honesta (proxy rotulado).
import { useEffect } from "react";
import { Mic, Play, Square, TriangleAlert } from "lucide-react";
import { useSpeechInput, useTts } from "./use-speech";

export function AudioPlayer({
  text,
  caption,
  allowText = false,
}: {
  text: string;
  caption?: string;
  /**
   * Falso por padrão: sem voz, o conteúdo do áudio NÃO é exibido — em vários tipos ele é o
   * gabarito (wfd, lst_fib, repeat_sentence) ou exige audição real (PRD D14: honestidade antes
   * de praticabilidade). Passe true somente quando o texto é o próprio enunciado (fala).
   */
  allowText?: boolean;
}) {
  const { supported, speaking, voiceName, speak, stop } = useTts();
  const degraded = !supported || !voiceName;
  return (
    <div className="mb-4 rounded-lg border border-border/60 bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {speaking ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Square className="size-3.5" /> Parar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => speak(text)}
            disabled={!supported}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            <Play className="size-3.5" /> Ouvir
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {degraded
            ? "Voz do navegador indisponível — o áudio não pode ser tocado."
            : `Voz real: ${voiceName}`}
        </span>
      </div>
      {degraded && allowText ? (
        <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
            <TriangleAlert className="size-3.5 shrink-0" /> Modo degradado: o enunciado é exibido
            como texto porque este navegador não tem voz — a prática deixa de ser de audição.
          </p>
          <p className="mt-1 text-sm leading-relaxed">{text}</p>
        </div>
      ) : null}
      {degraded && !allowText ? (
        <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
            <TriangleAlert className="size-3.5 shrink-0" /> Este item exige ouvir o áudio e este
            navegador não tem voz — o conteúdo não é exibido para não revelar o gabarito.
          </p>
        </div>
      ) : null}
      {caption && !degraded ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}

export function SpeechResponseBox({
  value,
  onChange,
  label = "Sua resposta falada",
  placeholder = "Transcrição do que você falou…",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const recognition = useSpeechInput();

  useEffect(() => {
    if (recognition.transcript) onChange(recognition.transcript);
    // A transcrição chega em blocos; sincroniza apenas quando ela muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.transcript]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {recognition.listening ? (
          <button
            type="button"
            onClick={recognition.stop}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
          >
            <Square className="size-3.5" /> Parar gravação
          </button>
        ) : (
          <button
            type="button"
            onClick={recognition.start}
            disabled={!recognition.supported}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40"
          >
            <Mic className="size-3.5" /> Falar
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {recognition.listening
            ? "Gravando — fale agora…"
            : recognition.supported
              ? "Clique para falar ou digite abaixo."
              : "Reconhecimento de voz indisponível neste navegador — digite o que você falou."}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        aria-label={label}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
      <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" />A avaliação usa a transcrição (proxy
        rotulado): pronúncia e prosódia do áudio real não são medidas.
      </p>
    </div>
  );
}
