// Sessões retomáveis + notas/favoritos + categorias de erro (Fase 7) na camada de progresso.
import { describe, expect, it } from "vitest";
import { createProgressRepository } from "./repository";
import type { QuestionSnapshot } from "./types";
import type { StorageLike } from "./storage-like";

function fakeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe("sessões retomáveis", () => {
  it("cria, atualiza (cursor/answered/status) e relê a sessão — estado sobrevive ao 'reload'", () => {
    const repo = createProgressRepository(fakeStorage());
    const created = repo.createSession({
      title: "Fila do dia · revisões vencidas",
      kind: "fila-do-dia",
      queue: ["q1", "q2", "q3"],
    });
    if (!("id" in created)) throw new Error("criação falhou");

    repo.updateSession(
      created.id,
      { cursor: 1, answered: { q1: { result: "correct", score: 1, at: 5 } } },
      10,
    );
    const resumed = repo.getSession(created.id);
    expect(resumed?.cursor).toBe(1);
    expect(resumed?.answered["q1"]?.result).toBe("correct");

    repo.updateSession(created.id, { cursor: 3, status: "concluida" }, 20);
    expect(repo.getSession(created.id)?.status).toBe("concluida");
  });

  it("lista por updatedAt desc e poda além do teto de 20", () => {
    const repo = createProgressRepository(fakeStorage());
    let lastId = "";
    for (let i = 1; i <= 23; i++) {
      const created = repo.createSession({ title: `S${i}`, kind: "tipo", queue: ["q1"] }, i * 1000);
      if ("id" in created) lastId = created.id;
    }
    const sessions = repo.listSessions();
    expect(sessions).toHaveLength(20);
    expect(sessions[0]!.id).toBe(lastId); // a mais recente sobrevive
    expect(sessions.find((s) => s.title === "S1")).toBeUndefined();
  });

  it("deleteSession remove; getSession de id inexistente é null", () => {
    const repo = createProgressRepository(fakeStorage());
    const created = repo.createSession({ title: "S", kind: "tipo", queue: ["q1"] });
    if (!("id" in created)) throw new Error("criação falhou");
    expect(repo.deleteSession(created.id).ok).toBe(true);
    expect(repo.getSession(created.id)).toBeNull();
    expect(repo.getSession("nope")).toBeNull();
  });
});

describe("notas privadas e favoritos", () => {
  it("set/get preservam nota e favorito independentemente", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.setNote("q1", { favorite: true });
    expect(repo.getNote("q1")).toEqual({ note: "", favorite: true, updatedAt: expect.any(Number) });
    repo.setNote("q1", { note: "regra de ouro: revisar wfd" });
    const note = repo.getNote("q1")!;
    expect(note.note).toBe("regra de ouro: revisar wfd");
    expect(note.favorite).toBe(true);
  });

  it("backup envelope inclui notes; importação em mesclar não apaga notas existentes", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.setNote("q1", { note: "antiga" });
    const backup = repo.exportBackup();
    expect(backup.notes?.["q1"]?.note).toBe("antiga");

    repo.previewImport(
      JSON.stringify({ ...backup, notes: { q2: { note: "nova", favorite: false, updatedAt: 1 } } }),
    );
    expect(repo.applyImport("mesclar").ok).toBe(true);
    expect(repo.getNote("q1")?.note).toBe("antiga");
    expect(repo.getNote("q2")?.note).toBe("nova");
  });

  it("backup antigo SEM notes importa sem quebrar (retrocompatível) e desfazer restaura notas", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.setNote("q1", { note: "antes do import" });
    const backup = repo.exportBackup();
    const legacy = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;
    delete legacy["notes"];
    repo.previewImport(JSON.stringify(legacy));
    expect(repo.applyImport("substituir").ok).toBe(true);
    expect(repo.getNote("q1")).toBeNull(); // substituir sem notes → vazio, nunca corrompe

    expect(repo.undoImport()).toBe(true);
    expect(repo.getNote("q1")?.note).toBe("antes do import"); // desfazer restaura notas
  });
});

describe("categorias de erro (diagnóstico)", () => {
  it("recordAttempt incrementa byErrorTag e guarda as tags no log", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt(
      {
        qid: "q1",
        type: "wfd",
        result: "incorrect",
        errorTags: ["palavra", "palavra", "omissao"],
      },
      1_000,
    );
    const aggregates = repo.getAggregates();
    expect(aggregates.byErrorTag["palavra"]).toBe(2);
    expect(aggregates.byErrorTag["omissao"]).toBe(1);
    const [entry] = repo.getLog(1);
    expect(entry?.errorTags).toEqual(["palavra", "palavra", "omissao"]);
  });

  it("sem tags não cria sinal falso (byErrorTag fica vazio)", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, 1_000);
    expect(repo.getAggregates().byErrorTag).toEqual({});
  });

  it("tags acumulam entre tentativas", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt(
      { qid: "q1", type: "wfd", result: "incorrect", errorTags: ["palavra"] },
      1_000,
    );
    repo.recordAttempt(
      { qid: "q2", type: "lst_hiw", result: "incorrect", errorTags: ["armadilha"] },
      2_000,
    );
    const byErrorTag = repo.getAggregates().byErrorTag;
    expect(byErrorTag["palavra"]).toBe(1);
    expect(byErrorTag["armadilha"]).toBe(1);
  });
});

describe("reset e snapshots existentes", () => {
  it("resetAll apaga também sessões e notas", () => {
    const repo = createProgressRepository(fakeStorage());
    const created = repo.createSession({ title: "S", kind: "tipo", queue: ["q1"] });
    if (!("id" in created)) throw new Error("criação falhou");
    repo.setNote("q1", { note: "x" });
    expect(repo.resetAll().ok).toBe(true);
    expect(repo.getSession(created.id)).toBeNull();
    expect(repo.getNote("q1")).toBeNull();
  });

  it("recordAttempt usa snapshot existente quando o item já foi tentado", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "q1", type: "read_mcq_single", result: "incorrect" }, 1_000);
    repo.recordAttempt({ qid: "q1", type: "read_mcq_single", result: "correct" }, 2_000);
    const snap = repo.getSnapshot("q1")!;
    expect(snap.attempts).toBe(2);
    expect(snap.lastResult).toBe("correct");
  });
});
