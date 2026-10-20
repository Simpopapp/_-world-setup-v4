# Status — Stage 08 (Fase 8 — Medição honesta, s9-medicao)

**Data:** 2026-10-20 · **Builder:** agente principal (spawn somente-leitura — PRD decisão 10) · **Status:** concluída

## O que foi entregue
- `src/domain/scoring.ts` (puro): estimativa 10–90 **rotulada** ("estimativa de treino") por habilidade
  com confiança baixa/média/alta por volume de sinal; abstenção NUNCA entra como zero ("sem sinal");
  prontidão = desempenho recente ponderado (meia-vida 28 dias) + tendência (metades do log, só sinais)
  + confiança; base declarada = matriz tarefa×habilidade aproximada, fonte citada
  (`ABILITY_MATRIX_SOURCE`, `confirmedAt: null`).
- `src/domain/scoring.test.ts`: 16 casos — sem sinal → null/baixa, piso 10 / teto 90, parcial = ½,
  abstenção não é zero, confiança por volume, tendência subindo/caindo/null, prontidão 0–100,
  série diária por dia local.
- `/progresso` reescrito: cartões de estimativa por habilidade + prontidão com tendência, todos
  rotulados "estimativa de treino"; gráfico de evolução (recharts, acurácia diária 14 dias; dias sem
  sinal ficam sem linha — nunca zero inventado); lacunas de cobertura (tipos do catálogo sem
  tentativa, contagem do manifesto gerado); relatório exportável JSON + CSV (gerado no navegador,
  sem saída de dados).
- `src/hooks/use-progress.ts`: `useAttemptLog` (log para evolução/relatório).

## Gates (números reais)
- vitest: **124/124** (15 arquivos; inclui os 16 casos novos de scoring)
- tsgo --noEmit: **0 erros**
- lint: **0 erros / 7 avisos** (avisos pré-existentes)
- build: **OK** (nitro/worker)
- Playwright (`:8080/progresso`): estado vazio com export desabilitado → dados semeados →
  estimativas (Listening 71, Reading 56, Speaking 80, Writing 69, Prontidão 75 · tendência: subindo),
  rótulo "estimativa de treino" presente, gráfico renderizado, downloads JSON/CSV reais
  (`relatorio-pte-2026-10-20.json/.csv`) com conteúdo conferido; **0 erros de página/console**.

## Fontes de verdade
- Planejamento/PRD/roadmap centrais: `.opencode/project1.md`, `.opencode/prd-project1.md`, `.opencode/roadmap-proj1` (Fase 8 marcada `[x]` com gates).
- Próxima etapa: **Fase 9 — Simulado (s10-simulado)**.
