# Entrega ao integrador — MOVEA imediato, TRAP #15 e política de endereços v2 (2026-10-06)

Base preservada: `e54db1f`. Nenhum arquivo de dependência foi tocado (`package*.json`, `src-tauri`).
Sem expansão de ISA: nada novo entrou na lista fechada.

## 1. Casos mínimos: contrato atual × montador × resultado real

Montador: `m68k-elf-as -m68000` (binutils 2.41, pinado). Leitor: `objdump -b binary -m m68k -D`.
Resultado real: `rex-cfg analyze` com a **v1 reconstruída de `8ea5821`** e a **v2 (`e54db1f`)**, mesmos bytes,
região = arquivo inteiro, raiz `0x0`.

| fonte | bytes (montador) | contrato atual | v1 (`8ea5821`) | v2 (`e54db1f`) |
|---|---|---|---|---|
| `movea.w #4,%a5` | `3a7c 0004` (4 B) | MOVEA `.W` válido (retif. R-3) | `movea`, 4 B | `movea`, 4 B |
| `movea.l #4,%a5` | `2a7c 0000 0004` (6 B) | MOVEA `.L` válido | `movea`, 6 B | `movea`, 6 B |
| `movea.w #0x8000,%a0` | `307c 8000` (4 B) | MOVEA `.W` válido | `movea`, 4 B | `movea`, 4 B |
| `movea.b #4,%a0` | **montador recusa** (rc=1, `Unknown operator`) | MOVEA não tem `.B`; recusa | — | recusa (`e3_1_tamanho_byte_com_destino_an_e_recusado_e_nao_vira_movea`) |
| `trap #15` | `4e4f` (2 B) | `TRAP #n` → fronteira `trap-opaco` (CONTRACT §3, l. 193), 16 vetores | **fronteira `opcode-fora-do-subconjunto`** | `trap`, 2 B, fronteira `trap-opaco` |

Observação sobre `trap #16`: o montador o aceita com `Warning: expression out of range: defaulting to 0`,
isto é, gera `trap #0`. Não há 17º vetor; nada a modelar.

## 2. Divergência: houve uma, e já estava corrigida no `e54db1f`

* **MOVEA imediato**: sem divergência entre contrato, montador e resultado, nem na v1 nem na v2.
  A "descrição contratual errada" (`MOVEA.B`/`MOVE.W→An`) era só de redação e foi retificada em R-3.
* **TRAP #15**: a v1 usava máscara `0xFFF8` (vetor de 3 bits) e recusava `4E48..4E4F`. O contrato e o
  instrumento (que lê `trap #15` em 2 B) divergiam dela. Corrigido em `5b45931` (`0xFFF0`, vetor de 4 bits).
  Resultado antigo **superseded**, demonstrado por execução, não por texto:
  1. a tabela acima: mesmos bytes `4e4f`, v1 recusa e v2 lê `trap`;
  2. mutação: com a máscara antiga restaurada em `src/decode.rs:716`, o teste
     `r12_trap_tem_vetor_de_quatro_bits` **falha** (17 ok / 1 FAILED); com o código atual, 199 testes
     passam. O arquivo foi revertido e `git diff` está vazio.

Nada mais a corrigir neste ponto: não criei teste novo porque R12 (16 vetores, mnemônico com vetor real,
`Flow::Trap`) e `e3_1_*` já são discriminantes e a mutação provou isso.

## 3. Export v2 e política de endereços para A

**Como obter o objeto.** Crate `scripts/rex_profiles/parallel_recovery_20261004/c`, SHA `e54db1f`
(ou posterior na mesma branch `codex/rex-parallel-c-cfg`):

    cargo build --offline --bin rex-cfg        # produz target/debug/rex-cfg
    rex-cfg consultar --bin <obj> [--origin 0xN] --region 0xINI:0xFIM \
        --root 0xR --root-prov <vocab> --site 0xS --out sitio.json     # rex-cfg-sitio/v2
    rex-cfg medir ... --out med.json                                   # rex-cfg-med/v2

**Política (o que A deve ler e o que não deve concluir):**

1. Use `schema` para distinguir versão; **não misture** objetos v1 e v2 numa mesma comparação.
2. `alvo` = `endereco-efetivo` (32 bits). Para `abs.W`, é o operando **sign-estendido**
   (`0x8000 → 0xFFFF8000`), PRM §2.2.16. Nunca reconstrua o alvo a partir dos bytes zero-estendidos.
3. `operando-bruto` é a word como está no objeto. Só serve para auditar; não é endereço.
4. `endereco-de-barramento` = efetivo & `0xFFFFFF` (24 bits). **Não** é endereço de arquivo nem mapa do
   console.
5. `offset-de-objeto` só existe com `--origin` declarado cobrindo o efetivo. Ausente ⇒ `null` +
   `offset-de-objeto-status` (`fora-do-objeto`, `sem-operando-absoluto`). Não infira offset de ROM.
6. `alvo-status: fora-da-regiao` é grau **separado** de `promovivel-vinculo-estrutural`: a promoção é
   decidida pela proveniência da raiz (`candidato` ⇒ não).
7. `consumidor-validado: sim` ≠ vínculo ≠ runtime. Para `vinculo-estrutural`, consuma
   `promovivel-vinculo-estrutural` e `motivos`.
8. Os campos `modelo-de-cpu`, `forma-do-operando`, `semantica-do-operando`, `fonte-da-semantica` vêm no
   objeto para auditoria; se faltarem num bloco de endereço, trate o bloco como inválido.
9. Cadeia Kosinski de A: o cruzamento já medido (`REVISAO-C-DE-A-ETAPA3.md` §4) dá `fallos=0` com o
   binário v2, mas as 10 cadeias não exercitam `abs.W` com bit15=1. O pino `CFG_PIN` de
   `cruzar-rexcfg-A.sh` (binário de `275f2af`) é decisão de A repinar.

Exemplo real (fixture autoral `fx12_absW.bin`): ver `INFORME-C.md` §11.3.

## 4. Postura a partir daqui

Apoio dirigido: respondo a consultas de A/D/integrador sobre os campos acima, sem nova expansão de ISA e
sem tocar dependências compartilhadas. O bloqueio de CI (`npm run security:audit`) segue documentado como
externo e fora desta frente.
