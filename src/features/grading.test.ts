import { describe, expect, it } from "vitest";
import {
  countWords,
  gradeAcceptedAnswer,
  gradeBlankPicks,
  gradeDictation,
  gradeHighlightWrong,
  gradeMultiChoice,
  gradeOrdering,
  gradeSingleChoice,
  gradeTextBlanks,
  normalizeWord,
  objectiveOutcome,
  outcomeFromScore,
  parsePassage,
  shuffleDeterministic,
  wrongWordIndices,
} from "./grading";

describe("objectiveOutcome", () => {
  it("mapeia 1 → correct, 0 → incorrect e intermediários → partial", () => {
    expect(objectiveOutcome(1).result).toBe("correct");
    expect(objectiveOutcome(0).result).toBe("incorrect");
    expect(objectiveOutcome(0.5).result).toBe("partial");
    expect(objectiveOutcome(1.4).score).toBe(1);
    expect(objectiveOutcome(-2).score).toBe(0);
  });
});

describe("outcomeFromScore", () => {
  it("mapeia scores na escala da tentativa do tipo", () => {
    expect(outcomeFromScore(null, [0, 1])).toBe("abstained");
    expect(outcomeFromScore(100, [0, 100])).toBe("correct");
    expect(outcomeFromScore(60, [0, 100])).toBe("partial");
    expect(outcomeFromScore(0, [0, 100])).toBe("incorrect");
    expect(outcomeFromScore(2, [0, 2])).toBe("correct");
    expect(outcomeFromScore(1, [0, 2])).toBe("partial");
  });
});

describe("gradeSingleChoice / gradeMultiChoice", () => {
  it("única: só a opção do gabarito vale 1", () => {
    expect(gradeSingleChoice(2, 2).score).toBe(1);
    expect(gradeSingleChoice(1, 2).score).toBe(0);
    expect(gradeSingleChoice(null, 2).result).toBe("abstained");
  });
  it("múltipla: igual ao gabarito = 1 · subconjunto sem erro = 0,5 · erro = 0", () => {
    expect(gradeMultiChoice([0, 2], [0, 2]).result).toBe("correct");
    expect(gradeMultiChoice([0], [0, 2]).score).toBe(0.5);
    expect(gradeMultiChoice([0, 1], [0, 2]).result).toBe("incorrect");
    expect(gradeMultiChoice([], [0, 2]).result).toBe("abstained");
  });
});

describe("gradeBlankPicks / gradeTextBlanks", () => {
  it("lacunas de opção: proporção de posições corretas", () => {
    expect(gradeBlankPicks([1, 0, null], [1, 2, 0]).score).toBeCloseTo(1 / 3);
    expect(gradeBlankPicks([null, null], [1, 0]).result).toBe("abstained");
    expect(gradeBlankPicks([1, 2], [1, 2]).result).toBe("correct");
  });
  it("lacunas de texto: comparação normalizada", () => {
    expect(gradeTextBlanks(["Ocean", "  climate "], ["ocean", "climate"]).result).toBe("correct");
    expect(gradeTextBlanks(["river", "climate"], ["ocean", "climate"]).score).toBeCloseTo(0.5);
    expect(gradeTextBlanks(["", ""], ["a", "b"]).result).toBe("abstained");
  });
});

describe("gradeOrdering", () => {
  it("proporção de pares adjacentes corretos", () => {
    expect(gradeOrdering([0, 1, 2, 3]).result).toBe("correct");
    expect(gradeOrdering([2, 3, 0, 1]).score).toBeCloseTo(2 / 3); // 2→3 ✓, 3→0 ✗, 0→1 ✓
    expect(gradeOrdering([3, 2, 1, 0]).result).toBe("incorrect");
    expect(gradeOrdering([0]).result).toBe("correct");
  });
});

describe("gradeDictation", () => {
  it("palavras corretas na posição correta", () => {
    expect(gradeDictation("Climate change is real", "Climate change is real").result).toBe(
      "correct",
    );
    expect(gradeDictation("Climate change is", "Climate change is real").score).toBeCloseTo(0.75);
    expect(gradeDictation("", "Climate").result).toBe("abstained");
  });
});

describe("gradeAcceptedAnswer", () => {
  it("aceita variantes normalizadas da lista", () => {
    expect(gradeAcceptedAnswer("The Ocean", ["ocean", "sea"]).result).toBe("correct");
    expect(gradeAcceptedAnswer("river", ["ocean", "sea"]).result).toBe("incorrect");
    expect(gradeAcceptedAnswer("  ", ["ocean"]).result).toBe("abstained");
  });
});

describe("gradeHighlightWrong + wrongWordIndices", () => {
  it("calcula divergências spoken×shown e pontua com penalidade", () => {
    const wrong = wrongWordIndices("the cat sat on mat", "the big cat sat on the mat");
    // Comparação posicional: após a inserção de "big", todas as posições seguintes divergem.
    expect(wrong).toEqual([1, 2, 3, 4, 5, 6]);
    expect(gradeHighlightWrong([1, 6], wrong).score).toBeCloseTo(2 / 6);
    expect(gradeHighlightWrong([1], wrong).score).toBeCloseTo(1 / 6);
    expect(gradeHighlightWrong([0, 1], wrong).result).toBe("incorrect"); // 1 acerto, 1 erro
    expect(gradeHighlightWrong([], wrong).result).toBe("abstained");
  });
});

describe("parsePassage", () => {
  it("divide texto e lacunas {{n}}", () => {
    expect(parsePassage("A {{1}} B {{2}} C")).toEqual([
      { kind: "text", text: "A " },
      { kind: "blank", index: 0 },
      { kind: "text", text: " B " },
      { kind: "blank", index: 1 },
      { kind: "text", text: " C" },
    ]);
    expect(parsePassage("sem lacunas")).toEqual([{ kind: "text", text: "sem lacunas" }]);
  });
});

describe("shuffleDeterministic", () => {
  it("é determinístico por semente e preserva os itens", () => {
    const a = shuffleDeterministic([0, 1, 2, 3, 4], "q-42");
    const b = shuffleDeterministic([0, 1, 2, 3, 4], "q-42");
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4]);
    expect(shuffleDeterministic([1, 2], "x").length).toBe(2);
  });
});

describe("countWords / normalizeWord", () => {
  it("conta palavras e normaliza pontuação/caixa", () => {
    expect(countWords("  um  dois três ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(normalizeWord("  Ocean, ")).toBe("ocean");
  });
});

describe("abstenção sem nota substituta (PRD D7/D8)", () => {
  it("retorna score null quando não há resposta", () => {
    expect(gradeSingleChoice(null, 2).score).toBeNull();
    expect(gradeMultiChoice([], [0, 2]).score).toBeNull();
    expect(gradeBlankPicks([null, null], [1, 0]).score).toBeNull();
    expect(gradeTextBlanks(["", ""], ["a", "b"]).score).toBeNull();
    expect(gradeDictation("", "Climate").score).toBeNull();
    expect(gradeAcceptedAnswer("  ", ["ocean"]).score).toBeNull();
    expect(gradeHighlightWrong([], [1, 2]).score).toBeNull();
  });
});
