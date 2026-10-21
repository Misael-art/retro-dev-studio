# Perfil `m68k.platformer_jump.v1`: localizar o pulo por assinatura e editar suas constantes — Experimental

Objetivo: o projeto entender e editar ROMs através de nodes, em ROMs diferentes, de forma amigável. Esta fatia entrega (1) o localizador por assinatura e (2) constantes editáveis sem crescer a ROM, testadas em **Sonic 1** e **Sonic Delta Reloaded**.

## O que existe
| Peça | Onde |
|---|---|
| Localizador genérico de padrões com capturas e retro-referência | `rex_sigscan.rs` (6 testes) |
| Perfil do pulo: 3 partes (impulso rotacionado, altura variável, teto), variantes, pareamento, plano de edição, IPS, grafo | `rex_platformer_jump.rs` (11 testes + 2 BYOR) |
| Adaptador IPC (localizar / gerar cópia + IPS, nunca sobrescreve, confere depois) | `rex_jump_ipc.rs` (4 testes), comandos `rex_jump_locate` / `rex_jump_edit` |
| Painel na aba Code do Reverse Workspace | `RexJumpLogicPanel.tsx` (6 testes) |
| Grafos NodeGraph gerados (1 no Sonic 1, 3 no Delta) | `data/.../grafos-gerados/`; vitest com o validador do editor |

## Resultado nas duas ROMs
| | Sonic 1 | Sonic Delta Reloaded |
|---|---|---|
| Instâncias | 1 (`0x1340C`, altura `0x13498`, teto `0x134C4`) | 3 (`0x16914`, `0x1732A`, `0x1A170`) |
| Layout de objeto lido das capturas | status `+0x22`, vy `+0x12`, flag `+0x3C` | status `+0x2A`, vy `+0x1A`, flag `+0x40` (confirmado em execução: o objeto em `$B000` responde) |
| Variantes encontradas | — | altura com desvio de palavra; prefixo de **forma super** (`imps`) |

**Efeito medido no core** (`genesis_plus_gx`, mesmo pulo, ROM original × editada; apice em px, `evidencia-perfil-pulo/perfil-pulo.json`):
- Sonic 1: `imp 0x680→0x900` segurando: **94→182**; `cut −0x400→−0x600` no toque: **34→81**.
- Delta, instância `0x16914` (a do Sonic): os mesmos números (94→182 e 34→81).
- Delta, instâncias `0x1732A` e `0x1A170`: editar `imp`/`cut` **não muda o Sonic** (são de outros personagens; quais, não identifiquei). Isso também prova que o pareamento isola as edições.

## Segurança da edição
Faixas por campo; recusa de no-op, de campo indisponível, de bytes antigos que não conferem; só imediatos de 16 bits existentes (a ROM nunca cresce); saída com `create_new` em pasta escolhida; releitura da cópia e re-localização; a ROM de entrada é rehashada no fim (`original_untouched`).

## Limites (não escondidos)
- A assinatura prova **forma + consistência de campos**, não que a rotina seja chamada em gameplay (o efeito foi medido no core só para o pulo do Sonic).
- Os padrões nasceram do Sonic 1; o Delta exigiu 2 variantes novas. Generalizar para outros jogos significa descobrir variantes, não só rodar.
- Pareamento altura↔pulo só quando mútuo: o pulo `0x1732A` ficou **sem** altura (campos de corte/teto não são oferecidos).
- `cap` (teto) e `imps` (forma super) foram verificados só estruturalmente e por patch, **não** em execução.
- A ROM do Delta vem do corpus local (hash registrado); não é ROM pinada do projeto.
- A UI roda no app real, mas fica numa coluna estreita (o painel é denso); a aba **Lógicas (pulo)** existe sem analisar a ROM antes.
- O grafo do canvas continua DESCRITIVO: editar um valor nele nunca altera a ROM sozinho; a ROM só muda quando você gera a cópia pela ponte (ver abaixo).
- Escopo Experimental; nada foi promovido.

## No app real (jornada desktop `jump-profile-journey`, 24/24, 2026-10-08)
Aba **Lógicas (pulo)** → informar a ROM → localizar → editar `imp` e `cut` → gerar. Rodou com **Sonic 1** (1 instância) e **Sonic Delta** (3 instâncias) no binário construído do HEAD (WebKit nativo, Xvfb isolado). Conferido no disco por leitor/aplicador independentes em JS: ROM original intacta, tamanho igual, só os imediatos pedidos mudaram (ver ADENDO de contagem de bytes ao fim), valores novos corretos, IPS (<64 bytes) reproduz a cópia, e repetir a geração é recusado (`output_exists_or_unwritable`). Evidência: `data/.../evidencia-perfil-pulo/report-jump-profile-journey.json` e capturas `app-*.png`.
Achado de usabilidade: a aba "Code" só existia depois de analisar a ROM (trace de emulador); o painel foi movido para uma aba própria sempre disponível.

## Canvas ↔ ROM (ponte), jornada desktop `jump-canvas-journey`, 24/24
Fluxo: Reverse > **Lógicas (pulo)** > localizar > **Abrir como nodes no editor** > editar o valor NO cartão do nó (`impulso_pulo`, `corte_altura`…) > painel **Ponte ROM ↔ nodes** lista `1664 → 2304` e `-1024 → -1536` ao vivo > **Gerar cópia + patch a partir do grafo**.
- O grafo gerado carrega a identidade da ROM (SHA-256), o valor original, a faixa segura e os offsets de cada constante; a ponte só envia as diferenças e o núcleo revalida (faixa, bytes antigos, **identidade**: se a ROM em disco não for a do grafo, recusa com `identity_mismatch` e não grava nada).
- Valor inválido digitado no nó (ex.: corte `5`, fora de `-32767..-1`) vira problema na ponte e bloqueia a geração; o campo **não corrige em silêncio**.
- "Abrir como nodes" nunca sobrescreve lógica própria da entidade (só substitui um grafo que já seja desta ponte).
- Conferido no disco (Sonic 1 e Sonic Delta): original intacta, tamanho igual, só os dois imediatos pedidos mudaram (ver ADENDO de contagem de bytes ao fim), valores novos corretos, IPS reproduz a cópia. Evidência: `evidencia-perfil-pulo/report-jump-canvas-journey.json` e `canvas-*.png`.
- Achado do app real: o cartão do nó só tinha campo editável para tipos específicos (o `var_set` era texto estático) e o campo numérico padrão não aceitava digitar negativos; foi criado `RomValueInput` (negativos, sem limitar).
Não rodei de novo as demais jornadas desktop com o editor alterado (`nodegraph-authoring`, layouts etc.); a suíte unitária do editor (999 testes) passa.

## ADENDO 2026-10-08 — contagem de bytes (correção; o texto acima foi ajustado, o histórico preservado)
Foram editados **dois imediatos de 16 bits** (4 bytes regravados). Nas corridas registradas (`imp` 1664→2304 e `cut` −1024→−1536), apenas **três bytes efetivamente diferem**:
`0x0680→0x0900` altera 2 bytes (`06→09`, `80→00`) e `0xFC00→0xFA00` altera 1 byte (`FC→FA`). Escrever "4 bytes mudaram" era impreciso: 4 é o espaço regravado, 3 é a diferença real.
A checagem do harness continua válida (nenhum byte fora dos imediatos pedidos). Para outros valores a contagem muda; o critério correto é "nenhum byte fora dos imediatos pedidos", não um número fixo.
