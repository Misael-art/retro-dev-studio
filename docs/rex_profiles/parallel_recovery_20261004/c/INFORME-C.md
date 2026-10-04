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
