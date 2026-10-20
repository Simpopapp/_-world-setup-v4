import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { TASK_CATALOG, SECTION_LABELS } from "@/domain/task-catalog";
import { ABILITY_MATRIX, ABILITY_MATRIX_SOURCE } from "@/domain/ability-matrix";
import type { Section, TaskType } from "@/domain/types";

const ALL_SECTIONS: Section[] = ["speaking", "writing", "reading", "listening"];

describe("task-catalog", () => {
  it("cobre exatamente os 22 tipos com ids únicos", () => {
    expect(TASK_CATALOG).toHaveLength(22);
    const ids = TASK_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(22);
  });

  it("tem exatamente um arquivo de questões por tipo do catálogo", () => {
    const files = readdirSync(join(process.cwd(), "src/data/questions"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort();
    expect(files).toEqual(TASK_CATALOG.map((t) => t.id).sort());
  });

  it("toda entrada tem rótulo e resumo e seção válida", () => {
    for (const def of TASK_CATALOG) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.summary.length).toBeGreaterThan(0);
      expect(ALL_SECTIONS).toContain(def.section);
    }
  });

  it("nenhum timing está marcado como confirmado sem conferência oficial (Fase 9)", () => {
    for (const def of TASK_CATALOG) {
      expect(def.timing.confirmed, def.id).toBe(false);
      expect(def.orderConfirmed, def.id).toBe(false);
    }
  });
});

describe("ability-matrix", () => {
  it("cobre todos os 22 tipos", () => {
    const ids = TASK_CATALOG.map((t) => t.id);
    expect(Object.keys(ABILITY_MATRIX).sort()).toEqual([...ids].sort());
  });

  it("toda contribuição tem ao menos uma habilidade", () => {
    for (const [type, contrib] of Object.entries(ABILITY_MATRIX)) {
      expect(contrib.abilities.length, type).toBeGreaterThan(0);
    }
  });

  it("answer_short está registrada como speaking+listening, aproximada, até a conferência oficial", () => {
    const entry = ABILITY_MATRIX["answer_short" satisfies TaskType];
    expect(entry.abilities).toContain("speaking");
    expect(entry.abilities).toContain("listening");
    expect(entry.approximate).toBe(true);
    expect(ABILITY_MATRIX_SOURCE.confirmedAt).toBeNull();
  });
});

describe("SECTION_LABELS", () => {
  it("rotula as 4 seções", () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...ALL_SECTIONS].sort());
  });
});
