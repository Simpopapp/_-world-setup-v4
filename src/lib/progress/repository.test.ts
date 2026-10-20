import { describe, expect, it } from "vitest";
import { createProgressRepository, parseEnvelope } from "./repository";
import type { BackupEnvelope, ImportPreview, QuestionSnapshot } from "./types";
import type { StorageLike } from "./storage-like";
import { KEYS } from "./storage";

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
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

const DAY = 86_400_000;

function envelopeWith(extra: Partial<BackupEnvelope> = {}): string {
  const envelope: BackupEnvelope = {
    version: 1,
    exportedAt: "2026-10-19T10:00:00.000Z",
    appVersion: "pte-hub 0.1.0",
    snapshots: {
      "goarno-wfd-001": {
        qid: "goarno-wfd-001",
        type: "wfd",
        attempts: 3,
        lastResult: "correct",
        lastAt: 1_700_000_000_000,
        best: 1,
        worst: 0,
        confidence: 0.8,
        box: 2,
        dueAt: 1_700_000_000_000 + 5 * DAY,
        lapses: 1,
      },
    },
    aggregates: {
      byType: { wfd: { attempts: 3, correct: 2, partial: 0, incorrect: 1, abstained: 0 } },
      bySection: {},
      byProvenance: {},
      byErrorTag: {},
      sessionsStarted: 4,
      studiedDays: ["2026-10-18", "2026-10-19"],
      updatedAt: 1_700_000_000_000,
    },
    log: [{ qid: "goarno-wfd-001", type: "wfd", at: 1_700_000_000_000, result: "correct" }],
    meta: { targetScore: 79, examDate: "2026-12-01" },
    studie: {
      enabled: true,
      wordTranslation: true,
      phraseTranslation: false,
      pronunciation: false,
      mode: "ia",
    },
    ...extra,
  };
  return JSON.stringify(envelope);
}

describe("repository — snapshots e SRS", () => {
  it("primeira tentativa cria snapshot na caixa 1", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    expect(repo.getSnapshot("q1")).toBeNull();
    const res = repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, now);
    expect(res).toEqual({ ok: true });
    const snap = repo.getSnapshot("q1");
    expect(snap?.attempts).toBe(1);
    expect(snap?.lastResult).toBe("correct");
    expect(snap?.box).toBe(2); // item novo está vencido (dueAt = agora) → promove
  });

  it("acerto fora do prazo não promove (regra do SRS viva no repositório)", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, now);
    // 3 acertos imediatos, sem vencimento: caixa não sobe
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, now + 60_000);
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, now + 120_000);
    const snap = repo.getSnapshot("q1");
    expect(snap?.box).toBe(2);
    expect(snap?.attempts).toBe(3);
  });

  it("lapso rebaixa a caixa e registra pior nota", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    repo.recordAttempt({ qid: "q1", type: "answer_short", result: "correct" }, now);
    repo.recordAttempt(
      { qid: "q1", type: "answer_short", result: "incorrect", score: 0.2 },
      now + DAY,
    );
    const snap = repo.getSnapshot("q1");
    expect(snap?.box).toBe(1);
    expect(snap?.lapses).toBe(1);
    expect(snap?.worst).toBe(0.2);
  });

  it("partial e abstained não mudam a caixa", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" }, now);
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "abstained" }, now + 1000);
    const snap = repo.getSnapshot("q1");
    expect(snap?.box).toBe(2);
    expect(snap?.lastResult).toBe("abstained");
  });
});

describe("repository — agregados independentes do log truncável", () => {
  it("agregados por tipo/seção/proveniência e dias de estudo", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    repo.recordAttempt({ qid: "a", type: "wfd", result: "correct", provenance: "verificada" }, now);
    repo.recordAttempt(
      { qid: "b", type: "wfd", result: "incorrect", provenance: "comunitaria" },
      now + 1,
    );
    repo.recordAttempt(
      { qid: "c", type: "swt", result: "partial", provenance: "corroborada" },
      now + 2,
    );
    const agg = repo.getAggregates();
    expect(agg.byType.wfd).toEqual({
      attempts: 2,
      correct: 1,
      partial: 0,
      incorrect: 1,
      abstained: 0,
    });
    expect(agg.bySection.listening?.attempts).toBe(2);
    expect(agg.bySection.writing?.partial).toBe(1);
    expect(agg.byProvenance.verificada?.correct).toBe(1);
    expect(agg.studiedDays).toHaveLength(1);
  });

  it("log é truncado no teto de 500 e os agregados sobrevivem ao truncamento", () => {
    const repo = createProgressRepository(fakeStorage());
    for (let i = 0; i < 520; i += 1) {
      const res = repo.recordAttempt(
        { qid: `q${i}`, type: "answer_short", result: "correct" },
        1_800_000_000_000 + i,
      );
      if (!res.ok) throw new Error("falhou escrita");
    }
    expect(repo.getLog().length).toBe(500);
    expect(repo.getLog(1)[0]?.qid).toBe("q519"); // guarda as mais recentes
    const agg = repo.getAggregates();
    expect(agg.byType.answer_short?.attempts).toBe(520); // agregado NÃO depende do log
  });
});

describe("repository — meta e Studie Plus", () => {
  it("meta com default seguro e persistência", () => {
    const repo = createProgressRepository(fakeStorage());
    expect(repo.getMeta()).toEqual({});
    expect(repo.setMeta({ targetScore: 65, examDate: "2026-12-01" })).toEqual({ ok: true });
    expect(repo.getMeta().targetScore).toBe(65);
  });

  it("Studie Plus desligado por padrão", () => {
    const repo = createProgressRepository(fakeStorage());
    expect(repo.getStudie()).toEqual({
      enabled: false,
      wordTranslation: false,
      phraseTranslation: false,
      pronunciation: false,
      mode: "ia",
    });
  });
});

describe("repository — backup: exportar, prévia, mesclar, substituir, desfazer", () => {
  it("export contém envelope v1 completo", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" });
    const backup = repo.exportBackup();
    expect(backup.version).toBe(1);
    expect(Object.keys(backup.snapshots)).toContain("q1");
    expect(backup.log.length).toBe(1);
  });

  it("prévia conta novos e atualizados sem aplicar nada", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "goarno-wfd-001", type: "wfd", result: "correct" });
    const preview = repo.previewImport(envelopeWith()) as ImportPreview;
    expect(preview.snapshotCount).toBe(1);
    expect(preview.updatedSnapshots).toBe(1);
    expect(preview.newSnapshots).toBe(0);
    expect(preview.hasMeta).toBe(true);
    // nada foi aplicado ainda
    expect(repo.getLog().length).toBe(1);
  });

  it("import inválido é rejeitado sem tocar no estado", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" });
    expect(parseEnvelope("lixo {")).toEqual({ ok: false, reason: "corrupt" });
    expect(parseEnvelope(JSON.stringify({ version: 5 }))).toEqual({ ok: false, reason: "future" });
    const before = repo.getSnapshot("q1");
    expect(before?.attempts).toBe(1);
  });

  it("mesclar preserva o estado local e soma o backup", () => {
    const repo = createProgressRepository(fakeStorage());
    const now = 1_800_000_000_000;
    repo.recordAttempt({ qid: "local-q", type: "wfd", result: "correct" }, now);
    repo.previewImport(envelopeWith());
    const res = repo.applyImport("mesclar");
    expect(res).toEqual({ ok: true });
    expect(repo.getSnapshot("local-q")?.attempts).toBe(1);
    expect(repo.getSnapshot("goarno-wfd-001")?.attempts).toBe(3);
    expect(repo.getMeta().targetScore).toBe(79); // meta do backup entra por mesclagem
  });

  it("substituir troca o estado pelo backup", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "local-q", type: "wfd", result: "correct" });
    repo.previewImport(envelopeWith());
    repo.applyImport("substituir");
    expect(repo.getSnapshot("local-q")).toBeNull();
    expect(repo.getSnapshot("goarno-wfd-001")?.attempts).toBe(3);
  });

  it("desfazer restaura o estado pré-importação", () => {
    const repo = createProgressRepository(fakeStorage());
    repo.recordAttempt({ qid: "local-q", type: "wfd", result: "correct" });
    repo.previewImport(envelopeWith());
    repo.applyImport("substituir");
    expect(repo.getSnapshot("local-q")).toBeNull();
    expect(repo.undoImport()).toBe(true);
    expect(repo.getSnapshot("local-q")?.attempts).toBe(1);
    expect(repo.getSnapshot("goarno-wfd-001")).toBeNull();
    // sem segunda desfazer
    expect(repo.undoImport()).toBe(false);
  });

  it("sem prévia anterior, aplicar import não faz nada", () => {
    const repo = createProgressRepository(fakeStorage());
    expect(repo.applyImport("mesclar")).toEqual({ ok: false, noPreview: true });
  });
});

describe("repository — resiliência", () => {
  it("dados ilegíveis existentes não impedem o uso (modo seguro)", () => {
    const storage = fakeStorage({ [KEYS.snapshots]: "{corrompido" });
    const repo = createProgressRepository(storage);
    expect(repo.getSnapshot("q1")).toBeNull();
    const results = repo.readResults();
    expect(results.snapshots.ok).toBe(false);
    // a cópia ilegível está preservada na quarentena
    expect(storage.getItem(KEYS.quarantine)).toContain("{corrompido");
  });

  it("falha de quota na tentativa é reportada", () => {
    const storage = fakeStorage();
    const original = storage.setItem;
    let calls = 0;
    storage.setItem = (k, v) => {
      calls += 1;
      if (calls === 1) {
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
      }
      original(k, v);
    };
    const repo = createProgressRepository(storage);
    const res = repo.recordAttempt({ qid: "q1", type: "wfd", result: "correct" });
    expect(res).toEqual({ ok: false, quota: true });
  });

  it("migração preenche campos faltantes e preserva extras", () => {
    const partial = JSON.stringify({
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      snapshots: {},
      campoNovoDeVersaoFutura: { qualquer: "coisa" },
    });
    const parsed = parseEnvelope(partial);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.envelope.aggregates.sessionsStarted).toBe(0);
    expect(parsed.envelope.studie.enabled).toBe(false);
    expect(
      (parsed.envelope as unknown as Record<string, unknown>)["campoNovoDeVersaoFutura"],
    ).toBeDefined();
  });

  it("snapshots de tipo desconhecido não quebram a leitura (quarentena é responsabilidade do chamador da UI)", () => {
    const storage = fakeStorage({
      [KEYS.snapshots]: JSON.stringify({
        v: 1,
        data: {
          x: {
            qid: "x",
            type: "wfd",
            attempts: 1,
            lastResult: "correct",
            lastAt: 0,
            best: null,
            worst: null,
            confidence: null,
            box: 1,
            dueAt: 0,
            lapses: 0,
          },
        },
      }),
    });
    const repo = createProgressRepository(storage);
    const snap: QuestionSnapshot | null = repo.getSnapshot("x");
    expect(snap?.attempts).toBe(1);
  });

  it("resetAll limpa todas as chaves do app, inclusive o undo pendente", () => {
    const storage = fakeStorage({
      [KEYS.snapshots]: JSON.stringify({ v: 1, data: {} }),
      [KEYS.aggregates]: JSON.stringify({ v: 1, data: {} }),
      [KEYS.importUndo]: JSON.stringify({ qualquer: "undo cru" }),
    });
    const repo = createProgressRepository(storage);
    repo.resetAll();
    expect(storage.getItem(KEYS.snapshots)).toBeNull();
    expect(storage.getItem(KEYS.aggregates)).toBeNull();
    expect(storage.getItem(KEYS.importUndo)).toBeNull();
    expect(repo.getSnapshot("q1")).toBeNull();
  });
});
