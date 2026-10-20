// Categorias de erro determinísticas (Fase 7): cada tag nasce de comparação com o gabarito.
import { describe, expect, it } from "vitest";
import {
  errorTagsFromDetail,
  gradeAcceptedAnswer,
  gradeBlankPicks,
  gradeDictation,
  gradeHighlightWrong,
  gradeMultiChoice,
  gradeOrdering,
  gradeSingleChoice,
  gradeTextBlanks,
  objectiveDraft,
} from "./grading";

describe("derivação de tags por função de grading", () => {
  it("single choice errada → conteudo; correta e abstenção não geram tag", () => {
    expect(gradeSingleChoice(1, 0).detail).toEqual({ wrong: 1 });
    expect(gradeSingleChoice(1, 1).detail).toBeUndefined();
    expect(gradeSingleChoice(null, 1).result).toBe("abstained");
    expect(objectiveDraft("q", "read_mcq_single", gradeSingleChoice(1, 0)).errorTags).toEqual([
      "conteudo",
    ]);
  });

  it("multi com marcação errada → armadilha; incompleta sem marcação errada → conteudo", () => {
    // Escolheu 0 (errada) e faltou 1 e 2: armadilha + conteudo (2 faltantes).
    expect(gradeMultiChoice([0], [1, 2])).toMatchObject({
      detail: { falsePositives: 1, wrong: 2 },
    });
    expect(objectiveDraft("q", "read_mcq_multi", gradeMultiChoice([0], [1, 2])).errorTags).toEqual([
      "conteudo",
      "armadilha",
    ]);
    // Subconjunto correto, nada errado: só conteudo (faltou a 2ª).
    expect(gradeMultiChoice([0], [0, 1]).detail).toEqual({ wrong: 1 });
    // Completo: sem detalhe.
    expect(gradeMultiChoice([0, 1], [0, 1]).detail).toBeUndefined();
  });

  it("lacunas: vazias → omissao; erradas → conteudo", () => {
    const grade = gradeBlankPicks([0, null, 2], [0, 1, 3]);
    expect(grade.detail).toEqual({ omissions: 1, wrong: 1 });
    const draft = objectiveDraft("q", "read_fib_dropdown", grade);
    expect(draft.errorTags).toEqual(["omissao", "conteudo"]);
  });

  it("lacunas digitadas (lst_fib): vazia → omissao; errada digitada → palavra", () => {
    const grade = gradeTextBlanks(["the", "", "houses"], ["the", "big", "car"]);
    expect(grade.detail).toEqual({ omissions: 1, wordsMissed: 1 });
    expect(objectiveDraft("q", "lst_fib", grade).errorTags).toEqual(["omissao", "palavra"]);
  });

  it("ditado (wfd): palavras divergentes (posição a posição) → palavra", () => {
    // "mat" fora da posição do "the" e a palavra final "mat" sem par: 2 divergências.
    const grade = gradeDictation("the cat sat on mat", "the cat sat on the mat");
    expect(grade.detail).toEqual({ wordsMissed: 2 });
    expect(objectiveDraft("q", "wfd", grade).errorTags).toEqual(["palavra"]);
    expect(
      gradeDictation("the cat sat on the mat", "the cat sat on the mat").detail,
    ).toBeUndefined();
  });

  it("resposta curta errada → conteudo", () => {
    const grade = gradeAcceptedAnswer("ocean", ["sea"]);
    expect(grade.detail).toEqual({ wrong: 1 });
    expect(objectiveDraft("q", "answer_short", grade).errorTags).toEqual(["conteudo"]);
  });

  it("lst_hiw: palavra errada não marcada → palavra; marcação falsa → armadilha (ordem canônica)", () => {
    const grade = gradeHighlightWrong([0, 5], [0, 1, 2]);
    expect(grade.detail).toEqual({ wordsMissed: 2, falsePositives: 1 });
    expect(objectiveDraft("q", "lst_hiw", grade).errorTags).toEqual(["armadilha", "palavra"]);
  });

  it("reordenar: pares errados → conteudo (proporcional)", () => {
    // [0,2,1,3]: nenhum par adjacente correto de 3 → 3 pares errados.
    const grade = gradeOrdering([0, 2, 1, 3]);
    expect(grade.detail).toEqual({ wrong: 3 });
    expect(objectiveDraft("q", "reorder_paragraphs", grade).errorTags).toEqual(["conteudo"]);
    expect(gradeOrdering([0, 1, 2, 3]).detail).toBeUndefined();
  });
});

describe("errorTagsFromDetail", () => {
  it("detalhe vazio/ausente → nenhuma tag (sem sinal inventado)", () => {
    expect(errorTagsFromDetail(undefined)).toEqual([]);
    expect(errorTagsFromDetail({})).toEqual([]);
  });
});
