# Reference Platformer — arte original

## Bosque Aurora — selo de conclusão, 2026-10-29 (Experimental)

Abrir [Bosque Aurora](/home/misael/Documents/RetroDevProjects/Bosque_Aurora/project.rds) no Studio. **Setas** movem e **Z** salta. Recolher as três sementes abre o portão; alcançar a bandeira revela o **broto dourado** no canto superior direito. O cadeado permanece antes da conclusão e a bandeira continua como marco de chegada. Para outra partida, usar **Parar → Testar projeto** no Studio; reinício pelo Start dentro do jogo não foi entregue (TPL-15).

Dois selos originais **32×32**, de cinco cores visíveis, foram desenhados e salvos no **PixelEditor**, com documentos nativos: `selofechado` e `seloaurora`. Compartilham os índices compatíveis do banco 2 existente; nenhum banco ou limite foi ampliado. A composição usa duas instâncias na mesma posição (264,56); **Objetivo → Esconder ao cumprir** aponta para o cadeado. O broto fica atrás dele. A legenda estática `BROTO DOURADO = VITORIA` explica o resultado. **Interface** agrupa os dois sprites e três textos; projeto com 14 entidades, quatro camadas e os mesmos 128 sólidos.

Edição: selecionar **Lume → Editar lógica (nodes) → Comportamentos → Objetivo** para mudar a condição/som. Para a imagem: **Selo fechado/Selo Aurora → Arte → Editor de pixels → Editar frames de…**; conferir recurso, nome e tamanho antes de desenhar e salvar antes de fechar. Alterar um recurso compartilhado exige conferir a paleta e a ROM. O cenário, a raposa e a progressão preservam a procedência dos checkpoints abaixo.

Após salvar/encerrar/reabrir e compilar: contador **0→2→3**, portão **0→1**, conclusão **0→1**; bloqueio x=218 com dois itens, terceira semente em (208,128), chegada (274,168) e broto visível. ROM executada/exportada **254875044b65a0b31d2eba6eac46bb6d61a5b180fc52418bb164f46bcd8d4c35**, **524288 bytes**; revisão **0 erros/1 aviso de fonte compartilhada/21 OK**. Depois da sonda de combate, a restauração pelo Inspector preservou os 24 arquivos autorais byte a byte; novo build manteve esse SHA e reinicializou contador/portão/conclusão em zero.

Evidência privada: `RDS_WORK_ROOT/sessions/templates-feedback-20261029/receipt.json`, `bosque-seal-native-result.json`, capturas **16/17/18/24** e revisão/exportação **21**. Algumas capturas iniciais mostram renderização incompleta; a mesma ROM depois mostrou todos os sprites, sem causa isolada. Não são prova de defeito determinístico dos novos assets. Tauri/WebKit/Xvfb/software, teclado X11 nativo e leituras DOM/RAM/ELF; sem aceite humano, áudio físico, GPU, Windows ou console.

**Nenhum novo template distribuído.** TPL-01 continua bloqueando pacote oficial/catálogo. Bosque e Jardim Mares permanecem candidatos parciais: trilha, HUD de progresso e replay não acabados; Jardim conserva também TPL-12. Jardim não mudou nesta fatia. Sondas de Carregar Cena e Golpe autoral registradas em TPL-15/16; não há arena nova ou código do jogo escrito por fora. TPL-17 registra o build recusado por revisão alterada enquanto a sonda estava aberta no NodeGraph. Owners/aceites no roadmap existente.

## Histórico dos candidatos — cenário e Jardim Mares, 2026-10-29

**O catálogo/builtin permanece inalterado; nenhum novo template foi distribuído.** Os projetos abaixo foram montados pela interface do Studio e ficam no destino privado de projetos/artefatos. O bloqueio projeto salvo → pacote oficial → catálogo está em TPL-01, no roadmap. Os arquivos deste diretório continuam sendo as fontes do builtin anterior.

**Bosque Aurora:** abrir `/home/misael/Documents/RetroDevProjects/Bosque_Aurora/project.rds`. Lume explora uma floresta azul/verde, recolhe três sementes âmbar e abre o portão para a bandeira. **Setas** movem; **Z** salta. O novo cenário original inclui raízes, pedras, flores e ilha: 320×224, 15 cores visíveis; piso y=200 e ilha y=160 alinhados pela UI ao mapa sólido (128 células). A substituição eliminou o aviso anterior de 2788 pixels aproximados. Raposa/portão/bandeira/SFX preservam a procedência histórica abaixo. Música, HUD de progresso, vitória/replay e distribuição permanecem parciais.

**Jardim Mares:** abrir `/home/misael/Documents/RetroDevProjects/Jardim_Mares/project.rds`. Nalu, uma tartaruga de casco dourado, nada por uma laguna de corais. **Quatro setas** movem; recolher as três pérolas e voltar ao farol no alto conclui o objetivo. Voltar antes das três não conclui. Cenário próprio de 15 cores, revisado para retirar textura excessiva dos caminhos; Nalu 32×32 com folha de cinco quadros, duas poses de nadadeiras editadas no PixelEditor; pérola 16×16 desenhada no mesmo editor, compartilhada pelas instâncias. Camadas Background/Camera/interface/jogabilidade, HUD estático e SFX. Gravidade desligada; câmera fixa. **Pode sair pelo topo da área (TPL-12)**; sem trilha/replay finais, HUD de contador ou distribuição oficial. Não é modelo pronto.

Para editar, selecionar Lume/Nalu na Hierarchy → **Editar lógica (nodes)**. Contador, coletas e objetivo estão em **Comportamentos**. No Bosque, movimento/salto e passagem também usam Comportamentos. No Jardim, os quatro ramos de entrada/movimento foram conectados pelas portas; o `dy=-2` foi ajustado pelo controle numérico nativo. Inspector X/Y move as instâncias; Arte/Pixels edita o recurso e os frames. Salvar → encerrar/reabrir → Testar projeto → Revisar/exportar foi exercitado nos candidatos; comparar as identidades executada/exportada no recibo final.

Procedência da continuação: geração raster original por `image_gen`; cenário do Bosque editado a partir da própria arte original do projeto, laguna/Nalu novos e laguna refinada após inspeção na ROM. Fontes, prompts, specs, hashes e jobs imutáveis estão em `RDS_WORK_ROOT/sessions/templates-content-20261029/`. Foi reutilizado o conversor existente `SGDKForge/tools/sgdk_wrapper/forge_art`, sem editar esse projeto: nearest-neighbor, grade VDP/rescomp, índice 0 reservado, até 15 cores visíveis, sem dithering. Conversão não é aprovação estética humana. Importação, montagem, colisão, metadados, animação e regras foram feitos pelos controles do Studio; scripts privados só dirigem testes nativos, convertem assets e protegem evidência.

ROM final do Bosque: **131587e2c7cfec58e8729e228c19608608b8860db325dc8cd8a25e082fffaf20**, 524288 bytes, executada após reabertura e exportada pela revisão (0 erros/1 aviso de fonte compartilhada/17 OK). Contador 0→2→3, portão 0→1, conclusão 0→1; bloqueio com duas sementes x=218. Jardim Mares: **2c67153cf691848fa23e1d62fa469cb4ee526f5d40938c205dbc6a4b135350e7**, 524288 bytes, executada após reabertura e exportada pela revisão (0 erros/0 avisos/19 OK). Contador 0→1→2→3, conclusão 0→1; sonda de borda y=-10, retorno pelos controles. App congelado `fdf0c4fb…`, Tauri/core oficial em Xvfb/software. Recibos finais das duas ROMs e capturas em `sessions/templates-content-20261029/receipt.json`; não herdar aceite humano, desktop físico, áudio físico, Windows ou console. TPL-01..14 registram os limites com owners/aceites. Arena/nave e transições/parallax continuam sem nova qualificação autoral; não prometer suporte pelo simples aparecimento de um nó no catálogo.

## Instância Bosque Aurora anterior — checkpoint 2026-10-28/29

O builtin deste diretório não foi substituído. Uma instância foi criada pelo wizard e editada exclusivamente no Studio: raposa Lume, três sementes âmbar originais desenhadas no PixelEditor, portão condicionado à coleta, salto apoiado, chegada, instruções e camadas. Quatro células pintadas retiram as amostras técnicas do céu; colisão permanece 88. Arte da raposa/portão/bandeira/paisagem reutilizada com a procedência abaixo. Nenhum asset comercial novo.

Para abrir no host de autoria, use **Abrir Projeto → `Bosque_Aurora/project.rds`**, na pasta padrão de projetos. Criar outro `reference_platformer` pelo catálogo ainda gera o conteúdo anterior. O projeto e as capturas são artefatos privados no destino operacional do Memory Bank, não uma entrada distribuída do catálogo; TPL-01 no roadmap registra a falta desse fluxo oficial.

Controles: **Setas** movem e **Z** salta. Colete as duas sementes do chão e salte para a semente sobre a plataforma; as três abrem o portão. Toque a bandeira: ela some e toca o som de conclusão. Esta é a regra observada, ainda sem apresentação final ou reinício acabados.

Para editar pela interface:

- Hierarchy → **Lume - raposa aventureira** → Lógica → **Comportamentos**: editar movimento/salto, contador, coletas, passagem e objetivo. O contador é compartilhado e cada item vale um ponto uma vez por partida.
- **Semente 1/2/3** → Inspector X/Y altera só a instância. O recurso `assets/sprites/pixel/sementeaurora.png` e seu documento nativo são compartilhados; usar Arte/Pixels para alterá-lo exige revisar o plano de paletas antes do build.
- Camadas **Background**, **Gameplay**, **Camera** e **Interface** organizam cenário, elementos jogáveis, câmera e textos. Salvar → Testar projeto → Revisar/exportar é o fluxo exercitado.

App Tauri SHA `fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c`; instância reaberta, executada e exportada com ROM SHA **7935b17a702674bb4eeddff261668e5b0662b756ebf8d12adf63265a3c646ee8**. Recibo privado `RDS_WORK_ROOT/sessions/templates-authoring-20261028/receipt.json`, SHA `5e3d2ccc8d0716955fa93c3ee906f16681206f1ffaa2fdaa31d6c73b084c1d23`. Quadros reais `20-reopened-game.png`, `21-final-gate-closed.png`, `22-final-platform.png`, `23-final-victory.png`; revisão/exportação em `24-review-export.png`.

O resultado continua **parcial/Experimental**: terreno e música provisórios, 2788 pixels aproximados na fonte herdada do cenário, HUD sem vínculo de contador e falta de publicação oficial do projeto como template. Compartilhamento de paleta foi configurado na UI, mantendo quatro bancos. Inspeção do agente em display virtual/software não é aceite estético humano ou teste em console. Demais limites/owners/aceites: TPL-01..08 no roadmap.

## Fontes e integração anteriores

Estas duas imagens são conceitos originais gerados para o template builtin `reference_platformer`:

- `fox-concept.png`: raposinha aventureira kawaii com cachecol vermelho e espada de madeira, em cinco poses.
- `environment-concept.png`: portão de madeira, bandeira de chegada, terreno, nuvens e céu.

Modo de geração: imagens raster novas, sem imagem de referência e sem ativos comerciais. Direção visual: pixel art 16-bit legível, formas fofas porém corajosas, silhuetas claras e cores quentes para a personagem contra céu azul.

## Raposa: candidato de integração

O conceito de cinco poses foi separado mecanicamente em `fox-frame-{0..4}-source.png`, centralizado em cinco telas 512×512 e reunido em `fox-five-frame-source.png`. O SGDK Forge converteu o conjunto para `fox-five-frame-32-candidate.png` (160×32, cinco quadros 32×32, 15 cores visíveis, índice 0 transparente), usando o spec `fox-five-frame-convert-32.json`. Job imutável: `fox_five_frame_32_control/6e2081f30dc244e8`; SHA-256 do PNG: `20bc7c5906a415d2ef8a38b21a7ad18930b9946b6fa62eeede4acfc15e3a972c`.

O backend usa `fox-five-frame-32-runtime.png` no template em vez de desenhar a raposa por caracteres em Rust. Essa cópia tem PNG RGBA (necessário para o decoder do WebView) e os mesmos pixels RGBA do PNG indexado do Forge: SHA-256 dos pixels brutos `605d25582856b511307adddb083684ab4cc4007e2219a761a9b4175943ece1b6`; SHA-256 do arquivo RGBA `8f104172610518705021450603f04bfd4d2fc0ed997e7c71de21cdb54874c735`. A conversão técnica **não equivale a aprovação visual**: o SGDK Forge classifica a saída como `technical_candidate` e exige revisão humana antes de promovê-la a arte final. O teste no desktop e a decisão visual continuam necessários. As sondas 16×16 e 24×24 foram rejeitadas por perderem rosto e espada; 48×48 e 64×64 melhoram detalhes, mas mudariam mais a escala e a jogabilidade da fase. A escolha experimental de 32×32 preserva a legibilidade sem aceitar automaticamente uma das sondas maiores.

## Portão e bandeira

Do conceito de ambiente foram produzidas duas fontes isoladas novas, `gate-source.png` e `goal-flag-source.png`. O SGDK Forge gerou candidatos técnicos indexados, e cópias RGBA de pixels idênticos foram colocadas no template para leitura segura pelo WebView:

- Portão fechado: `gate-24x32-runtime.png`, 24×32; job `gate_24x32_control/0e03fcad24713a68`; SHA-256 do arquivo `a63bf02ab318607fb768054a31b9495756d5501488145a2608ae0d996d02d0f5`; SHA-256 dos pixels RGBA `248d6ac6a0ad337ae6b24b3600a3a21e66c61e26de91d74ac43345c4f778f2ce`. O bloqueador físico também mede 24×32; abrir a passagem continua removendo esse bloqueio.
- Bandeira de chegada: `goal-flag-16x32-runtime.png`, 16×32; job `goal_flag_16x32_control/92adcc1cdf06cb15`; SHA-256 do arquivo `3422d4cd0db2f5e9c3b5038c3fbc2210a14a41ae635c2c2776a856a99faeb6bf`; SHA-256 dos pixels RGBA `f604de87f8e060f70c92440a85ebe87660fbb1a785b6a84126860458aba53445`. O sensor de vitória permanece independente do desenho.

## Paisagem do cenário

`stage-scene-concept.png` é o conceito gerado para a paisagem; a edição `stage-backdrop-source.png` removeu piso e plataforma para que a imagem não insinuasse colisões inexistentes. O SGDK Forge traduziu o fundo para 320×224 e 10 cores visíveis no job `fox_stage_backdrop_10_control/ec6421319a78f856`; o PNG indexado `stage-backdrop-320x224-10-candidate.png` tem SHA-256 `b9a01ad8a6520f6a405e2d1ed87a416a317ec272fecf8341548d4c7d6b8461bd`. O backend o usa somente como fundo da imagem PPM do tileset. Piso nas linhas 26–27 e plataforma na linha 21 continuam alinhados ao mapa de colisão, com os seis tons de grama/terra/tijolo existentes; a paleta final do cenário ocupa 16 cores. O candidato anterior de 15 cores (`stage-backdrop-320x224-candidate.png`, job `bbd1e3d8ac6240ca`) foi mantido apenas como sonda: não deixava espaço para os materiais do primeiro plano no mesmo slot.

O fundo melhora nuvens, montanhas e floresta, mas grama, terra e tijolo do primeiro plano **ainda são provisórios**, gerados pelo backend. A saída do Forge é `technical_candidate`, não aprovação estética. Raposa, portão, bandeira e fundo são candidatos visuais integrados para teste; nenhuma ROM ou asset BYOR foi incorporado.

## Provas da integração (2026-09-23)

| Cenário | Binário SHA-256 | Resultado e evidência versionada |
| --- | --- | --- |
| Autoria guiada, viewport, salvar/reiniciar/reabrir e vitória pelo teclado | `9224bdd04343d14402e83b61d842a4ee0fe485c62805bb6715b1fbcfc629cb37` | 10/10 passos; `doc/evidence/authoring-acceptance-2026-09-23T22-13-07-834Z-report.json`; capturas `…-01-guided-editor-loaded.png`, `…-07-reopened.png`, `…-08-victory.png`. O canvas mostrou 49 pixels de pelagem, 14 da espada, 36161 de céu e 5852 de montanhas antes de editar; após reabrir, os recursos e a paisagem foram lidos novamente. ROM jogada SHA-256 `01ebd95e508c8b821b0746d8453706d7e282d515cc16ad6233a68c5524c463b8`. |
| Platformer de referência: edição, colisão, passagens, movimento, salto, pausa e persistência | mesmo binário | 16/16 passos; `doc/evidence/reference-platformer-2026-09-23T22-14-01-409Z-report.json`; captura `…-04-gameplay-controls.png`. |
| Contrato nativo de dimensões, transparência e paletas | teste Rust `reference_platformer_art_fits_native_sizes_and_md_palette_slots` | passou: raposa 160×32, portão 24×32, bandeira 16×32, cenário opaco 320×224, até 16 cores por slot. |

Os relatórios da primeira execução da paisagem (`22-00`/`22-02`, binário `f8763605…`) e as capturas anteriores em `target-test/validation` permanecem como histórico; a matriz acima usa o rebuild após o commit `9901b5f`. A aprovação humana da direção de arte e a substituição definitiva dos tiles do primeiro plano continuam pendentes. O template segue **Experimental**.
