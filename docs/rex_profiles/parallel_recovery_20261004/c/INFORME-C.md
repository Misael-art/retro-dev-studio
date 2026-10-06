# INFORME — frente C, ETAPA 1 (rex-cfg/v1) — 2026-10-04

Ferramenta: **`rex-cfg`** (crate Rust em `scripts/rex_profiles/parallel_recovery_20261004/c/`),
esquema de saída **`rex-cfg/v1`**. Base de trabalho: `cb56657`; território exclusivo
`scripts/…/c`, `docs/…/c`, `data/…/c`. Nenhum arquivo de produto (`src/`, `src-tauri/`,
`crates/` existentes, manifests, lockfiles, harness) foi tocado — `git status` na entrega
mostra apenas os dois diretórios novos.

Objetivo da frente, na formulação da missão: **reduzir os falsos consumidores produzidos
por varredura linear, por análise de fluxo delimitada, sem prometer desmontador
universal.** Este informe diz o que foi construído, o que foi medido, e — com a mesma
precisão — o que **não** foi provado.

---

## 1. O que é a ferramenta

`rex-cfg analyze` recebe um binário, **uma região declarada** (`--region 0xINICIO:0xFIM`,
fim exclusivo), **raízes explícitas** com proveniência obrigatória do vocabulário
(`--root`, `--root-prov`, `--root-evidence`) e **sítios de consulta** (`--site`). Ela
caminha o fluxo a partir das raízes **dentro da região**, montando blocos básicos, e
**para** onde o subconjunto 68000 documentado não cobre, registrando o byte/opcode
observado como fronteira tipada.

Isso é o mecanismo anti-falso-consumidor: um endereço só tem significado se estiver
dentro de um fluxo comprovado; e a pergunta "este byte é o início de uma instrução?" tem
três respostas possíveis — `instrucao-de-bloco`, `miolo-de-instrucao` (é meio de
instrução **deste fluxo**), `dentro-regiao-nao-alcancado` / `fora-da-regiao`.

Camadas (5.490 linhas no total, testes e corpus autorais incluídos):

| Arquivo | Papel |
|---|---|
| `src/decode.rs` (1.196) | decodificador 68000 da lista fechada do CONTRACT §3: comprimento por tabela, operandos, fluxo (desvio/chamada/retorno/`jmp`), fronteiras tipadas. **Única fonte** da tabela de (máscara, valor, consumo de extensão). |
| `src/grafo.rs` (916) | caminhada intra-região, blocos, arestas (`queda`/`desvio`/`chamada`/`retorno-fronteira` com status `resolvido`/`fora-da-regiao`/`indireto-opaco`/`armadilha`), cobertura com vaos, veredito de sítio, grau/proveniência de raiz. |
| `src/export.rs` (340) | JSON `rex-cfg/v1` ordenado e determinístico (byte a byte) + resumo Markdown com os mesmos números. |
| `src/main.rs` (299) | CLI congelada (CONTRACT §2); `0` sucesso, `1` erro de análise, `2` erro de uso; `--bin` aberto somente-leitura. |
| `tests/` (2.243) | 38 testes; paridade contra instrumento independente, dois corpus autorais de calibração, 8 fixtures de fluxo, CLI, JSON determinístico, fórmula histórica. |
| `fixtures/*.s` + dumps | corpus autoral montado por `m68k-elf-as` e desmontado por `m68k-elf-objdump` (binutils 2.41 do host); `.bin` e dumps versionados; `tools/make-fixtures.sh --check` prova reprodutibilidade. |
| `executar-evidencia-C.sh` | captura R1/R2/R3 na ROM BYOR, regenera a evidência redigida versionada, roda o comparador contra o objdump bruto e auto-verifica os critérios congelados. |

Sem dependência nova: `Cargo.toml` declara path-dep **somente-leitura** sobre
`crates/rex-gameplay` (usado para o cross-check `paridade_com_rex_gameplay_m68k_nas_formas_comuns`
e para SHA-256/JSON já aprovados no tronco).

## 2. Como foi provada (e o que conta como prova)

Três pernas independentes, todas exigidas pelo CONTRACT §5:

1. **Paridade contra o instrumento** — `m68k-elf-objdump -d` sobre corpus autoral
   montado por `m68k-elf-as`: para cada registro impresso, comprimento, família, alvo
   absoluto e (desde este adendo) campos de operandos indexados. Round-trip interno
   próprio **não** é aceito; o teste que existe só compara a ferramenta com o outro.
2. **Cross-check com `rex-gameplay::m68k::decode`** nas formas comuns dos dois
   subconjuntos (comprimento e alvo idênticos; divergir = falhar).
3. **ROM real BYOR** em duas rotinas delimitadas (R1, R3) e um fluxo de boot (R2), com
   o dump bruto do instrumento sobre a mesma fatia como desempate.

## 3. Medições na ROM (Sonic the Hedgehog USA/Europe, somente-leitura, não versionada)

Objeto: `/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin`
SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531 577 bytes.
Pinos de região (do `dd`+`sha256sum` gravados no `MANIFEST.md`):
R1 `e8028514…90b26f90`, R2 `655f3734…e1a965ba`, R3 `6f702873…bc87d470`.
Vetor de reset (32 bytes em `0x000000`): `66a88a2471192a07fb48ce9bc73ba3125aa983e1cf0604e5a465ecf71c1e7a6d`.

| | R1 (Kosinski, `0x189C..0x193C`) | R2 (boot, `0x206..0x2A0`) | R3 (sítio de chamada, `0x1364..0x1380`) |
|---|---|---|---|
| raiz / proveniência | `0x189C` / `referencia-estatica` (3 sítios `bsr.w $0189C` medidos pela FASE6) | `0x206` / `vetor-plataforma` (longo em `0x000004` = `0x00000206`) | `0x1364` / `referencia-estatica` |
| blocos / arestas | 21 / 31 | 7 / 9 | 2 / 2 |
| instruções | **66** | 15 | 6 |
| cobertura | **160/160 = 1.0000**, 0 vaos | **54/154 = 0.3506**, 2 vaos (`0x23A..0x292`, `0x294..0x2A0`) | **28/28 = 1.0000** |
| fronteiras | **0** | 2: `0x23A` `opcode-fora-do-subconjunto`, `0x292` `limite-de-regiao` | 2: `0x1370` e `0x1380`, ambas `limite-de-regiao` |
| chamadas | `[]` (rotina folha, como prometido) | `[]` | 1: `0x1370 → 0x189C`, `status=fora-da-regiao`, **declarada e não andada** |
| laços para trás | 5 arestas de desvio com alvo < origem | — | — |
| DBcc | 5 em `0x18AC, 0x18C8, 0x18DC, 0x18EE, 0x1922` (posições congeladas) | `dbf` fora do caminho cortado em `0x23A` | — |
| terminador | `rts` em `0x193A` | — | — |
| paridade com o instrumento | **66/66 comparados, 0 divergências, 0 além do limite** | 15 comparados, **0 divergências**, 39 registros do instrumento além do limite declarado (listados no log) | **6/6, 0 divergências** |
| SHA-256 do JSON bruto | `318364322561bff357648cd1d041c39f3ddefa70c4174af66cea4c89ca513465` | `1c197a8af3b3c6d4bd8baa74309bdda7a06177e712b150115fe86adc2b0faba0` | `d33a236e26b70d9987d879b5240094390134223a7b02aa75e9fcbde4fd2c1677` |
| SHA-256 da evidência versionada | `d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4` | `524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3` | `c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea` |

Comandos exatos (repetíveis; gravados no `MANIFEST.md` e dentro de cada `.redigido.json`):

```sh
rex-cfg analyze --bin "<ROM>" --region 0x189C:0x193C --root 0x189C \
  --root-prov referencia-estatica --root-evidence "<frase da FASE6>" \
  --site 0x189C --site 0x18A0 --site 0x18FF --site 0x193B --out r1.json
rex-cfg analyze --bin "<ROM>" --region 0x206:0x2A0 --root 0x206 --root-prov vetor-plataforma \
  --root-evidence "<vetor 0x000004>" --site 0x1364 --site 0x3082 --site 0x51BC --site 0x745DC --out r2.json
rex-cfg analyze --bin "<ROM>" --region 0x1364:0x1380 --root 0x1364 \
  --root-prov referencia-estatica --root-evidence "<bsr.w em 0x1364>" \
  --site 0x1364 --site 0x1366 --site 0x1369 --site 0x1370 --site 0x1372 --site 0x1378 \
  --site 0x137C --site 0x137E --site 0x1380 --out r3.json
```

## 4. A resposta operacional que a missão pedia

A motivação da frente era: varredura linear acha "consumidores" de um ponteiro/assinatura
em bytes que **não são início de instrução**. R3 é o caso concreto, medido:

| sítio consultado | veredito | o que significa |
|---|---|---|
| `0x1364` | `instrucao-de-bloco` | início real (`lea` de 6B) |
| `0x1366`, `0x1369` | `miolo-de-instrucao` | casamento linear dentro da instrução de 6B: **não é consumidor** deste fluxo |
| `0x1370` | `instrucao-de-bloco` | sítio de chamada (`bsr.w → 0x189C`) |
| `0x1372` | `miolo-de-instrucao` | idem, dentro do `bsr.w` |
| `0x1378` | `miolo-de-instrucao` | dentro do `move.w #0,0xa11200` de 8B |
| `0x137C`, `0x137E` | `instrucao-de-bloco` | os dois `nop` reais |
| `0x1380` | `fora-da-regiao` | fim da região declarada |

Os quatro vereditos de R2 (`0x1364`, `0x3082`, `0x51BC`, `0x745DC` → `fora-da-regiao`)
são a outra metade da resposta: a pergunta "isto é consumido?" é respondida **por região
analisada**, e a ferramenta não tem como dizer nada sobre um sítio fora da região que o
operador declarou. Em R1, `0x18A0`, `0x18FF` e `0x193B` caem em `miolo-de-instrucao`
dentro de instruções reais, o que é o falso consumidor canário da fase anterior.

Efeitos colaterais úteis, medidos: os dois alvos que a fórmula histórica errada
produzia (`0x189E` em R3, `0x18B8`/`0x18AA` em R1) **não aparecem** no grafo; a
proveniência declarada de cada raiz é preservada no export (nenhuma sobe de grau —
verificado por teste no comparador); e `params="nao-inferidos"` / `clobbers="nao-modelado"`
são constantes na saída.

## 5. O que NÃO está provado (limite declarado, não é modéstia retórica)

- **Nada aqui é desmontador universal.** A lista fechada é §3 do CONTRACT; fora dela a
  ferramenta para e registra. Na ROM isso corta R2 em `0x23A` (15 instruções de 55 que o
  instrumento imprime na fatia).
- **Nada é executado.** `observado-em-runtime` não é alegado em nenhum lugar; fluxo
  analisado é fluxo *possível* segundo o byte-code, não caminho tomado.
- **`miolo-de-instrucao` é relativo ao fluxo desta região**: não prova que o byte seja
  dado em fluxos não analisados (CONTRACT §6, última linha).
- **`dentro-de-fluxo` não é alcançabilidade desde o boot**: raiz é declarada pelo
  operador; nenhuma raiz foi promovida a "alcançável do reset".
- **Sem propagação de registrador/pilha**: listas do `MOVEM` não são inferidas
  (`movemw mem->reg (lista nao-inferida)`), parâmetros idem.
- **`JMP/JSR` indiretos não são resolvidos por aparência**: fronteira `indireto-opaco`,
  entrada em `chamadas` com `alvo=nulo` (testado em `fx05`).
- Evidência bruta de ROM (mnemônicos) está **fora do índice** por regra de
  não-distribuição; a versão versionada (`*.redigido.json`) preserva todos os números
  citados aqui. Ver `ADENDO-ETAPA1-2026-10-04.md` §H, que registra o choque com o texto
  congelado e pede decisão do operador.

## 6. Divergências registradas (resumo; série bruta no adendo)

Todas em `docs/…/c/ADENDO-ETAPA1-2026-10-04.md`, com o texto congelado intacto:

- **§A** defeito real corrigido: layout da word de extensão dos modos indexados
  (`d8(An,Xn)`/`d8(PC,Xn)`), exposto na ROM em `0x191C` (`XD0`/disp `0x20` → **D2**/disp `0`)
  por um teste novo de paridade de operandos; e recusa dos bits 10-8 (68010/68020),
  porque ali o comprimento do instrumento não é comprovável pelo contrato.
- **§B** linhas da tabela do Anexo A divergem do instrumento em rótulo, tamanho ou byte
  impresso (10 linhas de tabela, cobrindo 12 endereços) — endereços, comprimentos e a
  soma de 160 batem.
- **§C** `0x1930`: o parentêntese do texto congelado está invertido (certo `0x18A8`).
- **§D/E** R2: `bne.w` é `bnes` de 2B, logo `lea`/`movem` em `0x216`/`0x21A` (não
  `0x218`/`0x21C`); R3: `0x136A` é `lea`, não `move.abs.L→D1`.
- **§F** 12 famílias de recusa deliberada onde o instrumento lê (MOVEP, MOVEC, `extw`,
  `bkpt`, disp8=`0xFF`, fonte `%pc` em ALU/MOVE, campos de índice 68020, indiretos).
- **§G** quatro leituras falsas do próprio comparador, corrigidas.
- **§I** limites menores (`--origin` não se aplica a operandos absolutos; exibição de
  disp16 com sinal e nomes `%fp` do instrumento fora do escopo de paridade).

## 7. Estado dos gates

| gate | resultado |
|---|---|
| `cargo test --offline` (crate `rex-cfg`) | **38/38 verdes** |
| `cargo clippy --offline --all-targets -- -D warnings` | limpo |
| `cargo fmt --all -- --check` | limpo |
| `bash tools/make-fixtures.sh --check` | OK: corpus reproduzíveis a partir dos `.s` autorais |
| `bash executar-evidencia-C.sh` | `rc=0`, `divergencias criticas = 0` |
| `npm run check:tree` (na raiz do worktree) | OK |
| `npm run lint`, `npx tsc --noEmit`, `npm test`, `cargo clippy/test` do `src-tauri`, `npm run host:certify` | **não executados** — a frente não toca `src/`, `src-tauri/` nem frontend; jobs pesados são serializados pela regra de execução. Registrados como não aprovados, não como verdes. |

## 8. Entrega para as outras frentes

`docs/…/c/PROPOSTA-FRENTE-A.md` traz o que a frente A (cadeias Kosinski) pode consumir
deste corte: vocabulário de sítio, `--site` como primitive, e a regra
`pertencimento a fluxo analisado ≠ existência de consumo`. Nenhum outro território foi
alterado.

## 9. Próximo passo honesto

A frente C termina aqui como **Experimental, backend comprovado por instrumento
independente**: não há UI, não há integração ao `src-tauri`, não há promoção de status,
não há release. Abrir PR isolado e deixar integração/merge nas mãos do operador é
deliberado (CONTRACT e protocolo do round).

---

## 10. ETAPA 2 — fechamento datado (2026-10-05), acrescentado sem reescrever §1..§9

Este §10 substitui apenas o "termina aqui" de §9: a frente recebeu a ETAPA 2
(obrigações 1..9 do briefing) e fecha neste corte. As §1..§9 ficam como foram
assinadas na ETAPA 1; a evidência da ETAPA 2 está em
`EXPECTATIONS-ETAPA2.md` (congelado), `ADENDO-ETAPA2-2026-10-04.md` (retificações
A-1..A-8), `REVISAO-C-DE-A.md` (revisão independente da ISA de A, com reexecução
datada de 2026-10-05 no SHA corrigido) e `ADENDO-ETAPA2-2026-10-05.md`
(auditoria da obrigação 9, colisões medidas e política proposta).

### 10.1 Estado por obrigação

|obligação|resultado|onde está a prova|
|---|---|---|
|1 escopo fechado, sem alargar a ISA|cumprida — nenhum opcode novo entrou; a matriz só **recusa** explicitamente (`recusada`/`fronteira`)|`EXPECTATIONS-ETAPA2.md §0`, `fx09_matriz.rs` (17)|
|2 matriz autoral de chamadas/saltos/curtos/relativos|cumprida — `fx09_matriz_isa.s` montada pelo pipeline do instrumento pinado (`as -m68000` → `ld -Ttext 0 -e fx09` → `objdump -d` → `objcopy`), **14 linhas M1..M14**; `.short` só onde o montador não produz a forma (declarado linha a linha)|`EXPECTATIONS-ETAPA2.md §1`, `fx09_matriz.rs` (17), tabela "Efeito nos casos afetados" do adendo de 2026-10-04|
|3 defeitos de A incluídos (opcode trocado, extensão de sinal, BSR curto/palavra/variante)|cumprida — §1 congela a cobertura: **opcodes trocados** M8/M9 (e as linhas `jmp abs.w/.l = 4EFC/4EFD` de A refutadas por medida), **extensão de sinal** M4/M6/M12 sob a regra P-absW §1.1, **BSR curto/palavra/variante de CPU** M1/M2/M2b/M3. A linha M11 (`0a7c fc00`) era **defeito da ferramenta** (alegava `movea` com comprimento 6): encontrado pela matriz, corrigido por teste primeiro em `60e5914`|`fx09_matriz.rs`, `ADENDO-ETAPA2-2026-10-04.md` ("Defeito encontrado pela matriz")|
|4 revisar o SHA corrigido de A, sem tocar na worktree dela|cumprida — `cbb6895` revisto (R1..R13) e `bd40e92` (correção v1.1) **reexecutado** em 2026-10-05: 4× OK, série idêntica à congelada (18/18 linhas), falhas=0, rc=0. A worktree de A é somente-leitura e não foi editada|`REVISAO-C-DE-A.md §1..§6`|
|5 interface de consulta consumível por A|cumprida — `rex-cfg-sitio/v1` (`consultar`): região + raízes explícitas + um sítio → veredito estrutural, `consumidor-validado`, `promovivel-vinculo-estrutural`, `motivos`, `limites`|`consultar.rs` (22)|
|6 aparência de LEA/JSR em dado ou no interior não vira consumidor|cumprida com desvio de letra registrado — `fx10isca` tem seis expectativas duras **B1..B6**; B2/B3/B5/B6 estão presas por testes nomeados (`b2_…`, `b3_…`, `b3_a_word_4eb9_…`, `b5_raiz_declarada_…`, `b5_promocao_so_vem_de_raiz_que_autoriza_vinculo`, `b6_jmp_d16_pc_…`, `b6_ilha_sem_raiz_…`), e a exigência de **B4** (`consumidor-validado: "nao"` + motivo estrutural em cada sítio-isca) é verificada **dentro** desses testes, sem teste próprio com esse nome; e **B1 não tem teste próprio** (o vão integral da ilha é sustentado indiretamente pelo veredito `dentro-regiao-nao-alcancado` de B2 e pela coluna `alcance-vaos` do `medir`) — registrado como limite, não como cumprido por prova. No censo do Apêndice B: **16/16 não promovíveis**, 4/16 sem consumidor, **12/16 declaram consumidor estrutural** porque a codificação é uma forma de transferência real; o eixo que discrimina é a promoção, não a flag (§5 do adendo de 2026-10-05)|`consultar.rs` (22), `medir.rs` (16), `censo-iscas.redigido.json`, `ADENDO-ETAPA2-2026-10-05.md §5`|
|7 fixture assimétrica nova + amostra reservada, com denominadores próprios|cumprida — `fx11assimetrica` (raiz A 1 instrução + `bkpt` recusado; raiz B com 4 famílias de saída) e S1/S2 (10 sítios cada, 8 alinhados + 1 ímpar + 1 além do fim), sem **nenhuma** fração agregada entre raízes|`fx11_assimetrica.rs` (10), `medir.rs` (16), `s1/s2.redigido.json`|
|8 medições para D separando comprimento/operandos/fluxo/alcance|cumprida — `rex-cfg-med/v1` com as quatro dimensões de status próprio (`agregado: "proibido"`, `pendencia: []` em S1/S2) e o limite declarado dentro de cada JSON: paridade com objdump **não equivale** a observação em runtime|`medir.rs`, `ADENDO-ETAPA2-2026-10-04.md`|
|9 auditoria dos redigidos + política proposta|cumprida — `tests/auditoria_evidencia.rs` (19) sobre os 8 arquivos versionados; quatro colisões de §8 medidas e propostas de redação datadas; dois remédios reais (instrumento e veredito do comparador dentro do JSON; série bruta nos manifestos); pin obsoleto de `fx11assimetrica.s` corrigido e agora guardado por teste|`ADENDO-ETAPA2-2026-10-05.md`|

### 10.2 Gates da ETAPA 2 (executados nesta entrega)

| gate | resultado |
|---|---|
| `cargo test --offline` (crate `rex-cfg`) | **122/122 verdes**, 13 suítes: `auditoria_evidencia` 19, `medir` 16, `consultar` 22, `fx09_matriz` 17, `fx_fluxo` 15, `fx11_assimetrica` 10, `cli` 9, `export_json` 6, `calib_parity` 5, `historico_base` 3, unittests lib/main 0 |
| `cargo clippy --all-targets -- -D warnings` | limpo (situação real: o crate da frente não tem os defeitos do `src-tauri` que a memória de gates registra) |
| `cargo fmt -- --check` | limpo |
| `bash tools/make-fixtures.sh --check` | `OK: 13 corpus reproduziveis a partir das fontes .s (objdump + bytes identicos)` |
| `bash executar-evidencia-C.sh` (reexecução em `d4cb673`) | `FIM: divergencias criticas = 0`, `rc=0`, **tree limpo depois da reexecução** (E3 verificada por reprodução byte a byte) |
| `bash executar-amostras-reservadas-C.sh` (reexecução em `d4cb673`) | `FIM: divergencias criticas = 0`, `rc=0`, **tree limpo** |
| `npm run check:tree` (raiz do worktree) | `OK: Estrutura da raiz conforme docs/08_TREE_ARCHITECTURE.md` |
| `npm run lint`, `npx tsc --noEmit`, `npm test`, `cargo clippy/test` de `src-tauri`, `npm run host:diagnose`/`host:certify`, `security:audit` | **não executados** — a entrega é confinada a `scripts|docs|data/rex_profiles/parallel_recovery_20261004/c/` e não toca app, IPC, UI, toolchains nem dependências. Registrados como **não aprovados**, não como verdes |

### 10.3 Negativos discriminantes (o que o aceite pedia)

* Sítio **ímpar** `0x1C029` (S1) e `0x1C6BD` (S2) → `miolo-de-instrucao`, nunca
  `instrucao-de-bloco`: um scanner linear que "decode limpo" em desvio ímpar
  produziria consumidor fantasma (R2).
* Sítio além do fim `0x1C0A6` / `0x1C73A` → `fora-da-regiao`, com **zero**
  instruções decodificadas fora da região (R3).
* Interior de instrução: `0x31DCC` dentro de `0x31DCA` → `miolo-de-instrucao`,
  consumidor `nao` (Apêndice B, linha 7 do censo).
* `movea.l #imm,%a5` (`2A 7C`) em `0x3AB02`/`0x4F850` → consumidor `nao` com
  motivo `classe-condicional:movea` (a isca que parece `lea`/`jsr` não vira
  consumidor validado).
* Raiz `candidato` nunca promove vínculo: 12/16 iscas declaram consumidor
  estrutural e **0/16** são promovíveis — a promoção é o eixo que fecha a porta.

### 10.4 Evidência nova versus herdada

* **Herdada (ETAPA 1, intocada byte a byte):** `r1 = d97cde0a…`, `r2 = 524dd707…`,
  `r3 = c47f0f10…` — iguais em `0a5d917` e no corte atual; as isenções delas
  (`base-da-ferramenta`, `instrumento`, `veredito-do-comparador`, caminho do
  operador em 2 campos por arquivo) estão inventariadas por **igualdade exata**.
* **Nova (ETAPA 2):** `s1 = 110e5cda…`, `s2 = bb6db8ba…`,
  `censo-iscas = 6c446c29…`, `MANIFEST-ETAPA2.md`, mais o bloco de instrumento e a
  série bruta acrescentados ao `MANIFEST.md` (66 linhas novas, nenhum redigido da
  ETAPA 1 reescrito).
* ROM BYOR **não versionada**; identidade só por digest
  (`c7da53a1…`, 531 577 bytes) e conteúdo fora do índice.

### 10.5 Como consumir (integrador, frente A e frente D)

* **Frente A:** `rex-cfg consultar --bin <ROM|fixture> --region <ini,fim> --root
  <end> --root-prov <vocabulario> --site <endereco> --out <saida>` — um sítio por
  chamada; consuma `promovivel-vinculo-estrutural` e `motivos`, nunca a flag
  `consumidor-validado` como vínculo (ver `REVISAO-C-DE-A.md §6` e o adendo de
  2026-10-05 §5).
* **Frente D:** `rex-cfg medir` (`rex-cfg-med/v1`) — as quatro dimensões têm
  status próprio e `agregado: "proibido"`; não sume entre raízes (A4).
* **Integrador:** os JSONs usam identidade por SHA-256 (objeto, amostra,
  instrumento `e3a404cc…`/binutils 2.41); só os `MANIFEST*.md` citam caminho do
  operador, deliberadamente. A política proposta está em
  `ADENDO-ETAPA2-2026-10-05.md §8` — inclui E2 como teste de CI da frente C e a
  manutenção do Anexo A de ETAPA 1 no histórico sem reescrita. Nada foi mesclado,
  promovido ou liberado: PR **#108** permanece aberto, sem merge.


## 11. ETAPA 3 — consumo de `rex-cfg-sitio/v2` e `rex-cfg-med/v2` (2026-10-06)

Acrescentado sem reescrever §1..§10. Base recebida `8ea5821`; detalhes e séries brutas em
`ADENDO-ETAPA3-2026-10-05.md`, `CONTRACT-RETIFICACAO-ETAPA3-2026-10-05.md`,
`REVISAO-C-DE-A-ETAPA3.md`, `REVISAO-C-PARA-D-ETAPA3.md` e
`evidence/{MANIFEST-ETAPA3-v2.md,delta-etapa3-v2.md}`.

### 11.1 O que mudou e por quê

A ETAPA 1/2 publicava o operando de `(xxx).W` **zero-estendido** como alvo. A referência primária
(M68000PRM §2.2.16, p. impressa 2-18) diz que o endereço de 16 bits é **sign-estendido** a 32 bits.
Os campos v1 não são "ajustados": são **retificados com versão nova** (`rex-cfg-sitio/v2`,
`rex-cfg-med/v2`); os artefatos v1 ficam como histórico, protegidos por guard.

### 11.2 As quatro quantidades (campos novos)

| campo | significado | exemplo (`4eb8 8000`) |
|---|---|---|
| `operando-bruto` | a word de 16 bits como está no objeto; nenhuma interpretação | `0x008000` |
| `endereco-efetivo` | Q1 sign-estendido a 32 bits (PRM 2.2.16) | `0xFFFF8000` |
| `endereco-de-barramento` | Q2 & `0xFFFFFF` (bus de 24 bits do MC68000); **não** afirma mapa de memória do console | `0xFF8000` |
| `offset-de-objeto` | só existe com `--origin` declarado cobrindo Q2; senão `null` + `offset-de-objeto-status` | `null` / `fora-do-objeto` |

`alvo` passa a ser **Q2**. Acompanham o bloco: `modelo-de-cpu` (`mc68000`), `forma-do-operando`
(`abs-w`/`abs-l`/…), `semantica-do-operando` (`sign-estendida`) e `fonte-da-semantica`. Sem esses
campos o bloco é inválido. As strings `extensao-abs-w-hipotese-zero-extendida` e
`interpretacao-pendente:abs-w-bit15` **saíram** do objeto: uma interpretação pendente não pode mais
justificar um alvo; a interpretação está resolvida e a fonte vai junto.

### 11.3 Comando para A / qualquer consumidor (um sítio)

Fixture autoral `fx12_absW.bin` (34 bytes, sha `1f7929ab…`, sem ROM):

```
rex-cfg consultar --bin fixtures/fx12_absW.bin --origin 0x80000 --region 0x80000:0x80022 \
  --root 0x80000 --root-prov referencia-estatica --site 0x80000 --out sitio.json
```

Saída real (campos principais; o objeto completo tem também `bloco`, `instrucao-*`, `limites`):

```
"schema": "rex-cfg-sitio/v2",        "sitio": "0x080000",     "veredito": "instrucao-de-bloco",
"instrucao-classe": "jsr",           "alvo": "0xFFFF8000",     "alvo-status": "fora-da-regiao",
"operando-bruto": "0x008000",        "endereco-efetivo": "0xFFFF8000",
"endereco-de-barramento": "0xFF8000", "offset-de-objeto": null, "offset-de-objeto-status": "fora-do-objeto",
"modelo-de-cpu": "mc68000",          "forma-do-operando": "abs-w",
"semantica-do-operando": "sign-estendida", "fonte-da-semantica": "M68000PRM 2.2.16",
"consumidor-validado": "sim",        "promovivel-vinculo-estrutural": "sim",  "motivos": []
```

`consumidor-validado: sim` aqui significa *instrução comprovada e alvo comprovado sob a raiz
declarada*; o alvo está **fora da região**, o que é um grau separado (R-3.6). Quem barra a promoção
é a proveniência da raiz (`candidato` → `nao`). Não leia `consumidor-validado` como vínculo.

### 11.4 Comando para D (dimensões)

```
rex-cfg medir --bin fixtures/fx12_absW.bin --origin 0x80000 --region 0x80000:0x80022 \
  --root 0x80000 --root-prov referencia-estatica --out med.json
```

Saída real (`schema: rex-cfg-med/v2`): `comprimento-instrucoes-provadas = 5`
(`2=1`, `4=4`), `operandos-palavras-de-extensao = 4`, `operandos-valores-status = recusado`
(`md2:nenhum-byte-literal-do-objeto-no-export`), `fluxo-arestas = 9`
(`chamada/fora-da-regiao=4`, `queda/resolvido=4`, `retorno-fronteira/indireto-opaco=1`),
`alcance-bytes-decodificados = 18` de 34 (`0.5294`), `alcance-vaos = 1`, `agregado: "proibido"`.
A medição de D sobre a v2 é trabalho de D; a tabela de delta está em `REVISAO-C-PARA-D-ETAPA3.md`.

### 11.5 Estado medido e limites

* ETAPA 3 não mudou nenhum veredito das amostras da ROM: 110 linhas de delta, todas `invariante`,
  instruções idênticas (R1 66, R3 6, S1 8, S2 36) e `divergencias criticas = 0` contra o
  instrumento. Isso é consequência de as amostras **não terem** `abs.W` com bit15=1 (R-3.3), não
  prova de que a correção funciona: quem a prova são N1/N2 (`fx12_absW`) e o censo de máscaras
  (`divergencia-critica = 0`, 4 212 alvos confrontados).
* Cruzamento do consumidor de A com o binário v2: 10 cadeias + negativo de identidade,
  `fallos = 0` (`REVISAO-C-DE-A-ETAPA3.md` §4).
* Continuam fora de prova: execução, DMA, mapa de memória do console, `observado-em-runtime`.
* Gates de app (`lint`, `tsc`, `npm test`, `host:certify`) **não** foram executados: a entrega só
  toca `scripts/` e `docs/` da frente C e dados de evidência (precedente ETAPA 1/2).
