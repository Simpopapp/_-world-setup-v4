import { describe, expect, it } from "vitest";
import { TASK_CATALOG } from "@/domain/task-catalog";
import { ENGINE_BY_TYPE } from "./registry";

describe("registro de motores de prática (Fase 6)", () => {
  it("cobre exatamente os 22 tipos do catálogo", () => {
    expect(TASK_CATALOG).toHaveLength(22);
    expect(Object.keys(ENGINE_BY_TYPE).sort()).toEqual(TASK_CATALOG.map((t) => t.id).sort());
  });
});
