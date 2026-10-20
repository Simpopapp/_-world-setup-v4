// Fila do dia real (Fase 7): somente itens vencidos entram, na ordem do vencimento mais antigo.
import { describe, expect, it } from "vitest";
import { buildDueQueue } from "./queue";
import type { QuestionSnapshot } from "./types";

const DAY = 86_400_000;

function snap(qid: string, type: QuestionSnapshot["type"], dueAt: number): QuestionSnapshot {
  return {
    qid,
    type,
    attempts: 1,
    lastResult: "correct",
    lastAt: dueAt - DAY,
    best: 1,
    worst: 1,
    confidence: 1,
    box: 2,
    dueAt,
    lapses: 0,
  };
}

describe("buildDueQueue", () => {
  it("inclui somente itens com dueAt vencido (SRS correto: acerto fora do prazo não agenda)", () => {
    const now = 1_000 * DAY;
    const snapshots = {
      "a-due": snap("a-due", "wfd", now - DAY),
      "b-future": snap("b-future", "wfd", now + DAY),
      "c-exact": snap("c-exact", "answer_short", now),
    };
    expect(buildDueQueue(snapshots, now)).toEqual(["a-due", "c-exact"]);
  });

  it("ordena pelo vencimento mais antigo primeiro", () => {
    const now = 1_000 * DAY;
    const snapshots = {
      recent: snap("recent", "wfd", now - 1 * DAY),
      older: snap("older", "swt", now - 10 * DAY),
      oldest: snap("oldest", "sst", now - 40 * DAY),
    };
    expect(buildDueQueue(snapshots, now)).toEqual(["oldest", "older", "recent"]);
  });

  it("respeita o teto (limit) mantendo os mais antigos", () => {
    const now = 1_000 * DAY;
    const snapshots: Record<string, QuestionSnapshot> = {};
    for (let i = 0; i < 40; i++)
      snapshots[`q-${String(i).padStart(2, "0")}`] = snap(
        `q-${String(i).padStart(2, "0")}`,
        "wfd",
        now - (40 - i) * DAY,
      );
    const queue = buildDueQueue(snapshots, now, { limit: 30 });
    expect(queue).toHaveLength(30);
    expect(queue[0]).toBe("q-00");
    expect(queue[29]).toBe("q-29");
    expect(queue).not.toContain("q-30");
  });

  it("retorna fila vazia para snapshots vazios ou nada vencido", () => {
    expect(buildDueQueue({}, 1_000 * DAY)).toEqual([]);
    const now = 1_000 * DAY;
    expect(buildDueQueue({ future: snap("future", "wfd", now + DAY) }, now)).toEqual([]);
  });
});
