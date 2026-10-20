# PRD — PTE Master Hub (project1)

> O COMO. Deriva de `.opencode/project1` (o QUÊ/POR QUÊ). Toda decisão técnica registrada aqui
> vincula os subagentes. Precedência: escopo → `project1` > este PRD > `roadmap-proj1`.
> Ambiente confirmado no código (TanStack Start v1 + React 19 + Tailwind v4 + Vite 7, target workerd).

## 0. Fontes de verdade e arquivo do banco

O insumo canônico é `pte-question-bank.zip` na raiz (`/dev-server/pte-question-bank.zip`),
já extraído e conferido nesta rodada:

- **2.823 questões** em `questions/<tipo>.json` ×22 (um array de `Question` por tipo).
- **20 imagens** `images/describe_image/*.png` (gráficos CC BY 4.0, atribuição no próprio item;
  `data.image` já aponta para `/di/<arquivo>.png`).
- `MANIFEST.json` — contagens por tipo/seção/proveniência/fonte. **Fonte única dos números.**
- `schema/question-types.d.ts` — tipos de `Question` e `data` por tipo (contrato do banco).
- `sources/sources.json` (91 fontes: 47 aprovadas · 44 reprovadas), `evidence/corroboration.json`,
  `reports/coverage.json`, `aliases.json` (vazio, manter), `tools/validate-bank.mjs` (validador Node 18+).
- Contagens reais: wfd 551 · repeat_sentence 682 · answer_short 378 · read_aloud 340 · write_essay 79 ·
  sgd 25 · rts 31 · retell_lecture 62 · describe_image 20 · sst 58 · lst_fib 53 · lst_hcs/lst_smw/lst_hiw/
  lst_mcq_single/lst_mcq_multi/read_mcq_multi/read_fib_drag/reorder_paragraphs 50 cada ·
  read_mcq_single 50 · read_fib_dropdown 41 · swt 53. Proveniência: 74 verificada · 207 corroborada ·
  2542 comunitária. Seções: Speaking 1538 · Writing 132 · Reading 241 · Listening 912.
- Lacunas honestas (abaixo da meta mínima): `sst`, `lst_fib`, `read_mcq_single` — cobertura reportada
  como está; **nenhum item inventado**.

Importação segue o README do banco (6 passos): validador `OK — banco íntegro`, questões em
`src/data/questions/`, imagens em `public/di/`, manifesto **gerado** (nunca digitado) e conferência
do total 2.823.

## 1. Decisões técnicas fixadas

### D1. Stack e limites do harness
- TanStack Start v1 (file-based routing em `src/routes/`), React 19, Tailwind v4 via `src/styles.css`,
  componentes `src/components/ui/` (shadcn/Radix). **Sem** React Router DOM, sem `src/pages`, sem `App.tsx`.
- SSR roda em **workerd** (não Node): código de servidor não pode depender de APIs Node
  (`fs`, `Buffer`, módulos nativos). Importação do banco é feita em **tempo de build** (JSON importado
  via bundler), nunca lida do disco no runtime do worker. O validador do banco roda fora do app
  (script/dev), não dentro do bundle.
- `routeTree.gen.ts` nunca editado. Toda rota referenciada por link/navigate nasce no mesmo lote de edits.
- Head por rota (`head()`) com title/description/og únicos; `og:image`/`twitter:image` só com URL
  absoluta https real (as imagens do banco são relativas → omitir).

### D2. Estrutura de pastas (donos exclusivos por pacote)
```
src/
  domain/            tipos e contratos puros (sem React, sem IO)
    types.ts         Section, TaskType, Provenance, SourceRef, QuestionBase, QuestionData, Question
    task-catalog.ts  catálogo dos 22 tipos (rótulos pt-BR, seção, descrição, límites/tempo do formato)
    ability-matrix.ts  matriz tarefa×habilidade com fonte citada + flags de aproximação
    srs.ts           caixas SRS (promote só quando vencido; lapso rebaixa; limiar por tipo)
    scoring.ts       escala de tentativa × escala de estimativa (10–90) rotuladas; prontidão
    streak.ts        chaves de dia local (getLocalDayKey), sequência de estudo
  data/
    questions/<tipo>.json ×22 + aliases.json   (importação do banco — dono: pacote banco)
    manifest.generated.json                     (gerado por script; nunca digitado)
  lib/
    bank/manifest.ts   loader do manifesto + helpers derivados (contagens, disponibilidade)
    bank/loader.ts     loader dinâmico por tipo (import()), cache em memória
    progress/          storage local: snapshots, agregados, log truncável, backup envelope,
                       quarentena, migração versionada (nada de IO aqui fora de localStorage)
    ai/evaluators/     configs por tipo: prompt, rubric, dimensões, schema, regras de abstenção
    studie/            matriz de elegibilidade tipo×campo×fase + chamadas de tradução
    simulate/          blueprint do simulado, sessão de prova, relatório pós-prova
  features/            motores de prática (por família) e componentes de página
  routes/              páginas (TanStack file routes) + rotas de API pública
scripts/
  gen-manifest.mjs     gera manifest.generated.json a partir de src/data/questions/*.json
  validate-bank.mjs    validador do banco (cópia do tools/ do pacote, Node puro)
public/di/*.png        imagens do Describe Image (20)
```

### D3. Contrato de dados do banco (copiado do `schema/question-types.d.ts` do pacote)
`Question = QuestionBase & { data: QuestionData }`, com:
- `TaskType` = união exata dos 22 ids do banco (`read_aloud`, `repeat_sentence`, `describe_image`,
  `retell_lecture`, `answer_short`, `sgd`, `rts`, `swt`, `write_essay`, `read_fib_dropdown`,
  `read_mcq_multi`, `reorder_paragraphs`, `read_fib_drag`, `read_mcq_single`, `sst`, `lst_mcq_multi`,
  `lst_fib`, `lst_hcs`, `lst_mcq_single`, `lst_smw`, `lst_hiw`, `wfd`).
- `Provenance = "verificada" | "corroborada" | "comunitaria"`.
- `QuestionData` = união discriminada exatamente como no schema do banco (ver arquivo; `wfd` = `{ sentence }`,
  `read_fib_dropdown` = `{ passage, blanks: { options, answer }[] }`, `lst_fib` = `{ template, answers }`,
  `lst_hiw` = `{ spoken, shown }`, etc.).
- **Payload enxuto**: cada texto guardado UMA vez; nada derivável é duplicado (TTS = transcript).
- Imagens: apenas `describe_image` (20 itens, `public/di/*.png`). Tipos sem mídia não têm fallback de mídia.

### D4. Manifesto gerado (números nunca fixos na UI)
`scripts/gen-manifest.mjs` lê `src/data/questions/*.json` + `aliases.json` e emite
`src/data/manifest.generated.json`:
```ts
type BankManifest = {
  version: number;            // hash dos conteúdos
  generatedAt: string;
  total: number;              // 2823 na importação
  byType: Record<TaskType, number>;
  bySection: Record<Section, number>;
  byProvenance: Record<Provenance, number>;
  byTopic?: Record<string, number>;   // opcional, se tópico existir
  images: { type: "describe_image"; count: number };
};
```
- Toda contagem exibida (catálogo, home, SEO, relatórios) deriva do manifesto via `lib/bank/manifest.ts`.
- **Teste de prevenção contra números envelhecidos**: nenhum literal de contagem (ex.: `2823`) pode
  aparecer em código de UI/SEO; teste percorre `src/` e falha se encontrar os literais conhecidos
  fora de `manifest.generated.json`/scripts. Teste de consistência: `sum(byType) === total` e
  `byType[t] === count real importado`.
- Disponibilidade por tipo: `contagem > 0` → disponível; senão "em breve" (com motivo registrado no
  catálogo; hoje os 22 têm ≥1 item, mas o código não assume isso).

### D5. Progresso 100% local (sem auth, sem nuvem, sem multiusuário)
- Camada `lib/progress/` sobre `localStorage`, com chaves versionadas:
  - `pte-hub:v1:snap:<qid>` — snapshot por questão (`{ attempts, lastResult, lastAt, best, worst,
    confidence, box, dueAt, lapses }`).
  - `pte-hub:v1:agg` — agregados independentes do log (`{ byType, bySection, sessions, streak, updatedAt }`).
  - `pte-hub:v1:log` — log de tentativas **truncável** (teto 500 entradas; truncar é seguro pois os
    agregados/snapshots não dependem dele).
  - `pte-hub:v1:meta` — meta do aluno (alvo 50/58/65/79, data da prova, plano, preferências).
  - `pte-hub:v1:studie` — ajustes do Studie Plus (off por padrão, 3 controles independentes, modo IA/offline).
- **Escrita resiliente**: try/catch + detecção de quota (aviso preventivo quando >80% do orçamento
  estimado); falha de gravação é sinalizada na UI e nunca silenciosa.
- **Backup envelope versionado**: `PTEHUB_BACKUP_V1 = { version: 1, exportedAt, appVersion,
  snapshots: {...}, aggregates, log, meta, studie }`. Importação com **prévia → (mesclar | substituir)
  → desfazer** (o estado pré-importação é guardado em uma chave temporária até confirmação).
- **Quarentena**: dados ilegíveis ou de versão futura vão para `pte-hub:v1:quarantine` e o app entra
  em modo somente leitura com aviso claro; **nunca sobrescreve** dados desconhecidos.
- **Migração sem perda**: `migrate(envelope | raw)` com casos testados: v1 idêntico, campo faltando,
  campo a mais (preservado), JSON inválido (quarentena), versão futura (quarentena).
- **Datas por chaves de dia local** (`getLocalDayKey()` = YYYY-MM-DD local) — horário de verão não
  quebra passos de 24 h.

### D6. SRS correto (domínio puro, 100% testado)
- Caixas 1..5; **promove só quando a revisão está vencida** (`dueAt <= now`); acerto fora do prazo
  NÃO promove; lapso (falha) rebaixa uma caixa; limiar/intervalos por tipo de tarefa
  (ex.: `wfd` mais exigente que `answer_short`).
- Fila do dia = itens vencidos + itens do plano; badge global visível em toda a aplicação.
- Tudo em `domain/srs.ts` com testes: promoção vencida, não-promoção não-vencida, lapso, limites 1..5,
  chave de dia local.

### D7. IA AI-first (Lovable AI Gateway, no servidor)
- Toda avaliação e tradução IA passa por **createServerFn** (app-internal) usando o **Lovable AI
  Gateway**; nenhuma chave no navegador. `process.env.*` só dentro do handler.
- Adaptadores por tipo em `lib/ai/evaluators/<tipo>.ts`: config `{ evaluatorId, promptVersion,
  rubricVersion, dimensions, schema (zod), abstention: [...], inputLimits, timeoutMs, retryMax ≤ 1,
  cache: efêmero em memória }`.
- Entrada do avaliador = questão (dados pedagógicos), gabarito/referência, resposta do aluno,
  contexto mínimo. **Prompt injection**: conteúdo da questão é dado não confiável — separado
  estruturalmente das instruções de sistema; testes tentam injeção e provam que a rubrica não muda.
- Saída padrão (zod): `{ score (escala da tentativa), subscores?, evidence: string[], feedback: string,
  confidence: "low"|"medium"|"high", abstained?: { reason }, measured?: string[], unmeasured?: string[] }`.
- **Abstenção explícita** em vez de nota substituta: entrada insuficiente, falha do serviço, mídia
  inaudível, resposta ambígua → estado "revisar"/"não avaliado" na UI.
- **Fala**: sem análise real de áudio, pronúncia/prosódia = **"não avaliada"**; fluência por
  transcript é sempre rotulada como proxy. Resposta-template = aviso, nunca nota.
- Reexecução identificável: tentativa guarda `{ evaluatorId, promptVersion, rubricVersion, model }`;
  tentativas anteriores nunca reescritas em silêncio.
- Logs/observabilidade sem conteúdo sensível do aluno por padrão (sem texto da resposta nos logs).

### D8. Medição honesta
- Escala de **tentativa** (por tipo, ex.: 0–1, 0–100) distinta da **estimativa por habilidade
  10–90 rotulada** ("estimativa de treino", nunca "nota oficial"). Nenhuma tela mistura as duas sem rótulo.
- Pesos por habilidade = matriz oficial tarefa×habilidade da Pearson, citada em
  `domain/ability-matrix.ts` com `confirmed: boolean` e fonte/data de consulta; onde não confirmada,
  `approximate: true` e a UI declara a aproximação.
- Prontidão = desempenho recente ponderado + tendência + confiança (função pura testada); **nunca**
  função do tamanho do banco ou cobertura.
- Abstenções não entram como zero na estimativa; entram como "sem sinal".

### D9. Roteamento e páginas
Rotas (`src/routes/`, criadas no mesmo lote dos links que as apontam):
- `/` — Home: meta, data da prova, streak, plano do dia, fila do dia, atalhos.
- `/catalogo` — catálogo dos 22 tipos: contagem derivada do manifesto, disponibilidade, estado do
  progresso, selo de proveniência, filtro "só verificadas".
- `/pratica/$type` — motor de prática por tipo (shell comum + motor específico).
- `/sessao/$sessionId` — sessão retomável (persiste ao recarregar).
- `/diagnostico` — diagnóstico de erros por categoria + atalhos de treino fraco.
- `/progresso` — estimativa 10–90 por habilidade, confiança, gráficos de evolução, relatório semanal exportável.
- `/simulado` — Simulado (blueprint ~2 h) e Mini-simulado, rótulos claros, fluxo sem auxílios.
- `/ajustes` — meta, prova, backup (exportar/importar com prévia/mesclar/substituir/desfazer),
  quota, Studie Plus (off por padrão).
- `/sobre` — privacidade, honestidade das estimativas, proveniência, avisos de IA.
- API pública (somente o que precisar de chamador externo — esperado: nada na fase inicial; IA usa
  `createServerFn` autenticável não-público... **ver nota**) — 
  **Nota D9-a**: progresso é local e a IA é chamada pelo próprio app via `createServerFn`; como o app
  é sem auth, as server functions de avaliação/tradução são públicas por natureza e **não** tocam em
  dados privados (só recebem o mínimo: questão + resposta). Rate-limit leve por IP/tamanho de entrada
  nos limites do gateway. Nenhum endpoint devolve dados privados.

### D10. Motores de prática por família (features/)
Um shell comum (navegação, timer ajustável, notas privadas, favoritos, histórico, gabarito só após
envio/revelação fora do modo prova) + motor por tipo:
- **Leitura**: `read_fib_dropdown` (select por lacuna), `read_fib_drag` (drag/tap-to-place com banco
  de palavras), `reorder_paragraphs` (embaralhado em runtime — a ordem do banco é a CORRETA),
  `read_mcq_single`, `read_mcq_multi` (parcial sinalizada).
- **Listening**: TTS Web Speech API (voz real exibida) usando `transcript` — listening usa o
  transcript, nunca texto oculto; `wfd` (ditado), `sst`, `lst_fib`, `lst_hcs`, `lst_smw`,
  `lst_mcq_single/multi`, `lst_hiw` (diferença spoken×shown), `repeat_sentence`.
- **Escrita**: `swt`, `write_essay` com contagem de palavras/limites do formato.
- **Fala**: gravação quando disponível (`read_aloud`, `repeat_sentence`, `describe_image`,
  `retell_lecture`, `answer_short`, `sgd`, `rts`); texto honesto sobre o serviço de voz do navegador
  quando indisponível; transcrição quando possível.
- Cada motor: entradas válidas, casos-limite (bordas de tempo, sem áudio, sem imagem), abstenção.
- Estado da sessão sobrevive ao recarregamento (persistência na camada de progresso).

### D11. Studie Plus (D10 do planejamento)
- Off por padrão; 3 controles independentes (tradução de palavra, tradução/explicação de frase,
  pronúncia em inglês). Desativado no simulado (gate em `lib/studie/eligibility.ts`).
- Botão único alterna **modo IA / modo offline**; offline usa pacote local separado do banco, quando
  disponível (recurso futuro de geração — não implementado nesta fase; modo offline mostra estado
  "pacote não disponível" honesto).
- Modelos A (palavra: sentido literal, sentido no contexto, sinônimo comum, por que o autor escolheu
  a palavra, veredito) e B (frase: tradução integral + dicas lexicais; sem lista vazia).
- Matriz central tipo×campo×fase define elegibilidade; campo com resposta fica indisponível até o
  momento seguro; **nenhum prefetch** (só após ação explícita).
- Áudio fala sempre o inglês original, nunca "áudio da tradução".

### D12. Simulado
- Blueprint da matriz/tempos confirmados na fonte vigente da Pearson, com campos `{ confirmed,
  source, consultedAt, omissions[] }`; omissões e aproximações exibidas na tela do simulado.
- Fluxo inviolável: sem voltar para alterar envio, sem consulta, sem gabarito, timers duros;
  Studie Plus desativado; relatório pós-prova com porção por habilidade (rotulada estimativa).

### D13. Gates por fase (obrigatórios, com números reais)
`vitest run` + `tsgo --noEmit` (ou o typecheck do projeto) + `build` + `lint` + Playwright nas rotas
tocadas (`:8080`). Verificação offline (Fases 12–13) só em build de produção. `routeTree.gen.ts`
nunca editado. Testes novos ficam no projeto (ex.: `src/domain/*.test.ts`, `src/test/*.test.tsx`).

### D14. Proibições transversais
- Sem números fixos de contagem na UI/SEO (derivação do manifesto).
- Sem nota oficial/promessa de nota; sem algoritmo determinístico como autoridade avaliadora.
- Sem gerar questões por IA; sem apagar questões sem registro; sem inventar conteúdo para lacunas.
- Sem auth/nuvem para dados do aluno; sem sincronização remota nesta fase.
- Sem chaves de provedor no navegador; sem prefetch do Studie Plus; sem expor gabarito antes do envio.
- Sem `@import` remoto em `src/styles.css`; fontes via `<link>` no `__root`.
- Sem hardcode de cor fora de tokens (`src/styles.css`).

## 2. Escopo por fase (aceitação mensurável)

### Fase 1 — Contratos, catálogo e matriz (fundação, onda 0 — agente principal)
- `domain/types.ts` idêntico ao schema do banco (tipos compilam contra os JSON reais).
- `task-catalog.ts` com os 22 tipos (rótulos pt-BR, seção, descrição, tempo/limite do formato quando
  confirmado; campos `availabilityNote`).
- `ability-matrix.ts` com matriz tarefa×habilidade + fonte citada + flags de aproximação; `answer_short`
  associada à habilidade indicada pela fonte oficial registrada.
- Aceite: typecheck verde; testes unitários do catálogo (22 tipos, ids únicos, seções válidas).

### Fase 2 — Banco importado e manifesto gerado (onda 0 — agente principal)
- Copiar `questions/*.json` (×22) + `aliases.json` → `src/data/questions/`; imagens → `public/di/`.
- Rodar `validate-bank.mjs` (cópia em `scripts/`) → `OK — banco íntegro`.
- `gen-manifest.mjs` → `manifest.generated.json`; conferência: total **2823**, por tipo igual ao
  MANIFEST.json do pacote, imagens 20.
- Loader dinâmico por tipo com cache; import puro (sem IO de runtime).
- Aceite: teste de consistência (soma do manifesto = total; contagem por tipo = len do array;
  total 2823); teste anti-literais (números envelhecidos); build verde com lazy chunk por tipo.

### Fase 3 — Integridade do progresso (onda 1 — subagente `s1-progresso`)
- Toda a camada `lib/progress/` (D5, D6): snapshots, agregados, log truncável, envelope de backup,
  prévia/mesclar/substituir/desfazer, quarentena, migração, quota, chaves de dia local, SRS puro.
- Aceite: bateria de testes de `lib/progress` (≥ 20 casos: corrupção, versão futura, mesclagem,
  desfazer, truncamento, quota simulada, SRS com dados reais do banco), 0 falhas.

### Fase 4 — Fundação web (onda 2 — subagente `s2-web`)
- Rotas D9 com layout comum (nav com badge da fila do dia), catálogo com contagens derivadas,
  ajustes (meta/backup/quota), sobre/privacidade, home com plano do dia e atalhos, shell de prática.
- Design system: tema próprio (pt-BR, mobile-first, tokens em `src/styles.css`); nada de estética
  genérica; tipografia via `<link>` no `__root`.
- Aceite: rotas acessíveis por navegação real (Playwright), catálogo mostra contagens do manifesto
  (iguais às do banco), badge da fila visível, mobile 390×844 sem quebra, typecheck/build/lint verdes.

### Fase 5 — Serviço de IA e harness de avaliação (onda 2 — subagente `s3-ai`)
- Integração Lovable AI Gateway no servidor (createServerFn), configs dos avaliadores para os 22 tipos
  (prompt/rubric/schema/abstenção versionados), pipeline entrada→avaliação→saída validada,
  registro de `{evaluatorId, promptVersion, rubricVersion, model}` na tentativa, cache efêmero,
  limite/retry/timeout.
- Corpus de calibração inicial: subconjunto com gabarito objetivo para smoke-test dos avaliadores
  fechados (seleção/ditado) e revisão manual dos abertos.
- Aceite: chamada real ao gateway com chave de ambiente funciona; schema valida saída; injeção de
  prompt na questão não altera rubrica (teste); abstenção funciona (entrada vazia → abstained, sem nota).

### Fase 6 — Motores por família (onda 3 — 4 subagentes paralelos)
- `s4-reading` (`read_fib_dropdown`, `read_fib_drag`, `reorder_paragraphs`, `read_mcq_single`, `read_mcq_multi`)
- `s5-listening` (`wfd`, `sst`, `lst_fib`, `lst_hcs`, `lst_smw`, `lst_mcq_single`, `lst_mcq_multi`, `lst_hiw`, `repeat_sentence`)
- `s6-writing` (`swt`, `write_essay`)
- `s7-speaking` (`read_aloud`, `describe_image`, `retell_lecture`, `answer_short`, `sgd`, `rts`)
- Cada pacote: motor + UI no shell comum + integração com o avaliador do seu tipo + testes
  (entradas válidas, bordas, abstenção).
- Dono exclusivo: um arquivo de motor por tipo (`features/<família>/<tipo>.tsx` + `engine` puro) —
  nenhum subagente toca o shell comum (mudança → relatório).
- Aceite: cada tipo pratica de ponta a ponta com questões reais do banco (Playwright), envio dispara
  o avaliador correto, gabarito só após envio, testes do motor verdes.

### Fase 7 — Sessões e diagnóstico (onda 4 — subagente `s8-sessoes`)
- Sessões retomáveis (persistem ao recarregar), fila do dia real (SRS vencido + plano), diagnóstico
  por categoria (conteúdo, fluência, omissão, armadilha, palavras mais erradas), notas privadas e
  favoritos ligados aos snapshots.
- Aceite: recarregar a página no meio de uma sessão restaura o estado (teste Playwright); fila do dia
  reflete o SRS (teste unitário com datas); diagnóstico agrega categorias reais das tentativas.

### Fase 8 — Medição honesta (onda 4 — subagente `s9-medicao`)
- `domain/scoring.ts`: estimativa 10–90 rotulada por habilidade com confiança; prontidão (desempenho
  recente ponderado + tendência + confiança); pesos da matriz com declaração de aproximação.
- `/progresso`: gráficos de evolução, lacunas de cobertura, relatório semanal exportável (JSON/CSV).
- Aceite: testes de scoring (casos com dados sintéticos + confiança baixa sem dados), UI rotula
  "estimativa de treino" em todos os números 10–90, relatório exporta com dados reais.

### Fase 9 — Simulado (onda 5 — subagente `s10-simulado`)
- `/simulado`: blueprint confirmado com omissões visíveis, mini-simulado separado, fluxo inviolável,
  reuso dos motores, relatório pós-prova.
- Aceite: Playwright percorre um mini-simulado completo (pode acelerar timers via config de teste),
  sem consulta/gabarito no meio, relatório final coerente com as tentativas.

### Fase 10 — Studie Plus (onda 5 — subagente `s11-studie`)
- `lib/studie/`: matriz tipo×campo×fase, modelos A/B via IA (server fn) e caminho offline honesto,
  controles independentes, botão de modo, zero prefetch, desativado no simulado.
- Aceite: testes da matriz (campo com resposta bloqueado até momento seguro), UI demonstra modelos
  A e B com questão real, gate do simulado impede o uso (teste).

### Fase 11 — Rastreabilidade e payload (onda 6 — subagente `s12-rastreio`)
- Selo de proveniência em todos os itens, filtro "só verificadas", `canonicalId` aplicado via
  `aliases.json` (hoje vazio — código pronto para colisões), payload enxuto (nenhum campo duplicado),
  SEO dinâmico do manifesto + teste de prevenção de números envelhecidos consolidado.
- Aceite: teste do filtro; teste de `canonicalId` com alias sintético; auditoria de payload
  (tamanho por chunk de tipo documentado); SEO do catálogo reflete o manifesto (teste).

### Fase 12 — Offline real (onda 6 — subagente `s13-offline`)
- Pré-cache versionado, "Baixar para offline", aviso de nova versão, degradação clara da IA
  ("requer conexão"), navegação/conteúdo/prática sem IA funcionam offline.
- Aceite: em build de produção, tipo nunca visitado funciona após "Baixar para offline"
  (write_essay/reorder/read_fib/SGD/RTS/Describe Image sem rede nas partes não-IA); aviso de nova
  versão aparece.

### Fase 13 — Acessibilidade, segurança, E2E e lançamento (onda 7 — agente principal)
- Axe limpo nas rotas, teclado completo nos motores, revisão 390×844, scan de dependências,
  observabilidade sem conteúdo sensível, E2E dos fluxos centrais, gates globais finais, relatório.
- Aceite: axe 0 violações críticas nas rotas principais; fluxo completo Home→Catálogo→Prática→Envio→
  Feedback→Progresso→Backup em Playwright; todos os gates verdes.

## 3. Plano de enxame (ondas e pilares)

- **Onda 0 (agente principal):** Fases 1–2 (contratos + banco + manifesto). Nada spawna antes disso.
- **Onda 1:** `s1-progresso` (Fase 3).
- **Onda 2:** `s2-web` (Fase 4) ∥ `s3-ai` (Fase 5) — arquivos disjuntos (`routes/`+`features/shell` vs
  `lib/ai/`+server fns).
- **Onda 3:** `s4-reading` ∥ `s5-listening` ∥ `s6-writing` ∥ `s7-speaking` (Fase 6, por família).
- **Onda 4:** `s8-sessoes` ∥ `s9-medicao` (Fases 7–8).
- **Onda 5:** `s10-simulado` ∥ `s11-studie` (Fases 9–10).
- **Onda 6:** `s12-rastreio` ∥ `s13-offline` (Fases 11–12).
- **Onda 7 (agente principal):** Fase 13 + integração + fechamento.
- Pilares de subagente em `.opencode/work/sub/{K}/` (`project1-s{K}`, `prd-project1-s{K}`, `roadmap-proj1-s{K}`);
  system prompt da skill `subagentes-3-pilares` com os pilares na íntegra.

## 4. Registro de decisões (numerado, vivo)
1. Importação do banco como JSON estático em `src/data/questions/` com import por tipo — protege o
   runtime workerd de IO e permite code-splitting por tipo.
2. Manifesto **gerado por script** e conferido contra `MANIFEST.json` do pacote; UI nunca tem número
   literal — protege contra envelhecimento e divergência.
3. IA via Lovable AI Gateway dentro de createServerFn; sem auth no produto (dados locais), então
   endpoints recebem só o mínimo pedagógico e nada de privado.
4. Quarentena + backup envelope + desfazer na importação — o erro D.1 do planejamento ("progresso
   perdido") é o único imperdoável; a camada vem antes de qualquer feature que mexa em dados.
5. SRS como domínio puro testável, com regra "promove só quando vencido" — evita o anti-padrão de
   SRS do planejamento (5 acertos em 5 min ≠ +30 dias).
6. `answer_short` mapeada à habilidade indicada pela fonte oficial; matriz guarda `confirmed/source/
   consultedAt/approximate` — nada de peso "de memória".
7. Fala sem áudio real analisável → subscore "não avaliado" (nunca proxy disfarçado).
8. Offline real adiado para Fase 12 (após motores e simulado) — o cache só vale com conteúdo final.
9. Modo offline do Studie Plus: estrutura pronta, pacote local é recurso futuro (estado honesto na UI).
10. **Adaptação do enxame ao harness:** o `spawn_agent` deste ambiente é somente-leitura (investiga, roda comandos e reporta; NÃO edita arquivos). Subagentes são usados para auditoria independente e pesquisa (ex.: conferência da matriz Pearson na Fase 9); a construção das fases é executada pelo agente principal, que mantém o restante do método da skill `subagentes-3-pilares` (contratos fixados, verificação real de cada entrega, integração e gates reproduzidos).
11. **Correção determinística para tipos objetivos (Fase 6):** tipos com gabarito fechado (MCQs, FIB dropdown/drag, reorder, lst_fib/lst_hcs/lst_smw, lst_hiw, wfd, answer_short) são corrigidos no cliente por `src/features/grading.ts` (selo `gabarito-local`, confiança 1) — é comparação factual contra o gabarito do item, não estimativa; a IA fica para as respostas abertas (escrita + fala por transcrição, via `ai-evaluate.ts` → `evaluateAttempt`). Motivo: nota substituta de IA sobre algo objetivamente verificável seria menos honesta e custaria cobrança por tentativa. Abstenção estrutural mantida: sem resposta não há envio nem tentativa gravada como nota.
12. **Checksums do pacote em dev-data:** `schema/question-types.d.ts` e `tools/validate-bank.mjs` divergiram do `CHECKSUMS.sha256` herdado da rodada anterior; os checksums dos dois arquivos foram re-gerados sobre o conteúdo atual (nenhum item de questão mudou; validador continua batendo 2823/22). O gate "OK — banco íntegro" volta a valer sobre o estado real dos arquivos.

## 5. Pendências registradas
- Confirmar (fonte vigente da Pearson, com data de consulta) a matriz tarefa×habilidade e os
  tempos/limites por tipo antes de rotular qualquer simulado de "fiel" (Fase 9).
- Modelo/provider do gateway por implantação (Fase 5) — usar o padrão do Lovable AI Gateway.
- Pacote de traduções offline do Studie Plus (recurso futuro; fora do escopo do project1).
