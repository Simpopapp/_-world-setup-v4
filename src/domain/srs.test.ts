import { describe, expect, it } from "vitest";
import { isReviewDue, newSrsState, onSrsReview, SRS_STEPS } from "@/domain/srs";
import type { TaskType } from "@/domain/types";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("SRS — regras de promoção e rebaixamento", () => {
  it("estado novo é caixa 1 e vencido agora (entra na fila do dia)", () => {
    const s = newSrsState(NOW);
    expect(s.box).toBe(1);
    expect(isReviewDue(s, NOW)).toBe(true);
  });

  it("acerto com revisão VENCIDA promove uma caixa e agenda pelo intervalo do tipo", () => {
    const s = newSrsState(NOW);
    const after = onSrsReview(s, "wfd", "correct", NOW);
    expect(after.box).toBe(2);
    expect(after.dueAt).toBe(NOW + SRS_STEPS.wfd[1]! * DAY);
  });

  it("acerto FORA do prazo NÃO promove e NÃO reagenda (nada de +30 dias com 5 acertos em 5 min)", () => {
    const s: ReturnType<typeof newSrsState> = { box: 3, dueAt: NOW + 10 * DAY, lapses: 0 };
    for (let i = 0; i < 5; i += 1) {
      const after = onSrsReview(s, "answer_short", "correct", NOW + i * 60_000);
      expect(after.box).toBe(3);
      expect(after.dueAt).toBe(NOW + 10 * DAY);
    }
  });

  it("lapso rebaixa UMA caixa (mínimo 1), agenda e conta o lapso", () => {
    const s = { box: 3 as const, dueAt: NOW - DAY, lapses: 0 };
    const after = onSrsReview(s, "swt", "lapse", NOW);
    expect(after.box).toBe(2);
    expect(after.lapses).toBe(1);
    expect(after.dueAt).toBe(NOW + SRS_STEPS.swt[1]! * DAY);
  });

  it("lapso na caixa 1 mantém caixa 1 e reagenda", () => {
    const s = { box: 1 as const, dueAt: NOW - DAY, lapses: 0 };
    const after = onSrsReview(s, "wfd", "lapse", NOW);
    expect(after.box).toBe(1);
    expect(after.lapses).toBe(1);
    expect(after.dueAt).toBe(NOW + SRS_STEPS.wfd[0]! * DAY);
  });

  it("promoção para na caixa 5", () => {
    const s = { box: 5 as const, dueAt: NOW - DAY, lapses: 0 };
    const after = onSrsReview(s, "answer_short", "correct", NOW);
    expect(after.box).toBe(5);
    expect(after.dueAt).toBe(NOW + SRS_STEPS.answer_short[4]! * DAY);
  });

  it("limiar por tipo: wfd avança mais devagar que answer_short", () => {
    const s = { box: 2 as const, dueAt: NOW - DAY, lapses: 0 };
    const wfd = onSrsReview(s, "wfd", "correct", NOW);
    const asq = onSrsReview(s, "answer_short", "correct", NOW);
    expect(wfd.dueAt - NOW).toBeGreaterThan(asq.dueAt - NOW);
  });

  it("todos os 22 tipos têm tabela de intervalos com 5 caixas", () => {
    const types = Object.keys(SRS_STEPS) as TaskType[];
    expect(types).toHaveLength(22);
    for (const t of types) expect(SRS_STEPS[t]).toHaveLength(5);
  });

  it("sequência realista: acertos vencidos sobem caixa a caixa", () => {
    let s = newSrsState(NOW);
    let at = NOW;
    for (let i = 0; i < 4; i += 1) {
      at += 30 * DAY; // revisa bem depois de vencer
      s = onSrsReview(s, "write_essay", "correct", at);
    }
    expect(s.box).toBe(5);
    expect(s.lapses).toBe(0);
  });
});
