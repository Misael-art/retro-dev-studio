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

- `01-cena-contextual.png`: herói selecionado, menu do botão direito, isolamento, paleta e camadas, painéis abertos/recolhidos com fixação.
- `02-cenas-e-logica.png`: mapa de cenas A→B, A→C e C→A; thumbnail e fundo sutil da cena ativa; nós A1…A4, contexto do objeto e Inspector compacto.
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

## Reavaliação crítica R2 — 2026-11-05 (proposta vigente para discussão)

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
