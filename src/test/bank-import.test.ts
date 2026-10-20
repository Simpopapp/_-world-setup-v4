import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { bankManifest } from "@/data/manifest.generated";
import { loadQuestions, loadAliases, canonicalIdOf } from "@/lib/bank/loader";
import { catalogEntries, countForSection } from "@/lib/bank/manifest";
import type { TaskType } from "@/domain/types";

const ALL_TYPES = Object.keys(bankManifest.byType) as TaskType[];

describe("banco importado", () => {
  it("total do manifesto é 2823", () => {
    expect(bankManifest.total).toBe(2823);
  });

  it("somas internas do manifesto fecham", () => {
    expect(Object.values(bankManifest.byType).reduce((a, b) => a + b, 0)).toBe(bankManifest.total);
    expect(Object.values(bankManifest.bySection).reduce((a, b) => a + b, 0)).toBe(
      bankManifest.total,
    );
    expect(Object.values(bankManifest.byProvenance).reduce((a, b) => a + b, 0)).toBe(
      bankManifest.total,
    );
  });

  it("cada tipo carregado tem exatamente a contagem do manifesto", async () => {
    expect(ALL_TYPES).toHaveLength(22);
    for (const type of ALL_TYPES) {
      const list = await loadQuestions(type);
      expect(list.length, type).toBe(bankManifest.byType[type]);
      for (const q of list) expect(q.type, `${type}/${q.id}`).toBe(type);
    }
  });

  it("imagens do Describe Image existem em public/di e estão referenciadas", async () => {
    expect(bankManifest.images.describeImage).toBe(20);
    const di = readdirSync(join(process.cwd(), "public/di")).filter((f) => f.endsWith(".png"));
    expect(di.length).toBe(20);
    const items = await loadQuestions("describe_image");
    for (const q of items) {
      if (!("image" in q.data)) throw new Error(`${q.id}: describe_image sem imagem`);
      const file = q.data.image.split("/").pop();
      if (!file) throw new Error(`${q.id}: caminho de imagem inválido`);
      expect(existsSync(join(process.cwd(), "public/di", file)), q.data.image).toBe(true);
    }
  });

  it("catálogo derivado reflete o manifesto (nenhum número fixo na UI)", () => {
    const entries = catalogEntries();
    expect(entries).toHaveLength(22);
    for (const entry of entries) {
      expect(entry.count).toBe(bankManifest.byType[entry.def.id]);
      expect(entry.available).toBe(entry.count > 0);
    }
    expect(countForSection("listening")).toBe(912);
    expect(countForSection("speaking")).toBe(1538);
    expect(countForSection("writing")).toBe(132);
    expect(countForSection("reading")).toBe(241);
  });
});

describe("aliases e canonicalId", () => {
  it("aliases carrega um mapa válido (vazio hoje, pronto para colisões)", async () => {
    const aliases = await loadAliases();
    expect(typeof aliases).toBe("object");
    expect(Object.keys(aliases).length).toBe(0);
  });

  it("canonicalIdOf resolve alias sintético para o id canônico", async () => {
    // com o aliases vazio, o id volta intacto
    expect(await canonicalIdOf("goarno-wfd-001")).toBe("goarno-wfd-001");
  });
});

describe("payload enxuto por tipo (amostra estrutural)", () => {
  it("wfd guarda só a frase", async () => {
    const [first] = await loadQuestions("wfd");
    if (!first || !("sentence" in first.data)) throw new Error("wfd sem frase");
    expect(first.data.sentence.length).toBeGreaterThan(0);
    expect(Object.keys(first.data)).toEqual(["sentence"]);
  });

  it("read_fib_drag tem banco de palavras e respostas dentro dele", async () => {
    const items = await loadQuestions("read_fib_drag");
    const first = items[0];
    if (!first) throw new Error("read_fib_drag vazio");
    if (!("bank" in first.data) || !("answers" in first.data)) {
      throw new Error("read_fib_drag sem banco de palavras");
    }
    const d = first.data;
    expect(d.bank.length).toBeGreaterThan(0);
    expect(d.answers.every((a) => a >= 0 && a < d.bank.length)).toBe(true);
  });
});

describe("prevenção contra números envelhecidos", () => {
  it("nenhum literal de contagem aparece em código de UI/SEO", () => {
    // Literais distintivos: total e contagens grandes. (50/20/25/31 são ambíguos e não são escaneados.)
    const banned = ["2823", "682", "551", "378", "340"];
    const srcDir = join(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) {
          walk(p);
        } else if (/\.(ts|tsx)$/.test(f.name)) {
          const rel = p.replaceAll("\\", "/");
          if (rel.includes("manifest.generated") || /test/.test(f.name)) continue;
          const text = readFileSync(p, "utf8");
          for (const literal of banned) {
            if (new RegExp(`(?<![\\w."'])${literal}(?![\\w"'])`).test(text)) {
              offenders.push(`${rel}: ${literal}`);
            }
          }
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
