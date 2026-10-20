// Medição honesta (PRD D8): a escala de TENTATIVA (por tipo) é distinta da ESTIMATIVA por
// habilidade (10–90), que é sempre rotulada "estimativa de treino" — nunca nota oficial.
// Tudo aqui é função pura dos sinais reais do aluno:
//   • abstenção nunca entra como zero — é "sem sinal" (D8);
//   • prontidão = desempenho recente ponderado + tendência + confiança (nunca função do
//     tamanho do banco ou da cobertura);
//   • pesos derivam da matriz tarefa×habilidade, hoje aproximada (ABILITY_MATRIX_SOURCE),
//     e a declaração de aproximação acompanha qualquer número exibido.
import { ABILITY_MATRIX, ABILITY_LABELS, ABILITY_MATRIX_SOURCE } from "./ability-matrix";
import type { Ability } from "./ability-matrix";
import type { TaskType } from "./types";
import { getLocalDayKey } from "@/lib/progress/day";

export const ESTIMATE_MIN = 10;
export const ESTIMATE_MAX = 90;
/** Rótulo obrigatório em toda UI que exiba a escala 10–90 (D8: nenhuma tela mistura sem rótulo). */
export const ESTIMATE_LABEL = "estimativa de treino";

export type EstimateConfidence = "baixa" | "media" | "alta";
export type EstimateTrend = "subindo" | "estavel" | "caindo";

export const ABILITIES: Ability[] = ["listening", "reading", "speaking", "writing"];

/** Sinal de desempenho por tipo — mesma forma de `TypeTally` (cópia estrutural: domínio não
 *  importa a camada de progresso). */
export interface TypeSignal {
  attempts: number;
  correct: number;
  partial: number;
  incorrect: number;
  abstained: number;
}

export type SignalsByType = Partial<Record<TaskType, TypeSignal>>;

export type AttemptResultLike = "correct" | "partial" | "incorrect" | "abstained" | "revised";

/** Entrada mínima do log para scoring — estruturalmente compatível com `AttemptLogEntry`. */
export interface AttemptSignal {
  type: TaskType;
  at: number;
  result: AttemptResultLike;
}

export interface ScoringInput {
  byType: SignalsByType;
  log: AttemptSignal[];
  now: number;
}

export interface AbilityEstimate {
  ability: Ability;
  abilityLabel: string;
  /** 10–90 (ESTIMATE_LABEL) ou null = sem sinal. */
  score: number | null;
  confidence: EstimateConfidence;
  /** Tentativas que de fato alimentaram a estimativa (abstenções excluídas). */
  attemptsUsed: number;
  typesUsed: TaskType[];
}

export interface EstimateBasis {
  /** true = a matriz não foi confirmada na fonte oficial vigente; a UI declara a aproximação. */
  approximate: boolean;
  source: string;
  confirmedAt: string | null;
}

export interface Readiness {
  /** 0–100, também rotulada ESTIMATE_LABEL na UI; null = sem sinal. */
  value: number | null;
  confidence: EstimateConfidence;
  trend: EstimateTrend | null;
  /** Desempenho recente ponderado por recência (0–1). */
  recentPerformance: number | null;
  attemptsUsed: number;
}

export interface DailyAccuracyPoint {
  day: string;
  /** 0–1 ou null = dia sem sinal. */
  accuracy: number | null;
  signals: number;
}

const DAY_MS = 86_400_000;
/** Tentativas para considerar um tipo "maduro" (peso cheio). */
const MATURE_ATTEMPTS = 8;
/** Janela de recência: tentativas dentro dela pesam o dobro das antigas. */
const RECENT_WINDOW_MS = 21 * DAY_MS;
/** Confiança por volume de sinal (D8: confiança baixa sem dados). */
const CONFIDENCE_HIGH_FROM = 25;
const CONFIDENCE_MEDIUM_FROM = 8;
/** Delta mínimo (em desempenho médio) para chamar a tendência de subida/queda. */
const TREND_SPLIT_DELTA = 0.08;
/** Meia-vida da recência da prontidão: tentativa de 28 dias vale 1/4 da de hoje. */
const READINESS_DECAY_MS = 28 * DAY_MS;

/** Declaração da base usada pelas estimativas (aproximação + fonte). */
export function estimateBasis(): EstimateBasis {
  const approximate = Object.values(ABILITY_MATRIX).some((c) => c.approximate);
  return {
    approximate,
    source: ABILITY_MATRIX_SOURCE.label,
    confirmedAt: ABILITY_MATRIX_SOURCE.confirmedAt,
  };
}

function usableCount(t: TypeSignal): number {
  return Math.max(0, t.attempts - t.abstained);
}

/** Sinais computáveis: correct/partial/incorrect. Abstenção e revisão manual = sem sinal. */
function isSignal(result: AttemptResultLike): boolean {
  return result === "correct" || result === "partial" || result === "incorrect";
}

function signalValue(result: AttemptResultLike): number {
  if (result === "correct") return 1;
  if (result === "partial") return 0.5;
  return 0;
}

function typePerformance(t: TypeSignal): number | null {
  const usable = usableCount(t);
  if (usable <= 0) return null;
  return (t.correct + 0.5 * t.partial) / usable;
}

/** Peso do tipo na habilidade: maturidade (volume) × recência (janela de 21 dias). */
function typeWeight(type: TaskType, t: TypeSignal, log: AttemptSignal[], now: number): number {
  const maturity = Math.min(usableCount(t), MATURE_ATTEMPTS) / MATURE_ATTEMPTS;
  const entries = log.filter((e) => e.type === type && isSignal(e.result));
  const recent = entries.filter((e) => now - e.at <= RECENT_WINDOW_MS).length;
  const recency = entries.length === 0 ? 0.5 : 0.5 + 0.5 * (recent / entries.length);
  return maturity * recency;
}

function confidenceFor(attemptsUsed: number): EstimateConfidence {
  if (attemptsUsed < CONFIDENCE_MEDIUM_FROM) return "baixa";
  if (attemptsUsed < CONFIDENCE_HIGH_FROM) return "media";
  return "alta";
}

/** Estimativa 10–90 por habilidade, rotulada. null = sem sinal (nunca um zero inventado). */
export function abilityEstimates(input: ScoringInput): AbilityEstimate[] {
  return ABILITIES.map((ability) => {
    const parts: { perf: number; weight: number; usable: number; type: TaskType }[] = [];
    for (const [type, tally] of Object.entries(input.byType)) {
      const taskType = type as TaskType;
      const contribution = ABILITY_MATRIX[taskType];
      if (!contribution || !contribution.abilities.includes(ability)) continue;
      const signal = tally as TypeSignal;
      const perf = typePerformance(signal);
      if (perf === null) continue;
      parts.push({
        perf,
        weight: typeWeight(taskType, signal, input.log, input.now),
        usable: usableCount(signal),
        type: taskType,
      });
    }
    const attemptsUsed = parts.reduce((acc, p) => acc + p.usable, 0);
    if (parts.length === 0) {
      return {
        ability,
        abilityLabel: ABILITY_LABELS[ability],
        score: null,
        confidence: "baixa",
        attemptsUsed: 0,
        typesUsed: [],
      };
    }
    const totalWeight = parts.reduce((acc, p) => acc + p.weight, 0);
    const perf = parts.reduce((acc, p) => acc + p.perf * p.weight, 0) / totalWeight;
    const raw = Math.round(ESTIMATE_MIN + (ESTIMATE_MAX - ESTIMATE_MIN) * perf);
    return {
      ability,
      abilityLabel: ABILITY_LABELS[ability],
      score: Math.min(ESTIMATE_MAX, Math.max(ESTIMATE_MIN, raw)),
      confidence: confidenceFor(attemptsUsed),
      attemptsUsed,
      typesUsed: parts.map((p) => p.type),
    };
  });
}

/** Tendência: compara a metade mais antiga do log com a mais recente (só sinais). */
export function estimateTrend(input: ScoringInput): EstimateTrend | null {
  const signals = input.log.filter((e) => isSignal(e.result)).sort((a, b) => a.at - b.at);
  if (signals.length < 4) return null;
  const half = Math.floor(signals.length / 2);
  if (half < 2) return null;
  const mean = (list: AttemptSignal[]) =>
    list.reduce((acc, s) => acc + signalValue(s.result), 0) / list.length;
  const older = mean(signals.slice(0, half));
  const newer = mean(signals.slice(signals.length - half));
  const delta = newer - older;
  if (delta > TREND_SPLIT_DELTA) return "subindo";
  if (delta < -TREND_SPLIT_DELTA) return "caindo";
  return "estavel";
}

/** Prontidão (D8): desempenho recente ponderado + tendência + confiança. Sempre rotulada. */
export function estimateReadiness(input: ScoringInput): Readiness {
  const signals = input.log.filter((e) => isSignal(e.result));
  if (signals.length === 0) {
    return {
      value: null,
      confidence: "baixa",
      trend: null,
      recentPerformance: null,
      attemptsUsed: 0,
    };
  }
  const weights = signals.map((s) => Math.max(0.25, 1 - (input.now - s.at) / READINESS_DECAY_MS));
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  const perf =
    signals.reduce((acc, s, i) => acc + signalValue(s.result) * weights[i]!, 0) / weightSum;
  const trend = estimateTrend(input);
  const trendBonus =
    trend === "subindo" ? 12 : trend === "estavel" ? 4 : trend === "caindo" ? -6 : 0;
  const confidence = confidenceFor(signals.length);
  const confidenceBonus = confidence === "alta" ? 14 : confidence === "media" ? 8 : 0;
  const value = Math.max(0, Math.min(100, Math.round(perf * 70 + trendBonus + confidenceBonus)));
  return { value, confidence, trend, recentPerformance: perf, attemptsUsed: signals.length };
}

/** Série diária de acurácia (0–1) dos últimos N dias locais — alimenta o gráfico de evolução. */
export function dailyAccuracySeries(
  log: AttemptSignal[],
  days: number = 14,
  now: number = Date.now(),
): DailyAccuracyPoint[] {
  const byDay = new Map<string, { sum: number; signals: number }>();
  for (const entry of log) {
    if (!isSignal(entry.result)) continue;
    const key = getLocalDayKey(entry.at);
    const current = byDay.get(key) ?? { sum: 0, signals: 0 };
    current.sum += signalValue(entry.result);
    current.signals += 1;
    byDay.set(key, current);
  }
  const points: DailyAccuracyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = getLocalDayKey(now - i * DAY_MS);
    const entry = byDay.get(day);
    points.push({
      day,
      accuracy: entry ? entry.sum / entry.signals : null,
      signals: entry?.signals ?? 0,
    });
  }
  return points;
}
