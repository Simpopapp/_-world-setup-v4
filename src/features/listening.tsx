// Motores de listening (Fase 6b — PRD D10): wfd, sst, lst_fib, lst_hcs, lst_smw, lst_mcq_single,
// lst_mcq_multi, lst_hiw + repeat_sentence (fala, executada por transcrição). O áudio é TTS real
// sobre o transcript do banco; gabarito só pós-envio.
import { useMemo, useState } from "react";
import { FeedbackPanel, AiPending, SubmitRow } from "./feedback";
import { AudioPlayer, SpeechResponseBox } from "./shared";
import { evaluateOpen } from "./ai-evaluate";
import {
  countWords,
  gradeDictation,
  gradeHighlightWrong,
  gradeMultiChoice,
  gradeSingleChoice,
  gradeTextBlanks,
  normalizeWord,
  objectiveDraft,
  parsePassage,
} from "./grading";
import type { AttemptDraft, EngineProps } from "./types";
import type { Question } from "@/domain/types";

export function WfdEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { sentence: string };
  const [response, setResponse] = useState("");
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setResponse("");
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Frase correta: <span className="font-medium text-success">{data.sentence}</span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer
        text={data.sentence}
        caption="Reproduza quantas vezes quiser antes de escrever."
      />
      <label className="text-sm font-medium" htmlFor="wfd-response">
        Escreva a frase ditada
      </label>
      <textarea
        id="wfd-response"
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
      <SubmitRow
        disabled={!response.trim()}
        onClick={() => {
          const grade = gradeDictation(response, data.sentence);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
        hint="Pontuação por palavras corretas na posição correta."
      />
    </div>
  );
}

export function SstEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { transcript: string; keywords: string[]; sample: string };
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);
  const words = countWords(response);
  const outOfRange = words > 0 && (words < 50 || words > 70);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setResponse("");
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Resumo de referência (para estudo):{" "}
            <span className="font-medium text-foreground">{data.sample}</span>
          </p>
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const result = await evaluateOpen({
        qid: question.id,
        type: question.type,
        question: { transcript: data.transcript },
        reference: { sample: data.sample, keywords: data.keywords },
        studentResponse: response.trim(),
      });
      setDraft(result);
      onSubmit(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AudioPlayer text={data.transcript} />
      <label className="text-sm font-medium" htmlFor="sst-response">
        Resumo por escrito
      </label>
      <textarea
        id="sst-response"
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={6}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
      />
      <p className={`mt-1 text-xs ${outOfRange ? "text-warning" : "text-muted-foreground"}`}>
        {words} palavras · alvo do formato: 50–70
      </p>
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit()}
          hint="Avaliação por IA: conteúdo, forma, gramática e ortografia (escala 0–10)."
        />
      )}
    </div>
  );
}

export function LstFibEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { template: string; answers: string[] };
  const segments = useMemo(() => parsePassage(data.template), [data.template]);
  const filled = useMemo(
    () =>
      data.template.replace(/\{\{(\d+)\}\}/g, (_, n: string) => data.answers[Number(n) - 1] ?? "…"),
    [data.template, data.answers],
  );
  const [values, setValues] = useState<string[]>(() => Array(data.answers.length).fill(""));
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setValues(Array(data.answers.length).fill(""));
        }}
        review={
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {data.answers.map((answer, i) => (
              <li key={i}>
                Lacuna {i + 1}: gabarito <span className="font-medium text-success">{answer}</span>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer text={filled} caption="Acompanhe o áudio e preencha as lacunas." />
      <div className="text-base leading-loose">
        {segments.map((segment, i) =>
          segment.kind === "text" ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <input
              key={i}
              type="text"
              aria-label={`Lacuna ${segment.index + 1}`}
              value={values[segment.index] ?? ""}
              onChange={(event) =>
                setValues((prev) =>
                  prev.map((v, idx) => (idx === segment.index ? event.target.value : v)),
                )
              }
              className="mx-1 w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          ),
        )}
      </div>
      <SubmitRow
        disabled={values.every((v) => v.trim() === "")}
        onClick={() => {
          const grade = gradeTextBlanks(values, data.answers);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

function SingleChoiceAfterAudio({
  question,
  onSubmit,
  audioText,
  prompt,
  options,
  answer,
}: {
  question: Question;
  onSubmit: EngineProps["onSubmit"];
  audioText: string;
  prompt: string;
  options: string[];
  answer: number;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setChosen(null);
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Resposta correta: <span className="font-medium text-success">{options[answer]}</span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer text={audioText} />
      {prompt ? <p className="mb-3 text-sm font-medium">{prompt}</p> : null}
      <div role="radiogroup" aria-label={prompt || "Opções"} className="space-y-2">
        {options.map((option, oi) => (
          <label
            key={oi}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-card/40 p-3 text-sm hover:bg-accent/40"
          >
            <input
              type="radio"
              name="lst-single"
              checked={chosen === oi}
              onChange={() => setChosen(oi)}
              className="mt-0.5"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <SubmitRow
        disabled={chosen === null}
        onClick={() => {
          const grade = gradeSingleChoice(chosen, answer);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

export function LstHcsEngine(props: EngineProps) {
  const data = props.question.data as { transcript: string; options: string[]; answer: number };
  return (
    <SingleChoiceAfterAudio
      {...props}
      audioText={data.transcript}
      prompt="Escolha o resumo que melhor representa o áudio."
      options={data.options}
      answer={data.answer}
    />
  );
}

export function LstSmwEngine(props: EngineProps) {
  const data = props.question.data as { transcript: string; options: string[]; answer: number };
  return (
    <SingleChoiceAfterAudio
      {...props}
      audioText={data.transcript}
      prompt="O áudio termina abruptamente: escolha a palavra ausente."
      options={data.options}
      answer={data.answer}
    />
  );
}

export function LstMcqSingleEngine(props: EngineProps) {
  const data = props.question.data as {
    transcript: string;
    question: string;
    options: string[];
    answer: number;
  };
  return (
    <SingleChoiceAfterAudio
      {...props}
      audioText={data.transcript}
      prompt={data.question}
      options={data.options}
      answer={data.answer}
    />
  );
}

export function LstMcqMultiEngine({ question, def, onSubmit }: EngineProps) {
  const data = question.data as {
    transcript: string;
    question: string;
    options: string[];
    answer: number[];
  };
  const [chosen, setChosen] = useState<number[]>([]);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setChosen([]);
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Respostas corretas:{" "}
            <span className="font-medium text-success">
              {data.answer.map((ai) => data.options[ai]).join(" · ")}
            </span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer text={data.transcript} />
      <p className="mb-3 text-sm font-medium">{data.question}</p>
      {def.formatNotes ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          {def.formatNotes}
        </p>
      ) : null}
      <div className="space-y-2">
        {data.options.map((option, oi) => (
          <label
            key={oi}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-card/40 p-3 text-sm hover:bg-accent/40"
          >
            <input
              type="checkbox"
              checked={chosen.includes(oi)}
              onChange={() =>
                setChosen((prev) =>
                  prev.includes(oi) ? prev.filter((c) => c !== oi) : [...prev, oi],
                )
              }
              className="mt-0.5"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <SubmitRow
        disabled={chosen.length === 0}
        onClick={() => {
          const grade = gradeMultiChoice(chosen, data.answer);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

export function LstHiwEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { spoken: string; shown: string };
  const shownTokens = useMemo(() => data.shown.split(/\s+/).filter(Boolean), [data.shown]);
  const spokenTokens = useMemo(() => data.spoken.split(/\s+/).filter(Boolean), [data.spoken]);
  const [marked, setMarked] = useState<number[]>([]);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  const wrongIndices = useMemo(() => {
    const indices: number[] = [];
    const total = Math.max(shownTokens.length, spokenTokens.length);
    for (let i = 0; i < total; i++) {
      const shown = shownTokens[i] !== undefined ? normalizeWord(shownTokens[i]!) : "";
      const spoken = spokenTokens[i] !== undefined ? normalizeWord(spokenTokens[i]!) : "";
      if (shown !== spoken) indices.push(i);
    }
    return indices;
  }, [shownTokens, spokenTokens]);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setMarked([]);
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Palavras que divergem do áudio:{" "}
            <span className="font-medium text-success">
              {wrongIndices.map((i) => shownTokens[i] ?? "").join(" · ") || "nenhuma"}
            </span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer
        text={data.spoken}
        caption="Siga a transcrição exibida e clique nas palavras que DIVERGEM do áudio."
      />
      <p className="mb-2 text-sm text-muted-foreground">
        Marque as palavras diferentes do que você ouviu.
      </p>
      <p className="text-base leading-loose">
        {shownTokens.map((token, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={marked.includes(i)}
            onClick={() =>
              setMarked((prev) => (prev.includes(i) ? prev.filter((m) => m !== i) : [...prev, i]))
            }
            className={`mr-1 rounded px-0.5 text-base ${
              marked.includes(i) ? "bg-warning/25 underline decoration-warning decoration-2" : ""
            }`}
          >
            {token}
          </button>
        ))}
      </p>
      <SubmitRow
        disabled={marked.length === 0}
        onClick={() => {
          const grade = gradeHighlightWrong(marked, wrongIndices);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

export function RepeatSentenceEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { transcript: string };
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setResponse("");
        }}
        review={
          <p className="mt-3 text-xs text-muted-foreground">
            Frase do áudio: <span className="font-medium text-success">{data.transcript}</span>
          </p>
        }
      />
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const result = await evaluateOpen({
        qid: question.id,
        type: question.type,
        question: { transcript: data.transcript },
        reference: { transcript: data.transcript },
        studentResponse: response.trim(),
      });
      setDraft(result);
      onSubmit(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AudioPlayer text={data.transcript} caption="Ouça e repita exatamente o que ouviu." />
      <SpeechResponseBox value={response} onChange={setResponse} label="O que você repetiu" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit()}
          hint="Avaliação por IA pela transcrição (proxy rotulado)."
        />
      )}
    </div>
  );
}
