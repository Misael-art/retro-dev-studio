# Novo host: instalação, diagnóstico e continuidade do produto

> **Estado atual 2026-10-28:** o overlay existente já compila/executa o C original do Mugenesis_Demo, permite editar trechos pelo grafo C e captura o VDP como referência visual. Isso não converte o jogo para cenas/nodes do Studio. A auditoria funcional atual e suas correções estão no checkpoint mais recente do Memory Bank; consulte-o antes dos relatos históricos abaixo. Atlas MUGEN, rascunhos, estudo humano e Windows têm evidências/aceites próprios; não confundir os importadores nem herdar certificação de outro binário/host.

Entrada operacional da retomada de 2026-10-24. Leia também o Memory Bank, o roadmap e as instruções do checkout. Este documento organiza instalação e execução; o diagnóstico está em [REAVALIACAO_PRODUTO_2026-10-24.md](REAVALIACAO_PRODUTO_2026-10-24.md) e a missão de implementação em [PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md](PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md). Não são três fontes concorrentes de estado.

## 1. Qual código recuperar

- Repositório: https://github.com/Misael-art/retro-dev-studio . A ponta `main` não contém automaticamente o Studio recuperado.
- Base pública de recuperação: `recovery/studio-preformat-20261021`, checkpoint `95d5ef237e9cbef321b13162f8b7f6823d094203`.
- Esta entrega acrescenta os launchers e a continuidade em `codex/new-host-cohesion-20261024`, com PR contra a base de recuperação. Enquanto não integrada, **clone esta branch**, não apenas `main`. Confira o SHA real no GitHub/PR; não presuma que um nome de branch é imutável.
- Fonte do Studio preservada: `a8550af0`; produção histórica `ae0d66cd`; binário histórico 016 SHA-256 `d37779583a4cf25dbc7a4dc22200c48d7bed900fcd65d1ee79e573aa37b782b8`. Binário e READY antigos não certificam o novo OS.
- Pesquisas separadas: REA `ee8c581f`, recuperação comercial `40a17169` e integração `03ddc59d` continuam no backup de histórico. Não integrar todas as branches nem substituir esta base por uma pesquisa isolada.

Instale primeiro apenas Git pelo gerenciador oficial do OS, se ausente. Em Arch/Manjaro/BigLinux: `sudo pacman -S --needed git`; mantenha o sistema coerentemente atualizado pelo procedimento da distribuição (não fazer atualização parcial de bibliotecas). Em Windows: Git oficial/`winget install --id Git.Git -e`. Reabra o terminal quando solicitado. A autenticação do GitHub/agente é refeita pelo operador, nunca restaurada de um arquivo público.

```bash
git clone --branch codex/new-host-cohesion-20261024 https://github.com/Misael-art/retro-dev-studio.git RetroDevStudio
cd RetroDevStudio
git status --short --branch
git rev-parse HEAD
```

Use um filesystem nativo com permissões/symlinks, preferencialmente para todo o checkout. Não recopie trinta worktrees. Comece com um checkout e uma branch de implementação; recupere outras branches apenas quando necessárias.

## 2. Instalação sem Node/Rust previamente disponíveis

O nível zero é Bash ou PowerShell do OS. Os launchers reutilizam `bootstrap.sh`/`bootstrap.ps1` e `host-manager.mjs`; o lock `toolchains/host-requirements.lock.json` continua sendo a autoridade para versões, fontes oficiais e SHA-256. Não há novo instalador de SDK em paralelo.

**Linux x64 Arch/Manjaro/BigLinux:**

```bash
bash scripts/new-host.sh --plan
bash scripts/new-host.sh --install --certify --build
```

**Windows 10/11 x64, PowerShell:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\new-host.ps1 -Mode Plan
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\new-host.ps1 -Mode Install -Certify -Build
```

O modo `Install` autoriza o provisionamento necessário; pacotes do OS podem pedir sudo/UAC e Windows pode exigir reabertura/reboot. O launcher não deve contornar isso, guardar senha ou alegar sucesso enquanto um requisito estiver pendente. Não execute o checkout inteiro como root/Administrador para resolver permissões.

`--plan`/`-Mode Plan` não instala nem cria diretórios. A instalação baixa/ativa Node/npm e Rust fixados, provisiona o profile full (SGDK, PVSnesLib, cores, Java/Ghidra, drivers e substrato), executa `npm ci`, e, com as opções acima, certifica o host e gera o portable. Os auditores existentes são executados sem `audit fix`, exceção nova ou redução do gate. O código de saída de cada etapa é preservado e a execução para na primeira falha.

O wrapper aceita somente os hosts já reconhecidos pelo lock. Ubuntu/Debian/macOS/ARM **não recebem suporte novo por este handoff**. O CI Ubuntu prova uma configuração de build, não o provisionamento full. Se o OS escolhido for outro, registre `UNSUPPORTED` e implemente/qualifique um adaptador canônico antes de anunciar instalação automática. Os pré-requisitos gerais do Tauri estão na [documentação oficial](https://v2.tauri.app/start/prerequisites/); ela não substitui os pins do projeto.

`--offline`/`-Offline` só funciona com os artefatos oficiais verificados, Rust e pacotes npm já disponíveis. Uma máquina vazia não pode ser instalada offline somente com o clone. Falta de rede, pacote, hash ou privilégio é bloqueio explícito, nunca fallback para `latest`.

## 3. Ambiente organizado e limite de recursos

| Conteúdo | Local padrão / regra |
|---|---|
| Código e contratos | Um checkout Git; sem dados pessoais ou resultados temporários na raiz |
| SDKs/caches ativos | Cache nativo do `host-manager`, separado por digest do lock |
| Downloads oficiais | `toolchains/.cache/artifacts/` por SHA-256, ignorados pelo Git |
| Cargo | Um `cargo-target` do host/lock para as sessões; incremental desligado pelo launcher |
| Pacotes npm | `node_modules` no checkout; downloads em cache npm do projeto |
| Logs e recibos | `~/RetroDevStudio-work/sessions/<data-pid>/`; sem sobrescrever a corrida anterior |
| Temporários | `~/RetroDevStudio-work/tmp/`, caminho sem componente oculto para Ghidra |
| Experimentos | Subdiretório identificado sob a pasta de trabalho; manifeste entradas/saídas e prazo de retenção |
| Projetos do usuário | Diretório de projetos escolhido pelo usuário, separado de checkout/cache |
| ROMs/MUGEN BYOR | Diretório externo do operador; jamais baixados, apagados ou presumidos disponíveis |

Pode escolher `RDS_WORK_ROOT` e `RDS_HOST_CACHE` em disco nativo antes de instalar. Não apontar para o checkout, HOME inteiro, raiz do disco ou symlink que caia dentro do projeto. O wrapper não altera HOME, XDG global, `.bashrc`, perfil PowerShell ou a política global do npm. Ele ativa as ferramentas somente nos processos filhos.

Jobs padrão da instalação: 2; com RAM <8 GiB, defina `RDS_BUILD_JOBS=1` antes da primeira instalação. Sessões Node sem override reduzem para1 nessa condição. `RDS_BUILD_JOBS=1` também reduz uso nos demais hosts. A compilação de SDK respeita o mesmo limite. Um job pesado por vez: não rodar duas certificações/builds/emuladores concorrentes. Vite/testes continuam com sua configuração canônica, não abrir vários processos para ganhar contagem.

O mínimo operacional padrão é **35 GiB livres**, conferido antes de instalar e entre etapas pesadas; planeje **80 GiB ou mais de folga** para toolchains/builds, pois 35 GiB não garante que um primeiro build caiba. Um orçamento explícito `RDS_MIN_FREE_GIB` deve ser inteiro >=16; não reduza para esconder ENOSPC. O limite não reserva espaço nem detecta todo consumo de terceiros.

Não existe limpeza automática destrutiva. Revise tamanho e proveniência antes de remover somente intermediários regeneráveis que não estejam em uso. Nunca limpar `rds-scratch`, validação, projetos, corpus, `.mimosa`, overlays ou worktrees em massa. Preservar log/recibo de falha, binário certificado e evidência de aceite antes de qualquer limpeza.

## 4. Uso diário sem depender do PATH global

```bash
bash scripts/new-host.sh --check
bash scripts/new-host.sh --run npm run tauri dev
bash scripts/new-host.sh --run npm test
bash scripts/new-host.sh --certify --build
```

Em Windows: `-Mode Check`, `-Mode Run npm run tauri dev`, `-Mode Certify -Build`. O launcher registra saída em `command.log` e imprime o caminho; abra o log para acompanhar. `npm run dev` sozinho abre o frontend Vite, não equivale ao aplicativo Tauri.

Um recibo PASS de `--check` significa diagnóstico/versionamento, **não** testes aprovados. `--certify` chama o certificador canônico, fmt, gates dos crates e auditorias. `--build` gera o portable pelo script existente. Nenhum deles declara jornadas GUI ou usabilidade humana validadas. Retomar uma falha não transforma tentativas anteriores em PASS.

Instalação, certificação e build exigem locks inalterados. `--run`/`-Mode Run` é para comandos de desenvolvimento autorizados, inclusive manutenção intencional: registra hashes antes/depois e `lockfiles_changed`, preservando o código de saída do comando. Não faz `audit fix` nem autoriza por si só upgrade ou commit; revisar o diff e repetir os gates afetados depois da manutenção.

Um lock de operação impede dois coordenadores simultâneos. Se a sessão for interrompida, conferir PID e `receipt.json` indicado antes de remover manualmente um lock órfão. Não apagar um lock vivo para forçar trabalho concorrente. O host-manager mantém também o seu lock canônico para mutações de toolchain.

Se instalar falhar, ler o primeiro blocker e seu log: pacote de sistema indisponível exige conferir os repositórios oficiais configurados da distribuição; `EALLOWSCRIPTS` exige conferir Node/npm efetivamente ativados, sem desabilitar a política global; erro de Ghidra exige conferir o caminho temporário; ENOSPC exige interromper e revisar somente intermediários próprios. Não usar `--no-verify`, `audit fix --force`, `chmod -R 777`, ignorar assinatura de pacote ou apagar worktrees para contornar o problema. Instaladores oficiais/pacotes do OS podem atualizar seu substrato/PATH; o launcher não reescreve manualmente os perfis pessoais.

Para QA visual, qualifique sessão, display, tamanho CSS, PID/janela/foco e driver. Xvfb, xdotool/ImageMagick e dependências de oráculos são ferramentas de QA opcionais por cenário, não corpus. Se ausentes, provisioná-las por fonte oficial e ambiente de desenvolvimento isolado, com versões registradas; Python/oráculos ficam em venv fora do runtime. Computer Use depende também da integração do agente e não é instalado pelo launcher. Sem captura correta, registrar o método alternativo, nunca chamar automação de participante humano.

## 5. Diagnóstico que o próximo agente precisa preservar

Auditoria original: [parecer](../studio_grafico/auditoria_20261020/PARECER_DO_AUDITOR.md), [revisões A/B/C](../studio_grafico/auditoria_20261020/REVISOES_INDEPENDENTES.md), [cobertura](../studio_grafico/auditoria_20261020/coverage.csv), [achados](../studio_grafico/auditoria_20261020/ACHADOS.md). Os textos publicados coincidem com a cópia privada verificada em 2026-10-24. Imagens, snapshots e lotes completos continuam no backup privado; sua ausência no novo host não autoriza inventar reprodução.

**As 16 jornadas continuam parciais; não houve estudo humano.** O parecer inicial é histórico e deve ser lido com seus complementos e a reavaliação. LOT028 já demonstrou edit→save→reopen→build/run→export byte-idêntico; LOT031 mostrou deslocamento compatível com Right, sem isolar causalidade por quadro/keyup. Não repetir que nenhum build/runtime ocorreu. Revisores independentes leram os mesmos lotes, não executaram três jornadas independentes.

| Prioridade | Gap/risco e alcance da evidência | Resultado a entregar |
|---|---|---|
| 1 | Review diz “ainda não executado” após execução (LOT028); identidades/revisões devem ser investigadas | Mesmo projeto/revisão/build/ROM/sessão em editor, emulação, revisão e export; Stop mantém recibo de teste |
| 1 | MUGEN real importa/edita/persiste, mas atlas de 177192960 px excede 67108864 em dois builds (LOT025) | Isolar normalização/dimensões/duplicação/packing, sem elevar guarda ou perder frames; configuração declarada completa build→jogar→export |
| 1 | Golpe salvo não prova golpe jogável; novos nós de LOT029 eram desconectados e guards preexistiam | Animação, comando, hitbox, evento e efeito no jogo conectados pelo modelo canônico; feedback e correção no elemento certo |
| 2 | Múltiplos trilhos/modos, texto quebrado, timeline/Inspector estreitos e ações de baixa descoberta | Hierarquia visual simples, ação principal e alcance visíveis, navegação sem perder cena/seleção/zoom/ocorrência |
| 2 | Aviso de duração persistente em LOT006; Undo dirty em LOT030 não é corrupção por si só | Reproduzir mensagem stale e limpá-la no estado correto; edição inválida preserva valor; estado salvo/pendente claro |
| 2 | Paletas com nomes duplicados e alocação pouco compreensível; PAL0 antigo tem correção posterior | Mostrar bancos/usos/compatibilidade/conflitos, navegar aos consumidores, editar compartilhado/reassociar por uso, trocar em runtime com orçamento |
| 2 | “Editar modelo” sem transição visível no recorte; não prova ausência do editor | Separar ocorrência/instância/modelo N usos, prever impacto e permitir desfazer em uma transação |
| 2 | Runtime Setup 7/7 não basta; cache/CWD/relatórios e Node global divergiram | Ambiente ativado pelo launcher, prontidão revalidada no novo host e identidade dos reports ligada ao checkout |
| 3 | Texto/áudio/câmera/colisão precisam de regressões integradas | Editar, salvar/reabrir, medir resultado; som não vira retângulo fictício na imagem |
| Regressão | REX criou cópia/BPS sem efeito visual no episódio LOT024 | Reusar um perfil e episódio já comprovados; original íntegro, patch independente, efeito/reversão medidos; desconhecidos preservados |

A direção é coesão do produto, não outra reescrita ou ampliação de codecs/plataformas. Reutilizar `editorStore`, `studioContext`, `runtimeLink`, plano de paletas, validadores e pipeline canônico. Camada simples e ferramentas avançadas devem operar os mesmos dados/comandos. Conceitos de cena/tempo/cor/recurso permanecem portáveis; orçamento e técnica específica ficam nos adaptadores de destino.

**Generalidade:** há ferramentas e episódios comerciais delimitados além de Sonic, não um decompilador universal, recuperação completa ou compilador geral de topologias. Pesquisas A/B/C/REA e instrumentos D/F são ativos preservados, não autorização para promover todas as superfícies. A pendência de som comercial permanece separada.

## 6. Restaurar contexto privado sem poluir o novo host

O backup preformat é complementar ao GitHub. Antes de formatar, o operador precisa confirmar que seu destino sobreviverá; isto não foi comprovado apenas por existir em `/mnt/sdcard`. ROMs são responsabilidade manual do operador e não fazem parte desta rotina.

Na raiz do backup, ler `LEIA-ME-ANTES-DE-FORMATAR.md`, `HANDOFF-NOVO-AGENTE.md` e `inventory/`. Conferir hashes/estado VERIFIED antes de extrair. Restaurar o bundle em diretório separado e overlays/projetos em staging, comparar conflitos e só então promover o necessário. Arquivos de agente, WIP, imagens e metadados privados não entram na PR pública. Não executar arquivo `.desktop`, script ou binário antigo só por ter sido restaurado.

Peças principais: `retrodevstudio-all-refs.bundle`, `worktree-overlays-v3.tar`, `project-data-v4.tar.zst`, `project-context-v4.tar.zst`, `project-metadata-v4.tar.zst`; bundle público-base e suplemento documental. O contexto bruto da sessão ativa é um prefixo datado, complementado pelos handoffs. Não tratar uma cópia parcial como histórico completo. Para o estado público desta nova PR, um clone verificado é suficiente para fontes; evidência privada faltante continua explicitamente faltante.

## 7. Prompt de entrada para o próximo agente

> Você está retomando RetroDev Studio em um host reinstalado. Primeiro leia AGENTS.md, Memory Bank, roadmap, árvore, regras de desenvolvimento e este documento. Confira branch/SHA; use a branch desta PR ou sua integração descendente, não presuma que `main` é o Studio mais recente. Faça o plano read-only do launcher, instale/certifique/construa com as versões fixadas e registre os recibos reais. Recrie autenticação somente pelo operador. Preserve BYOR, projetos, evidências e histórico; restaure do backup privado apenas o necessário, com hashes e staging. Depois execute integralmente `docs/handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`: uma frente sequencial, mudanças pequenas completas, reutilizando o contexto/store/pipeline existentes. Prioridade: coerência revisão/build/runtime/export, vertical autoral, MUGEN real sem atlas inválido, edição contextual e regressões REX delimitadas. Faça a UI ficar legível, previsível e segura; preserve o poder em detalhes progressivos. Não pare numa nova auditoria ou mockup: implemente e exerça o app real. Congele critérios e entradas antes de medir; mantenha falhas/erratas; use um binário final para os cenários afetados, patch/aplicador independente quando pertinente e testes discriminantes. Não anuncie usabilidade humana sem participante, nem decompilação universal. Um build pesado por vez; mantenha diretórios de código, cache, temporários, projetos e evidências separados. Checkpoints curtos com SHA, requisito, resultado, limite e próximo comando devem permitir troca de agente. Commit/push/PR da fatia validada; sem merge/release/promoção automática.

## 8. Limite da preparação

Testes dos launchers e sua execução neste host não equivalem a reinstalação limpa executada. O Windows precisa de execução real em Windows, e cada novo OS exige seu próprio diagnóstico, build, certify e jornadas. A certificação do instalador não corrige por si só os gaps de UX acima. O mapa de validação desta entrega e seus resultados efetivamente medidos estão em `VALIDACAO_NOVO_HOST_2026-10-24.md`, no mesmo diretório.

## Recuperação organizada — 2026-10-26

Raiz única neste host: `/home/misael/Projects/RetroDevStudio`, base `ba7dc26eb6526bdfd7a707ad5948dcb0ecb5857a`. Histórico privado recuperado em namespace local de revisão, sem recriar os checkouts históricos e sem publicá-lo. Cópias independentes dos arquivos privados foram verificadas por SHA-256 no disco principal; pesquisa não foi mesclada ao código. Runtime do host-manager configurado por `RDS_WORK_ROOT`, separado da árvore fonte. A instalação atual passou pelo launcher oficial, incluindo compilação da toolchain, npm ci e check de árvore, com recibo novo neste host. O `--check` passou e a suíte frontend registrou 1156 pass/11 skip (127 arquivos pass/2 skip). Isso não certifica jornadas GUI nem usabilidade. READY e provas do host antigo não se transferem. Próxima tarefa de produto continua sendo a coesão descrita neste handoff; publicação do código deve preservar a curadoria pública e excluir dados/históricos privados.


## Continuidade da UI — 2026-10-27

Este checkpoint atualiza o resultado operacional das prioridades de coesão acima, preservando a auditoria histórica. Código `d32337142dcde6deb6d1a6d4232c014ed7f56963`, PR #112/mesma branch; binário final `73b69d84fd1db9045f86c7336905722a011d21c3a5083c27cd03222f5c0702c4` (417754784 bytes). O índice `data/studio_grafico/ui-cohesion-20261027.json` liga as fontes por hash ao commit, registra três corridas frias autorais, três MUGEN e seis regressões PASS, além de falhas/iterações preservadas. O binário foi construído antes do commit; não se afirma build limpo/reprodutível apenas por essa vinculação.

Ações principais explícitas, wizard/diálogos com foco, canvas sem dock inicial sobreposto, Inspector legível em 125%, edição contextual e isolamento de respostas antigas usam os componentes/stores/pipeline existentes. Stop mantém recibo do quadro da ROM testada; revisão/exportação conferem o mesmo SHA e os bytes exportados. Triagem MUGEN retorna metadados sem converter tudo antes de escolher ações; análise integral permanece obrigatória. A configuração real validada seleciona 0/20/21/200 + ken1.act + demonstração autoral; **não fecha o atlas completo LOT025 nem CNS geral**.

Host atual BigLinux/Linux x64: certificação `2026-10-27T03-56-46-001Z-1128073` READY, sete gates, frontend 1174/11 skip, Rust 1067/102 ignored, smokes SGDK/PVSnesLib; Clippy padrão, fmt e build debug PASS. O diagnóstico BYOR de prévia modificada falhou inicialmente por caminho antigo da referência; agora usa `RDS_HAMOOPIG_ROM`, confere o SHA congelado e faz asserções de pixels. O arquivo original está no backup do operador e não foi copiado para recriar checkout antigo. Neste host, configurar essa variável para a referência verificada antes de repetir a certificação enquanto o artefato privado modificado estiver presente. Nunca baixar a ROM para liberar o gate. Logs/recibos de falha e sucesso são a evidência: `new-host --run` posterior sobrescreve o `host-readiness.json` compartilhado com um diagnóstico sem lista de gates.

Runtime desta sessão: `RDS_WORK_ROOT/sessions/ui-cohesion-20261027/` contém `binaries/`, `final/` e `evidence/`; capturas e relatórios autorais também estão em `src-tauri/target-test/validation/`. Binários anteriores e falhas foram preservados, sem apagar projetos/corpus. Xvfb e serviços temporários próprios foram encerrados. Não publicar estes dados privados nem os binários no Git. QA usou Tauri/WebKitWebDriver/Xvfb com ações nativas e DOM; não foi um participante humano.

Próximo comando, da raiz única (para avaliação humana; a árvore mantém o artefato debug final):

```bash
RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio bash scripts/new-host.sh --run src-tauri/target-test/debug/retro-dev-studio
```

Se outro build substituir esse artefato, usar a cópia congelada `RDS_WORK_ROOT/sessions/ui-cohesion-20261027/binaries/retro-dev-studio-73b69d84` e conferir seu SHA. Próximo desenvolvimento: diagnóstico delimitado do atlas completo LOT025, depois aceite humano das jornadas conforme o prompt de coesão, sem elevar guardas, criar outro motor ou declarar UI/produto inteiro pronto. REX E6 revalidou cópia/IPS independente, original íntegro, execução/reversão; efeito causal em física do jogo comercial não foi provado por esse cenário. Windows exige execução própria. Sem merge, release, deploy ou promoção de maturidade.


## Roteiro neutro de observação humana da coesão

**Estado: pendente de participante.** Dono: operador/avaliador humano. Automação, capturas e revisão por IA são aceite técnico separado. Usar o binário final identificado no índice da rodada, host/lock registrados e cópias privadas dos mesmos insumos; nunca o lote congelado. Preparar janela de 1280×800 e repetir os pontos de leitura em 1366×768/125%. Registrar apenas identificador anônimo, data, SHA do app, tarefa, tempo, ajuda, erros e recuperação, nos destinos privados de evidência. O facilitador lê a tarefa sem apontar controles; toda intervenção conta como ajuda. Não preencher resultados por inferência nem alterar JSON para completar uma operação ausente na UI.

| Tarefa apresentada ao participante | Resultado observável esperado |
|---|---|
| Crie uma pequena fase com o modelo autoral disponível e encontre o personagem. | Projeto/cena/seleção identificáveis, ação principal e propriedades localizáveis. |
| Mude a posição do personagem; desfaça e refaça a mudança. | Uma intenção corresponde a um passo; valor recusado preserva o estado válido. |
| Abra o editor do personagem, escolha uma ocorrência e altere sua duração; volte à cena. | Ocorrência e alcance visíveis; retorno preserva seleção, zoom/câmera e contexto. |
| Consulte os usos de uma paleta/modelo compartilhado e revise uma alteração; desfaça. | Número de usos/impacto compreensível; instâncias independentes preservadas; uma transação de Undo. |
| Salve, feche o aplicativo e retome o mesmo projeto. | Conteúdo reaparece; salvo/pendente/rascunho e erros têm interpretação correta. |
| Em uma cópia de teste preparada pelo facilitador, retome um trabalho após interrupção e decida entre rascunho e arquivo salvo; depois salve e teste a revisão escolhida. | Participante identifica cena, revisão e estado de proteção; recuperar mantém edição pendente, Undo/Redo funciona e nenhuma gravação da cena ocorre sem a ação canônica. Diante de conflito/falha, encontra uma decisão/retentativa útil. |
| Teste o projeto, inspecione o personagem e volte ao editor indicado; retorne ao teste. | ROM atual identificada, vínculo verificável abre a ocorrência correta e preserva o quadro pausado. |
| Pare o teste, revise e exporte o projeto. | Recibo do teste permanece; artefato verificado/exportado é o mesmo, com erro/retentativa úteis quando necessário. |
| Importe o Ken privado, revise escolhas/perdas, edite uma ocorrência e repita salvar/reabrir/testar/exportar. | Arte preservada; escolhas e limites compreensíveis; comportamento autoral distinguido de conversão da origem. |

Aceite por tarefa: concluída sem ajuda, concluída com ajuda, falhou ou não executada. Registrar tentativas, mensagens, retorno de foco e recuperação; capturas antes/depois devem mostrar o estado realmente observado. Não transformar uma execução assistida em sucesso autônomo. Ao fechar a sessão humana, reconciliar resultados no Memory Bank e no índice requisito→implementação→prova→resultado→limite, mantendo falhas e maturidade Experimental até decisão própria de promoção. As 16 jornadas históricas não são automaticamente encerradas por este roteiro.

Para a tarefa de recuperação, o facilitador prepara apenas projetos autorais descartáveis/controlados e registra a revisão esperada/recibo do rascunho antes da interrupção. O cenário `draft-recovery` rastreia PID/starttime e encerra somente a instância própria de QA e seus subprocessos; não interromper trabalho do participante ou de terceiros. Apresentar a tarefa sem indicar botões e registrar a compreensão dos estados, inclusive o intervalo entre edição e confirmação. Não preencher essa observação com resultados da automação.

### Retomada após interrupção — roteiro técnico 2026-10-27

O binário congelado desta fatia está em `RDS_WORK_ROOT/sessions/draft-recovery-20261027/binaries/retro-dev-studio-826e2553`, SHA-256 `826e2553cfc6d20351acd6e7d3561b18dba043ecb7c4679d4ca7013dd9b56814`. Código de recuperação `108fd2d3`, ArtStudio `ba60d5e1` e instrumentos `79608626`, mesma branch/PR #112. Fontes de produto conferidas por hash contra o commit; construção ocorreu com árvore suja, sem alegação de build limpo/reprodutível. Prova local e falhas preservadas no índice UI existente, seção `draft_recovery_hardening`; não usar os candidatos intermediários para representar esta fatia.

Para reproduzir na cópia autoral de teste: salvar uma posição inicial, editar/salvar outra posição e usar Undo até a revisão desejada ficar pendente (o Inspector salva automaticamente após 600 ms). Aguardar **Rascunho confirmado**, conferir cena/revisão e interromper somente a instância de QA identificada, incluindo seus subprocessos WebKit. Ao reabrir, escolher **Restaurar rascunho**; a posição reaparece pendente, com Undo/Redo, e o arquivo salvo permanece intacto. Salvar explicitamente, fechar/reabrir, testar, revisar e exportar; conferir o SHA da ROM testada contra o exportado. Para o participante, o facilitador prepara a interrupção e observa as escolhas sem ensinar os botões.

O debounce do rascunho é de 2 s, acrescido do tempo até o recibo nativo de gravação/sincronização/leitura. Antes da confirmação, a edição pode ser perdida. O backing é o próprio `scenePersistence` em `<projeto>/.rds/scene-drafts/`, por identidade da cena, reutilizando o escritor atômico existente; localStorage permanece entrada de migração legada. Falha de armazenamento deixa retentativa visível; conteúdo inválido/conflito exige decisão e mantém material recuperável. Não há transação de projeto inteiro nem garantia contra todo corte de energia ou escritor externo não cooperativo.

Executar pelo launcher oficial, com `RDS_WORK_ROOT` definido conforme acima: `bash scripts/new-host.sh --run "$RDS_WORK_ROOT/sessions/draft-recovery-20261027/binaries/retro-dev-studio-826e2553"`. As três partidas frias e o cenário separado de falhas foram automatizados no Tauri real; não são aceite humano nem certificação Windows. A guarda de atlas MUGEN corrigida continua preservada. Nenhuma promoção de maturidade, merge, release ou deploy decorre deste roteiro.

No checkpoint de recuperação, o atalho **RetroDev Studio — Testar** (`retrodev-studio-testar.desktop`, na pasta de `xdg-user-dir DESKTOP`) apontava para esse binário pelo launcher oficial com `RDS_WORK_ROOT` externo e `RDS_BUILD_JOBS=1`. Usa o perfil normal do usuário, sem overrides de QA. Arquivo executável e sintaxe validados; abertura pelo atalho conferida no KDE/KWin em 2026-10-27. É configuração local, não um instalador ou atalho recuperado de backup antigo. Se o binário congelado mudar, conferir o novo SHA e atualizar explicitamente o destino do atalho.


## Continuidade do atlas MUGEN — 2026-10-27 (validação técnica local PASS, Experimental)

Código publicado `1925716ae4210d87f73e7c092a10a63a70627a56`, mesma branch/PR #112. Binário congelado `35fe9ab21ab0383305de1aeac2ef6b0b48805f83b5b2543bfc3ae06f007fff41` (418656160 bytes); fontes de produto conferidas por SHA com o commit. Índice da rodada: `data/studio_grafico/mugen-atlas-20261027.json`, com mapa requisito → implementação → prova → resultado → limite. O índice anterior da UI permanece histórico.

LOT025 foi reproduzido no binário anterior: retângulo 10240×17304 = 177192960 pixels, contra 11208960 pixels de ocorrências úteis. O adaptador SGDK agora pagina por animação e monta uma tabela lógica estática, mantendo todos os índices, máximos residentes e paleta compartilhada. A guarda continua 67108864 pixels **por página**, com teste de recusa acima desse limite. Na configuração real: 103 animações/417 ocorrências, maior página 1720320 pixels; comparação independente de todos os pixels dos BMPs ao atlas convertido e dos índices/contagens no ELF/ROM/RAM. Não se compararam todos os quadros renderizados de todas as animações ao SFF bruto.

Duas verticais iniciais completas passaram no binário congelado, incluindo edição de o3 por controle da UI, recusa de zero, desfazer/refazer, salvar/fechar/reabrir, duração medida no core, restauração byte-idêntica, inspeção exata/retorno, recusas de vínculo/conteúdo alterado e revisar/verificar/exportar com SHA independente. A terceira tentativa foi interrompida por suspensão confirmada no journal (09:41:14Z→10:19:10Z), depois houve reboot. Sua falha permanece preservada; a série de três partidas frias foi reiniciada inteira, com os mesmos critérios e prazos. **A série final fechou com 12 sessões PASS: três MUGEN completas consecutivas, três autorais e seis regressões (E4, E2/E5, paletas, REX E6, onboarding/Stop/revisar/exportar e SNES)**, todas no mesmo binário, com captura autoral em 125% e exportação final conferidas. Novo diagnóstico READY no mesmo host/lock; inibição de idle é temporária e ligada ao processo de QA, sem mudar política global ou impedir suspensão explícita.

Certificação `2026-10-27T09-22-41-547Z-2002991`: READY, sete gates PASS, frontend 1174/11 skip, Rust 1070/102 ignored, smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário e fmt adicionais PASS. Esses gates foram executados antes do reboot no mesmo OS/lock/fontes; diagnóstico após reboot não é outra certificação. CI/Desktop E2E do código 1925716a passaram. O push notificou alertas Dependabot da branch padrão; não atribuir esse aviso ao lock da PR nem declarar auditoria nova nesta fatia sem executá-la.

Para reproduzir no host disponível, definir `RDS_UI_APP` para o binário cujo SHA foi conferido, `RDS_MUGEN_REAL_SOURCE` para a entrada privada do operador com os sete hashes do índice e `RDS_STUDIO_E1_OUTPUT` para evidência durável fora da fonte. Usar display de QA próprio ativo e os drivers oficiais ativados pelo launcher:

```bash
rtk proxy env RDS_BUILD_JOBS=1 RDS_E2E_KEEP_PROJECT=1 RDS_MUGEN_FULL_ACTIONS=1 GDK_BACKEND=x11 LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 bash scripts/new-host.sh --run node scripts/e2e-tauri-build-run.mjs --skip-build --scenario studio-e1 --app "$RDS_UI_APP"
```

O `DISPLAY`, `RDS_WORK_ROOT` e as três variáveis acima precisam estar exportados no processo. Para um build novo, usar primeiro o launcher/build oficial, registrar outro SHA e repetir os aceites pertinentes; não presumir identidade com o binário privado desta rodada. O runner mistura ações DOM e WebDriver nativas; o seletor de pasta é preparado pelo helper existente. Leituras de disco/RAM são sondas; a alteração direta de bytes do PNG é um controle negativo de conteúdo stale, restaurado, e **não** prova edição de pixels pela UI. Nenhum JSON foi editado para provar a edição de duração.

Limites preservados: demonstração autoral explicitamente escolhida, estados 0/20/21/200/facing fixo; CNS original é referência, não comportamento integral convertido. Todas as animações no ROM não tornam todos os golpes originais jogáveis. A redução de 22 cores VDP para 15 slots já aproxima 2707 pixels e é avisada pelo importador; paginação não acrescenta mudança. Sons copiados do SND exigem vínculo autoral/eventos, exercitados no cenário delimitado E2/E5; som comercial permanece separado. Avisos de estimativa de orçamento continuam visíveis; não se certifica desempenho de toda combinação/hardware físico. Windows e estudo humano exigem execução própria; as 16 jornadas continuam parciais.

Retenção: `RDS_WORK_ROOT/sessions/mugen-atlas-20261027/` conserva planos, ledgers, erratas, certificação e binários; recibos/logs ficam em cada sessão do launcher. Projetos e capturas privados não entram no Git. A lacuna remota da Page/Biblioteca continua explícita: 20 partes Git com metadados, sem download binário qualificado; 23 ZIPs maiores declarados não enviados e sem referências nesta Page. Não há listagem exaustiva da Biblioteca geral. Código público e metadados não restauram esses arquivos.

Proteção desta rodada: pacote privado local em `~/_-backups-_/Projects/RetroDevStudio-UI-2026-10-27/ui-mugen-evidence-1925716a.tar.zst`. São 1287 arquivos/1418302875 bytes de conteúdo, arquivo 291807298 bytes, SHA `a22c1490e9b39f4bba966ad0289629a242964deb546f6fe5a2b1c74b114f7f97`; `content-manifest.json` e `receipt.json` no mesmo diretório. Compressão e leitura integral do tar verificaram tamanho/SHA de cada arquivo, sem extrair sobre fontes. Inclui evidências/binários e 11 projetos próprios gerados, sem apagar originais. **Mesmo filesystem; cópia fora do host não qualificada.** Retenção do operador até aceite humano e proteção privada independente; não apagar evidência para liberar disco. A lacuna remota histórica não é resolvida por esse pacote local.

Fechamento operacional: nenhum app/driver próprio vivo, Xvfb de QA encerrado e inibidor de idle liberado. Originais Ken/snapshot/Sonic/Hamoopig e três exportações finais reconferidos por SHA. O próximo passo de aceite é executar o roteiro humano acima no binário identificado; falhas humanas e Windows devem ser registradas separadamente. Para continuar código, usar o checkout único e o índice/Memory Bank atualizados, não repetir o diagnóstico antigo como estado vigente.


## Importação SGDK com manifests divididos — 2026-10-27 (parcial, Experimental)

O Mugenesis_Demo usa seis manifests; `res/resources.res` contém apenas música. A descoberta anterior ignorava os outros cinco. O importador agora enumera todos os `.res` de `res/`, além do canônico da raiz quando presente, e mantém separados assets homônimos de origens distintas. O teste de regressão cobre dois personagens com `idle.png` diferentes, canônico com música, reimportação estável e variação de caixa no nome do canônico.

A prova nativa antes/depois passou de 1/1/0 para **6 manifests/251 recursos/177 sprites**, com comparação SHA-256 de todas as cópias. O build da cena gerada continua bloqueado: as 177 animações viraram entidades simultâneas, acima de 80 sprites. As 24 cenas geradas são agrupamentos de recursos; não representam os estados/cenas originais do jogo. Não alterar o limite, descartar recursos nem carregar silenciosamente `out/rom.bin` para declarar equivalência. O recurso `legacy_sgdk_overlay` preserva C, mas o contrato atual exige Makefile local, ausente neste projeto que usa o wrapper do SGDKForge. A continuidade precisa integrar esse contrato existente e provar o build original, ou implementar uma conversão de lógica com escopo explícito.

Evidências privadas em `RDS_WORK_ROOT/sessions/sgdk-split-resources-20261027/`; projetos próprios de teste retidos em `projects/before`, `projects/after` e `projects/final`, sem alterar a fonte do operador. O resultado completo FAIL permanece preservado ao lado do passo de recursos PASS. Código `79eee48a`/fixture `ec23be8c`; binário final `0ad1b0d3594a33697f566bf99439477cdcd934bde336623abba9347a1625e3e2` em `RDS_WORK_ROOT/sessions/sgdk-split-resources-20261027/binaries/retro-dev-studio-0ad1b0d3`. Fontes conferidas contra o commit; build em árvore suja. Certify final READY: 1203 frontend/11 skip, 1072 Rust/102 ignored; fmt/Clippy padrão/build/smokes PASS. Atalho **RetroDev Studio — Testar** atualizado explicitamente para esse binário e validado com `desktop-file-validate`; o binário foi exercitado em QA própria, sem reabertura do atalho no desktop. A descrição do atalho informa a reconstrução pendente.

Reprodução pelo cenário existente `sgdk-split-resources`: exportar `RDS_SGDK_REAL_SOURCE` (origem privada), `RDS_SGDK_OUTPUT` (evidência no runtime), `RDS_SGDK_EXPECTED='{"manifests":6,"resources":251,"sprites":177}'`, `RDS_UI_APP` (binário conferido), `DISPLAY` de QA próprio e `RDS_WORK_ROOT`. Usar o launcher com drivers oficiais e perfil de QA separado, preservando o projeto para inspeção:

```bash
rtk proxy env RDS_BUILD_JOBS=1 RDS_E2E_KEEP_PROJECT=1 GDK_BACKEND=x11 LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 bash scripts/new-host.sh --run node scripts/e2e-tauri-build-run.mjs --skip-build --scenario sgdk-split-resources --app "$RDS_UI_APP"
```

Esse cenário exige Build → ROM → Emulação para PASS integral; não reclassificar sua falha como aprovação do jogo só porque os recursos conferiram. Encerrar somente app/driver/display próprios e registrar qualquer realocação dos projetos de QA.

## Mugenesis pelo build C original — 2026-10-27 (Experimental)

Abrir a raiz original do jogo (Abrir Projeto) cria/reabre o overlay `rds/`; Build & Run delega ao wrapper SGDKForge e executa só a ROM provada pelo recibo do run. Reprodução: `RDS_SGDK_REAL_SOURCE` (raiz original), `RDS_SGDK_OUTPUT`, `RDS_SGDK_EXPECTED='{"manifests":6,"resources":251,"sprites":177}'`, `DISPLAY` próprio e o launcher oficial com `--scenario sgdk-native-c --skip-build --app <binário>`. O cenário nunca registra o overlay como projeto temporário. Rodar testes Node com `TMPDIR` não oculto (ex.: `/tmp`), senão `new-host.test.mjs` falha por `work_root_must_be_a_non_hidden_subdirectory`. Estado completo no Memory Bank.


## Diagnóstico funcional 2026-10-28 — domínio demonstrado e fechamento

Pedido: quatro frentes no Tauri real, preservando a raiz única, o C original e a PR #112. A etapa ampla **não está fechada**: existe uma vertical autoral Mega Drive jogável e importação C original utilizável localmente; isto não certifica geração de qualquer jogo, CNS integral, Windows operacional ou usabilidade humana. Superfícies continuam Experimental. Leia o checkpoint mais recente do Memory Bank e a seção `product_diagnosis_20261028` do índice UI para os hashes/resultados finais; o histórico acima não é a situação vigente.

A matriz relaciona o caminho visível ao owner e ao limite, sem converter teste unitário em capacidade gráfica. Resultados finais e referências por hash são consolidados no índice existente.

| Jornada/promessa | Caminho e implementação responsável | Execução e limite observado | Estado |
|---|---|---|---|
| Jogo autoral MD | Wizard Primeiro Projeto → Cena/Inspector → Lógica/Sons → Salvar → Build & Run; editorStore, scenePersistence, codegen SGDK e Libretro | Edição por controles, Undo/Redo, reinício/reabertura, teclado até vitória e áudio com amostras. E4/E2E5/paletas cruzam modelo/instância, animação, caixas, eventos, texto/HUD, câmera/cenário/budgets. Domínio de demonstração delimitado; não representa todo gênero. | Implementado, demonstrado localmente, Experimental |
| Autoria SNES | Wizard Primeiro Projeto → Inspector → Salvar/reabrir → PVSnesLib → Snes9x → Revisar/exportar | Modelo de plataforma de referência é MD-only; bloqueio preventivo substitui a tentativa que deixava pasta vazia. Starter SNES passou edição/save/reabertura/PVSnesLib/Snes9x/export SHA idêntico; fixture tem prova distinta; não inferir plataforma/combat/música completos a partir de um sprite. | Demonstrado localmente; escopo menor que MD |
| Pixel art | Arte → Pixels → frames/camadas → Salvar → PNG + documento nativo; PixelEditor e save_pixel_art_asset | Troca de ferramenta mantém documento/histórico por projeto; Undo distingue revisão pendente da salva; save atrasado não certifica edição nova. Fechar/reabrir recurso salvo mantém documento. Pendente em memória exige Salvar antes de encerrar o app; recurso novo ainda deve ser aplicado ao consumidor. | Corrigido e coberto por regressão |
| Mugenesis C original | Abrir raiz → overlay rds/ → Build & Run → Cena capturada/Arte/Lógica C → editar bloco → novo build → Revisar/exportar | 6 manifests, 251 recursos, 177 SPRITE de catálogo e **0 instâncias de cena**; wrapper SGDKForge com recibo e ROM nova, Genesis Plus GX, áudio/menu/luta; edição C pela UI produz ROM diferente. Captura VDP é referência, grafo C preserva trechos não modelados; não converte motor C em cenas/nodes. | Integração nativa local, Experimental |
| SGDK genérico dividido | Wizard Importar/Avançado → SGDK; import_external e manifests/resources | Todos os recursos e nomes preservados por SHA; sem instanciar 177 animações. Build do doador recusa fita de tiles 142×1 como plano MD; nenhuma ROM substituta. Caminho de recuperação deste jogo é o C original acima. | Importação de recursos parcial; conversão gráfica do jogo não demonstrada |
| MUGEN autoral | Importar personagem → Arte/animação → Cena/regras → Build/run/review/export; mugen_profile e adaptador SGDK | Todas as 103 animações/417 ocorrências, páginas e paleta conferidas; Cancelar antes da conversão deixa zero projeto e permite repetir; duração editada pela UI aparece no core e restauração volta à ROM byte-idêntica. Estados autorais 0/20/21/200, facing fixo; CNS original como referência, quantização 22→15 cores (2707 pixels aproximados). Guarda 64 MP preservada. | Demonstração delimitada, Experimental |
| MUGEN cadeia CMD/CNS original | Revisar personagem → Converter uma cadeia original → escolher estado → revisar origem; mugen_chain, programa/digest e runtime SGDK | Modo existente separado da demonstração autoral; piloto Ken200 (ChangeState/Statedef/anim/retorno), idle0 stand-in declarado porque common1.cns falta; HitDef/PlaySnd e 55/56controladores −1 não convertidos. Prova atual: 336 ticks sem divergência,296 frames exatos a 0 vblank,7 controles negativos recusados e salvar/reiniciar/reabrir no app final; sem inferir paridade MUGEN. | Piloto local Experimental delimitado |
| MUGEN VelSet/locomoção | Importar Strider autoral → Inspector/velocidade/duplicar → salvar/reiniciar/reabrir → build/teclado |2.5→3.75 px/tick,0 divergências Q8.8 e instância duplicada parada; sintaxe não suportada recusada. Helper legado de QA atualizado para clicar Analisar escolhas, guardas preservadas. | Fixture local; facing fixo/constantes, sem colisão/dano/combate/PAL |
| Projeto Studio/recuperação | Abrir → editar/salvar → fechar/reabrir; rascunho v2 e scenePersistence | Reabertura, conflito/retentativa e interrupção do processo têm provas específicas; confirmação nativa e identidade de cena/revisão. Não é transação de todo projeto nem garantia contra qualquer corte de energia. | Implementado no domínio exercitado |
| Outros formatos anunciados | Registry/perfil do importador e bridges estruturadas (GameMaker, Godot, Construct, RPG Maker, Ikemen, OpenBOR) | Implementações e testes existem; esta rodada não fornece nova qualificação nativa de projetos reais desses formatos. Preservar os limites e provas históricas por perfil no roadmap, sem anunciar paridade geral. | Experimental; prova atual insuficiente para promoção |

### Problemas observados e correções

| Prioridade | Reprodução preservada → causa/owner → resultado esperado | Verificação |
|---|---|---|
| P1 trabalho perdido | PixelEditor desmontado ao trocar modo descartava frames/histórico → sessão por projeto no editorStore existente | Regressão de remontagem/isolamento e jornada nativa com dois frames mantidos |
| P1 falso salvo | booleano de save sobrevivia a Undo; resposta atrasada podia atualizar recurso antigo → baseline por conteúdo confirmado + identidade da operação | Undo/Redo, save atrasado, falha e retentativa unitários; save/reabrir nativo |
| P1 par de arquivos inconsistente | PNG gravado antes do documento sem restauração → validação, escritor atômico existente, preservação/rollback de falha reportada | Teste Rust mantém PNG anterior diante de destino inválido; não alegar transação de dois arquivos contra power loss |
| P1 revisão C bloqueada/enganosa | Ausência legítima de mapa de nodes apagava identidade do build → artefato ROM independente e revisão de edição C | Rótulo de build/teste, recusa após editar C, novo build, Stop, verificar/exportar SHA executado |
| P2 métricas C falsas | Overlay genérico apresentava sprites/DMA0 de nodes no jogo C → indisponível para o artefato C executado; FPS e VRAM VDP continuam reais | Asserção nativa do escopo da sobreposição, sem fabricar orçamento zero |
| P2 indicador de orçamento | Rodapé usava total de entidades como sprites → contagem apenas do componente sprite e explicação do escopo | Regressão nativa compara 177 recursos no catálogo/0 instâncias na cena; limite inalterado |
| P1 modelo incompatível | Wizard permitia SNES + plataforma MD; backend falhava depois de reservar pasta → catálogo compartilhado informa MD-only e backend valida antes da reserva | Teste UI troca de target/disabled; Rust recusa sem pasta; tentativa SNES falha preservada |

### Interface e integração: achados observados

A navegação Cena–Arte–Lógica, a distinção modelo/instância, ações de usar/aplicar recursos e o retorno ao Inspector formam um caminho produtivo para a vertical controlada. O shell mantém seleção/contexto e oferece revisão que liga erro à correção. Layouts 1366×768, escala 125% e QA RC A–H têm capturas/gates próprios; textos auxiliares de 9–10 px e nomes truncados na hierarquia/Inspector são riscos visuais observados que exigem leitura humana; isso não constitui conformidade WCAG nem leitura validada por participante humano.

Os defeitos mais graves eram feedback de estado e perda de contexto, corrigidos acima. O refinamento visual deve continuar subordinado à confiabilidade dessas indicações. O overlay C ainda exige leitura de escopo: cenas capturadas não alteram a lógica original, e novos recursos PNG/documentos precisam de integração no .res/C. O Studio mostra essa fronteira; o editor gráfico não é um substituto completo da organização do jogo C. Não criar outro pipeline para mascará-la.

### Pendências priorizadas e propostas

1. **Proteção de trabalho:** qualificar cópia privada independente do host, owner operador, restaurar amostra por hash. O arquivo local desta rodada protege continuidade, mas fica no mesmo filesystem. Pixel art não salvo permanece só em memória; usar save explícito e avaliar extensão do mecanismo existente de rascunhos somente com contrato de recuperação/teste definido.
2. **Aceite das 16 jornadas:** operador/QA humano percorre o roteiro neutro já existente, registra sucesso, erro, esforço, compreensão e retentativa. Agente em Xvfb não substitui participante. Executar também desktop com GPU/áudio reais e empacotados Windows; não promover a partir de Vitest/host READY.
3. **C original:** owner projeto/importação, consolidar pacote privado do overlay/receitas/fontes e testar reimportação com edição local/conflitos e falhas reais do wrapper; medir partida completa, ações/controles e áudio no desktop. Windows requer adaptação/execução oficial própria. Não prometer conversão universal de C.
4. **SGDK genérico:** owner import/resources, apresentar fitas de tiles como recursos de referência até haver uso de plano válido; uma conversão para cena exige mapeamento explícito de tilemap/instâncias/paletas e prova visual. A recusa 142×1 é correta; não elevar limites ou descartar animações.
5. **SNES:** owner templates/codegen, ampliar evidência dentro do suporte declarado com plano de paletas SNES (Inspector hoje informa MD-only), câmera, colisão, HUD, áudio e objetivo jogável no PVSnesLib/Snes9x, além da criação/edição/build/export do starter. Efeitos sonoros têm prova autoral MD; composição/importação de música autoral completa não foi qualificada nesta rodada. Modelo MD-only deve continuar bloqueado.
6. **Perfis e produtividade:** para cada importador fora da vertical principal, corpus autorizado congelado, importação/reimportação, edição UI, build/core/export e bridges visíveis; sem isso manter Experimental. Priorizar mensagens e ações contextuais pelos erros humanos observados, não novos painéis.

Critérios atendidos por esta rodada devem ter gate/relatório no índice: reproduções preservadas, correções/regressões, build/ROM/core/export com identidade, original íntegro e commit/push na continuidade. Critérios pendentes para fechar a etapa ampla: aceite humano; Windows/desktop alvo; domínio SNES além do starter; matriz de importação por perfil sem ambiguidade; proteção privada independente. Sem merge/release/deploy nesta missão.


Leitura das capturas desta rodada (as imagens brutas são privadas; índice e hashes no runtime):

1. **Criar/importar — saudável no escopo indicado.** Wizard mostra restrição MD-only e mantém o starter SNES selecionável. MUGEN exige analisar/revisar antes de importar e cancelar antes da conversão não cria projeto. Ainda falta provar cancelamento durante conversão/build real em cada perfil.
2. **Editar e continuar — saudável na vertical controlada.** Inspector/modelo/instância, Arte e Lógica mantêm contexto; PixelEditor conserva frames/histórico ao trocar ferramenta e indica pendente após Undo. Textos auxiliares pequenos e hierarquia densa exigem leitura humana.
3. **Testar — saudável para MD autoral; delimitado no SNES/C.** Vitória e SFX MD têm execução; starter SNES exibe sprite no core. Captura C é referência e a ROM original tem sua própria lógica; sonda de movimento tem controle neutro e domínio de Treino, sem equivalência geral. FPS da renderização por software não qualifica desempenho do alvo real.
4. **Revisar/exportar — saudável nos casos que completaram.** SHA da entrega deve ser o executado; edição C invalida o build anterior. Verificação de cenas/nodes não é aplicada como certificação da lógica C. Capturas e oráculos geométricos não certificam contraste, leitor de tela, áudio físico ou usabilidade humana.


Fechamento técnico desta rodada: app fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c (427657968 bytes), produção b6084695; baseline READY 1233/1098 e14 de 15 jornadas finais aprovadas. A 15ª é a recusa SGDK142×1, mantida FAIL. O piloto CNS original e Strider são adicionais à série principal de 13; source do produto não mudou depois do build. O helper de QA foi ajustado depois da certificação, validado por Node --check e repetição Strider. Recibo certificado e fontes/receitas/hash do executável preservados; não confundir diagnóstico global --run posterior com nova certificação.

Pacote privado 635990914 bytes, SHA 6842d762ca615b4caf1805787df25279b70016424ce61d76dd876b3bd52da726;5309 registros verificados integralmente,35 projetos/snapshots. SDK não copiado: um symlink identificado deve ser resolvido por tooling oficial/identidade registrada ao restaurar. Mesmo filesystem, owner operador, retenção até aceite e cópia privada independente verificada. Recibo em RDS_WORK_ROOT/sessions/product-diagnosis-20261028/protection-receipt.json e no destino de backup existente; raw não entra no Git público. Processos próprios encerrados, display :173 alheio preservado.

Próximo comando para observação humana no desktop, preservando o launcher/pins (conferir antes o SHA indicado acima):

```bash
rtk proxy env RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio RDS_BUILD_JOBS=1 bash scripts/new-host.sh --run /home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/product-diagnosis-20261028/binaries/final
```

Usar cópia autoral controlada e o roteiro neutro desta página. Capturas aceitas/notas e rejeições por campo fora da área visível/Salvando estão em accepted/screenshots.json no runtime. O estudo humano, alvo físico/Windows e backup independente seguem pendentes; não promover as 16 jornadas nem iniciar reescrita/novo motor universal.
