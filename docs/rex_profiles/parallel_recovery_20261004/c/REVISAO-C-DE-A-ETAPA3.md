# REVISÃO ETAPA 3 — C revê A corrigida (2026-10-06)

Base revisada: `bd40e92269eb60b0df9b8ed0ddff561a0d19a4b3` (PR #107, ISA v1.1). A worktree de A está em
`6ae4f02`, mas `instr.rs` tem **o mesmo sha-256 nos dois pontos**
(`72096ce78c24351929f9b01824c17518dadebd4f4f3feb3525cb0de581eb1dbe`), então as linhas abaixo valem
para ambos. A é somente-leitura: nada foi editado na frente dela, e nenhum código dela entra no
nosso crate (E7-4).

Referência primária: `M68000PRM.pdf` sha `06e4864b…` (extração `a36371ae…`), `MC68000UM` conforme
`EXPECTATIONS-ETAPA3.md` §1.1. Instrumento: `m68k-elf-objdump` 2.41 `-b binary -m m68k -D`.
Veredictos permitidos (E7-1): `confirmado-pela-referencia`, `divergente-da-referencia`,
`alegacao-de-instrumento-so`.

## 1. Veredito por ponto (E7-1)

| # | alegação de A | cotação `instr.rs` | veredito | base |
|---|---|---|---|---|
| 1 | `(xxx).W` sign-estende a 32 bits | l. 13-14 (doc), 134 (`lea`), 182 (`jsr`), 206 (`jmp`): `sign16(...) as u32` | **confirmado-pela-referencia** | PRM §2.2.16, p. impressa **2-18**: *"The 16-bit address is sign-extended to 32 bits before it is used."* O instrumento concorda (`4ef8 8000` → `jmp 0xffff8000`, medido nesta rodada). A cita a p. **2-17** em `RESPOSTA-D-A.md` §2: a página impressa é 2-18 (pdf p. 59). Erro de numeração, sem efeito semântico. |
| 1b | o campo `operando`/`alvo` de A carrega o efetivo | l. 134, 182, 206 | **confirmado, com ressalva de rótulo** | A guarda **um** número (Q2). Os dois nomes (`operando` em `LeaAbsW`, `alvo` em `JsrAbsW`) significam coisas diferentes para o mesmo valor, e a word de 16 bits (Q1) não é recuperável. Não é erro de ISA; é o que o contrato C separa em quatro campos (`operando-bruto`, `endereco-efetivo`, `endereco-de-barramento`, `offset-de-objeto`). |
| 2 | máscara de barramento `0xFF_FFFF` | l. 17-18 (doc), 24-27 (`BARRAMENTO`) | **confirmado-pela-referencia** | MC68000UM §1.1 / §3: bus de 24 bits (A23–A0). A mantém o efetivo de 32 bits e aplica a máscara só na camada de regiões, que é a mesma ordem de C (Q2 → Q3). |
| 3 | relativos usam base `sitio + 2` | l. 11-12 (doc), 35-47 (formas), 257-262 (`efectivo_relativo`) | **confirmado-pela-referencia** | PRM: o PC usado no cálculo é o endereço da palavra de extensão. `bne`/`bra`/`bsr`/`(d16,PC)` coincidem com o instrumento no corpus de §4 (4 212 comparações de alvo, `divergencia-critica = 0`). |
| 4a | `61 FF` recusado (`68020-non-declarado`) | l. 19-20 (doc), 148-153 | **confirmado-pela-referencia** | PRM: `BSR` com byte `$FF` é extensão 68020. O instrumento a lê como `bsrl 0x1de0` (medido): é **acordo de recusa** de nós dois contra o instrumento, que modela a família inteira. |
| 4b | `4E FC`/`4E FD` recusados (`indefinido-68000`) | l. 217-222 | **confirmado-pela-referencia** | EA `111/100` e `111/101` não existem para JMP/JSR no 68000. O comentário "o instrumento imprime `.short`" é **verdadeiro** (medido: `4efc → .short 0x4efc`; `4efd → .short 0x4efd`). |
| 4c | indiretos por registrador (`4E 90..9F`, `4E D0..DF`) recusados | l. 224-231 | **confirmado-pela-referencia**, com tratamento diferente | As formas existem no 68000. A as recusa (`fora-de-subconxunto`) sem consumir bytes; C as lê como `indirect-opaque` com comprimento provado e **sem alvo** (N6/fx13 `4E90 → consumo 2`). Ambos se recusam a nomear alvo. |
| 5 | `DBcc` recusado por máscara `50..5F` com `b1 & 0xC0 == 0xC0` | l. 20-22 (doc), 241-246 | **divergente-da-referencia** (rótulo; sem efeito de comportamento) | A máscara de A casa `Scc` **e** `DBcc`, e o comentário diz "DBcc". Medido: `50c0` = `st %d0` (Scc), `51c8 fffe` = `dbf %d0,0x14` (DBcc, `b1 & 0xF8 == 0xC8`). Como A recusa os dois, nenhum resultado muda; só a descrição está errada. |
| 6 | "perfil `md68000-chain16`: BSR com deslocamento de palavra" | l. 3-6 | **confirmado-pela-referencia** | PRM: BSR com byte de deslocamento `$00` usa palavra de 16 bits (válido no 68000); é o mesmo que C aceita e que A diferencia corretamente de `61 FF`. |

## 2. O que A tem de melhor (e C não)

A resolve `abs.W` por **três instrumentos** (binutils, wla, capstone). C resolve por referência
primária com o instrumento pinado só como confirmação, e **exporta** a fonte
(`fonte-da-semantica: "M68000PRM 2.2.16"`, `modelo-de-cpu`, `semantica-do-operando`) no objeto
(E7-2). A diferença é de método: um consumidor de C audita a fonte lendo o objeto; um consumidor de
A reconstrói a consistência entre três ferramentas. Nenhuma das duas substitui a outra, e nenhuma
é "mais correta": os pontos 1-4 convergem.

## 3. Reexecução do decodificador de A como árbitro externo (medido)

`tools/reexecutar-decodificador-A.sh` extrai o blob publicado (`git show bd40e92:…/instr.rs`), confere
o pino sha, compila um árbitro mínimo na cópia e roda as 18 sondas de `fx09_matriz_isa.bin`:

    OK instr.rs de A confere com o pino (72096ce7…)
    OK fx09 confere (b9f76bea…)
    OK serie identica a congelada em §7.5 (18/18 linhas)
    resumo: falhas=0

## 4. Cruzamento de A contra o binário v2 de C (E7-3, medido)

Cópia do `cruzar-rexcfg-A.sh` + `verificar-sitios.py` (`verificar-sitios.py` byte a byte idêntico ao de A; no
`cruzar-rexcfg-A.sh` só mudam as linhas `CFG=` e `CFG_PIN=`, que apontam para o binário v2), sobre as 10 cadeias v1.1 de A:

    OK-cadea sonic-3082 sonic-1364 sonic-51BC sor-16D2 sor-087FC sor-08842 sor-10636 sor-10852 sor-119B4 phelios-varredura
    OK   neg-identidade: rc=2 sen analizar (ABORT-IDENTIDADE …)
    TOTAIS fallos=0

**(i) permanece verde com o objeto v2**: as 10 cadeias (vereditos de sítio, contiguidade
`carga+6 = destino`, fronteira única, vãos vazios, raiz `referencia-estatica`) e o negativo de
identidade. O verificador de A consome `veredito`, `cobertura.vaos`, `raizes`, `fronteiras`, que
**não mudam de nome** no v2.

**(ii) pinos de A que apontam para v1 e são decisão dela** (reportado ao principal, não tocado):

* `cruzar-rexcfg-A.sh:2-8,12,13,25,49` — o pino é o binário de `275f2af` (`CFG_PIN=7daeb51d…`) e o
  texto diz `rex-cfg/v1`; o objeto agora se chama `rex-cfg/v2` (`schema`, não `esquema`).
* `verificar-sitios.py:2` — descreve consumo de `rex-cfg/v1`.
* Nenhuma das 10 cadeias de A contém `(xxx).W` com bit15=1 nesta janela, então a semântica nova
  **não é exercida** por esse cruzamento (R-3.3): "verde" significa *não regrediu*, não *provou o
  sinal*. Quem prova o sinal em C são N1/N2 (`fx12_absW`) e a tabela §2 abaixo.

## 5. Prova de não-cópia (E7-4)

Método, reproduzível:

1. `git show bd40e92:…/a/src/instr.rs` → 33 identificadores declarados com ≥ 4 caracteres (`fn`,
   `struct`, `enum`, `const`, variantes e campos tipados).
2. `git diff 8ea5821 HEAD -- …/c/src` → 566 linhas adicionadas (sem comentários).
3. Interseção de identificadores por palavra inteira: `alvo`, `bytes`, `destino`, `nome`,
   `operando`, `sitio` — vocabulário do domínio compartilhado (os três já existem no contrato
   desde a ETAPA 1). **Nenhum** identificador exclusivo de A (`Forma`, `LeaAbsW`, `JsrAbsW`,
   `sign16`, `be16`, `be32`, `BARRAMENTO`, `efectivo_relativo`, `InstrErro`, `decodificar`,
   `sitio_aliñado`…) aparece.
4. Interseção de janelas de 3 linhas normalizadas (sem espaços, ≥ 12 caracteres): **0**.

Declaração: nenhum trecho, nome exclusivo ou estrutura de `instr.rs` de A foi usado na
implementação de C. A extensão de sinal em C vem de PRM §2.2.16 e está decidida em
`EXPECTATIONS-ETAPA3.md` §1.1 (commit `26b1908`), congelada antes da implementação (`f033b3b`).
O método acima mede ausência de cópia textual; não prova que ninguém leu o arquivo de A.

## 6. Proibições (E7-5)

Esta entrega não promove `observado-em-runtime`, não toca `crates/rex-gameplay` (só o `path dep`
somente-leitura já existente), `src/`, `src-tauri/`, UI, registry, Memory Bank nem `ROUND_STATE`.
Os guards de histórico (`guarda_historico`) continuam verdes.

## 7. O que esta revisão NÃO afirma

Não afirma que A está "certa em tudo": só os seis pontos acima foram medidos. Não revalida as
**cadeias** de A (escopo do integrador). Não afirma execução em hardware nem comportamento de
runtime; equivalência com o instrumento é paridade de **decodificação**, não observação.
