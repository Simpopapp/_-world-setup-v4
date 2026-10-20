// Correção determinística dos tipos objetivos (PRD D10/D14): comparação contra o gabarito do item.
// Domínio puro, sem React e sem IO — 100% testável. A IA fica para as respostas abertas.
import type { TaskType } from "@/domain/types";
import type { AttemptResult, ErrorTag } from "@/lib/progress/types";
import { GABARITO_STAMP, type AttemptDraft } from "./types";

export interface GradeDetail {
  omissions?: number;
  wrong?: number;
  falsePositives?: number;
  wordsMissed?: number;
}

export interface ObjectiveGrade {
  result: AttemptResult;
  /** Proporção 0–1 dentro da escala da tentativa do tipo; null quando a tentativa foi abstenção. */
  score: number | null;
  /** Estrutura do erro — alimenta as categorias de erro do diagnóstico (Fase 7). */
  detail?: GradeDetail;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Normalização para comparação: minúsculas, sem pontuação nas bordas (espaços internos ficam). */
export function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "");
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

export function objectiveOutcome(score: number): ObjectiveGrade {
  const clamped = Math.max(0, Math.min(1, score));
  const result: AttemptResult =
    clamped >= 0.999 ? "correct" : clamped <= 0.001 ? "incorrect" : "partial";
  return { result, score: clamped };
}

/** Mapeia um score qualquer na escala da tentativa para o resultado (usado pela avaliação IA). */
export function outcomeFromScore(
  score: number | null,
  scale: readonly [number, number],
): AttemptResult {
  if (score === null) return "abstained";
  const [min, max] = scale;
  const span = max - min;
  if (span <= 0) return "abstained";
  if (Math.abs(score - max) <= span / 1000) return "correct";
  if (score > min + span / 1000) return "partial";
  return "incorrect";
}

/** Deriva categorias de erro do detalhe estrutural (determinístico — nunca inventado). */
export function errorTagsFromDetail(detail: GradeDetail | undefined): ErrorTag[] {
  if (!detail) return [];
  const tags: ErrorTag[] = [];
  if ((detail.omissions ?? 0) > 0) tags.push("omissao");
  if ((detail.wrong ?? 0) > 0) tags.push("conteudo");
  if ((detail.falsePositives ?? 0) > 0) tags.push("armadilha");
  if ((detail.wordsMissed ?? 0) > 0) tags.push("palavra");
  return tags;
}

/** Tentativa objetiva normalizada (gabarito local, confiança plena). */
export function objectiveDraft(qid: string, type: TaskType, grade: ObjectiveGrade): AttemptDraft {
  return {
    qid,
    type,
    result: grade.result,
    score: grade.score,
    confidence: 1,
    feedback: null,
    evidence: [],
    unmeasured: [],
    errorTags: errorTagsFromDetail(grade.detail),
    evaluator: GABARITO_STAMP,
  };
}

export function gradeSingleChoice(chosen: number | null, answer: number): ObjectiveGrade {
  if (chosen === null) return { result: "abstained", score: null };
  if (chosen === answer) return objectiveOutcome(1);
  return { ...objectiveOutcome(0), detail: { wrong: 1 } };
}

/** Múltipla: conjunto igual = 1 · subconjunto correto sem marcação errada = 0,5 · senão 0. */
export function gradeMultiChoice(chosen: number[], answers: number[]): ObjectiveGrade {
  if (chosen.length === 0) return { result: "abstained", score: null };
  const answerSet = new Set(answers);
  const correctPicks = chosen.filter((c) => answerSet.has(c)).length;
  const wrongPicks = chosen.length - correctPicks;
  const detail: GradeDetail = {
    // Marcar opção errada = cair em armadilha (definição declarada na UI — decisão s8-3).
    ...(wrongPicks > 0 ? { falsePositives: wrongPicks } : {}),
    // Resposta incompleta = conteúdo faltante.
    ...(answers.length - correctPicks > 0 ? { wrong: answers.length - correctPicks } : {}),
  };
  if (wrongPicks === 0 && correctPicks === answers.length) return objectiveOutcome(1);
  if (wrongPicks === 0 && correctPicks > 0) return { ...objectiveOutcome(0.5), detail };
  return { ...objectiveOutcome(0), detail };
}

/** Lacunas com opção (dropdown/drag): escolha = índice na lista; gabarito = índice correto. */
export function gradeBlankPicks(chosen: (number | null)[], answers: number[]): ObjectiveGrade {
  if (chosen.every((c) => c === null)) return { result: "abstained", score: null };
  const omissions = chosen.filter((c) => c === null).length;
  const wrong = chosen.filter((c, i) => c !== null && c !== answers[i]).length;
  const detail: GradeDetail = {
    ...(omissions > 0 ? { omissions } : {}),
    ...(wrong > 0 ? { wrong } : {}),
  };
  const correct = chosen.filter((c, i) => c !== null && c === answers[i]).length;
  return { ...objectiveOutcome(correct / Math.max(1, answers.length)), detail };
}

/** Lacunas digitadas (lst_fib): comparação normalizada contra o gabarito textual. */
export function gradeTextBlanks(values: string[], answers: string[]): ObjectiveGrade {
  if (values.every((v) => v.trim() === "")) return { result: "abstained", score: null };
  const omissions = values.filter((v) => v.trim() === "").length;
  const wordsMissed = values.filter(
    (v, i) => v.trim() !== "" && normalizeWord(v) !== normalizeWord(answers[i] ?? ""),
  ).length;
  const detail: GradeDetail = {
    ...(omissions > 0 ? { omissions } : {}),
    ...(wordsMissed > 0 ? { wordsMissed } : {}),
  };
  const correct = values.filter(
    (v, i) => normalizeWord(v) !== "" && normalizeWord(v) === normalizeWord(answers[i] ?? ""),
  ).length;
  return { ...objectiveOutcome(correct / Math.max(1, answers.length)), detail };
}

/** Reordenar: proporção de pares adjacentes corretos (par = índice original consecutivo). */
export function gradeOrdering(order: number[]): ObjectiveGrade {
  if (order.length < 2) return objectiveOutcome(1);
  let correctPairs = 0;
  for (let i = 0; i < order.length - 1; i++) {
    if (order[i + 1] === order[i]! + 1) correctPairs += 1;
  }
  const wrongPairs = order.length - 1 - correctPairs;
  return {
    ...objectiveOutcome(correctPairs / (order.length - 1)),
    ...(wrongPairs > 0 ? { detail: { wrong: wrongPairs } } : {}),
  };
}

/** Ditado (wfd): proporção de palavras corretas na posição correta (proxy por transcrição). */
export function gradeDictation(response: string, sentence: string): ObjectiveGrade {
  if (!response.trim()) return { result: "abstained", score: null };
  const responseTokens = tokenize(response);
  const sentenceTokens = tokenize(sentence);
  const correct = responseTokens.filter(
    (w, i) => sentenceTokens[i] !== undefined && sentenceTokens[i] === w,
  ).length;
  const denominator = Math.max(responseTokens.length, sentenceTokens.length);
  const grade = objectiveOutcome(denominator === 0 ? 0 : correct / denominator);
  const wordsMissed = denominator - correct;
  return wordsMissed > 0 ? { ...grade, detail: { wordsMissed } } : grade;
}

/** Resposta curta: igualdade normalizada contra a lista de respostas aceitas (artigos ignorados). */
export function gradeAcceptedAnswer(response: string, accepted: string[]): ObjectiveGrade {
  if (!response.trim()) return { result: "abstained", score: null };
  const norm = stripArticle(normalizeWord(response));
  if (accepted.some((a) => stripArticle(normalizeWord(a)) === norm)) return objectiveOutcome(1);
  return { ...objectiveOutcome(0), detail: { wrong: 1 } };
}

function stripArticle(word: string): string {
  return word.replace(/^(the|a|an)\s+/, "");
}

/** Highlight Incorrect Words: acertos − marcações erradas, sobre o total de palavras erradas. */
export function gradeHighlightWrong(marked: number[], wrongIndices: number[]): ObjectiveGrade {
  if (marked.length === 0) return { result: "abstained", score: null };
  const wrongSet = new Set(wrongIndices);
  const found = marked.filter((m) => wrongSet.has(m)).length;
  const falsePositives = marked.length - found;
  const raw = (found - falsePositives) / Math.max(1, wrongIndices.length);
  const detail: GradeDetail = {
    // Palavras erradas que ficaram sem marcação.
    ...(wrongIndices.length - found > 0 ? { wordsMissed: wrongIndices.length - found } : {}),
    // Marcar palavra certa como errada = armadilha (s8-3).
    ...(falsePositives > 0 ? { falsePositives } : {}),
  };
  return { ...objectiveOutcome(raw), detail };
}

/** Palavras erradas do lst_hiw: posições em que `shown` diverge de `spoken` (token a token). */
export function wrongWordIndices(shown: string, spoken: string): number[] {
  const shownTokens = tokenize(shown);
  const spokenTokens = tokenize(spoken);
  const indices: number[] = [];
  const total = Math.max(shownTokens.length, spokenTokens.length);
  for (let i = 0; i < total; i++) {
    if ((shownTokens[i] ?? "") !== (spokenTokens[i] ?? "")) indices.push(i);
  }
  return indices;
}

export type PassageSegment = { kind: "text"; text: string } | { kind: "blank"; index: number };

/** Divide `passage` nos marcadores {{1}}, {{2}}… (índice da lacuna = n − 1). */
export function parsePassage(passage: string): PassageSegment[] {
  const segments: PassageSegment[] = [];
  const marker = /\{\{(\d+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(passage)) !== null) {
    if (match.index > last) segments.push({ kind: "text", text: passage.slice(last, match.index) });
    segments.push({ kind: "blank", index: Number(match[1]) - 1 });
    last = marker.lastIndex;
  }
  if (last < passage.length) segments.push({ kind: "text", text: passage.slice(last) });
  return segments;
}

/** Embaralhamento determinístico (semente = id estável da questão — PRD: reorder embaralha em runtime). */
export function shuffleDeterministic<T>(items: T[], seed: string): T[] {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const random = () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}
