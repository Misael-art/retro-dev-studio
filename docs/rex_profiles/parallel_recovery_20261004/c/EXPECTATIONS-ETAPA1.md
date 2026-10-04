# EXPECTATIONS — ETAPA 1 (frente C) — congeladas ANTES de implementar ou executar

**Data de congelamento:** 2026-10-04. **Base:** `cb56657`. **Contrato:** `CONTRACT.md` (mesma pasta).

Protocolo (memória do projeto `feedback-rex-freeze-expectations-precommit`): este arquivo
é commitado **sozinho**, antes de existir qualquer código ou execução da ferramenta.
Desvio entre esperado e medido = **FAIL/INCONCLUSIVO** com série bruta nos relatórios;
a expectativa nunca é reescrita depois da medição. Correções posteriores a um congelamento
exigem seção nova "Adendo datado" com o motivo e a evidência, preservando o texto original.

## 1. Fixtures (montados com `m68k-elf-as` binutils 2.41 do host; instrumento independente: `m68k-elf-objdump`)

Cada fixture é um `.s` autoral com `.org` declarando endereços; o JSON de expectativas
resolve rótulos via `m68k-elf-nm`. A ferramenta DEVE reproduzir, para cada instrução do
fixture alcançada, o **mesmo comprimento** (delta de endereço do objdump) e o **mesmo
alvo absoluto** que o objdump imprime. Divergência = FAIL.

| Fixture | Conteúdo obrigatório | Expectativa congelada |
|---|---|---|
| `fx01_branches` | `beq.s` adiante; `beq.w` adiante; `beq.w` negativo; `bra.w` para trás (laço); `bne.w` **com displacamento tal que base+2+disp ≠ base+4+disp** (discriminante do erro histórico); `dbra` curto e `dbra.w` negativo | cada aresta de desvio aponta exatamente o alvo do objdump; o alvo de `bne.w` **não** é o do computado com base no fim da instrução; caminho após `rts` termina sem arestas |
| `fx02_extended` | `bcc.s` com disp8=0 (forma extensão word); opcode com disp8=`0xFF` (forma 68020) | disp8=0 resolve pela extensão word com base instr+2; disp8=0xFF produz `ponto-de-fronteira(tipo=opcode-fora-do-subconjunto)` **sem** continuar por comprimento inventado |
| `fx03_dbcc` | laço `dbra Dn,-neg` e `dbcc.s` (condição F) com extensão; um `dbra.w` | duas arestas por DBcc (taken → alvo instr+2+disp; queda → instr+len); alvos iguais aos do objdump |
| `fx04_calls` | `bsr.w`→subrotina com `rts`; `jsr.abs.L`→rotina; `jsr.abs.W` | arestas `chamada` com `alvo resolvido`; continuação pós-chamada analisada; `rts` termina o caminho sem aresta de volta inventada; subrotina vira bloco `dentro-de-fluxo` |
| `fx05_indirect` | `jmp (An)`; `jsr (d16,An)` | `ponto-de-fronteira(tipo=indirect-opaque)`; entrada em `chamadas` com `alvo=nulo`, `status=indireto-opaco`; **nenhum** alvo sugerido |
| `fx06_data_opcodes` | rotina que termina em `rts`; após o `rts`, `dc.w` de padrões que imitam `4EB9 abs.L`, `67xx`, `0800` | nenhum bloco cobre os bytes de dados; `cobertura.vaoes` inclui o span inteiro dos dados; sítio-query dentro dos dados = `dentro-regiao-nao-alcancado` (ou `fora` se a região parar no rts — conforme `--region` do teste) |
| `fx07_out_of_region` | `beq.w` cujo alvo está além de `--region` fim | aresta `desvio` com `status=fora-da-regiao`; nenhum byte fora da região decodificado; `fronteira` registrada no endereço da instrução de salto |
| `fx08_relative_base_historico` | sequência mínima com `bcc.w` e `dbra.w` de sinal negativo posicionados em endereço par tal que as duas fórmulas (base instr+2 vs base fim) divergem em 2 | alvo da ferramenta == objdump == instr+2+disp; o valor que a fórmula errada produziria é **explicitamente** registrado como NÃO-produzido no teste |

Unidades adicionais (sem montagem): a fórmula de alvo é testada contra
`rex-gameplay::m68k::decode` nas formas comuns aos dois subconjuntos — comprimento e
alvo idênticos; divergência = FAIL. Round-trip interno próprio não conta como prova.

## 2. Análise de ROM (BYOR, somente-leitura; ROM não é versionada)

**Objeto:** `Sonic the Hedgehog (USA, Europe).bin`, SHA-256
`c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531 577 bytes
(caminho local declarado no relatório; origem imutável BYOR).

### R1 — descompressor Kosinski, região `[0x189C, 0x193C)` (relaciona-se às cadeias existentes)

Raiz: `0x189C`, proveniência `referencia-estatica` (três sítios `bsr.w $0189C` medidos
pela FASE6 de `rex_corpus_a`: `0x01364`, `0x03082`, `0x051BC`; rotina de 160 bytes com
SHA próprio idêntico byte a byte à rotina da imagem reservada).

Pinos (conferidos antes do congelamento por `xxd`+`sha256sum`):

- 160 bytes em `0x189C`: `e8028514cfa2b24f49cd07ee523af573b7cb404b62cf45ff9484a69090b26f90`
  (= pino FASE6; região **byte a byte** igual à referência independente).

Expectativas R1:

1. Cobertura **160/160** bytes; zero fronteiras de opcode; zero arestas
   `fora-da-regiao`; terminador = `RTS` em `0x193A`.
2. **Tabela ouro manual** (disassembly byte a byte feito nesta sessão a partir do
   dump bruto acima, ANTES de existir qualquer código; 66 instruções, soma de
   comprimentos = 160): a ferramenta deve produzir instrução no mesmo endereço,
   com o mesmo comprimento e mesma família, em cada linha; o objdump em modo
   bruto (`m68k-elf-objdump -b binary -m m68k -D --start-address=0x189C
   --stop-address=0x193C`) é o desempate independente — divergência entre
   ferramenta e objdump = FAIL da ferramenta; divergência entre esta tabela e o
   objdump = INCONCLUSIVO com a série bruta das duas saídas preservada.
3. O `dbf` em `0x18AC` tem alvo tomado = `0x18BA` (base = instr+2; fórmula errada
   daria `0x18B8`). O `beq.w` em `0x1930` (`6700 FF76`) tem alvo `0x18AA`
   (errada daria `0x18A8`).
4. **66** instruções; 5 ocorrências de `DBcc` (em `0x18AC`, `0x18C8`, `0x18DC`,
   `0x18EE`, `0x1922`); ≥ 5 arestas de laço para trás; nenhuma chamada
   (rotina folha): `chamadas = []`.
5. O motor **avança além** da tabela manual da FASE6 (que abandonou o laço de
   deslocamento variável): se parar antes de 160/160, o motivo é registrado como
   fronteira e a expectativa 1 é marcada FAIL — não reinterpretada.

### R2 — fluxo de boot pelo vetor de reset, região `[0x206, 0x2A0)`

Raiz: `0x206`, proveniência `vetor-plataforma` (longo em `0x000004` = `0x00000206`,
lido e impresso no relatório; valor dos 8 primeiros bytes da ROM pinado pela
região). Pinos:

- 154 bytes da região `0x206..0x2A0`: `655f37340b1ebbd5aadeacdf1f64bd338686487c38d4eb6eba74ffaae1a965ba`
- vetor `0x000004..0x000008`: `00 00 02 06` (registrado no relatório com os 32 bytes da tabela).

Expectativas R2:

1. Primeira instrução em `0x206` = `4AB9 00A10008` (`tst.abs.L`, 6B); `bne.s` em
   `0x20C` com alvo `0x214`; `tst.abs.L` em `0x20E` (6B); `bne.w` em `0x214`
   (`667C`) com alvo **`0x292`** (base instr+2; fórmula histórica errada daria
   `0x294` — discriminante na ROM real).
2. `lea` em `0x218` (4B) e `movem` em `0x21C` (`4C9D 00E0`, 4B) decodificadas;
   a partir de `0x220` o caminho segue até a **primeira fronteira**, que DEVE
   ocorrer antes de `0x256` com tipo do vocabulário do contrato (a posição exata
   e o opcode observado são **registrados**, não prometidos — é o limite declarado).
3. No ramo tomado por `bne.w`: instrução em `0x292` com desvio para `0x300` ⇒
   aresta `desvio` `status=fora-da-regiao` + fronteira; nenhum byte ≥ `0x2A0`
   decodificado.
4. Cobertura R2 `bytes-decodificados` < 154 e `vaoes` não vazio (limite honesto).
5. Sítios de consulta `0x1364`, `0x3082`, `0x51BC`, `0x745DC`: veredito
   `fora-da-regiao` (região termina em `0x2A0`) — a pergunta de pertencimento é
   respondida **por região analisada**, e o relatório R2 declara expressamente
   que isso não diz nada sobre esses sítios fora desta região.

### R3 — sítio de chamada medido, região `[0x1364, 0x1380)` (acompanha R1)

Raiz: `0x1364`, proveniência `referencia-estatica` (sítio medido pela FASE6).
Pino: 28 bytes em `0x1364`:
`6f7028731c2c3ff6d69180595b492583947ab7040b76f488a9557701bc87d470`.

Expectativas R3 (da varredura bruta já registrada acima — `41F9 00072E7C` /
`43F9 00A00000` / `6100 052A` / `33FC 0000 00A1 1200` / `4E71…`):

1. Blocos alcançam `lea` (6B) em `0x1364`, `move.abs.L→D1` (6B) em `0x136A`,
   `bsr.w` em `0x1370` com alvo **`0x189C`** (base instr+2; a fórmula errada
   produziria `0x189E` — exatamente o erro registrado e corrigido pela FASE6);
   aresta `chamada` resolvida; a chamada NÃO atravessa a fronteira da região
   (alvo `0x189C ≥ 0x1380`): a aresta é `fora-da-regiao` com `alvo=0x189C`
   **declarado**, e o relatório R1 responde pela rotina.
2. Continuação pós-`bsr` decodifica `move.w #imm,d16(An)` (8B) e os `nop`s até o
   fim da região em `0x1380`; fronteira `limite-de-regiao` onde parar.
3. Vereditos de sítio em R3: `0x1364`→`instrucao-de-bloco`; `0x1366`,`0x1369`,
   `0x1372`,`0x1378`→`miolo-de-instrucao`; `0x1370`→`instrucao-de-bloco`
   (sítio de chamada); `0x137C`,`0x137E`→`instrucao-de-bloco`; `0x1380`→`fora-da-regiao`.
   Estes vereditos são a resposta operacional à motivação da missão: casamentos
   de varredura linear ali no meio de instrução são **dado relativo ao fluxo
   analisado**, não consumidores — e o relatório registra que a prova vale
   somente para o fluxo desta região, não para a imagem toda.

## 3. Meta-ritério da entrega

- Cada número citado nos relatórios deriva de saída da CLI commitada como
  evidência (`data/.../c/evidence/`), com SHA-256 do JSON e comando exato.
- Nenhum veredito sobe de nível (`candidato`→`consumido`, `referencia-estatica`→
  `observado`) em relatório algum.
- Inconclusivo permanece inconclusivo: regiões paradas ficam listadas com o
  byte/opcode bruto observado.
- A frente A recebe: vocabulário de sítio (§2 R3), CLI `--site`, e a regra de
  que pertencimento a fluxo analisado ≠ existência de consumo.

## Anexo A — Tabela ouro R1 (manual, congelada 2026-10-04, pré-código)

Bytes do dump bruto de `0x189C`. Formato: endereço | bytes | família | alvo tomado
(base = instr+2). `Q` = queda para o endereço da instrução seguinte; o grafo liga
Q e alvo por aresta própria.

| End | Bytes | Família | Tomado → |
|---|---|---|---|
| 189C | `558F` | SUBQ.B #2,(A7) | Q |
| 189E | `1F58 0001` | MOVE.B (A0)+,d16(A7) | Q |
| 18A2 | `1E98` | MOVE.B (A0)+,(A7) | Q |
| 18A4 | `3A17` | MOVE.W (A7),D5 | Q |
| 18A6 | `780F` | MOVEQ #15,D4 | Q |
| 18A8 | `E24D` | LSR.W #1,D5 | Q |
| 18AA | `40C6` | MOVE.W SR,D6 | Q |
| 18AC | `51CC 000C` | DBcc(F) D4,12 | 18BA |
| 18B0 | `1F58 0001` | MOVE.B (A0)+,d16(A7) | Q |
| 18B4 | `1E98` | MOVE.B (A0)+,(A7) | Q |
| 18B6 | `3A17` | MOVE.W (A7),D5 | Q |
| 18B8 | `780F` | MOVEQ #15,D4 | Q |
| 18BA | `44C6` | NEG.W D6 | Q |
| 18BC | `6404` | BCC(hi) S | 18C2 |
| 18BE | `12D8` | MOVE.B (A0)+,D1 | Q |
| 18C0 | `60E6` | BRA S −26 | 18A8 |
| 18C2 | `7600` | MOVEQ #0,D3 | Q |
| 18C4 | `E24D` | LSR.W #1,D5 | Q |
| 18C6 | `40C6` | MOVE.W SR,D6 | Q |
| 18C8 | `51CC 000C` | DBcc(F) D4,12 | 18D6 |
| 18CC | `1F58 0001` | MOVE.B (A0)+,d16(A7) | Q |
| 18D0 | `1E98` | MOVE.B (A0)+,(A7) | Q |
| 18D2 | `3A17` | MOVE.W (A7),D5 | Q |
| 18D4 | `780F` | MOVEQ #15,D4 | Q |
| 18D6 | `44C6` | NEG.W D6 | Q |
| 18D8 | `652C` | BCS(LS) S | 1906 |
| 18DA | `E24D` | LSR.W #1,D5 | Q |
| 18DC | `51CC 000C` | DBcc(F) D4,12 | 18EA |
| 18E0 | `1F58 0001` | MOVE.B (A0)+,d16(A7) | Q |
| 18E4 | `1E98` | MOVE.B (A0)+,(A7) | Q |
| 18E6 | `3A17` | MOVE.W (A7),D5 | Q |
| 18E8 | `780F` | MOVEQ #15,D4 | Q |
| 18EA | `E353` | ASL/LSL reg-cnt (D3,D3) | Q |
| 18EC | `E24D` | LSR.W #1,D5 | Q |
| 18EE | `51CC 000C` | DBcc(F) D4,12 | 18FC |
| 18F2 | `1F58 0001` | MOVE.B (A0)+,d16(A7) | Q |
| 18F6 | `1E98` | MOVE.B (A0)+,(A7) | Q |
| 18F8 | `3A17` | MOVE.W (A7),D5 | Q |
| 18FA | `780F` | MOVEQ #15,D4 | Q |
| 18FC | `E353` | ASL/LSL reg-cnt (D3,D3) | Q |
| 18FE | `5243` | ADDQ.W #1,D3 | Q |
| 1900 | `74FF` | MOVEQ #−1,D2 | Q |
| 1902 | `1418` | MOVE.B (A0)+,D1 | Q |
| 1904 | `6016` | BRA S +22 | 191C |
| 1906 | `1018` | MOVE.B (A0)+,D0 | Q |
| 1908 | `1218` | MOVE.B (A0)+,D1 | Q |
| 190A | `74FF` | MOVEQ #−1,D2 | Q |
| 190C | `1401` | MOVE.B D1,D2 | Q |
| 190E | `EB4A` | ASL/LSL #5 (D2) | Q |
| 1910 | `1400` | MOVE.B D0,D2 | Q |
| 1912 | `0241 0007` | ANDI.W #7,D1 | Q |
| 1916 | `6710` | BEQ S | 1928 |
| 1918 | `1601` | MOVE.B D1,D3 | Q |
| 191A | `5243` | ADDQ.W #1,D3 | Q |
| 191C | `1031 2000` | MOVE.B (d8,A1,XD0),D0 | Q |
| 1920 | `1218` | MOVE.B (A0)+,D1 | Q |
| 1922 | `51CB FFF8` | DBcc(F) D3,−8 | 191C |
| 1926 | `6080` | BRA S −128 | 18AA |
| 192A | `1218` | MOVE.B (A0)+,D1 | Q |
| 192C | `670C` | BEQ S | 193A |
| 192E | `0C01 0001` | CMPI.B #1,D1 | Q |
| 1930 | `6700 FF76` | BEQ W −138 | 18AA |
| 1934 | `1601` | MOVE.B D1,D3 | Q |
| 1936 | `60E4` | BRA S −28 | 191C |
| 1938 | `548F` | ADDQ.B #2,(A7) | Q |
| 193A | `4E75` | RTS | fim |

Somas (verificadas à mão sobre a tabela, antes do commit): 66 instruções; 14
de 4 bytes (`189E, 18AC, 18B0, 18C8, 18CC, 18DC, 18E0, 18EE, 18F2, 1912, 191C,
1922, 192E, 1930`) e 52 de 2 bytes ⇒ 14×4 + 52×2 = **160 = tamanho exato da
região**; os endereços consecutivos fecham sem folga nem sobreposição. Se a
ferramenta ou o objdump divergirem desta tabela, o desempate é o objdump bruto
e a divergência fica registrada como FAIL/INCONCLUSIVO com as séries completas
das duas saídas — a tabela não se reescreve depois de medida.
