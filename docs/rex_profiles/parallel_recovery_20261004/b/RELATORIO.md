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
   comprovados — referencia faltante publicada abaixo.

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

**Herdado (reconfirmado por pins, nao reexecutado):** paridade Pulseman
196/196 (rotulo rebaixado para "streams compativeis com o
decoder/referencia"); decoder Enigma `a9ed92f9...` usado como ferramenta
externa pinada; pins do review-pr97.

**Pendente / referencia faltante (publicados, nao disfarcados):**
- carga de arte Kosinski→VRAM antes do desenho da fase especial;
- decodificador de mappings (o que `0x2C564` produz) e carga de CRAM para
  o campo paleta dos registros SS_MapIndex;
- consumo observado (execusao) de qualquer etapa;
- consumidores das streams de Pulseman (frente antiga: nao localizados nas
  formas varridas).

## 4. Gates

| Gate | Resultado |
|---|---|
| `test-contrato-b.py` | 20/20 OK (ROM pinada presente; variantes sem BYOR usam skip honesto) |
| `verificar-cadeia.py cadeia --modo verificado` | 37 sitios; 6/6 hashes; roundtrip projecao/inverso; veredito PROMOVIDO |
| `verificar-cadeia.py negativos` | 7/7 RECUSADO com motivo observado |
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
