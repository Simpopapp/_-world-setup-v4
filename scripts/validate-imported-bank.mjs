#!/usr/bin/env node
// Valida o banco IMPORTADO (src/data/questions/*.json) contra a referência em
// dev-data/pte-question-bank/MANIFEST.json. Uso: node scripts/validate-imported-bank.mjs
// Para a validação completa do pacote original (checksums, quase-duplicatas, fontes), rode
// node dev-data/pte-question-bank/tools/validate-bank.mjs — deve imprimir "OK — banco íntegro."
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src/data/questions");
const manifest = JSON.parse(
  readFileSync(join(ROOT, "dev-data/pte-question-bank/MANIFEST.json"), "utf8"),
);

const errors = [];
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
if (files.length !== 22)
  errors.push(`esperado 22 arquivos em src/data/questions, achei ${files.length}`);

const seen = new Set();
let total = 0;
for (const f of files) {
  const type = f.replace(".json", "");
  const list = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  if (!Array.isArray(list)) {
    errors.push(`${f}: não é array`);
    continue;
  }
  if (manifest.contagemPorTipo[type] !== list.length) {
    errors.push(
      `${type}: manifesto diz ${manifest.contagemPorTipo[type]}, arquivo tem ${list.length}`,
    );
  }
  for (const q of list) {
    total += 1;
    if (seen.has(q.id)) errors.push(`id duplicado: ${q.id}`);
    seen.add(q.id);
    if (q.type !== type) errors.push(`${q.id}: type ${q.type} ≠ arquivo ${type}`);
    if (!["verificada", "corroborada", "comunitaria"].includes(q.provenance)) {
      errors.push(`${q.id}: proveniência inválida`);
    }
    if (!q.source?.id) errors.push(`${q.id}: source.id ausente`);
    if (!q.data || typeof q.data !== "object") errors.push(`${q.id}: data ausente`);
  }
}
if (total !== manifest.totalQuestoes)
  errors.push(`total ${total} ≠ manifesto ${manifest.totalQuestoes}`);

const aliases = JSON.parse(readFileSync(join(ROOT, "src/data/aliases.json"), "utf8"));
if (typeof aliases !== "object" || Array.isArray(aliases) || aliases === null) {
  errors.push("aliases.json não é um objeto { id descartado: id canônico }");
}

console.log(
  `Itens: ${total} · arquivos: ${files.length} · aliases: ${Object.keys(aliases).length}`,
);
if (errors.length) {
  console.log(`ERROS (${errors.length}):`);
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
}
console.log("OK — banco importado íntegro.");
