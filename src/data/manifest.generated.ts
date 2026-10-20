// GERADO POR scripts/gen-manifest.mjs — NÃO EDITAR À MÃO.
// Fonte única das contagens do banco (PRD D4). Contagens exibidas derivam SEMPRE daqui.
import type { Provenance, Section, TaskType } from "@/domain/types";

export interface BankManifest {
  version: string;
  generatedAt: string;
  total: number;
  byType: Record<TaskType, number>;
  bySection: Record<Section, number>;
  byProvenance: Record<Provenance, number>;
  images: { describeImage: number };
}

export const bankManifest = {
  version: "a8b1904fcfd6",
  generatedAt: "2026-10-20T10:34:39.480Z",
  total: 2823,
  byType: {
    answer_short: 378,
    describe_image: 20,
    lst_fib: 53,
    lst_hcs: 50,
    lst_hiw: 50,
    lst_mcq_multi: 50,
    lst_mcq_single: 50,
    lst_smw: 50,
    read_aloud: 340,
    read_fib_drag: 50,
    read_fib_dropdown: 41,
    read_mcq_multi: 50,
    read_mcq_single: 50,
    reorder_paragraphs: 50,
    repeat_sentence: 682,
    retell_lecture: 62,
    rts: 31,
    sgd: 25,
    sst: 58,
    swt: 53,
    wfd: 551,
    write_essay: 79,
  },
  bySection: {
    speaking: 1538,
    writing: 132,
    reading: 241,
    listening: 912,
  },
  byProvenance: {
    verificada: 74,
    corroborada: 207,
    comunitaria: 2542,
  },
  images: {
    describeImage: 20,
  },
} satisfies BankManifest as BankManifest;
