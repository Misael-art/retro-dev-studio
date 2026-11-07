# Jornada visual Mega Drive — Correio das Nuvens

Pedido do operador: executar a criação básica no aplicativo, produzir tutorial em PDF com etapas A1, A2… e setas, usar arte original com idle/corrida/salto e céu em paralaxe, e destacar melhorias que reduzam o esforço de um iniciante.

## Entrega e identidade

- Projeto editável: `/home/misael/Documents/RetroDevProjects/Correio_das_Nuvens/project.rds`.
- Arte, capturas, receitas, provas e PDF privados: `RDS_WORK_ROOT/sessions/tutorial-megadrive-20261105/`.
- PDF: `entrega/Guia_visual_Mega_Drive.pdf`, 40 páginas. Setas são anotações vetoriais sobre capturas reais, com recortes para leitura; as telas do aplicativo não foram sintetizadas.
- Aplicativo congelado: `sessions/closeout-20261105/candidate/retro-dev-studio-d02`, SHA-256 `4a139615d2b462c7bff5565dffb92dd3064e763f9f018d2b22d7fa65c5466839`. Manifesto do candidato existente; produto associado a `b0b0afbf`. O executável identifica a base `dfe78c72` com alterações locais, como já documentado.
- Fonte de entrada desta sessão: `2805fe04456e8953a6131a90a9ffd29e0e11704e`. Outra frente publicou os incrementos REX `771686be`/`da7ec303` durante a jornada; seus arquivos e registros foram preservados. Nenhum código de produto, lock ou guarda foi alterado por esta missão.
- Host: diagnóstico fresco **READY**, usando cache gerenciado `/home/misael/.cache/retrodevstudio` e runtime/perfil próprios. Launcher: `sessions/tutorial-megadrive-20261105/work/sessions/2026-11-05T14-20-13-848Z-1525168/receipt.json`.
- Alvo exercitado: Tauri/WebKitWebDriver, Xvfb próprio, Mesa software, SGDK e Genesis Plus GX oficiais do lock. Nenhuma ROM comercial foi usada.
- ROM final/reaberta: **`a8798730cfabe980911e15524cbf9c2fe0861c4b2c964a9dc221feb059acb5ad`**, 524.288 bytes. Core SHA e demais identidades estão no manifesto privado da entrega.

## Conteúdo e percurso executado

O wizard criou uma cópia de `reference_platformer`. A cena final contém Nalu (`player`), céu e chão em dois tilemaps, e a câmera principal. O mundo visual mede 352×224, a visão 320×224. O chão é uma faixa de 352×24 em `(0,200)`; o piso sólido fica em Y=208. Os oito sólidos da plataforma antiga foram apagados pela UI; foram acrescentadas quatro células de limites laterais, totalizando 84 sólidos. O mapa de colisão continua com 40×28 células, com a extensão visual de 32 pixels usada para o enquadramento.

O personagem usa quadros de 32×32: `idle` 0–3 a 4 fps em loop, `run` 4–9 a 8 fps em loop e `jump` 10–11 a 8 fps sem loop. A entrada de uma variante maior foi ensaiada; o caminho comum de substituição limitou a dimensão a 32. A fonte 64×64 foi preservada e **não é a variante executada nesta prova**.

Arte original gerada pela ferramenta imagegen embutida; prompts e originais preservados em `prompts.md` e `raw/`. Conversão offline: nearest-neighbor, alpha binário, paleta comum de até 15 cores úteis, PNG indexado de 4 bits, grade de 8 pixels. O recorte do terreno e sua translação foram declarados. Referências consultadas:

- SGDKForge: `tools/sgdk_wrapper/modelo/.agent/skills/art/megadrive-pixel-strict-rules/SKILL.md`, `art-conversion-pipeline/SKILL.md` e `tools/sgdk_wrapper/forge_art/vdp_color.py`.
- SMSForge: `SMS_projects/master_of_fighters/doc/asset_conversion_proof_standard_v4.md` e a bíblia de arte do modelo.
- A disciplina de prova, transparência, escala e paleta foi adaptada ao Mega Drive. A tabela RGB de 6 bits do SMS não foi copiada. Esta rota usa os níveis de apresentação RGB333 do Photo2SGDK/ResComp do aplicativo, distinguindo-os da grade de autoria e do macro C descritos pelo SGDKForge.

Projeto, lógica, posições, colisão, animações e câmera foram editados pela UI. Não houve edição externa de `project.rds`, cenas, grafos ou C para suprir uma função ausente. O utilitário privado `ui.mjs` reutilizou a receita de observação WebDriver existente da jornada de templates; eventos de teclado, clique e arraste foram nativos. Seletores, metadados de posição, leituras de RAM e observação do core serviram à documentação e à verificação. Python foi usado somente na conversão de arquivos, montagem do PDF e auditoria offline.

## Receita dos estados de animação

Após retirar os cinco grupos antigos ligados à passagem, salto e objetivo, preservou-se a música. A biblioteca **Movimento e salto** aplica velocidade 2, direções esquerda/direita, botão A/Z, impulso 64, animação `jump` e som `jump`.

Foram necessários nove nós adicionais para escolher a animação em cada quadro. Para repetir a receita na UI:

| Papel | Nó | Parâmetros |
|---|---|---|
| Marcar movimento | Definir Variável | `temp_var = 1` |
| Atualização da animação | A cada quadro | criar depois do comportamento de movimento |
| Separar chão/ar | Está no chão? | `target=player` |
| Ler marca | Ler Variável | `var_name=temp_var` |
| Parado? | Comparar | `operator ==`; entrada B padrão 0 |
| Corrida | Estado de Animação | `target=player`, `state=run` |
| Repouso | Estado de Animação | `target=player`, `state=idle` |
| No ar | Estado de Animação | `target=player`, `state=jump` |
| Limpar marca | Definir Variável | `temp_var = 0` |

Ligações:

1. Saída de cada `sprite_move` (direita e esquerda) → Marcar movimento.
2. Atualização da animação → Está no chão?.
3. Chão/Sim → Comparar/exec; Ler marca/value → Comparar/A.
4. Comparar/Sim → idle; Comparar/Não → run.
5. Chão/Não → jump.
6. Saídas de idle, run e jump → Limpar marca.

Os parâmetros textuais foram editados nos campos de lógica do Inspector da cena, pois os cartões dos nós não oferecem todos esses editores. As ligações foram feitas por arraste entre portas; Organização/Visão geral somente ajustaram a apresentação.

Câmera: padrão Plataforma lateral, área explícita 352×224, céu horizontal 50%, chão padrão 100%. “Mapa geral”/“Mapa inteiro” mostram a composição e a moldura do jogador. O perfil foi aplicado e salvo pelo configurador existente.

## Provas desta execução

| Critério | Resultado e evidência privada |
|---|---|
| Criar pela UI | Wizard, console, modelo e nome capturados em `screens/A*.png`; ações em `ui-actions.jsonl` |
| Conversão → asset canônico | 12 quadros, 1.024 posições cada, **12.288/12.288** com alpha e RGB opaco idênticos após remontar o atlas 4×3; `canonical-frame-comparison.json` |
| Idle animado | Quadros-fonte 1 e 2 identificados no core, respectivamente **303/303** e **292/292** pixels opacos |
| Corrida animada | Quadros-fonte 4 e 5, **308/308** e **285/285** pixels opacos; posições apresentadas `(46,176)` e `(62,176)` |
| Salto animado | Quadros-fonte 10 e 11, **271/271** e **282/282** pixels opacos; posições apresentadas `(64,170)` e `(64,161)` |
| Entrada e posição | Setas/Z nativos; primeira observação de RAM X32→50 e Y176→166. Na série final pausada: X164, Y176, câmera X32 |
| Paralaxe final | Céu desloca **16 px: 42.560/42.560** amostras exatas; chão **32 px: 3.456/3.456**. Mesma ROM final, sem máscara sobre as regiões comparadas |
| Core e framebuffer | Oito observações diretas: SHA dos bytes RGBA igual ao SHA informado pelo core; identidade da ROM final em todas; `final-proof.json` |
| Salvar/reabrir | Nova sessão Tauri, seletor nativo `project.rds`, 28 arquivos autorais/projeto sem divergência na conferência; rebuild com a mesma ROM SHA |
| Edição reversível | Arraste do herói X32→48, Undo→32 e save; `screens/B4-arrastar-personagem.png` e ledger |

Os valores RGB565 expandidos do framebuffer foram distinguidos dos RGBs de autoria. A primeira comparação por posição suposta não coincidiu: a apresentação do sprite estava um quadro atrás da posição lógica atualizada. A busca local documentada encontrou as poses exatas; as posições acima são **medidas no quadro apresentado**, não RAM presumida do mesmo instante. `animation-pixel-proof.json` mantém o ensaio inicial; `animation-placement-proof.json` guarda a identificação corrigida. Não se infere equivalência de hardware a partir disso.

## Curadoria priorizada

As propostas abaixo **não foram implementadas no aplicativo**. O PDF dá destaque visual às quatro famílias; esta tabela fornece owner e aceite verificável para um lote posterior.

| ID / prioridade | Observação e impacto | Integração proposta e owner | Aceite |
|---|---|---|---|
| JV01 / P0 | Imagens montadas importadas por Imagem vieram com células 1…N. Build aceito/estimativa 42 KB, mas ROM apresentou corrupção. Restaurar imagem original nos dois mapas retirou o problema. O C gerado carregava imagem e tiles de células. | Reconciliar imagem montada/células, alocação e estimativa no caminho existente: `imageIngress.ts`, `build_orch.rs`, `sgdk_emitter.rs`, estimadores. Diagnóstico forte; falta regressão mínima no owner antes da correção. | Mesmo caso positivo em prévia e core, orçamento baseado na alocação efetiva; negativo recusa excesso antes de executar. |
| JV02 / P1 | Troca comum limita ator a 32×32; entrada de GIF aceita composto maior. A variante 64 não percorreu o mesmo fluxo de substituição. | Ação Substituir arte que conserve identidade/física/lógica, explicite tamanho e remapeie animações: ArtStudio, ImageIngress e `sceneConstraints.ts`. | Substituir um ator 32 e um composto 64; preservar vínculos, conteúdo, Undo, save/reopen e ROM. |
| JV03 / P1 | Ao remover o bloqueio do modelo, os ramos de movimento deixaram de emitir movimento; build continuou possível. | Mostrar dependentes e desvincular por transação reversível em Hierarchy/behaviorLibrary/validação do grafo. | Remoção mostra as regras afetadas e deixa um caminho explícito para movimento válido. |
| JV04 / P1 | Grade regular foi sugerida como ilhas em outra ordem. | Priorizar ordem de grade/animação reconhecida, com comparação antes de aplicar; Photo2SGDK e ArtStudio. | Folha/GIF com ordem congelada conserva índices, tempos e poses na ROM. |
| JV05 / P1 | Timeline ficou com faixa de cartões de altura zero; recolher Comandos e aumentar o divisor liberou os cartões. O divisor voltou ao padrão ao reabrir Arte. | Reflow e persistência nos owners `ArtStudioTimelineSection`/LayoutSplitter, sem nova store. | Cartões e ações acessíveis a 1366×768 e 949×593, teclado/zoom; preferência conservada. |
| JV06 / P1 | Campo Prefab vazio é um span de largura zero; clique nativo não conseguiu editá-lo. | Editor de campo vazio com tamanho mínimo e foco em `InspectorPanel.tsx`. | Entrar, cancelar e salvar campo vazio por mouse e teclado. |
| JV07 / P1 | Terreno de tela inteira, quase todo transparente, levou a estimativa a 75/64 KB. | “Recortar área útil preservando posição” sobre PixelDoc/export/writer existentes. | Pixels visíveis e posição iguais antes/depois, alpha correto, Undo, orçamento e core conferidos. |
| JV08 / P1 | Trocar cenário conservou oito sólidos de plataforma invisível. | Oferecer manter/realinhar/reconstruir colisão, com overlay, alcance e Undo; sceneWorldModel/Viewport. | Arte, piso, spawn e limites concordam no editor e na ROM após troca/reabertura. |
| JV09 / P1 | Nove nós extras e ida ao Inspector foram necessários para idle/run/jump. | Estender o comportamento Movimento e salto com estados de animação, usando os mesmos nós e compiler. | Repouso/corrida/ar e retorno ao solo têm poses e tempos corretos, sem reiniciar indevidamente os ciclos. |
| JV10 / P1 | O personagem conserva a orientação direita ao mover para esquerda. | Orientação/espelho no mesmo comportamento e emitter SGDK, reutilizando flip de hardware quando suportado pelo contrato. | Movimento dos dois lados, troca de direção no chão/ar e save/reopen conservam arte e colisão. |
| JV11 / P2 | O modelo ocupa os quatro bancos antes da entrada de arte própria; decisão técnica aparece cedo. | Proposta de paletas por tarefa com consumidores, antes/depois e restauração, sobre `palettePlan`. | Inserir/trocar arte sem recolorir usuários compartilhados silenciosamente; conflito e impacto claros. |
| JV12 / P2 | Paralaxe está no aprofundamento da câmera; outro painel de efeitos pode parecer a entrada óbvia. | Expor Céu distante/Chão próximo ligados aos mapas reais no configurador/contexto existentes. | Usuário encontra a razão, vê a composição real e comprova dois deslocamentos sem conhecer planos VDP. |
| JV13 / P2 | Abrir no ambiente da sessão usou cache XDG diferente e deu DRIFTED; o runtime do operador tinha trava vazia já registrada. | Manter launcher/cache explícitos e diagnóstico legível. Nesta missão usou-se perfil/runtime próprios, sem mexer na trava. | Atalho e launcher identificam ambiente/versão; não removem trava ambígua nem pedem instalação desnecessária. |
| JV14 / P2 | Na captura adicional, pausa logo após carregar e 22 quadros do core ainda mostraram boot preto; o primeiro quadro não preto depois era uma montagem parcial. A captura qualificada usa a cena posterior, no frame 500. | Distinguir carga da ROM, recebimento de quadros e inicialização observável do projeto no Viewport/runtimeLink. Não usar “não preto” como oráculo universal de cena pronta. | O estado inicial transitório é compreensível e a prova de cena completa usa os elementos/estado esperados, não só um primeiro pixel. |

## Limites e próximo passo

O ator usa arte original, sem formas de placeholder. A qualidade estética continua sujeita à avaliação do operador; conformidade e correspondência de pixels não aprovam automaticamente arte AAA. A orientação para a esquerda permanece uma lacuna identificada. A medida de FPS de apresentação variou no host virtual; não há claim de suavidade/60 FPS, áudio físico, Windows, console ou estudo humano concluído.

O PDF ensina o caminho observado e entrega um projeto pronto para reduzir o custo de repetir a parte de lógica. O próximo lote sugerido começa em JV01, seguido da troca de arte e da animação por estado. Reproduzir cada causa no owner, implementar/regredir e então repetir a jornada no binário novo; a certificação do candidato congelado não aprova uma correção futura.

Proteção e hashes dos arquivos entregues ficam no manifesto/recibo privado do pacote. A cópia compactada local permanece no mesmo filesystem, sem alegação de recuperação independente. Nenhum asset, ROM, captura ou projeto privado deve entrar no Git público. O roadmap e os aceites humanos permanecem inalterados.

O coordenador longo do driver terminou com 143; a causa não foi isolada e seu recibo original ficou `RUNNING`, preservado. Depois de concluir as capturas/provas, a inspeção confirmou ausência dos PIDs próprios 1715608/1715766/1715770 e de processos com este `RDS_WORK_ROOT`. Só a lease válida e identificada desta missão foi arquivada sob o mutex canônico; recibo separado em `service-cleanup.json`. A trava vazia do operador conservou tamanho e mtime. Esse lançamento interrompido não é certificado nem PASS retroativo; o diagnóstico READY e as provas do aplicativo/core têm recibos próprios.


## Proposta contextual de workspace — 2026-11-05 (mockup para ajuste)

Novo pedido do operador: organizar as ideias de contexto, painéis recolhíveis, isolamento, identidade de cenas/nós e filtros de camadas/cores, e apresentar imagens para discussão. **Este incremento é uma proposta visual; não implementa essas interações nem altera o projeto Correio das Nuvens.** As correções JV já executadas estão na seção posterior e mantêm suas evidências próprias.

Dois mockups privados em `RDS_WORK_ROOT/sessions/tutorial-megadrive-20261105/mockups-contextuais/`:

- `01-cena-contextual.png` (*composição ilustrativa · não representa um estado único*): herói selecionado, menu do botão direito, isolamento, paleta e camadas, painéis abertos/recolhidos com fixação.
- `02-cenas-e-logica.png` (*composição ilustrativa · não representa um estado único*): mapa de cenas A→B, A→C e C→A; thumbnail e fundo sutil da cena ativa; nós A1…A4, contexto do objeto e Inspector compacto.
- `prompts.json` e `manifesto.json`: prompts integrais, modo imagegen embutido, origens, dimensões e SHA-256. Imagens 1586×992, aproximadamente 1,7 MB cada; originais preservados. Ponte e Gruta são exemplos visuais, não cenas autoradas no projeto. Os valores, cores e disposição são ilustrativos; animação e responsividade não são demonstradas por uma imagem estática. Cópias no mesmo filesystem, sem backup independente qualificado.

### Ideias do operador organizadas

| Eixo | Interação proposta | Regra para manter clareza |
|---|---|---|
| A — Ações no objeto | Clique seleciona; duplo clique no sprite abre arte/animações; botão direito oferece lógica, animações, paleta, novo comportamento/movimento/golpe, isolamento e vínculos. | Mesmas ações no canvas e na hierarquia; título do menu identifica o alvo. A ação também fica disponível por botão e teclado. Escolher uma tarefa conserva o objeto e permite voltar à cena. |
| B — Painéis contextuais | Paleta, propriedades, animações, comportamentos e camadas mostram cabeçalho compacto, ícone, nome e resumo; abrem para edição completa. Podem ser encaixados, agrupados ou destacados dentro da janela de trabalho. | Usar a paleta do objeto/área selecionada. Fixar mantém aberto; recolher conserva uma linha reconhecível. Abertura por clique/foco intencional, com acesso por teclado; não depender só de hover. |
| C — Isolamento | Isolar o herói ou um conjunto reduz a presença dos demais itens; opção de atenuar ou ocultar o restante. | Selo «Isolando Nalu», nome do alvo e «Sair» sempre visíveis; Esc/Mostrar tudo restauram a visão anterior. Objetos ocultos continuam encontráveis na hierarquia. |
| D — Cenas e nós | Mapa mostra ligações dirigidas entre cenas; escolher A abre seus nós. Thumbnail no cabeçalho e marca d'água discreta identificam a cena. Referências A1, A2…; em B, B1, B2… | Direções e condições dos caminhos legíveis, inclusive retornos e bifurcações. A referência visual deve ser estável ao organizar/renomear; não substituir IDs internos nem misturar conexões entre cenas com fios de execução dos nós. |
| E — Camadas e cores | Fundo A, Fundo B e sprites têm estados Normal/Atenuado/Oculto; a paleta permite filtrar uma cor da seleção. Intensidade da atenuação configurável. | Nomear o estado, sem depender apenas de checkbox, cor ou ícone. Exibir «Só nesta visão» e «Mostrar tudo». Esses filtros servem ao editor; alterar paleta/visibilidade do jogo é uma ação de autoria distinta e explícita. |

### Sugestões adicionais para revisão

1. **Contexto persistente:** projeto → cena → objeto → tarefa, com miniatura do objeto e retorno à cena. Um clique em «Ver nós» deve localizar e enquadrar o comportamento correspondente.
2. **Recolhimento previsível:** abrir a seção acionada e recolher outra seção livre do mesmo grupo; painéis fixados permanecem. Não recolher durante digitação, arraste, escolha de cor, popup ou operação pendente. Proposta inicial de transição 180–220 ms, respeitando a preferência de movimento reduzido; duração sujeita ao teste de uso.
3. **Referências estáveis e busca:** A3 continua A3 após «Organizar» ou excluir A2; título humano pode mudar. Para mais de 26 cenas, continuar AA, AB… sem trocar IDs do projeto. Busca por cena/objeto/referência localiza a ocorrência e seus vínculos. A exibição precisa resolver referências por cena mesmo quando há vários grafos de objetos.
4. **Seleção e bloqueio separados:** cadeado evita arrastar o chão enquanto se move o herói; atenuação só muda a visão. Uma ação de voltar ao layout padrão e a persistência dos painéis por área evitam perder a organização.
5. **Ações prontas com parâmetros:** no contexto do herói, «Adicionar comportamento» oferece movimento/salto e outros comportamentos realmente suportados. O usuário ajusta os campos e pode abrir os nós gerados. Um golpe novo deve partir do contrato existente, sem prometer CNS ou movimentos ainda não suportados.
6. **Escopo da paleta visível:** filtrar um índice atua no objeto/recurso selecionado, sem apagar a mesma cor de todos os itens por coincidência de RGB. Trocar uma paleta compartilhada mostra os usos afetados e permite escolher uma variante antes de aplicar.

### Integração prevista e aceite futuro

Inspeção de fonte em `d51c56da`: `ViewportPanel.handleSceneDoubleClick` dá precedência ao grafo de lógica antes do sprite; o canvas apenas cancela `contextmenu`. Isso explica a diferença entre o duplo clique esperado e o caminho de código atual; **não é um novo teste nativo**. O produto já tem Focus/Solo, `LayerPanel`, `StudioContextBar`, `ContextualPalette`, `PalettePanel`, grupos recolhíveis no grafo e histórico/layout existentes. A proposta deve estender esses owners e `editorStore`/`studioContext`/`palettePlan`, sem uma store, um editor de nós ou um sistema de execução paralelo.

Prioridade sugerida para discussão: **1)** gestos/menu coerentes e contexto persistente; **2)** painéis compactos/fixação e filtros/isolamento reversíveis; **3)** visão de cenas, thumbnails e referências estáveis. Aceite de implementação futura: atravessar Cena→Arte→Lógica→Cena mantendo alvo; usar menus por mouse/teclado; conferir painéis e retorno em janelas menores; seguir A→C→A; e comprovar que filtros exclusivamente visuais não alteram cena salva, paleta do jogo ou ROM. `LayerPanel` já persiste `visible`, portanto esse campo não deve ser reutilizado silenciosamente como filtro temporário. Marca d'água desligável e seu contraste dependem da revisão humana.

O próximo passo desta proposta é ajustar os mockups com o operador. Não foram adicionadas superfícies de produto nem modificada a maturidade do roadmap. O PDF e o pacote originais do tutorial permanecem preservados; estes mockups são uma revisão conceitual posterior.

## Reavaliação crítica R2 — 2026-11-05 (histórico; direção atual em R5)

A direção visual foi revista pelo operador em [R5 — autoria visual robusta](#r5-autoria-visual), em 2026-11-06. A R2 abaixo conserva as decisões e limites da época.

O operador forneceu uma avaliação externa baseada nas duas imagens e no resumo, sem leitura da especificação ou das fontes. A crítica identifica problemas reais de comunicação dos mockups R1: navegação global duplicada, duas hierarquias com organizações diferentes, botões de animação dentro de comportamento e isolamento inconsistente. A especificação textual anterior não compensa esses erros visuais. **R2 passa a ser a referência de UX para discussão; R1 fica preservada como histórico. Nenhuma dessas interações foi implementada por esta revisão.**

A fonte do produto inspecionada continua `d51c56da`; a entrada desta revisão é o fechamento documental `5268c968`. Avaliação original, dois PNGs selecionados, prompts integrais e manifesto privados: `RDS_WORK_ROOT/sessions/tutorial-megadrive-20261105/mockups-contextuais/revisao-critica/`. SHA-256 da avaliação recebida `fff3a8de538cf70dbfc164467eb1e05e048a0cb9f528230cc31181ad57f19bc8`. Geração por imagegen embutido; originais e R1 preservados. A segunda imagem é outro estado ilustrativo, com isolamento inativo; não é uma sequência de execução da primeira. Ponte, Gruta, conexões e números de nós são exemplos.

### Decisões sobre os apontamentos

| Apontamento | Reavaliação e síntese R2 |
|---|---|
| Navegação duplicada | **Incorporar.** Lateral: Cena, Arquivos, Teste e Depurar. Tarefas da seleção: Arte, Comportamentos e Nós. Sem seleção, mostrar ações da cena/estado vazio, sem abas de objeto sem alvo. Menu e teclado são atalhos das mesmas ações. |
| Hierarquias divergentes | **Incorporar.** Uma árvore Objetos e camadas; grupos, objetos, visibilidade e bloqueio no mesmo lugar. Ordenação deve corresponder à composição suportada. O drawer do mapa descreve cenas/transições, não outra lista de camadas. |
| Animação confundida com comportamento | **Incorporar.** Comportamento mostra velocidade, salto e botão. Animações mostra clipes/quadros/tempos. O vínculo é explícito: «Ao pular → animação jump». Nós mostram a regra. A mesma seleção é conservada entre tarefas. |
| Menu sobre o herói e ações ausentes | **Incorporar.** Posicionar fora da seleção, com ajuste aos limites da janela. Incluir duplicar, renomear, excluir e organização permitida no plano. «Onde Nalu é usado» substitui «Localizar vínculos». Excluir fica separado das ações frequentes. |
| Alfinetes e resumos | **Incorporar com ajuste.** Resumos mostram valores e escopo. Fixação aparece no hover **e no foco de teclado**; painel fixado conserva indicador. Menu de opções permanece encontrável. Não recolher um painel com foco, popup, arraste ou edição pendente. |
| Isolamento inconsistente | **Incorporar.** Atenuar todo conteúdo não selecionado, incluindo céu e chão. Preservar máscaras anteriores; uma camada antes oculta não deve reaparecer. Indicador único «Isolando Nalu · só no editor»/Sair. Esc respeita primeiro popups/edições internos. |
| Mapa reduzindo o grafo | **Incorporar.** Grafo usa a altura útil; mapa abre sob demanda em drawer ou visão ampliada, sem ficar permanentemente empilhado sobre os nós. Em janela estreita, alternar drawer/grafo conservando posição e seleção. |
| Ligações sem origem | **Incorporar.** Mostrar cena de origem/destino, objeto/gatilho e nó responsável. «Ver origem» abre e enquadra esse nó. Ligações devem derivar dos `load_scene`/contratos existentes, não de um segundo grafo de execução editado à parte. Destino dinâmico/desconhecido deve aparecer como tal, sem inventar uma aresta certa. |
| Códigos A1, A2… | **Ajustar.** A1 não é intrinsecamente inválido como apelido, mas codificar a cena no identificador cria fragilidade ao mover/copiar. R2 usa N01, N02… como referência visual estável no projeto, cena à parte; IDs internos continuam canônicos. Cópia ganha identidade nova; movimento conserva identidade quando suportado; exclusão não renumera outros nós. |
| Saída Não solta | **Incorporar.** Mostrar «Sem ação» e «+ Ligar». É um auxiliar da porta livre, não um quinto nó nem erro obrigatório; o ramo pode intencionalmente não executar nada. |
| Força duplicada no nó e painel | **Incorporar.** Um valor no modelo existente; campos são projeções sincronizadas. Uma superfície de edição ativa, resumo e destaque na outra. A imagem R2 evita duas entradas simultâneas e mostra Editar no nó. |
| Cor selecionada duplicada | **Incorporar.** Uma indicação de seleção na grade; legenda/valor textual pode explicar o índice sem criar outra amostra que pareça uma segunda seleção. Filtro visual atua no índice/recurso selecionado, não em todos os RGBs semelhantes. |
| Desfazer visibilidade ou restaurar layout | **Corrigir a alternativa.** Restaurar layout só organiza painéis; Restaurar visão desfaz máscaras/filtros. Sair do isolamento recupera o estado anterior. Oferecer reversão explícita da mudança de visão sem confundir com Undo de autoria. |
| Estados vazios | **Incorporar.** Cena vazia: «Arraste um sprite ou comece por um modelo». Grafo vazio: «Adicione um comportamento pronto». Sem seleção: instruir seleção, sem painéis de um objeto antigo. Esses estados estão especificados; os dois PNGs mostram estados com conteúdo. |
| Arco do salto ao vivo | **Incorporar como estimativa.** Mostrar alcance/origem dos parâmetros e o rótulo «Arco estimado · confirmar no teste». Só poderá representar trajetória fiel se usar as mesmas regras discretas, colisões e contexto efetivamente validados no core. |
| Substituir Salvar por autosave | **Não adotar como troca imediata.** O produto já distingue rascunho, revisão salva, conflito e falha. Mostrar «Rascunho protegido · alterações por salvar» após confirmação real, mantendo Salvar. Autosave do projeto é uma evolução separada, opt-in, condicionada à recuperação, conflitos e assets/grafos coerentes. |
| Atalhos e busca | **Incorporar com escopo.** Busca de comandos/cenas/objetos/nós, atalhos visíveis e equivalentes por teclado para menus. V/H/I e Ctrl+K são sugestões a reconciliar com bindings existentes; não capturar digitação/IME nem atalhos do editor de campos. |
| Loop, FPS e onion skin | **Incorporar à apresentação de Arte.** Esses conceitos já existem em `ArtStudioPanel`, `CharacterTimelinePanel` e `useSpriteAnimator`; não criar outro animador. A tira completa fica em Arte, não na tarefa Comportamentos. A ausência no mockup não prova ausência no produto. |
| Acessibilidade/contraste | **Incorporar como requisito, sem certificar por aparência.** Medir cores/fontes/estados reais, foco e tabulação; cabeçalhos e ações com nomes acessíveis; não depender só de cor, hover ou movimento. Movimento reduzido cobre todos os recolhimentos/transições. |
| Testar da cena/do objeto | **Incorporar cena atual; qualificar objeto.** «Testar cena atual» encurta o ciclo quando implementado no launcher/runtimeLink oficial. Para um objeto, iniciar perto dele preservando sua cena; não prometer teste isolado que descarte chão, câmera, colisões ou dependências. |

### Onde a concordância não é literal

**Atalhos úteis não são uma segunda navegação global.** Menu de contexto, botão no Inspector e atalho podem levar à mesma tarefa, desde que disparem a mesma ação e reflitam a mesma seleção. A duplicação ruim era ter seletores globais concorrentes no topo e na lateral. Remover todos os acessos alternativos aumentaria o esforço.

**Autoproteção e salvamento durável são estados diferentes.** `scenePersistence.ts` já confere a escrita do rascunho, registra revisão e trata conflito com cena/grafos salvos. R2 não mascara esses estados com um «Salvo há 5 s» genérico. Indicador de sucesso só aparece depois do recibo correspondente. Autosave futuro não substitui Undo, versão ou recuperação por si só.

**Arco, ordenação e teste precisam respeitar o alvo.** A curva desenhada é uma estimativa, não prova do salto na ROM. «Trazer para frente» deve respeitar planos, prioridade e composição efetivamente suportados; por isso o menu usa «Organizar no plano». Testar um objeto mantém o contexto da cena. Essas distinções evitam apresentar uma simulação gráfica como comportamento confirmado do jogo.

**A preocupação com contraste procede; a reprovação AA ainda não foi medida.** A referência WCAG 2.2 pede contraste de texto normal de pelo menos 4,5:1, com exceções como texto grande (3:1). Na implementação, conferir cores de fonte/fundo e estados reais, não inferir o resultado apenas pelo estilo escuro ou por um raster reduzido. [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Conteúdo contextual deve também funcionar ao foco, permitir dispensa quando aplicável e permanecer disponível durante a interação; isso fundamenta o ajuste ao «alfinete só no hover». [W3C — conteúdo em hover/foco](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html). Nenhuma imagem gerada recebe certificação de acessibilidade.

### Acréscimos além da avaliação externa

1. **Escopo da alteração antes da ação:** «Esta instância» versus modelo/recurso compartilhado; mostrar os usos afetados e oferecer variante quando o contrato permitir. Não expandir uma mudança de Nalu para todos os consumidores silenciosamente.
2. **Separar as três recuperações:** Sair do isolamento restaura a visão anterior; Restaurar visão remove filtros temporários; Restaurar layout reorganiza painéis. Nenhuma deve desfazer uma edição de arte ou lógica por associação implícita.
3. **Uma origem de verdade:** parâmetros, nós gerados e resumo de comportamento editam o modelo canônico; conexões entre cenas são uma leitura rastreável desse modelo. Mapa, formulários e preview não ganham compiladores/stores concorrentes.
4. **Seleção múltipla e resposta atrasada:** mostrar «3 objetos»/«valores diferentes», oferecer apenas ações compatíveis e impedir que uma resposta assíncrona aplique edição no objeto selecionado depois. Preservar o trabalho ao trocar tarefa/cena.
5. **Reversão e foco previsíveis:** Esc fecha primeiro o popup/campo mais interno, depois sai do isolamento quando cabível; desfazer de autoria e reversão de filtros são identificáveis. Não roubar foco nem recolher controles usados pelo teclado.
6. **Distinguir edição, estimativa e teste:** o editor identifica sua prévia; o teste identifica a cena/revisão executada. Uma ROM anterior ou um arco ilustrativo não pode receber a marca de resultado da edição atual.

### Ordem proposta e aceite antes de implementar mais superfícies

| Lote de UX proposto | Ganho buscado | Aceite da jornada futura |
|---|---|---|
| 1 — Contexto único | Navegação, árvore e gestos coerentes | Selecionar Nalu → Arte → Comportamentos → Nós → voltar à cena, sem perder objeto, revisão ou edição; menu e teclado chegam à mesma tarefa. |
| 2 — Trabalho reversível | Parâmetros claros, isolamento/filtros e painéis previsíveis | Ajustar salto sem montar nós manualmente; foco e painel permanecem durante edição; desfazer restaura o parâmetro. Isolar/filtrar/sair não muda cena/paleta/ROM salvas e recupera máscaras anteriores. |
| 3 — Rastreabilidade | Nós legíveis e mapa de cenas sob demanda | Encontrar A→C, abrir o nó de origem, distinguir o objeto dono, voltar ao ponto anterior. Organizar/copiar/mover preserva a identidade aplicável e não cria conexão de execução por apenas mover um cartão. |
| 4 — Ciclo curto de teste | Estimativas úteis e execução oficial identificada | Prévia estimada visível; teste da cena no Tauri → Build → ROM → core com a revisão certa. Estados de salvar, erro e conflito continuam explícitos. |

Acessibilidade, estados vazios, foco e adaptação de janela entram em cada lote, não ficam para uma fase de acabamento. Comparar o fluxo atual e a proposta com iniciante: tempo/ações até editar e testar, hesitações, enganos entre animação e ação e capacidade de desfazer. Não há resultados humanos medidos nesta revisão. Avaliar também 1366×768 e 949×593; a imagem 1586×992 não valida essas dimensões, teclado, leitor de tela ou movimento.

Owners existentes: `ViewportPanel`/`HierarchyPanel`/`LayerPanel`, `StudioContextBar`/`studioContext`/`editorStore`, `scenePersistence`, `ArtStudioPanel`/`CharacterTimelinePanel`/`useSpriteAnimator`, `NodeGraphEditor`/`behaviorLibrary`/`nodeTypes` e `runtimeLink`. Próximo: revisão dos PNGs R2 com o operador, depois um lote restrito no owner com regressão e jornada Tauri. Sem reescrita geral, motor paralelo ou promoção de maturidade. O tutorial/PDF/projeto anteriores continuam preservados.

## Ajustes R3 reavaliados e prompt de implementação — 2026-11-05

Novo pedido do operador: reavaliar dez ajustes externos e preparar um prompt completo para implementar a base R2 e R3 com segurança. **Nesta fatia foram preparadas instruções; nenhum item de produto R3 foi implementado.** A R3 complementa R2, sem substituir a jornada e as provas JV. O [prompt executável](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md) reúne contexto, owners pesquisados, escopo base, lotes, regressões, retenções e gates.

A entrada foi lida no scratchpad indicado pelo operador e preservada em `sessions/tutorial-megadrive-20261105/mockups-contextuais/revisao-critica/r3-ajustes-recebidos.md`, fora do Git; SHA-256 `5b7aca1777e33572f5b1b75f7dffdd1f028d98413dbb7e468839383c67369441`. O prompt não depende desse temporário nem de fontes do projeto SteamZero. Base local de preparação `b9a6e151`; fonte de produto inspecionada `d51c56da`. As qualificações abaixo prevalecem sobre a leitura literal de «prontos para implementação» da revisão recebida.

| ID | Decisão após conferir o código | Aceite/regressão que o prompt exige |
|---|---|---|
| R3-01 | Escopo por origem efetiva de cada bloco, sem classificar toda arte/animação como recurso compartilhado nem todo comportamento como instância. Integrar impacto/Aplicar a todos/Cancelar/variante já existentes em PalettePanel/palettePlanStore. | Consumidores e índices corretos no contexto da cena/build; cancelar sem mutação; aplicação, variante, orçamento, Undo e resposta tardia. Não usar PAL1 como identidade global. |
| R3-02 | Estado escolhido do editor separado da máscara derivada; saída remove a máscara e não sobrescreve escolhas novas. Não serializar isolamento como alteração autoral de camada/pixels. | Oculto/atenuado/normal preservados; alteração deliberada durante isolamento, troca/exclusão do alvo, rótulo acessível e ausência de mudança de gameplay. |
| R3-03 | Origem gerada visível e transição semântica explícita/reversível. Layout não converte para manual; parâmetro mapeável prefere receita/formulário. Regenerar pelo planner existente e mostrar impacto. | Legado JV09/face_direction, cancelamento, gerado/manual/Undo/Redo, nós externos/dependentes/conexões, save/reopen e animação/espelho no core. |
| R3-04 | Resolver instância/modelo/origem externa de fato, com a mesma fonte no grafo e Inspector. Não habilitar gravação de prefab pelo simples ato de abrir um grafo herdado. | Escopo/contagem/cenas corretos, overrides e origem indisponível; aplicação compartilhada explícita e cancelamento integral. |
| R3-05 | Faixa/default/unidade no contrato existente. MD: `sprite_move` usa pixels; `set_velocity` integra em escala 16. O impulso bruto 64 não representa 64 pixels de altura nem 64 px/quadro. Input deriva de emulatorService/target. | Valores inválidos ficam só no draft, parâmetro anterior preservado; validade, unidades e mapeamentos; mesmo valor em formulário/nó/resumo e um Undo por edição. |
| R3-06 | Mapa derivado, dono/gatilho por foco e hover, busca e referências visuais estáveis sem trocar IDs internos. Distinguir transição declarada de execução suportada. | Persistência/unicidade dos códigos; busca/abrir origem/retorno; destinos desconhecidos sem aresta inventada. Contraprova da semântica de load_scene no pipeline oficial antes de alegar troca na ROM. |
| R3-07 | Cabeçalho compacto com fixture de tamanho conhecido; thumbnail grande só no seletor. | Medir árvore no Tauri 1366×768 e 949×593, preservando zoom/fonte e alcance de objetos/grupos. Sem garantia impossível para qualquer lista arbitrariamente grande. |
| R3-08 | Descoberta por hover/foco e bloqueado sempre indicado. Reconciliar lock de objeto e lock herdado da camada, sem criar camada artificial nem bloquear outros atores. | Acesso por árvore/teclado para inspecionar e desbloquear; canvas não modifica alvo protegido; estado herdado claro, save/reopen e ausência de efeito em gameplay. |
| R3-09 | Opções de início exigem contrato de intenção/snapshot no shell/IPC/build canônico. runtimeLink identifica a execução; não inicia o jogo. Manter cena inteira e projeto autoral intacto. | Build normal compatível; início válido/inválido, revisão/ROM corretas, duas intenções distintas quando suportadas; Tauri/SGDK/core, sem editar/restaurar entry_scene ou usar RAM poke como implementação. |
| R3-10 | Corrigir legenda/marcadores e identificar composição ilustrativa; preservar versões anteriores. | Revisão documental/visual, sem impacto de código ou alegação de interface implementada. A correção das imagens é tarefa prevista no prompt, não entrega desta preparação. |

Retenções técnicas **T1–T6** no prompt: origem/consumidores; estado de visão; gerado versus manual; persistência dos códigos; load_scene; início do teste. Não são pedidos rotineiros de autorização: a implementação deve resolver contratos reversíveis no owner, manter limites explícitos e reter apenas itens/dependentes sem evidência. A inspeção encontrou `load_scene` no catálogo e emissão só de comentário no TS legado, sem ramo dedicado no AST canônico pesquisado; isso exige contraprova, não autoriza promover o legado a compilador oficial nem abrir um motor novo.

Ordem: lote 0 prepara contratos/regressões/linha de base; lote 1 integra navegação, gestos, árvore e contexto/escopo/cabeçalho/bloqueio; lote 2 fecha painéis, filtros, reversão, geração, unidades e paleta; lote 3 rastreabilidade; lote 4 feedback e início de teste. Assim, a base R2 é implementada junto dos ajustes R3 correspondentes. R3-10 é documental e independente. A confirmação de usos não pode ser adiada para depois de habilitar uma nova mutação compartilhada desprotegida. Acessibilidade, estados vazios e Tauri nas duas resoluções acompanham cada lote.

Prova desta preparação: leitura dos dez itens e owners existentes, revisão de referências/diff e checks documentais proporcionais. Host diagnosticado READY no launcher `2026-11-06T01-47-25-268Z-1146152`. O teste completo de produto, implementação de schema/IPC e jornadas nativas R3 ainda não foram executados. `AGENTS.md` do operador preservado; autenticação GitHub ausente continua limitando publicação. Recibo de fechamento junto à entrada R3 privada. Próximo: entregar este prompt a um agente de implementação, que deve revalidar HEAD/host/contratos antes do lote 0.

<a id="r5-autoria-visual"></a>
## R5 — Canvas de autoria visual robusta — 2026-11-06

**Direção aprovada pelo operador em 2026-11-06, após a correção explícita de escopo.** Esta revisão reúne R2, os contratos R3, as observações da avaliação e o pedido de ferramentas visuais de produção. Aprovação conceitual para orientar a implementação; não é validação humana do aplicativo. Entrega: mockups e especificação, sem mudança no aplicativo, no projeto autoral ou na maturidade. Base documental `2bf413c8`; fonte de produto inspecionada `d51c56da`. O requisito adicional de experiência de jogo está na [R6](#r6-jogar-emulador). A [R7](#r7-ferramentas-visuais) amplia paletas/composição/efeitos e explicita capacidades omitidas no desenho; a R5 é referência visual parcial, não limite funcional.

### Diretriz e erro corrigido

O produto deve apoiar jogos de alta performance, gráficos elaborados e mecânicas ricas por uma interface moderna, amigável, dinâmica e flexível. Clareza deve organizar a capacidade, preservando precisão, ferramentas robustas e liberdade de composição.

A tentativa R4 reduziu a navegação a quatro destinos e mostrou sobretudo seleção, propriedades e teste. O operador rejeitou essa direção: ela representava o Canvas como moldura estática com poucos ajustes e não mostrava como construir movimentos, trabalhar planos ou manipular qualquer objeto. **R4 fica preservada como proposta rejeitada por redução de capacidade; não deve ser copiada como alvo de implementação.** Em R2/R3, a orientação de retirar Arte/Lógica/Efeitos da navegação global foi superada pelo pedido atual. Os contratos de origem, reversão, persistência e evidência continuam válidos.

A diretriz está nas [instruções do projeto](../../AGENTS.md#diretriz-de-produto-autoria-visual-robusta), no Memory Bank e na memória permanente, página `decisions/interface-robusta-autoria-visual.md`, fixada no projeto. Ela não altera as decisões arquiteturais consolidadas nem autoriza uma reescrita.

### Duas visões da mesma proposta

Artefatos privados, originais, correções e prompts integrais em `RDS_WORK_ROOT/sessions/tutorial-megadrive-20261105/mockups-contextuais/r5-autoria-visual-20261106/`; `manifesto.json` registra origem, tamanho e SHA. Geração por imagegen embutido, baseada na captura histórica `entrega/screens/FINAL-editor.png`, no sprite original `nalu32.png` e na linguagem visual já trabalhada. Não foi fornecido vídeo utilizável nesta rodada. Os PNGs são ilustrações sintéticas, não capturas de execução. Plataforma móvel e seu trajeto são exemplos adicionados só ao mockup; os dados do jogo do operador ficaram intactos.

| Visão | O que representa | Arquivo / SHA-256 |
|---|---|---|
| Trajetos visuais | Plataforma selecionada, curva com pontos e alças, entrada precisa, duração, ida e volta, prévia e vínculo com regra do objeto. Navegação global completa permanece à esquerda. | `01-trajetos-visuais-r5.png` — *composição ilustrativa · não representa um estado único*, 1672×941, `5a788bb85f79e2b797a432857f8dcf917d39ae4f60d7fffde364969c2f6798d4` |
| Planos e paralaxe | Céu no Plano B isolado; demais conteúdos atenuados. Arraste/sonda de câmera, razões horizontal/vertical e comparação do deslocamento de A/B. | `02-planos-paralaxe-r5.png` — *composição ilustrativa · não representa um estado único*, 1672×941, `23d6d9a3cb2720995c329d89cdff1bf2e14a942104f5687a79fc90712a53a993` |

Foram solicitadas imagens de apresentação 2560×1440; as saídas efetivas são as dimensões da tabela. Não representam validação em 1366×768 ou 949×593. Ícones, tamanho aparente, posicionamento de pixels, curva e razões ilustradas precisam de correspondência no produto antes de qualquer aceite técnico. O chip «Atenuado pelo isolamento» é informativo; não deve virar opção de estado escolhido. O objeto que recebe edição deve estar efetivamente desbloqueado.

A R4 anterior está em `mockups-contextuais/r4-canvas-20261106/`, com três imagens, prompts e manifesto. R1/R2 e as versões anteriores à correção R5 permanecem preservadas. Orçamento R5: 32 MiB; quatro PNGs e receitas ocupam cerca de 6,9 MiB. Retenção até revisão do operador e proteção independente. Originais no CODEX_HOME e cópias no runtime estão no mesmo volume; não constituem backup independente. Especificação, decisões, owners e receitas resumidas ficam versionados; assets privados não entram no Git.

### Navegação e autoria por objeto

1. **Navegação global persistente.** Cena, Arquivos, Arte, Lógica, Teste, Efeitos e Depurar permanecem acessíveis à esquerda, independentemente da seleção. Preservar também as entradas existentes de Interface/Entrega/importação nos destinos oficiais; o recorte do mockup não autoriza removê-las. Em janela estreita, reduzir a largura da navegação com rótulo acessível e foco, sem fazê-la desaparecer.
2. **Faixa horizontal contextual.** Cena/objeto/origem identificados, com atalhos para composição, arte vinculada, movimento, planos, nós ou recursos compatíveis com o alvo. Arte global abre o workspace disponível; «Arte do objeto» abre seu recurso e preserva retorno. São rotas dos owners existentes, não novos editores.
3. **Qualquer objeto compatível.** Herói, inimigo, plataforma, prop, sprite, mapa, câmera, região e gatilho podem ser selecionados e manipulados conforme seus componentes. Sem seleção: ações da cena e criação/entrada de conteúdo. Seleção múltipla: valores comuns ou «misto», transformações com pivô/alcance claros e aplicação transacional.
4. **Manipulação visual com precisão.** Arraste, guias, alinhamento, distribuição, grade/encaixe e campos X/Y trabalham sobre os mesmos dados. Ferramentas aparecem por capacidade; escala/rotação de arte, sprite e mapa precisam de contrato do alvo, não de um manipulador genérico que prometa suporte inexistente.
5. **Acesso e conservação.** Menu de contexto identifica alvo e alcance; árvore resolve sobreposição; duplo clique e teclado chegam às mesmas operações. Salvar, Undo/Redo, cancelamento, bloqueio herdado, perda de seleção e falha de recurso permanecem explícitos. Recolher painéis preserva edição, foco, seleção e estado de retorno.

### Desenhar movimento em vez de montar passos de pixel

**Fluxo proposto:** selecionar objeto → Trajeto → escolher Reta/Curva/Elipse/Caneta → desenhar → ajustar pontos e alças → definir reprodução → conferir prévia → ligar acionamento nos nós → salvar → testar no pipeline oficial.

- **Geometria:** pontos inseríveis/removíveis, segmentos retos e curvas com alças, ponto suave/canto, fechar/abrir trajeto, inverter sentido e encaixar em grade/eixos. Elipse possui centro, raios e orientação editáveis visualmente e por números; converter para pontos deve explicitar a mudança de representação e ter Undo. Movimento do objeto e edição de uma alça não são a mesma ferramenta.
- **Espaço e origem:** mostrar se o trajeto está relativo à origem do objeto ou ao mundo; indicar início/fim e o objeto dono. Mover/duplicar objeto, aplicar ao modelo e reabrir cena conservam o contrato e não transformam referências compartilhadas em cópias silenciosas.
- **Tempo:** escolher duração ou velocidade como parâmetro principal; o outro é derivado, sem duas autoridades conflitantes. Definir espera nos pontos/extremidades e aceleração quando suportada. «Constante» em curva significa distância por tempo, não apenas incremento uniforme do parâmetro da curva. Conversão segundos/quadros usa a frequência do alvo e regra de arredondamento declarada.
- **Reprodução:** uma vez; repetir caminho fechado; ida e volta; reiniciar caminho aberto somente com retorno explicitado. A repetição não pode introduzir teleporte oculto. Definir se duração é por trecho, percurso ou ciclo completo; o exemplo de 2 s é por percurso de ida, com espera de 0,3 s em cada ponta.
- **Prévia:** reproduzir, pausar, avançar e arrastar o tempo; fantasma é identificado e não cria entidade. Parar restaura o estado autoral, sem gravar posições transitórias. A prévia de geometria não comprova colisão, física, transporte de personagem por plataforma ou resultado na ROM.
- **Nós:** gatilho, condição, atraso, iniciar, pausar, retomar e parar operam sobre o mesmo trajeto identificado. A faixa «Ao iniciar → Esperar 0,5 s → Seguir trajeto» projeta o grafo do objeto; «Ver grafo» abre e enquadra sua origem. Não criar lógica duplicada no painel. Conclusão de percurso/ciclo, reinício durante execução e exclusão de referência exigem semântica explícita.
- **Interação e performance:** definir quem controla posição quando física, input e trajeto coexistem; política de colisão, plataforma que transporta atores e interrupção por eventos precisam de casos positivos/negativos. Avaliar representação determinística, precisão fixa e eventual tabela pré-calculada/comprimento de arco no pipeline existente, com limites de pontos, memória, custo por quadro e quantidade de objetos. Essa é investigação técnica pendente, não escolha de um novo motor nem promessa de 60 FPS.

### Planos, composição e paralaxe visuais

A árvore relaciona os objetos aos planos reais: Plano A/Plano B no alvo Mega Drive; sprites e guias ficam identificados separadamente. «Próximo» e «distante» são papéis editoriais do exemplo, não uma regra universal de prioridade. Grupos do editor não criam planos extras de hardware. Tiles e sprites têm prioridades próprias; mostrar conflitos de composição no contexto apropriado.

**Fluxo proposto:** selecionar plano ou mapa → isolar → ajustar origem/área no Canvas → configurar a relação de paralaxe → arrastar a sonda de câmera → comparar com a composição completa → aplicar/desfazer → testar a cena inteira.

- Seleção do Plano B mantém céu normal e atenua A/sprites, preservando conteúdo previamente oculto. «Sair» remove só a máscara; «Restaurar visão» e «Restaurar prévia» têm responsabilidades separadas. Alterações deliberadas feitas durante isolamento são conservadas.
- Controles de origem/área, guias e campos numéricos se correspondem. Recorte/células/imagem montada respeitam o owner de pixels/mapa, colisão e limites de alocação; nenhum recorte destrutivo silencioso.
- Razões X/Y são editáveis por alça/slider e número. No exemplo: câmera desloca 160 px, Plano A a 100% desloca magnitude 160 px e B a 25%, 40 px; o scroll de tela tem o sentido correspondente. Isso é conta ilustrativa, não medição de execução.
- A prévia compara planos em composição, isolamento e referência anterior. Sua câmera é uma sonda do editor; deslocá-la não move a câmera autoral nem muda o spawn.
- Separar **paralaxe relativa à câmera** de **scroll contínuo por tempo**. Câmera visual, RetroFX e nós não podem disputar a mesma origem de scroll silenciosamente. Conflito de owner fica visível antes de aplicar.
- Usos da paleta, índices, colisões, câmera e prioridades continuam acessíveis. R3-01/04 protegem edições compartilhadas; R3-02 protege máscaras; novas capacidades não dispensam essas proteções.

### Base real e lacunas a integrar

| Responsabilidade | Evidência de código nesta revisão | Direção R5 |
|---|---|---|
| Contexto e retorno | `studioContext.ts`, `editorStore.ts`, `StudioContextBar.tsx`, shell existente | Conservar navegação global e resolver acessos contextuais sobre os mesmos alvos. |
| Seleção/composição | `ViewportPanel.tsx`, `HierarchyPanel.tsx`, `sceneComposition.ts`, `sceneWorldModel.ts` | Ferramentas visuais por capacidade e árvore única; não limitar autoria ao herói. |
| Percurso de câmera | `CameraAdvancedControls.tsx`, `cameraWorkflow.ts`, `CameraWaypoint` em TS/Rust | Já existem pontos X/Y, duração/espera e interpolação linear de câmera. Não confundir com trajetória Bézier de objeto. |
| Paralaxe | `CameraConfigurator.tsx`, `CameraAdvancedControls.tsx`, `CameraParallax`, `SceneArtwork` | Já existem mapas, razões X/Y de 0–200% e prévia. Integrar descoberta e manipulação no Canvas; verificar runtime do alvo. |
| Scroll/efeitos | `RetroFXDesigner.tsx`, configuração de cena, nós e emitter SGDK | Reconciliar responsabilidade com câmera; não sobrepor writers concorrentes. |
| Curvas/elipses de objetos | Busca não encontrou autor visual genérico e contrato de execução por objeto; elipse do PixelEditor desenha pixels, não movimento | Capacidade nova proposta. Definir schema, escopo, compilação, eventos, migração e evidência por alvo antes de habilitar. |
| Grafo e reversão | `behaviorLibrary.ts`, `nodeTypes.ts`, `graphHistory.ts`, persistência de cena/grafo | Referenciar o trajeto único; preservar metadados gerados, conexões externas, Undo, cancelamento e save/reopen. |

### Integração com o plano anterior

Os lotes R3 continuam sendo a base de segurança e coesão. A R5 muda a direção visual e acrescenta investigação de autoria, sem promover novos recursos a implementados.

| Etapa | Complemento R5 | Aceite observável futuro |
|---|---|---|
| Lote 0 — contratos | Inventário de capacidades por objeto/alvo, navegação preservada e fronteiras entre dados autorais, máscaras e prévia. Delimitar curva de objeto versus percurso de câmera. | Matriz antes/depois sem ferramentas órfãs; casos de origem/escopo definidos. |
| Lote 1 — contexto | Menu global persistente, contexto horizontal, árvore de objetos/planos, manipuladores e campos numéricos coerentes. | Chegar a Arte/Lógica/Efeitos com qualquer seleção e voltar ao mesmo objeto; editar também plataforma/mapa/câmera. |
| Lote 2 — reversão | Integração visual de planos/paralaxe já existentes, isolamento, paleta, unidades e continuidade de painéis. | Arrastar/digitar → cancelar/Undo → salvar/reabrir preserva os mesmos dados; máscaras e prévia não alteram jogo. |
| Lote 3 — rastreabilidade | Grafo/recursos/nós e faixa contextual apontam para o mesmo owner. | Abrir origem, editar, voltar; sem assinatura manual falsa ou estrutura paralela. |
| Lote 4 — teste | Manter R3-09/T6: intenção de início, revisão e cena inteira no build oficial. | Falha ou resposta antiga não executa ROM como se fosse revisão atual. |
| Evolução R5 — trajetos | Contrato e implementação por fatias do novo recurso, seguindo a priorização do roadmap. | Reta/curva/elipse, loops/esperas/eventos, interação física, Undo/migração e efeito real no core; custos medidos. |

O [prompt existente](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md) recebeu a correção de direção e os pontos de integração. O [roadmap](../03_ROADMAP_MVP.md#autoria-visual-robusta-r5) registra a direção aprovada, com implementação pendente, sem substituir a prioridade de hardening.

### Qualidade, uso repetido e revisão humana

A composição procura reduzir competição de bordas, preservar tipografia e reservar realces para seleção, foco e modo. Isso não exige remover ferramentas. Painéis redimensionáveis/fixáveis, busca, atalhos e reflow devem manter acesso e estado; não recolher foco/edição pendente. Na janela de 949×593, a navegação global continua presente e o espaço dos painéis pode alternar, com retorno explícito. Não encolher toda a interface para caber nem eliminar comandos avançados.

Revisar no Tauri em 1366×768 e 949×593 com escala real, teclado, ponteiro e nomes acessíveis; medir contraste nas cores finais, tamanho dos alvos e legibilidade dos estados. PNG não comprova esses critérios.

Protocolo humano proposto, ainda não executado: três ciclos de desenhar/alterar trajeto, trocar de objeto, isolar A/B, ajustar paralaxe, visitar os nós e testar/desfazer. Pode-se reservar 20–30 minutos como sessão inicial, ajustável ao participante; não há medição de fadiga ou ganho de produtividade nesta entrega. Registrar tempo/ações, hesitações, procura por ferramentas, erro de escopo, previsibilidade do resultado, capacidade de desfazer e conforto relatado. Comparar com o fluxo atual sem ensinar o caminho antecipadamente.

Antes de aprovar uma revisão, perguntar no roteiro: todas as áreas continuam alcançáveis? O autor consegue construir e modificar algo substancial visualmente? O ajuste numérico corresponde ao gesto? Planos/objetos/recursos permanecem distinguíveis? A precisão e os limites do alvo são claros? A operação é reversível? A execução corresponde à revisão testada? Aparência limpa, isoladamente, não atende essa barra.

<a id="r6-jogar-emulador"></a>
## R6 — Jogar no emulador, cenas e marcações — 2026-11-06

**Pedido do operador registrado para implementação futura; R5 aprovada e preservada.** Jogos de grande complexidade precisam de ferramentas amigáveis, precisas e robustas. Acrescentar uma experiência de jogo fluida, com início do jogo, cena escolhida e marcações, sem reduzir a autoria visual. Esta seção é a especificação do novo requisito; não relata implementação, benchmark ou nova captura do aplicativo. Inspeção no HEAD documental `0dc00e68`, com produto ainda na base `d51c56da`; reconferir owners no início do lote.

### Experiência e composição da interface

**Testar/Inspecionar** mantém ferramentas de diagnóstico, pausa, passo e observação. **Jogar** apresenta a experiência de gameplay no emulador oficial integrado, usando a ROM da revisão identificada, áudio e controles. Os dois modos compartilham sessão e owner de execução; não são dois emuladores concorrentes. A proposta não exige Internet para jogar nem presume que a lentidão venha de processamento online. Separar as intenções na interface não resolve sozinho o desempenho.

O comando Jogar fica na faixa de ações superior, com o destino atual legível e uma seta para escolher outro. O rótulo precisa distinguir iniciar de retomar: por exemplo, **Jogar · Início**, **Jogar · Enseada** e **Retomar · Ponte / antes do salto**. O clique principal executa o destino mostrado. A primeira utilização assume o início válido do projeto; se ele estiver indisponível, abre a escolha com explicação. A escolha é lembrada por projeto, mas revalidada a cada uso.

O ponteiro sobre o controle pode revelar um pequeno rolo de miniaturas. A seta e o teclado abrem o mesmo seletor; hover é atalho, nunca a única descoberta ou forma de operar. Mover o ponteiro para o painel não o fecha. Foco permanece previsível, Escape fecha e retorna ao acionador; clicar fora não executa. Passar por uma miniatura só mostra detalhes; iniciar exige clique/Enter no destino. Não tocar áudio, executar o core ou compilar todas as cenas ao passar o mouse.

Esquema de conteúdo, sem fixar tamanho, cores ou implementação de widget:

```text
Contexto: Cena Enseada / plataforma móvel        [Testar] [▶ Jogar · Enseada ▾]
                                                     ┌───────────────────────┐
                                                     │ Buscar cena ou pin    │
                                                     │ Início | Cenas | Pins │
                                                     │ [capa] [cena] [cena]  │
                                                     │ Enseada · 3 marcações │
                                                     │ [pin] [pin] [momento] │
                                                     │ Antes do salto       │
                                                     │ Retomar captura      │
                                                     └───────────────────────┘
```

Cada cartão mostra nome, cena, tipo de entrada e condição: **Pronto**, **Preparar**, **Desatualizado**, **Somente nesta sessão** ou **Indisponível**, com motivo e ação pertinente. Miniatura do editor recebe indicação de prévia; captura do emulador representa um momento observado. Nenhuma imagem, isoladamente, prova cena executável. Sem imagem, mostrar substituto com nome/tipo. Informações técnicas de revisão/core ficam nos detalhes, sem poluir o fluxo principal.

Agrupar por cena; pins nomeados e momentos capturados pertencem ao grupo correspondente. Permitir busca, ordem previsível, favoritos e acesso ao local no Canvas separado da ação de jogar. Não confundir ordenação da lista com sequência executável do jogo. Miniaturas são geradas sob demanda e cacheadas por revisão, com carregamento limitado. Em 949×593, adaptar o painel para lista/grade com rolagem interna e nomes acessíveis, mantendo a navegação global à esquerda e o contexto horizontal. Não encolher toda a UI nem manter o rolo aberto sobre a área de trabalho.

Na execução, oferecer pausa, reiniciar destino, capturar momento e voltar ao editor; tela cheia é uma escolha explícita e reversível. Voltar preserva cena, seleção, pan/zoom, painéis e edição pendente. O foco de teclado/controle passa ao jogo apenas ao iniciar; perder foco libera botões pressionados e aplica a política de pausa visível. Atalhos de edição não operam inadvertidamente durante gameplay. Testar ↔ Jogar preserva a sessão quando compatível; trocar o destino é uma reinicialização explícita, não um efeito de abrir o seletor.

### Quatro intenções técnicas, três grupos visuais

| Intenção proposta | O que o usuário escolhe | Estado e limites |
|---|---|---|
| `game_start` | Jogar desde o início | Entrada real do projeto e inicialização normal do jogo. Carregar a ROM não comprova que todas as transições estejam implementadas. Mostrar pendências pertinentes; não prometer jornada completa por existir um mapa de cenas. |
| `scene_entry` | Jogar uma cena | Cena inteira pelo contrato R3-09/T6, com entrada e contexto de inicialização definidos. Inventário, flags, câmera e dependências de cenas anteriores exigem cenário inicial declarado ou captura válida; não adivinhar condições. |
| `scene_pin` | Iniciar em um pin colocado no Canvas | Definição autoral de ponto e contexto de início, ainda sem estado completo de execução. Preparar a ROM/entrada pelo pipeline oficial; o ponto altera o início, sem recortar mundo, objetos ou lógica. |
| `runtime_checkpoint` | Retomar um momento capturado | Snapshot real do core e sua miniatura, com identidade/compatibilidade. Retoma também o contexto serializado, como inimigos, temporizadores e progresso, nos limites comprovados do core; não apenas a coordenada do personagem. |

**Um pin estático não cria automaticamente um save state.** No Canvas, criar uma marcação guarda intenção. Ao executar e alcançar um estado válido, **Capturar momento** guarda o snapshot. Um ponto preparado pode ganhar uma captura vinculada, com origem identificada. Se o autor quiser saltar diretamente para uma área, o alvo/projeto precisa suportar a inicialização correspondente; em ROM importada sem esse contrato, oferecer captura do momento alcançado, sem escrever coordenadas arbitrárias em RAM. Nomear a cena desconhecida como desconhecida, sem inferir identidade só pela imagem.

O estado persistido normal do jogo (por exemplo SRAM) é diferente do save state do emulador. Definir perfil inicial para teste e sessão de gameplay; não apagar ou sobrescrever progresso existente ao preparar pins. Resultados de execução não reescrevem posição/valores autorais automaticamente. Variantes de preparação são artefatos de teste identificados, sem mudar `project.entry_scene` salvo nem contaminar o export normal.

### Pins e momentos como ferramentas de autoria

No Canvas, disponibilizar **Adicionar ponto de jogo** pela ferramenta de marcação e pelo menu contextual. Posicionar visualmente, nomear e ajustar numericamente; mostrar coordenadas de mundo e a entidade/entrada controlada quando resolvidas. Ponto de câmera e ponto de nascimento têm significado distinto. O pin continua visível no nível de sobreposição escolhido pelo autor; filtro de pins não altera entidades da cena nem a ROM.

Mover/nomear/excluir/duplicar uma definição passa pelo histórico e persistência oficiais, com Undo/Redo e save/reopen. Usar identidade estável, não índice/nome/ordem da lista. Um pin de plataforma valida apoio, colisão e câmera; outros gêneros usam seus próprios requisitos. Movimento de objeto âncora exige regra explícita de ponto relativo ou absoluto. Dois momentos na mesma coordenada podem ter inventários e inimigos distintos; nunca deduplicá-los só pela posição.

Capturar durante o gameplay pede nome opcional e mostra a miniatura do instante capturado; uma ação curta deve bastar para repetir o teste. O autor pode associar o momento a um pin existente, mantendo as duas identidades. Mover o pin não altera retrospectivamente o snapshot. Remover uma marcação é reversível; a coleta de binários órfãos respeita a janela de Undo e a política de retenção. Nenhuma limpeza automática elimina a única captura útil sem proteção identificada.

### Base técnica observada e owners a estender

| Área | Fonte atual e observação | Trabalho necessário |
|---|---|---|
| Orquestração | `src/App.tsx`, `handleBuildAndRun`; `src/core/ipc/buildService.ts`; `src-tauri/src/compiler/build_orch.rs`. Build oficial com verificação de contexto; IPC atual sem intenção de cena/pin. | Estender T6 com destino/revisão, cancelamento e recibo; reutilizar pipeline, sem compilador alternativo. |
| Loop de execução | `src/core/ipc/emulatorService.ts`, `startFrameLoop`: aguarda `emulatorRunFrame()` e depois agenda mais 16 ms. | Medir tempo de core/IPC/apresentação e substituir o ritmo dependente da UI por cadência do owner de runtime. Essa espera é hipótese de custo, não benchmark. |
| Runtime e cadência | `src-tauri/src/emulator/libretro_ffi.rs`: consulta `retro_get_system_av_info`; conserva sample rate, mas o campo FPS não é preservado na estrutura de runtime observada. | Conservar/expor frequência válida e alterações de AV pertinentes; agenda monotônica, input, pause/step e captura coordenados no mesmo owner. |
| Vídeo/áudio/entrada | `src-tauri/src/lib.rs`, `emit_emulator_frame_events`; `src-tauri/src/emulator/frame_buffer.rs`; `src/components/viewport/ViewportPanel.tsx`. RGBA e amostras em eventos; observação de apresentação já tem identidade/época/ordem. | Medir cópias, serialização e filas; preservar rejeição de frames antigos, escalar apresentação e manter áudio/input responsivos. Não usar etiqueta fixa `/60fps` como prova. |
| Save states | `EmulatorCore::save_state/load_state`: um `saved_state` em memória; comandos IPC sem ID; desmontar core limpa o slot. Métodos `capture_runtime_state_bytes/restore_runtime_state_bytes` já existem. | Reutilizar serialização para vários checkpoints, persistência e validação. Não confundir `SceneSaveState` do editor com snapshot do core. |
| Instrumentação | `run_frame` captura rewind periodicamente e chama trace; havendo backend de trace, ele serializa estado para amostra. Replay também possui captura inicial/entradas. | Medir custo por modo; tornar instrumentação onerosa configurável/visível em Jogar, preservando depuração e recibos. Replay não é atalho universal de início. |
| Cena e contexto | `editorStore`, `studioContext`, `src/core/scenePersistence.ts`, `src/core/ipc/sceneService.ts` e writers Rust correspondentes. `runtimeLink` registra vínculo/evidência. | Integrar metadados de pins, migração, histórico e seleção nesses owners. `runtimeLink` não vira controlador fictício de início; não abrir store paralela. |

A inspeção é estática. Não mediu quanto cada custo contribui, nem garante que remover a espera entregue 60 FPS. O comando de vários quadros mantém execução em lote e só publica o resultado; não equivale a um loop interativo que precisa atender entrada, pausa, áudio e apresentação continuamente.

### Contratos de implementação e recuperação

**1. Intenção única de lançamento.** Definir um contrato versionado no fluxo oficial com projeto/alvo, revisão de autoria, cena quando conhecida, tipo de entrada e referência a pin/checkpoint. Resolução gera recibo com ROM/hash, configuração, destino e estado de preparo. Entradas ausentes, tipo sem suporte, cena removida, referência divergente ou contexto trocado falham antes de iniciar. Revalidar após build/preparo; não executar resposta atrasada de outro projeto/cena. Coalescer clique repetido para a mesma operação. Cancelamento não deixa uma sessão fantasma nem sobrescreve a autoria.

**2. Um controle serial do core.** Proposta: fazer a cadência pertencer ao runtime Rust existente, com comandos ordenados e interrupção entre quadros. Auditar callbacks, locks e afinidade de thread antes da migração. Jogar contínuo, Inspecionar, step, save/load, rewind e replay são modos/comandos desse mesmo owner. A UI recebe quadros; não continua chamando `run_frame` em paralelo ao runner. Não manter o mutex bloqueado por um laço interminável nem acumular fila ilimitada. A API Libretro não permite chamadas concorrentes/reentrantes; suporte a serialização é opcional. [Documentação oficial Libretro](https://docs.libretro.com/development/cores/developing-cores/).

**3. Captura coerente.** Pausar a progressão numa fronteira definida de quadro, capturar bytes do core, miniatura, frame e proveniência da mesma sessão e então retomar se antes estava rodando. A captura não deve passar um quadro extra só para obter imagem. Se não houver framebuffer válido ainda, aguardar preparação explícita ou indicar imagem indisponível. O manifesto fica visível apenas após escrita completa e verificação; cancelamento/disco cheio mantém a versão anterior. Capturar não substitui o slot rápido manual sem decisão visível.

**4. Compatibilidade de checkpoint.** Manifesto proposto: versão de formato, IDs de projeto/cena/pin/checkpoint, tipo/origem, revisão de fonte e intenção de preparo, SHA-256 da ROM exata, identidade/hash do core e suas opções, alvo/região, condições relevantes do host e dependências de execução, frame, data, tamanho/hash do snapshot e miniatura. Capturas dependentes de sessão ficam assim rotuladas e não prometem restauração após reabrir. Respeitar limitações de serialização, inclusive inicialização, tamanho variável e portabilidade. Essas limitações existem no contrato oficial, mas precisam ser verificadas no core pinado do projeto. [Cabeçalho oficial Libretro: timing e serialization quirks](https://raw.githubusercontent.com/libretro/libretro-common/master/include/libretro.h).

Compatibilidade conservadora: exigir mesma ROM e core/configuração compatível, não apenas mesmo tamanho do buffer. Edição de código, assets, paleta ou preparação que produza outra ROM deixa a captura anterior **Desatualizada**. Preservar sua origem e oferecer **Preparar novamente este ponto**; opcionalmente **Jogar versão capturada** somente se os artefatos exatos estiverem retidos e suportados. Não migrar estado binário por heurística. Ausência de suporte mantém início/cena disponíveis quando válidos e explica a indisponibilidade de captura.

**5. Restauração e falhas.** Verificar manifesto, integridade, tamanho permitido e compatibilidade antes de entregar bytes ao core. Um `unserialize` que falha pode ter alterado estado interno; o owner deve recuperar uma sessão comprovadamente válida ou parar e oferecer reinício, sem anunciar sucesso nem continuar estado parcial. Reconciliar relógio/frame observado, epoch de apresentação, áudio pendente, botões, rewind e gravação; rejeitar eventos anteriores. O comando atual de load não emite um quadro restaurado. A miniatura pode ilustrar o checkpoint enquanto pausado, claramente como captura; o primeiro quadro novo só pode ser apresentado como execução quando efetivamente produzido. Não avançar o jogo silenciosamente para simular uma imagem atualizada.

**6. Persistência e limites.** Definições de pins são dados do projeto pelo schema/writer existentes, com migração compatível e conflito de revisão. O runtime oficial guarda binários, miniaturas e manifestos por identidade de projeto/captura, fora do Git de fontes; a implementação resolve o diretório pelo owner de runtime, sem caminho absoluto do host embutido. IDs gerados formam chaves; nomes do usuário não viram paths. Gravação atômica, orçamento por captura/projeto, tamanho máximo antes da alocação e política de retenção são parte do contrato. Documentar recuperação/exportação privada de capturas quando suportada; referências a arquivo ausente permanecem explicáveis. Reabrir, mudar de máquina ou trocar core não pode aparentar disponibilidade sem os artefatos compatíveis.

### Desempenho: experiência real de jogo

O objetivo é rodar na velocidade nativa, com áudio sincronizado e entrada responsiva. Usar a frequência informada pelo core para o conteúdo carregado; conteúdo NTSC pode ser próximo de 60 Hz e PAL próximo de 50 Hz. Não forçar 60 Hz acelerando um jogo de 50 Hz, nem confundir ticks do emulador com a taxa de animação interna de um jogo. Se o próprio jogo sofre slowdown no hardware emulado, identificar a diferença entre custo do jogo e lentidão do host. A experiência rica permanece dentro dos limites do alvo real.

Baseline de PLAY01: separar custo do core, serialização de rewind/trace, conversão/transporte, apresentação e áudio. Exemplo de volume bruto, não medição: um quadro RGBA de 320×224 ocupa 286.720 bytes; a 60 quadros/s são cerca de 17,2 MB/s antes de cópias e representação dos eventos. Avaliar transporte binário/mecanismo Tauri disponível e reutilização de buffers com evidência; não adicionar dependência ou renderer concorrente sem necessidade demonstrada. Fila de vídeo limitada pode descartar apresentação atrasada para preservar responsividade, contando as perdas; não descartar lógica/input nem anunciar a mesma imagem repetida como quadros novos. Áudio requer seu próprio controle de buffer e sincronização.

Definir, antes de codificar, máquina/OS/core/ROM/configuração de referência e orçamento de memória, filas, latência e p95/p99 de apresentação. Protocolo inicial: aquecer 10 s, medir 120 s de gameplay repetível em cada modo, repetir após três ciclos de editar → preparar → jogar → retornar; registrar resolução/escala, frequência do monitor e carga concorrente. Alvo inicial para a fixture declarada: velocidade média de emulação entre 99% e 101% da frequência nativa, sem drift acumulado perceptível de áudio e sem crescimento ilimitado de filas. Cadência, perdas, underruns e latência devem ter limites numéricos congelados em PLAY01 a partir do baseline, antes do aceite; não adaptar o limite depois só para aprovar um candidato.

Registrar separadamente FPS de execução, quadros apresentados por segundo, intervalos p95/p99, frames descartados, fila/underruns de áudio, atraso de input, CPU/RAM e tempo para preparar/retomar. Um monitor mais lento ou modo pausado não pode receber diagnóstico falso de velocidade do core. Testes sem apresentação e primeiro frame não aprovam fluidez. A barra discretamente visível pode informar frequência observada e acesso aos detalhes; nenhum badge estático promete 60 FPS.

### Lotes, aceites e transferência para outro agente

As etapas [PLAY01–PLAY06 no roadmap](../03_ROADMAP_MVP.md#jogar-emulador-r6) integram R3-09/T6, preservam R5 e definem a ordem. O [handoff de implementação](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md#implementacao-play-r6) é o ponto de entrada do agente. Cada lote declara owner confirmado, comportamento, regressão, evidência nativa e limitações; manter Experimental enquanto parcial.

Regressões mínimas, além dos gates aplicáveis:

- Início normal preservado; cena completa por entrada distinta; pin com apoio/câmera/contexto válidos; edição pendente, build falho/cancelado e resposta de contexto antigo não lançam revisão errada. Transições declaradas sem runtime continuam identificadas como não comprovadas.
- Pin autoral com gesto/número, Undo/Redo, salvar/reabrir e mudança de cena; dois pins na mesma região permanecem distinguíveis. Captura não altera entidades, entrada do projeto ou progresso persistente de outra sessão.
- Dois ou mais checkpoints com estados diferentes; capturar pausado/em execução; restauração após reabertura quando suportada; mesma entrada subsequente produz estado esperado na fixture do core. Usar imagem e estado/efeito observado, não apenas existência do arquivo.
- ROM/core/opções incompatíveis, core sem serialização ou dependente de sessão, snapshot corrompido/truncado, arquivo ausente, tamanho excessivo, falha de escrita e restauração recusada; dados anteriores preservados e recuperação clara.
- Jogar ↔ Inspecionar, pause/step/retomar, perda de foco, controlador, áudio, rewind/replay e troca de projeto/ROM sem segundo loop, entrada presa, quadro antigo ou amostra de áudio anterior à restauração.
- Rolo por hover, clique e teclado; escape/retorno de foco, nomes repetidos, lista grande, nenhuma miniatura, nenhuma cena válida e destino desatualizado. Contraste e alvos nas cores/tamanhos reais; 1366×768 e 949×593 sem sumir com a navegação global.
- Tauri real, core e toolchain oficiais, ROM autoral/BYOR, frequência/recursos medidos e retorno ao editor. Provar cada alvo e OS que receber rótulo de suporte; sucesso no Mega Drive/Linux não certifica SNES/Windows. Usar fixture de QA própria, sem alterar o projeto autoral do operador.

Ensaio humano: sem instrução antecipada, pedir iniciar o jogo, escolher outra cena, criar um pin, capturar um momento, editar algo que invalide a captura e encontrar a forma correta de jogar novamente. Repetir três vezes e observar procura, confusão entre iniciar/retomar, confiança no destino, resposta dos controles e conforto. Aprovação da direção visual não substitui esse ensaio. A meta é tornar a complexidade operável com fluidez, mantendo ferramentas de produção e precisão.

<a id="r7-ferramentas-visuais"></a>
## R7 — Revisão de capacidades e ferramentas visuais de produção — 2026-11-06

**Requisitos do operador e propostas complementares; sem implementação nesta rodada.** R5 continua aprovada como direção de autoria robusta e R6 conserva o fluxo Jogar. A revisão exige paletas completas por plataforma, seleção de primeiro plano, pintura de distorções, translucidez e outras ferramentas que tornem jogos complexos viáveis de construir. O paradigma é manipulação visual rica, como seleções, pincéis, máscaras e parâmetros de uma ferramenta gráfica profissional, integrada à lógica e ao código reais do jogo. Facilidade de uso não autoriza perder funções existentes.

O mockup R5 omite a expansão multibanco e estas famílias de ferramentas; portanto é referência parcial, não inventário completo nem limite do produto. Na próxima revisão visual, mostrar explicitamente paleta contextual expansível, acesso rápido aos bancos, grupo de composição/efeitos e painel de parâmetros da ferramenta ativa, preservando menu global e faixa contextual. Não exigir todos os painéis abertos ao mesmo tempo: grupos identificados, busca, atalhos, painéis fixáveis/redimensionáveis e retorno estável organizam a complexidade. Sem ícones isolados como único meio de descobrir uma ferramenta.

### Revisão do que já existe e deve ser conservado

Inspeção estática no HEAD `697632a2`, produto base `d51c56da`. Não foram executados novos testes de produto ou benchmarks. A presença do componente, do nó ou do emissor abaixo não certifica toda a jornada.

| Capacidade / owner | Evidência encontrada | Conservação e lacuna |
|---|---|---|
| Paletas | `PalettePanel.tsx` já tem `PaletteSummary` expansível, bancos, usos, conflitos, edição, atribuição e reserva. `palettePlan.ts`, store e `compiler/palette_plan.rs` compartilham o plano do build. | Preservar ações e histórico; ampliar descoberta/contexto. A faixa única do desenho não representa o limite do painel existente. |
| Alvo de paleta | IPC `scene_palette_plan` recusa alvo diferente de `megadrive`; capacidade MD 4×16. Perfil SNES existente não torna esse planner multiplataforma. | Evoluir o mesmo contrato por adaptadores; não trocar somente o número de bancos ou anunciar SNES/SMS/PCE como atendidos. |
| Prioridade | `SpriteComponent.priority` → `ast_generator.rs` → `TILE_ATTR` SGDK; SNES tem mapeamento próprio. `tilemapCells.ts` representa conteúdo/célula vazia, não um mapa completo de prioridades por região. | Preservar prioridade atual. Seleção da pilastra, máscaras e prioridade dinâmica exigem contrato de região/atributos e integração; ordem de árvore/CSS não basta. |
| Efeitos | `RetroFXDesigner.tsx`, `RetroFXConfig` e emissores já tratam paralaxe e linhas raster. No SGDK inspecionado, `render_retrofx_frame` monta scroll horizontal de BG_A em 224 linhas. | Preservar painel e nós. Falta provar pincel de área, forma radial, modulação temporal geral e composição de múltiplos efeitos/planos. Não tratar offset de uma linha como distorção local arbitrária. |
| Nós de efeitos/paleta | `effect_parallax/effect_raster` registram configuração no AST e retornam `NoOp` na parte lógica; `palette_swap` atual é troca por golpe, com alvo/duração/escopo; emissor SNES recusa essa troca. | Não prometer start/stop por qualquer aresta nem usar troca por golpe como animação geral de paleta. Extensão exige semântica executável, preservando contratos atuais e R3-03. |
| Autoria e inspeção | `ViewportPanel`, `SceneArtwork`, `sceneComposition`, `sceneWorldModel`, PixelEditor/ArtStudio, câmera, animação/hitboxes, história e persistência. | Reutilizar seleção, gestos, recursos e retorno. `opacity` de onion skin é visualização do editor, não translucidez exportável. Não criar outro Canvas, editor de pixels ou store global. |

Garantia de processo: cada lote mantém uma matriz **função → acesso anterior → acesso novo → dados/owner → regressão → prova**. Se uma função desaparecer, ficar inacessível, perder precisão ou deixar de chegar à ROM, o lote não passa. A matriz abrange também Arte, Lógica, Efeitos, Depurar, arquivos, importação/exportação, controles numéricos, Undo/Redo, isolamento, paletas, animação, câmera, trajetos e Jogar. Esta é uma condição de aceite futura, não uma alegação de ausência de regressões já testada.

### Paletas contextuais, completas e rápidas

O resumo mostra a paleta efetivamente usada pelo objeto/parte selecionada, que pode estar em PAL2 ou outro banco; não selecionar PAL0 automaticamente. Havendo vários recursos na seleção, indicar **Múltiplas paletas** e permitir navegar por parte/uso. No Mega Drive, uma faixa compacta apresenta PAL0, PAL1, PAL2 e PAL3, com ocupação, seleção e conflito, e **Expandir paletas** abre recursos e bancos juntos. Preservar o mapa de usos, reservas, compartilhamento, variantes locais e retorno ao recurso de origem já existentes.

Três gestos precisam de significados diferentes:

- **Consultar/trocar a paleta exibida:** navegar por banco/recurso, por clique ou teclado, sem editar a cena. A seleção visual do banco não reassocia objetos.
- **Aplicar outra paleta à seleção:** prévia temporária, comparação e aplicação numa transação. Distinguir reassociar índices existentes, remapear cores/índices e alterar cores do banco compartilhado; o resultado e os usos afetados diferem. Cancelar não grava. Atalhos anterior/próxima opção elegível e favoritos respeitam foco e podem ser remapeados, sem capturar teclas dos campos de número.
- **Trocar/animar no jogo:** escolher recurso, destino, gatilho, duração, restauração e alcance por instância/grupo. Explicar se a técnica muda referência de banco ou reescreve cores compartilhadas. Conflitos de troca simultânea e retorno ao estado anterior são resolvidos pelo planner; não duplicar a lógica do nó em uma timeline independente.

Mais recursos de paleta na biblioteca não significam mais bancos residentes simultâneos. Um sprite de hardware MD escolhe um banco; composição em partes pode usar vários sprites/recursos, com custo e suporte explícitos. As quatro paletas são compartilhadas pelos consumidores e PAL0–3 são posições de alocação da cena, não identidades globais. A API oficial descreve quatro paletas de 16 entradas e seleção de banco por sprite. [SGDK: paletas](https://raw.githubusercontent.com/Stephane-D/SGDK/master/inc/pal.h), [atributos de sprite](https://raw.githubusercontent.com/Stephane-D/SGDK/master/inc/vdp_spr.h).

O contrato de capacidade deve conter plataforma/modo, domínio de uso, bancos/faixas de índices, profundidade/quantização, cor de fundo/transparência, granularidade de atribuição, compartilhamento, restrições de escrita e técnicas disponíveis. O layout consome esses dados; o modelo autoral conserva intenção/recursos agnósticos e o adaptador resolve endereços/bits. Não colocar constantes de Mega Drive em toda a UI ou em campos universais do UGDM. Os perfis/constraint engine existentes continuam responsáveis pela validação; a ampliação não cria motor universal paralelo.

| Perfil | Diferença que a região de paletas deve representar | Estado nesta revisão |
|---|---|---|
| Mega Drive | Quatro bancos de 16, seleção por tile/sprite, usos compartilhados, índice transparente e backdrop distinguidos no contexto. Trocas temporais não aumentam a capacidade residente livremente. | Planner MD existente; acesso rápido/novas técnicas ainda a integrar. |
| SNES | CGRAM, domínios BG/OBJ e organização conforme modo/bpp; por exemplo, Mode 1 combina BGs de 16 e 4 cores. Paleta, prioridades, janelas e color math têm contratos próprios. Não apresentar apenas oito cópias de PAL MD. | Perfil/emissor existentes; planner contextual atual sem adaptador SNES. A API PVSnesLib explicita modos, CGRAM e operações de cor. [video.h](https://raw.githubusercontent.com/alekmaul/pvsneslib/master/pvsneslib/include/snes/video.h). |
| Master System | Em modo 4, dois conjuntos de 16 cores e regras próprias de uso BG/sprites; não assumir que todo objeto escolhe livremente qualquer conjunto. Conversão de cor e transparência são do perfil. | Extensão futura. SMSlib separa acesso/carga BG e sprite e seus endereços de CRAM. [SMSlib](https://github.com/sverx/devkitSMS/blob/master/SMSlib/src/SMSlib.c). |
| PC Engine | Dezesseis paletas de 16 para tiles e dezesseis para sprites; domínios e prioridades distintos. Seleção filtrada por consumidor, com visão global expansível. | Extensão futura. Não implica toolchain/core integrado. [Documentação HuC](https://raw.githubusercontent.com/uli/huc/master/doc/huc/huc_doc.htm). |

Fontes upstream foram consultadas em 2026-11-06 para verificar conceitos. Antes de implementar, fixar a versão do SDK realmente usada e verificar nela cada API; consulta a `master` não altera o lock do projeto. `docs/04_HARDWARE_SPECS.md` permanece intacto; divergência de regra exige evidência e decisão canônica, sem corrigir limites por conveniência.

### Seleção de primeiro plano e oclusão

Ferramenta proposta **Composição / À frente–Atrás**: selecionar objeto, retângulo, laço/polígono, pincel ou região de pixels/tiles → escolher o que deve encobrir → visualizar região e relações → aplicar. A seleção é reutilizável; modificar prioridade não apaga arte nem altera colisão. Permitir inspecionar o objeto encoberto por árvore, alternância de objetos sob o ponteiro e isolamento. Uma opção de ver através para editar permanece separada do resultado exportado.

**Pilastra:** selecionar só a área que deve encobrir o herói; sua parte de fundo pode continuar atrás. A prévia permite mover um ator/sonda e ver frente, atrás e cruzamento das bordas. Se a pilastra deve alternar conforme posição/estado, criar uma regra visual com condição, região e estado inicial/restauração; caso a geometria e prioridades estáticas já resolvam, não gerar uma rotina dinâmica desnecessária.

**Personagem surgindo atrás de uma faixa:** faixa em primeiro plano, personagem animado atrás, demais elementos preservados. Usar uma fixture autoral equivalente; a referência à abertura do Sonic descreve o resultado visual desejado, sem afirmar como a ROM original o implementa. Não ocultar metade do sprite apagando pixels de todos os seus quadros.

No MD, prioridade e banco são atributos do tile/sprite, não um z-index livre por pixel. Para a região de pilastra em tilemap, identificar células atingidas, mostrar a granularidade de 8×8 no modo normal e o efeito sobre pixels não transparentes desses tiles. Quando parte do tile precisar de outra relação, propor decomposição/máscara/tiles derivados ou composição por sprites/planos, com diferença visual e custos antes de aplicar. Recorte de pixels, prioridade e colisão são máscaras de finalidades distintas. Respeitar ordem dos planos, prioridade baixa/alta, ordem de sprites e transparência; uma seleção em laço não cria um novo plano de hardware. [SGDK: atributos de tiles](https://raw.githubusercontent.com/Stephane-D/SGDK/master/inc/vdp_tile.h).

Representar a seleção em coordenadas de mundo, objeto ou tela explicitamente; âncora, transformações, cópia, animação e edição de asset compartilhado mantêm identidade e escopo. A região persistida pertence ao modelo oficial; compilação gera os atributos/recursos apropriados, com referência ao owner e à revisão. Prioridade dinâmica precisa funcionar após movimento/câmera, em múltiplos sprites e na restauração da condição, sem piscar na fronteira.

### Pincel de distorção e ondulação

Ferramenta proposta **Pintar efeito**: escolher objeto/plano, pintar/adicionar/subtrair área ou usar seleção existente, escolher efeito e ajustar no próprio Canvas. Famílias iniciais: ondulação direcional, água/calor; variantes circular/radial como extensão sujeita à técnica do alvo. Controles conforme capacidade: amplitude em pixels, comprimento de onda, velocidade/período, fase, direção, centro/raio, intensidade/envelope, início, duração, repetição e espera. Alças e números alteram o mesmo valor. Pintura aceita tamanho/dureza do pincel; se o alvo só admitir máscara discreta, mostrar sua discretização em vez de inventar borda suave exportável.

Uma trilha de prévia permite pausar, avançar, comparar com original, ver a área e desfazer o gesto inteiro. O efeito pode acompanhar o objeto, ficar preso ao mundo ou operar na tela, com unidade explícita. Nó de evento/condição controla ativação e modulação; parâmetros compartilhados são referenciados. Somar dois efeitos ou combiná-los com câmera/paralaxe exige ordem e política de composição, nunca último writer vencendo silenciosamente.

No MD, scroll horizontal por linha e vertical por coluna de dois tiles são recursos distintos. Deslocar uma linha do plano pode afetar pixels fora da área pintada. Portanto o painel mostra **área pedida**, **área efetivamente afetada**, técnica e custo. O autor pode aceitar uma faixa maior, reorganizar conteúdo em plano/tiles, ou usar composição/tiles animados/software quando houver adaptador viável. A distorção circular local não é garantida por scroll de linhas; não substituir silenciosamente o desenho radial por uma onda horizontal. A API SGDK explicita essas granularidades. [Controle de scroll](https://raw.githubusercontent.com/Stephane-D/SGDK/master/inc/vdp.h), [operações de scroll por plano](https://stephane-d.github.io/SGDK/vdp__bg_8h.html).

Para SNES e futuros alvos, expor somente operações respaldadas por adaptador e orçamento, inclusive recursos de raster/HDMA quando pertinentes. A forma do pincel representa intenção autoral; a prévia fiel representa o plano de execução. Preview conceitual pode existir identificado, mas não liberar export como se o efeito já fosse suportado. Medir tabelas, transferências, interrupções, CPU/VRAM e interação com áudio, scroll, HUD e sprites.

### Ferramenta Fantasma: transparência com técnica explícita

Ícone de fantasma acompanhado de nome, tooltip e atalho: selecionar objeto/região → escolher aparência e técnica elegível → comparar sobre o conteúdo real → ajustar → aplicar. O objetivo é permitir translucidez útil para produção, inclusive técnicas avançadas viáveis, sem reduzir a ferramenta a ocultar um objeto ou baixar opacidade do Canvas. A entrada de intensidade deve mostrar passos/quantização quando não houver variação contínua fiel.

| Técnica / intenção | O que a ferramenta precisa explicar e produzir |
|---|---|
| Ver através no editor | Ajuda a selecionar/editar conteúdo encoberto. É máscara de inspeção, não efeito na ROM; restaurar visão não altera a autoria. |
| Recorte por índice transparente | Abre regiões transparentes na arte indexada, preservando arquivo original e compartilhamento por variante/máscara conforme owner. Não mistura cores entre frente e fundo. |
| Cobertura por padrão (dithering) | Alterna pixels opacos/transparentes com padrão, densidade, origem e fase definidos. Aparência depende de escala/saída; prévia digital e simulação opcional de vídeo precisam ser identificadas. Preservar tiles/índices e medir custo de variantes. |
| Shadow/highlight no MD | Explorar modulação de luminosidade do conteúdo subjacente e composições compatíveis. Há suporte de modo no SDK, mas interação entre prioridade, paletas e cores de controle exige prova por cena; não é mistura alpha geral de qualquer par de cores. |
| Composição avançada por software/tiles/paletas | Frente explícita para investigar translucidez colorida e efeitos homebrew elaborados: área/superfícies/fontes conhecidas, tabelas/remapeamento, recálculo ou tiles derivados e eventual combinação com shadow/highlight. Exigir protótipo medido, limites de área/objetos/movimento e qualidade, integração no compilador existente e preservação de arte. Não descartar a técnica por não ser um único bit de hardware, nem declará-la geral por uma demonstração externa. |
| Color math no SNES | Usar operações, seleção de camadas/paletas, main/subscreen e janelas suportadas pelo alvo. Também possui restrições de participação e granularidade; não apresentar alpha RGBA irrestrito por objeto. |

O suporte de shadow/highlight está documentado no [SGDK](https://raw.githubusercontent.com/Stephane-D/SGDK/master/inc/vdp.h); operações de color math e suas máscaras, no [PVSnesLib](https://raw.githubusercontent.com/alekmaul/pvsneslib/master/pvsneslib/include/snes/video.h). A disponibilidade desses recursos de hardware/SDK não prova que o Studio já os exporte. A referência do operador a homebrews recentes motiva investigação, sem importar números de FPS ou métodos de uma demonstração não reproduzida. Não usar CSS alpha ou shader exclusivo do emulador como prova do efeito no console.

Alternância temporal de visibilidade, se oferecida, é uma técnica opcional identificada como cintilação, nunca padrão oculto de um controle de transparência. Comparar em movimento e na saída prevista, permitir pausa e alternativa estável. Para qualquer técnica, mostrar impacto nos usos compartilhados, cores reservadas, prioridades, sprites por linha, tiles, transferências e tempo de quadro. Diante de conflito, preservar a intenção e apresentar alternativas com preview; não empobrecer automaticamente o efeito ou remover outro recurso para fazer caber.

### Mesmos dados no Canvas, nós e código

Contrato a fechar em VIS01/VIS04: seleção/região com ID, geometria e espaço; referência ao objeto/asset/cena; finalidade da máscara; tipo/parâmetros do efeito; modo estático ou ativação por regra; escopo, ordem de composição, duração/restauração e revisão. A técnica/alocação específica do alvo é resolução do compilador/constraint engine, com proveniência; não um segundo modelo editável escondido na UI. Estender os schemas e writers oficiais com migração e limites, em fatias, sem inventar assinatura de API existente.

Cada ferramenta oferece **Ver no grafo** e **Ver código gerado** com origem/revisão. Propriedade estática pode aparecer como configuração ligada ao objeto, sem fingir um evento por quadro; ativação dinâmica precisa ter ramo executável real. Alterar número no nó e gesto no Canvas resolve a mesma definição pelo owner canônico. Nós gerados preservam metadados/partes manuais e conexões externas conforme R3-03. Se um recurso ainda não tiver representação executável, mostrar pendência e não um nó decorativo.

O caminho é modelo validado → grafo/configuração canônicos → AST/IR → emissor do alvo → ROM → observação no core. Source mapping liga região/efeito/nó ao trecho emitido; não equivale a rastreio PC→nó sem evidência. C gerado permanece derivado; edição textual e reconciliação seguem o contrato EC03, sem prometer round-trip de C arbitrário. Preview, desfazer, salvar/reabrir, conflito externo e cancelamento obedecem ao mesmo histórico/persistência. Carimbo, seleção e máscara não podem gravar arquivos paralelos de lógica.

### Outras ferramentas propostas para a fila de qualidade

Estas sete sugestões complementares foram incorporadas ao [contrato integral de execução](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md#contrato-execucao-integral), após o pedido do operador, no mesmo dia, de um prompt para implementar todos os aspectos. A implementação permanece pendente. Ordenar jornadas completas, integrando o que já existe em vez de aumentar apenas a quantidade de ícones; nenhuma família pode ser omitida como se priorização significasse exclusão.

| Ferramenta | Ganho para produção e integração | Prova mínima |
|---|---|---|
| Seleção avançada e transformação | Retângulo/laço/por cor conectada, adicionar/subtrair/intersectar, selecionar sob sobreposição, pivô, alinhar/distribuir e encaixar. Reutilizar Canvas/PixelEditor por domínio. | Mesma seleção alimenta operações compatíveis; coordenadas, escopo compartilhado, precisão e Undo preservados. Rotação/escala distingue autoria de assets de suporte dinâmico do alvo. |
| Carimbos, terrenos e conjuntos reutilizáveis | Pintar padrões/metatiles e conexões de terreno, distribuir instâncias e variantes de conjuntos, com semente reproduzível quando houver variação. Integrar tiles/prefabs. | Não duplicar assets por acidente; mostrar colisão associada, paleta e orçamento; atualizar origem compartilhada com impacto visível. |
| Pincel de colisão e regiões de evento | Desenhar sólido, passagem, hit/hurt boxes e gatilhos no contexto; ligar a eventos e visualizar por quadro de animação. | Colisão física, área de oclusão e máscara de efeito são distintas; runtime corresponde ao que se vê, inclusive objetos móveis. |
| Timeline de propriedades e eventos | Organizar animação, paleta, efeito, câmera e marcas de evento numa vista temporal do mesmo modelo/grafo; prévia com onion skin e comparação. | Alterar chave não cria lógica concorrente; tempo/frequência, pausa, repetição e gatilhos coerentes no alvo. Aproveitar editores atuais. |
| Câmera e enquadramento visual | Áreas seguras, limites, zonas mortas, trilhos, tremor e transições, com sonda de composição/paralaxe. Ampliar os controles existentes. | Sonda não altera câmera autoral; HUD, prioridades, entrada de cena e movimento real permanecem corretos. |
| Animação de paleta e atmosfera | Ciclos de índices, fades, pulsos e variações de ambiente, com prévia no conjunto e eventos; gradientes raster quando suportados. | Compartilhamento, restauração, custo e disputa com dano/translucidez/raster resolvidos pelo mesmo planner. |
| Mapa visual de custos e otimizador assistido | Mostrar pressão por região/scanline, VRAM, sprites, tiles únicos e transferências; propor deduplicação/remapeamento com diff visual. | Estimativa identificada como estimativa, medição com origem; nenhuma otimização muda arte/lógica silenciosamente. Usar HardwareLimitsPanel/constraint engine existentes. |

### Aceite da revisão e da futura implementação

As etapas [VIS01–VIS08](../03_ROADMAP_MVP.md#ferramentas-visuais-r7) e o [handoff](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md#implementacao-visual-r7) transferem requisitos e ordem ao agente implementador. R3, R5 e PLAY01–06 continuam válidos. A primeira fatia é inventário/contratos e integração com owners; nenhuma nova ferramenta foi certificada nesta revisão.

Fixtures autorais exigidas: (a) quatro bancos MD ocupados e cores compartilhadas, troca local/grupo, conflito, cancelamento, restauração e reabertura; (b) sala com pilastra e ator passando atrás, mais animação surgindo atrás de faixa, com oráculos de pixels dentro/fora da região; (c) ondulação pintada com conteúdo na mesma linha fora da área e câmera/paralaxe ativos, incluindo radial não suportado; (d) Fantasma sobre fundo estático e móvel, duas instâncias e técnicas diferentes, verificando imagem, uso de recursos e limitações; (e) combinação das quatro com trajetos e pins/Jogar, medindo carga, áudio/input e retorno ao editor.

Para efeitos dinâmicos, testar condição falsa, início, pausa, fim, repetição e remoção da regra, verificando quadro/estado e C emitido, não só snapshot do grafo. Atribuição de paleta não pode editar os demais usos; alteração compartilhada deve mostrá-los. Prioridade não pode inverter flip, destruir arte ou alterar colisão. Efeito raster não pode ser reativado indevidamente pela câmera. Falta de suporte não pode gerar ROM aparentemente bem-sucedida sem o efeito.

Validar pelo launcher no Tauri real, duas resoluções (1366×768 e 949×593), teclado/ponteiro, nomes acessíveis, contraste, cores não usadas como único indicador, precisão numérica, Undo/Redo e save/reopen. Medir desempenho no modo nativo do alvo com fixture identificada; técnica que roda numa cena simples não é automaticamente aprovada para cenas complexas. Usar SDK/core oficiais e documentar separadamente eventual prova em console físico. Repetir a matriz por plataforma/OS declarado, sem transformar previsão de SMS/PCE em suporte disponível.

Ensaio humano proposto: criar uma composição com pilastra, trocar paleta, pintar uma onda, experimentar Fantasma e voltar ao grafo/Jogar sem instrução antecipada; repetir ajustes e desfazer. Registrar procura por ferramentas, compreensão de alcance, discrepância preview/ROM, esforço e capacidade preservada. A garantia de robustez exige essa evidência, além de aparência limpa e aprovação conceitual.

## Implementação da curadoria — 2026-11-05 (lote 1, Experimental)

| ID | Estado | O que mudou | Prova | Falta |
|---|---|---|---|---|
| JV06 | corrigido | `PropRow` do Inspector: valor vira botão focável com área mínima e «(vazio)»; Escape cancela, Enter grava | `InspectorPanel.test.tsx` (mouse/teclado em Prefab vazio) | repetir a jornada no Tauri |
| JV09 | implementado | «Movimento e salto» ganhou «Animação parado/andando»: marca por instância, um passo por quadro escolhe repouso/corrida no chão e salto no ar, com os nós e o compilador existentes (os nove nós da receita, gerados) | `behaviorLibrary.test.ts` | build/core no Tauri; conferir que os ciclos não reiniciam na ROM |
| JV10 | implementado | `sprite_move` com `face_direction` (opt-in) emite `SPR_setHFlip` pelo sinal de dx; o comportamento liga nos dois lados; outros `sprite_move` inalterados | `sgdk_emitter` `move_sprite_faces_its_direction_only_when_requested` | core/ROM, troca de direção no ar, colisão assimétrica |
| JV05 | corrigido (parcial) | faixa de cartões da timeline não encolhe a zero; divisor palco/timeline persiste (`useDefaultLayout`, mesmo mecanismo do shell) | tsc + 74 testes ArtStudio | medir 1366×768 e 949×593 no Tauri |
| JV01 | corrigido | Causa reproduzida no owner: o ImageIngress grava a imagem montada como células `1..N`; o `DrawTilemap` desenhava a imagem **e** subia cada célula como tile extra depois dela (2× a imagem por camada), além da área de VRAM, enquanto a estimativa contava só a sobreposição. Agora `ast_generator` trata `1..N` como imagem base (mesma convenção de `applyImageEdits`) e `md_profile` estima sobreposição pintada como imagem base + tiles distintos | `mounted_image_cells_compile_as_the_base_image_without_duplicate_tiles`, `painted_tilemap_estimate_counts_base_image_plus_overlay_tiles`; real (ignorado) `jv01_mounted_image_real_build_matches_base_image` no Correio das Nuvens: ROM montada = ROM base = `a8798730…b5ad`, 6/6 quadros do core iguais | repetir no Tauri pela UI; outros consumidores de células pintadas não foram auditados |
| JV02–04, JV07, JV08, JV11–14 | pendentes | — | — | — |

Nenhuma destas mudanças foi repetida na jornada nativa; o candidato congelado `4a139…` não certifica este código.

### Jornadas Tauri do lote (2026-11-05, Experimental)

Candidato debug `72253f9a…dd77` (fonte `9508dab3` + correção JV05 deste commit), Xvfb/Mesa, SGDK e Genesis Plus GX v1.7.4 (`07c10476…10b1`) oficiais. Projeto privado copiado para descarte; evidências em `RDS_WORK_ROOT/sessions/jv01-20261105/ui/`.

- `studio-jv` PASS: **JV01** — células `1..N` (forma do ImageIngress, gravadas em disco na cópia) → Build & Run no Tauri → ROM `a8798730…b5ad` (= base), 0 tiles extras no C, core com a mesma ROM; estimativa 46/64 KB. **JV06** — Prefab vazio é botão 181×18, clique nativo abre, Escape cancela (1 falha intermitente em 5 execuções no mesmo passo, não isolada). **JV05** — a 1366×768 e 949×593 o painel da timeline mede 180/191 px (antes 73/0 px: abaixo de `xl` o Group ficava com 8 px) e os cartões são alcançáveis; setas movem o divisor 191→232 px e ele se mantém ao sair e voltar para Arte.
- `studio-jv-motion` PASS (candidato `f26d9bb1…07c5`): cópia descartável sem os 9 nós manuais da receita (preparação declarada); «Movimento e salto» editado pela UI com Animação parado/andando, salvar/reiniciar/reabrir, Build & Run, setas/Z nativos, 23 amostras pausadas (framebuffer do core + posição na RAM). Oráculo independente `scripts/verify-jv-motion.py` (Pillow/numpy, só QA): 23/23 com 100% dos pixels opacos — direita sem espelho, esquerda/parado/salto após esquerda espelhados (**JV10**); parado 0–3, corrida 4–9 avançando 4→5→7→8→9→4 e 4→5→6→8→9→4, salto 10/11 no ar e parado ao pousar (**JV09**). A jornada revelou e corrigiu um falso «editado manualmente» em instâncias antigas (default `face_direction` no `sprite_move` mudava a assinatura ao reabrir).

<a id="matriz-implementacao-r3-r7"></a>
## Matriz de implementação R2/R3/R5/R6/R7 — checkpoint 2026-11-06 (Experimental)

Branch `codex/new-host-cohesion-20261024`, PR112. Host READY (`host:diagnose`, launcher `new-host.sh`, `RDS_BUILD_JOBS=1`). Gates de cada commit: `check:tree`, `lint`, `tsc --noEmit`, `npm test` verdes; Rust não alterado nestes lotes (Clippy/`cargo test` não reexecutados). Jornada nativa: binário debug do Tauri real dirigido por `tauri-driver`/WebKitWebDriver (cliques/teclas nativos), 949×593 lógicos (painel 800×1280 girado, escala 1,35), fixture de QA `sessions/ux-r3-20261105/projects/QA_R3_Lote1` (cópia identificada de `UX_Validacao_949`, restaurada a cada execução; projeto autoral intocado). Evidências: `sessions/ux-r3-20261105/evidence/`. Revisão das capturas feita pelo agente; **aceite humano independente não ocorreu**.

| ID | Estado | Commit | Prova | Falta / limite |
|---|---|---|---|---|
| R3-05 | integrado (parcial) | `cc7e5f0a` | teste de metadados (faixas canônicas, `jump_strength` em 1/16 px/quadro = 4 px/quadro a 64); padrão visível no formulário | Controle A/Teclado Z já existia; inválido sem mutação já existia (não re-provado no Tauri); conferir impulso no core |
| R3-08 | validado no Tauri (parcial) | `5b71fbb4` | `sceneCompositionLock.test.ts` (objeto × camada herdada, vizinhos livres, cena autoral intocada); cadeado revelado em hover no Tauri | trava é preferência do editor (localStorage por cena); save/reopen do app e teclado nativo não exercitados |
| R3-07 | validado no Tauri | `5180502e` | 1ª linha da árvore 407→382 px a 949×593; contraste do hover/breadcrumb no tema claro corrigido | thumbnail da cena no cabeçalho não existe (sem renderer de miniatura); 1366×768 impossível neste host |
| R3-02 | validado no Tauri (parcial) | `9573e2c6` | chip «Atenuado · isolamento», Esc com prioridade de campo/popup (teste), troca de cena limpa; Esc do Viewport deixou de engolir a tecla; topo sem sobreposição a 702 px | multisseleção, Normal/Atenuado/Oculto escolhidos, filtros de cor, cenário Céu oculto→isolar→sair |
| R3-03 | validado no Tauri (parcial) | `80671c66`, `bdbeca03` | proveniência derivada das assinaturas (testes + save/reopen); selos «Gerado · N nós»/«Personalizado nos nós (k/N)»; confirmação de conversão: cancelar sem efeito → personalizar → Desfazer restaura; trilho do grafo não fecha a cada resize | diff/impacto antes de regenerar, conexões externas na regeneração, ciclos idle/run/jump no core |
| R3-01 (exibição) | validado no Tauri (parcial) | ver commit «feat(r3-01)» | `palettePlanScope.test.ts`; Inspector mostra «PAL1 nesta cena (fixado) · 15 índice(s) · origem» e consumidores; plano antigo já recusado por `contextKey` | escopo de Arte/Animação/Propriedades por bloco; aplicação compartilhada (lote 2) não re-provada no Tauri |
| R3-04 | validado no Tauri (parcial) | ver commit «feat(r3-04)» | `resolveGraphScope` (instância, arquivo compartilhado, herdado do modelo, indisponível; usos nesta cena) com teste; chip na barra do grafo no Tauri | usos em outras cenas não inspecionados; edição compartilhada com lista de usos antes de aplicar; mesma resolução exibida no Inspector |
| R3-10 | integrado (parcial) | ver commit «docs(r3-10)» | mockups R2/R5 identificados como «composição ilustrativa · não representa um estado único»; capturas reais deste checkpoint ficam separadas em `evidence/` | marcadores/legendas dentro dos PNGs não corrigidos: exige skill imagegen (indisponível nesta sessão) preservando originais |
| T5 / R3-06 | investigado; rótulo honesto | ver commit «docs(r3-10)» | contraprova no caminho oficial: o AST canônico Rust não tem ramo `load_scene` (só a função que carrega `entry_scene`); build lê apenas `project.entry_scene`. Catálogo passa a «Carregar Cena (sem execução na ROM)» | **decisão do operador (2026-11-06): manter só o rótulo honesto**; o build não recusa o nó para não quebrar importações GML (`gml_to_nodes.rs`, `scene_reset→load_scene`); mapa/drawer de transições e T4 (referências estáveis) a fazer |
| R3-06 (lista) | validado no Tauri (parcial) | ver commit «feat(r3-06)» | `collectDeclaredTransitions`/`searchTransitions` com teste (ref = objeto/`GraphNode.id`, estável após reorganizar; destino ausente/indefinido; nunca afirma execução); no Tauri, nó criado pela paleta aparece em «Transições declaradas (1) · Ainda sem execução na ROM» com busca e «Ver origem» | mapa visual/thumbnails de cenas, foco do nó após «Ver origem» não verificado por oráculo, outras cenas não varridas, cópia/movimento entre cenas; barra flutuante corta «Refazer» com trilho aberto (rolável) |
| T6 / R3-09 | validado no Tauri (parcial) | `4f4b946e` + commit «feat(t6): separate opening a scene» | **decisão do operador (2026-11-06): abrir cena ≠ definir entrada**. `switch_scene` só valida/carrega (teste Rust: `project.rds` byte-idêntico); `set_project_entry_scene` explícito; `SceneInfo.is_entry`. Tauri: criar/abrir «Gruta QA» mantém `entry_scene=scenes/main.json`; «Testar esta cena» aparece só quando difere e gera ROM `13e99d55…` (393216 B, checksum SGDK) executada no Genesis Plus GX v1.7.4 (1580 quadros; cena vazia → quadro preto, diferente da entrada); «Definir esta como entrada» grava `scenes/gruta_qa.json` e o botão some | reabrir o projeto abre a entrada, não a última cena editada; «posição de Nalu» e arco estimado a fazer; FPS de apresentação 6,8 (PLAY02); recibo do log «Inicio de teste» não capturado pelo roteiro |
| Base R2 itens 1–8 | parcial | — | navegação global preservada nas capturas | menu contextual/gestos, painéis fixáveis, feedback de arco |
| R5 trajetos — fatia 1 (retas) | validado no Tauri e na ROM (parcial) | ver commit «feat(r5)» | contrato `components.path` (`once`/`loop`/`pingpong`, pontos relativos, ponto 0 = (0,0), `frames` para chegar, `wait`), `path_issue` (Rust) = `pathIssue` (TS); recusa estruturada antes do codegen (inválido, SNES, sem sprite, física/entrada); `path_runtime.rs`: tabelas `const` em ROM + 7 B de RAM por trajeto, interpolação linear, ida e volta reaproveita o tempo da ida; Inspector «Trajeto» (modo, pontos, duração, espera, ±ponto, rascunho inválido sem mutação, ciclo estimado). Tauri: objeto «goal» (não o herói) recebeu trajeto pela UI → cena salva `{"mode":"pingpong","points":[(0,0),(64,0,60,0)]}` → ROM `1c948343…` (524288 B, SGDK) no Genesis Plus GX → pixels do canvas mudam só na faixa do objeto (x 192–204 → 150–162, dentro de 144–208) entre quadros 120 e 160 | curvas/alças/elipses, alças no Canvas, gatilhos (iniciar/parar por nó), colisão/plataforma que carrega o jogador, Undo/salvar-reabrir no Tauri não exercitados, SNES recusado, cada tecla válida grava um passo |
| R5 trajetos — fatia 2 (alças no Canvas) | validado no Tauri (parcial) | ver commit «feat(r5): canvas handles» | trajeto do objeto selecionado desenhado (tracejado, laço fechado em `loop`, alças numeradas; ponto 0 = o próprio objeto, não arrastável); `hitPathHandle`/`dropOffset`/`pathWorldPoints` com teste; arraste respeita snap 8 px e trava (R3-08), escreve o mesmo `components.path` via `withPoint`, um passo de Undo por arraste, salva via `persistActiveScene`. Tauri (ponteiro nativo): alça 1 (208,176)→(176,144) ⇒ Inspector X=32/Y=−32 e cena salva `{"x":32,"y":-32}`; Ctrl+Z volta a (64,0), Ctrl+Y refaz | rótulo do ponto 0 removido depois da captura (não recapturado); arrastar o segmento/inserir ponto no Canvas, alças de curva, teclado sobre a alça (setas) a fazer |
| R5 trajetos — fatia 3 (curvas e elipse) | validado no Tauri e na ROM (parcial) | ver commit «feat(r5): curves and ellipses» | `curve` opcional por ponto (Bézier quadrática do segmento que chega; mesmo índice de duração na volta/retorno); runtime inteiro `(a·u²+2c·u·t+b·t²)/f²`, pior caso 2048·600² < 2³¹ (teste); prévia do Canvas usa a mesma fórmula (`sampleSegment`); alças de controle (losango) arrastáveis; Inspector «Curva» + controle X/Y e «Gerar elipse» (8 curvas, loop, começa no objeto). Tauri: elipse rx48/ry24 gerada pela UI → cena com 8 curvas → ROM no Genesis Plus GX → centróide da bandeira nos quadros 100–150 satisfaz (x/48)²+(y/24)² ≈ 0,95–1,03 | arrastar alça de controle não exercitado no Tauri; alças lotam objetos pequenos a 90% de zoom; teclado sobre alças; gatilhos e colisão |
| R5 trajetos — fatia 4 (gatilhos por nós) | validado no Tauri e na ROM (parcial) | ver commit «feat(r5): path triggers» | `autostart` (padrão true, cenas antigas inalteradas) + `rds_path_<id>_on` em RAM; nós «Iniciar trajeto»/«Parar trajeto» (`path_start`/`path_stop`) no catálogo oficial → `LogicOp::PathControl` (SNES: `#error`); build recusa nó cujo alvo não tem trajeto (teste); seletor no cartão lista só objetos com trajeto; Inspector «Começa sozinho». Tauri: «goal» com autostart desligado → nó adicionado pela paleta, alvo escolhido no cartão, ligado por arraste de porta após `jump_sound` → ROM: bandeira parada x=153,3 nos quadros 90 e 110; após segurar Z (= A) anda 176,3 → 191,3 nos quadros 130 e 150 | «Parar trajeto» provado na ROM com controle (2026-11-07): autostart ligado, nó «Parar trajeto» após `jump_sound`; após segurar A, 8 capturas nos quadros 310–370 com a bandeira fixa em x=217,3 (1 valor); execução de controle sem apertar A, mesma ROM/grafo: 8 valores distintos (205→157→169, ida e volta) — evidência `r5-paths-slice4b-stop`; reiniciar trajeto; eventos «ao chegar ao ponto» como gatilho de saída; colisão/plataforma |
| R5 trajetos — fatia 5 (plataforma móvel) | integrado (sem prova na ROM) | ver commit «feat(r5): moving platforms» | objeto com trajeto **e** `collision.solid` vira plataforma: AST leva a caixa (offset/largura), runtime registra `dx/dy` do quadro, física com gravidade pousa só de cima (margem de 4 px para plataforma subindo) e é carregada pelo `dx`; cenas sem plataforma geram o mesmo código de antes; fmt/Clippy/testes de trajeto verdes em 1 núcleo | **jornada na ROM pendente** (jogador sobre a «passage_blocker» com trajeto) — interrompida por reinício do host; descida da plataforma pode separar o jogador por alguns quadros; só corpos com mapa de colisão (`ground`) |
| R5 planos/paralaxe | a fazer | — | — | prévia A/B |
| PLAY01–06 | a fazer | — | — | baseline de cadência, T6, pins, capturas |
| VIS01–08 | a fazer | — | — | inventário VIS01 primeiro |

Pico observado: `build:debug` chegou a carga 8,7 no empacotamento Vite/esbuild mesmo com `nice 19`. Teto aprovado pelo operador e medido: `taskset -c 0,1` + `GOMAXPROCS=2 UV_THREADPOOL_SIZE=2` → carga máx. 5,05, CPU total ≤ 71% (≈51% já ocupado por outros apps), build ~2 min 45 s.

Proteção do host (após travamento observado pelo operador em 2026-11-06 12:50–13:10, durante gates/build deste agente): etapas pesadas uma por vez com `nice -n 19 ionice -c3`, Vitest com `--maxWorkers=1`, `CARGO_BUILD_JOBS=1` e espera de carga < 3 antes da jornada Tauri.

Achados de harness registrados: o `element/click` do WebKitWebDriver neste host desloca coordenadas pelo DPR; o roteiro usa ações de ponteiro com coordenadas × DPR e alvo visível no topo (`elementFromPoint`). Capturas 1366×768 (DPR 1, monitor externo, `b959c5e3`): Hierarquia cortava o tipo «sprite» e quebrava nomes longos; «+ Ponto» quebrava em duas linhas. Correção (nome com truncamento + título completo, selos e tipo sem encolher, botão sem quebra) validada por lint/tsc/testes de Hierarquia+Inspector (60/60); **não recapturada** porque o host travou duas vezes (23:21 com zram 64%; 23:42 com zram 10% durante `linuxtoys-update`/«system update», pamac e flatpak do sistema, seguido de boot de 14 s com `kscreen-doctor` abortando). Novo reinício do host em 2026-11-07 durante build/jornada; o operador registrou que o build coincidiu com pressão mas **não foi demonstrado como causa**. Retomada: inventário + preservação do WIP (`preserved-20261107-1151`, SHA256SUMS), testes em 1 núcleo, commit confirmado no remoto antes de etapas pesadas. Antes disso, operador confirmou host estável em 2026-11-07; etapas pesadas retomadas com cgroup `MemoryMax=3500M`/sem swap + 2 núcleos (builds sem travar). Recaptura 1366×768: tipo «sprite» e nome «Player» visíveis, «+ Ponto» numa linha; selos reduzem a «L»/«E» (título completo no tooltip) e a meta das linhas câmera/tilemap ainda corta — causa: painel com 16% (~210 px). Preset «authoring» compacto passou a 19/61/20 (teste), mas o layout salvo do usuário prevalece; só vale em layout novo ou «Restaurar layout» (não exercitado para não apagar preferências do operador). Retenção de host: 1366×768 não cabe no painel do notebook (1280 px). Atualização 2026-11-06 23h: monitor externo DP-1 2560×1080 escala 1 conectado; capturas 1366×768 passam a ser possíveis nele.

<a id="vis01-inventario"></a>
### VIS01 — inventário de capacidades visuais (2026-11-06, leitura do código no HEAD da branch)

Hardware possível, adaptador implementado e resultado observado são evidências diferentes; esta tabela registra só o **adaptador implementado** encontrado no código. Nenhuma linha aqui foi re-observada em ROM nesta rodada.

| Capacidade | Owner | Acesso na UI | Mega Drive (emissor) | SNES | Lacuna para VIS02–07 |
|---|---|---|---|---|---|
| Plano de paletas | `palette_plan.rs` (`banks: 4`, `colors_per_bank: 16`), `palettePlan.ts`, `PalettePanel.tsx` | Inspector › Paleta; mapa PAL0–3 | plano/alocação por cena com recusa do 5º banco | IPC aceita só MD | troca rápida/variantes por perfil; SNES por domínio/modo (não `N×16` genérico) |
| Troca de paleta por golpe | `palette_swap` em `ast_generator.rs` | nó/comportamento «Trocar paleta ao sofrer golpe» | emitido | recusado pelo emissor SNES | animação de paleta/atmosfera (VIS07) sem owner |
| Prioridade de sprite | `sgdk_emitter.rs` (`TILE_ATTR(..., priority, ...)`) | campo do sprite | bit alto/baixo por sprite | — | seleção parcial de primeiro plano/oclusão (VIS03) sem owner: prioridade por tile/região não exposta |
| Paralaxe por câmera | `camera_runtime.rs`, `sgdk_emitter.rs` (razão X/Y por camada) | Configurar câmera | `VDP_setHorizontalScroll` por razão | — | prévia visual de planos A/B (R5) |
| Paralaxe/raster RetroFX | nós `effect_parallax`/`effect_raster` → `SetupParallax`/`SetupRasterEffect` | nós de Efeitos | nó lógico é `NoOp`, mas o emissor gera tabela `retro_hscroll_table[224]` com `HSCROLL_LINE` por quadro | coleta camadas/linhas (emissor próprio) | pincel de distorção/ondulação (VIS05): área pintada, envelope e modos não existem; só deslocamento X por linha |
| Scroll de tilemap | `scroll_tilemap` | nó | `VDP_setHorizontalScroll` | — | — |
| Shadow/highlight | só `tools/reverse` e `vdp_snapshot.rs` (análise) | nenhum | **não emitido** | — | Fantasma (VIS06) por shadow/highlight exige adaptador novo + prova |
| Dithering | só ferramentas de análise | nenhum | não emitido | — | Fantasma por dithering exige adaptador |
| Translucidez | nenhum owner | nenhum | não existe | — | Fantasma: investigar composição/paleta antes de habilitar |
| Trajetos de objeto | `CameraWaypoint` (câmera, linear) | Configurar câmera | só câmera | — | R5: contrato de trajeto para qualquer objeto (curvas/elipses/loop) inexistente |
| Transição de cena | `load_scene` | nó «Carregar Cena (sem execução na ROM)» | não executado (T5) | — | decisão do operador: só rótulo |

Ordem de implementação derivada: VIS02 (paletas por perfil) e VIS03 (oclusão) têm owner parcial; VIS05 estende RetroFX; VIS06 e trajetos R5 exigem contrato novo no modelo/AST/emissor antes de qualquer UI.
