// Motores de fala (Fase 6d — PRD D10): read_aloud, describe_image, retell_lecture, answer_short,
// sgd, rts. Resposta por microfone quando disponível; sem áudio/transcrição → tentativa
// "não avaliado" (nunca nota inventada). answer_short é corrigido pelo gabarito; o resto vai à IA.
import { useState } from "react";
import { AiPending, FeedbackPanel, SubmitRow } from "./feedback";
import { AudioPlayer, SpeechResponseBox } from "./shared";
import { evaluateOpen } from "./ai-evaluate";
import { gradeAcceptedAnswer, objectiveDraft } from "./grading";
import type { AttemptDraft, EngineProps } from "./types";

function useOpenEngine(question: EngineProps["question"], onSubmit: EngineProps["onSubmit"]) {
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AttemptDraft | null>(null);

  const submit = async (payload: { question: unknown; reference: unknown }) => {
    setBusy(true);
    try {
      const result = await evaluateOpen({
        qid: question.id,
        type: question.type,
        question: payload.question,
        reference: payload.reference,
        studentResponse: response.trim(),
      });
      setDraft(result);
      onSubmit(result);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDraft(null);
    setResponse("");
  };

  return { response, setResponse, busy, draft, submit, reset };
}

export function ReadAloudEngine({ question, def, onSubmit }: EngineProps) {
  const data = question.data as { text: string };
  const { response, setResponse, busy, draft, submit, reset } = useOpenEngine(question, onSubmit);

  if (draft) {
    return <FeedbackPanel draft={draft} onRetry={reset} />;
  }

  return (
    <div>
      <p className="mb-3 rounded-lg border border-border/60 bg-card/40 p-4 text-base leading-relaxed">
        {data.text}
      </p>
      <p className="mb-2 text-sm text-muted-foreground">
        Leia o texto em voz alta ({def.timing.responseSeconds ?? 60}s de referência).
      </p>
      <SpeechResponseBox value={response} onChange={setResponse} label="Sua leitura" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit({ question: { text: data.text }, reference: null })}
          hint="Avaliação por IA pela transcrição (proxy rotulado): vocabulário, pausas e completude."
        />
      )}
    </div>
  );
}

export function DescribeImageEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as {
    image: string;
    alt: string;
    facts: string[];
    keywords: string[];
  };
  const { response, setResponse, busy, draft, submit, reset } = useOpenEngine(question, onSubmit);

  if (draft) {
    return <FeedbackPanel draft={draft} onRetry={reset} />;
  }

  return (
    <div>
      <figure className="mb-4">
        <img
          src={data.image}
          alt={data.alt}
          className="mx-auto max-h-96 rounded-lg border border-border/40"
        />
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {data.alt}
        </figcaption>
      </figure>
      <SpeechResponseBox value={response} onChange={setResponse} label="Sua descrição" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() =>
            void submit({
              question: { alt: data.alt, image: data.image },
              reference: { facts: data.facts, keywords: data.keywords },
            })
          }
          hint="Avaliação por IA contra os elementos-chave da imagem."
        />
      )}
    </div>
  );
}

export function RetellLectureEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { transcript: string; keywords: string[]; sample: string };
  const { response, setResponse, busy, draft, submit, reset } = useOpenEngine(question, onSubmit);

  if (draft) {
    return <FeedbackPanel draft={draft} onRetry={reset} />;
  }

  return (
    <div>
      <AudioPlayer
        allowText
        text={data.transcript}
        caption="Ouça a palestra e reconte as ideias principais."
      />
      <SpeechResponseBox value={response} onChange={setResponse} label="Seu recontar" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() =>
            void submit({
              question: { transcript: data.transcript },
              reference: { keywords: data.keywords, sample: data.sample },
            })
          }
          hint="Avaliação por IA pela transcrição (proxy rotulado): cobertura dos pontos-chave."
        />
      )}
    </div>
  );
}

export function AnswerShortEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { question: string; answers: string[] };
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
            Respostas aceitas:{" "}
            <span className="font-medium text-success">{data.answers.join(" · ")}</span>
          </p>
        }
      />
    );
  }

  return (
    <div>
      <AudioPlayer
        allowText
        text={data.question}
        caption="Ouça a pergunta e responda com uma ou poucas palavras."
      />
      <SpeechResponseBox
        value={response}
        onChange={setResponse}
        label="Sua resposta"
        placeholder="Resposta curta…"
      />
      <SubmitRow
        disabled={!response.trim()}
        onClick={() => {
          const grade = gradeAcceptedAnswer(response, data.answers);
          const result = objectiveDraft(question.id, question.type, grade);
          setDraft(result);
          onSubmit(result);
        }}
        hint="Correção determinística contra as respostas aceitas do item."
      />
    </div>
  );
}

export function SgdEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { turns: { speaker: string; text: string }[]; keywords: string[] };
  const { response, setResponse, busy, draft, submit, reset } = useOpenEngine(question, onSubmit);
  const audioText = data.turns.map((t) => `${t.speaker}: ${t.text}`).join(" ");

  if (draft) {
    return <FeedbackPanel draft={draft} onRetry={reset} />;
  }

  return (
    <div>
      <AudioPlayer
        allowText
        text={audioText}
        caption="Ouça a discussão em grupo e resuma-a em voz alta."
      />
      <SpeechResponseBox value={response} onChange={setResponse} label="Seu resumo falado" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() =>
            void submit({ question: { turns: data.turns }, reference: { keywords: data.keywords } })
          }
          hint="Avaliação por IA pela transcrição (proxy rotulado): cobertura dos turnos."
        />
      )}
    </div>
  );
}

export function RtsEngine({ question, onSubmit }: EngineProps) {
  const data = question.data as { scenario: string };
  const { response, setResponse, busy, draft, submit, reset } = useOpenEngine(question, onSubmit);

  if (draft) {
    return <FeedbackPanel draft={draft} onRetry={reset} />;
  }

  return (
    <div>
      <AudioPlayer
        allowText
        text={data.scenario}
        caption="Ouça a situação e responda de forma apropriada."
      />
      <SpeechResponseBox value={response} onChange={setResponse} label="Sua resposta" />
      {busy ? (
        <AiPending />
      ) : (
        <SubmitRow
          disabled={!response.trim()}
          onClick={() => void submit({ question: { scenario: data.scenario }, reference: null })}
          hint="Avaliação por IA pela transcrição (proxy rotulado): tom e adequação à situação."
        />
      )}
    </div>
  );
}
