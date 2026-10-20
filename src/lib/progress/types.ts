// Tipos do progresso local (PRD D5). Progresso 100% local: sem auth, sem nuvem, sem multiusuário.
import type { Provenance, TaskType } from "@/domain/types";
import type { SrsBox } from "@/domain/srs";

export type AttemptResult = "correct" | "partial" | "incorrect" | "abstained" | "revised";

/** Categoria de erro derivada de comparação determinística com o gabarito (Fase 7, PRD s8.1).
 *  "fluencia" só será emitida quando houver sinal real da avaliação IA (nunca inventada). */
export type ErrorTag = "conteudo" | "fluencia" | "omissao" | "armadilha" | "palavra";

/** Snapshot POR QUESTÃO — sobrevive ao truncamento do log. */
export interface QuestionSnapshot {
  qid: string;
  type: TaskType;
  attempts: number;
  lastResult: AttemptResult | null;
  lastAt: number;
  best: number | null; // escala da tentativa (por tipo), nunca a estimativa 10–90
  worst: number | null;
  /** Confiança agregada da tentativa (0–1) informada pelo avaliador, quando existir. */
  confidence: number | null;
  /** SRS (caixa 1–5, vencimento, lapso) — espelha SrsState. */
  box: SrsBox;
  dueAt: number;
  lapses: number;
}

export interface TypeTally {
  attempts: number;
  correct: number;
  partial: number;
  incorrect: number;
  abstained: number;
}

export interface ProgressAggregates {
  byType: Partial<Record<TaskType, TypeTally>>;
  bySection: Partial<Record<"speaking" | "writing" | "reading" | "listening", TypeTally>>;
  byProvenance: Partial<Record<Provenance, TypeTally>>;
  /** Contagem por categoria de erro — ausente = sem sinal, nunca zero inventado. */
  byErrorTag: Partial<Record<ErrorTag, number>>;
  sessionsStarted: number;
  /** Dias locais (YYYY-MM-DD) com estudo registrado. */
  studiedDays: string[];
  updatedAt: number;
}

/** Log de tentativas — TRUNCÁVEL; os agregados e snapshots nunca dependem dele. */
export interface AttemptLogEntry {
  qid: string;
  type: TaskType;
  at: number;
  result: AttemptResult;
  score?: number;
  errorTags?: ErrorTag[];
  evaluatorId?: string;
  promptVersion?: string;
  rubricVersion?: string;
  model?: string;
}

export interface StudentMeta {
  /** Meta do aluno na escala oficial (50/58/65/79). */
  targetScore?: number;
  /** Data da prova (YYYY-MM-DD local). */
  examDate?: string;
  planPreferences?: string[];
}

export interface StudieSettings {
  /** Pack inteiro desligado por padrão (PRD D11). */
  enabled: boolean;
  wordTranslation: boolean;
  phraseTranslation: boolean;
  pronunciation: boolean;
  mode: "ia" | "offline";
}

export const DEFAULT_STUDIE_SETTINGS: StudieSettings = {
  enabled: false,
  wordTranslation: false,
  phraseTranslation: false,
  pronunciation: false,
  mode: "ia",
};

/** Nota privada/favorito POR QUESTÃO (Fase 7) — dado do aluno, entra no backup. */
export interface NoteEntry {
  note: string;
  favorite: boolean;
  updatedAt: number;
}

export type SessionKind = "fila-do-dia" | "tipo";

/** Sessão retomável (Fase 7): sobrevive ao recarregamento; NÃO vai no backup envelope (s8-1). */
export interface PracticeSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  kind: SessionKind;
  taskType?: TaskType;
  /** Fila de qids na ordem de prática. */
  queue: string[];
  /** Índice do próximo item a responder. */
  cursor: number;
  answered: Record<string, { result: AttemptResult; score: number | null; at: number }>;
  status: "ativa" | "concluida";
}

/** Teto de sessões guardadas (poda mantém as mais recentes). */
export const MAX_SESSIONS = 20;

export const DEFAULT_META: StudentMeta = {};

/** Envelope de backup versionado (PRD D5): exportar/importar com prévia, mesclar, substituir e desfazer.
 *  `notes` é retrocompatível na v1: backup antigo sem o campo → `{}` (nunca perde notas novas). */
export interface BackupEnvelope {
  version: 1;
  exportedAt: string;
  appVersion: string;
  snapshots: Record<string, QuestionSnapshot>;
  aggregates: ProgressAggregates;
  log: AttemptLogEntry[];
  meta: StudentMeta;
  studie: StudieSettings;
  notes?: Record<string, NoteEntry>;
}

export const EMPTY_AGGREGATES: ProgressAggregates = {
  byType: {},
  bySection: {},
  byProvenance: {},
  byErrorTag: {},
  sessionsStarted: 0,
  studiedDays: [],
  updatedAt: 0,
};

export type ImportMode = "mesclar" | "substituir";

export interface ImportPreview {
  version: number;
  exportedAt: string;
  snapshotCount: number;
  logCount: number;
  hasMeta: boolean;
  hasStudie: boolean;
  newSnapshots: number;
  updatedSnapshots: number;
}
