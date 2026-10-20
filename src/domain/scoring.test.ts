import { describe, expect, it } from "vitest";
import {
  abilityEstimates,
  dailyAccuracySeries,
  estimateBasis,
  estimateReadiness,
  estimateTrend,
  ESTIMATE_LABEL,
  ESTIMATE_MAX,
  ESTIMATE_MIN,
  type AttemptSignal,
  type ScoringInput,
  type TypeSignal,
} from "@/domain/scoring";
import { ABILITY_MATRIX } from "@/domain/ability-matrix";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function tally(overrides: Partial<TypeSignal> = {}): TypeSignal {
  return { attempts: 0, correct: 0, partial: 0, incorrect: 0, abstained: 0, ...overrides };
}

function entry(type: AttemptSignal["type"], at: number, result: AttemptSignal["result"]): AttemptSignal {
  return { type, at, result };
}

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return { byType: {}, log: [], now: NOW, ...overrides };
}

describe("scoring — estimativa 10–90 por habilidade", () => {
  it("sem dados: score null e confiança baixa para as 4 habilidades (nunca zero inventado)", () => {
    const estimates = abilityEstimates(makeInput());
    expect(estimates.map((e) => e.ability)).toEqual([
      "listening",
      "reading",
      "speaking",
      "writing",
    ]);
    for (const e of estimates) {
      expect(e.score).toBeNull();
      expect(e.confidence).toBe("baixa");
      expect(e.attemptsUsed).toBe(0);
    }
  });

  it("desempenho perfeito em wfd → 90 em listening e writing; demais sem sinal", () => {
    const estimates = abilityEstimates(
      makeInput({ byType: { wfd: tally({ attempts: 8, correct: 8 }) } }),
    );
    const byAbility = new Map(estimates.map((e) => [e.ability, e]));
    expect(byAbility.get("listening")!.score).toBe(90);
    expect(byAbility.get("writing")!.score).toBe(90);
    expect(byAbility.get("listening")!.typesUsed).toEqual(["wfd"]);
    expect(byAbility.get("speaking")!.score).toBeNull();
    expect(byAbility.get("reading")!.score).toBeNull();
  });

  it("só erros → 10 (piso da escala), nunca menos", () => {
    const estimates = abilityEstimates(
      makeInput({ byType: { wfd: tally({ attempts: 8, incorrect: 8 }) } }),
    );
    const byAbility = new Map(estimates.map((e) => [e.ability, e]));
    expect(byAbility.get("listening")!.score).toBe(ESTIMATE_MIN);
    expect(byAbility.get("writing")!.score).toBe(ESTIMATE_MIN);
  });

  it("abstenção NÃO entra como zero: tipo só com abstenções fica sem sinal", () => {
    const estimates = abilityEstimates(
      makeInput({ byType: { wfd: tally({ attempts: 8, abstained: 8 }) } }),
    );
    const byAbility = new Map(estimates.map((e) => [e.ability, e]));
    expect(byAbility.get("listening")!.score).toBeNull();
    expect(byAbility.get("listening")!.attemptsUsed).toBe(0);
  });

  it("parcial vale metade: 4 corretas + 8 parciais → perf 8/12 → 63", () => {
    const estimates = abilityEstimates(
      makeInput({
        byType: {
          repeat_sentence: tally({ attempts: 12, correct: 4, partial: 8 }),
        },
      }),
    );
    const byAbility = new Map(estimates.map((e) => [e.ability, e]));
    expect(byAbility.get("speaking")!.score).toBe(63);
    expect(byAbility.get("listening")!.score).toBe(63);
  });

  it("score fica sempre dentro de 10–90", () => {
    const estimates = abilityEstimates(
      makeInput({
        byType: {
          wfd: tally({ attempts: 20, correct: 3, incorrect: 17 }),
          swt: tally({ attempts: 15, correct: 12, partial: 3 }),
          sst: tally({ attempts: 10, correct: 5, incorrect: 5 }),
        },
      }),
    );
    for (const e of estimates) {
      if (e.score !== null) {
        expect(e.score).toBeGreaterThanOrEqual(ESTIMATE_MIN);
        expect(e.score).toBeLessThanOrEqual(ESTIMATE_MAX);
      }
    }
  });

  it("confiança cresce com o volume de sinal: 4 → baixa, 30 → alta", () => {
    const few = abilityEstimates(
      makeInput({ byType: { repeat_sentence: tally({ attempts: 4, correct: 3 }) } }),
    );
    expect(few.find((e) => e.ability === "speaking")!.confidence).toBe("baixa");

    const many = abilityEstimates(
      makeInput({ byType: { repeat_sentence: tally({ attempts: 30, correct: 30 }) } }),
    );
    expect(many.find((e) => e.ability === "speaking")!.confidence).toBe("alta");
  });

  it("a base das estimativas é a matriz aproximada, com fonte citada e sem confirmação", () => {
    const basis = estimateBasis();
    expect(basis.approximate).toBe(true);
    expect(basis.confirmedAt).toBeNull();
    expect(basis.source).toContain("Pearson");
  });

  it("todo tipo do banco contribui para pelo menos uma habilidade (matriz cobre os 22)", () => {
    const types = Object.keys(ABILITY_MATRIX);
    expect(types.length).toBe(22);
  });
});

describe("scoring — tendência e prontidão", () => {
  it("tendência: erros antigos + acertos recentes → subindo", () => {
    const log: AttemptSignal[] = [
      ...[1, 2, 3, 4].map((i) => entry("wfd", NOW - 10 * DAY + i * 60_000, "incorrect")),
      ...[1, 2, 3, 4].map((i) => entry("wfd", NOW - i * 60_000, "correct")),
    ];
    expect(estimateTrend(makeInput({ log }))).toBe("subindo");
  });

  it("tendência invertida → caindo; menos de 4 sinais → null", () => {
    const log: AttemptSignal[] = [
      ...[1, 2, 3, 4].map((i) => entry("wfd", NOW - 10 * DAY + i * 60_000, "correct")),
      ...[1, 2, 3, 4].map((i) => entry("wfd", NOW - i * 60_000, "incorrect")),
    ];
    expect(estimateTrend(makeInput({ log }))).toBe("caindo");
    expect(estimateTrend(makeInput({ log: log.slice(0, 3) }))).toBeNull();
  });

  it("abstenções não contam como erro na tendência", () => {
    const log: AttemptSignal[] = [
      ...[1, 2, 3].map((i) => entry("wfd", NOW - 10 * DAY + i * 60_000, "abstained")),
      ...[1, 2, 3, 4].map((i) => entry("wfd", NOW - i * 60_000, "correct")),
    ];
    expect(estimateTrend(makeInput({ log }))).toBeNull(); // só 4 sinais
  });

  it("prontidão sem dados → null; com dados → 0–100 com confiança coerente", () => {
    const empty = estimateReadiness(makeInput());
    expect(empty.value).toBeNull();
    expect(empty.confidence).toBe("baixa");

    const log: AttemptSignal[] = [1, 2, 3, 4, 5].map((i) =>
      entry("answer_short", NOW - i * 3_600_000, "correct"),
    );
    const ready = estimateReadiness(makeInput({ log }));
    expect(ready.value).not.toBeNull();
    expect(ready.value!).toBeGreaterThanOrEqual(0);
    expect(ready.value!).toBeLessThanOrEqual(100);
    expect(ready.confidence).toBe("baixa"); // 5 sinais < 8
    expect(ready.recentPerformance).toBe(1);
  });
});

describe("scoring — série diária para o gráfico de evolução", () => {
  it("acurácia por dia local: sinal único → 1; dia sem sinal → null", () => {
    const log: AttemptSignal[] = [
      entry("wfd", NOW - DAY / 2, "correct"),
      entry("wfd", NOW - DAY / 2 + 60_000, "correct"),
    ];
    const series = dailyAccuracySeries(log, 3, NOW);
    expect(series).toHaveLength(3);
    expect(series[2]!.day).toBeLessThanOrEqual(series[2]!.day); // dias em ordem
    expect(series[2]!.signals).toBe(2);
    expect(series[2]!.accuracy).toBe(1);
    expect(series[0]!.accuracy).toBeNull();
    expect(series[0]!.signals).toBe(0);
  });

  it("série usa chaves de dia local (sem depender de fuso/epoch)", () => {
    const log: AttemptSignal[] = [entry("swt", NOW, "partial")];
    const series = dailyAccuracySeries(log, 1, NOW);
    expect(series[0]!.accuracy).toBe(0.5);
  });

  it("o rótulo obrigatório existe e é estável", () => {
    expect(ESTIMATE_LABEL).toBe("estimativa de treino");
  });
});
