# Banco de questões do PTE Academic — pacote de transferência

Conteúdo pronto para importar: **2823 questões reais em 22 tipos**, 20 imagens, o registro de **91 fontes avaliadas** (47 aprovadas · 44 reprovadas) e a evidência de corroboração entre fontes. Nenhuma questão deste pacote foi gerada por IA: tudo foi colhido de fontes públicas acessíveis sem login, com gabarito/transcrição, validado e deduplicado. Com este pacote **não é preciso buscar, avaliar nem extrair questões**: o banco já está pronto.

## Estrutura

```
pte-question-bank/
├── README.md                    este arquivo
├── MANIFEST.json                contagens por tipo/seção/proveniência/fonte (fonte única dos números)
├── CHECKSUMS.sha256             SHA-256 de todos os demais arquivos
├── aliases.json                 { id descartado: id canônico } — vazio (nenhuma colisão); manter para o futuro
├── questions/<tipo>.json  ×22   um array de Question por tipo (Repeat Sentence inteiro em um arquivo)
├── images/describe_image/*.png  imagens do Describe Image (gráficos CC BY 4.0, com atribuição no próprio item)
├── sources/sources.json         registro das fontes: aprovadas e reprovadas, com evidência, amostra, nível e motivo da decisão
├── evidence/corroboration.json  itens elevados a "corroborada": quais outras fontes independentes também os trazem
├── reports/coverage.json        contagem × meta por tipo, lacunas, itens pulados com motivo, itens em revisão manual
├── reports/search-queries-log.json  consultas de busca já executadas (para não repetir)
├── schema/question-types.d.ts   tipos TypeScript de Question e de `data` por tipo
└── tools/validate-bank.mjs      validador (Node 18+, sem dependências)
```

## Como importar (6 passos)

1. Descompacte na raiz do novo projeto (ex.: `bank/`) e rode `node bank/tools/validate-bank.mjs` — deve terminar com `OK — banco íntegro` (os AVISOS listados são itens fora da faixa de plausibilidade; são sinalizados, não são erros).
2. Copie `questions/*.json` para o diretório de dados do app (um arquivo por tipo, um loader dinâmico por tipo) e `aliases.json` ao lado deles.
3. Copie `images/describe_image/*.png` para `public/di/` — o campo `data.image` de cada item de Describe Image já aponta para `/di/<arquivo>.png`.
4. Gere o manifesto do app a partir dos arquivos de questões (ids, tipo, seção, domínio, proveniência, tópico, nº de palavras); contagens e selos **sempre derivados** dele — nunca digitadas.
5. Copie `sources/sources.json` e `evidence/corroboration.json` para a pasta de trabalho de desenvolvimento (fora do bundle do app). O app só carrega `source` e `provenance` de cada item.
6. Guarde `MANIFEST.json` como referência de conferência: o total do app deve ser **2823** após a importação.

## Conteúdo por tipo

| Tipo | Seção | Itens | Meta mín. / ideal | Situação |
|---|---|---|---|---|
| `wfd` | listening | 551 | 300 / 900 | ok |
| `repeat_sentence` | speaking | 682 | 200 / 550 | ideal |
| `sst` | listening | 58 | 60 / 120 | abaixo-do-minimo |
| `lst_fib` | listening | 53 | 60 / 100 | abaixo-do-minimo |
| `lst_hcs` | listening | 50 | 20 / 50 | ideal |
| `lst_smw` | listening | 50 | 20 / 50 | ideal |
| `lst_hiw` | listening | 50 | 20 / 50 | ideal |
| `read_aloud` | speaking | 340 | 100 / 200 | ideal |
| `describe_image` | speaking | 20 | 20 / 60 | ok |
| `retell_lecture` | speaking | 62 | 40 / 80 | ok |
| `answer_short` | speaking | 378 | 80 / 140 | ideal |
| `sgd` | speaking | 25 | 12 / 40 | ok |
| `rts` | speaking | 31 | 30 / 60 | ok |
| `write_essay` | writing | 79 | 30 / 60 | ideal |
| `read_fib_dropdown` | reading | 41 | 40 / 80 | ok |
| `read_fib_drag` | reading | 50 | 20 / 50 | ideal |
| `read_mcq_single` | reading | 50 | 60 / 110 | abaixo-do-minimo |
| `read_mcq_multi` | reading | 50 | 20 / 50 | ideal |
| `reorder_paragraphs` | reading | 50 | 40 / 80 | ok |
| `swt` | writing | 53 | 40 / 80 | ok |
| `lst_mcq_single` | listening | 50 | 20 / 50 | ideal |
| `lst_mcq_multi` | listening | 50 | 20 / 50 | ideal |

Proveniência: **74 verificada** · **207 corroborada** · **2542 comunitária**. Por seção: Speaking 1538 · Writing 132 · Reading 241 · Listening 912.
Lacunas honestas (abaixo da meta mínima): `sst`, `lst_fib`, `read_mcq_single` — a cobertura é reportada como está; nenhum item foi inventado para preencher.

## Níveis de proveniência (campo `provenance`)

- **verificada** — material oficial (Pearson, Our World in Data) ou fonte com pontuação de confiança ≥ 80.
- **corroborada** — o mesmo item (similaridade ≥ 0,85) aparece em **2 ou mais fontes de operadores independentes**; a lista de fontes está em `evidence/corroboration.json` e o resumo em `evidenceSummary`.
- **comunitaria** — fonte de preparo com curadoria editorial (gabarito/explicação, reputação), ainda sem corroboração cruzada.

## Fontes principais (12 com mais itens)

| id | domínio | nível | confiança | itens |
|---|---|---|---|---|
| `cand-76` | gurully.com | comunitaria | 62 | 721 |
| `goarno` | goarno.io | comunitaria | 70 | 676 |
| `cand-87` | ptehelper.com.au | corroborada | 66 | 224 |
| `cand-22` | ptehelper.com.au | corroborada | 66 | 190 |
| `cand-85` | stormedugo.com | corroborada | 66 | 144 |
| `cand-86` | stormedugo.com | corroborada | 66 | 100 |
| `cand-24` | sumlingo.com | comunitaria | 68 | 98 |
| `cand-88` | onepte.com | corroborada | 62 | 62 |
| `pearson` | pearsonpte.com | verificada | 95 | 52 |
| `stormedugo` | stormedugo.com | corroborada | 68 | 50 |
| `cand-23` | gurully.com | comunitaria | 67 | 50 |
| `cand-42` | goarno.io | comunitaria | None | 50 |

Cada entrada de `sources/sources.json` traz: URL, tipos cobertos, grupo do operador (independência), nível, confiança, licença declarada, evidências positivas/negativas com trechos literais, amostra manual (inspecionados × defeitos), decisão de gate com data e motivo, corroboração calculada e histórico de mudança de nível. As fontes **reprovadas** continuam registradas, com motivo, para que ninguém as reavalie à toa.

## Esquema dos itens

Veja `schema/question-types.d.ts`. Pontos que o código consumidor precisa respeitar:

- `id` é estável e único; ids nunca são reutilizados (progresso de alunos aponta para eles). `source.id` liga o item ao registro de fontes.
- Texto guardado **uma vez**; derivados (áudio TTS = `transcript`/`sentence`/`text`; palavras erradas do `lst_hiw` = diferença `spoken` × `shown`; `transcript` do `lst_fib` = `template` preenchido) são calculados em runtime.
- `reorder_paragraphs.paragraphs` está na ordem **correta**; embaralhe de forma determinística (semente = `id`).
- `read_fib_drag.answers[i]` é o índice em `bank` da lacuna `i+1`; `read_fib_dropdown.blanks[i].answer` é o índice em `options`.
- `write_essay.sample` existe em parte dos itens; `keywords`/`facts`/`sample` são referência para avaliação e estudo, nunca texto a exibir antes da resposta.
- Gabaritos (`answer`, `answers`, `sample`, `transcript` de listening) **não podem** ser enviados ao navegador antes do envio da resposta.

## Direitos e uso

Uso **local e pessoal**. As fontes são secundárias e quase nenhuma declara licença de reuso: não redistribuir o banco como produto nem publicá-lo em URL pública. Imagens do Describe Image são CC BY 4.0 (Our World in Data) e exigem a atribuição presente em `source.attribution`. Pedido de remoção de um item: removê-lo do arquivo do tipo e registrar o id em `aliases.json` ou no relatório do projeto.

## Integridade

`tools/validate-bank.mjs` confere: 22 arquivos · contagens = `MANIFEST.json` · ids únicos · `source.id` existente e aprovado · proveniência válida e coerente com `evidence/corroboration.json` · gabaritos dentro das opções · marcadores `{n}` = lacunas · imagens existentes com `alt` e licença · faixas de formato por tipo (aviso) · **zero quase-duplicatas** (Jaccard de tokens ≥ 0,85 dentro do tipo) · checksums.
