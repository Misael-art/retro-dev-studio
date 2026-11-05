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
