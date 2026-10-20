#!/usr/bin/env node
// Gera src/data/manifest.generated.ts a partir de src/data/questions/*.json.
// Fonte única das contagens do app: este script. NUNCA fixar contagens na UI/SEO (PRD D4).
// Uso: node scripts/gen-manifest.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src/data/questions");

// Manter em sincronia com src/domain/task-catalog.ts (o teste de consistência cruza os dois).
const SECTION_BY_TYPE = {
  read_aloud: "speaking",
  repeat_sentence: "speaking",
  describe_image: "speaking",
  retell_lecture: "speaking",
  answer_short: "speaking",
  sgd: "speaking",
  rts: "speaking",
  swt: "writing",
  write_essay: "writing",
  read_fib_dropdown: "reading",
  read_mcq_multi: "reading",
  reorder_paragraphs: "reading",
  read_fib_drag: "reading",
  read_mcq_single: "reading",
  sst: "listening",
  lst_mcq_multi: "listening",
  lst_fib: "listening",
  lst_hcs: "listening",
  lst_mcq_single: "listening",
  lst_smw: "listening",
  lst_hiw: "listening",
  wfd: "listening",
};

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
if (files.length !== 22) {
  console.error(`ERRO: esperado 22 arquivos de questões, achei ${files.length}`);
  process.exit(1);
}

const byType = {};
const bySection = { speaking: 0, writing: 0, reading: 0, listening: 0 };
const byProvenance = { verificada: 0, corroborada: 0, comunitaria: 0 };
let total = 0;
for (const f of files) {
  const type = f.replace(".json", "");
  const list = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  if (!Array.isArray(list)) {
    console.error(`ERRO: ${f} não é um array de questões`);
    process.exit(1);
  }
  byType[type] = list.length;
  const section = SECTION_BY_TYPE[type];
  if (!section) {
    console.error(`ERRO: tipo ${type} sem seção definida em SECTION_BY_TYPE`);
    process.exit(1);
  }
  bySection[section] += list.length;
  for (const q of list) {
    if (q.provenance in byProvenance) byProvenance[q.provenance] += 1;
    total += 1;
  }
}

const imagesDir = join(ROOT, "public/di");
const images = readdirSync(imagesDir).filter((f) => f.endsWith(".png")).length;
const version = createHash("sha256")
  .update(JSON.stringify({ total, byType }))
  .digest("hex")
  .slice(0, 12);
const generatedAt = new Date().toISOString();

const payload = {
  version,
  generatedAt,
  total,
  byType,
  bySection,
  byProvenance,
  images: { describeImage: images },
};
const ts = `// GERADO POR scripts/gen-manifest.mjs — NÃO EDITAR À MÃO.
// Fonte única das contagens do banco (PRD D4). Contagens exibidas derivam SEMPRE daqui.
import type { Provenance, Section, TaskType } from "@/domain/types";

export interface BankManifest {
  version: string;
  generatedAt: string;
  total: number;
  byType: Record<TaskType, number>;
  bySection: Record<Section, number>;
  byProvenance: Record<Provenance, number>;
  images: { describeImage: number };
}

export const bankManifest = ${JSON.stringify(payload, null, 2)} satisfies BankManifest as BankManifest;
`;
writeFileSync(join(ROOT, "src/data/manifest.generated.ts"), ts);
console.log(
  `manifesto gerado: ${total} questões · ${files.length} tipos · ${images} imagens · versão ${version}`,
);
