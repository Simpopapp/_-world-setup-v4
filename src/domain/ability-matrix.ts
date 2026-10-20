// Matriz tarefa×habilidade do PTE Academic.
// PRINCÍPIO (project1 §6.2): pesos/contribuições devem derivar da matriz oficial da Pearson.
// Enquanto a fonte vigente não é reconsultada (Fase 9), TUDO aqui é `approximate: true` e a UI
// deve declarar a aproximação. Nenhuma contribuição "de memória" é apresentada como fato.
import type { TaskType } from "@/domain/types";

export type Ability = "listening" | "reading" | "speaking" | "writing";

export interface AbilityContribution {
  /** Habilidades às quais a tarefa contribui no exame oficial. */
  abilities: Ability[];
  /** true = contribuição aproximada, ainda não confirmada na fonte oficial vigente. */
  approximate: boolean;
}

export const ABILITY_MATRIX: Record<TaskType, AbilityContribution> = {
  read_aloud: { abilities: ["speaking", "reading"], approximate: true },
  repeat_sentence: { abilities: ["speaking", "listening"], approximate: true },
  describe_image: { abilities: ["speaking"], approximate: true },
  retell_lecture: { abilities: ["speaking", "listening"], approximate: true },
  answer_short: { abilities: ["speaking", "listening"], approximate: true },
  sgd: { abilities: ["speaking", "listening"], approximate: true },
  rts: { abilities: ["speaking", "listening"], approximate: true },
  swt: { abilities: ["writing", "reading"], approximate: true },
  write_essay: { abilities: ["writing"], approximate: true },
  read_fib_dropdown: { abilities: ["reading", "writing"], approximate: true },
  read_mcq_multi: { abilities: ["reading"], approximate: true },
  reorder_paragraphs: { abilities: ["reading"], approximate: true },
  read_fib_drag: { abilities: ["reading"], approximate: true },
  read_mcq_single: { abilities: ["reading"], approximate: true },
  sst: { abilities: ["listening", "writing"], approximate: true },
  lst_mcq_multi: { abilities: ["listening"], approximate: true },
  lst_fib: { abilities: ["listening", "writing"], approximate: true },
  lst_hcs: { abilities: ["listening", "reading"], approximate: true },
  lst_mcq_single: { abilities: ["listening"], approximate: true },
  lst_smw: { abilities: ["listening"], approximate: true },
  lst_hiw: { abilities: ["listening", "reading"], approximate: true },
  wfd: { abilities: ["listening", "writing"], approximate: true },
};

export interface AbilityMatrixSource {
  /** Fonte a conferir (guia oficial de pontuação da Pearson). */
  label: string;
  url: string;
  /** Data (ISO) da última conferência na fonte vigente; null = nunca confirmado aqui. */
  confirmedAt: string | null;
  notes?: string;
}

export const ABILITY_MATRIX_SOURCE: AbilityMatrixSource = {
  label: "PTE Academic Score Guide (Pearson PTE)",
  url: "https://www.pearsonpte.com/preparation/score-guide",
  confirmedAt: null,
  notes:
    "answer_short associada a speaking+listening conforme a escolha registrada nesta matriz; " +
    "divergências encontradas na conferência oficial devem ser registradas aqui com a data da consulta.",
};

export const ABILITY_LABELS: Record<Ability, string> = {
  listening: "Listening",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
};
