# Continuidade REX: cinco jogos Mega Drive completos e editáveis

Data da revisão: 2026-10-31. Pedido do operador: avaliar o avanço do decompilador e preparar uma missão de continuidade até cinco jogos completos disponíveis para modificação no RetroDev Studio.

## Avaliação que fundamenta o prompt

Snapshot consultado: branch `codex/new-host-cohesion-20261024`, HEAD `501a87f7a50d2294453c33c553d8bc720989fd04`. Há trabalho não commitado em `rex_sgdk_project.rs`, `mod.rs` e `rex_m68k_flow.rs`; o próximo executor deve reler o estado, preservar esse trabalho e identificar seu owner antes de integrar alterações.

Avanços reais:

- `8240c51a`: reconhecimento de bibliotecas por assinaturas tolerantes a relocação, com 331 entradas e validação separando projetos. Evidência estática L1. Um caso, KIRBY_FAN, ficou abaixo do limiar de precisão congelado: 0,898 contra 0,9.
- `9ed31b2d`: recuperação estrutural de recursos SGDK. O fechamento registra Images com precisão/revocação de 100% no corpus de referência, sprites parcialmente recuperados e 1.418/1.507 quadros idênticos aos originais. Há 89 divergências de quadros a investigar; HAMOOPIG e TAIKETSU também têm definições de sprites não recuperadas. A contagem de quadros divergentes e a de definições ausentes são métricas diferentes.
- `501a87f7`: projeto de recursos e remontagem da ROM conservando segmentos originais. O fechamento registra Irmãos Aratu com 74 Images, 21 sprites, 275 quadros, 12 músicas XGC e 77,4% dos bytes atribuídos. Esse percentual não mede lógica recuperada nem todo o conteúdo efetivamente regenerado a partir de fontes editáveis.
- WIP: descoberta de funções, chamadas e referências M68K, com separação entre entradas estritas e inferidas. Reutiliza o decodificador existente. É uma base para análise de fluxo; ainda não implementa a semântica completa do jogo nem sua projeção executável em nós.

Lacunas decisivas:

1. A remontagem depende de segmentos binários preservados nos offsets originais. Não demonstra reconstrução da lógica a partir de um modelo editável, nem reinserção geral com mudança de tamanho.
2. O escritor novo não está integrado ao fluxo nativo do editor: seus usos encontrados estão no backend/teste ignorado; ele emite recursos, manifesto e plano de remontagem, não um projeto completo de cenas e lógica do RetroDev Studio.
3. Áudio recuperado concentra-se em XGC; copiar a sequência binária não equivale a ter música, instrumentos, efeitos e gatilhos editáveis. XGM2, PCM avulso e outros formatos permanecem lacunas. A semântica Z80 e a interação com o jogo também precisam de prova.
4. Persistem restrições de fidelidade ou editabilidade em partes sobrepostas, índices de cores ambíguos, recursos comprimidos e temporização: a declaração SPRITE usa a duração do primeiro quadro, embora o grafo registre durações individuais. Preservar os bytes de um recurso recusado mantém a conservação, mas não o torna editável.
5. O teste `write_project_from_rom` imprime a comparação da ROM remontada, mas não a exige com uma asserção. A prova de um pixel fica dentro de uma condição que permite passar sem encontrar alvo. O teste de fluxo M68K também imprime métricas sem impor seus limiares. Esses gates devem falhar quando a prova faltar.
6. A documentação registra um projeto privado em `~/.retrodev/decomp_work/rex_projects/irmaos_aratu_rev1/`; ele não foi localizado nesse caminho durante esta revisão. Localizar o artefato e conferir seus recibos, ou reproduzir a prova, antes de tratá-la como evidência disponível no host atual.

Fontes: [fechamento das assinaturas](../rex_profiles/libsig/FECHO-LIBSIG-SGDK-2026-10-30.md), [fechamento dos recursos e remontagem](../rex_profiles/libsig/FECHO-SGDK-RECURSOS-PROJETO-REMONTAGEM-2026-10-30.md), [arquitetura REX](../14_REX_ARQUITETURA_UNIVERSAL.md), [plano de decompilação](../12_DECOMPILACAO_PAREADA_PLANO.md). Métricas acima são as registradas nesses fechamentos, confrontadas com o código; não foram reproduzidas nesta revisão. O diagnóstico oficial do host retornou READY. Não foram executados builds ou jornadas de gameplay para esta avaliação documental.

## Prompt para entregar ao agente executor

Você dará continuidade ao REX no RetroDev Studio. Seu objetivo autorizado pelo operador é entregar **cinco jogos de Mega Drive inteiros disponíveis na engine para modificação**, com lógica executável, sprites/animações, cenários/mapas, colisões, paletas, músicas, efeitos sonoros e vínculos entre esses elementos. Trabalhe até demonstrar o resultado nos cinco títulos, preservando a verdade sobre o que ainda falta.

Não encerre a missão após planejamento, extração de assets, uma ROM remontada, um pixel alterado, pseudocódigo ou cinco telas iniciais. Esses são marcos intermediários. Cinco jogos comprovados também não autorizam afirmar suporte universal a qualquer ROM.

### 1. Assuma a continuidade sem destruir o trabalho existente

Leia `AGENTS.md`, a política de Projects, `docs/06_AI_MEMORY_BANK.md`, `docs/03_ROADMAP_MVP.md`, `docs/08_TREE_ARCHITECTURE.md`, `docs/00_AI_DIRECTIVES.md`, `docs/09_AGENT_DEV_MODE.md`, `docs/14_REX_ARQUITETURA_UNIVERSAL.md` e `docs/12_DECOMPILACAO_PAREADA_PLANO.md`. Leia os dois FECHOs citados na avaliação, o código atual e o WIP M68K. Considere o snapshot deste documento uma referência histórica, não o estado atual garantido.

Responda com `[Contexto Carregado]`. Registre HEAD, branch, alterações locais, owners, PR/checks e dependências. Preserve alterações de outros agentes. Respeite a lease de operações; não remova locks legítimos, mate processos alheios ou concorra com uma compilação pesada existente.

Use somente o checkout canônico `/home/misael/Projects/RetroDevStudio`. Runtime, corpus privado, gerados e evidências seguem os destinos oficiais, incluindo `RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio`. Use o launcher/host-manager, faça o diagnóstico e só altere código com host apto. Comece com `RDS_BUILD_JOBS=1`; confira disco, RAM e carga antes de operações pesadas.

Registre este pedido como ampliação explícita da meta operacional para cinco reconstruções completas. Preserve decisões arquiteturais consolidadas, contratos de evidência e histórico. Reutilize o motor, perfis versionados, codecs, libretro, IR, NodeGraph, editores e stores existentes. Não comece outro motor universal nem uma reescrita geral.

### 2. Congele os cinco alvos e os oráculos

Localize o corpus BYOR efetivamente disponível. Selecione e registre cinco títulos independentes, com SHA-256 completo, revisão, tamanho, contêiner, família de engine, origem autorizada e caminho privado. Inclua Irmãos Aratu como primeiro candidato à reprodução da base já documentada, se a revisão estiver disponível. HAMOOPIG e TAIKETSU têm histórico de oráculos; verifique disponibilidade e revisão antes de adotá-los. Caminhos históricos não são prova de disponibilidade.

Busque diversidade real: versões/engines diferentes, pelo menos dois jogos não-SGDK, se disponíveis no corpus autorizado, e um título de holdout separado da calibração. Hacks e revisões do mesmo jogo não contam como títulos independentes. Se faltar diversidade ou uma ROM indispensável, registre a lacuna e peça somente a disponibilização necessária; avance nos alvos disponíveis sem declarar a matriz completa.

Congele a seleção antes de medir sucesso. Não troque um alvo difícil por outro fácil para completar a contagem. Registre qualquer mudança de escopo e seu motivo. Fontes, símbolos e recursos originais de homebrews servem como oráculo independente: não podem vazar para a entrada ROM-only nem ser copiados para simular recuperação.

Para cada jogo, defina rotas reproduzíveis de boot, menus, gameplay, transições, morte/reinício, chefes/fim e persistência quando existente. Inventarie todos os níveis, cenas, personagens, estados, recursos e subsistemas encontrados, incluindo os não visitados pela rota principal. Trilha de inputs finita fornece evidência nos cenários executados; não é prova formal de todos os inputs possíveis.

### 3. Estabeleça uma régua que não aceite falso sucesso

Mantenha separadas as medidas de bytes atribuídos, recursos detectados, conteúdo decodificado, conteúdo editável, conteúdo regenerado, comportamento observado e equivalência demonstrada. Bibliotecas identificadas, ponteiros inferidos e segmentos preservados não contam automaticamente como blocos lógicos reconstruídos.

Use dois gates independentes:

- **Conservação:** importar e exportar sem alterações restitui a ROM byte a byte, com asserção e SHA-256. Preservação de bytes desconhecidos é válida neste modo.
- **Reconstrução editável:** lógica e recursos recuperados geram o comportamento do jogo a partir do projeto, recebem alterações reais pela UI e produzem a ROM efetivamente executada. Código principal original embutido como blob, execução da ROM doadora por trás da prévia, bridges vazias e substituição por cenas aproximadas não satisfazem este gate.

Não exija layout binário idêntico de uma recompilação legítima quando houver relocação ou outro codegen; exija semântica preservada e diferenças explicadas, com contratos/tolerâncias congelados antes da medição. Não ajuste critérios depois de ver o resultado.

Toda prova obrigatória ausente deve falhar. Conserte os testes que apenas imprimem resultados: assert de igualdade no no-op, assert de alvo de edição existente, assert de limiares de análise e erro explícito para corpus ausente. Não apresente testes ignorados ou cenários pulados como aprovados.

### 4. Feche primeiro uma vertical completa

Reproduza a recuperação de Irmãos Aratu, localizando/protegendo os artefatos anteriores ou regenerando-os com recibo. Depois avance do primeiro jogo completo para o segundo e assim por diante, reaplicando as operações genéricas. Evite acumular cinco inventários parciais sem nenhuma jornada fechada.

Organize o trabalho por causa, owner, dependências e aceite. Cada incremento precisa de uma prova que antes falhava e passe a funcionar. Atualize perfis como dados, não com condicionais Rust por título ou offsets mágicos. Uma nova necessidade deve virar operação genérica ou perfil versionado com precondições verificáveis.

### 5. Complete a recuperação visual sem perdas silenciosas

Investigue os 89 quadros divergentes e as definições de sprites ausentes. Preserve índices de cor, transparência, bancos, composição de partes sobrepostas, flips, prioridade, offsets, pivôs, duração individual dos quadros, eventos e compartilhamento de recursos. Não transforme animações alternativas em atores simultâneos.

Recupere mapas, metatiles/chunks, planos, scroll/parallax, colisões e vínculos com a lógica. Distinga folha de tiles de imagem montada e apresente a composição pronta para trabalho. Compartilhamentos e aliases precisam permanecer explícitos ao editar; cores RGB iguais não autorizam fundir índices com funções diferentes.

Implemente a reinserção dos formatos comprimidos necessários aos cinco alvos com round-trip verificado. Recursos de tamanho variável exigem plano de layout, relocação, atualização de referências e checksum quando aplicável. Valide limites, intervalos, sobreposição, tamanhos, schema, identidade e integridade antes de escrever. Entrada malformada, PNG redimensionado ou plano incompatível deve produzir diagnóstico recuperável, sem panic, truncamento ou corrupção silenciosa.

### 6. Transforme descoberta de código em lógica executável

Evolua `rex_m68k_flow` e a infraestrutura existente: diferencie entradas demonstradas de inferências, construa CFGs, resolva tabelas de despacho, chamadas indiretas, callbacks e interrupções relevantes. Recupere uso de dados, estado global/por objeto e referências efetivamente consumidas. Nomes de bibliotecas são hipóteses com confiança, não semântica automaticamente comprovada.

Use IR de baixo nível completa para os caminhos necessários e uma projeção organizada em blocos/nós para atores, estados, movimento, física, colisão, câmera, input, HUD, progressão, IA, áudio e persistência. Preserve flags, larguras, signedness, overflow, memória, ABI, temporização e IO relevantes. Lógica sem estrutura de alto nível recuperável pode permanecer em representação de baixo nível editável e executável, identificada como tal; blob opaco não conta como lógica recuperada.

Valide M68K e Z80 quando usados pelo jogo, incluindo sua comunicação. Reutilize os decodificadores e backends existentes; não crie outro emulador. Faça testes diferenciais das operações e do codegen contra referência confiável. Quando faltarem PC/VDP/bus trace reais, implemente instrumentação no adaptador/core seguindo o processo de dependências oficiais. Mock ou execução isolada de instruções não provam consumo pelo jogo original.

Cada bloco deve ter origem consultável, entradas/saídas, estado alterado e efeito comprovado. Resolva os caminhos necessários à completude dos cinco jogos. Não faça uma operação desconhecida virar no-op para permitir build. Código reconhecido precisa ser usado na ROM gerada; prove isso com hash do artefato e alteração causal em execução.

### 7. Recupere o áudio como material de trabalho

Identifique drivers e formatos presentes nos alvos: FM/PSG, DAC/PCM, sequências, instrumentos, padrões, loops, efeitos e gatilhos. Implemente XGM2 e demais famílias conforme a matriz real exigir. Exportar XGC binário ou gravar um WAV da emulação não entrega trilha editável.

Organize músicas e SFX no editor existente, com prévia, parâmetros/estrutura recuperados, vínculo com cenas/eventos e reinserção. Preserve duração, canais, prioridades, loops, pitch e sincronização. Demonstre uma alteração musical e uma de efeito/evento sonoro por jogo no contexto do gameplay, sem substituir por silêncio ou trilha genérica. Compare eventos e áudio renderizado com método/tolerâncias explícitos; não confunda variação do backend com equivalência irrestrita.

### 8. Entregue os cinco projetos dentro da engine

Integre o recuperador ao fluxo nativo Tauri e ao formato canônico de projeto, cenas, assets, animações, lógica e áudio. O usuário deve importar a ROM, ver progresso/diagnóstico, abrir a cena montada, selecionar um personagem, editar animação/lógica/som, salvar, reabrir e testar sem comandos de terminal ou edição manual de JSON.

Use agrupamentos reconhecíveis por cena, ator, estado e subsistema, nomes amigáveis e busca; mantenha offsets/detalhes técnicos acessíveis na inspeção avançada. Evite um grafo gigante de instruções como única experiência de edição. Vincule seleção entre cena, Art, lógica e áudio usando o contexto existente. Mostre dependências e impacto de alterações compartilhadas.

Trate cancelamento, retry, retomada após falha, mudança de projeto durante tarefa, cache obsoleto, undo/redo e reabertura a frio. Nunca reutilize uma ROM antiga quando um build novo falhar. Cada botão precisa executar a ação anunciada e preservar o estado do usuário. Superfícies ainda parciais continuam Experimental.

### 9. Prove edição e equivalência em cada ROM

Cada um dos cinco títulos só recebe PASS com todas estas condições:

1. Inventário completo e navegável de lógica, visuais, mapas/colisões e áudio; nenhuma lacuna relevante escondida em “suportado”.
2. No-op byte-exato aprovado; reconstrução executável a partir do modelo editável aprovada separadamente.
3. Rotas de gameplay reproduzidas contra a referência original, com inputs, core/versão, estados, vídeo e áudio registrados. Inclua cenas/níveis e subsistemas além da abertura. Explique diferenças, cobertura e limites restantes.
4. Pelo menos três alterações de comportamento de naturezas diferentes pela UI — por exemplo movimento/física, transição/regra de estado e IA/progressão — com efeito causal previsto. Mudar apenas um literal por patch não comprova recuperação geral da lógica.
5. Alterações de sprite/animação, cenário/colisão, música e SFX; uma sessão com alterações combinadas. Prove duração dos quadros, orientação, transparência e vínculos corretos.
6. Salvar, encerrar, reabrir a frio, reconstruir, executar, desfazer/refazer e exportar patch. Aplicar o patch à base correta em verificação independente; rejeitar revisão errada. Nenhum passo essencial depende de um editor externo escondido.
7. Controles negativos: base/hash errado, dados corrompidos, referências indiretas ambíguas, recurso compartilhado, entrada não suportada, build falho e resultado antigo. Corrupção, perda de áudio e regressão visual têm de reprovar o gate.

Inclua controles original→original, projeto sem edição, edição causal e reversão. Preserve evidências independentes da implementação para evitar testes que apenas repitam seus próprios algoritmos. O holdout precisa funcionar pela mesma infraestrutura, sem código Rust exclusivo para ele; declare separadamente quando houve calibração de perfil.

### 10. Valide, preserve e continue até 5/5

Execute os gates aplicáveis do AGENTS: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `cargo clippy -- -D warnings`, `cargo test --lib -- --nocapture` e `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, com o workspace/manifest e ambiente oficiais. Faça `npm run host:certify` quando tocar build, emulação, host ou toolchains. Se mudar dependências/segurança, execute as auditorias exigidas e documente compatibilidade/lock/stack. Não desative gates para aprovar o lote.

Execute o aplicativo Tauri real pelo launcher e percorra importação→edição→salvar/reabrir→Build→ROM→Emulação→patch nos cinco títulos. Vite, Vitest, screenshot isolada ou host READY não substituem essa prova. Use dependências oficiais e registre o mesmo SHA/binário em todas as evidências da entrega.

Mantenha matriz por ROM e capacidade com PASS/FAIL/BLOCKED e links aos recibos: identidade, recursos, lógica, áudio, integração/UI, conservação, reconstrução, edição causal e exportação. Registre métricas de desconhecidos e falhas, não apenas percentuais favoráveis.

Trabalhe em incrementos revisáveis; preserve fontes no Git e artefatos privados em seus destinos, com manifesto/hash e recuperação verificada. Não comite ROMs, músicas, assets privados ou credenciais. Não baixe ROMs nem envie corpus a serviços externos. Downloads e recursos seguem limites do projeto; dependência nova só com justificativa concreta. Não publique release nem altere decisões consolidadas implicitamente.

Atualize o Memory Bank e este handoff com SHA, implementações, testes, evidências, limites, bloqueio real e próximo comando exato. Respeite o trabalho ativo de outros owners ao commitar/publicar. Interrupção de sessão, limite de contexto ou marco parcial exige checkpoint retomável, não declaração de missão concluída.

Continue implementando, testando e corrigindo até **5/5 ROMs com todos os gates aprovados**. Dificuldade técnica pede investigação e implementação; não é motivo para encerrar em um relatório. Se houver impedimento externo indispensável, identifique precisamente o dado/acesso/decisão que falta, preserve o avanço e trabalhe no que for independente. Não invente provas, não reduza a meta silenciosamente e não prometa equivalência universal com base em observações finitas.

Sua entrega final deverá permitir ao operador abrir os cinco projetos na engine e modificar o jogo de ponta a ponta, acompanhada de matriz de aceite reproduzível, inventários, roteiros de teste e limites de suporte honestos.

## Registro de continuidade sugerido ao executor

Ao integrar este pedido ao Memory Bank, registrar que a revisão de 2026-10-31 confirmou avanços L1/L2 de assinaturas/recursos e remontagem preservadora, mas não cinco jogos com lógica integral editável. Registrar a nova meta explícita, a separação entre conservação e reconstrução, o owner do WIP M68K, os cinco SHA-256 congelados e o primeiro gate reproduzido. Este documento não promove suporte nem altera decisões arquiteturais consolidadas.

## Checkpoint de execução 1 (2026-10-31)

Estado: missão **em curso, 0/5**. Registro canônico no Memory Bank (checkpoint 2026-10-31). Evidências privadas em `$RDS_WORK_ROOT/rex_five_games/` (`FREEZE-2026-10-31.md`, `MATRIX.md`, `receipts/`, `inputs/`, `projects/`).

Próximos passos, em ordem:
1. Causa de Tanzer/Old Towers ficarem com 0 Image/Sprite (versão do SGDK/layout de struct/compressão). Corrigir como operação genérica ou perfil versionado; Aratu deve permanecer 74/21/275.
2. Precisão das sementes por operando (0,71 em HAMOOPIG/Mugenesis): filtrar candidatos sem evidência de uso como código.
3. XGM2 (Tanzer), mapas/colisões e perfis não-SGDK (Sonic 1: reaproveitar o piloto `docs/REX_SONIC1_PILOT.md` e os codecs Kosinski/Nemesis existentes).

Comando exato de reprodução (no `src-tauri/`):
```
W=/home/misael/Shared/ProjectRuntime/RetroDevStudio/rex_five_games
RDS_REX_ROM=$W/corpus/<sha>/rom.bin RDS_REX_OUT=$W/projects/<nome> RDS_LIBSIG_DICT=$W/inputs/dictionary.json cargo test -j1 --lib write_project_from_rom -- --ignored --nocapture
RDS_SGDKRES_TRUTH=$W/inputs/truth.tsv cargo test -j1 --lib flow_function_starts_vs_truth -- --ignored --nocapture
```

## Checkpoint de execução 2 (2026-10-31)

Feitos os itens 1 (Tanzer/Old Towers) e parte do 3 (o áudio de Tanzer era XGC sem alinhamento, não XGM2). Detalhes no Memory Bank, checkpoint (b). Próximos passos:
1. Estender o gate de edição a quadros de sprite: hoje só Image tem prova causal.
2. Precisão das sementes por operando (item 2 do checkpoint 1).
3. Perfis não-SGDK: Sonic 1 (piloto e codecs existentes) e Mega Turrican.
4. Mapas/colisões, áudio editável, integração Tauri.

## Checkpoint de execução 3 (2026-10-31)

- Prova de edição de `write_project_from_rom` agora vale por tipo recuperado (Image e quadro de Sprite); com `RDS_REX_REQUIRE_EDIT`, cada tipo presente sem tile regenerável falha.
- Resultado (receipt `receipts/edit-sprite-2026-10-31.txt`): Aratu img 0x1b4296 + spr 0x238896; Tanzer spr 0x199802; Old Towers img 0xaa902 + spr 0x96a80. Em todos: 1 byte alterado, reverter restitui a ROM, no-op byte-exato.
- Ainda 0/5 PASS. Próximo: precisão do tier com sementes de operando (0.71 HAMOOPIG; limiar 0.90 congelado).
- Comando: `RDS_REX_REQUIRE_EDIT=1 RDS_REX_ROM=$W/corpus/<sha>/rom.bin RDS_REX_OUT=$W/projects/edit_<sha8> cargo test --lib -j1 write_project_from_rom -- --ignored --nocapture`

## Checkpoint de execução 4 (2026-10-31): soltar ROM no app

- Soltar `.md/.bin/.gen/.smd` na janela chama `rex_decompile_rom` (normaliza, recupera o grafo SGDK, grava `extract/<sha>/sgdk_project` sob `RDS_DECOMP_WORK`, verifica no-op byte-exato). O painel `RomDropDecompile` (Experimental) mostra contagens e um ícone que abre o diretório (`rex_reveal_extraction_dir`, só dentro do work_dir).
- Aratu pelo comando real: 74 img / 21 spr / 275 quadros / 12 músicas / 163 funções, byte_exact=true.
- Limite: o projeto tem `res/` (resources.res, PNGs, XGC) e `rex/` (rebuild.json, logic.json esqueleto); ainda não há `src/*.c` compilável — a lógica executável editável continua pendente.
- Pré-existentes, falham também em HEAD sem esta mudança: 8 testes em `scripts/new-host.test.mjs`, `studioAppearance.test.ts`, `StudioAppearancePicker.test.tsx`.

## Checkpoint de execução 5 (2026-10-31): precisão das sementes de operando

- Causa medida dos FPs do tier inferido (HAMOOPIG P 0,712): (a) operandos que caem no corpo de função já descoberta (rótulos, 114 em HAMOOPIG); (b) constantes `move.l #1000,d0`/`#size,-(sp)` lidas como endereço (ex.: `*_data_size` caindo dentro de libgcc em Mugenesis).
- Correção genérica: semente só de operando em contexto de ponteiro (`lea`, `pea`, `move.l #x` para destino não-Dn), fora de código já descoberto e logo após terminador (`rts/rte/rtr/bra/jmp`) ou preenchimento.
- Resultado (`receipts/flow-vs-truth-ptrctx-2026-10-31.txt`): P operandos 0,951–0,971 nos 11 projetos (limiar 0,90 cumprido); HAMOOPIG 0,712→0,970, Mugenesis 0,725→0,970. Recall cai um pouco (HAMOOPIG ok 376→325), mas continua ≥ estrito.
- Ainda reprova: P estrita 0,937–0,949 < 0,95 em 7 linhas (9 alvos reais de `bsr` em rótulos locais MDDBG ausentes do `symbol.txt`). Critério congelado mantido; não alterado.
- Próximo: perfis não-SGDK (Sonic 1, Mega Turrican).

## Checkpoint de execução 6 (2026-10-31): arte Nemesis (perfil genérico não-SGDK)

- `rex_nemesis::locate_plc_streams`: streams provados por listas `{ptr.l, vram.w}` (≥2 entradas consecutivas, VRAM múltiplo de 32, todos os alvos decodificando no contrato estrito e cabendo na VRAM; uma entrada ruim derruba a lista). Sem nome de jogo, sem offsets.
- Controle de falso positivo (`receipts/plc-corpus-2026-10-31.tsv`, 60 ROMs): só Sonic 1 (132 streams/27 listas) e Sonic Delta Reloaded (93) acusam; SGDK e demais não-SGDK = 0 (antes da regra de VRAM, 3 ROMs tinham streams espúrios de ~32767 tiles). Folhas de contato inspecionadas: arte coerente; streams contíguos sem sobreposição.
- `rex_nemesis::encode` (produção): DP de partição por custo + tabela canônica ≤8 bits com Kraft ≤ 63/64 e poda de entradas não lucrativas, validado pelo próprio decoder. Reencode de Sonic 1: 147.301 vs 146.020 bytes originais; 119/132 cabem sem edição.
- Projeto/remontagem: `res/nem/*.png` (índice = tom de cinza; paleta ainda não ligada) + `Emitter::Nemesis` (PNG inalterado => stream original; editado => reencode que precisa caber, senão erro explícito; relocação não suportada).
- Sonic 1 (`receipts/sonic1-nemesis-edit-2026-10-31.txt`): no-op byte-exato; 118/132 streams absorvem 1 pixel com bytes alterados só dentro do stream e decode igual à edição; reverter restitui a ROM; atribuição 0,276. Aratu/Tanzer/Old Towers inalterados; Mega Turrican segue 0 (outro codec).
- Ainda 0/5 PASS. Próximo: ligar paleta às artes Nemesis, Kosinski (blocos/chunks) e mapas de Sonic; codec de Mega Turrican.

## Checkpoint de execução 7 (2026-10-31): paleta ligada à arte, blocos Enigma e chunks Kosinski

Novo módulo `rex_md_tables.rs` (motor; sem nome de jogo/offset), cada estrutura ancorada em algo provado:
- Tabelas de deslocamentos → listas de carga com contador, ancoradas em ≥2 listas já provadas: recuperam listas de 1 entrada (Sonic 1: 132 → 137 streams Nemesis).
- Registros de passo fixo com campo de arte provada em todas as linhas; irmãos tipados só se exatamente um codec estrito (Enigma/Kosinski/Nemesis) decodifica em todas as linhas; registro só vale se tipar algo novo (Sonic 1: 1 tabela, 7 linhas, `enigma@4`, `kosinski@8`).
- Tabelas de paleta `{ptr, destino, contador}` (3 leituras do contador; todas as cores válidas); índice = campo de byte que varia e cabe; linha faltante só por entrada de 1 linha única.
- Linha de paleta por tile: votos das palavras Enigma da linha do registro sobre a VRAM declarada pela lista de carga da etiqueta. Sonic 1: 8 artes de nível ligadas (lines 1–3 provadas; linha 0 ambígua → 41 de ~4.400 tiles ficam em cinza). Inspeção visual: GHZ com grama/xadrez/água corretos.
- PNG Nemesis de 64 cores; cores repetidas numa linha recebem desvio imperceptível para inversa exata (remontagem só lê índices).
- Encoders: `enigma_encode` (novo; 3–6% menor que os originais em Sonic 1) e `rex_kosinski::encode_optimal` (parse ótimo por custo em bits, aditivo ao crate; ~6% menor que os originais; contrato P1 em todos os golden + "nunca pior que o guloso").
- Projeto: `res/map/enigma_*.json` (palavras), `res/map/kosinski_*.bin` (bytes), `Emitter::Codec` (inalterado → original; editado → reencode que precisa caber).
- Sonic 1 (`receipts/sonic1-tables-edit-2026-10-31.txt`): no-op byte-exato; 12/12 mapas e 123/137 artes absorvem edição contida no próprio stream; atribuição 0,276 → 0,411.
- Controle (`receipts/md-tables-corpus-2026-10-31.tsv`, 60 ROMs): registros/ligações/mapas só em Sonic 1; tabelas de paleta soltas em Tanzer/Turrican/Dino Fighters não entram em nada (só contam como recuperadas se usadas por ligação). Aratu/Tanzer/Old Towers inalterados.
- Pendente: layout de nível (grade de chunks) — a forma `{w-1,h-1}` contígua não se confirmou na ROM; não foi forçada. Linha 0 sem fonte única. Arte de objetos (fora dos registros) segue em cinza.
