// Motores de leitura (Fase 6a — PRD D10): read_fib_dropdown, read_fib_drag, reorder_paragraphs,
// read_mcq_single, read_mcq_multi. Correção determinística pelo gabarito; gabarito só pós-envio.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FeedbackPanel, SubmitRow } from "./feedback";
import {
  gradeBlankPicks,
  gradeMultiChoice,
  gradeOrdering,
  gradeSingleChoice,
  objectiveDraft,
  parsePassage,
  shuffleDeterministic,
} from "./grading";
import type { AttemptDraft, EngineProps } from "./types";

export function ReadFibDropdownEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as {
    passage: string;
    blanks: { options: string[]; answer: number }[];
  };
  const segments = useMemo(() => parsePassage(data.passage), [data.passage]);
  const [picks, setPicks] = useState<(number | null)[]>(() => Array(data.blanks.length).fill(null));
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setPicks(Array(data.blanks.length).fill(null));
        }}
        review={
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {data.blanks.map((blank, i) => (
              <li key={i}>
                Lacuna {i + 1}: você escolheu{" "}
                <span className="font-medium text-foreground">
                  {picks[i] === null ? "—" : blank.options[picks[i]!]}
                </span>{" "}
                · gabarito:{" "}
                <span className="font-medium text-success">{blank.options[blank.answer]}</span>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  const submit = () => {
    const grade = gradeBlankPicks(
      picks,
      data.blanks.map((b) => b.answer),
    );
    const result = objectiveDraft(question.id, question.type, grade);
    setDraft(result);
    onSubmit(result);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Escolha a opção de cada lacuna e envie (o gabarito aparece só depois).
      </p>
      <div className="text-base leading-loose">
        {segments.map((segment, i) =>
          segment.kind === "text" ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <select
              key={i}
              aria-label={`Lacuna ${segment.index + 1}`}
              value={
                picks[segment.index] === null || picks[segment.index] === undefined
                  ? ""
                  : String(picks[segment.index])
              }
              onChange={(event) => {
                const value = event.target.value === "" ? null : Number(event.target.value);
                setPicks((prev) => prev.map((p, idx) => (idx === segment.index ? value : p)));
              }}
              className="mx-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {data.blanks[segment.index]?.options.map((option, oi) => (
                <option key={oi} value={oi}>
                  {option}
                </option>
              ))}
            </select>
          ),
        )}
      </div>
      <SubmitRow
        disabled={picks.every((p) => p === null)}
        onClick={submit}
        hint="Preencha ao menos uma lacuna para enviar."
      />
    </div>
  );
}

export function ReadFibDragEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { passage: string; bank: string[]; answers: number[] };
  const segments = useMemo(() => parsePassage(data.passage), [data.passage]);
  const [slots, setSlots] = useState<(number | null)[]>(() =>
    Array(data.answers.length).fill(null),
  );
  const [draft, setDraft] = useState<AttemptDraft | null>(null);
  const used = new Set(slots.filter((s) => s !== null));

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setSlots(Array(data.answers.length).fill(null));
        }}
        review={
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {data.answers.map((answerIndex, i) => (
              <li key={i}>
                Lacuna {i + 1}: você colocou{" "}
                <span className="font-medium text-foreground">
                  {slots[i] === null ? "—" : data.bank[slots[i]!]}
                </span>{" "}
                · gabarito:{" "}
                <span className="font-medium text-success">{data.bank[answerIndex]}</span>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  const placeWord = (wordIndex: number) => {
    setSlots((prev) => {
      const target = prev.indexOf(null);
      if (target === -1) return prev;
      const next = [...prev];
      next[target] = wordIndex;
      return next;
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Clique numa palavra do banco para colocá-la na próxima lacuna vazia; clique na lacuna para
        devolver a palavra.
      </p>
      <div className="text-base leading-loose">
        {segments.map((segment, i) =>
          segment.kind === "text" ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              aria-label={`Lacuna ${segment.index + 1}: ${
                slots[segment.index] === null ? "vazia" : data.bank[slots[segment.index]!]
              }`}
              onClick={() =>
                setSlots((prev) => prev.map((s, idx) => (idx === segment.index ? null : s)))
              }
              className="mx-1 inline-flex min-w-24 items-center justify-center rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1 text-sm"
            >
              {slots[segment.index] === null
                ? `lacuna ${segment.index + 1}`
                : data.bank[slots[segment.index]!]}
            </button>
          ),
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3">
        {data.bank.map((word, wi) => (
          <button
            key={wi}
            type="button"
            disabled={used.has(wi)}
            onClick={() => placeWord(wi)}
            className="rounded-md border border-input bg-background px-2.5 py-1 text-sm disabled:opacity-30"
          >
            {word}
          </button>
        ))}
      </div>
      <SubmitRow
        disabled={slots.every((s) => s === null)}
        onClick={() => {
          const grade = gradeBlankPicks(slots, data.answers);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

export function ReorderEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { paragraphs: string[] };
  const shuffled = useMemo(() => {
    const indices = data.paragraphs.map((_, i) => i);
    let order = shuffleDeterministic(indices, question.id);
    if (data.paragraphs.length > 1 && order.every((v, i) => v === i)) {
      order = shuffleDeterministic(indices, `${question.id}#2`);
    }
    return order;
  }, [data.paragraphs, question.id]);
  const [order, setOrder] = useState<number[]>(shuffled);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  if (draft) {
    return (
      <FeedbackPanel
        draft={draft}
        onRetry={() => {
          setDraft(null);
          setOrder(shuffled);
        }}
        review={
          <>
            <p className="mt-3 text-xs font-medium text-foreground">Ordem correta:</p>
            <ol className="mt-1 list-decimal space-y-2 pl-5 text-xs text-muted-foreground">
              {data.paragraphs.map((paragraph, i) => (
                <li key={i}>{paragraph}</li>
              ))}
            </ol>
          </>
        }
      />
    );
  }

  const move = (position: number, delta: -1 | 1) => {
    setOrder((prev) => {
      const target = position + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[position], next[target]] = [next[target]!, next[position]!];
      return next;
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Ordene os parágrafos na sequência correta (↑/↓) e envie.
      </p>
      <ol className="space-y-2">
        {order.map((paragraphIndex, position) => (
          <li key={paragraphIndex} className="rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">posição {position + 1}</span>
              <button
                type="button"
                aria-label="Mover para cima"
                disabled={position === 0}
                onClick={() => move(position, -1)}
                className="rounded border border-input p-1 disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mover para baixo"
                disabled={position === order.length - 1}
                onClick={() => move(position, 1)}
                className="rounded border border-input p-1 disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed">{data.paragraphs[paragraphIndex]}</p>
          </li>
        ))}
      </ol>
      <SubmitRow
        onClick={() => {
          const grade = gradeOrdering(order);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
        hint="Pontuação pela proporção de pares adjacentes corretos."
      />
    </div>
  );
}

export function ReadMcqSingleEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as {
    passage: string;
    question: string;
    options: string[];
    answer: number;
  };
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
            Resposta correta:{" "}
            <span className="font-medium text-success">{data.options[data.answer]}</span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed">{data.passage}</p>
      <p className="mb-3 text-sm font-medium">{data.question}</p>
      <div role="radiogroup" aria-label={data.question} className="space-y-2">
        {data.options.map((option, oi) => (
          <label
            key={oi}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-card/40 p-3 text-sm hover:bg-accent/40"
          >
            <input
              type="radio"
              name="read-mcq-single"
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
          const grade = gradeSingleChoice(chosen, data.answer);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
      />
    </div>
  );
}

export function ReadMcqMultiEngine({ question, def, onSubmit }: EngineProps) {
  const data = question.data as {
    passage: string;
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
      <p className="mb-3 text-base leading-relaxed">{data.passage}</p>
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
