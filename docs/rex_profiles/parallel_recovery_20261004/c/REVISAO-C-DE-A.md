# Revisão independente da ISA de A — `rex-kosinski-chain/v1` (2026-10-04)

Formato e regras congelados em `EXPECTATIONS-ETAPA2.md` §7 (7.1..7.6). Este
arquivo **não** edita a frente A, **não** promove nem rebaixa A: publica
divergências medidas com bytes, endereço, alegação citada, observação bruta,
classificação e consequência para a categoria `vinculo-estrutural`. A decisão de
merge/promoção é do integrador (7.6).

## 0. O que foi revisado e com quê

| item | valor |
|---|---|
| SHA revisado | `cbb6895567fe1f1e391c5b3b8dabf21580b78f6b` |
| estado publicado | head de `refs/heads/codex/rex-parallel-a-kosinski-chains` e head do PR #107 (`gh pr view 107 --json headRefOid` + `git ls-remote`, 2026-10-04) — **único SHA publicado** |
| citações | `arquivo:linha` no próprio SHA, obtidas por `git show cbb6895:<caminho>` / `git grep -n <s> cbb6895`; as cópias fetch em `~/rds-scratch/a-docs/a-src/` foram **conferidas byte a byte contra o blob do SHA** (`git show cbb6895:… \| sha256sum` == `sha256sum` da cópia) em `src/instr.rs` (`5eed0071c1ca0dfc…`), `tests/instr.rs` (`abbd315b78e1a9d5…`), `src/chain.rs` (`bc394e87799fb139…`) e `src/json.rs` (`4e151eafdbbb69e6…`) — as linhas citadas abaixo são válidas para o SHA publicado, não só para a cópia |
| instrumento (árbitro) | binutils 2.41 `m68k-elf-{as,ld,objdump}` pinado em `/home/misael/.cache/retrodevstudio/17f7bcf5…/source-build-m68k_gcc/source/install/bin` |
| fixtures autorais | `fx09_matriz_isa.bin` SHA-256 `b9f76bea893d690588f5803c7f6b393627dc223f2d864ed8f193c9a27c059924` (140 B); referência `fx09_matriz_isa-objdump.txt`; `fx10isca.bin` `fc892d2a…`; `fx11assimetrica.bin` `83d3b991…` |
| amostra reservada | ROM BYOR SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` (531 577 B) — **censo do Apêndice B de `EXPECTATIONS-ETAPA2.md`; nenhum byte versionado aqui** |
| minha ferramenta | `rex-cfg` sobre a base `cb56657`, com os commits desta entrega (`60e5914` matriz, `0ad61a6` verificador de sítios, `230ae94` fx11 + adendo) |
| worktree de A | somente-leitura; nada foi escrito em `/home/misael/RDS-REX-PARALLEL-A-2026-10-04` (7.3) |

Classificações: `DIVERGE` = a alegação de A não sobrevive ao instrumento;
`CONVERGE` = coincide; `INCONCLUSIVO` = a pergunta não é decidível com a fonte
disponível nesta sessão (7.4) — resultado publicável, não sucesso.

## 1. Tabela (7.1)

| # | bytes | endereço / fixture | esperado — alegação de A em `cbb6895` | observado — instrumento + `rex-cfg` | classificação | consequência para `vinculo-estrutural` |
|---|---|---|---|---|---|---|
| R1 | `4E FA 12 34` | `fx09` `0x44`; ROM: 1 ocorrência alinhada em `0x66A40` (ApB) | "`jsr (xxx).W` — `4E FA`": doc `src/instr.rs:27`, braço `0xFA =>` `src/instr.rs:147-152` lendo `be16(bytes[2..4])` como endereço; `tests/instr.rs:61` (`fa5_…`) fixa `4E FA 18 9C` → `JsrAbsW { alvo: 0x189C }` | `fx09_matriz_isa-objdump.txt:50` → `jmp %pc@(127a)` = **JMP (d16,PC)**, 4 B (modo %111 reg %010). `rex-cfg`: fronteira `indirect-opaque`, aresta `chamada/indireto-opaco` com `alvo: null`, `rederivar` devolve `None` para o sub-modo 2 do modo 7 (`tests/fx09_matriz.rs::m08_…`, `tests/consultar.rs::b6_…`; Adendo A-1/A-2) | **DIVERGE** (opcode **e** modo trocados) | `0x189C` não é endereço: é displacement lido como endereço. Todo vínculo derivado de um sítio `4E FA` tem alvo inventado → teto `candidato` nesses sítios |
| R2 | `4E FC` | `fx09` `0x4c`; ROM: 1 ocorrência em `0x31DCC`, que é o **2º word** de `subb %a4@(20220),%d2` em `0x31DCA` | "`jmp (xxx).W` — `4E FC`": doc `src/instr.rs:31`, braço `0xFC =>` `src/instr.rs:155-160`, comprimento 4 (`src/instr.rs:57`) | objdump `:55` → `.short 0x4efc` (o `as -m68000` recusa a forma); `rex-cfg`: fronteira `opcode-fora-do-subconjunto`, **sem nó**, zero arestas, zero `chamadas` (`m09a_…`) | **DIVERGE** | A consome 4 bytes onde o instrumento registra 2: em varredura linear desloca todos os sítios seguintes. O que A chama de `jmp abs.w` é interior de outra instrução — exatamente a classe de falso consumidor que a barreira desta frente mede |
| R3 | `4E FD` | `fx09` `0x52`; ROM: 0 ocorrências alinhadas (ApB) | "`jmp (xxx).L` — `4E FD`": doc `src/instr.rs:29`, braço `0xFD =>` `src/instr.rs:139-145`, comprimento 6 (`src/instr.rs:54`) | objdump `:60` → `.short 0x4efd`; recusa `-m68000`; `rex-cfg`: fronteira `opcode-fora-do-subconjunto` (`m09b_…`) | **DIVERGE** | como R2; e a forma legítima de 68000 é `4E F9` (R8) — `4E FD` é a extensão 68020 |
| R4 | `61 FF 00 00 12 34` | `fx09` `0x16` | "`bsr.l` toma `sitio + 4` porque a extensão ocupa seis bytes": doc `src/instr.rs:6` e `:23`, braço `src/instr.rs:116-120` (`sumar_relativo(sitio, 4, sign32(be32(bytes[2..6])))`), comprimento 6 (`:55`) | objdump `:25` → `bsrl 124c` = `0x16 + 2 + 0x1234` → base é **`instr + 2`** (A daria `0x124E`); além disso `61 FF` **não existe em 68000** (68020+): `rex-cfg` → fronteira `opcode-fora-do-subconjunto`, `blocos=0`, `arestas=0`, `chamadas=0`, nenhum alvo (`m03_…`) | **DIVERGE (duplo)** | (i) variante de CPU tratada como 68000; (ii) mesmo aceitando a forma, o alvo de A sai 2 bytes à frente. Um `vinculo-estrutural` de `bsr.l` aponta para a rotina errada por construção |
| R5 | `61 nn`, `nn ∉ {00, FF}`, endereço par | amostra reservada: **758** ocorrências (ApB, `EXPECTATIONS-ETAPA2.md:425`), ex. `0x5C2`, `0x11F0`, `0x1482` | nenhuma: o braço `b0 == 0x61` (`src/instr.rs:114-125`) só produz `BsrW` (exige 4 bytes) ou `BsrL` | sonda reexecutada nesta sessão na ROM BYOR pinada (`c7da53a1…`, §4 de `EXPECTATIONS-ETAPA2.md`): as três ocorrências citadas saem do instrumento como `bsrs` de **2 bytes**, alvos `0x5CA` / `0x11F4` / `0x148A` — ou seja, são instruções reais, não artefatos do padrão de varredura. Registo só com mnemônico e endereços; **nenhum byte da ROM é versionado aqui** (mesma regra do Apêndice B). `bsr.s` é instrução de **2 bytes** (`61 dd`, displacement de 8 bits) — família que a lista fechada desta frente também recusa, mas por escolha documentada (§3 do contrato), não por omissão não declarada | **DIVERGE** (forma real ausente do modelo) | 758 sítios candidatos a chamada que A não pode classificar; se A os ler como `bsr.w`, consome os 2 bytes seguintes como d16 → alvo espúrio + span perdido. Teto desses sítios: `candidato` |
| R6 | `4E B8 80 00` | `fx09` `0x20`; ROM: 3 ocorrências legítimas (`0x74EEC`, `0x77EFA`, `0x819DA`) | **não modelado**: o `match b1` de `b0 == 0x4E` (`src/instr.rs:128-161`) tem só os braços `B9/FD/FA/FC`; `4EB8` cai em `NonForma` (`src/instr.rs:166`) | objdump `:30` → `jsr ffff8000` — `JSR (xxx).W` legítimo, 4 B; `rex-cfg`: instrução provada de 4 B, `chamada` com `alvo` = operando **bruto** `0x008000`, status `fora-da-regiao`, fronteira `limite-de-regiao`, registro `interpretacao-pendente:abs-w-bit15` (`m04_…`; Adendo, seção P-absW) | **DIVERGE** (por omissão) | A refuta o falso positivo (R1) sem modelar o verdadeiro: nenhum `jsr abs.w` pode ser reivindicado por A hoje. Corrigir R1 exige ancorar JSR/`(xxx).W` em `4E B8` |
| R7 | `4E F8 80 00` | `fx09` `0x32`; ROM: 3 ocorrências (`0x4028A`, `0x4F606`, `0x50210`) | **não modelado** (mesmo `match` de R6) | objdump `:40` → `jmp ffff8000`, 4 B; `rex-cfg`: aresta `desvio/fora-da-regiao` **sem queda** (`m06_…`) | **DIVERGE** (por omissão) | como R6, para saltos |
| R8 | `4E F9 00 80 00 00` | `fx09` `0x3a` | **não modelado**: o `jmp (xxx).L` de A está ancorado em `4E FD` (`src/instr.rs:29`, `:139`) | objdump `:45` → `jmp 800000`, 6 B; `rex-cfg`: `desvio` com alvo `0x800000` idêntico ao instrumento (`m07_…`), e **sem** registro de pendência (a longword inteira é o operando) | **DIVERGE** (chave de opcode errada) | a forma legítima existe e A não a alcança; o que A alcança o instrumento recusa. `jmp.l` só é reivindicável ancorando em `4E F9` |
| R9 | `4E B9 00 00 00 88` | `fx09` `0x28`; ROM: `d88: 4eb9 0001c024 → jsr 0x1c024` (ApA) | "`jsr (xxx).L` — `4E B9`": doc `src/instr.rs:25`, braço `:131-137`, comprimento 6 (`:54`) | objdump `:35` → `jsr 88`; `rex-cfg`: `chamada/resolvido`, alvo `0x88` (`m05_…`) | **CONVERGE** | forma correta. Vínculo possível **desde que** a raiz que o alcança tenha proveniência que autorize vínculo (V2); nada aqui rebaixa A |
| R10 | `0A 7C FC 00` | `fx09` `0x62` | "`movea.l #imm32,An`: `0A?? FC` coa longa como extensión (**a detectar se existe**)" — `EXPECTATIONS-A.md` §3 (cópia fetch, linha 77) | objdump `:70` → `eoriw #-1024,%sr` (bitop, destino SR, 4 B). A detecção pedida foi feita: `movea` imediato **existe** e mede `2A 7C` — objdump `:65` → `moveal #305419896,%a5` (6 B), e 2 ocorrências na amostra (`0x3AB02`, `0x4F850`). `rex-cfg` após a correção M11: fronteira `opcode-fora-do-subconjunto`, `blocos=0`, `arestas=0`, `fronteiras=1`, cobertura `0/140`; **antes** da correção, a ferramenta publicava comprimento 6 inventado e engolia o `nop` seguinte (Adendo, seção de defeito) | **DIVERGE** | rotular `0A??FC` de `movea` é erro de opcode; e o `movea` verdadeiro (`2A7C`) **não é consumidor** — nenhum alvo, nenhuma `chamada` (`m10_…`, Adendo A-7). Nada em A pode subir um vínculo a partir de `0A??FC` |
| R11 | `41 F8 80 00` | `fx09` `0x6a` | "`lea (xxx).W,An` — `4x F8` + palabra; extensión curta **cero-extendida**": doc `src/instr.rs:17`, código `:94-103`, comentário `:98` "cero-extendida, NUNCA con signo"; teste `tests/instr.rs:86` (`fa7_…`) | objdump `:75` → `lea ffff8000 …,%a0`: comprimento 4 **coincide**, e o instrumento **exibe** com extensão de sinal. A escolha zero × sinal no barramento de 24 bits **não** foi resolvida por fonte primária nesta sessão (7.4) | **INCONCLUSIVO** (semântica da extensão) / **CONVERGE** (comprimento; operando = word) | A afirma zero-extensão como fato; publico-a como **hipótese**. `rex-cfg` declara `extensao-abs-w-hipotese-zero-extendida` em `limites` e registra `interpretacao-pendente:abs-w-bit15`. Vínculo cujo alvo dependa de bit15=1 num `(xxx).W` **não é adjudicável** por esta revisão |
| R12 | `41 FA FF BE` | `fx09` `0x72` | "`lea (d16,PC),An` — `4x FA` + d16 con signo, base `sitio + 2`": doc `src/instr.rs:19`, código `:104-111` | objdump `:80` → `lea %pc@(32 <m06>),%a0` = `0x72 + 2 − 0x42` = `0x32`; `rex-cfg` `m13_…` devolve o mesmo valor | **CONVERGE** | a fórmula relativa de A coincide com o instrumento nesta linha; é o registro positivo da paridade (e a base certa que R4 deveria usar) |
| R13 | `61 00 00 80` / `61 00 FFF6` | `fx09` `0x06` / `0x0e` | "`bsr.w` — `61 dd` co `dd != FF`; alvo = `sitio + 2 + d16` signado": doc `src/instr.rs:21`, código `:121-125`, comprimento 4 (`:56`) | objdump `:15` → `bsrw 88` e `:20` → `bsrw 6` (laço); `rex-cfg`: aresta `chamada/resolvido` + `chamada` em `chamadas` (`m01_…`, `m02_…`, `m02b_…`; Adendo A-6) | **CONVERGE** | `bsr.w` está certo em A, inclusive no displacimento negativo — o problema é a família `bsr` **além** dele (R4/R5) |

## 2. Consequência agregada (7.6: declarada, não decidida)

Nove linhas `DIVERGE` (R1..R8 e R10; R3 pertence a duas classes) caem em quatro
classes, todas medidas acima:

1. **opcodes trocados** (R1, R2, R3, R8): as quatro chaves que A usa para
   `jsr.w`/`jmp.w`/`jmp.l` não são essas instruções em 68000. Consequência
   direta: um `vinculo-estrutural` que A publicou a partir de qualquer sítio
   `4E FA`/`4E FC`/`4E FD` está ancorado num par `(família, modo)` que o
   instrumento refuta, e o valor de `alvo` nesses sítios é um displacement lido
   como endereço.
2. **variantes de CPU / formas fora de 68000** (R3, R4): `61 FF`, `4E FC`,
   `4E FD` são extensões 68020; tratá-las como 68000 introduce comprimentos que
   deslocam toda leitura linear subsequente.
3. **cobertura faltante** (R5, R6, R7): `bsr.s` (758 sítios na amostra),
   `jsr (xxx).W` = `4E B8` (3 sítios legítimos) e `jmp (xxx).W` = `4E F8`
   (3 sítios) não estão no modelo. A refuta o falso positivo sem modelar o
   verdadeiro.
4. **rotulagem de forma que não existe** (R10): `0A?? FC` é bitop imediato com
   destino CCR/SR (`eoriw #-1024,%sr`), não `movea`; o `movea` imediato
   verdadeiro é `2A 7C` e **não é consumidor**. A classe não produz vínculo
   inventado — produz um rótulo de ISA errado, que é o que a matriz desta frente
   mede linha a linha.

O que **converge** também fica registrado: `4E B9` (R9), `lea d16(PC)` com base
`instr+2` (R12) e `bsr.w` incluindo displacimento negativo (R13). A correção de
R4 é, portanto, usar a base que A já usa corretamente em R12/R13.

Nenhuma categoria promovida nem rebaixada por esta revisão: ela declara as
divergências e o teto que cada uma impõe. Quem decide o que fazer com o
`vinculo-estrutural` já publicado em `cbb6895` é o integrador.

## 3. Estado local não publicado (observação, não adjudicação)

`git -C /home/misael/RDS-REX-PARALLEL-A-2026-10-04 log` mostra `73fe7b6`
avançando sobre `cbb6895` com `src/instr.rs` reescrito (262 linhas alteradas
entre os dois SHA em `src/instr.rs` + `tests/instr.rs`, `git diff --stat`). Em
`73fe7b6` lê-se, no mesmo arquivo:

```
src/instr.rs:51  /// `jmp (xxx).W` — `4E F8` (v1.1; o conxelado v1 dicía `4E FC`).
src/instr.rs:53  /// `jmp (d16,PC)` — `4E FA` (v1.1; o conxelado v1 chamáballe `jsr.w`).
```

Ou seja: **a correção das linhas R1/R2 já existe no trabalho local de A**, que
renumera a família para v1.1. Esse SHA **não está publicado** — `git ls-remote
origin refs/heads/codex/rex-parallel-a-kosinski-chains` devolve `cbb6895` e o PR
#107 mantém esse head. Pela regra 7.5, a coluna `estado-apos-correcao` só entra
com seção datada **depois** da publicação; até lá a tabela acima permanece a
revisão do que está publicado. Não adjudico linhas de um commit que o autor ainda
não publicou.

## 4. Limitações desta revisão

- L1: o árbitro é o **instrumento estático** pinado (binutils 2.41, `-m68000`).
  Paridade com objdump não equivale a observação em runtime; nada aqui afirma
  execução, e nada em A pode ser promovido a `observado-em-runtime` por esta
  tabela (obrigação 8, N2).
- L2: R11 é `INCONCLUSIVO` por ausência de fonte primária legível nesta sessão
  (M68000PRM), não por ambiguidade do fixture (7.4).
- L3: as contagens do censo (R5, R6, R7, R10) são do Apêndice B, obtidas por
  varredura da ROM BYOR local do operador. A ROM **não** é versionada nem
  dependência provisionável; o censo é reprodutível com o SHA-256 do arquivo e o
  método registrado (o pino por `dd … length=` foi descartado por produzir o hash
  da entrada vazia).
- L4: um defeito **meu** foi encontrado no caminho e corrigido por medição antes
  desta revisão ser publicada: o ramo op1-imediato do grupo %0000 aceitava
  destino modo 7 reg %100/%011 e inventava comprimento 6 (linha M11). A tabela
  R10 usa o resultado **depois** da correção; a série antes/depois está no
  `ADENDO-ETAPA2-2026-10-04.md`.
- L5: esta frente não tocou em produto, IPC, UI, registro, manifestos comuns,
  Memory Bank nem `ROUND_STATE`, e não editou a worktree nem os testes de A (7.3).

## 5. Reprodução

```
# suites desta frente: matriz ISA fx09 (17) + verificador de sitios (22) +
# fx11 assimetrico (10) + paridade calib (5) e fx_fluxo (15) + cli (9) +
# export_json (6) + historico_base (3) + 2 unittests vazios
cd scripts/rex_profiles/parallel_recovery_20261004/c
cargo test                 # 87 passed (11 suites)
cargo clippy --all-targets # No issues found
cargo fmt -- --check       # limpo

# série bruta de um sítio (exemplo R1 e R6)
./target/debug/rex-cfg consultar --bin fixtures/fx09_matriz_isa.bin --origin 0x0 \
  --region 0x0:0x8c --root 0x44 --root-prov candidato --site 0x44 --out s1.json
./target/debug/rex-cfg consultar --bin fixtures/fx09_matriz_isa.bin --origin 0x0 \
  --region 0x0:0x8c --root 0x20 --root-prov candidato --site 0x20 --out s2.json

# citações de A no SHA publicado (somente-leitura)
git -C /home/misael/RDS-REX-PARALLEL-A-2026-10-04 show \
  cbb6895:scripts/rex_profiles/parallel_recovery_20261004/a/src/instr.rs | sed -n '25,32p;128,166p'

# sonda R5 (ROM BYOR do operador; não é dependência provisionável nem vai para a árvore)
TC=/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin
ROM="$HOME/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin"
sha256sum "$ROM"   # c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb
for a in 0x5c2 0x11f0 0x1482; do
  "$TC/m68k-elf-objdump" -b binary -m m68k -D --start-address=$a \
      --stop-address=$(printf '0x%x' $((a + 8))) "$ROM" | grep -E '^ +[0-9a-f]+:'
done
```

Instrumento usado como referência: `fixtures/fx09_matriz_isa-objdump.txt`, gerado
pelo mesmo pipeline `tools/make-fixtures.sh` (montador pinado, `ld -Ttext 0 -e
fx09_matriz_isa`), e não editado à mão.

---

## 6. Reexecução no SHA corrigido de A — seção **datada 2026-10-05**, acrescentada (regra 7.5)

A tabela de §1 **não é reescrita**. Esta seção acrescenta a coluna
`estado-apos-correcao` por linha, sobre a mesma série bruta.

### 6.1 A publicação aconteceu

Em 2026-10-05, `git ls-remote origin refs/heads/codex/rex-parallel-a-kosinski-chains`
devolve `bd40e92269eb60b0df9b8ed0ddff561a0d19a4b3` e `gh pr view 107 --json
headRefOid` confirma o mesmo valor: **o head publicado avançou**. São 10 commits
sobre `cbb6895`, cujo primeiro par é a retificação (`09e5833` expectativas +
fixtures, `1344f4c` `fix … corrección v1.1 do subconxunto 68000`).

A linha §0 («**único SHA publicado**») media-se em 2026-10-04 e estava correta
naquele instante; ficou datada. Não a edite i aqui — registro a caducidade nesta
seção, que é o que 7.5 manda. O que §3 descrevia como «local não publicado»
(`73fe7b6`) é hoje público via `bd40e92`.

### 6.2 Método: execução, não leitura de código

Classificar `estado-apos-correcao` por leitura de fonte não prova comprimento nem
alvo. Esta frente extrai **o blob publicado** de A (`git show bd40e92:…/src/instr.rs`),
confere-o contra o pino SHA-256 `72096ce78c24351929f9b01824c17518dadebd4f4f3feb3525cb0de581eb1dbe`
e o executa num árbitro mínimo (o arquivo entra por `#[path]`; nada é
reimplementado e **nada toca a worktree de A**) sobre as 18 sondas da matriz
autoral `fx09_matriz_isa.bin`. Série completa em §6.3; script:

```
scripts/rex_profiles/parallel_recovery_20261004/c/tools/reexecutar-decodificador-A.sh
# medido 2026-10-05: 4x OK + "serie identica a congelada (18/18 linhas)", falhas=0, rc=0
```

### 6.3 `estado-apos-correcao` por linha (7.5)

| linha | observado em `bd40e92` (árbitro de execução) | árbitro (instrumento pinado) | estado-apos-correcao |
|---|---|---|---|
| R1 `4E FA 12 34` @0x44 | `jmp.pcd16 len=4 alvo=0x0000127a` | objdump `:50` `jmp %pc@(127a)` | **convergiu** — a forma é a real e o `0x189C` inventado desapareceu. `rex-cfg` continua a devolver `alvo: null` aqui: recusa `(d16,PC)` por estar fora do seu subconjunto fechado; as duas saídas são compatíveis quanto ao que importa (nenhum `jsr abs.w`, nenhum consumidor) |
| R2 `4E FC` @0x4c | `Recusa(indefinido-68000)` | objdump `:55` `.short 0x4efc` | **convergiu** — recusa explícita com motivo estável, em vez de consumir 4 bytes |
| R3 `4E FD` @0x52 | `Recusa(indefinido-68000)` | objdump `:60` `.short 0x4efd` | **convergiu** |
| R4 `61 FF 00 00 12 34` @0x16 | `Recusa(68020-non-declarado)` | objdump `:25` `bsrl 124c` (base `instr+2`); `as -m68000` recusa | **convergiu por recusa** — a base `sitio+4` some junto com a forma. Resíduo: se A modelar `61 FF` um dia, a base a discutir é `instr+2`, não `sitio+4` |
| R5 `61 nn` curto | `bsr.s len=2` em @0x00 (`alvo=0x00000004`), @0x5c2 (`0x5ca`), @0x11f0 (`0x11f4`), @0x1482 (`0x148a`) | fx09 `:7` `6102 bsrs 4`; censo ROM `:5c2→0x5ca`, `:11f0→0x11f4`, `:1482→0x148a` | **convergiu** — os 758 candidatos deixam de ser teto `candidato` por ausência de forma; comprimento 2 confirmado |
| R6 `4E B8 80 00` @0x20 | `jsr.w len=4 alvo=0xffff8000` | objdump `:30` `jsr ffff8000` | **convergiu** (forma + comprimento). O **valor** do alvo é agora divergência C↔A: ver §6.5 |
| R7 `4E F8 80 00` @0x32 | `jmp.w len=4 alvo=0xffff8000` | objdump `:40` `jmp ffff8000` | **convergiu**; mesmo resíduo de §6.5 |
| R8 `4E F9 00 80 00 00` @0x3a | `jmp.l len=6 alvo=0x00800000` | objdump `:45` `jmp 800000` | **convergiu** — a chave saiu de `4E FD` e passou para a forma legítima |
| R9 `4E B9 … 0x88` @0x28 | `jsr.l len=6 alvo=0x00000088` | objdump `:35` `jsr 88` | **permanece** convergente |
| R10 `0A 7C FC 00` @0x62 | `NonForma` | objdump `:70` `eoriw #-1024,%sr` | **convergiu na rotulagem** — `0A??FC` nunca mais é chamado de `movea`. **Nova lacuna**: ver §6.4 |
| R11 `41 F8 80 00` @0x6a | `lea.w/A0 len=4 operando=0xffff8000` | objdump `:75` `lea ffff8000 …,%a0` | **convergiu na exibição**; a pergunta de 7.4 (semântica no barramento de 24 bits) continua **não resolvida**, e o §6.5 registra que as duas frentes ficaram **opostas** |
| R12 `41 FA FF BE` @0x72 | `lea.pcd16/A0 len=4 destino=0x00000032` | objdump `:80` `lea %pc@(32),%a0` | **permanece** convergente |
| R13 `61 00 00 80` / `61 00 FFF6` | `bsr.w len=4` → `0x88` / `0x06` | objdump `:15` `bsrw 88`, `:20` `bsrw 6` | **permanece** convergente, inclusive no displacement negativo |

Série bruta integral (18 linhas, idêntica à congelada no script):

```
0x0006 bsr.w     OK   bsr.w len=4 alvo=0x00000088 | 61 00 00 80
0x000e bsr.w-    OK   bsr.w len=4 alvo=0x00000006 | 61 00 ff f6
0x0016 61FF      ERR  Recusa(68020-non-declarado) | 61 ff 00 00 12 34
0x0020 4EB8      OK   jsr.w len=4 alvo=0xffff8000 | 4e b8 80 00
0x0028 4EB9      OK   jsr.l len=6 alvo=0x00000088 | 4e b9 00 00 00 88
0x0032 4EF8      OK   jmp.w len=4 alvo=0xffff8000 | 4e f8 80 00
0x003a 4EF9      OK   jmp.l len=6 alvo=0x00800000 | 4e f9 00 80 00 00
0x0044 4EFA      OK   jmp.pcd16 len=4 alvo=0x0000127a | 4e fa 12 34
0x004c 4EFC      ERR  Recusa(indefinido-68000) | 4e fc 4e 71
0x0052 4EFD      ERR  Recusa(indefinido-68000) | 4e fd 4e 71
0x0058 2A7C      ERR  NonForma | 2a 7c 12 34 56 78
0x0062 0A7CFC    ERR  NonForma | 0a 7c fc 00
0x006a 41F8      OK   lea.w/A0 len=4 operando=0xffff8000 | 41 f8 80 00
0x0072 41FA      OK   lea.pcd16/A0 len=4 destino=0x00000032 | 41 fa ff be
0x0000 bsr.s-0   OK   bsr.s len=2 alvo=0x00000004 | 61 02
0x05c2 bsr.s-1   OK   bsr.s len=2 alvo=0x000005ca | 61 06
0x11f0 bsr.s-2   OK   bsr.s len=2 alvo=0x000011f4 | 61 02
0x1482 bsr.s-3   OK   bsr.s len=2 alvo=0x0000148a | 61 06
```

Nota de conteúdo: as três sondas `bsr.s-1..3` são padrões de ISA digitados à mão
(`61` + um displacement de 1 byte), não recorte da ROM; o que nelas coincide com a
ROM é o mnemônico e os endereços, que é exatamente o que Apêndice B permite
versionar. A sonda `bsr.s-0` vem do fixture autoral (`fx09` @0x00). A auditoria de
bytes comerciais da obrigação 9 (§8 de `EXPECTATIONS-ETAPA2.md`, E1..E6) é sobre os
JSONs redigidos de `data/…/c/evidence/` e não sobre esta tabela.

### 6.4 Nova divergência encontrada na reexecução (movea imediato)

- Alegação publicada: `RECTIFICACION-A.md:122` lista `2x 7C` (*movea #*) na tabela
  de recusas com motivo `fora-de-subconxunto`, e cita `fxA04_recusa-objdump.txt`
  como prova.
- A fonte do fixture citado (`fixtures/fxA04_recusa.s`) contém **só** `jmp (%a0)`,
  `jsr (%a2)`, `bra`, `beq`, `dbf` — nenhuma sonda `2x 7C`; os testes que pinam o
  motivo são `r11_indirectos_an_fora_de_subconxunto` (`tests/rectif.rs:144-163`) e
  `r18_andar_fx_a04_todos_recusados` (`:295-308`), sobre esses mesmos sítios.
- Observado (execução, @0x58, bytes `2a 7c 12 34 56 78`): `NonForma` — «os bytes
  non cumpren ningunha forma coñecida», sem motivo estável.
- Árbitro: objdump `:65` `moveal #305419896,%a5`, 6 bytes — forma 68000 legítima.
- Consequência para `vinculo-estrutural`: **nenhuma** — nos dois rótulos A não
  produz alvo, portanto não há falso consumidor aqui. O custo é outro: `NonForma`
  não distingue «não reconhecido» de «reconhecido e recusado por perfil», e não
  carrega comprimento; numa varredura linear, `2x 7C` fica sem span. A resposta
  desta frente ao mesmo byte é a fronteira `opcode-fora-do-subconjunto` **com o
  opcode registrado** e a cobertura medida (`m10_…`, Adendo A-7). Classifico como
  **lacuna de rotulagem**, não como defeito de vínculo.

### 6.5 Extensão de `(xxx).W`: as duas frentes ficaram opostas

`bd40e92` muda A de zero-extensão (§1 R11, `src/instr.rs:98` em `cbb6895`) para
**extensão de sinal afirmada como fato** (`src/instr.rs:33`, `:130-135`,
`:182`, `:206` — código executado: `alvo=0xffff8000`). Esta frente publica o
operando **bruto** `0x008000` sob a hipótese declarada
`extensao-abs-w-hipotese-zero-extendida` (`src/sitio.rs`, `limites`), com
`interpretacao-pendente:abs-w-bit15`.

Peso das evidências disponíveis nesta sessão, declarado sem autoproteção: as duas
que existem apontam para extensão de sinal — a exibição do instrumento
(`jsr/jmp/lea ffff8000`) e a leitura de A. Minha hipótese é a menos suportada por
elas. **Não a inverto aqui**: invertê-la sem fonte primária seria trocar uma
hipótese por outra para alinhar-me ao instrumento, e a regra da rodada proíbe
ajustar expectativas para acomodar resultados. Fica como item de ETAPA 3 com fonte
primária (M68000PRM, extensão de endereço absoluto curto), e a exposição do erro é
limitada por desenho: nenhum veredito de sítio, `consumidor` ou `rederivar` desta
frente depende do bit15 — a pendência é informativa e é computada **depois** do
veredito (§1.1; testes `pabsw_*`). Um vínculo cujo alvo dependa de bit15=1 num
`(xxx).W` **não é adjudicável entre as duas frentes** enquanto não houver fonte.

### 6.6 Consequência agregada depois da correção

Das 9 linhas `DIVERGE` de §1, **as 9 saem `convergiu`** na reexecução: R1, R2, R3,
R5, R6, R7, R8 por forma e comprimento; R4 por recusa estável (a base `sitio+4`
desaparece junto com a forma); R10 por rotulagem. As três linhas que já
convergiam (R9, R12, R13) permanecem, e R11 convergiu **na exibição** (a semântica
do bit15 segue pendente, §6.5). As quatro classes de defeito de §2 (opcodes
trocados, variantes de CPU, cobertura faltante, rotulagem) estão tratadas no SHA
corrigido por **recusa com motivo estável** ou por forma nova — e, no ponto que
importa para a aceitação desta frente, nenhum dos caminhos gera consumidor falso:
em `bd40e92` nenhum dos 18 sítios sondados devolve um alvo que o instrumento não
confirme na série que ele imprime. Sobram três resíduos medidos: a lacuna de
rotulagem de §6.4, a pendência semântica de §6.5, e o fato de `61 FF` continuar
sem base correta modelada (é recusado, não decodificado — o que para 68000 é a
saída certa).

Escopo que **não** readjudiquei: as consequências de §2 falam da evidência
publicada em `cbb6895` (cadeas com `vinculo-estrutural` ancorado nos opcodes
trocados). A reexecutou as 9 cadeas em v1.1 e declara conclusões mudadas com série
nova (`c6e9d22`, `paso 5`); esta revisão é de ISA e mede o decodificador, não as
cadeas — a conferência das conclusões novas de A é do integrador, não minha.

**Não atribuo a correção a esta revisão.** `RECTIFICACION-A.md` e o `fix` de A
estão commitados em 2026-10-04 entre 22:35 e 23:10; os commits desta frente que
produziram a matriz e o verificador são de 23:41 (`60e5914`, `0ad61a6`, `230ae94`)
e este arquivo ainda não estava publicado. É **convergência independente** de duas
freintes sobre o mesmo árbitro, e os timestamps são a prova.

### 6.7 Estado do consumo entre frentes (para o integrador)

- A consome `rex-cfg/v1` (`analyze`) **pinado no commit exato `275f2af`** e
  declara que o worktree de C tem WIP que **não** está no commit consumido
  (`EXPECTATIONS-CRUZAMENTO-REXCFG-A.md:10-22`) — protocolo correto: identidade
  por SHA, sem leitura de worktree alheia.
- A interface pedida pela obrigação 5 (`rex-cfg-sitio/v1`, `rex-cfg consultar`)
  **ainda não é consumida por A**: ela não existia em `275f2af`. Para consumi-la,
  A deve repinar para o SHA desta entrega e ler `veredito`, `consumidor`,
  `promotivel`, `motivos` e `rederivar` (contrato §2.1 de `CONTRACT.md`).
- O que mudei **depois** de `275f2af` em `rex-cfg/v1`: apenas recusa de destino
  em bitop imediato (M11, `60e5914`) e a lista `limites` de **`consultar`**
  (`0ad61a6`); `analyze` mantém `limites` intactos, para não invalidar a evidência
  publicada de ETAPA 1 (PR #108). Ainda assim, qualquer reexecução de A deve
  repinar o binário: o comportamento em bitop imediato mudou.
- Observação, sem alegar violação: `bd40e92` acrescenta
  `scripts/…/a/verificar-sitios.py`. A regra do `AGENTS.md` veda Python no
  *runtime do app*, não em scripts de pesquisa; registro porque é uma superfície de
  execução nova em território compartilhado e a decisão de aceitá-la é do
  integrador.

