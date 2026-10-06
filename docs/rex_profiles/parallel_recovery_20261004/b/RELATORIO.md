# RELATORIO — frente b, parallel_recovery_20261004 (correcao do P1 Sonic)

**Estado: Experimental.** Nenhuma promocao de maturidade, nenhum merge,
nenhuma release. Esta frente nao tocou produto, crates, docs comuns,
Current Wave nem Memory Bank.

| | |
|---|---|
| Base fixada | `codex/rex-sonic-sequencia @ cb56657a142df40d2acd09a3e03e54247f066dea` (SHA completo verificado ANTES de iniciar; merge-base com HEAD desta frente conferido) |
| Deriva registrada | o ref LOCAL `codex/rex-sonic-sequencia` avancou para `8b855893af2215274e959624903aa486bac48d0e` (+2 commits). Esta frente NAO acompanhou a base movel: todo o trabalho esta em cima de `cb56657` |
| Worktree / branch | `/home/misael/RDS-PARALLEL-RECOVERY-20261004-B` @ `codex/parallel-recovery-20261004-b` |
| Territorio | `scripts/rex_profiles/parallel_recovery_20261004/b/`, `docs/.../b/`, `data/.../b/` — nada mais |
| Worktree antiga | `/home/misael/RDS-REX-CORPUS-B` reconfirmada em `420e632...`, NAO alterada |
| Rom-alvo | Sonic 1 (USA, Europe), SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531577 bytes (BYOR, somente leitura, NAO versionada) |
| Referencia estatica | s1disasm @ pin `064e3c68eb19cc85b8801b087f9d95f9b3e82cea` (cache `~/.cache/rex-corpus-d/s1disasm`, HEAD==pin); Genesis Plus GX @ pin `46a55214...` via review-pr97 |
| Expectativas | congeladas em `EXPECTATIONS.md`, commit propio `a1d95b8` ANTES de implementar/medir |

## 1. O que esta frente fechou

1. **P1 corrigido em implementacao, evidencia e relatorio.** `$FF4000` e
   WRAM; a copia do consumidor e `move.b` (8 bits) em grade 64x64 com
   stride 128 (`0x1B6F4..0x1B702`). A visao "nametable 64x32 / porta VDP"
   esta formalmente refutada em `ADENDA-SUPERSEDENTE.md`, com o modelo
   antigo preservado no codigo apenas para ser reprovado
   (`refutar_interpretacao_antiga`).
2. **Cadeia provada por bytes da ROM, nao por aparencia:** 37 sitios
   (tabela `0x1B64C` → `lsl.w #2,d0` → `movea.l (-122,PC,D0.w),A0` →
   `lea $FF4000,A1` → `move.w #0,d0` → `jsr $171E` → copia com padding →
   `$FF1020` stride 128 → expansao SS_MapIndex → `rts`) conferidos byte a
   byte contra a ROM no modo `verificado`; cada codificacao remontada e
   desmontada contra o toolchain pinado (`isa-forms-b.json`, 37/37).
3. **Paridade de codec preservada:** os 6 plains (4096 bytes cada) conferem
   com os SHA-256 publicados no review-pr97, com o mesmo modulo decoder
   (`a9ed92f9...`). Um JSON com SHA correto NAO provaria o vinculo — por
   isso o modo verificado exige sitios + tabela + destino + parametros.
4. **Fixture assimetrica autoral** com expectativas proprias (primeira/
   ultima celula, fronteiras de linha, projecao e inverso) que REPROVA o
   modelo antigo (pares como words VDP) e confirma a projecao stride 128.
5. **Negativos reais, todos com recusa observada (7/7):** ROM errada,
   sitio alterado, destino alterado (para `$C00004`), stream fora da
   tabela, geometria 64x32, geometria stride 64, consumidor ausente.
   O "negativo de identidade" do compositor antigo foi reclassificado:
   decode duplo mede DETERMINISMO, nao identidade.
6. **Elo substantivo avancado (entrega 6):** ID de bloco → definicao.
   `SS_MapIndex` em `0x1B738`: 78 registros de 6 bytes expandidos em slots
   de 8 bytes em `$FF4008` (slot do ID k = `$FF4000 + 8k`), conferido nos
   bytes ANTES de escrever o parser (EXPECTATIONS E7). Amostra: ID `$01`
   = `0002c5640142` → mappings `0x2C564` (dentro da ROM), campo `$0142` =
   ArtTile_SS_Wall segundo a referencia pinada. **Limite exato:** o decodificador
   de mappings, a carga de arte Kosinski e a carga de CRAM NAO foram
   comprovados — referencia faltante publicada abaixo (a de CRAM foi
   pinada por sitio na rodada B3; ver §8).

## 2. Niveis de evidencia (um nivel NAO implica o seguinte)

| Afirmacao | Nivel atingido |
|---|---|
| 6 streams Enigma → 4096 bytes cada, hash por referencia externa | referencia estatica + paridade medida |
| Tabela→entrada→stream→chamada→destino→parametros | vinculo estrutural (bytes da ROM + toolchain) |
| Layout 64x64 de IDs de 1 byte, projecao stride 128 | semantica recuperada (estatica; consumida por instrucoes medidas) |
| ID→slot→SS_MapIndex→ponteiro de mappings | vinculo estrutural (+ campo nomeado pela referencia estatica) |
| Arte/mapping/paleta realmente carregados e desenhados | **NAO PROVADO** (exige consumo observado) |
| Qualquer reconstrucao visual equivalente | **NAO PROVADO** — nenhuma imagem de "grafico reconstruido" foi produzida; previews sao diagnostico do layout |
| Execusao da ROM | **NAO FEITA** — nada foi executado; observacao em emulacao e janela do integrador |

## 3. Executado vs herdado vs pendente

**Executado por esta frente:** verificacao byte-a-byte dos 37 sitios na ROM
pinada; ISA-pin dos 37 com as/objdump pinados; decode dos 6 streams e
conferencia dos 6 hashes; fixture assimetrica; 7 negativos; elo
SS_MapIndex; testes (20/20); `check-tree`; regeneracao das 4 evidencias.
Rodada ADENDA-B2 (74fb2e2→): expectativas E12–E17 congeladas ANTES de medir;
controles 7/7 + registro do modelo antigo; cadeia E14–E16 medida (slot,
Map_SSWalls, bloco consumidor 0x1B242); probe E17 da PLC; export por camadas
e export para a frente D; suite completa reexecutada na entrega (20/20,
cadeia PROMOVIDO, negativos 7/7, controles COMPLETOS, mapping OK, export OK).

**Herdado (reconfirmado por pins, nao reexecutado):** paridade Pulseman
196/196 (rotulo rebaixado para "streams compativeis com o
decoder/referencia"); decoder Enigma `a9ed92f9...` usado como ferramenta
externa pinada; pins do review-pr97.

**Pendente / referencia faltante (publicados, nao disfarcados):**
- decodificador Nemesis e o codigo que consome a PLC (DoLoadPLC/NemDec nao
  pinados): a entrada `Nem_SSWalls` da tabela achada e VINCULO ESTRUTURAL, nao
  consumo observado; a carga Kosinski→VRAM de outros assets da fase especial
  segue em aberto;
- carga de CRAM para o campo paleta dos registros SS_MapIndex: **DESCONHECIDA**,
  referencia faltante publicada em `export-camadas-b2.json`
  (`camada_cadeia_id.referencia_faltante`); nenhuma composicao visual foi
  produzida (o vínculo arte completo nao foi demonstrado).
  **ATUALIZADO pela rodada B3 (§8):** referencia do CRAM pinada por sitio
  (hipotese RAM H_B) — nivel RESOLVIDA-ESTATICO; consumo observado
  permanece NAO PROVADO (E22);
- consumo observado (execusao) de qualquer etapa;
- consumidores das streams de Pulseman (frente antiga: nao localizados nas
  formas varridas).

## 4. Gates

| Gate | Resultado |
|---|---|
| `test-contrato-b.py` | 20/20 OK (ROM pinada presente; variantes sem BYOR usam skip honesto) |
| `verificar-cadeia.py cadeia --modo verificado` | 37 sitios; 6/6 hashes; roundtrip projecao/inverso; veredito PROMOVIDO |
| `verificar-cadeia.py negativos` | 7/7 RECUSADO com motivo observado |
| `verificar-cadeia.py controles` (E12) | CONTROLES-COMPLETOS: 7/7 recusas + 7/7 controles aceitos; comportamento do modelo antigo registrado por caso |
| `medir-cadeia-mapping.py` (E14–E16) | CADEIA-MAPPING-E14-E16-OK: Map_SSWalls 128B/16 frames conforme predicao por macro; slot ID$01 = `0002c56400000142`; bloco SS_ShowLayout montado pelo toolchain com ocorrencia UNICA em 0x1B242 e jsr BuildSpr_Normal 0xD762 |
| `exportar-camadas-b2.py` (E13/E17) | EXPORT-CAMADAS-OK; PLC_SpecialStage com ocorrencia unica em 0x1D992 (17 cues; walls = stream 0x2C5E4, VRAM $2840 == ArtTile_SS_Wall×$20); CRAM declarado DESCONHECIDA nesta rodada (B2) |
| `calc-enderecos-ram-b3.py` (referencia, sem ROM) | ANCORAS OK — $FF4000/$FF1020/$80 conferidos; divergencia de 6 bytes vs guarda `if *` exposta como hipoteses H_A/H_B (E18R) |
| `medir-cram-b3.py` (E18R–E22) | E18R/E19/E20/E21-OK: H_B sem mismatch; blink 0x1B33A + tabela 128B == predicao sswallpal; PalCycle_SS unico 0x4962 + SHAs Cyc1/Cyc2; PalLoad/Fade/Index pinados; call site SS unico 0x469A; writeCRAM H_B 6x/4x, H_A 0x; consumo observado NAO PROVADO |
| `verificar-cadeia.py fixture` | PASS (expectativa propria; antiga diverge) |
| `montar-isa.py` | 37/37 remontadas + desmontadas (as `20342db5...`, objdump `f7d63642...`) |
| `npm run check:tree` (`node scripts/check-tree.cjs`) | OK: "Estrutura da raiz conforme docs/08_TREE_ARCHITECTURE.md." (executado na worktree nesta rodada) |
| Gates do barramento canonicos (cargo, tsc, host:certify) | NAO APLICAVEIS — esta frente nao toca produto; nao executados e portanto NAO aprovados para uso em outro contexto |

## 5. Como reproduzir

```bash
cd <worktree>
python3 scripts/rex_profiles/parallel_recovery_20261004/b/test-contrato-b.py
python3 scripts/rex_profiles/parallel_recovery_20261004/b/montar-isa.py \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/isa-forms-b.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py cadeia \
  --rom "$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin" \
  --modo verificado \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/cadeia-sonic-verificada.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py negativos \
  --rom "$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin" \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/negativos.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py fixture \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/fixture-assimetrica.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py controles \
  --rom "$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin" \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/controles-negativos-b2.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/medir-cadeia-mapping.py \
  --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/cadeia-mapping-b2.json
python3 scripts/rex_profiles/parallel_recovery_20261004/b/exportar-camadas-b2.py \
  --out-dir data/rex_profiles/parallel_recovery_20261004/b/evidencia
```

Sem a ROM BYOR: testes parciais rodam, `montar-isa.py` roda (nao le ROM),
cadeia falha com recusa `rom-ausente` — nunca com PASS mudo.
PNGs de diagnostico (se `--render`) vao PARA FORA do Git e sao rotulados
"diagnostico do layout 64x64 (IDs de 1 byte) — NAO e grafico reconstruido".

## 6. Conteudo versionado

Codigo (4 scripts), contrato/docs, fixtures autorais, JSONs de evidencia
(hash,offset,contagem — sem bytes comerciais) e `SHA256SUMS.json` das
evidencias. ROM, plains comerciais, sprites e imagens derivadas NAO estao
no indice.

Rodada ADENDA-B2 acrescenta: `EXPECTATIONS-ADENDA-B2.md` (E12–E17, congelado
sozinho antes de medir), 3 scripts novos (`verificar-cadeia.py` modo
`controles`, `medir-cadeia-mapping.py`, `exportar-camadas-b2.py`) e 4
evidencias novas (`controles-negativos-b2`, `cadeia-mapping-b2`,
`export-camadas-b2`, `export-avaliacao-d`). Total versionado: 20 arquivos no
indice de SHA256SUMS.

## 7. Resultados da rodada ADENDA-B2 (para consumo pelo integrador)

- **E12** — as 7 recusas sao discriminantes: cada uma recusa o input errado E
  aceita o input minimo-correto; o modelo antigo foi registrado na mesma
  entrada (ex.: stride64 — buffers antigo/novo diferem em 526 bytes do mesmo
  plain; 64x32 — antigo produz 2048 celulas de 16 bits onde o consumidor copia
  4096 bytes de 8 bits).
- **E14/E15** — slot `$FF4000+8k` confirmado por simulacao do carregador
  pinado sobre os 78 registros (0 anomalias); ID $01 = `00 02 C5 64 | 00 00 |
  01 42`. `Map_SSWalls` @0x2C564: 128 bytes, 16 palavras relativas a rotulo,
  todas as 16 frames byte-a-byte conforme a PREDICAO DERIVADA DAS MACROS
  (antes da medição). Leitura ver1 das pecas registrada como referencia
  estatica.
- **E16** — o bloco consumidor de SS_ShowLayout (linha 111 do disasm pinado)
  foi MONTADO pelo toolchain pinado e encontrado UMA UNICA vez na ROM
  (0x1B242), com cauda `bmi.s +6` / `jsr $D762` (BuildSpr_Normal) conferida;
  nivel declarado: codigo-presente, NAO "consumo observado".
- **E17** — ligacao de arte da cadeia ID $01: PLC_SpecialStage achada por
  predicao de macros (plcheader/plcm + ArtTile_SS_* pinados), ocorrencia
  unica em 0x1D992; a cue `Nem_SSWalls` ancora o stream 0x2C5E4 no MESMO base
  de tiles do slot ($142 → VRAM $2840). Nivel: vinculo-estrutural (NemDec nao
  pinado). Paleta CRAM: **DESCONHECIDA** com referencia faltante publicada;
  nenhuma composicao visual produzida (protocolo congelado: sem aproximacao).
- **Antirreuso** — `export-camadas-b2.json` traz `meta_integrador_antireuso`
  com os artefatos que nao devem ser reutilizados (compositor antigo /
  sonic1-mapa-*.json) e os comandos de reproducao unicos.
- **Frente D** — `export-avaliacao-d.json` expoe codec/params/hashes das 6
  plains sem qualquer campo voltado ao produto; os codecs artificiais do
  benchmark nao foram adaptados aqui.
- **Frente A** — nao foi necessaria carga Kosinski neste round; a cadeia
  provada usa somente Enigma + Nemesis-PLC (estrutura). Se o integrador pedir
  arte decodificada, aplicar a frente A corrigida SOMENTE depois da revisao
  de ISA dela, e pinar NemDec antes de promover "consumo observado".

## 8. Rodada ADENDA-B3 — referencia faltante do CRAM (E18R–E22)

Expectativas congeladas ANTES de qualquer medida, em dois commits solos:
`a233e8d` (B3: fatos + E18–E22) e `ab72d90` (B3.1: refreeze E18R). O primeiro
runabortou no proprio gate E18 (derivacao RAM divergiu entre dois caminhos
internos), sem nenhuma byte da ROM consumida; o refreeze B3.1 converteu os
campos `.w` da fase geral em WILDCARDS de 2 bytes e registrou as hipoteses
H_A (`_Variables.asm` sem a instancia L114 do SMPS_RAM) e H_B (com a
instancia; cada campo +$5C0) — a discrepancia de 6 bytes vs a guarda `if *`
de `v_ram_end` e real e nao resolvivel estaticamente; a ROM foi o arbitro.

Metodo (mesmo da E16): blocos montados com o toolchain m68k-elf PINADO,
enderecos absolutos viram placeholders (tecnica dos dois placeholders),
busca na ROM com mascara exige ocorrencia UNICA, e os valores lidos no sitio
decidem a hipotese. Resultados:

- **E18R** — H_B vence sem nenhum mismatch em 14 campos lidos (E19+E20 +
  ramaddys do Pal_Index: line_1=$FB00, line_2=$FB20); invariantes
  congeladas confirmadas (frame=time+1; palss_time−num=2, index−num=4;
  espelhos = line_3/line_4 +$E/+1A). H_A refutada campo a campo.
- **E19** — blink de `SS_AnimateBlocks` com ocorrencia unica em 0x1B33A;
  tabela de 128 B em 0x1B43A byte-a-byte igual a PREDICAO derivada da macro
  sswallpal (SHA 985518fb…; predicao==medida antes da medida).
- **E20** — `PalCycle_SS` unico em 0x4962; alvos `.l` lidos no sitio
  (SS_Timing_Values 0x4A3C, SS_BG_Modes 0x4ABC, Pal_SSCyc1 0x4ACA,
  Pal_SSCyc2 0x4B12); os dois bins de ciclo batem com os SHAs pinados
  (ec2391eb…/65e5c943…).
- **E21** — `PalLoad` 0x2118 / `PalLoad_Fade` 0x20FC / `Pal_Index` 0x2168
  (20 entradas, contagem da entrada 10 = $1F, Pal_Special 128 B = SHA
  2f9072d8…); call site do Special Stage (moveq #10 + bsr.w PalLoad_Fade)
  UNICO em 0x469A com alvo == PalLoad_Fade pinado; writeCRAM montado para as
  duas hipoteses: H_B encontrado 6x (v_palette) e 4x (v_palette_water) nas
  rotinas de VBlank; H_A zero ocorrencias (discriminante).
- **E22 (teto)** — nivel maximo = vinculo-estrutural + equivalencia
  estatica; **consumo observado (CRAM escrito em execucao) NAO PROVADO**;
  `cram_paleta` sai de DESCONHECIDA para RESOLVIDA-ESTATICO no export, com a
  referencia ainda faltante refinada e publicada no proprio export.

Retificacoes de FERRAMENTA durante a rodada (nao reescrita de expectativas;
a semantica congelada — quais simbolos, unicidade, valores — nao mudou):
(a) o assert `41F9` do wildcard `.l` aceitou so `%a0`; corrigido para a
familia `lea (xxx).l,%aN` (41F9|N<<8); (b) `writeCRAM` expande com o ramaddr
COMPLETO de 24 bits ($FFFFFB00, ex.: dmasrc $96FD9580 / dmamode $977F), nao
com o `.w`; (c) `bsr.w` e `6100 + disp16` relativo ao endereco da propria
branquia + 2 (nao `4EF9`/`jmp`). Os tres sao correcoes de encoding do
montador/leitor, cada uma provada contra o disasm pinado antes de valer.

Reproduzir: `python3 scripts/.../calc-enderecos-ram-b3.py` (derivacao de
referencia, sem ROM) e `python3 scripts/.../medir-cram-b3.py --rom <BYOR>
--out data/.../evidencia/cram-b3.json` (so leitura; recusa ROM com SHA
diferente do pin c7da53a1…).

## 9. Rodada ENIGMA-B4 — decoder nativo delimitado (E23–E30)

Objetivo: decoder Enigma puro, utilizavel pelo backend, SEM copiar o decoder
externo cuja incorporacao foi excluida pela politica da rodada.

Procedencia e politica (requisito 1): nenhum Enigma existia no produto
(`src-tauri`, `crates/`; ROUND_STATE linha Enigma = blocked). mdcomp
(72c6df40…, LGPL-3.0-or-later) excluido por politica; a reconstrucao de
pesquisa pinada (a9ed92f9…) e RESEARCH ONLY e nao foi portada. O produto e
clean-room do desempacotador real do console — `_inc/Decompression/Enigma
Decompression.asm` do s1disasm pinado (064e3c68…), SHA do arquivo
76fed2de… — lido instrucao a instrucao (header 6B, tokens 6/7 bits
0|s|cccc / 1|mm|cccc, PCCVH, terminador 1|11|1111, alinhamento par do
EniDec_Done).

Congelamento ANTES de qualquer Rust: commit `3268ac7`
(`EXPECTATIONS-ENIGMA-B4.md` + `sonda-oraculo-enigma-b4.py` +
`enigma-oraculo-b4.json`). A sonda mediu apenas referencias externas pinadas
(decoder a9ed92f9 + ROM c7da53a1 + fixtures corpus-B com SHA regravado) e
produziu os numeros congelados E23–E28.

Implementacao: crate `scripts/.../b/enigma-rs/` (`rex-enigma`, lib + CLI
`rex-enigma`), Rust puro, sem Tauri/IPC/UI, sem `unsafe`; unica dependencia
`rex-kosinski` por path para `sha256_hex` (precedente rex-corpus). Limites
por contrato: max_output_bytes, work_limit (tokens), leitura sempre dentro do
slice, cancelamento cooperativo; aritmetica mod 2^16 (wrap = comportamento
definido do console, nao erro). Erros: truncated, malformed-header
(extensao declarada), excessive-output, work-limit, cancelled; erro => zero
saida ao chamador.

Resultados (primeira execucao, zero desvio do congelado):
- E23 paridade 6/6 nas streams reais da ROM: SHA da saida, `bytes_lidos`
  exato, padding e `bytes_armazenados` por linha — incluindo o caso
  discriminante 0x662f4 (1233 lidos, padding 1, slot 1234 = diff de offsets
  da tabela B2).
- E24 paridade 10/10 nos pares plain do corpus-B (decode(.eni) == .bin byte a
  byte; bytes do ficheiro alem do consumo NAO contados).
- E25 negativos e01–e07 com codigos do PRODUTO (7/7): recusas onde o oraculo
  tolerava (odd-tail, truncamento, vazio, lixo, max-out) e aceites corretos
  onde o formato define aceitar (e03/e04 — ver retificacao §4 do documento de
  expectativas: byte[1] e bitfield PCCVH, nao enum de modo; [4:6] e common
  value, nao declaracao de comprimento).
- E26 hardening 9/9: packet_length {0,12,128,255} e mascara >0x1F recusados
  (divergencia deliberada e documentada do console, que produziria lixo
  limitado), work-limit, cancel (via API), header curto.
- E27 invariante de contabilidade em todas as entradas aceites.
- E28 sem panic: 264 cortes de planes_4k + metades SS + fills + 128 entradas
  LCG(20261005) — todas terminam em Ok|Err estruturado.

Gates: `cargo test` 8+6 verdes; `cargo clippy --all-targets -- -D warnings`
exit 0; `medir-produto-enigma-b4.py` → `enigma-produto-b4.json`
`PRODUTO-ENIGMA-B4-OK`; gates da frente re-executados identicos ao congelado
(cadeia/negativos/controles/fixture/isa byte-identicos, export-camadas OK,
test-contrato-b 20/20); `check:tree` OK.

O que NAO se afirma: consumo observado em runtime (teto inalterado);
composicao visual (ligacao da arte ainda pendente); incorporacao no produto
(crates/, registry, IPC, UI = trabalho e decisao do integrador — aqui vao
API, proveniencia, metadados e testes consumiveis).

Reproduzir: `cargo test` e `cargo build` em `scripts/.../b/enigma-rs/`,
`python3 scripts/.../b/sonda-oraculo-enigma-b4.py` (referencia externa) e
`python3 scripts/.../b/medir-produto-enigma-b4.py` (produto vs congelado).
