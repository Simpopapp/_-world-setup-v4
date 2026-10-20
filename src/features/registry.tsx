// Registro dos motores por tipo (Fase 6): o shell de prática resolve a engine pelo TaskType.
// Um componente por tipo; nenhum tipo fica sem motor (testado em registry.test.ts).
import type { ComponentType } from "react";
import type { TaskType } from "@/domain/types";
import type { EngineProps } from "./types";
import {
  ReadFibDragEngine,
  ReadFibDropdownEngine,
  ReadMcqMultiEngine,
  ReadMcqSingleEngine,
  ReorderEngine,
} from "./leitura";
import {
  LstFibEngine,
  LstHcsEngine,
  LstHiwEngine,
  LstMcqMultiEngine,
  LstMcqSingleEngine,
  LstSmwEngine,
  RepeatSentenceEngine,
  SstEngine,
  WfdEngine,
} from "./listening";
import { SwtEngine, WriteEssayEngine } from "./escrita";
import {
  AnswerShortEngine,
  DescribeImageEngine,
  ReadAloudEngine,
  RetellLectureEngine,
  RtsEngine,
  SgdEngine,
} from "./fala";

export const ENGINE_BY_TYPE: Record<TaskType, ComponentType<EngineProps>> = {
  read_fib_dropdown: ReadFibDropdownEngine,
  read_fib_drag: ReadFibDragEngine,
  reorder_paragraphs: ReorderEngine,
  read_mcq_single: ReadMcqSingleEngine,
  read_mcq_multi: ReadMcqMultiEngine,
  wfd: WfdEngine,
  sst: SstEngine,
  lst_fib: LstFibEngine,
  lst_hcs: LstHcsEngine,
  lst_smw: LstSmwEngine,
  lst_mcq_single: LstMcqSingleEngine,
  lst_mcq_multi: LstMcqMultiEngine,
  lst_hiw: LstHiwEngine,
  repeat_sentence: RepeatSentenceEngine,
  swt: SwtEngine,
  write_essay: WriteEssayEngine,
  read_aloud: ReadAloudEngine,
  describe_image: DescribeImageEngine,
  retell_lecture: RetellLectureEngine,
  answer_short: AnswerShortEngine,
  sgd: SgdEngine,
  rts: RtsEngine,
};
