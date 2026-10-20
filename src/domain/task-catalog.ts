// Catálogo unificado dos 22 tipos de tarefa pontuados do PTE Academic (desde 07/08/2025).
// Fonte dos rótulos/seções: planejamento do projeto (project1 §4). Nenhum número de contagem aqui —
// contagens são sempre derivadas do manifesto (src/data/manifest.generated.ts).
import type { Section, TaskType } from "@/domain/types";

export type TaskFamily = "fala" | "escrita" | "leitura" | "listening";

export interface TaskTiming {
  /** Valores de referência do formato; `confirmed: false` exige conferência na fonte vigente da
   *  Pearson antes de rotular qualquer simulado de "fiel" (PRD D12 / Fase 9). */
  prepSeconds?: number;
  responseSeconds?: number;
  wordLimit?: [number, number];
  audioSeconds?: number;
  textWords?: number;
  confirmed: boolean;
}

export interface TaskDefinition {
  id: TaskType;
  /** Rótulo pt-BR (o nome oficial do tipo permanece em inglês — conteúdo do exame). */
  label: string;
  section: Section;
  family: TaskFamily;
  summary: string;
  formatNotes?: string;
  timing: TaskTiming;
  /** Ordem típica dentro do exame (aproximada; a ordem oficial exige conferência na fonte vigente). */
  examOrder: number;
  orderConfirmed: boolean;
}

export const TASK_CATALOG: TaskDefinition[] = [
  {
    id: "read_aloud",
    label: "Read Aloud",
    section: "speaking",
    family: "fala",
    summary: "Leia em voz alta o texto exibido, com pronúncia e fluência naturais.",
    timing: { prepSeconds: 35, responseSeconds: 60, textWords: 60, confirmed: false },
    examOrder: 1,
    orderConfirmed: false,
  },
  {
    id: "repeat_sentence",
    label: "Repeat Sentence",
    section: "speaking",
    family: "fala",
    summary: "Ouça a frase e repita-a exatamente como ouviu.",
    timing: { audioSeconds: 6, responseSeconds: 15, confirmed: false },
    examOrder: 2,
    orderConfirmed: false,
  },
  {
    id: "describe_image",
    label: "Describe Image",
    section: "speaking",
    family: "fala",
    summary: "Descreva a imagem (gráfico, mapa ou diagrama) em detalhes e tendências.",
    timing: { prepSeconds: 25, responseSeconds: 40, confirmed: false },
    examOrder: 3,
    orderConfirmed: false,
  },
  {
    id: "retell_lecture",
    label: "Re-tell Lecture",
    section: "speaking",
    family: "fala",
    summary: "Ouça a palestra e recontê-la com as ideias principais.",
    timing: { audioSeconds: 90, prepSeconds: 10, responseSeconds: 40, confirmed: false },
    examOrder: 4,
    orderConfirmed: false,
  },
  {
    id: "answer_short",
    label: "Answer Short Question",
    section: "speaking",
    family: "fala",
    summary: "Ouça a pergunta e responda com uma ou poucas palavras.",
    timing: { audioSeconds: 8, responseSeconds: 12, confirmed: false },
    examOrder: 5,
    orderConfirmed: false,
  },
  {
    id: "sgd",
    label: "Summarize Group Discussion",
    section: "speaking",
    family: "fala",
    summary: "Ouça a discussão em grupo e resuma-a em voz alta.",
    timing: { audioSeconds: 180, confirmed: false },
    examOrder: 6,
    orderConfirmed: false,
  },
  {
    id: "rts",
    label: "Respond to a Situation",
    section: "speaking",
    family: "fala",
    summary: "Ouça a situação e responda de forma apropriada ao contexto.",
    timing: { audioSeconds: 30, responseSeconds: 40, confirmed: false },
    examOrder: 7,
    orderConfirmed: false,
  },
  {
    id: "swt",
    label: "Summarize Written Text",
    section: "writing",
    family: "escrita",
    summary: "Resuma o texto em uma única frase de 5 a 75 palavras.",
    timing: { responseSeconds: 600, wordLimit: [5, 75], textWords: 300, confirmed: false },
    examOrder: 8,
    orderConfirmed: false,
  },
  {
    id: "write_essay",
    label: "Write Essay",
    section: "writing",
    family: "escrita",
    summary: "Escreva uma dissertação argumentativa de 200 a 300 palavras.",
    timing: { responseSeconds: 1200, wordLimit: [200, 300], confirmed: false },
    examOrder: 9,
    orderConfirmed: false,
  },
  {
    id: "read_fib_dropdown",
    label: "Reading & Writing: Fill in the Blanks (dropdown)",
    section: "reading",
    family: "leitura",
    summary: "Complete as lacunas do texto escolhendo a opção de cada menu.",
    timing: { confirmed: false },
    examOrder: 1,
    orderConfirmed: false,
  },
  {
    id: "read_mcq_multi",
    label: "Multiple Choice, Multiple Answers",
    section: "reading",
    family: "leitura",
    summary: "Selecione todas as respostas corretas para a pergunta sobre o texto.",
    formatNotes: "Respostas incorretas descontam pontos no exame real.",
    timing: { confirmed: false },
    examOrder: 2,
    orderConfirmed: false,
  },
  {
    id: "reorder_paragraphs",
    label: "Re-order Paragraphs",
    section: "reading",
    family: "leitura",
    summary: "Reordene os parágrafos embaralhados na ordem correta.",
    formatNotes: "O banco guarda a ordem CORRETA; o embaralhamento acontece em runtime.",
    timing: { confirmed: false },
    examOrder: 3,
    orderConfirmed: false,
  },
  {
    id: "read_fib_drag",
    label: "Reading: Fill in the Blanks (drag-and-drop)",
    section: "reading",
    family: "leitura",
    summary: "Arraste as palavras do banco para as lacunas do texto.",
    timing: { confirmed: false },
    examOrder: 4,
    orderConfirmed: false,
  },
  {
    id: "read_mcq_single",
    label: "Multiple Choice, Single Answer",
    section: "reading",
    family: "leitura",
    summary: "Selecione a única resposta correta para a pergunta sobre o texto.",
    timing: { confirmed: false },
    examOrder: 5,
    orderConfirmed: false,
  },
  {
    id: "sst",
    label: "Summarize Spoken Text",
    section: "listening",
    family: "listening",
    summary: "Ouça o trecho e resuma-o por escrito (50–70 palavras).",
    timing: { audioSeconds: 90, responseSeconds: 600, wordLimit: [50, 70], confirmed: false },
    examOrder: 1,
    orderConfirmed: false,
  },
  {
    id: "lst_mcq_multi",
    label: "Listening: Multiple Choice, Multiple Answers",
    section: "listening",
    family: "listening",
    summary: "Ouça o áudio e selecione todas as respostas corretas.",
    formatNotes: "Respostas incorretas descontam pontos no exame real.",
    timing: { confirmed: false },
    examOrder: 2,
    orderConfirmed: false,
  },
  {
    id: "lst_fib",
    label: "Listening: Fill in the Blanks",
    section: "listening",
    family: "listening",
    summary: "Preencha as lacunas acompanhando o áudio pela transcrição.",
    formatNotes: "O motor usa o transcript do banco — nunca texto oculto sem áudio.",
    timing: { confirmed: false },
    examOrder: 3,
    orderConfirmed: false,
  },
  {
    id: "lst_hcs",
    label: "Highlight Correct Summary",
    section: "listening",
    family: "listening",
    summary: "Ouça o áudio e escolha o resumo que melhor o representa.",
    timing: { confirmed: false },
    examOrder: 4,
    orderConfirmed: false,
  },
  {
    id: "lst_mcq_single",
    label: "Listening: Multiple Choice, Single Answer",
    section: "listening",
    family: "listening",
    summary: "Ouça o áudio e selecione a única resposta correta.",
    timing: { confirmed: false },
    examOrder: 5,
    orderConfirmed: false,
  },
  {
    id: "lst_smw",
    label: "Select Missing Word",
    section: "listening",
    family: "listening",
    summary: "Ouça o áudio que termina abruptamente e escolha a palavra ausente.",
    timing: { confirmed: false },
    examOrder: 6,
    orderConfirmed: false,
  },
  {
    id: "lst_hiw",
    label: "Highlight Incorrect Words",
    section: "listening",
    family: "listening",
    summary: "Siga a transcrição exibida e marque as palavras que divergem do áudio.",
    formatNotes: "A diferença entre `spoken` e `shown` define as palavras erradas.",
    timing: { confirmed: false },
    examOrder: 7,
    orderConfirmed: false,
  },
  {
    id: "wfd",
    label: "Write From Dictation",
    section: "listening",
    family: "listening",
    summary: "Ouça a frase ditada e escreva-a exatamente.",
    timing: { audioSeconds: 5, responseSeconds: 15, confirmed: false },
    examOrder: 8,
    orderConfirmed: false,
  },
];

export const TASK_BY_ID = new Map<TaskType, TaskDefinition>(TASK_CATALOG.map((t) => [t.id, t]));

export function taskDefinition(id: TaskType): TaskDefinition {
  const def = TASK_BY_ID.get(id);
  if (!def) throw new Error(`tipo desconhecido no catálogo: ${id}`);
  return def;
}

/** Rótulos das seções em pt-BR. */
export const SECTION_LABELS: Record<Section, string> = {
  speaking: "Speaking",
  writing: "Writing",
  reading: "Reading",
  listening: "Listening",
};
