# Estudo UI/Produto - Proposta Consolidada De Interface - Nao Canonico

**Status:** Estudo interno, NAO CANONICO
**Data:** 2026-07-06
**Origem:** proposta tecnica de UI (v1) + ajustes de revisao (v2) aprovados pelo usuario como base de estudo.

As seções 0–13 preservam o estudo de julho. A [seção 14](#14-registro-histórico-de-design-e-experiência) reúne as direções, os protótipos, as revisões e as soluções registradas até 2026-11-05.

> Documento de estudo interno.
> Nao substitui a documentacao canonica do projeto.
> Nao altera a hierarquia de verdade definida em `docs/00_AI_DIRECTIVES.md` e `docs/06_AI_MEMORY_BANK.md`.
> Nao antecipa nenhuma decisao canonica: as secoes de "texto proposto" (secao 12) sao rascunhos para avaliacao humana futura e NAO devem ser tratadas como aprovadas nem aplicadas.
> Os status de maturidade citados espelham `docs/03_ROADMAP_MVP.md` na data de escrita; em conflito, roadmap e Memory Bank vencem.
> Nada aqui autoriza dependencia nova, superficie visivel sem linha na matriz do roadmap, nem promocao de maturidade.

---

## 0. Tese De Produto (Proposta)

Texto-base da tese (destino natural futuro: `docs/01_PRD_MASTER.md`, secao 1; ver secao 12.1):

> **Tese RetroDev Studio.** Um unico editor acompanha o usuario do primeiro jogo sem codigo ate o limite fisico do console - no mesmo shell, no mesmo projeto, com a mesma verdade de hardware. O centro do produto nao sao os workspaces: e o ciclo **criar -> testar -> diagnosticar -> exportar um jogo retro real**. Toda superficie existe para encurtar uma volta desse ciclo; o que nao serve ao ciclo e periferia.

Corolarios operacionais:

1. Nenhuma feature entra se nao reduzir tempo ou atrito de uma volta do ciclo.
2. Ninguem "se forma para fora" da ferramenta: subir de nivel nunca exige migrar de app (anti-padrao do nicho: GB Studio -> GBDK).
3. A verdade do hardware e a mesma em todos os niveis: o iniciante ve menos numeros, nunca numeros falsos.

Anti-metas explicitas (guarda-corpo contra "colecao de workspaces bonitos"):

- Nao e frontend de emulador.
- Nao e suite de editores de asset desconexos.
- Nao e browser de documentacao.

Metricas-norte que operacionalizam a tese:

| Metrica | Alvo |
|---|---|
| Tempo ate a primeira ROM jogavel (novato, sem docs externas) | <= 15 min |
| Loop interno editar -> ver rodando no emulador | medido e exposto na UI; meta de reducao continua |
| % de voltas do ciclo completadas sem sair do app | crescente por release |

---

## 1. Principio Central: Um So Shell, Espectro Continuo De Usuario

O shell atual (`src/App.tsx`) ja acerta o fundamental: o app e um editor cujo estado muda, nao um site com paginas. A proposta mantem as zonas existentes (topbar unificada, rail de workspaces, docking com `react-resizable-panels`, Command Palette, presets de layout, budgets de hardware na toolbar, status bar, Workspace Guide) e adiciona a ideia organizadora que falta: **o mesmo shell se revela progressivamente conforme o nivel do usuario**, em vez de existirem "modo iniciante" e "modo avancado" como produtos separados. O novato nunca ve um app diferente do avancado - ve o mesmo app com menos superficie exposta.

### 1.1 Zonas Do Shell (alvo)

```text
+------------------------------------------------------------------------------------+
| TOPBAR: [logo] projeto | alvo (perfil HW) | Novo | Abrir | Build & Run |           |
|         modo: Guiado | Criador | Pro | Hacker | busca | config                     |
+------------------------------------------------------------------------------------+
| RAIL POR DOMINIO:  core [Cena][Jogo][Explorer]                                     |
|                    autoria [Arte][Som (proposta)][Logica][FX exp]                  |
|                    avancado [Reversa exp (gated)][Debug]                           |
+------------------------------------------------------------------------------------+
| FAIXA DE ORCAMENTO DE HARDWARE: VRAM | sprites/linha | paletas | DMA (por perfil)  |
+---------------+---------------------------------------------+----------------------+
| DOCK ESQUERDO | PALCO CENTRAL                               | DOCK DIREITO         |
| Hierarquia /  | Cena / Jogo / Logica / Arte / FX / Reversa  | Inspector / Tools /  |
| Camadas       | (resolucao e limites vem do perfil de HW)   | Ajuda + diagnostico  |
|               |                                             | "por que travado?"   |
+---------------+---------------------------------------------+----------------------+
| STATUS BAR: build | emulacao | core ativo | console                                |
+------------------------------------------------------------------------------------+
```

### 1.2 O Que Ja Existe x O Que A Proposta Adiciona

Ja existe em codigo: topbar, rail (Scene/Game/Explorer/Logic/Art/FX/Debug), docking, Command Palette, editor de atalhos com deteccao de conflito, presets/salvamento de layout, budgets VRAM/scanline/paleta na toolbar, status bar, Workspace Guide, wizard de templates, diagnosticos acionaveis (`ActionableDiagnostic`).

A proposta adiciona quatro elementos de coesao:

1. **Seletor de modo/persona** na topbar (secao 2).
2. **Rail agrupado por dominio** (core / autoria / avancado) em vez de lista plana; inclui o workspace **Som** (novo, proposta) e promove **Reversa** de aba de Tools para workspace gated.
3. **Faixa de orcamento de hardware sempre visivel**, dirigida pelo perfil de hardware ativo.
4. **Diagnostico "por que travado?" como cidadao de primeira classe** no dock direito: todo bloqueio de build/budget aponta causa + acao, reutilizando o `ActionableDiagnostic` existente.

---

## 2. Personas E Progressao (Criterios Objetivos De Transicao)

Quatro niveis, uma escada continua. Cada nivel **adiciona** superficie; nunca esconde o que o nivel anterior aprendeu. O usuario escolhe onde entra e sobe quando quiser.

### 2.1 Os Quatro Niveis

| Nivel | Quem e | Objetivo | O que o shell revela | O que fica recolhido |
|---|---|---|---|---|
| **Guiado** | Nunca programou | "Quero um jogo jogavel hoje" | Wizard de template, Cena com arrastar-e-soltar, Play, ajuda inline | Logica por nodes, budgets crus, ferramentas de reversa |
| **Criador** | Faz jogos sem codigo | Jogo completo (levels, arte, som, gameplay) | + Arte/Som/Logica visual, Asset Browser, budgets simplificados | Profiler, parity, disassembly, ASM |
| **Pro** | Empurra o hardware | Efeitos modernos dentro do limite real | + RetroFX, budgets crus (scanline/DMA/VRAM), profiler, save states | Decompilacao/patch, editor de ROM |
| **Hacker** | ROM hack / decompilacao | Explorar, extrair, editar, portar ROMs | + Reverse Workspace, Memory/VRAM viewer, Patch Studio, parity | (tudo visivel) |

### 2.2 Regras Invariantes De Transicao

- Transicao e **sempre sugestao**, nunca troca automatica.
- Nunca ha rebaixamento automatico.
- Override manual sempre disponivel (seletor na topbar).
- "Nao sugerir novamente" e respeitado.
- Todos os contadores sao locais (editorStore + localStorage), zero rede - e sao **os mesmos contadores** das metricas locais de produto da fatia 1 (uma so fonte de verdade).

### 2.3 Gatilhos Objetivos (>= 2 de 3 por transicao)

| Transicao | Gatilhos objetivos | Momento da oferta |
|---|---|---|
| Guiado -> Criador | (a) 1a ROM buildada e rodada com sucesso; (b) 1o asset proprio importado e instanciado em cena; (c) cena editada, persistida e reaberta | Card unico pos-build bem-sucedido |
| Criador -> Pro | (a) >= 5 avisos de budget acumulados ou 1 build bloqueado por budget; (b) >= 10 nodes criados/editados no Logic; (c) diagnostico detalhado aberto >= 3x | No instante do aviso de budget ("quer ver as ferramentas Pro?") |
| Pro -> Hacker | (a) tentativa de abrir/importar ROM externa (BYOR); (b) clique em superficie gated (Reversa/Memory/VRAM); (c) uso do Asset Extractor | O proprio clique na superficie gated abre a oferta de ativacao |

### 2.4 Mecanismo De Disclosure

- **Gate declarativo por nivel** no Surface Registry (secao 7): cada superficie declara `minPersona` e `maturity`. Rail, Command Palette e menus filtram por isso.
- **Destravar contextual:** importar ROM oferece subir para Hacker; estourar budget oferece revelar RetroFX/profiler.
- **Nunca mente sobre maturidade:** superficie `Experimental` leva o mesmo rotulo em qualquer nivel.

---

## 3. Camada Agnostica: Expansao Para Novos Consoles

Leitura vertical da arquitetura de UI:

```text
[Guiado] -> [Criador] -> [Pro] -> [Hacker]        (niveis do usuario)
        \      |       |      /
         v     v       v     v
   [ Um shell - uma cena - um projeto ]
                   |
                   v
   [UGDM agnostico] -> [Perfil de HW] -> [Platform adapter] -> [Alvos: MD, SNES, +novos]
```

A UI **nunca hardcoda Mega Drive/SNES**. Ela le o perfil de hardware (VRAM, modelo de paleta, resolucao, sprites/scanline, DMA) e se molda: budgets da faixa, resolucao do palco, limites do Inspector, tudo deriva do perfil. Adicionar um console novo = registrar um perfil + adapter no backend; o shell se adapta sem reescrita. Coerente com o `Hardware Profile Engine` do PRD e com a regra do UGDM agnostico (proibicao de nomes de hardware no UGDM).

---

## 4. Dominios Na UI: Caminho Amigavel x Caminho Avancado

Para cada dominio, um caminho amigavel (Guiado/Criador) e um caminho avancado (Pro/Hacker) convivem no mesmo workspace, com rotulo honesto de maturidade.

| Dominio | Workspace | Caminho amigavel | Caminho avancado | Base atual (honesto) |
|---|---|---|---|---|
| Graficos/Sprites | Arte | Importar imagem -> auto-slice -> paleta sugerida (snap MD) | Editor de paleta, onion-skin, hitboxes por frame, comandos | `ArtStudioPanel`, `photo2sgdk` - **Experimental** |
| Levels/Mundo | Cena | Arrastar tiles/entidades, snap, camadas | Metasprites, streaming/residencia VRAM, colisao avancada | Scene/Layer/Inspector - **Em hardening** |
| Som/Musica | Som (novo agrupamento) | Soltar audio em `assets/audio`, tocar no playtest | Canais, XGM, orcamento de audio, eventos por cena | Import de audio existe; workspace dedicado e **proposta** |
| Gameplay/Logica | Logica | Receitas/nodes prontos (pular, mover, spawnar) | NodeGraph completo, FSM, `input_command`, codegen C <-> nodes | `NodeGraphEditor`, `nodeCompiler` - **Experimental** |
| Efeitos modernos | FX (RetroFX) | Presets de parallax/paleta | Raster, line-scroll, DMA timeline, scanline events | `RetroFXDesigner` - **Experimental (Local)** |
| Emulacao/Playtest | Jogo | Botao Play, rewind, save state | Frame-step, sync editor, performance overlay | Libretro FFI - **Em hardening** |
| Decompilacao / ROM hack | Reversa (gated Hacker) | Extrair assets, inspecionar ROM | Disassembly, anotacoes, parity, Patch Studio, IPS/BPS | Reverse Workspace **Experimental**; decomp pareada **so spikes, LLM bloqueado, atras de GO** (secao 8) |

---

## 5. Sistema De Layout Adaptativo (Com Criterios De Teste Por Resolucao)

### 5.1 Tres Densidades De Shell

Dirigidas por breakpoint do host, usando o `react-resizable-panels` ja aprovado (zero dependencia nova):

| Perfil | Faixa | Comportamento |
|---|---|---|
| **Compacto** | <= 1366 px / Steam Deck (1280x800) | Docks laterais viram drawers sobrepostos; rail vira icones; budgets colapsam em 1 chip "HW" com popover; alvos de toque >= 40 px |
| **Padrao** | ~1920 px | Layout de 3 colunas; densidade media |
| **Amplo/ultrawide** | >= 2560 px | Quarta coluna opcional (ex.: Console + Profiler lado a lado); densidade confortavel |

Complementos:

- **Modo Foco** (ja existe) esconde tudo menos o palco.
- **Toggle global de densidade** compacta/confortavel.
- **Layouts salvos por workspace E por perfil de resolucao** (evolucao do `LAYOUT_STORAGE_KEY`/presets em `src/core/workspaceLayout.ts`), para um host pequeno nao herdar layout de ultrawide.
- Afordancias de toque/gamepad no Steam Deck sao desejaveis, mas entram **marcadas como futuro/experimental** - nao prometidas como prontas.

### 5.2 Criterios De Teste Por Resolucao (asserts, nao so screenshots)

Estende o bloco H do QA-RC (que ja screenshota 1366x768 / 1920x1080 / 2560x1080) com 1280x800 e com asserts programaticos:

| Criterio (assert automatizavel) | 1280x800 | 1366x768 | 1920x1080 | 2560x1080 |
|---|---|---|---|---|
| Perfil de shell ativo | Compacto | Compacto | Padrao | Amplo |
| Chrome sem scroll horizontal (`scrollWidth <= viewport`) | Sim | Sim | Sim | Sim |
| Acoes primarias alcancaveis (visiveis ou overflow "..." funcional) | Sim | Sim | Sim | Sim |
| Alvo interativo minimo | 40 px | 24 px | 24 px | 24 px |
| Docks laterais | drawers | drawers | 3 colunas | 3-4 colunas |
| Drawers fechados -> palco ocupa largura total menos o rail | Sim | Sim | n/a | n/a |
| Foco visivel em tab-through (screenshot + assert de outline) | Sim | Sim | Sim | Sim |
| Texto computado >= 11 px | Sim | Sim | Sim | Sim |
| Smoke de interacao por workspace core | Sim | Sim | Sim | Sim |

Onde vive: extensao do proprio `scripts/e2e-tauri-build-run.mjs` (bloco H) + vitest de unidade para a logica de breakpoint. Regra herdada do projeto: cada perfil novo de resolucao reproduz localmente antes de entrar no CI.

---

## 6. Design System (WCAG 2.2 AA Como Meta Minima)

### 6.1 Fundamentos

- **Tokenizar a paleta Catppuccin** que hoje esta espalhada em hex literais no JSX (`#cba6f7`, `#a6e3a1`, ...) para variaveis CSS semanticas (`--accent`, `--success`, `--danger`, `--surface-*`, `--text-*`, `--focus-ring`). Destrava tema claro/escuro e temas alternativos sem tocar componente; pre-requisito de "moderna e flexivel".
- Dois pesos de fonte, sentence case, sem gradiente/sombra pesada: linguagem visual limpa e nativa de desktop.
- **i18n:** o produto e PT-BR hoje; extrair strings para catalogo prepara EN. Marcar como fase propria, nao embutir na fatia 1.

### 6.2 Meta De Acessibilidade

**WCAG 2.2 AA e barra minima para superficies Core MVP.** Superficies Experimental podem entrar com backlog A11y aberto, mas sem regredir as regras estruturais (foco, teclado, alvo). Mapeamento dos criterios 2.2 para o shell concreto:

| Criterio WCAG 2.2 | Nivel | Aplicacao concreta |
|---|---|---|
| 2.5.7 Movimentos de arrastar | AA | Toda interacao de drag ganha alternativa: splitters por teclado (verificar suporte da lib de paineis e cobrir com teste), pintura de tiles clique-a-clique, mover node selecionado por setas, conectar portas por menu, timeline do ArtStudio por botoes |
| 2.5.8 Alvo minimo 24x24 | AA | Auditar chips/icones interativos de 7-9 px atuais: crescer ou torna-los nao interativos |
| 2.4.11 Foco nao obscurecido | AA | Foco nunca escondido sob toolbar sticky/drawer; assert de intersecao no tab-through |
| 2.4.7 Foco visivel | AA | Token `--focus-ring` consistente nos dois temas (entra na tokenizacao da fatia 1) |
| 1.4.3 / 1.4.11 Contraste texto e nao-texto | AA | Validado na criacao dos tokens, nao depois |
| 3.2.6 Ajuda consistente | A | Workspace Guide/ajuda sempre no mesmo slot em todos os workspaces |
| 3.3.7 Entrada redundante | A | Wizard nunca re-pede dado ja fornecido (donor path etc. - ja parcialmente feito) |
| 4.1.2 Name/Role/Value | A | Padrao ARIA unico para docks, drawers e toolbars |

Nota de stack: `axe-core` automatizaria a auditoria, mas e **dependencia nova** - so entra com aprovacao humana e reflexo em `docs/02_TECH_STACK.md`. Ate la: checklist manual + asserts com testing-library existente.

---

## 7. Extensibilidade: Surface Registry E Hardware Profiles

### 7.1 Surface Registry (regra normativa proposta)

> Nenhuma superficie visivel entra no shell sem entrada no **Surface Registry** com `{ id, dominio, minPersona, maturity, capability, roadmapRef }`. O registry e o espelho em codigo da matriz de maturidade de `docs/03_ROADMAP_MVP.md`: **divergencia registry x matriz = falha de gate**.

Campos:

| Campo | Significado |
|---|---|
| `id` | Identificador unico da superficie (workspace, ferramenta, importador) |
| `dominio` | core / autoria / avancado (agrupa o rail e a Command Palette) |
| `minPersona` | Nivel minimo que ve a superficie (guiado/criador/pro/hacker) |
| `maturity` | Vocabulario controlado do roadmap (`Em codigo`, `Em hardening`, `Experimental`, `spike`, ...) |
| `capability` | Capacidade backend requerida (permite desabilitar com diagnostico acionavel quando faltar toolchain/core) |
| `roadmapRef` | Ancora da linha correspondente na matriz do roadmap |

Enforcement minimo (sem dependencia nova):

- Teste Vitest que **falha** se um workspace/ferramenta renderizavel nao tiver entrada no registry.
- Teste que compara `maturity` do registry com o status da linha correspondente da matriz (ancorado por `roadmapRef`).
- Efeito: converte a regra 3.1.3 de `docs/09_AGENT_DEV_MODE.md` ("nova superficie visivel -> linha na matriz") de disciplina documental em **gate executavel**. Superficie sem linha de maturidade honesta nao passa no baseline. Este e o mecanismo estrutural contra "colecao de workspaces bonitos".

Implementacao: evolucao do `WORKSPACE_ITEMS`/`EXECUTABLE_COMMAND_IDS` de `src/App.tsx` + `data/template_registry.json`; modulo TS + testes, sem dependencia nova. Adicionar feature = adicionar entrada + componente lazy, sem mexer no shell.

### 7.2 Hardware Profile Registry

A UI consome o perfil de hardware (o `Hardware Profile Engine` do PRD): budgets, resolucao do palco, modelo de paleta, limites do Inspector. Novo console = novo perfil + adapter no backend; a UI se adapta sem reescrita (secao 3).

### 7.3 Marketplace

O "Plugin Marketplace" do PRD (camada Enterprise) fica **explicitamente como futuro**; os dois registries acima sao seu embriao honesto, nada alem disso.

---

## 8. Decompilacao / LLM: Gated, Experimental/Spike, Dependente De GO Formal

Regra deste estudo, alinhada a `docs/12_DECOMPILACAO_PAREADA_PLANO.md` e ao roadmap:

- O workspace **Reversa** e desenhado nesta proposta, mas permanece `Experimental` e **gated para a persona Hacker**.
- A decompilacao pareada existe hoje apenas como **spikes** (paridade referencia/candidata, fingerprint M68K, build-duplo reproduzivel). **Scanner/ledger/LLM/UI nao estao implementados nem autorizados.**
- **LLM permanece BLOQUEADO** ate GO formal do usuario + reflexo em `docs/02_TECH_STACK.md`.
- Dependencias externas sao BYOR/BYOK e devem ser explicitadas na propria UI: Ghidra 11.x/12.x + JDK 21+, `m68k-elf-gcc` (toolchain SGDK), chaves de API por conta do usuario.
- No Surface Registry, essas superficies entram com `maturity: experimental/spike` e a UI **nunca** as anuncia como prontas.
- Compliance inalterada: BYOR e patches IPS/BPS; nenhuma distribuicao de ROM comercial.

---

## 9. Mapeamento Honesto: Existe Hoje x Proposta x Futuro

| Camada da proposta | Existe hoje | Proposta (refino, sem dep nova) | Futuro / gated |
|---|---|---|---|
| Shell/docking/topbar/palette/atalhos | Em codigo | Agrupar por dominio; tokenizar tema | - |
| Persona/disclosure | Parcial (badges `Exp.`, `EXECUTABLE_COMMAND_IDS`) | `minPersona` + `maturity` no registry, seletor de modo | Sugestoes automaticas de "subir de nivel" calibradas por metricas |
| Layout adaptativo | Presets + Focus + QA multi-resolucao (bloco H) | 3 densidades + drawers + layout por resolucao + asserts | Toque/gamepad no Steam Deck |
| Budgets de hardware | VRAM/scanline/paleta na toolbar | Faixa dedicada + "por que travado?" acionavel | Profiler visual profundo |
| Arte/Logica/FX/Reversa | Em codigo, Experimental | Ergonomia amigavel + rotulos honestos | Certificacao institucional para sair de Experimental |
| Som (workspace proprio) | Import de audio existe | Novo workspace de som/musica | Editor de canais/XGM completo |
| Decompilacao pareada | So spikes | UI do workspace Reversa desenhada | Scanner/ledger/LLM/UI atras de GO + aprovacao de stack |
| Multi-console | UGDM agnostico + perfis MD/SNES | UI 100% dirigida por perfil | Registrar novos consoles |
| Parity/Cycle Report | Abas Experimentais em Tools | Permanecem gated Pro/Hacker com rotulo | Criterio institucional de equivalencia |

---

## 10. Primeira Fatia V2 (Sem Dependencia Nova)

Escopo 100% frontend, stack aprovado, **zero dependencia nova**, sem antecipar fases do roadmap. Ordem:

1. **Tokens de tema** (Catppuccin -> variaveis semanticas, incl. `--focus-ring`, contraste AA validado na criacao).
2. **Surface Registry + rail por dominio** (com o teste de enforcement da secao 7.1).
3. **Seletor de persona** + contadores de transicao (secao 2.3).
4. **3 densidades de layout** + drawers no Compacto (secao 5).
5. **Estados vazios:** todo painel vazio ganha componente padrao com "o que e isto + 1 acao seguinte real" - zero becos sem saida.
6. **Autosave + recuperacao:** draft com debounce sobre o `scenePersistence` existente, badge "rascunho salvo", recovery pos-crash (draft ao lado do `project.rds`, nunca sobrescreve sem confirmacao).
7. **Undo/redo confiavel:** contrato "toda mutacao de cena passa pelo historico do store", teste que enumera os comandos cobertos, indicador na UI.
8. **Metricas locais de produto:** time-to-first-ROM, taxa de sucesso de build, violacoes de budget, uso por workspace - JSON local, sem rede, opt-out; alimentam as metricas-norte (secao 0) e os gatilhos de persona (secao 2.3).

Criterios de aceite da fatia:

- Novato: template -> ROM rodando em <= 15 min sem docs externas (medido pela metrica, nao por opiniao).
- Zero paineis vazios sem acao seguinte.
- Undo/redo cobre 100% das mutacoes de cena expostas na UI.
- Kill do app perde no maximo ~30 s de trabalho (recovery testado).
- Bloco H estendido verde nas 4 resolucoes; regras estruturais WCAG (foco/alvo/teclado) sem regressao.
- Gates padrao do projeto verdes (`check:tree`, lint, tsc, `npm test`, clippy, `cargo test --lib`).

---

## 11. Matriz Comparativa Com Ferramentas Reais

Valores: Sim / Parcial / Nao. A coluna RetroDev anota o status honesto de hoje.

| Capacidade | GB Studio | NESmaker | SGDK + VS Code | Tiled + Aseprite | Mesen2 / BlastEm | Ghidra + Flips | RetroDev (hoje -> meta) |
|---|---|---|---|---|---|---|---|
| Jogo sem codigo -> ROM real | Sim (GB) | Sim (NES) | Nao | Nao | Nao | Nao | Parcial Exp. -> Sim MD/SNES |
| Budgets de hardware ao vivo no editor | Parcial | Parcial | Nao (descobre no crash) | Nao | Parcial (pos-fato) | Nao | Sim (hardening) - diferencial |
| Emulacao integrada ao editor | Parcial (preview) | Parcial | Nao (externa) | Nao | n/a | Nao | Sim (hardening) |
| Debug profundo (memoria/VRAM/eventos) | Nao | Nao | Parcial (via emulador) | Nao | Sim (referencia) | Nao | Parcial Exp. -> paridade basica |
| Arte/animacao especifica de console | Parcial | Parcial | Nao | Sim (generico) | Nao | Nao | Parcial Exp. |
| Musica/SFX integrados | Sim (tracker) | Parcial | Nao (externo) | Nao | Nao | Nao | Nao -> workspace Som proposto |
| Logica visual <-> codigo C | Parcial (eventos) | Parcial | Nao | Nao | Nao | Nao | Parcial Exp. (ambicao: C <-> nodes) |
| Reversa/extracao integrada ao rebuild | Nao | Nao | Nao | Nao | Parcial (inspecao) | Sim (generico, nao integrado) | Parcial (spikes gated) |
| Patch IPS/BPS (BYOR) | Nao | Nao | Nao | Nao | Nao | Sim (Flips) | Planejado -> paridade funcional |
| Multi-console 16-bit no mesmo projeto | Nao | Nao | Nao | Nao | n/a | n/a | Sim via UGDM - diferencial unico |
| Escada novato -> avancado na mesma ferramenta | Nao (gradua para fora) | Nao | Nao | Nao | Nao | Nao | **A tese deste estudo** |

Leitura acionavel - **benchmark por fatia** (cada linha nomeia quem igualar, nao quem "vencer"):

- Onboarding/no-code: igualar **GB Studio** (referencia de UX do nicho).
- Debug: paridade com o **basico do Mesen2** no MVP (Memory/VRAM ja existem como Experimental); profundidade total e meta pos-MVP.
- Arte: **nao competir com Aseprite - interoperar** (import/re-import fluido) e cobrir so o que e especifico de console (paletas/tiles/metasprites).
- Som: cobrir o especifico (canais/XGM/orcamento de audio); interoperar com o ecossistema em vez de reinventar tracker.
- Patch: paridade funcional com **Flips**.
- Reversa: **integracao > profundidade** - Ghidra continua por tras como BYOR, conforme o plano de decompilacao.

A ultima linha da matriz e a validacao de mercado da tese: ninguem no nicho oferece a escada continua - e exatamente onde a integracao do ciclo vira vantagem estrutural, nao cosmetica.

---

## 12. Textos Propostos Para Futuras Insercoes Canonicas

> **NAO APLICADO. NAO APLICAR sem decisao humana explicita.**
> Pre-condicao operacional: worktree limpo ou branch dedicada, porque `docs/03_ROADMAP_MVP.md` e `docs/08_TREE_ARCHITECTURE.md` estavam modificados por outra frente na data deste estudo.
> Estas secoes sao rascunho de redacao, nao decisao. A aplicacao exige a mesma sessao atualizar os docs canonicos afetados e rodar os gates aplicaveis.

### 12.1 Proposta Para `docs/01_PRD_MASTER.md` (secao 1 - Visao)

Inserir apos a Missao:

```markdown
### 1.x Tese De Produto
Um unico editor acompanha o usuario do primeiro jogo sem codigo ate o limite
fisico do console - no mesmo shell, no mesmo projeto, com a mesma verdade de
hardware. O centro do produto nao sao os workspaces: e o ciclo
criar -> testar -> diagnosticar -> exportar um jogo retro real.
Toda superficie existe para encurtar uma volta desse ciclo; o que nao serve ao
ciclo e periferia.

Corolarios: (1) nenhuma feature entra se nao reduzir tempo/atrito de uma volta
do ciclo; (2) subir de nivel nunca exige migrar de ferramenta; (3) a verdade do
hardware e a mesma em todos os niveis - o iniciante ve menos numeros, nunca
numeros falsos.

Anti-metas: nao e frontend de emulador; nao e suite de editores de asset
desconexos; nao e browser de documentacao.
```

### 12.2 Proposta Para `docs/03_ROADMAP_MVP.md` (junto as regras da matriz)

```markdown
### Regra: Surface Registry Obrigatorio
Nenhuma superficie visivel entra no shell sem entrada no Surface Registry com
`{ id, dominio, minPersona, maturity, capability, roadmapRef }`.
O registry e o espelho em codigo da matriz de maturidade deste roadmap:
divergencia registry x matriz = falha de gate.

Enforcement minimo (sem dependencia nova):
- teste Vitest que falha se um workspace/ferramenta renderizavel nao tiver
  entrada no registry;
- teste que compara `maturity` do registry com o status da linha correspondente
  da matriz (ancorado por `roadmapRef`);
- nova superficie sem linha na matriz nao passa no baseline.
```

### 12.3 Proposta Para `docs/08_TREE_ARCHITECTURE.md` (mapa de `docs/`)

Adicionar a linha:

```text
|   |-- ESTUDO_UI_PRODUTO_NAO_CANONICO.md    (estudo de UI/produto, nao canonico)
```

Observacao: `docs/ESTUDO_FRONTEND_GUI_NAO_CANONICO.md` existe no disco e tambem nao consta do mapa; a mesma edicao canonica pode registrar os dois arquivos de estudo para coerencia.

---

## 13. Governanca Deste Estudo

- Este documento e subordinado a hierarquia de verdade; qualquer conflito com `06_AI_MEMORY_BANK`, `03_ROADMAP_MVP`, `09_AGENT_DEV_MODE`, `08_TREE_ARCHITECTURE` ou `02_TECH_STACK` se resolve a favor dos canonicos.
- Nenhuma implementacao derivada deste estudo pode: adicionar dependencia sem aprovacao + reflexo em `02_TECH_STACK`; criar superficie sem linha na matriz do roadmap; declarar parcial como pronto; antecipar fases futuras como entregues.
- A primeira fatia v2 (secao 10) e a unica parte proposta como implementavel na fase atual de hardening, por ser 100% frontend, sem dependencia nova e a servico do fluxo canonico `Build -> ROM -> Emulacao`.

## 14. Registro histórico de design e experiência

**Corte de consulta:** 2026-11-05, fonte `3c7de67a7ae446b1049e64a3791fbbc229d8bb60` da branch de coesão. O registro reúne o material recuperável dos documentos, do código e dos commits disponíveis, inclusive protótipos retirados da árvore atual. Os relatórios privados entram pelo resumo e pela procedência registrados no projeto. Para saber o que pode ser anunciado hoje, consultar o [Memory Bank](06_AI_MEMORY_BANK.md), a [matriz do roadmap](03_ROADMAP_MVP.md#matriz-de-superficies) e o [handoff de coesão](handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md).

**Leitura dos estados.** *Proposta* descreve a direção estudada. *Protótipo* demonstra interação em HTML ou imagem. *Em código* identifica uma solução presente no caminho de produção. *Provado no recorte* significa que uma execução identificada por binário, projeto, plataforma e cenário observou o resultado. Os percursos de outubro/novembro continuam em hardening, com superfícies `Experimental` e aceite humano pendente. O aceite de um protótipo, quando registrado, pertence à decisão de design daquela rodada. A sessão de uso do produto tem evidência própria.

- [Evolução da IDE](#141-da-ide-de-16-bits-à-jornada-integrada), [overhaul de julho](#142-overhaul-de-julho-e-revisão-dos-protótipos) e [identidade visual e acessibilidade](#143-identidade-visual-ergonomia-e-acessibilidade).
- [Studio Gráfico](#144-studio-gráfico-integrado-e-autoria-por-contexto), [modelos e direção de arte](#145-criação-direção-de-arte-e-modelos-de-jogo), [imagens e paletas](#146-arte-entrada-de-imagens-e-paletas-de-hardware) e [importadores e reversa](#147-importadores-reversa-e-confiança-na-origem).
- [Auditorias UX e PLAT](#148-da-auditoria-leiga-às-correções-do-template), [câmera e apresentação](#149-câmera-visual-composição-e-apresentação-do-jogo), [teste e recuperação](#1410-build-teste-entrega-e-recuperação) e [evidências e propostas em aberto](#1411-evidência-e-continuidade-do-design).

### 14.1 Da IDE de 16 bits à jornada integrada

| Período | Direção, revisões e consequência técnica |
|---|---|
| Fevereiro–março | O PRD parte de uma IDE visual para criação, educação, portabilidade e preservação de jogos 16 bits. Cena, Jogo, Hierarquia, Inspector, camadas, prefabs, gizmos e snap formam a base. A edição usa UGDM agnóstico e valida os limites do destino antes dos emissores. Diálogos nativos, starter, edição inline, histórico, autosave e fluxo de compilação para o emulador foram introduzidos incrementalmente. O overhaul `89536e65` reorganizou viewport, camadas, Inspector, grafo, paleta contextual e ferramentas. O mapa da GUI preserva desenhos de tela, áreas de interação, atalhos e fluxos desse período. |
| Abril–junho | Guia por área e contexto diário no shell, galeria com destino e conflitos explícitos, suporte ao overlay SGDK, feedback para aplicar arte e FX, estados de análise reversa e carregamento sob demanda. A opção B formalizou layout por workspace. Palette global, atalhos com detecção de conflito, presets, Focus Mode, árvore/grade de assets com prévia e ações e execução local inspecionável de nós passaram a compor a estação de trabalho. Diagnóstico de hardware separou estado pendente, stale, warning e bloqueio. Referências Git incluem `a5a83f93`, `af6048c5`, `44bd6e80`, PRs #12, #15 e #17. |
| Julho–setembro | A fatia v2 propôs progressão **Guiado → Criador → Pro → Hacker** num shell compartilhado. Revelar complexidade preserva projeto, ações já aprendidas e os mesmos limites físicos. Sugestões de transição seriam locais, reversíveis e dependentes de sinais da tarefa. Métricas propostas incluem primeira ROM jogável em até 15 min, latência edição→teste e voltas completas sem sair do Studio. GB Studio orientou onboarding, Mesen2 depuração, Aseprite interoperabilidade de arte, Flips patches e Ghidra reversa BYOR. Esses benchmarks pertencem ao estudo histórico. O diagnóstico de julho separou visão, integração e evidência reprodutível. |
| Setembro–outubro | A autoria passou a ter um platformer de referência, arte original, tilemap persistente, biblioteca de comportamentos e percursos reais de reabertura. MUGEN evoluiu de triagem e relatório para edição de ocorrências com prova na ROM. REX ganhou edição por recurso/perfil, prévia, proveniência e publicação de cópia/patch. O Studio Gráfico ligou seleção, arte, comportamento, teste e entrega no mesmo projeto. |
| Outubro–novembro | A auditoria de 16 jornadas e o relato de uso do template trouxeram a atenção para continuidade, densidade e clareza do resultado. A direção escolhida foi reutilizar o shell, `editorStore`, `studioContext`, `runtimeLink` e o plano de paletas. Corrigir primeiro o percurso real de criação/edição → ROM, qualificar MUGEN real, reduzir atrito e fazer o próximo passo aparecer no ponto de uso. |

Fontes do período inicial e da mudança de direção. [PRD](01_PRD_MASTER.md) · [Mapa histórico da GUI](ESTUDO_FRONTEND_GUI_NAO_CANONICO.md) · [Waves A–R](06_AI_MEMORY_BANK_WAVE_A_R.md) · [Diagnóstico de julho](DIAGNOSTICO_PRODUTO_2026_07_28_NAO_CANONICO.md) · [Baseline de setembro](AVALIACAO_DESENVOLVIMENTO_2026_09_06.md) · [Reavaliação da coesão](handoffs/REAVALIACAO_PRODUTO_2026-10-24.md)

### 14.2 Overhaul de julho e revisão dos protótipos

A auditoria A01–A43 encontrou problemas de foco, rótulos, densidade, feedback distante da ação e áreas dependentes de mouse. Contou 3.908 ocorrências de hex no frontend e 29 ocorrências de atributos ARIA na base auditada. A direção visual preservou o palco de trabalho e deu funções semânticas a superfícies, texto, ações, estados, seleção e foco. O inventário abaixo preserva os 12 protótipos da fase B. Os estados antes/depois foram registrados em 1366×768 e 1920×1080. Design System, Explorer, Console, Command Palette e Reversa usaram o baseline real mais próximo para a imagem anterior.

| Protótipo | Solução desenhada e critério de interação |
|---|---|
| 1. Design system | Tokens de superfície, ação, borda, texto, foco, estados, espaçamento, raios, altura e transição. `Button`, `IconButton`, `FormField`, `Input`, `Select`, `Tabs`, `Dialog`, `EmptyState` e painel adaptável consolidam vocabulário. Informação essencial preserva contraste e tem texto/ícone além da cor. |
| 2. Wizard | Template → Plataforma/Destino → Revisão. Importação externa aparece como rota irmã. Erro, retry e próximo passo ficam no diálogo, com foco inicial e controles alcançáveis. |
| 3. Cena | Ferramentas primárias fixas, guias e overlays recolhíveis, hierarquia compacta. Inspector e árvore oferecem alternativas a arrastar. Build bloqueado com causa/ação fora do canvas. |
| 4. Jogo | Escala inteira, palco nomeado e controles essenciais persistentes. State, replay e rewind ficam em Mais controles. Alvo, resolução e estado vêm do runtime. |
| 5. Arquivos | Árvore, grade, prévia, referências e ações compartilhadas. Instanciar, abrir na Arte e focar uso acessíveis por seleção explícita e teclado. |
| 6. Lógica | Paleta semântica, canvas focável, resumo/problemas/fonte e alternativas a arrastar nós e fios. Edição de texto isolada de Delete, Backspace e atalhos do canvas. |
| 7. Arte e FX | Fonte e timeline centrais, abas para prévia/animação/exportação/diagnóstico e ações finais alcançáveis. FX com estado alterado, salvar/repetir e alternativa ao drag para reordenar. |
| 8. Debug | Layout pela largura real do dock. Categorias e maturidade explícitas. Profiler com legenda, memória com rolagem interna intencional e resultados de ferramentas com estados locais. |
| 9. Runtime Setup | Distinguir carregando, erro, pronto e instalação. Origem, progresso, impacto e recuperação na superfície em que a pessoa iniciou a ação. A solução atual consulta o relatório do host e delega o reparo ao gerenciador oficial. |
| 10. Console e estados | Seguir log enquanto a leitura estiver no fim, indicar novas mensagens durante leitura histórica e abrir o diagnóstico correspondente. Status global por segmento com ação de recuperação. |
| 11. Comandos e diálogos | Comandos agrupados, indisponibilidade explicada. Diálogo compartilhado com nome, foco inicial, contenção, Esc e retorno do foco ao acionador. |
| 12. Reversa e evidências | Entradas comuns, readiness, resultados, divergências e arquivos, com abas e recortes de evidência separados para análise reversa, paridade, comparação entre núcleos de emulação e ciclos. |

**Revisão B2.** Subconjunto local de 39 ícones outline Iconoir 7.11.1 sob MIT. Presets Auto, Foco e Balanceado, separadores de 8 px com setas de 8 px e Shift+setas de 32 px e ajuste automático por duplo clique. O protótipo distinguiu dock, gaveta inferior, utilitário flutuante, diálogo de tarefa e overlay transitório. Caixas informativas podiam ser movidas, redimensionadas, maximizadas, fixadas, ocultadas automaticamente e restauradas em geometria segura. Erros, avisos e bloqueios mantinham a visibilidade. A paleta de comandos era transitória e ajustava seu próprio tamanho. Os HTMLs e 48 PNGs ficaram no Git histórico. Os caminhos podem ser lidos com `git show ab1043be:.codex/ui-audit/RELATORIO.md` e `git show ab1043be:.codex/ui-mocks/INDEX.md`.

**Convergência implementada.** PR #34 (`05418379`) integrou a fatia de UI, PR #35 (`67297ccc`) integrou a fundação ampliada do overhaul e PR #40 (`9b36d2e0`) registrou outra integração da fatia. O histórico distingue a base Catppuccin de 20 tokens da base de 53 tokens com overrides claros. Foram compatibilizados oito aliases usados pela fatia. `--rds-status-success-hover` virou token explícito e a resolução dos aliases foi corrigida também na raiz escura, devolvendo o fundo ao status de Build/Run. A árvore atual mantém primitivas de acessibilidade e painéis adaptáveis. Os 104 arquivos do diretório de auditoria/mocks foram retirados da árvore versionada durante a convergência e permanecem no objeto histórico. A implementação dos componentes não dá aceite automático às interações de todos os mocks.

Fontes e implementação. [Prompt do overhaul](PROMPT_UI_OVERHAUL_NAO_CANONICO.md) · [Diário da convergência](06_CURRENT_WAVE_AI_BANK.md) · [Tokens](../src/styles/index.css) · [Primitivas](../src/components/common/) · [Registro de superfícies](../src/core/surfaceRegistry.ts) · [Layout](../src/core/workspaceLayout.ts) · [Métricas locais](../src/core/productMetrics.ts)

### 14.3 Identidade visual, ergonomia e acessibilidade

- **Temas de console.** Super Nintendo é o padrão claro em gelo/cinza e roxo/lilás. Super Famicom usa cinza claro e acentos vermelho, azul, amarelo e verde. Mega Drive Night usa preto e cinza com branco. Mega Drive 16-bit acrescenta prata e dourado sobre preto. `studioAppearance` normaliza os IDs antigos (`super-16`, `mega-drive`, `portable`, `arcade`), persiste a escolha local e aplica `--rds-*` semântico à raiz. A revisão de outubro separou as cores dos controles e das áreas dos pixels do jogo e das paletas CRAM. Corrigiu leitura em painéis de Arte, cartões de Lógica e estados selecionados. [Temas e migração](../src/core/studioAppearance.ts) · [Seletor](../src/components/common/StudioAppearancePicker.tsx)
- **Iconografia e linguagem.** Pictogramas vetoriais compartilhados para criar, importar e entrar nas áreas. Ícone com nome de ação, rótulos em português nos pontos principais, texto de suporte para estado/destino e termos técnicos preservados onde ajudam a diagnosticar. A auditoria registrou mistura de PT/EN, textos de 8–11 px, abreviações, truncamento e excesso de avisos. O refinamento mudou o peso da informação e recolheu detalhes em menus e painéis opcionais. Catálogo de tradução PT-BR/EN pertence à proposta. [Ícones](../src/components/common/Icon.tsx) · [Revisões de legibilidade](handoffs/REAVALIACAO_PRODUTO_2026-10-24.md)
- **Layout adaptativo.** Três densidades e layouts por workspace/resolução foram propostos em julho. O produto tem presets, splitters, densidade, modo foco, restauração por área e acesso ao Inspector compacto. A correção de novembro manteve Hierarquia e pintura acessíveis na janela estreita, reaplicou medidas após fechar o wizard ou alternar Cena/Jogo e tratou overflow do Debug pelo conteúdo do dock. A matriz de aparência registrou 17 etapas e 44 medições em `af8e8655`, incluindo 36 combinações de tamanho/tema/zoom, com tamanhos lógicos de até 949×593 e zoom de até 200%. O estudo também previa 1280×800, 1366×768, 1920×1080 e 2560×1080. Toque/gamepad em portátil, quarto dock amplo e ergonomia física têm aceite próprio. [Layout](../src/core/workspaceLayout.ts) · [Oráculo geométrico](../scripts/ui-layout-oracle.mjs) · [QA RC](10_QA_ROTEIRO_RC.md)
- **Acessibilidade.** WCAG 2.2 AA é meta do estudo para o core. Os critérios de trabalho incluem foco visível e desobstruído, alvos de 24 px no estudo de desktop e 40 px na proposta portátil, navegação previsível, rótulos programáticos, ordem de leitura, ajuda consistente e alternativas a drag. Os testes de componentes e desktop cobrem recortes de foco, teclado, contraste e reflow. Leitor de tela, uso físico com escala real e conformidade integral continuam sem aceite registrado. [Critérios do estudo](#62-meta-de-acessibilidade) · [Foco e teclado](../src/core/keyboardFocus.ts) · [Roteiro humano](studio_grafico/ROTEIRO_VALIDACAO_HUMANA.md)
- **Seleção e autoria diária.** No trabalho de abril/maio, `creatorWorkflow` separou mundo, janela nativa, câmera, região editável e seleção. Em cena densa, Alt+clique percorre a pilha e Shift+clique abre a lista filtrável com teclado, pré-seleção e isolamento visual persistente. A faixa de tilemap aproxima alvo, pincel e ferramenta do canvas e oferece focar alvo/voltar à seleção. O Inspector mostra propriedades, origem e herança de prefab, com exceções locais. Etiquetas do viewport receberam distribuição contra sobreposição. O histórico também preserva quick actions por papel de objeto SGDK e o encadeamento assistido por layout como sugestões heurísticas. [Checkpoints de abril/maio e outubro](06_AI_MEMORY_BANK.md) · [Fluxo de autoria](../src/core/creatorWorkflow.ts) · [Etiquetas do viewport](../src/components/viewport/viewportTagLayout.ts)

### 14.4 Studio Gráfico Integrado e autoria por contexto

As referências de outubro traziam quatro composições: inspeção com **cenário azul**, **personagens laranja** e **texto rosa**; cena/personagem; regra **Quando → Se → Fazer** e interface; teste/entrega. Dois textos completavam a base comum entre gêneros e a arquitetura da experiência. Os seis originais e seus hashes constam no handoff. Os mocks orientaram organização, navegação e apresentação. O plano dividiu a integração em S0–S6 e definiu 24 requisitos, detalhados por teste e rodada no mapa REQ.

| Requisitos | Decisões de UX e contrato técnico |
|---|---|
| REQ-01–06 · continuidade | `editorStore.studio` e `studioContext` carregam projeto, cena, entidade, recurso, animação, ocorrência, propriedade, vista e origem de retorno. `StudioContextBar` liga Cena, Arte, Lógica, Teste e Revisar usando o shell existente. A seleção da instância difere da seleção do arquivo. Identidade por ID e conteúdo, auditoria de referências e renomear transacional evitam saltos para recurso ambíguo. Escopo indica Nesta cena, Nesta instância ou Editar modelo e quantos usos são afetados. Aplicar ao modelo guarda backup para Reverter. Um traço/gesto tem uma entrada de histórico e o limite de 50 é visível. Digitação em campo fica isolada do joypad e de atalhos de edição. |
| REQ-07–12 · personagem | Fonte SFF/AIR e recurso normalizado têm prévias e origem. Ocorrências da mesma imagem têm IDs independentes, duração em ticks e caixas/eventos próprios. Timeline oferece miniaturas, passo, reprodução, guia de movimento, mover ocorrência e edição gráfica ou numérica de hitbox/hurtbox. `clsn_edited` preserva a origem. Encurtar um quadro pode invalidar evento. O golpe autoral usa Clsn1×Clsn2 e um efeito por ativação no subset medido. Evento WAV por ocorrência e tick usa a tabela de SFX da ROM. Facing, múltiplos alvos e dialetos gerais ficam fora dessa prova. |
| REQ-13–16 · cena, regras e HUD | Pincéis de tile e colisão interpolam amostras do ponteiro e permanecem separados. `behaviorLibrary`, validação e `nodeCompiler` são o caminho comum da regra guiada e do grafo avançado. HUD textual liga posição, texto e valor ao runtime compatível. Em MD com câmera de mundo, o plano WINDOW mantém texto no topo ou na base e cobre a faixa do plano A. Campo incompatível leva ao controle responsável. Revisar projeto mostra causa, objeto, consequência, ação e exportação do build identificado. |
| REQ-17–21 · teste contextual | Pausa e passo de um frame amostram o core. Inspeção por camadas mostra cenário, sprites, texto, colisão e eventos de áudio e oferece escolha para itens sobrepostos. `retrodev.runtime_link/v1` associa ROM/revisão/epoch/quadro e conteúdo do asset/ocorrência a um destino do editor. Mudança de bytes no mesmo caminho invalida o vínculo antigo. Ajuste temporário de posição opera em WRAM e na época ativa, com diff e aplicação explícita ao projeto em um Undo. A UI distingue prévia atualizada, recompilação necessária, build anterior em execução e confirmação na ROM atual. |
| REQ-22–24 · base e expansão | Uma cena fonte, uma projeção resolvida, um histórico, UGDM/IPC/emissores existentes. Gêneros combináveis foram propostos como capacidades: terreno, salto e checkpoints de plataforma, comandos/janelas de luta, plano do chão e ondas de briga de rua, dados/diálogo/inventário de RPG. Destinos declaram capacidade por plataforma. O recorte inicial é Mega Drive e mantém o starter SNES separado. Diálogo ramificado e matriz ampla de gêneros permanecem direções de expansão. |

**Revisões da integração.** A rodada 2 acrescentou validação de identidade do recurso, edição visual de caixas, câmera de mundo, camadas de colisão/áudio, auditoria de paths e operações explícitas de modelo/instância. A rodada 3 conferiu conteúdo no mesmo path e fixou o HUD quando a câmera move o mundo. A rodada 4 substituiu a regra de PAL0 fixo na composição exercitada por um plano de bancos compartilhado com o build, com fonte e variante local. Na auditoria seguinte, LOT025 preservou a falha de atlas com 177.192.960 pixels diante do limite de 67.108.864. LOT028 já executou Build/ROM/exportação e LOT031 registrou retorno do playtest. O deslocamento observado nesse último lote e um ACK de entrada deixam a causalidade por frame em aberto. A coesão corrigiu o atlas por paginação de recursos/animações e repetiu o Ken real em uma amostra posterior, mantendo cada prova no seu projeto e executável.

Fontes da missão, revisões e protótipos do operador. [Handoff do Studio Gráfico](handoffs/PROMPT_STUDIO_GRAFICO_INTEGRADO_2026-10-19.md) · [Missão e rodadas](studio_grafico/MISSION.md) · [Mapa REQ-01–24](studio_grafico/REQUIREMENTS_MAP.md) · [Auditoria, cobertura e erratas](studio_grafico/auditoria_20261020/LEIA-ME.md) · [Contexto da UI](../src/core/studioContext.ts) · [Vínculo de runtime](../src/core/runtimeLink.ts)

### 14.5 Criação, direção de arte e modelos de jogo

- **Começar pela tarefa.** O wizard evoluiu de configuração de primeiro uso e galeria para escolha progressiva de criar, usar modelo, abrir/importar projeto e preparar ROM. Cartões com pictogramas, nome/destino, capacidades e motivo de indisponibilidade conservam o contexto de revisão. SGDK e MUGEN têm análise e confirmação próprias. MD-only continua explícito quando necessário, com starter SNES selecionável. O catálogo em `data/template_registry.json` diferencia seed builtin, doador local e importação experimental. A proposta de publicar um projeto já montado como novo template continua TPL-01. [Wizard](../src/components/common/ProjectStartWizard.tsx) · [Catálogo](../data/template_registry.json) · [TPL-01–17](03_ROADMAP_MVP.md#templates-pela-interface--2026-10-2829-parcial-experimental)
- **Platformer de referência.** A direção de arte do builtin é pixel art 16 bits de silhueta legível, raposa aventureira de cachecol vermelho e espada de madeira, ambiente azul e quente contraste de pelagem. Testaram-se 16/24/32/48/64 px. Os tamanhos 16/24 perdiam rosto e espada, os maiores alteravam a escala jogável. A solução de 32×32 usa cinco quadros e 15 cores visíveis, com índice 0 transparente. O portão 24×32 coincide com o bloqueador. A bandeira 16×32 indica chegada e o sensor é independente do desenho. A paisagem 320×224 reserva 10 cores ao fundo para comportar seis materiais do primeiro plano. Piso e plataforma visuais correspondem às células sólidas. A conversão Forge mantém candidatos, PNGs de runtime com equivalência RGBA e manifesto por hash. [Conceitos, variantes e evidências](../data/reference_platformer_art/README.md)
- **Bosque Aurora.** Projeto autoral com Lume, floresta azul/verde, sementes âmbar, salto, plataforma, portão e chegada. Edições removeram amostras técnicas do céu, alinharam chão e ilha à colisão, trocaram terreno provisório por cenário original e acrescentaram selo/broto de vitória e SFX. Três sementes condicionam a abertura e a chegada dá feedback visual/sonoro. A autoria foi exercitada com camadas, pixels, instâncias, plano de paletas, contador e objetivos. Trilha, HUD nativo de progresso, replay e publicação permanecem parciais. [Histórico do Bosque](../data/reference_platformer_art/README.md) · [Aceites TPL](03_ROADMAP_MVP.md#templates-pela-interface--2026-10-2829-parcial-experimental)
- **Jardim Mares.** Exploração superior com Nalu, tartaruga de casco dourado, laguna de corais com caminhos visualmente limpos, três pérolas e retorno ao farol. Evoluiu de HUD estático para indicador em sprites com três estados e farol apagado/aceso. A condição final exige as três pérolas. A revisão de farol 32→24 px respondeu ao orçamento DMA estimado. Nalu ganhou ciclo de cinco poses 32×32, com primeira/última equivalentes e 10 ticks por quadro na ROM. A aparência completa foi aplicada ao modelo com backup/Reverter, com física ainda na instância. O indicador composto é apropriado ao recorte de câmera fixa. Contenção superior, trilha/replay, HUD vinculado e publicação continuam pendentes. Arena/nave, projéteis, dano, spawn, transições e profundidade por parallax constam como sondas ou propostas no roadmap. [Histórico do Jardim](../data/reference_platformer_art/README.md) · [Capacidades e lacunas dos modelos](03_ROADMAP_MVP.md)

### 14.6 Arte, entrada de imagens e paletas de hardware

| Frente | Evolução e decisões técnicas |
|---|---|
| Preparar e animar | O Art Studio passou de escolher fonte, fatiar e configurar sequências a manter prévia, qualidade, limites e intenção de aplicação no mesmo fluxo. Inspecionar sprite sheet, grade, recorte, transparência e pivô antes de preparar para SGDK. Separar Aplicar à entidade de registrar recurso/editar modelo e mostrar impacto no asset compartilhado. A importação SGDK recupera recursos/metadados e composição no subset reconhecido. Captura da ROM por prioridade VDP e linhas A–D é referência para comparação, com filtros e ocupação. |
| Editor de pixels | Editor MD indexado com CRAM 4×16, frames, camadas, operações de desenho/seleção, transformações, filtros, geometria e composição. Ferramentas nomeadas e agrupadas por tarefa, atalhos, prévia/confirmar para operações destrutivas, histórico e indicação de pendência. PNG 4-bit e `.rdspixel.json` preservam pixels e documento, com guarda de versão/representação. Alteração geométrica de recurso em uso pode abrir cópia para preservar outros usos. Trocar ferramenta, tamanho, documento ou aba conserva o contexto previsto e oferece recuperar imagem salva, Undo ou voltar ao tamanho anterior. A revisão tornou visível qual arquivo e qual escopo estão abertos, inclusive ao chegar pela biblioteca. |
| Colar, soltar e importar | `ImageIngress` concentra seletor, Ctrl+V, drop de arquivo/web e GIF. A pessoa escolhe papel sprite/cenário e revisa banco/conversão quando necessário. A rota preserva original, usa writer de pixels e oferece biblioteca/instância para reutilização em outra cena. Limites do recorte MD documentado: sprite até 64×64, cenário 320×224, 15 cores visíveis mais transparência e tempo no ritmo de 60 Hz. Em GIF, retângulo comum de recorte preserva deslocamentos e os quadros compartilham paleta. Imagem externa inválida, cancelamento, ajuste de banco e nova tentativa têm desfechos distintos. |
| Revisão GIF53 e fidelidade | Seleção deixou de tingir os pixels e a quantização passou a ponderar cores, evitando posições redundantes. Guia de movimento passou a iniciar desligada. Resize proporcional mantém a base para escolhas sucessivas. Só o primeiro banco começa habilitado, extras entram por escolha e limpeza avalia quadros e camadas ocultas. Unificação tem prévia, com recusa de remoção de banco usado. Para o GIF de 53 quadros, o diagnóstico distingue o atlas de 94.976 bytes no cartucho dos dois buffers que somam 3.584 bytes no modelo estimado `native_frame_upload`. Outros recursos da cena continuam contados. O caso gerou uma jornada de 28 passos com ROM no core. A estimativa descreve o upload autoral do SGDK naquele modo. |
| Paleta interativa | O plano comum `scene_palette_plan` relaciona recurso, instância, fonte, cena, banco e build. Inspector explica ocupação e origem, permite compartilhamento compatível, variante local e edição de recurso com impacto explícito. Texto usa banco compatível ou preserva a regra anterior com aviso. Na composição Ken, a troca do alvo por golpe dura 12 quadros e restaura a cor. O quinto banco simultâneo foi recusado sem mutar cena, revisão, plano ou pilha de Undo. A rota de imagem oferece escolha explícita de substituição e cancelamento sem efeito. O adaptador do plano compartilhado é MD. O painel SNES indica indisponibilidade. |

Fontes e responsáveis. [Arte](../src/components/artstudio/ArtStudioPanel.tsx) · [Pixels](../src/core/pixelEditor.ts) · [Operações de imagem](../src/core/pixelImageOps.ts) · [Entrada de imagem](../src/core/imageIngress.ts) · [Plano e estado de paletas](../src/core/palettePlanStore.ts) · [Adendo das paletas](handoffs/ADENDO_PALETAS_INTERATIVAS_2026-10-19.md) · [Checkpoints de outubro/novembro](06_AI_MEMORY_BANK.md)

### 14.7 Importadores, reversa e confiança na origem

- **SGDK e importação externa.** Preservar projeto original, assets, overlay e procedência. O resumo de importação mostra composição aproximada, o que é editável, C nativo, lógica convertida, lacunas e ação possível. Na rota C nativa, editar fonte e compilar pelo SDK mantém a lógica original. Captura VDP, grafo de referências e informações de símbolos ajudam a inspecionar o resultado. O build recusa assets editados cujo consumo pelo C não foi estabelecido. Cenas UGDM, candidatos de grafo, execução C e reconstrução REX têm identidades próprias. Godot, Construct, RPG Maker, GameMaker e OpenBOR aparecem na matriz com capacidades delimitadas. Unity 2D e Paper2D constam como planejados/não importáveis. [Importadores e capacidades](03_ROADMAP_MVP.md#matriz-de-importadores) · [Explorer](../src/components/explorer/ExplorerWorkspace.tsx) · [Lógica C](../src/components/nodegraph/GameCodeLogic.tsx)
- **MUGEN.** A primeira integração trouxe revisão prévia e compatibilidade por arquivo/capacidade. UX v2 tornou o relatório reabrível e o tempo por ocorrência editável em ticks de 1/60 s. Em seguida vieram controle por teclado, locomoção horizontal por `VelSet` constante em Q8.8 e cadeia delimitada CMD/CNS → condição/estado → AIR → retorno, com mapa de origem. A evolução para arte real preservou pivôs, offsets, paleta e origem SFF, confrontou quadros da UI/core com referência independente e paginou atlas sem aumentar a guarda de segurança. Na coesão, Ken real passou por revisão, edição/reabertura e ROM/core/exportação, com 103 animações e 417 ocorrências na série fria. A equivalência jogável geral de ataques/HitDef e a reimportação integral em projeto existente continuam separadas. [Auditoria MUGEN](rex_profiles/mugen_sgdk/AUDIT.md) · [Cadeia original](rex_profiles/mugen_sgdk/ORIGINAL_CHAIN.md) · [Revisão de fonte](../src/components/common/MugenSourceReviewPanel.tsx)
- **Entrada de ROM BYOR.** Passou de drop MD e esqueleto SGDK com ação Abrir diretório para **Importar ROM** no wizard, seletor/drop coerentes e escolha explícita de membro em ZIP/7z. `rom_input.rs` prepara snapshot privado imutável e distingue SHA de contêiner, membro e ROM normalizada. Apresenta progresso, cancelamento, erros de senha/formato e recuperação, sem extrair a caminhos fornecidos no arquivo. A implementação documentou limites de 32 MiB por ROM, 128 MiB por contêiner e 2.048 entradas. Sessão reaberta filtra pela identidade e abre catálogo de recursos. O oráculo de novembro aprovou 11 passos no recorte que inclui editar um pixel LZ4W, publicar BPS e reaplicar byte a byte. Exportação técnica SGDK indica o que foi preservado ou compreendido. [Entrada no frontend](../src/components/tools/RomDropDecompile.tsx) · [Inspeção](../src/components/tools/InspectionPanel.tsx) · [Checkpoint de 2026-11-01](06_AI_MEMORY_BANK.md#checkpoint-2026-11-01--jornada-ux-importaçãoromimagem-experimental)
- **Editar reversa com proveniência.** Recursos comprimidos receberam preview e formulário preciso tile/linha/coluna/índice, revisão da transação e negativa explícita quando não é possível reencodar. A evolução Sonic cobre sprite em múltiplos quadros, cadência/sequência, layouts e Special Stage em grade com zoom, navegação por teclado, composição e selos de informação inferida. Houve diagnóstico de magenta/composição e preservação de capturas falhas. Os episódios comerciais exploraram layout, consumidores, DMA, sprite e cópia de grade. A visual copy v1 preserva a reprovação de cor e a v2 documenta aceite de uma composição autoral corrigida. A extração SGDK de recursos e remontagem byte-exata permanecem distintas de reconstrução da lógica. A campanha de cinco jogos reportou edição/reversibilidade de recursos e avanço de codecs sem fechar os cinco jogos. [Perfis e contratos](rex_profiles/CONTRACTS.md) · [Animação integrada](rex_profiles/sonic_anim_integrada/CONTRATO-ESTADO-INTEGRADA.md) · [Visual copy v1](rex_profiles/integration_20261016/VISUAL-COPY-RESULTS.md) · [Visual copy v2](rex_profiles/integration_20261016/VISUAL-COPY-V2-RESULTS.md) · [Cinco jogos](handoffs/PROMPT_CONTINUIDADE_REX_CINCO_JOGOS_2026-10-31.md)
- **Canvas → ROM → gameplay.** REX declara identidade, região, perfil, instância, domínio de edição e origem da evidência. Os perfis em dados projetam os campos aceitos no NodeGraph e preservam o resto como desconhecido. Edição revisada publica cópia/IPS e mantém a ROM original. O app oferece voltar à ROM original. A tese de um motor genérico por perfil é direção de longo prazo. A prova do pulo Sonic 1/Delta compara controles, impulso/corte e efeitos por RAM/quadros. Sonda isolada, forma estática, consumo por PC, efeito, causalidade e reconstrução têm eixos próprios. A biblioteca Libretro padrão deixa trace genérico de PC fora da prova atual. [Arquitetura REX e adendos](14_REX_ARQUITETURA_UNIVERSAL.md) · [Ponte do canvas](../src/core/rexBridge.ts) · [Aceite de autoria REX](REX_AUTHORING_ACCEPTANCE.md)

### 14.8 Da auditoria leiga às correções do template

O diagnóstico de 31/10 examinou o Tauri com três tamanhos lógicos, a importação do exemplo oficial SGDK, a edição de imagens e a criação de nós. O relato do operador em 02/11 acrescentou dez capturas da jornada do template e revelou que a versão do atalho era anterior ao candidato já qualificado. As duas fontes preservam como achado aquilo que foi observado e como hipótese aquilo cuja causa ainda precisava ser reproduzida.

| Achados do diagnóstico | Revisão incorporada ou direção registrada |
|---|---|
| UX01 · nós sobrepostos | Inserir em posição livre, trazer foco ao novo nó e permitir teclado na paleta. O `nodeLayout` organiza por conexões e grupos. Medição por `ResizeObserver` preserva área útil. Layout inicial novo separado do manual existente. Organizar altera posições e tem Undo. |
| UX02 · enquadramento e área útil | Enquadrar pelo conteúdo útil. Panorama e escala de edição distintos. Minimapa sob demanda sem cobrir o cartão ativo. Barra e painéis se adaptam às janelas 1280×800, 1366×768 e 949×593. |
| UX03 · resultado de importação ambíguo | Explicar visual, composição, código preservado, lógica editável e lacunas. Oferecer recurso representativo e ação contextual. O relatório deixa visível o que uma contagem zero significa. |
| UX04–05 · ROM e semântica recuperada | Wizard/seletor/drop e membros ZIP/7z com resultado identificável. O catálogo distingue reconhecimento, hipótese, edição por perfil, bytes preservados e execução observada. Um esqueleto técnico permanece identificado como tal. |
| UX06 · excesso e origem de notificações | Relacionar o diagnóstico à revisão, ao projeto e ao evento que o produziu. Priorizar falhas acionáveis, deixar positivos discretos e agrupar detalhes. O popover de build saiu da área de recorte da barra. |
| UX07 · documento de imagem ambíguo | Mostrar miniatura, arquivo, origem, edição de recurso compartilhado ou de cópia. Abertura de pixels e Preparar e animar mantêm o recurso explícito. |
| UX08–09 · linguagem e densidade | Rótulos de tarefa, tokens e foco mais legíveis. Guia compacto, paleta global recolhida, propriedades do objeto primeiro e detalhes técnicos quando solicitados. |

| Revisão do template | Problema observado e solução |
|---|---|
| PLAT01 · versão entregue | O atalho ainda abria `263205d8` mesmo com fontes/candidato recentes. A verificação passou a conferir `/proc/<pid>/exe` e SHA do binário, além de recibo terminal. O launcher protege sessão viva, reconhece reboot por `boot_id` e H01 publica o owner completo sob mutex, com arquivo preparado/sincronizado e link exclusivo. As duas aberturas e fechamentos normais de QA ocorreram em perfis próprios. |
| PLAT02 · cena e câmera legada | O canvas subtraía meia tela depois de aplicar os offsets do follow e posicionava a moldura inicial em (−264, −32), enquanto o SGDK usava posição do alvo mais offset limitado ao mundo. A correção preserva o contrato legado e separa câmera, área jogável, enquadramento e gesto de edição. O arraste usa referência estável em vez de fazer a câmera realimentar a posição do ponteiro. |
| PLAT03 · pan e colagem | Pan com botão central podia chegar ao caminho global de paste em Linux/WebKit. Arbitragem entre gesto de navegação e `ImageIngress`, inclusive sobre portas do grafo, mantém Ctrl+V/drop deliberados. Duas corridas frias de 16 etapas com imagem no clipboard passaram em X11 no binário `36f34289`. A seleção primária Wayland tem qualificação separada. |
| PLAT04 · abrir Lógica | A câmera selecionada tinha zero nós enquanto o Player tinha 34 nós e 30 conexões. A entrada geral apresenta comportamentos por objeto, câmera com configuração própria e estados distintos de ausência, carregamento e falha. Entrada contextual conserva o objeto escolhido. |
| PLAT05 · travessia por recurso | Arquivos → Editar arte/animações, Ver usos, Ver na cena e Lógica conforme o tipo. Usa caminho completo normalizado, lista instâncias de recurso compartilhado e conserva a origem no retorno. Arte com câmera selecionada oferece destinos válidos. A prova espera o workspace montar e confere a identidade do recurso. |
| PLAT06 · descobrir câmera | Ação Configurar câmera junto da seleção/moldura. Enquadrar a vista do editor, editar a câmera do jogo e conferir seu resultado na prévia são ações com escopos explícitos. |
| PLAT07 · grafo navegável | Template abre agrupado e legível, com visão geral, enquadrar, centralizar e organizar. Ações avançadas ficam em Mais ações na largura compacta. Portas usam medidas de layout compatíveis com zoom. Conexões, parâmetros e layout manual são preservados. |
| PLAT08–09 · som e movimento | Som no ponto de uso, com nome, escolha, ouvir/parar quando há caminho real para WAV e estado de indisponibilidade para formato sem prévia. Painel Movimento e salto aproxima valores de velocidade, atrito, gravidade e impulso de seus nós. `sprite_move` desloca agora, `set_velocity` altera a velocidade usada pela física. O efeito na ROM tem aceitação por caso. |
| PLAT10 · acesso a painéis | Abaixo de 960 px lógicos, Cena, Hierarquia e Inspector têm acesso por abas. Barra de contexto compacta, paleta flutuante recolhível, timeline/controles alcançáveis por scroll e teclado. Tamanho medido e hit test conferem que o alvo pertence à ferramenta ativa. |
| PLAT11 · Debug contextual | Por que não funciona, colisões, estado/RAM, recursos e desempenho usam dados da cena e sessão ativas. ROM/core, revisão e amostra identificam a medida. Validação stale, telemetria ausente e heurística externa ficam distintas. FPS de apresentação descreve o intervalo do frontend. Build negativo por asset ausente aponta correção e impede reusar uma ROM antiga como resultado novo. |
| PLAT12 · mover composição | Mover objeto, mover camada e pan são operações separadas. Camada considera membros visíveis/desbloqueados. `collision_map` é global no schema, entra no gesto apenas mediante escolha explícita, recusa corte de células sólidas e faz Undo/Redo em uma transação. Restaurar composição do template mostra prévia e preserva outras edições. Referência 24/24 observou mapa global, reabertura, RAM e ROM. |

Fontes de achados, hipóteses, critérios e fechamentos. [Auditoria leiga e PLAT01–12](handoffs/REAVALIACAO_PRODUTO_2026-10-24.md) · [Quadro e contexto de cena](../src/core/sceneWorldModel.ts) · [Composição](../src/core/sceneComposition.ts) · [Diagnóstico contextual](../src/core/projectDiagnostics.ts) · [Grafo](../src/components/nodegraph/NodeGraphEditor.tsx)

### 14.9 Câmera visual, composição e apresentação do jogo

**CAM01–04.** O configurador usa um contrato aditivo para preservar cenas legadas e permitir conversão explícita. Cinco cartões iniciais compartilham o mesmo modelo: tela fixa, plataforma lateral, exploração superior, rolagem horizontal e vertical. O diálogo permite escolher alvo pelo nome, compor por arraste/porcentagem/campos, desenhar limites, regular eixos, resposta direta/suave e teto de velocidade. A prévia lê a arte do viewport e respeita a proporção do destino. Aplicar/Cancelar e Undo/Redo têm escopo definido. O runtime resolve o mundo após movimento e avalia a câmera uma vez antes de apresentar o quadro. Teleporte, arredondamento, origem negativa, área menor que a tela, bordas e alvo removido têm regras explícitas.

**CAM05–08.** Salas têm identidade, área de entrada, enquadramento e prioridade estável. Mantém-se a última sala válida fora das regiões, com corte ou suavização sem oscilação. Padrões guardam valores efetivos com identidade própria e escopo da cena, incluindo salvar, duplicar, renomear, atualizar, reusar e proteger/transferir a proprietária. Eventos do mesmo grafo controlam seleção, avanço/pausa, combate com recuo/trava, arena de múltiplos alvos, percurso com pontos/esperas/retorno e efeitos temporários. Tremor e offset cosmético não deslocam a posição lógica. Arena não oferece zoom. Paralaxe relaciona cada plano residente à câmera por razão e origem. HUD fixo e subpaletas têm tratamento por destino e o diálogo explica o que fica indisponível.

**UX-CAM01–09.** Rascunho recuperável e cartão idempotente. Arte, proporção e mapeamento do ponteiro compartilham o viewport. Campo numérico mantém digitação parcial e sinal antes da confirmação. Porcentagem, direção e segundos aparecem junto da unidade. Resumo mostra câmera inicial, prioridades, transições, eventos e responsáveis por conflitos. Biblioteca explicita escopo e referências. Rodapé fica fora da área rolável, ações acessíveis por teclado e layout compacto. Enquadramento prioriza a área jogável e exclui decoração distante, preservando escolha explícita. O limite de prévia para mapa grande é declarado.

**CAM09–11.** `29b9b21f` teve 39 casos e 445 estados observados entre Mega Drive e SNES, mais 30 verificações da UI e QA RC/32 oráculos de layout. A revisão SNES mede resolução/apresentação, máscaras e subpaletas de dois planos. MD mediu HUD fixo e paralaxe, inclusive origens negativas. Uma conversão de 1,5 s para 75 quadros em modo 50 Hz foi observada no recorte. Os relatórios registram as recusas, limites de mapa residente, HUD fixo indisponível no SNES e ausência de aceite humano ou PAL físico. O roteiro humano pede escolher, delimitar e salvar uma variação sem assistência técnica. [Plano CAM01–11, matriz UX-CAM e fechamento](handoffs/REAVALIACAO_PRODUTO_2026-10-24.md) · [Configurador](../src/components/inspector/CameraConfigurator.tsx) · [Contrato da UI](../src/core/cameraWorkflow.ts) · [Runtime gerado](../src-tauri/src/compiler/camera_runtime_template.c)

**RetroFX.** A direção do designer experimental inclui abas Parallax/Raster, presets, parâmetros por camada, preview e propriedades com status de aplicação. O estudo previa aprofundar line-scroll, timeline DMA e eventos por scanline. No contrato da câmera, paralaxe compatível usa a posição já resolvida e há conflito explícito se outra regra tenta controlar o mesmo plano. A leitura histórica da superfície e a prova de paralaxe por câmera têm alcances diferentes. [Mapa do RetroFX](ESTUDO_FRONTEND_GUI_NAO_CANONICO.md#9-workspace-retrofx) · [Designer](../src/components/retrofx/RetroFXDesigner.tsx) · [Limites de J15](handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md)

### 14.10 Build, teste, entrega e recuperação

- **Estados e identidade.** `Build & Run` salva, valida a cena resolvida e limites do hardware, compila com SGDK/PVSnesLib e roda a ROM identificada no core Libretro. Build, revisão do editor, biblioteca do core, ROM executada e exportação têm identidades próprias. Em Q01, a evidência SNES passou a registrar o SHA da biblioteca efetivamente carregada em campo distinto do SHA da ROM. Revisar e exportar usam o artefato de build e mostram bloqueio/ação se a revisão ficou stale. O caminho C original preserva fonte e invalida artefato antigo ao editar. [Build freshness](../src/core/buildFreshness.ts) · [Entrega](../src/components/tools/DeliveryPanel.tsx) · [Q01 e D01](06_AI_MEMORY_BANK.md)
- **Apresentação e controles.** Game View combina escala inteira, play/pause/stop/frame-step, estados, rewind e replay nos recortes suportados, foco e mapa de entrada. O Debug separa frames apresentados de tempo do alvo. O playtest retorna ao editor preservando a seleção. Comparar entrada efetiva requer leitura do joypad/core e janela de quadros. O áudio pode ser medido em amostras do core/WebAudio e observado por evento. Saída acústica física tem evidência própria. [Apresentação](../src/components/viewport/gameFramePresentation.ts) · [Consumo de input](../src/core/inputConsumption.ts) · [Teste temporário](../src/components/viewport/TestAdjustPanel.tsx)
- **Salvamento e recuperação.** Draft com identidade de projeto/cena/revisão, proteção em `.rds/scene-drafts/`, migração confirmada de `localStorage` e estados recuperável, conflito e cancelamento. Um Undo pode deixar cena alterada até Salvar. D01 prepara e valida cena e grafos externos antes de escrever, guarda intenção por SHA, serializa writers e reaproveita escrita atômica. Na reabertura só retoma os estados anterior/posterior conhecidos. Conflito, schema desconhecido e corrupção permanecem preservados. A UI mantém projeto e cena separados ao fechar/trocar e o caminho de I/O sai do loop da janela. A série D01 passou 19/19 em `2931ca1a`, com quatro interrupções controladas e ROM recuperada executada/exportada. [Persistência](../src/core/scenePersistence.ts) · [Project manager](../src-tauri/src/core/project_mgr.rs) · [D01](06_AI_MEMORY_BANK.md#d01--recuperação-de-cenagrafos-no-tauri-2026-11-05-validação-local-concluída-publicação-do-incremento)
- **Instalação e operação.** Runtime Setup usa `host-readiness.json` e delega reparo à rota gerenciada. Diagnóstico READY, disponibilidade de abrir a janela e certificação de fluxo são estados separados. Na reabertura por atalho, a versão efetiva do executável é conferida pelo próprio processo. A falha histórica de lock vazio preserva a informação disponível para recuperação do owner. [Continuidade do host](handoffs/NOVO_HOST_INICIO.md) · [Diagnóstico e fila](handoffs/REAVALIACAO_PRODUTO_2026-10-24.md)

### 14.11 Evidência e continuidade do design

| Base medida | Recorte registrado |
|---|---|
| Auditoria de julho | 12 protótipos e revisão B2 com HTML estático interativo. Auditoria de código e baseline visual Tauri anteriores. O relatório histórico guarda A01–A43, prioridades, origem e lacunas de cada mock. |
| Outubro, Studio Gráfico | REQ-01–24 por tipo de teste e rodada. Aceite técnico de identidade, caixa, câmera, plano de paletas, áudio e entrega nos subsets declarados. A auditoria J00–J15 conserva falhas, contraprovas e pareceres A/B/C do mesmo lote. |
| `af8e8655` | Aparência 17/44, três corridas autorais de 10 etapas, três Ken reais de 14 etapas, SNES guiado 4/4, paletas 15/15 e recuperação de rascunho 19 passos. |
| `36f34289` | Referência MD/PLAT12 24/24, NodeGraph 14/14, pan/imagem 2×16/16 e QA RC A–H/32. Ken paletas 16/16, com quinto banco recusado. REX J11/J12 87/87 no canvas e 19/19 no gameplay, com oito cópias/IPS e uma amostra inválida preservada. |
| `2931ca1a` | D01 19/19 com interrupções controladas, abertura/fechamento KDE em perfis de QA e starter SNES 4/4 com SHA do Snes9x separado da ROM. Cada resultado mantém o protocolo e o recibo correspondente. |

As 16 jornadas permanecem parciais no produto. Aceite humano por participante, uso físico com escala/entrada reais, leitor de tela, áudio e GPU físicos, Windows interativo, console e equivalência geral de importadores/REX têm evidências independentes. Em particular, J03 ainda exige efeito semântico de ataque, J06 cobre Ken e imagens no subset MD, e J15 carece de edição/runtime atual de RetroFX. Os roteiros pedem tarefas neutras e anotam conclusão, hesitação, erro e ajuda, vinculados a tamanho/escala, plataforma, executável e ROM. [Matriz J00–J15](handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md) · [Roteiro de avaliação humana](studio_grafico/ROTEIRO_VALIDACAO_HUMANA.md) · [Recibos e limites](06_AI_MEMORY_BANK.md)

**Propostas preservadas.** O workspace Som, a separação da Reversa avançada, perfis para novos consoles, marketplace, idioma adicional, UI portátil, quatro personas e três densidades de layout pertencem ao estudo de julho. A extensão EC01–EC06 do roadmap propõe editor textual SGDK e sincronização C↔nodes por subset, com revisão, origem e conflitos explícitos. Inclui realce semântico, navegação, diagnósticos, edição contextual de paletas e prévias, storyboard/telemetria quando instrumentados, e teste no pipeline oficial. Decompilação ampla, uso de LLM, diálogos ramificados e novos gêneros mantêm os limites e gates de seus planos. [Estudo original](#0-tese-de-produto-proposta) · [Editor textual SGDK EC01–EC06](03_ROADMAP_MVP.md#editor-de-codigo-em-texto-sgdk--proposta-futura-ec01ec06-fora-do-mvpq2) · [Decompilação pareada](12_DECOMPILACAO_PAREADA_PLANO.md)

**Manutenção do registro.** Ao recuperar outra revisão, acrescentar data, necessidade observada, proposta, decisão, responsável no código e evidência/limite. Referenciar arquivos estáveis ou um commit imutável quando a versão anterior fizer diferença. Preservar decisões substituídas e resultados reprovados com o contexto da época. Maturidade continua no roadmap. Recibos técnicos e próximos passos continuam no Memory Bank e nos handoffs.

### 14.12 Autoria visual robusta — correção de direção R5, 2026-11-06

O operador rejeitou a redução funcional da proposta R4: poucos destinos globais, foco em propriedades pontuais e ausência de ferramentas para construir movimentos e compor planos. A direção atual deve transportar a riqueza de criação de jogos de alta performance, gráficos elaborados e mecânicas complexas para uma interface moderna, amigável, dinâmica e flexível. Organização visual preserva recursos robustos e precisão; não autoriza eliminá-los. Diretriz permanente no AGENTS, Memory Bank e memória fixada do projeto.

A [R5 na jornada Mega Drive](studio_grafico/JORNADA_MEGA_DRIVE_2026-11-05.md#r5-autoria-visual) registra a síntese: navegação global persistente à esquerda e horizontal por contexto; Canvas orientado a qualquer objeto compatível; trajetos desenháveis com pontos/alças, retas/curvas/elipses, duração/velocidade, esperas e reprodução; gatilhos e sequência nos nós; planos A/B, sprites, prioridade, isolamento e paralaxe com prévia e números precisos. Máscaras, geometria autoral e estado transitório de prévia têm responsabilidades distintas. O ciclo desenhar/ajustar/testar deve substituir o trabalho de compor deslocamentos mínimos manualmente quando o recurso correspondente estiver implementado.

As duas visões R5 são a referência atual para discussão do Canvas; R4 fica histórica e superada, R2/R3 preservam contratos e proteções com a navegação corrigida. O [prompt existente](handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md) e a [proposta no roadmap](03_ROADMAP_MVP.md#autoria-visual-robusta-r5) foram reconciliados. Já há percurso linear de câmera, paralaxe e prévias; curvas/elipses genéricas de objetos exigem contrato e implementação próprios nos owners oficiais. Nenhum novo motor, suporte de runtime, performance ou aceite humano foi entregue por estes mockups.

**[Fim do estudo]**
