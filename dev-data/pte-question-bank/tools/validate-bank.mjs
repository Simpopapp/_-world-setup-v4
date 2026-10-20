#!/usr/bin/env node
// Validador do banco de questões — Node 18+, sem dependências.
// Uso (na raiz do pacote):  node tools/validate-bank.mjs
// Sai com código 1 se houver ERRO. AVISO = fora da faixa de plausibilidade (revisão humana, não descarte).
import { readFileSync, readdirSync, existsSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const errors = [],
  warnings = [];
const err = (m) => errors.push(m),
  warn = (m) => warnings.push(m);

const manifest = J("MANIFEST.json");
const sources = J("sources/sources.json").fontes;
const srcById = new Map(sources.map((s) => [s.id, s]));
const corro = new Map(J("evidence/corroboration.json").itens.map((e) => [e.item, e]));
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const norm = (s) =>
  String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const inRange = (n, lo, hi) => n >= lo && n <= hi;

// faixas de plausibilidade por tipo (palavras)
const RANGES = {
  read_aloud: [25, 120],
  repeat_sentence: [4, 25],
  wfd: [3, 20],
  swt: [150, 350],
  write_essay: [15, 120],
  sst: [150, 330],
  retell_lecture: [80, 260],
};
const keyOf = {
  wfd: (d) => d.sentence,
  repeat_sentence: (d) => d.transcript,
  read_aloud: (d) => d.text,
  retell_lecture: (d) => d.transcript,
  sst: (d) => d.transcript,
  answer_short: (d) => d.question,
  sgd: (d) => d.turns.map((t) => t.text).join(" "),
  rts: (d) => d.scenario,
  swt: (d) => d.text,
  write_essay: (d) => d.prompt,
  read_fib_dropdown: (d) => d.passage,
  read_fib_drag: (d) => d.passage,
  read_mcq_single: (d) => d.passage + " " + d.question,
  read_mcq_multi: (d) => d.passage + " " + d.question,
  reorder_paragraphs: (d) => d.paragraphs.join(" "),
  lst_mcq_single: (d) => d.transcript,
  lst_mcq_multi: (d) => d.transcript,
  lst_fib: (d) => d.template,
  lst_hcs: (d) => d.transcript,
  lst_smw: (d) => d.transcript,
  lst_hiw: (d) => d.spoken,
  describe_image: (d, q) => (q.topic ?? "") + " " + d.image,
};
const textField = {
  read_aloud: "text",
  repeat_sentence: "transcript",
  wfd: "sentence",
  swt: "text",
  write_essay: "prompt",
  sst: "transcript",
  retell_lecture: "transcript",
};

const jaccard = (a, b) => {
  const A = new Set(a.split(" ")),
    B = new Set(b.split(" "));
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};

let total = 0;
const ids = new Set();
const files = readdirSync(join(ROOT, "questions"))
  .filter((f) => f.endsWith(".json"))
  .sort();
if (files.length !== 22) err(`esperado 22 arquivos em questions/, achei ${files.length}`);

for (const f of files) {
  const type = f.replace(".json", "");
  const list = J(`questions/${f}`);
  total += list.length;
  if (manifest.contagemPorTipo[type] !== list.length)
    err(`${type}: manifesto diz ${manifest.contagemPorTipo[type]}, arquivo tem ${list.length}`);
  const keys = [];
  for (const q of list) {
    const d = q.data;
    const at = `${q.id}`;
    if (ids.has(q.id)) err(`id duplicado: ${q.id}`);
    ids.add(q.id);
    if (q.type !== type) err(`${at}: type ${q.type} ≠ arquivo ${type}`);
    if (!["verificada", "corroborada", "comunitaria"].includes(q.provenance))
      err(`${at}: proveniência inválida`);
    const s = srcById.get(q.source?.id);
    if (!s) err(`${at}: source.id ${q.source?.id} ausente em sources/sources.json`);
    else if (!String(s.status).startsWith("aprovada")) err(`${at}: fonte ${s.id} não aprovada`);
    if (q.provenance === "corroborada") {
      const c = corro.get(q.id);
      if (!c || c.qtdIndependentes < 1 || !c.independentes)
        err(`${at}: 'corroborada' sem entrada de corroboração independente`);
    }
    // faixas
    if (RANGES[type]) {
      const w = words(d[textField[type]]);
      const [lo, hi] = RANGES[type];
      if (!inRange(w, lo, hi)) warn(`${at}: ${w} palavras fora de ${lo}–${hi}`);
    }
    // estrutura por tipo
    switch (type) {
      case "read_mcq_single":
      case "lst_mcq_single":
        if (!inRange(d.options.length, 3, 5)) err(`${at}: nº de opções`);
        if (!Number.isInteger(d.answer) || d.answer < 0 || d.answer >= d.options.length)
          err(`${at}: answer fora das opções`);
        break;
      case "read_mcq_multi":
      case "lst_mcq_multi":
        if (!inRange(d.options.length, 3, 7)) err(`${at}: nº de opções`);
        if (
          !Array.isArray(d.answer) ||
          d.answer.length < 2 ||
          d.answer.some((i) => i < 0 || i >= d.options.length)
        )
          err(`${at}: answer inválido`);
        break;
      case "lst_hcs":
      case "lst_smw":
        if (!inRange(d.options.length, 3, 4)) err(`${at}: nº de opções`);
        if (!(d.answer >= 0 && d.answer < d.options.length)) err(`${at}: answer fora das opções`);
        break;
      case "read_fib_dropdown": {
        const m = (d.passage.match(/\{\{\d+\}\}/g) || []).length;
        if (m !== d.blanks.length) err(`${at}: marcadores ${m} ≠ lacunas ${d.blanks.length}`);
        d.blanks.forEach((b, i) => {
          if (b.options.length < 3) err(`${at}: lacuna ${i + 1} com < 3 opções`);
          if (!(b.answer >= 0 && b.answer < b.options.length))
            err(`${at}: lacuna ${i + 1} answer fora`);
        });
        break;
      }
      case "read_fib_drag": {
        const m = (d.passage.match(/\{\{\d+\}\}/g) || []).length;
        if (m !== d.answers.length) err(`${at}: marcadores ${m} ≠ respostas ${d.answers.length}`);
        if (d.answers.some((i) => i < 0 || i >= d.bank.length))
          err(`${at}: resposta fora do banco de palavras`);
        break;
      }
      case "lst_fib": {
        const m = (d.template.match(/\{\{\d+\}\}/g) || []).length;
        if (m !== d.answers.length) err(`${at}: marcadores ${m} ≠ respostas ${d.answers.length}`);
        if (d.answers.some((a) => words(a) !== 1)) warn(`${at}: lacuna com mais de 1 palavra`);
        break;
      }
      case "reorder_paragraphs":
        if (!inRange(d.paragraphs.length, 4, 6))
          warn(`${at}: ${d.paragraphs.length} parágrafos (faixa 4–6)`);
        break;
      case "answer_short":
        if (!Array.isArray(d.answers) || !d.answers.length) err(`${at}: answers vazio`);
        break;
      case "sgd":
        if (new Set(d.turns.map((t) => t.speaker).filter((x) => !/narrator/i.test(x))).size < 2)
          err(`${at}: menos de 2 falantes`);
        break;
      case "lst_hiw": {
        const a = norm(d.spoken).split(" "),
          b = norm(d.shown).split(" ");
        if (a.join(" ") === b.join(" ")) err(`${at}: spoken = shown (nenhuma palavra errada)`);
        break;
      }
      case "describe_image":
        if (!existsSync(join(ROOT, "images/describe_image", d.image.split("/").pop())))
          err(`${at}: imagem ausente ${d.image}`);
        if (!d.alt) err(`${at}: alt vazio`);
        if (!q.source?.license) err(`${at}: licença ausente`);
        break;
    }
    if (type === "read_mcq_single" || type === "read_mcq_multi")
      if (!inRange(words(d.passage), 40, 400))
        warn(`${at}: passagem ${words(d.passage)} palavras (faixa 40–400)`);
    keys.push([q.id, norm(keyOf[type](d, q))]);
  }
  // quase-duplicatas dentro do tipo (Jaccard de tokens >= 0,85)
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      if (keys[i][1] === keys[j][1] || jaccard(keys[i][1], keys[j][1]) >= 0.85)
        err(`quase-duplicata em ${type}: ${keys[i][0]} ~ ${keys[j][0]}`);
    }
}
if (total !== manifest.totalQuestoes) err(`total ${total} ≠ manifesto ${manifest.totalQuestoes}`);
// imagens órfãs
for (const f of readdirSync(join(ROOT, "images/describe_image"))) {
  if (!ids.size) break;
}
// checksums
const lines = readFileSync(join(ROOT, "CHECKSUMS.sha256"), "utf8").trim().split("\n");
let bad = 0;
for (const l of lines) {
  const [h, p] = [l.slice(0, 64), l.slice(66)];
  const sum = createHash("sha256")
    .update(readFileSync(join(ROOT, p)))
    .digest("hex");
  if (sum !== h) {
    bad++;
    err(`checksum divergente: ${p}`);
  }
}
console.log(
  `Itens: ${total} · arquivos: ${files.length} · fontes: ${sources.length} · checksums: ${lines.length - bad}/${lines.length}`,
);
console.log(`AVISOS (${warnings.length}):`);
warnings.slice(0, 40).forEach((w) => console.log("  - " + w));
if (warnings.length > 40) console.log(`  … +${warnings.length - 40}`);
console.log(`ERROS (${errors.length}):`);
errors.forEach((e) => console.log("  ✗ " + e));
if (errors.length) process.exit(1);
console.log("OK — banco íntegro.");
