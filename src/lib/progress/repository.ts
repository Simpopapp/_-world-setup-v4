// Repositório de progresso (PRD D5/D6): snapshots por questão, agregados independentes do log
// truncável, backup envelope com prévia/mesclar/substituir/desfazer, migração sem perda.
import { onSrsReview, type SrsState } from "@/domain/srs";
import type { TaskType } from "@/domain/types";
import type {
  AttemptResult,
  AttemptLogEntry,
  BackupEnvelope,
  ErrorTag,
  ImportMode,
  ImportPreview,
  NoteEntry,
  PracticeSession,
  ProgressAggregates,
  QuestionSnapshot,
  SessionKind,
  StudentMeta,
  StudieSettings,
} from "./types";
import { DEFAULT_META, DEFAULT_STUDIE_SETTINGS, EMPTY_AGGREGATES } from "./types";
import {
  KEYS,
  quotaStatus,
  readStore,
  writeStore,
  type ReadResult,
  type WriteResult,
} from "./storage";
import type { StorageLike } from "./storage-like";
import { getLocalDayKey } from "./day";
import { MAX_SESSIONS } from "./types";

/** Contador de ids de sessão (processo do navegador; ids ficam únicos por carregamento). */
let sessionCounter = 0;

export const MAX_LOG_ENTRIES = 500;
export const APP_VERSION = "pte-hub 0.1.0";

export interface AttemptInput {
  qid: string;
  type: Parameters<typeof onSrsReview>[1];
  result: AttemptResult;
  score?: number;
  confidence?: number;
  /** Categorias de erro determinísticas (Fase 7); ausente/vazio = sem sinal. */
  errorTags?: ErrorTag[];
  provenance?: ProvenanceKey;
  evaluatorId?: string;
  promptVersion?: string;
  rubricVersion?: string;
  model?: string;
}

type ProvenanceKey = "verificada" | "corroborada" | "comunitaria";

/** Tally vazio para novos contadores. */
function emptyTally(): {
  attempts: number;
  correct: number;
  partial: number;
  incorrect: number;
  abstained: number;
} {
  return { attempts: 0, correct: 0, partial: 0, incorrect: 0, abstained: 0 };
}

function bumpTally(
  map: Record<
    string,
    | { attempts: number; correct: number; partial: number; incorrect: number; abstained: number }
    | undefined
  >,
  key: string,
  result: AttemptResult,
): void {
  const current = map[key] ?? emptyTally();
  current.attempts += 1;
  if (result === "correct") current.correct += 1;
  else if (result === "partial") current.partial += 1;
  else if (result === "incorrect") current.incorrect += 1;
  else if (result === "abstained") current.abstained += 1;
  map[key] = current;
}

function blankSnapshot(qid: string, type: AttemptInput["type"], now: number): QuestionSnapshot {
  return {
    qid,
    type,
    attempts: 0,
    lastResult: null,
    lastAt: now,
    best: null,
    worst: null,
    confidence: null,
    box: 1,
    dueAt: now,
    lapses: 0,
  };
}

export interface ProgressRepository {
  getSnapshot(qid: string): QuestionSnapshot | null;
  allSnapshots(): Record<string, QuestionSnapshot>;
  recordAttempt(input: AttemptInput, now?: number): { ok: true } | { ok: false; quota: boolean };
  getAggregates(): ProgressAggregates;
  getLog(limit?: number): AttemptLogEntry[];
  getMeta(): StudentMeta;
  setMeta(meta: StudentMeta): WriteResult;
  getStudie(): StudieSettings;
  setStudie(settings: StudieSettings): WriteResult;
  // Sessões retomáveis (Fase 7) — não vão no backup (decisão s8-1).
  listSessions(): PracticeSession[];
  getSession(id: string): PracticeSession | null;
  createSession(
    input: { title: string; kind: SessionKind; taskType?: TaskType; queue: string[] },
    now?: number,
  ): PracticeSession | { ok: false; quota: true };
  updateSession(
    id: string,
    patch: Partial<Pick<PracticeSession, "cursor" | "answered" | "status">>,
    now?: number,
  ): { ok: true } | { ok: false; quota: boolean } | { ok: false; noSession: true };
  deleteSession(id: string): { ok: boolean };
  // Notas privadas e favoritos (Fase 7) — dado do aluno, entra no backup.
  getNote(qid: string): NoteEntry | null;
  allNotes(): Record<string, NoteEntry>;
  setNote(qid: string, patch: { note?: string; favorite?: boolean }, now?: number): WriteResult;
  exportBackup(now?: number): BackupEnvelope;
  previewImport(raw: string): ImportPreview | { error: "corrupt" | "future" | "schema" };
  applyImport(
    mode: ImportMode,
  ): { ok: true } | { ok: false; quota: boolean } | { ok: false; noPreview: true };
  undoImport(): boolean;
  quota(): ReturnType<typeof quotaStatus>;
  /** Apaga TODO o progresso (snapshots, agregados, log, meta, studie, backup staged). */
  resetAll(): { ok: boolean };
  readResults(): {
    snapshots: ReadResult<Record<string, QuestionSnapshot>>;
    aggregates: ReadResult<ProgressAggregates>;
    log: ReadResult<AttemptLogEntry[]>;
  };
}

export function createProgressRepository(storage: StorageLike): ProgressRepository {
  const dayKey = getLocalDayKey();

  const readSnapshots = (): Record<string, QuestionSnapshot> => {
    const res = readStore<Record<string, QuestionSnapshot>>(storage, KEYS.snapshots);
    return res.ok ? res.value : {};
  };
  const readAggregates = (): ProgressAggregates => {
    const res = readStore<ProgressAggregates>(storage, KEYS.aggregates);
    return res.ok ? { ...EMPTY_AGGREGATES, ...res.value } : { ...EMPTY_AGGREGATES };
  };
  const readLog = (): AttemptLogEntry[] => {
    const res = readStore<AttemptLogEntry[]>(storage, KEYS.log);
    return res.ok ? res.value : [];
  };

  const writeSnapshots = (value: Record<string, QuestionSnapshot>): WriteResult =>
    writeStore(storage, KEYS.snapshots, value);
  const writeAggregates = (value: ProgressAggregates): WriteResult =>
    writeStore(storage, KEYS.aggregates, value);
  const writeLog = (value: AttemptLogEntry[]): WriteResult => writeStore(storage, KEYS.log, value);

  return {
    getSnapshot(qid: string): QuestionSnapshot | null {
      return readSnapshots()[qid] ?? null;
    },

    allSnapshots(): Record<string, QuestionSnapshot> {
      return readSnapshots();
    },

    recordAttempt(input: AttemptInput, now: number = Date.now()) {
      const snapshots = readSnapshots();
      const current = snapshots[input.qid] ?? blankSnapshot(input.qid, input.type, now);

      // SRS: só "correct" (respeitando vencimento) promove; só "incorrect" (lapso) rebaixa.
      const outcome =
        input.result === "correct" ? "correct" : input.result === "incorrect" ? "lapse" : null;
      let srs: SrsState = { box: current.box, dueAt: current.dueAt, lapses: current.lapses };
      if (outcome) srs = onSrsReview(srs, input.type, outcome, now);

      const score = input.score ?? null;
      const updated: QuestionSnapshot = {
        ...current,
        attempts: current.attempts + 1,
        lastResult: input.result,
        lastAt: now,
        best:
          score === null
            ? current.best
            : current.best === null
              ? score
              : Math.max(current.best, score),
        worst:
          score === null
            ? current.worst
            : current.worst === null
              ? score
              : Math.min(current.worst, score),
        confidence: input.confidence ?? current.confidence,
        box: srs.box,
        dueAt: srs.dueAt,
        lapses: srs.lapses,
      };
      snapshots[input.qid] = updated;
      const writeSnaps = writeSnapshots(snapshots);
      if (!writeSnaps.ok) return { ok: false, quota: true } as const;

      // Agregados incrementais, independentes do log truncável.
      const aggregates = readAggregates();
      if (input.result) {
        const byType = { ...aggregates.byType } as NonNullable<ProgressAggregates["byType"]>;
        bumpTally(
          byType as Record<string, ReturnType<typeof emptyTally>>,
          input.type,
          input.result,
        );
        const bySection = { ...aggregates.bySection } as NonNullable<
          ProgressAggregates["bySection"]
        >;
        const section = sectionOfType(input.type);
        bumpTally(
          bySection as Record<string, ReturnType<typeof emptyTally>>,
          section,
          input.result,
        );
        const byProvenance = { ...aggregates.byProvenance } as NonNullable<
          ProgressAggregates["byProvenance"]
        >;
        bumpTally(
          byProvenance as Record<string, ReturnType<typeof emptyTally>>,
          input.provenance ?? "comunitaria",
          input.result,
        );
        aggregates.byType = byType;
        aggregates.bySection = bySection;
        aggregates.byProvenance = byProvenance;
      }
      if (!aggregates.studiedDays.includes(dayKey))
        aggregates.studiedDays = [...aggregates.studiedDays, dayKey];
      aggregates.updatedAt = now;
      // Categorias de erro (Fase 7): contagem incremental — ausente = sem sinal, nunca zero.
      if (input.errorTags && input.errorTags.length > 0) {
        const byErrorTag = { ...aggregates.byErrorTag };
        for (const tag of input.errorTags) byErrorTag[tag] = (byErrorTag[tag] ?? 0) + 1;
        aggregates.byErrorTag = byErrorTag;
      }
      const writeAgg = writeAggregates(aggregates);
      if (!writeAgg.ok) return { ok: false, quota: true } as const;

      // Log truncável (teto MAX_LOG_ENTRIES, guarda as mais recentes).
      const log = readLog();
      const entry: AttemptLogEntry = {
        qid: input.qid,
        type: input.type,
        at: now,
        result: input.result,
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.errorTags && input.errorTags.length > 0 ? { errorTags: input.errorTags } : {}),
        ...(input.evaluatorId ? { evaluatorId: input.evaluatorId } : {}),
        ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
        ...(input.rubricVersion ? { rubricVersion: input.rubricVersion } : {}),
        ...(input.model ? { model: input.model } : {}),
      };
      const nextLog = [entry, ...log].slice(0, MAX_LOG_ENTRIES);
      const writeLogRes = writeLog(nextLog);
      if (!writeLogRes.ok) return { ok: false, quota: true } as const;

      return { ok: true } as const;
    },

    getAggregates(): ProgressAggregates {
      return readAggregates();
    },

    getLog(limit: number = MAX_LOG_ENTRIES): AttemptLogEntry[] {
      return readLog().slice(0, limit);
    },

    getMeta(): StudentMeta {
      const res = readStore<StudentMeta>(storage, KEYS.meta);
      return res.ok ? { ...DEFAULT_META, ...res.value } : { ...DEFAULT_META };
    },

    setMeta(meta: StudentMeta): WriteResult {
      return writeStore(storage, KEYS.meta, meta);
    },

    getStudie(): StudieSettings {
      const res = readStore<StudieSettings>(storage, KEYS.studie);
      return res.ok ? { ...DEFAULT_STUDIE_SETTINGS, ...res.value } : { ...DEFAULT_STUDIE_SETTINGS };
    },

    setStudie(settings: StudieSettings): WriteResult {
      return writeStore(storage, KEYS.studie, settings);
    },

    listSessions(): PracticeSession[] {
      const res = readStore<Record<string, PracticeSession>>(storage, KEYS.sessions);
      const map = res.ok ? res.value : {};
      return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getSession(id: string): PracticeSession | null {
      const res = readStore<Record<string, PracticeSession>>(storage, KEYS.sessions);
      const map = res.ok ? res.value : {};
      return map[id] ?? null;
    },

    createSession(
      input: { title: string; kind: SessionKind; taskType?: TaskType; queue: string[] },
      now: number = Date.now(),
    ): PracticeSession | { ok: false; quota: true } {
      const res = readStore<Record<string, PracticeSession>>(storage, KEYS.sessions);
      const map = res.ok ? res.value : {};
      sessionCounter += 1;
      const session: PracticeSession = {
        id: `sess-${now}-${sessionCounter}`,
        createdAt: now,
        updatedAt: now,
        title: input.title,
        kind: input.kind,
        ...(input.taskType ? { taskType: input.taskType } : {}),
        queue: input.queue,
        cursor: 0,
        answered: {},
        status: "ativa",
      };
      map[session.id] = session;
      // Poda: mantém as MAX_SESSIONS mais recentes (por updatedAt).
      const keep = new Set(
        Object.values(map)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_SESSIONS)
          .map((s) => s.id),
      );
      const pruned: Record<string, PracticeSession> = {};
      for (const [id, value] of Object.entries(map)) if (keep.has(id)) pruned[id] = value;
      const write = writeStore(storage, KEYS.sessions, pruned);
      return write.ok ? session : { ok: false, quota: true };
    },

    updateSession(
      id: string,
      patch: Partial<Pick<PracticeSession, "cursor" | "answered" | "status">>,
      now: number = Date.now(),
    ): { ok: true } | { ok: false; quota: boolean } | { ok: false; noSession: true } {
      const res = readStore<Record<string, PracticeSession>>(storage, KEYS.sessions);
      const map = res.ok ? res.value : {};
      const current = map[id];
      if (!current) return { ok: false, noSession: true };
      map[id] = { ...current, ...patch, updatedAt: now };
      return writeStore(storage, KEYS.sessions, map);
    },

    deleteSession(id: string): { ok: boolean } {
      const res = readStore<Record<string, PracticeSession>>(storage, KEYS.sessions);
      const map = res.ok ? res.value : {};
      if (!map[id]) return { ok: true };
      delete map[id];
      return { ok: writeStore(storage, KEYS.sessions, map).ok };
    },

    getNote(qid: string): NoteEntry | null {
      const res = readStore<Record<string, NoteEntry>>(storage, KEYS.notes);
      const map = res.ok ? res.value : {};
      return map[qid] ?? null;
    },

    allNotes(): Record<string, NoteEntry> {
      const res = readStore<Record<string, NoteEntry>>(storage, KEYS.notes);
      return res.ok ? res.value : {};
    },

    setNote(
      qid: string,
      patch: { note?: string; favorite?: boolean },
      now = Date.now(),
    ): WriteResult {
      const res = readStore<Record<string, NoteEntry>>(storage, KEYS.notes);
      const map = res.ok ? res.value : {};
      const current = map[qid] ?? { note: "", favorite: false, updatedAt: now };
      map[qid] = {
        note: patch.note ?? current.note,
        favorite: patch.favorite ?? current.favorite,
        updatedAt: now,
      };
      return writeStore(storage, KEYS.notes, map);
    },

    exportBackup(now: number = Date.now()): BackupEnvelope {
      return {
        version: 1,
        exportedAt: new Date(now).toISOString(),
        appVersion: APP_VERSION,
        snapshots: readSnapshots(),
        aggregates: readAggregates(),
        log: readLog(),
        meta: this.getMeta(),
        studie: this.getStudie(),
        notes: this.allNotes(),
      };
    },

    /** Faz o parse do backup e o ETAPA para confirmação (aplicar usa o staged). */
    previewImport(raw: string): ImportPreview | { error: "corrupt" | "future" | "schema" } {
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) return { error: parsed.reason };
      const envelope = parsed.envelope;
      const existing = readSnapshots();
      let newSnapshots = 0;
      let updatedSnapshots = 0;
      for (const qid of Object.keys(envelope.snapshots)) {
        if (existing[qid]) updatedSnapshots += 1;
        else newSnapshots += 1;
      }
      // Etapa o backup cru para o applyImport; nenhuma chave de progresso foi tocada ainda.
      storage.setItem(KEYS.importUndo, raw);
      return {
        version: envelope.version,
        exportedAt: envelope.exportedAt,
        snapshotCount: Object.keys(envelope.snapshots).length,
        logCount: envelope.log.length,
        hasMeta: Object.keys(envelope.meta).length > 0,
        hasStudie: Object.keys(envelope.studie).length > 0,
        newSnapshots,
        updatedSnapshots,
      };
    },

    applyImport(
      mode: ImportMode,
    ): { ok: true } | { ok: false; quota: boolean } | { ok: false; noPreview: true } {
      const stagedRaw = storage.getItem(KEYS.importUndo);
      if (!stagedRaw) return { ok: false, noPreview: true };
      const parsed = parseEnvelope(stagedRaw);
      if (!parsed.ok) return { ok: false, noPreview: true };
      const envelope = parsed.envelope;

      // Guarda o estado PRÉ-importação para desfazer (PRD D5) — como JSON cru, sem envelope duplo.
      const undo: BackupEnvelope = this.exportBackup();
      storage.setItem(KEYS.importUndo, JSON.stringify(undo));

      const snapshots =
        mode === "substituir"
          ? { ...envelope.snapshots }
          : { ...readSnapshots(), ...envelope.snapshots };
      const aggregates =
        mode === "substituir"
          ? envelope.aggregates
          : { ...readAggregates(), ...envelope.aggregates };
      const log =
        mode === "substituir"
          ? envelope.log
          : [...envelope.log, ...readLog()].slice(0, MAX_LOG_ENTRIES);
      const meta = mode === "substituir" ? envelope.meta : { ...this.getMeta(), ...envelope.meta };
      const studie =
        mode === "substituir" ? envelope.studie : { ...this.getStudie(), ...envelope.studie };
      // Notas (Fase 7): dado do aluno — mesclar preserva notas existentes e adiciona as importadas.
      const existingNotes = this.allNotes();
      const notes =
        mode === "substituir" ? { ...envelope.notes } : { ...existingNotes, ...envelope.notes };

      const results = [
        writeSnapshots(snapshots),
        writeAggregates(aggregates),
        writeLog(log),
        writeStore(storage, KEYS.meta, meta),
        writeStore(storage, KEYS.studie, studie),
        writeStore(storage, KEYS.notes, notes),
      ];
      if (results.some((r) => !r.ok)) return { ok: false, quota: true };
      return { ok: true };
    },

    undoImport(): boolean {
      const raw = storage.getItem(KEYS.importUndo);
      if (!raw) return false;
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) return false;
      const envelope = parsed.envelope;
      const results = [
        writeSnapshots(envelope.snapshots),
        writeAggregates(envelope.aggregates),
        writeLog(envelope.log),
        writeStore(storage, KEYS.meta, envelope.meta),
        writeStore(storage, KEYS.studie, envelope.studie),
        writeStore(storage, KEYS.notes, envelope.notes ?? {}),
      ];
      storage.removeItem(KEYS.importUndo);
      return !results.some((r) => !r.ok);
    },

    quota(): ReturnType<typeof quotaStatus> {
      return quotaStatus(storage);
    },

    resetAll() {
      const results = Object.values(KEYS).map((key) => safeRemove(storage, key));
      storage.removeItem(KEYS.importUndo);
      return { ok: results.every((r) => r.ok) };
    },

    readResults() {
      return {
        snapshots: readStore<Record<string, QuestionSnapshot>>(storage, KEYS.snapshots),
        aggregates: readStore<ProgressAggregates>(storage, KEYS.aggregates),
        log: readStore<AttemptLogEntry[]>(storage, KEYS.log),
      };
    },
  };
}

function sectionOfType(
  type: AttemptInput["type"],
): "speaking" | "writing" | "reading" | "listening" {
  if (
    [
      "read_aloud",
      "repeat_sentence",
      "describe_image",
      "retell_lecture",
      "answer_short",
      "sgd",
      "rts",
    ].includes(type)
  )
    return "speaking";
  if (["swt", "write_essay"].includes(type)) return "writing";
  if (
    [
      "read_fib_dropdown",
      "read_mcq_multi",
      "reorder_paragraphs",
      "read_fib_drag",
      "read_mcq_single",
    ].includes(type)
  )
    return "reading";
  return "listening";
}

/** Migração defensiva do envelope: valida versão e forma, preenche faltantes, preserva extras. */
export function parseEnvelope(
  raw: string,
): { ok: true; envelope: BackupEnvelope } | { ok: false; reason: "corrupt" | "future" | "schema" } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return { ok: false, reason: "schema" };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["version"] !== "number") return { ok: false, reason: "schema" };
  if (obj["version"] > 1) return { ok: false, reason: "future" };
  const snapshots = isRecord(obj["snapshots"]) ? obj["snapshots"] : {};
  const aggregates = isRecord(obj["aggregates"])
    ? { ...EMPTY_AGGREGATES, ...obj["aggregates"] }
    : { ...EMPTY_AGGREGATES };
  const log = Array.isArray(obj["log"]) ? (obj["log"] as AttemptLogEntry[]) : [];
  const meta = isRecord(obj["meta"])
    ? ({ ...DEFAULT_META, ...obj["meta"] } as StudentMeta)
    : { ...DEFAULT_META };
  const studie = isRecord(obj["studie"])
    ? ({ ...DEFAULT_STUDIE_SETTINGS, ...obj["studie"] } as StudieSettings)
    : { ...DEFAULT_STUDIE_SETTINGS };
  // Notas (Fase 7): backup antigo sem o campo → {} (nunca descarta notas de backups novos).
  const notes = isRecord(obj["notes"]) ? (obj["notes"] as Record<string, NoteEntry>) : {};
  return {
    ok: true,
    envelope: {
      version: 1,
      exportedAt:
        typeof obj["exportedAt"] === "string" ? obj["exportedAt"] : new Date(0).toISOString(),
      appVersion: typeof obj["appVersion"] === "string" ? obj["appVersion"] : "unknown",
      snapshots: snapshots as Record<string, QuestionSnapshot>,
      aggregates: aggregates as ProgressAggregates,
      log,
      meta,
      studie,
      notes,
      // Campos de versões futuras são PRESERVADOS (nunca descartados silenciosamente — PRD D5).
      ...knownKeys(obj),
    } as BackupEnvelope,
  };
}

/** Campos extras (não conhecidos na v1) do objeto original, preservados na migração. */
function knownKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const known = new Set([
    "version",
    "exportedAt",
    "appVersion",
    "snapshots",
    "aggregates",
    "log",
    "meta",
    "studie",
    "notes",
  ]);
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) extras[key] = obj[key];
  }
  return extras;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** removeItem tolerante (falha de quota em remoção é rara, mas não deve quebrar reset). */
function safeRemove(storage: StorageLike, key: string): { ok: boolean } {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
