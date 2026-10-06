# RETIFICAÇÃO DE CONTRATO — ETAPA 3 (datada: 2026-10-05)

**Frente C · paralela · Experimental.** Retifica `CONTRACT.md` sem reescrever texto congelado:
nada aqui apaga, move ou reformula linha do contrato original. Cada cláusula retificada é
**cotada verbatim com o número de linha**, classificada quanto ao estado, e substituída pela
redação nova que passa a valer para os objetos `rex-cfg/v2`, `rex-cfg-sitio/v2` e
`rex-cfg-med/v2`. Expectativas que autorizam este documento: `EXPECTATIONS-ETAPA3.md` §1.1, §2,
§3 (E3-1, E3-2, E3-3) e §5, congeladas em `26b1908` **antes** de qualquer implementação ou medição
desta entrega.

Referências primárias usadas em todo o arquivo (SHA-256 registrados em
`EXPECTATIONS-ETAPA3.md`, Apêndice A):

- **M68000PRM** — Motorola *M68000 Family Programmer's Reference Manual* (NXP), 4 725 896 B,
  sha256 `06e4864b78da0e815054cead9324b7ec9914661f240fd39a455f2061ff47c4e8`.
- **MC68000UM** — Motorola/Freescale *M68000 8-/16-/32-bit Microprocessors User's Manual* (NXP),
  2 318 145 B, sha256 `89b690b1923f8a3cff508567090bcab0bcd07511c2deff8ffa393a08efda18e1`.
- **Instrumento pinado** — binutils 2.41 `m68k-elf-{as,ld,objdump}`,
  `as` sha256 `618740559477258165eb1a344e07acd592afc1438061825469d5bd56fa2c87c7`,
  `objdump` sha256 `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f`. As sondas
  citadas (S1, S2, S5, S7, S8, S10, S11, S12, V1) estão no Apêndice A das expectativas; a cópia
  integral da série está fora do índice (`~/rds-scratch/xe-c3-sondas/`), conforme a política de
  evidência §3.

## 1. Quadro-resumo

| # | linha retificada | cotação (início) | estado | substituto |
|---|---|---|---|---|
| R-1 | `CONTRACT.md:101-106` | "`limites` declara `extensao-abs-w-hipotese-zero-extendida`" | **ambos-errados** (descrição e valor exportado) | §1.2/Q1–Q4 das expectativas + três novos limites de §3.3 abaixo |
| R-2 | `CONTRACT.md:28-30` | "extensão fora da semântica 68000 (ex.: disp8 `0xFF` em Bcc/BSR/DBcc" | **descricao-contratual-errada** | redação R-2 |
| R-3 | `CONTRACT.md:156-158` | "`MOVE`/`MOVEA` .B/.W/.L entre modos 68000 válidos" | **descricao-contratual-errada** | redação R-3 |
| R-4 | `CONTRACT.md:166` | "`Scc` ea.Dn; `DBcc` Dn com disp8" | **descricao-contratual-errada** | redação R-4 |
| R-5 | `CONTRACT.md:67-71` | "Deslocamento relativo de Bcc/BSR/DBcc é sempre **relativo ao primeiro word de extensão" | **descricao-contratual-imprecisa** | redação R-5 |
| R-6 | regra V5 (`CONTRACT.md:135-138`) | "o parser da frente A recusa byte não-ASCII e qualquer escape" | **comportamento-implementado-errado** | tabela de rótulos old→new |

Nenhuma destas retificações **amplia o subconjunto de ISA** (§3 do contrato). As formas recusadas
continuam recusadas; o que muda é o valor do operando absoluto curto (R-1), a descrição de duas
famílias (R-2/R-3/R-4/R-5) e a grafia dos rótulos (R-6).

## 2. R-1 — `(xxx).W` não é "hipótese zero-estendida": é sign-estendida

Cotação original, `CONTRACT.md:101-106`:

> - `limites` declara `extensao-abs-w-hipotese-zero-extendida` (§1.1 P-absW): o
>   `alvo` de um `(xxx).W` é o **operando bruto** sob essa hipótese, que não foi
>   resolvida por fonte primária. Quando o word tem bit15 ligado, `motivos` traz
>   `interpretacao-pendente:abs-w-bit15` — registro informativo, calculado **depois**
>   de `consumidor-validado`, para que nenhuma classificação estrutural dependa da
>   interpretação. `(xxx).L` não recebe o registro (a longword inteira é o operando).

Estado: **ambos-errados**. A descrição (hipótese em aberto) e o valor publicado (`alvo` = a word
zero-estendida) estavam errados. Fonte primária, M68000PRM §2.2.16 *Absolute Short Addressing
Mode* (TOC p. 2-18), verbatim:

> "In this addressing mode, the operand is in memory, and the address of the operand is in the
> extension word. **The 16-bit address is sign-extended to 32 bits before it is used.**"

Sondas do Apêndice A que medem a consequência: S8 — os mesmos bytes `4eb8 8000` são exibidos pelo
instrumento como `jsr 0xffff8000`, enquanto `4eb8 7ffe` sai `jsr 0x7ffe`; S7 — `jsr (0xFFFF8000).w`
monta sem aviso (cabe como word **com sinal**) e `jsr (0xFF8000).w` produz
`Warning: expression doesn't fit in WORD`; S12 — `lea`/`move`/`movea`/`pea`/`jmp` com a word
`0x8000`/`0xFFFF` exibem `0xffff8000`/`0xffffffff`.

Substituto (vige para os três esquemas `*-v2`): as quatro quantidades separadas da expectativa
§1.2 — `operando-bruto` (Q1, a word tal qual está no objeto), `endereco-efetivo` (Q2, Q1
sign-estendida; **este** é o campo `alvo`), `endereco-de-barramento` (Q3, `Q2 & 0x00FFFFFF`,
MC68000UM §1.1 e §3 p. 3-3) e `offset-de-objeto` (+ `offset-de-objeto-status`), que **só existe**
quando a janela declarada por `--origin` cobre Q2. As duas strings
`extensao-abs-w-hipotese-zero-extendida` e `interpretacao-pendente:abs-w-bit15` saem do objeto
exportado; os artefatos v1 que as contêm ficam como históricos intocáveis (guard E2-1,
`tests/guarda_historico.rs`).

## 3. R-2 / R-4 / R-5 — as três famílias de desvio têm máscaras diferentes

### R-2

Cotação original, `CONTRACT.md:27-30`:

> 3. **Não continuar por comprimento inventado.** Opcode fora do subconjunto,
>    extensão fora da semântica 68000 (ex.: disp8 `0xFF` em Bcc/BSR/DBcc — forma
>    68020) ou instrução que atravessa o fim da região interrompem o caminho
>    naquele endereço; nenhum byte além da instrução comprovada é reclamado.

Estado: **descricao-contratual-errada**. O comportamento do decoder é correto: a recusa de
`disp8 = 0xFF` está em `src/decode.rs::decode_branch` e **não** se aplica a `DBcc`. Fonte primária,
M68000PRM §Bcc (p. 4-25): *"If the 8-bit displacement field in the instruction word is zero, a
16-bit displacement (the word immediately following the instruction) is used. If the 8-bit
displacement field in the instruction word is all ones (\$FF), the 32-bit displacement (long word
immediately following the instruction) is used"*, com *Attributes: Size = (Byte, Word, Long\*)* e a
nota *\*(MC68020, MC68030, and MC68040 only)*. §DBcc (p. 4-90) não tem campo de 8 bits: o formato é
`%0101 CONDITION 11 001 REGISTER` seguido de **16-BIT DISPLACEMENT**, *Attributes: Size = (Word)*.

Redação substituta: *"extensão fora da semântica 68000 (ex.: `disp8 = 0xFF` em **Bcc/BSR/BRA** —
seleciona a forma de 32 bits, que só existe em MC68020+)"*. `DBcc` sai da lista e passa a ser
descrito em R-4.

Negativo simétrico (E3-2): `tests/movea_dbcc_v2.rs::e3_2_a_recusa_de_disp8_ff_nao_se_aplica_a_dbcc`
aceita `51C8 11FF` como `dbf` com alvo `0x1215` (medido no instrumento) e recusa `67FF`,
`60FF`, `61FF 0000 1234`. Se a regra vazasse para `DBcc`, o teste falha.

### R-4

Cotação original, `CONTRACT.md:166`:

> - `Scc` ea.Dn; `DBcc` Dn com disp8 (disp8=0x00 → extensão word; 0xFF recusada).

Estado: **descricao-contratual-errada** — o `DBcc` implementado (`src/decode.rs:888-915`) já trata
o segundo word como deslocamento de palavra com sinal, base = palavra de instrução + 2, comprimento
fixo 4. Fonte primária: M68000PRM §DBcc (p. 4-90), *"execution continues at the location indicated
by the current value of the program counter plus the sign-extended 16-bit displacement. The value
in the program counter is the address of the instruction word of the DBcc instruction plus two"*;
Tabela 3-9 (p. 3-12) dá a coluna *Operand Size* de `DBcc`/`FDBcc` como **`16`**, enquanto
`Bcc`/`FBcc` e `BRA` levam `8, 16, 32`. Sondas S5: `dbf %d0,loop` (loop em `0x02`) monta
`51c8 fffc` (base `0x06`, disp `-4`) e `dbra %d0,longe` (longe em `0x266`) monta `51c8 025c`
(+604, **impossível** em disp8).

Redação substituta: *"`Scc` ea.Dn (2 bytes); `DBcc` Dn,<label> com **deslocamento de palavra com
sinal** — sempre 4 bytes, base = palavra de instrução + 2; não existe forma disp8 em `DBcc`"*.
Testes: `e3_2_dbcc_e_sempre_de_quatro_bytes_com_disp16_com_sinal` (cinco pares medidos, cada um
também asserado **contra** o valor que a base aposentada daria) e
`e3_2_dbcc_sem_word_de_displacamento_e_fronteira_truncada`.

### R-5

Cotação original, `CONTRACT.md:67-71`:

> - Regras de endereço: base 0 do `--bin` + `--origin`. Deslocamento relativo de
>   Bcc/BSR/DBcc é sempre **relativo ao primeiro word de extensão
>   (`endereço_da_instrução + 2`)**, semante 68000, independente do tamanho final
>   da instrução. Esta é a regra cujo erro histórico (base = fim da instrução)
>   os fixtures devem capturar.

Estado: **descricao-contratual-imprecisa** (a aritmética está certa; a nomeação não). Em `.S`
(`Bcc`/`BRA`/`BSR` de 2 bytes) **não há** word de extensão: a base é ainda `instrução + 2`, que é
o endereço da próxima instrução, e não "o primeiro word de extensão". Redação substituta: *"base 0
do `--bin` + `--origin`; o deslocamento relativo de `Bcc`/`BSR`/`BRA`/`DBcc` é tomado em
`endereço_da_instrução + 2` (MC68000PRM §Bcc p. 4-25 e §DBcc p. 4-90), independente do tamanho
final da instrução"*. A linha congelada contém ainda o erro de digitação `semante` (por `semântica`); ele fica
como está no texto congelado, e a redação substituta acima é a que vale.

## 4. R-3 — MOVEA: `.W` e `.L` somente; MOVEA.W é **válido**

Cotação original, `CONTRACT.md:156-158`:

> - `MOVE`/`MOVEA` .B/.W/.L entre modos 68000 válidos (registros, `(An)`,
>   `(An)+`, `-(An)`, `d16(An)`, `d8(An,Xn)`, `abs.W`, `abs.L`, `#imm` só em
>   MOVE); combinações inválidas (p. ex. MOVE.W → An) = fronteira.

Estado: **descricao-contratual-errada** em dois pontos, com o decoder correto nos dois:

1. `MOVEA` **não tem `.B`**. M68000PRM §MOVEA (p. 4-119): *"Attributes: Size = (Word, Long)"*;
   Tabela 3-2 *Data Movement Operation Format* (p. 3-6): *"`MOVEA  <ea>,An   16, 32 → 32`"*. Sondas S2 (montador pinado):
   `movea.b #4,%a0` é recusado com `Error: Unknown operator` **em `-m68000` e em `-m68020`**
   (rc=1); S10 mede as formas válidas: `movea.w #4,%a5` = `3a7c 0004` (4 B), `movea.l #4,%a5` =
   `2a7c 0000 0004` (6 B), `movea.w %a2,%a3` = `364a` (2 B, fonte registrada não tem extensão),
   `movea.w (0x1234).w,%a4` = `3878 04d2`.
2. O exemplo de "combinação inválida" dado pela cláusula — `MOVE.W → An` — **é** o `MOVEA.W`
   válido do item 1. A combinação inválida é **byte** com destino `An`: M68000PRM §MOVE (p. 4-118),
   nota de rodapé: *"\*For byte size operation, address register direct is not allowed."* Sonda
   S11: `move.b #4,%a0` é recusado pelo montador pinado com `Error: operands mismatch` (rc=1, nos
   dois `-m`). Bytes sintetizados: `1240` (seria `move.b %d0,%a1`) sai do instrumento como
   `.short 0x1240`; `127C 0004` sai como `moveb #4,%a1` — o instrumento **aceita** o que a
   referência proíbe, e a ferramenta recusa (classe `recusa-declarada` da auditoria §4).

Redação substituta: *"`MOVE` .B/.W/.L entre modos 68000 válidos; `MOVEA` apenas `.W`/`.L`
(PRM 4-119). Destino `An` com tamanho **byte** é inválido (PRM 4-118, nota do §MOVE) = fronteira.
Combinações com `An` em `.W`/`.L` são o próprio `MOVEA` e são válidas."*

Mudança de rótulo que acompanha a retificação (o comportamento de recusa não muda): o motivo
publicado era `MOVEA.B invalido` — nome de um mnemônico que a ISA não tem — e passa a ser
`MOVE/MOVEA de tamanho byte com destino An invalido (PRM 4-118/4-119)`, que nomeia as duas leituras
inválidas do mesmo par de bits. Sai do código o ramo inalcançável que produzia
`MOVE.B para An invalido` (inatingível porque `dmode == 1` retorna antes). Teste:
`e3_1_tamanho_byte_com_destino_an_e_recusado_e_nao_vira_movea` (três casos sintetizados por
`.word`:
`1240`, `127C 0004`, `1260`), com controle discriminante
`e3_1_move_byte_com_destino_dn_continua_valido` (`1000`, `1200`, `103C 0004` aceitos) e
`e3_1_movea_w_e_movea_l_sao_validas_com_os_comprimentos_medidos`.

## 5. R-6 — rótulos exportados violavam a regra V5 (byte não-ASCII)

A cláusula congelada (`CONTRACT.md:133-138`, §5/§6) diz: *"os três textos fixos de `limites` são
os do §6, gravados **sem acento** … A razão é a mesma da regra V5 de §5, que vale para todo objeto
emitido por `rex-cfg`: o parser da frente A recusa byte não-ASCII e qualquer escape."*

Estado: **comportamento-implementado-errado**. Dezoito rótulos de fronteira em `src/decode.rs`, um
texto de `limites` em `src/grafo.rs` e mensagens de `src/main.rs` levavam `—` (em-dash), `§`, `ã`
ou `ç`. Nenhum fixture da ETAPA 1/2 alcançava esses ramos, então a violação era invisível nos
testes: um sítio real cai correntemente neles (o mais comum é `JSR/JMP` indireto, que a própria ROM
em análise produz), e o objeto emitido seria ilegível para a frente A.

Rótulos alterados (old → new; só grafia, sentido idêntico):

| old | new |
|---|---|
| `grupo %1010 reservado — recusado` | `grupo %1010 reservado - recusado` |
| `grupo %1111 (coprocessador/reservado) — recusado` | idem, com `-` |
| `MOVEP (modo %001 medido em movepw/movepl) ou An-direto: fora da lista fechada §3` | `… fora da lista fechada (contrato 3)` |
| `%0000 100 (bchg/bset/clr/cmpl imediato, 68020) — recusado` | idem, com `-` |
| `op1 imediato com destino CCR/SR, PC ou reservado fora da lista §3` | `… fora da lista (contrato 3)` |
| `MOVE com fonte PC-relativo ou reservada (fora do contrato §3)` | `(fora do contrato 3)` |
| `JSR/JMP com alvo nao comprovado (indireto ou PC) — permanece desconhecido` | idem, com `-` |
| `BKPT (68010+) fora do subconjunto — recusado` | idem, com `-` |
| `PEA com An-direto fora da lista §3` | `… fora da lista (contrato 3)` |
| `EXT nao esta no subconjunto do contrato §3 — recusado` | `… do contrato 3 - recusado` |
| `desvio com disp8 = 0xFF: forma de extensao 68020 ambigua — comprimento nao comprovavel, caminho interrompido (CONTRACT §3; o instrumento le .S -1)` | `… (contrato 3; o instrumento le .S -1)` |
| `shift com tamanho %11 — recusado` | idem, com `-` |
| `shift/rotacao para memoria: o gas deste instrumento recusa montar, sem prova de comprimento — recusado` | idem, com `-` |
| `ROX.B nao existe no 68000 — recusado` | idem, com `-` |
| `operando PC-relativo ou reservado fora do subconjunto §3` | `… fora do subconjunto (contrato 3)` |
| `grupo de 2 operandos com tamanho %11 fora do subconjunto — recusado` | idem, com `-` |
| `grupo de 2 operandos reservado — recusado` | idem, com `-` |
| `forma ea->Dn com fonte imediata — invalido` | idem, com `-` |
| `sem propagação de pilha/registrador: graus de parametro sao sempre nao-inferidos` | `sem propagacao de …` |
| `proveniencia {…} fora do vocabulario (§1): …` | `… (contrato 1): …` |

Provas: `n_ascii_nenhum_texto_produzido_contem_byte_nao_ascii` (varredura das 65 536 palavras de
instrução possíveis, asserando que todo texto produzido — mnemônico, família ou motivo — é ASCII) e
`n_ascii_o_objeto_de_sitio_inteiro_e_ascii_em_ramos_nao_cobertos` (objeto completo de `consultar`
para `4ED0`, `67FF`, `1240`). O primeiro teste falhava com 13 438 palavras antes da correção, e a
reinserção de um único `§` num rótulo faz o guard pegar as 256 palavras daquela família
(verificação de não-vacuidade executada e registrada em `INFORME-C.md` §11).

Os textos de relatório em Markdown (`src/export.rs`, evidência humana) mantêm a grafia acentuada: a
regra V5 alcança **objeto emitido**, não relatório.

## 6. Versões e artefatos históricos

- Esquemas atuais: `rex-cfg/v2` (relatório de análise), `rex-cfg-sitio/v2` (despacho de sítio),
  `rex-cfg-med/v2` (medições). As mudanças de R-1 e R-6 são **incompatíveis** com v1 no sentido
  material: o valor de `alvo` para `(xxx).W` com bit15 muda e o vocabulário de `limites`/`motivos`
  muda. Por E2, os artefatos v1 publicados ficam como históricos byte-idênticos e o guard E2-1
  (`tests/guarda_historico.rs`) repele qualquer deriva — os oito digestos congelados estão listados
  lá e em `data/rex_profiles/parallel_recovery_20261004/c/evidence/MANIFEST-ETAPA2.md`.
- Nada neste documento altera: as proibições de §0, as assinaturas de `analyze`/`consultar`/`medir`,
  os códigos de saída, a lista fechada de §3 quanto ao **que** é suportado, nem as regras V1–V5 de
  promoção de evidência. A obrigação 4 da ETAPA 3 (revisar `consumidor-validado`) é tratada em
  `INFORME-C.md` §11, não aqui: com R-1 não existe mais interpretação pendente que pudesse
  sustentar um alvo errado, e as regras de promoção não precisaram de mudança de forma.
