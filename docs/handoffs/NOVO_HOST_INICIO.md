# Novo host: instalação, diagnóstico e continuidade do produto

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
