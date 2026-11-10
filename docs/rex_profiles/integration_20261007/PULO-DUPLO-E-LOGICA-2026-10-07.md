# Pulo do Sonic 1 localizado, pulo duplo PROPOSTO (patch IPS) e lógica representada em nodes — Experimental

ROM pinada `c7da53a1…` (BYOR). Nada aqui foi integrado à UI do produto nem aplicado a ROM do repositório; o patch é um arquivo à parte.

## 1. O que foi LOCALIZADO (nos bytes da ROM, desmontados com o `m68k-elf-objdump` do toolchain)
| Parte | Endereço | Evidência |
|---|---|---|
| `Sonic_Control` (Obj01) e tabela de 4 modos (`status&6`) | `0x12C58`, tabela `0x12CC0` → `0x12E18/0x12E3C/0x12E66/0x12E86` | desmontagem; destinos calculados da tabela |
| `Sonic_Jump` (pulo no chão) | `0x133EA` (A/B/C = `andi.b #$70` em `$FFF603`; impulso `0x680`, `0x380` submerso) | assinatura `343C 0680` + desmontagem completa |
| `Sonic_JumpHeight` (altura variável, teto de subida) | `0x13498` | desmontagem |
| flag de pulo `$3C(a0)` | escrita `0x1344A` (=1), leitura `0x13498`, zera em `0x137E4` (ao pousar) | só 3 acessos em toda a rotina do Sonic (grep da desmontagem) |
| chamadas dos modos (Move, Roll, LevelBound, ObjectFall…) | endereços dos `bsr/jsr` no corpo de cada modo | desmontagem; **corpos não recuperados** |

Confirmação dinâmica no core `genesis_plus_gx` (GHZ1, posição inicial): os botões A, B e C disparam o pulo (flag `$3C`=1, `status` bit 1); o corte da altura ao soltar o botão reproduz o `-0x400` do `JumpHeight`.
Nomes de funções (`Sonic_Jump`…) são rótulos do disassembly público (dicas), **não** derivados dos bytes; os endereços, sim.

## 2. Pulo duplo — PROPOSTO, não é lógica original
`patches/sonic1-pulo-duplo.ips` (105 bytes; só código novo, sem bytes da ROM): troca `tst.b $3C(a0); beq.s` em `0x13498` por `jsr gancho` e acrescenta 70 bytes (+7 de alinhamento) ao fim da ROM (`0x81C80`).
Regra: `$3C` vale 0 no chão, 1 no primeiro pulo, **2 depois do pulo duplo**. No ar, com `$3C==1` e A/B/C pressionado neste quadro, `vy := -0x680` (`-0x380` submerso), `$3C := 2`, som do pulo; segue o corpo original de `JumpHeight`. Pousar zera `$3C`, o que rearma o pulo duplo sem RAM nova. Fonte do gancho: `scripts/.../pulo_duplo_hook.s` (montado com `m68k-elf-as`).

Verificação no core (`evidencia/pulo-duplo-core.json`, `scripts/.../testar_pulo_duplo.py`, mesmas entradas nas duas ROMs, botões A, B e C, toque e segurando):
| | ROM original | ROM com patch |
|---|---|---|
| flag `$3C` durante o ar | 1 | 1 → **2** no 2º toque |
| ápice (y mínimo; menor = mais alto) | 910 | **870** (toque) / **816** (segurando) |
| 3º toque no ar | — | flag continua 2: **sem pulo triplo** |
O IPS aplicado de forma independente reproduz exatamente a ROM testada (`patches/sonic1-pulo-duplo.json`, SHAs).

## 3. Representação em nodes (NodeGraph v1 do editor)
`data/rex_profiles/integration_20261007/grafos/`: `sonic1-logica-modos`, `sonic1-logica-pulo` (Jump + JumpHeight + reset), `sonic1-logica-pulo-duplo-proposto`. 72 nós / 75 arestas, só tipos já existentes (`event_update`, `input_pressed`, `condition_compare`, `flow_if`, `set_velocity`, `var_set`, `action_sound`, `fsm_state`, `rom_external_call`…).
Cada nó diz a **origem** (`recuperado do ROM` | `rotulo` | `PROPOSTO`), o endereço, os **bytes lidos** e o asm; o gerador recusa se o disassembly não contiver o esperado.
Checagens: `gerar_grafos_pulo.py` (conferência de asm), `verificar_grafos_pulo.py` (bytes × ROM, portas das arestas: PASS), `sonicLogicGraphs.test.ts` (o `deserializeNodeGraph` do produto mantém 100% dos nós/arestas; propostos nunca se misturam aos recuperados).

## 4. Limites (leia antes de aplicar)
- Os grafos são **descritivos**: o editor os aceita, mas **não foram abertos visualmente no editor** nem compilados; não são código a gerar. Corpos de `Sonic_Move/Roll/LevelBound/ObjectFall/…` NÃO foram recuperados (nós `rom_external_call`).
- `rex-gameplay` hoje só recupera o perfil fechado "contador+limiar"; o pulo usa formas M68000 fora desse subconjunto, por isso a representação foi montada por este trabalho, não pelo recuperador automático.
- O pulo duplo vale **só após um pulo normal** (`$3C==1`): não após quicar em inimigo, mola ou cair de uma borda. Testado só em GHZ1 (início), no core; **não** testado em hardware real, em outras fases nem com água/molas.
- A ROM cresce 77 bytes; o checksum do cabeçalho não foi recalculado (a ROM de teste já diverge do original e rodou no core).
- Patch e testes vivem fora do app; aplicar o IPS a uma cópia da ROM é decisão do operador. Edição de ROM pelo produto continua missão posterior.

## 5. Aberto no editor real e registrado (2026-10-08)
Cenário desktop `sonic-logic-graphs` (WebKit nativo, Xvfb isolado, binário construído do HEAD): cria o projeto **`Sonic1_Logica_Localizada_muytb97m`** (`/home/misael/Documents/RetroDevProjects/Sonic1_Logica_Localizada_muytb97m`, mantido), grava os 3 JSON em `graphs/` e carrega cada grafo na lógica da entidade pelo caminho do editor (`setEntityLogicGraph` + `persistScene`).
16/16 verificações: todos os nós aparecem, arestas desenhadas = arestas do arquivo (nós/arestas na tela = no arquivo: modos 33/32, pulo 27/30, pulo duplo 12/13), cena salva contém o grafo, **painel "Validador do grafo" sem erros**. Evidência: `data/rex_profiles/integration_20261007/evidencia-grafos/` (relatório, 3 capturas do editor, `SHA256SUMS`).
O editor real achou 3 classes de erro que meus testes iniciais não pegavam (aresta `int→bool`, nome de variável com `.`/espaço, valores não inteiros em `set_velocity`, som e animação inexistentes na cena); corrigi o gerador e o teste vitest agora usa o `validateNodeGraph` do produto.
Avisos que permanecem (informativos, não erros): saídas `transitions` dos estados dos modos sem destino (as transições reais dependem de bits de `status` não modelados) e a saída `false` da checagem de folga do pulo sem destino. O layout dos cartões é denso; "Organizar tudo" no editor reorganiza sem alterar a lógica.
