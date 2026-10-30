### Checkpoint 2026-10-30 — atalho recuperado após reboot (validado localmente)

Relato novo: atalho da área de trabalho não abre. Base **3b27690250c0150ce4ae29e84e342d6b5764a806**, mesma raiz/branch/PR#112. **Causa confirmada:** o host reiniciou por volta de15:15UTC, mas `development-operation.lock` ainda apontava à sessão08:45/PID2985848; coordenador e app2985998 já ausentes. Nenhum processo RetroDev corrente encontrado. O launcher recusava `openSync(...,"wx")`; Terminal=false escondia o erro. Não era trava de processo vivo neste novo turno. Recibo da sessão antiga conservado sem alterações; arquivo morto arquivado byte a byte em `RDS_WORK_ROOT/sessions/desktop-shortcut-recovery-20261030/recovered-previous-boot-development-operation.lock`, SHA **b5a25242dae6c5a434291acdf69f933f8e95bab0073a3ef47c3d1b621b57558a**. Projeto do operador não escrito; binário821d172a intacto por SHA.

**Correção no coordenador existente:** novas leases Linux registram `/proc/sys/kernel/random/boot_id`. Somente ID válido comprovadamente diferente permite arquivar a lease da inicialização anterior na nova sessão; recibo/hash da recuperação ficam preservados. Trava deste boot, legada sem ID, corrompida ou sem ID confiável permanece bloqueante para inspeção, inclusive PID morto (pode haver filho órfão). Aquisição/recuperação serializadas pelo mutex do host-manager existente; release confere proprietário antes de remover. Sem contorno de lease viva nem novo serviço/store/launcher. `RDS_DESKTOP_LAUNCH=1` no .desktop habilita notificação de erro via notify-send já disponível no host, com limite3s e caminho do recibo; CLI comum preservado. Boot sem identificador confiável não recebe recuperação automática. Legado deste episódio foi recuperado manualmente após prova de reboot/ausência dos processos.

**Validação concluída do launcher:** diagnose READY;56 testes focados PASS, sintaxe e desktop-file-validate PASS. Certificação oficial **READY/sete gates**, sessão **2026-10-30T15-58-47-069Z-188815** com recibo **PASS**: **1300 frontend PASS/11 skip**, **1120 Rust PASS/110 ignored**, smokes SGDK/PVSnesLib oficiais, Clippy lib/árvore/lint/tipos. Clippy padrão, fmt, npm security audit e Cargo audit adicionais PASS; avisos Cargo preexistentes mantidos. Wrapper externo de bookkeeping saiu143 após coordenador e sete gates concluírem PASS; recibo e relatório exatos preservados, complementos rodados por nova sessão TTY. Nenhum teste/guarda relaxado. As provas Rust agora cobrem os métodos novos, mas não o teste privado de qualidade ignored nem um binário novo da UI.

**Desktop real:** `kioclient exec` na entrada existente abriu o app821d172a, janela RetroDev Studio/PID265601. Lease atual **2026-10-30T16-16-09-626Z-265424** já contém boot_id. Depois da abertura o operador passou de projeto107/Lógica a projeto108/importação de GIF53quadros, sem entrada do agente. **Aplicativo mantido aberto; fechamento/reabertura não exercitados para preservar o uso ativo.** Não qualifica a jornada de importação atual por observação informal nem a UI nova. Captura nativa privada enquadra parcialmente a janela; prova de inicialização, não auditoria visual completa. Primeiro PID observado era probe transitório de versão, descartado antes de identificar a janela nativa correta. Baselines somente leitura: seis arquivos do projeto106 e dois do107 seguem iguais; nenhum projeto escrito pelo agente. Evidências/receitas/falhas em `sessions/desktop-shortcut-recovery-20261030`. O executável no atalho permanece821d172a; proposta UI9b2034cf/fidelidade ainda sem build/qualidade privada/ROM/core novos. Próximo: operador pode usar a janela já aberta ou o atalho; continuar qualificação da UI depois de fechamento normal da sessão em uso, preservando o lease. Sem merge/release/deploy.

**Fechamento/proteção:** código **9366bcca8aa51b11c22a1b6f88b0181deb70b102**, scripts do launcher e seus testes conferidos byte a byte entre commit e pacote privado. Abertura em árvore suja sobre3b276902, mesmos bytes agora commitados; binário continua821d172a. Pacote **desktop-shortcut-recovery-20261030-checkpoint-162213.tar.gz**, **787126 bytes**, SHA **f9c48570947f1d446099cde133e58c7d2c5e8a1f02a0cd5555d5c8b421cbdea2**, **61 arquivos integralmente verificados**, manifesto **6a3c5768ad10b9e089034c3df2c38e5f8cce04a91fb11909c4815499db89ea0a**. Destino privado existente RetroDevStudio-UI-2026-10-27; mesmo filesystem, sem cópia independente qualificada, owner operador/reter até aceite/proteção independente, sem limpeza automática. Documentos no pacote precedem esta nota de fechamento; fontes/receitas versionadas, metadados/projetos/capturas/artefatos privados fora do Git. App do operador mantido aberto, sem processo de QA extra em execução.

---

### Checkpoint 2026-10-30 — editor de imagem por tarefas (Experimental, não instalado)

Pedido atual do operador: ferramentas identificáveis, correções rápidas, recorte, cores/regiões, filtros, colagem/texto/bordas, camadas e diagnóstico de tiles; disponibilizar métodos positivos dos projetos SGDKForge/SMSForge. Base **6b771fd36cc1cd67d00d4f176a254fc79115e6ce**, mesma raiz/branch/PR #112. O checkpoint de fidelidade abaixo continua pendente: **nenhum novo app entregue**, atalho no **821d172a20fcef93b9b422678148481f21391d1417aa8092e640ecd7c6d3c318**. Não confundir esta proposta com a entrega anterior nem promover as 16 jornadas.

**Implementação no caminho existente:** PixelEditor mostra 13 ferramentas com ícones do sistema comum, nomes e atalhos; seis tarefas contextuais, paletas usadas/ativa, grade opt-in e enquadramento inicial. `PixelImagePanel` contém controles/prévias; `pixelImageOps` opera o PixelDoc existente, sem outro store/editor/writer. Fundo uniforme conectado às bordas com tolerância/seleção/cor; cortar, girar 90° retangular, resize; brilho/contraste e 13 filtros; imagem/adesivo por arquivo, texto rasterizado, moldura/contorno em camadas independentes; duplicar/unir/ordenar/ocultar/renomear com histórico. Operações geométricas de imagem da cena criam cópia; Salvar cópia protege outros usos. Cor isolada esmaece as demais e limita os gestos; filtros locais reservam slots consumidos fora da região/camada/quadro, inclusive ocultos. Prévia distingue Aplicar/Cancelar de Salvo e bloqueia salvar proposta não aplicada. Respostas atrasadas de colagem são recusadas por contexto/documento. Filtros têm orçamento de trabalho de 4 MP (sem reduzir a guarda de documento de 64 MP); exceder orienta editar por quadro. Colagem animada exige mesma quantidade e duração dos quadros, sem retiming/truncamento silencioso.

Mapa de tiles opt-in: repetição, espelhos H/V, cores exclusivas, mistura de paletas e inspector por tile; flip/giro editam a arte, não prometem economia gratuita. Contagem de padrões ignora bits de banco, como o mapa do VDP. Estimativa é do quadro, sem VRAM total de fonte/mapas/reservas. Exportação PNG recusa misturas em que o mesmo índice tem RGB diferente; **Unificar paletas** gera prévia de redução do recurso inteiro para 15 cores + alfa, preservando layers/quadros/tempos/origem e Undo. Salvar envia a paleta realmente exportada; se um recurso explícito tem consumidores alheios, estes conservam suas cores e o recurso editado volta a derivar sua própria paleta pelo planner existente. Capacidade/quarta paleta após edição/cópia ainda precisa prova nativa.

**Conversores adaptados, sem dependências novas:** Agrupamento de cores (histograma ponderado determinístico, inspirado no k-means SGDKForge), Contornos limpos (cores frequentes, sem dithering) e Gradientes suaves (Floyd–Steinberg por quadro, sem difundir através de alfa), os dois últimos inspirados no SMSForge. Escolha na entrada e Reconverter original preservado. Todos adaptados ao **RGB333 MD**, não à paleta SMS RGB222; não executam Python/OpenCV/Pillow no runtime. Proveniência privada em `sessions/pixel-workspace-20261030/conversion-provenance.json`: SGDKForge de48ff86/arquivo normalizado LF conferido contra Git (diferença local apenas CRLF); SMSForge6677d5df/arquivo SHA e Git conferidos. Teste Rust de três métodos/timing/alfa/determinismo/fronteira entre quadros escrito, **não executado**.

**Evidência e limites:** frontend completo preliminar **1293 PASS/14 skip** em Node24.18.0,139 arquivos aprovados/2 ignorados. Os14 são condicionais já existentes:4decomp sem toolchain ativada,8SonicBYOR sem corpus desta sessão e2Windows; não houve novo skip declarado. Primeira execução teve6falhas de fixture por TMPDIR oculto herdado; log retido, reteste no `RDS_WORK_ROOT/tmp` passou sem mudar testes/guardas. Ajustes finais de escopo/prévia e limites: **60 testes focados PASS**, lint/tipos/estrutura/sintaxe/fmt/diff finais PASS; logs1131/1132 na rodada. Os seis arquivos do projeto aberto estão idênticos ao baseline anterior (comparação somente leitura). suíte completa não equivale à certificação gerenciada. Diagnose de entrada READY. Estrutura, lint, TypeScript, sintaxe do runner, fmt e diff preliminares PASS, Node24.18.0/Cargo pinados diretamente, sem qualificar launcher/host. Sessão `RDS_WORK_ROOT/sessions/pixel-workspace-20261030`: recibos estáticos, suíte frontend, receitas/proveniência, dez capturas de UI e uma do relatório e `audit/index.html`/`report.json`. Preview Browser do componente real, fixture isolada sem projeto/IPC/save: nomes/enquadramento, filtros/Cancelar/Aplicar/Undo, fundo uniforme, cor isolada, duplicar/unir/Undo, texto e tiles/espelho/Undo observados. Capturas são iterações distintas: enquadramento e rolagem expostos foram corrigidos e cobertos por regressões. Não é Tauri, novo conversor qualificado ou auditoria de acessibilidade/humana. Recorte de pessoas/objetos em **cenário complexo tipo Remove.bg continua ausente**; sem modelo neural instalado. Texto é rasterizado, adesivos são arquivos PNG; não há biblioteca de stickers. SNES rápido, Windows e dispositivos físicos não qualificados.

**Impedimento de integração:** app do operador e lease **2026-10-30T08-45-51-102Z-2985848** continuam vivos; pedido de salvar/fechar normalmente já enviado. Não remover trava nem encerrar processo alheio. Rust/Clippy, comparação privada de qualidade `--ignored`, build/certify, Tauri, Build → ROM → core e atualização do atalho **pendentes**. Extensão opcional `RDS_PIXEL_WORKSPACE=1` no runner canônico acrescenta sete passos aos 17 de ingresso/fidelidade; roteiro preparado, não executado. Código/receitas devem ser preservados como proposta revisável, sem alegação de entrega completa. Próximo após liberação normal e conferir RAM/disco: `rtk proxy python /home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/pixel-workspace-20261030/run-gates.py rust-colors rust-ingress color-reference clippy build`; inspecionar PNG/qualidade, congelar via receita existente, rodar Tauri `run-native.py image-ingress-workspace`, regressões, certify/fmt, atalho KDE e proteção. Sem merge/release/deploy.

**Preservação/publicação da proposta:** código **9b2034cff35415a7086bbea96e4a9c4237f3adbe**, 16 arquivos de fonte/testes/roteiro conferidos byte a byte entre commit e snapshot privado. Pacote **pixel-workspace-20261030-proposed-checkpoint-113242.tar.gz**, **2717469 bytes**, SHA **b632aaa56361057e28f70ca1ca685d7c6ee7bce4526f1aaaa87f15bfbb1f3f32**, **110 arquivos integralmente relidos**, manifesto **51eb5d5da018d47840104656f63bf65bec62065e17158d7117129647dd502895**. Destino privado existente RetroDevStudio-UI-2026-10-27; mesmo filesystem, sem cópia independente qualificada, owner operador/reter até entrega qualificada/aceite humano/proteção independente, sem limpeza automática. Documentos no pacote refletem o instante anterior a esta nota de fechamento; fontes/receitas no Git, inputs/capturas/relatórios privados fora dele. Abas/servidor próprios encerrados e viewport restaurado; app do operador intacto. PR#112 reutilizado como proposta, sem merge/release/deploy.

---

### Checkpoint 2026-10-30 — fidelidade de cores em andamento (não entregue)

Pedido do operador: a imagem web inserida como fundo perdeu fidelidade. Base **d0009cb81d2ed84c6a051197c4bdb69386891d9a**, código proposto/publicado **2f7fce16eaa861fbbb3077fddf1c70aee69952d6**, mesma raiz/branch/PR #112. Fontes/roteiro conferidos contra o checkpoint privado; trabalho em andamento, sem app novo qualificado. Comparação somente leitura com o JPG original preservado de MeuProjeto 106 e seu PNG/documento: índices e paleta concordam; há perda de quantização. Duas causas no código canônico: o overlay selecionado/foco tingia toda a imagem de verde a 16%; o median cut dividia pixels repetidos e deduplicava cores depois da projeção MD, desperdiçando posições. Alterações propostas: seleção pelo contorno e histograma limitado aos 512 tons MD, ponderado por frequência, refinamento limitado e reposição de cores duplicadas. Sem dependências, formatos, planner ou arquitetura novos. O limite de 15 cores visíveis é deste conversor rápido por recurso, não da tela inteira do console.

**Pendente:** compilar/testar Rust, medir erro contra o original, conferir visualmente a conversão e percorrer Tauri → Build → ROM → core antes de atualizar o atalho. Dois testes sintéticos e um teste privado explícito `ingress_color_reference_quality_report` foram acrescentados; este último fica ignored na suíte sem corpus, devendo executar separadamente com `--ignored`. O roteiro canônico de ingresso ganhou comparação de PNG/documento/canvas, seleção sem alteração interior e cores no core, condicionada a `RDS_IMAGE_COLOR_REFERENCE`. Expectativa congelada: erro RGB novo menor que o anterior, dimensões idênticas, ao menos oito amostras exatas no canvas; seleção não altera interior e core difere até um nível MD por canal. **Nenhuma destas novas provas foi executada ainda.**

**Proteção do trabalho pendente:** `image-color-fidelity-20261030-proposed-checkpoint-092439.tar.gz`, destino privado existente RetroDevStudio-UI-2026-10-27, **1050855 bytes**, SHA **948b663fc2029795a843d66503a0466a9c4e9aa10226560441a18d4b4c36e58c**,19arquivos integralmente relidos. Inclui fontes/diff/receitas/entradas preservadas e manifesto; documentos refletem o instante anterior a esta nota de proteção. Recibo em `sessions/image-color-fidelity-20261030/checkpoint-protection.json`. Mesmo filesystem; sem cópia independente qualificada, owner operador/reter até qualificação da entrega e proteção privada independente. Não distribui os insumos no Git.

**Host e impedimento:** diagnose fresco READY; verificações estáticas preliminares de lint, TypeScript, árvore e sintaxe/diff PASS, diretamente com Node26.8.1 global; fmt pelo Cargo pinado PASS. Não substituem gates pelo launcher/Node24.18.0 nem certificação. Launcher de desenvolvimento recusou operação com EEXIST: sessão viva **2026-10-30T08-45-51-102Z-2985848**, app do operador821d172a. Não remover a trava ou encerrar o processo alheio. Operador informado para salvar/fechar normalmente; código útil preservado, sem escrever no projeto aberto. Gates anteriores abaixo não aprovam estas alterações. Atalho permanece no último app validado821d172a. Evidências, entradas privadas e receitas em **RDS_WORK_ROOT/sessions/image-color-fidelity-20261030**; índice **image_color_fidelity_20261030**. Próximo, após liberação normal do lease e nova conferência de RAM/disco: `rtk proxy python /home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/image-color-fidelity-20261030/run-gates.py rust-colors rust-ingress color-reference clippy build`. Continuar pelo roteiro nativo, certify e fmt; preservar falhas e revisar a nova imagem. Reprocessamento de asset existente deve ser feito pelo operador em Editar imagem e quadros → Reabrir original → Salvar, depois da qualificação do novo app; não sobrescrever uma edição silenciosamente. Sem entrega, promoção, merge, release ou deploy.

---

### Checkpoint 2026-10-30 — colar/soltar imagens e animações (Experimental)

**Entrega do incremento validada:** código **1e849549d0628fc0ba09930ae13840ef281a20ce**, app **821d172a20fcef93b9b422678148481f21391d1417aa8092e640ecd7c6d3c318**, mesma raiz/branch/PR #112. Fontes de produção e receitas de QA conferidas contra o commit, snapshot **5b978d198111f52cf9b79b3df2f15cb51cf83ede911f876c3cf5ec392e02a988**; build em árvore suja sobre 2047739c, sem alegação de build limpo/reprodutível. Índice atual: **image_ingress_20261030** em `data/studio_grafico/ui-cohesion-20261027.json`. Evidências/receitas/falhas/relatório em **RDS_WORK_ROOT/sessions/image-ingress-20261029**.

**Fluxo:** em projeto Mega Drive, Ctrl+V, arraste nativo/HTML ou botão Imagem → Cenário/fundo ou Personagem/objeto. Banco disponível é automático; conflito pede qual paleta cederá, mostrando os objetos afetados. Original aceito preservado por SHA em `.rds/art-sources`, conversão pelo Photo2SGDK existente, PNG/documento pelo writer atômico de pixels, cena/paletas por uma transação do editorStore e persistência canônica. Sem novo motor/store/planner/registry. GIF/APNG/WebP animado passam pelo decoder com quadros/tempos; documento e catálogo conservam geometria/animação, inclusive em outra cena. Editar imagem e quadros abre o PixelEditor; Salvar atualiza a cena. Reabrir original, remover fundo uniforme e Undo preservam edição anterior; ação de lógica abre o grafo existente. Timers autorais por ocorrência chegam ao SGDK; rota MUGEN inalterada. Guardas de contexto/revisão/filas, arquivo corrompido e retentativa evitam aplicar respostas antigas. HTML copiado permanece em template inerte; HTTPS limitado e DNS/redirect validados, sem cookies/credenciais/proxy herdado.

**Dependências justificadas no Tech Stack:** `reqwest =0.13.4` já era transitivo; agora uso direto com TLS do sistema. `arboard =3.7.0` com Wayland é o provedor do plugin oficial, usado diretamente para ler imagem e HTML no gesto de colar, fora da thread de UI. Tauri permanece 2.11.5; plugin2.4+ exige^2.12 e a API Rust2.3.3 não expõe HTML. Nenhum pacote npm/plugin/permissão JS ampla/polling/escrita de clipboard. Lock adiciona42crates e não troca versões existentes. Python/GTK/ImageMagick servem apenas ao produtor de QA versionado em scripts; não ao runtime.

**Provas novas:** 15 passos Tauri/X11 no app final PASS, roteiro **0e6bcca95552a74d4dffb40b822ca051a5e82a781c65b9d11a678521a09bdedf**, produtor **3e47d452762ffb707fd03fd131f8f10b69efc94f02af71b11110dd49c0b49787**. Exemplo navegado/obtido no Browser: [Animexample.gif](https://commons.wikimedia.org/wiki/File:Animexample.gif), Branko/domínio público, SHA42392f2f…19dd1a. Clipboard real URL/HTML+PNG/raster e arraste GTK; seis quadros → duplicação/pintura/150ms → sete, Save/reopen, original/fundo/Undo, inserção de fundo montado antes do sprite, quatro bancos/Cancel/Undo/Redo, reutilização em nova cena sem referência prévia, dois nós editáveis, corrupção/reparo/retentativa,1280×800@125%. Build → ROM **c375b2cf3d9303fa652933bde52d806a9c20d120dd445a653ab5886641f1a1d5** → core oficial com hashes/pixels variando na região do sprite acima do fundo e recipe de tempos conferida. Fechar pelo menu real não pediu descarte e realmente encerrou o projeto. Fixture adicional simula DataTransfer vazio sobre HTML+PNG reais do sistema para exercitar o bridge nativo; pintura usa PointerEvents no Tauri. Menu Copiar imagem do Browser não foi automatizado.

**Regressões com escopo explícito:** qa-rc32, starter SNES/PVSnesLib/Snes9x/export e MUGEN completo103/417 com edição/rebuild/export PASS em **260ad42f…**, anterior somente à seleção da origem HTTPS sem extensão. Rust/runtime/importadores/editores não mudaram depois; fluxo afetado repetido no app final. Não afirmar que todas as regressões usam o mesmo SHA. Certificação nova **READY/sete gates**, **1276 frontend/11 skip**, **1117 Rust/109 ignored**, smokes oficiais; Clippy padrão/fmt/build/estrutura/sintaxe/auditorias/licenças PASS. Nenhum skip/ignore novo;12avisos Cargo preexistentes permitidos. Focados:40ingresso/96assets/8Rust de ingresso/1timer.

**Falhas preservadas:** mocks/boundaries antigos; aba de Arte não selecionada pelo callback apenas do store; fixture GTK de arraste; WebKit entregando PNG com types/files/items vazios; protótipos de plugin incompatível/compatível; seletores e prontidão do roteiro. A verificação estrita de fechamento expôs o `closeProject` de automação capturando diretório antigo e um seletor global que escolhia Fechar da notificação. O roteiro agora seleciona o menu próprio, proíbe descarte durante toda a operação e espera o botão Nova Cena habilitar após reabrir. Não foi necessário alterar o fechamento do produto. Expectativas/recibos de cada revisão mantidos. A rejeição de fingerprint de260ad foi deliberada após a mudança dos dois arquivos de transporte; o binário final foi reconstruído e requalificado.

**Operador e proteção:** atalho **RetroDev Studio — Testar** aponta ao app final; desktop-file-validate e KDE abrir → fechar normalmente PASS, recibo **2026-10-30T05-32-06-323Z-2325243**. Captura nativa Spectacle conferida. Interação de clipboard no Wayland físico não qualificada: Computer Use rejeitou a CLI ydotool disponível e o serviço/socket não estava ativo; nenhum daemon instalado/iniciado. Pacote privado **image-ingress-20261030-821d172a.tar.zst**, **686182118 bytes**, SHA **52c933b8ac080ff3886764146b8b3b0c068ebc8ba77c0cf6be75c0b89de4ad8e**, **1370 arquivos integralmente relidos**,112raízes. Mesmo filesystem, sem cópia fora do host qualificada; owner operador/reter até aceite humano e proteção independente. Fontes/receitas no Git, projetos/ROMs/assets/capturas fora dele; não limpar evidências ou sessões alheias.

**Limites/próximo passo:** entrada rápida qualificada para MD60Hz,15cores+alfa, sprite até64×64, fundo estático até320×224; redução proporcional e original preservado. Limites20MiB/64MP somados/256quadros de origem/255ocorrências no runtime; excesso recusado, sem truncamento silencioso. Recorte automático é de fundo uniforme conectado às bordas, sem segmentação neural de fotografias. Recuperação de animação do navegador depende do arquivo original ou metadados HTTPS públicos acessíveis. Fluxo rápido SNES ainda não qualificado. Teste humano de iniciantes/clipboardWayland/leitor de tela/contraste integral/Windows/GPU/áudio físico/console pendente;16jornadas amplas parciais, sem promoção. Próximo: abrir o atalho e o relatório, testar colar/soltar/escolher, papel/paleta/quadros/fundo/original/Salvar/Testar com assets próprios. Sem merge/release/deploy.

---

### Histórico — implementação de imagens/GIF em andamento, superada pelo checkpoint acima

Pedido atual: colar/soltar/escolher imagens, converter pelo Photo2SGDK existente, preservar quadros/tempos/original, editar pixels e fundo, inserir com o plano canônico de paletas e histórico. Implementação sobre **2047739c38ed4137f9460443d88fbf3f0ddff170**, mesma raiz/branch/PR #112; sem novo motor/store/writer. Transporte nativo `arboard =3.7.0` e HTTPS `reqwest =0.13.4` justificados no Tech Stack; pins existentes não atualizados. Versão final e gates ainda em validação, **não declarar entrega deste incremento**. Atalho continua no app anterior validado af7631b7… até concluir o alvo real.

Prova intermediária Tauri **556372a2…**: nove passos de GIF público de seis quadros, edição/duplicação/150 ms, original/fundo/Undo, arraste nativo, PNG do clipboard, escolha explícita de banco/Undo/Redo, Build → ROM → core com animação acima do fundo e reabertura de sete quadros. Essa versão usou um protótipo com o plugin oficial de clipboard; a versão final usa o mesmo provedor diretamente para ler também HTML e recuperar a URL original do GIF, API ausente no plugin compatível. Não atribuir essa prova ao binário final pendente. Falhas/retentativas preservadas em **RDS_WORK_ROOT/sessions/image-ingress-20261029**. Limites: conversão rápida MD, 15 cores + alfa, sprite até 64×64, fundo estático até 320×224, recorte de fundo uniforme conectado às bordas; sem segmentação neural ou suporte rápido SNES qualificado. As 16 jornadas permanecem parciais e sem aceite humano.

Checkpoint/receitas e proteção pendente integralmente verificada na rodada; owner operador, destino privado existente RetroDevStudio-UI-2026-10-27, mesmo filesystem, sem cópia independente qualificada. Próximo: validar binário final, reutilização sem referências de cena/erros/zoom, regressões, certify/auditorias, atalho KDE, proteção e commit/push do incremento revisável. Sem merge/release/deploy.

---

### Checkpoint 2026-10-29 local / 2026-10-30 UTC — importações e autoria de imagens (Experimental)

**Entrega local validada:** código **012c1a6194c7e8d546b2e577243142e0555cc91d**, app **af7631b75371675498e3d21a9d9b6073307f2b01b8d80ac7bf5268be2d5f047e**, mesma raiz/branch/PR #112. Este checkpoint e a seção **sgdk_mounted_images_20261029** do índice UI substituem o estado pendente abaixo. Fontes de produção conferidas contra o commit; única diferença posterior ao congelamento foi a expectativa do mock em `App.test.tsx`, agora verificando `onlyIfChanged`. Construção em árvore suja sobre 6d3d79db; sem alegação de build limpo/reprodutível. Recibos, versões do roteiro, relatório HTML e capturas em **RDS_WORK_ROOT/sessions/import-usability-review-20261029**.

**Causa e correção:** a deduplicação emitia índices de dicionário sobre um PNG mantido na ordem original. Os índices agora apontam à primeira ocorrência no atlas original, sem gerar/reordenar imagens. MAP/TILEMAP renderizável precede imagem auxiliar e banco TILESET; cenas distinguem **Imagem montada** e **Banco de peças**. Compatibilidade v4 só adapta em memória vetores antigos intactos com proveniência/ID/asset/dimensões correspondentes; edições, redimensionamentos e dados sem proveniência ficam preservados. A composição definida somente no C continua sem reconstrução geral.

**Autoria e recuperação:** parâmetros declarados são preservados no ledger existente e projetados no catálogo, incluindo todos os usos de uma imagem, medidas, quadros e animações, sem acesso posterior ao doador. Biblioteca tem busca, filtros em português, Miniaturas/Detalhes, rolagem própria e ações Adicionar à cena/Arte com o mesmo layout. Quadros compostos permanecem inteiros no ArtStudio; primeira sequência preenchida abre selecionada. Layout antigo desconhecido/paleta não vira objeto com grade inventada: há orientação explícita. Painéis mantêm largura útil e seleção ao redimensionar; canvas neutro conserva transparência no tema claro. Restaurar imagem original age na instância e aceita Undo; Fechar Console preserva registros. Imagem SGDK inválida identifica o arquivo e recusa a importação com limpeza do destino novo, permitindo retentativa com o mesmo nome.

**Persistência:** QA real encontrou gravação implícita de cenas compatibilizadas ao navegar. Hierarchy/criar cena/Fechar usam o writer canônico com `onlyIfChanged`, depois de confirmar campos pendentes; Salvar/Build mantêm gravação explícita. Estado Salvando começa antes da leitura assíncrona do rascunho, protegendo Salvar seguido rapidamente de Fechar. Quatro novas regressões e **48 testes focados PASS**; teste de integração do menu alinhado ao quarto argumento, **87 PASS**. Falhas continuam bloqueando fechamento quando o usuário conserva o trabalho.

**Lote SGDK nativo:** 14 pastas, **12 projetos gráficos aprovados**, um doador com visual gerado em código explicitamente identificado e uma pasta de planejamento recusada como esperado. **1.102 declarações, 1.050 arquivos de catálogo, 884 prévias decodificadas, 161 cenas, 156 imagens/mapas comparados com o PNG de origem**. Integridade por hash de cada recurso e nomes/layouts de todas as declarações; pixels opacos de cada montagem no canvas, complementados por regressão RGBA independente. Adicionar → Arte → aplicar → salvar/reabrir exercitado em amostra por projeto gráfico com os maiores quadros; usos compartilhados por amostra. Não significa edição individual de todos os assets. Janelas 1280×800 e 1366×768 com zoom de 125%, alcance por teclado/hit-test e imagens corrompidas/retentativa passaram. O projeto chamado OpenBOR_Demo neste lote é SGDK; não qualifica importação OpenBOR nativa.

**Mais quatro provas no mesmo app:** cópia legada de MeuProjeto 105 percorreu 24 cenas, sem gravação durante visita/fechamento; Salvar/reabrir estável, Restaurar/Ctrl+Z sem alterar PNG e Build → ROM → Emulação oficiais PASS. MUGEN completo **103 animações/417 ocorrências**, **11.208.960 pixels**, páginas/paletas/índices compilados, edição/Undo/Redo/reabrir/efeito na ROM/exportação PASS. qa-rc **A–H/32 casos PASS**. Starter SNES editado/salvo/reaberto, PVSnesLib/Snes9x/exportação PASS, ROM **879f23638992420dce1ab5b4f4b0ed788e06ae099e00fd3a1d3db675bf4adb74**. Só o resultado do seletor de arquivos/pasta é fixture; importadores, arquivos, edição e core são reais.

**Gates novos:** certify **READY/sete gates**, sessão **2026-10-30T01-05-06-078Z-1335467**: árvore, lint, TypeScript, frontend **1.254 PASS/11 skip**, Clippy lib, Rust **1.106 PASS/109 ignored**, smokes SGDK/PVSnesLib oficiais. Clippy padrão/fmt/build/sintaxe PASS; npm audit zero vulnerabilidades, cargo audit PASS com 12 avisos preexistentes permitidos; licenças PASS. Sem deps/locks/novos skips/ignores ou guardas relaxadas. Falhas preservadas: seletores antigos do roteiro, Console cobrindo ações, navegação que gravava legado, observação prematura do Save, um clique WebDriver sem resposta (retentativa idêntica aprovada), mock antigo do menu e timeout MUGEN completo de 120 s. Este último usa agora o orçamento limitado de 300 s já existente no runner, mantendo critérios e guardas; o roteiro exato do corpus anterior a esse ajuste foi retido por SHA.

**Operador e acesso:** aplicativo anterior fechado normalmente após captura Salvo; recibo antigo virou PASS e liberou lease sem remoção de trava/processo vivo. Os 277 arquivos originais permanecem iguais ao baseline posterior ao fechamento. Contra o baseline mais antigo, 276 arquivos iguais e apenas project.rds com escrita do app anterior ao fechar às 22:05 UTC; conteúdo anterior por campo indisponível. Validação usa cópias próprias. Atalho **RetroDev Studio — Testar** atualizado para **af7631b7…**, desktop-file-validate e KDE abrir → fechar normalmente PASS, recibo **2026-10-30T01-15-06-211Z-1374737**; serviços próprios de QA encerrados. Para testar: abrir `report/index.html` na rodada; escolher project.rds da tabela via MENU → Abrir projeto, Cena/Arquivos → Miniaturas → Detalhes → Adicionar à cena → Arte → aplicar → salvar/reabrir.

**Proteção privada:** **import-usability-review-20261029-af7631b7.tar.zst**, **756910711 bytes**, SHA **00722fc8bec0ca67e822797293ee7371f59a4274b3ac4f79ea09fbc7619f46be**, **11323 arquivos** integralmente relidos/verificados, 160 raízes de projetos/evidências/sessões. Destino privado existente RetroDevStudio-UI-2026-10-27; mesmo filesystem, sem cópia fora do host qualificada. Patch imutável do código também protegido. Owner operador; reter até aceite humano e cópia independente verificada, sem limpeza automática. Código/receitas no Git; corpus/PNGs/ROMs/projetos/capturas fora dele.

**Limites e próximo passo:** compreensão por leigos, leitor de tela/contraste integral, reprodução de cada áudio, Windows/GPU/console físico não qualificados. Textos auxiliares pequenos, avisos altos em 125% e espera de conversão MUGEN continuam pontos de usabilidade. Layouts ausentes em ledgers antigos pedem nova cópia importada para autoria de novos personagens. As 16 jornadas amplas continuam parciais/Experimentais; sem nova equivalência do C/CNS, promoção, merge/release/deploy. Próximo: avaliação humana dos projetos da tabela e desses pontos, preservando o fluxo/catálogo/writer existentes.

---

### Histórico 2026-10-29 — imagens SGDK: checkpoint pendente superado pela validação acima

Novo relato humano com capturas de MeuProjeto 105: HUD em faixa 142×1 e K.O./FIGHT! embaralhados. **Causa confirmada por leitura do importador, renderer, emitter e PNGs originais:** `extract_sgdk_tilemap_cells` emitia índices densos de um dicionário deduplicado, mas o PNG copiado permanecia na ordem original. Viewport e ROM interpretam N como tile N−1 desse PNG. Os arquivos K.O./FIGHT! já contêm a imagem montada. `TILESET` do HUD é um banco de peças; não é prova de recuperação da composição definida no C.

**Código local ainda não validado**, sobre **6d3d79dbaeaad44004d234ab68fa2e4892e3a6ba**, mesma raiz/branch/PR #112: índices apontam para a primeira ocorrência no atlas original; novos imports preferem IMAGE/MAP renderizável a TILESET; banco de peças recebe nome/contexto explícito. `load_scene` reconhece somente vetores antigos intactos por ledger SGDK v4, recurso, asset, ID e dimensões, normalizando em memória; célula manualmente editada/mapa redimensionado/sem proveniência ficam preservados. Abrir não escreve cena, ledger ou PNG; Salvar continua sendo o writer canônico. Marker opcional no ledger e hint existente em Logic distinguem dados novos/salvos. Sem novo importador, atlas derivado, IPC, store, dependência, relaxamento de guardas ou alteração nos arquivos do operador.

Três regressões Rust e uma frontend foram **escritas, não executadas**: recomposição de pixels com repetições/transparência antes de tiles únicos; imagem montada como primária e banco preservado; compatibilidade legada/salvar/reabrir/proteção de edições; texto do banco. Cenário nativo `sgdk-split-resources` estendido para comparar os pixels opacos do canvas real com os PNGs originais e, opcionalmente, abrir cópia legada própria sob o runtime. Esse roteiro também **não foi executado**.

**Bloqueio concreto:** diagnose de entrada READY, porém o app do usuário f3a7954b permanece aberto, PID **328186**, launcher/lease **328032**, recibo **2026-10-29T20-59-22-470Z-328032**. Launcher recusou fmt com **EEXIST**, recibo **2026-10-29T21-44-56-668Z-488700**. Não remover a trava nem encerrar o usuário. Pedido assíncrono para salvar/fechar normalmente está pendente. Não contornar usando PATH/caches alternativos. Node global v26.8.1/npm12 divergem dos pins; cargo ausente no PATH global. Todos os gates, fmt, build, teste Tauri e novo atalho estão **pendentes**; nenhum PASS anterior certifica este código. O atalho continua no último app validado **f3a7954b…**. `git diff --check` passou; CI/desktop do HEAD anterior 6d3d79db foram observados SUCCESS, sem qualificar a árvore modificada.

Continuidade privada: `RDS_WORK_ROOT/sessions/sgdk-mounted-images-20261029/work-receipt.json`, manifesto somente leitura de **277 arquivos** do projeto, patch **32924 bytes**, SHA **5a25d78f8a58eeffda54cfafe7c06f3bafc5d2181b50b0500bbce90e9a0b52a9**. Código permanece na árvore de trabalho, sem commit/push de código não validado. Patch também protegido e relido integralmente no destino privado existente `RetroDevStudio-UI-2026-10-27/sgdk-mounted-images-20261029-pending-validation.patch`; mesmo filesystem, proteção independente não qualificada. Recibo `pending-protection-receipt.json` no runtime; reter até validação/commit, owner operador. Próximo, depois da liberação normal da lease: `rtk proxy env RDS_WORK_ROOT=/home/misael/Shared/ProjectRuntime/RetroDevStudio RDS_BUILD_JOBS=1 bash scripts/new-host.sh --run cargo fmt --manifest-path src-tauri/Cargo.toml`, regressões `cargo test --manifest-path src-tauri/Cargo.toml --lib sgdk_source_atlas -- --nocapture --test-threads=1`, gates completos/certify, build oficial e QA Tauri com **cópia controlada**, preservando hashes do original. Conferir K.O./FIGHT!/Round1, banco explicado, salvar/reabrir, pintura e Build → ROM → Emulação; só então congelar app/atualizar atalho/commitar/publicar. Importação genérica, equivalência C, as 16 jornadas e aceite humano continuam parciais/Experimentais.

---

### Checkpoint 2026-10-29 — wizard progressivo e cores dos consoles (Experimental)

Pedido explícito de reformar o início para leigos e oferecer temas claros. Código **996738c02c6d6e89d608dd2483217cf6ef598337**, app **f3a7954b2577472dfe487392f1992f91e9d5e5bcf4402957486f5b16f841d00e**, build oficial **2026-10-29T20-38-23-558Z-239342**, mesma raiz/branch/PR #112. Fontes do binário conferidas contra o commit; construção em árvore suja, sem alegação de build limpo/reprodutível. Índice existente, seção **project_start_console_themes_20261029**, passa a ser a entrega atual; checkpoints anteriores são históricos.

Primeira tela com quatro caminhos: **Criar do zero → console → nome**, **Começar com um modelo → console → modelo → nome**, **Abrir projeto → arquivo project.rds**, **Importar projeto → SGDK/MUGEN → nome → pasta de origem**. Criação automática no diretório padrão, sem seletor de pasta; Voltar conserva o nome, colisões preservam o projeto anterior, falhas aparecem na própria etapa. Modelos exclusivos MD não aparecem para SNES. Demais perfis/doadores existentes ficam em detalhes secundários, com seus limites/Experimental; nenhuma plataforma, catálogo, motor, store ou importador paralelo.

**Tema** oferece **Super Nintendo** claro (gelo/cinza/roxo/lilás), **Super Famicom** claro (cinza/azul/vermelho/amarelo/verde), **Mega Drive Night** (preto/branco/cinza) e **Mega Drive 16-bit** (preto/prata/dourado). Preferência anterior migrada; Console, breadcrumb, guia, painéis de Arte/Efeitos/Arquivos e cartões/portas de Lógica usam superfícies/texto semânticos legíveis. Paletas de projeto e pixels não são alterados; sem dependências novas.

**Tauri real:** wizard/temas PASS em 12 etapas e oito combinações (quatro temas × 1280×800/1920×1080), 28 capturas finais; criação vazia MD/SNES e por modelo sem picker, importadores primários, voltar, abrir/cancelar/erro de arquivo, contraste calculado, teclado/foco, preferência após reinício e bytes exatos do canvas pausado/cena. **qa-rc A–H/32 casos PASS** no mesmo app. Starter SNES editado/salvo/reaberto/PVSnesLib/Snes9x/exportado PASS, ROM **442e0e1020c97fbec728a366aaf62d3b8e7c925bf4a4c0e5b1af67eb1e93c1fa**. MUGEN probe importado/editado/reaberto/reexecutado e origem inválida recusada PASS. Só resultado do diálogo OS é substituído por fixture de QA; ações visíveis, backend e arquivos são reais. Não equivale a aprovação humana ou CNS integral.

**SGDK mantém limite conhecido:** os seis manifests/251 recursos/177 SPRITE/zero instâncias foram importados e conferidos; compilação genérica recusou o mapa **142×1**, reproduzindo o bloqueio anterior. Nenhuma guarda/motor corrigido nesta fatia. Reprodução na predecessora cc00bcf3 (backend/importador inalterados); qa-rc no executável atual cobre também importação SGDK do sample controlado. Fonte original C tem fluxo separado já documentado, sem nova equivalência alegada.

**Gates novos READY/sete gates**, sessão **2026-10-29T20-50-32-220Z-294692**: estrutura, lint, TypeScript, frontend **1241 PASS/11 skip**, Clippy lib, Rust **1098 PASS/109 ignored**, smokes oficiais. Clippy padrão/fmt PASS. Sem novos skips/ignores/locks/deps; auditorias não repetidas por ausência de mudança de dependência/segurança. Referência BYOR do operador só por ambiente, SHA 558bea6c…529be9, sem download/cópia para os projetos.

**Falhas preservadas:** expectativas antigas do wizard/temas; revisões encontraram fundos fixos no Console/guia e depois em Arte/Lógica, corrigidos com tokens existentes; oráculo antigo media só o corpo (252/280px), passou a incluir cabeçalho/Voltar/footer do wizard progressivo sem mudar mínimos; primeiro MUGEN procurava o nome na tela antiga após reinício, roteiro agora abre project.rds. Após reinício do host, trava vazia anterior ao boot (17:19 UTC), PID ausente/nenhum fd dono, foi renomeada com recibo em interrupted-before-reboot; nenhum processo alheio encerrado ou remoção automática de trava adicionada. Diagnóstico/certificação refeitos no boot atual. Uma certificação posterior recebeu SIGTERM depois de 1241 frontend/1098 Rust, antes de fechar os smokes: tentativa e trava órfã preservadas, processo de testes próprio separado da chamada de terminal concluiu a certificação inteira. Nenhum passe parcial promovido.

Atalho **RetroDev Studio — Testar** atualizado para o app congelado **f3a7954b…**, launcher oficial/jobs=1. Evidências/raw/projetos/binários em sessions/project-start-console-themes-20261029; proteção **project-start-console-themes-20261029-f3a7954b.tar.zst**, SHA **7dcdd3b9777481b23ccc2fa5c304903516bd59dc0ba879bb5a26ef669fdbd680**, **1325 arquivos** integralmente verificados, mesmo filesystem (cópia fora do host não qualificada). Retenção até aceite/proteção independente, owner operador. As 16 jornadas e TPL-01..17 continuam parciais. Sem merge/release/deploy. Próximo: avaliação humana pelo atalho, MENU → Novo Projeto e Tema; testar as quatro intenções com dados próprios, mantendo importadores Experimentais e limites documentados.

---

### Checkpoint 2026-10-29 — ícones de criação e temas de consoles (Experimental)

**Correção do acesso pelo desktop:** tentativas 16:13/16:15 UTC falharam por EEXIST em development-operation.lock. Dono 264560 da abertura anterior já ausente (ESRCH), recibo ainda RUNNING; trava e recibos preservados por rename/cópia em sessions/desktop-shortcut-repair-20261029, sem apagar evidência ou encerrar processo alheio. Diagnóstico novo READY. Atalho/binário permanecem iguais; abertura pelo serviço KDE (kioclient exec), fechar normalmente e reabrir passaram. Fechamento gerou recibo PASS e liberou a trava; nova instância pertence a app-retrodev-studio-testar do usuário, independente do processo de ferramenta Codex, deixada aberta. Para demonstrações futuras no desktop, usar o serviço KDE e conferir ciclo de fechamento, preservando a política de não remover automaticamente travas sem verificar owner/recibo. Produto/locks de dependências não mudaram; não repetir suites como se houvesse mudança de runtime.

Pedido novo de UI para leigos, sobre e343283f; mesma raiz/branch/PR #112. Código **d1865bd46160db0bd5ccff77bafd187324a1bac1**, app **700dff469db621dc4677225a2b2b3f44ba2a0723ca6e5c44f8facc79f26377ab**, build oficial 2026-10-29T14-38-14-571Z-159204; fontes conferidas contra o commit, construção em árvore suja, sem alegação de build limpo/reprodutível. Índice existente data/studio_grafico/ui-cohesion-20261027.json, seção console_appearance_20261029. Não altera os candidatos Bosque/Jardim, paletas de projeto, catálogo, motor ou dependências.

Siglas SC/GM/AT e emojis das ferramentas principais dão lugar a pictogramas vetoriais originais sobre o Icon/Surface Registry existentes, com nomes visíveis, foco e estados preservados. Etapas Guiadas usam a mesma família. Cores por área e **Tema → Super 16 / Mega Drive / Portátil / Arcade**, padrão Super 16; tokens semânticos/painéis e preferência local, com mensagem quando só for possível aplicar na sessão. Cores de sucesso/erro/aviso preservadas; texto da ação Testar tem contraste sobre verde. Grupos laterais não encolhem/cortam itens; rolagem externa conserva acesso às áreas em janela compacta.

**Duas sessões Tauri finais PASS no mesmo app**: studio-appearance (oito casos: quatro temas × 1280×800/1920×1080, sete ícones, controles alcançáveis, grupos sem recorte, teclado/radio/Escape/foco, todas as áreas, etapas Guiadas, preferência após reiniciar) e **qa-rc A–H/32 casos/48 capturas**. Tema não alterou os bytes do framebuffer pausado nem da cena; build com SDK/core oficial, PNG/ROM identificados no relatório. Onze capturas próprias mais 48 do qa-rc. Revisão visual das paletas/chooser/Guiado e correção do recorte registradas; reconhecimento por leigos ainda não medido.

**Certify novo READY/sete gates**, sessão 2026-10-29T14-48-23-291Z-199065: frontend **1238 PASS/11 skip**, Rust **1098 PASS/109 ignored**, lint/TypeScript/árvore/Clippy lib/smokes oficiais. Clippy padrão incluindo binário e fmt PASS. Sem novos skips/ignores/locks/guardas; auditorias não repetidas nesta fatia sem dependência/segurança alterada. Falhas preservadas: tipo literal estreito; primeiro teste nativo com nome de helper inexistente após reinício, seguido de correção real de recorte descoberto por captura; primeira certificação 1237 PASS/1 FAIL por rótulos antigos Core/Debug no teste, alinhado a Projeto/Avançado mantendo roteamento e acrescentando pictogramas. Native/critérios não foram afrouxados; produto não mudou após as provas finais.

Atalho **RetroDev Studio — Testar** atualizado para o app congelado acima via launcher oficial, runtime externo/jobs=1, validado com desktop-file-validate; nome/ícone locais preservados. Abrir Tema no topo; reabrir pelo atalho para usar o novo executável. Recibos/raw/capturas/projetos/duas versões do binário em sessions/studio-appearance-20261029, protegidos no arquivo **studio-appearance-20261029-700dff46.tar.zst**, 188713238 bytes, SHA **e1ab4a60038a2aa992e599510b4247b9ed875ba3e823812747385543260269fb**, **327 arquivos relidos integralmente**. Owner operador, retenção até aceite/cópia independente verificada; mesmo filesystem, proteção fora do host não qualificada. Serviços próprios de QA encerrados, trabalho alheio preservado.

Limites: aparência local Experimental, não estudo de produtividade nem auditoria integral de acessibilidade das superfícies legadas. As 16 jornadas e TPL-01..17 continuam parciais; Windows/GPU/áudio físico/console/humano não inferidos. Próximo: avaliação com iniciante pelo roteiro já existente, incluindo localizar cenário/arte/regras/teste e escolher tema, mantendo dados privados fora do Git. Sem merge/release/deploy/promoção.

---

### Checkpoint 2026-10-29 UTC — ciclo de Nalu e aparência do modelo (Experimental)

Continuação autorizada do anexo/“Prossiga”, entrada **ec7a4e93543a88ba3b42c45629729dd9c9bb9be3**, mesma raiz/branch/PR #112, checks de entrada SUCCESS. Diagnose fresco READY, fingerprint **60249508…**, lock **dd99a22f…**. Conteúdo pelo app congelado **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**, launcher oficial/jobs=1. Nenhuma mudança em código de produto/jogo, seed, registry, dependências ou guardas por fora da UI. **Zero novos templates distribuídos** (TPL-01); não implementar lacunas de motor/editor nesta missão.

**Jardim Mares:** Nalu ganhou oscilação de um pixel e nadadeiras alternadas, pelo Move do PixelEditor, sem clipping; folha 160×32, cinco quadros 32×32, cinco cores visíveis/alpha binário. Documento nativo com 167 ms por quadro. ArtStudio: única sequência **Nado continuo**, quadros **0/1/2/3/4**, loop/6 FPS nominais. Aplicar nesta entidade e **Aparência → Aplicar ao modelo (1)** substituiu a aparência inteira do único uso de `reference_player`, removendo a exceção de sprite na cena. Cópia nativa **b1793277440130780160**, reversão disponível, não exercitada nesta fatia. Save/reopen comprovou só `nado_continuo`, sem idle/run/jump/nadar herdados. Física sem gravidade e comportamento permanecem exceções locais; não é prefab superior completo.

**TPL-11/P2 complementado:** salvar pixels deixou asset canônico pendente; reabrir Arte restaurou vínculo, descartando a sequência ainda não aplicada. Refazer pela UI, renomear Idle antes de remover as demais e reconfirmar Frame W=32 corrigiu a grade sugerida 24×24. Aplicar ao modelo é alternativa de conteúdo com escopo único, não correção do merge/reidratação do editor. Sem duplicar PNG nem escrever JSON externo. Só **quatro dos 30 arquivos autorais** mudaram: PNG/documento de Nalu, sprite do prefab e remoção da exceção na cena; modelo fora de sprite e cena fora dessa exceção conferidos iguais à cópia nativa. Grafo, física, mapa e demais recursos intactos. **Bosque: 24 arquivos iguais por hash**, sem nova partida alegada.

**Prova nativa:** após encerrar/reabrir/build, RAM do Sprite SGDK mostrou 0..4 em ciclo, dez ticks por quadro. Sessenta passos nativos com posição fixa **(144,96)** e contador zero; capturas estáveis **06-nalu-frame-0..4** mostram **quatro poses distintas**, com desenhos 0 e 4 iguais. Capturas iniciais na transição produziram só três hashes; assertiva visual falhou e foi preservada. Nova amostragem após estabilizar o quadro resolveu a observação, sem mudança de motor ou pixels para aprovar o teste. Não confundir FPS nominal com velocidade de execução do Xvfb/software.

**Jornada repetida:** contador **0→1→2→3**, indicador **000→100→110→111**, repetir oeste não duplica; farol antecipado não conclui, três pérolas longe dele ainda conclusão0, retorno em **(146,66)** muda conclusão1. Quadro final em (146,110). Contagens independentes de pixels dos espaços **[4,4,4]→[21,4,4]→[21,21,4]→[21,21,21]** e luz **27→41**. Parar/Testar recompilou com o mesmo SHA e reinicializou posição, contador/conclusão/indicador em zero e luz27. **TPL-12 permanece y=-10**, seguido de retorno pelo teclado; nenhum clamp/replay prometido.

ROM executada/exportada/recompilada **a9a973832cd72e6ee95043dcc9cbacc8382136197d297537a12fb300723c4a34**, **524288 bytes**, hashes independentes. Revisão **0 erros/0 avisos/27 OK**; hardware conserva aviso de **DMA estimado 88%**, antes95, 12 sprites/80/quatro bancos. Estimativa não qualifica desempenho em console. Indicador segue composição de sprites com câmera fixa/TPL-03; trilha herdada/TPL-05, replay/TPL-15 e distribuição/TPL-01 parciais. Nenhum AudioGen disponível na descoberta desta sessão; não escrever sintetizador/código externo para substituir autoria musical. Mapeamento de ferramentas não qualifica composição.

Evidências privadas **`RDS_WORK_ROOT/sessions/templates-nalu-cycle-20261029/`**: ledger nativo, expectativas anteriores à medição, resultados de animação/RAM/imagens, fonte antes/depois, percurso, revisão/exportação/reset, erratas. App/driver/display **:185** próprios encerrados e porta WebDriver fechada; nenhum processo alheio encerrado. Tauri/WebKit/core oficial em Xvfb/software, sem aceite humano/desktop físico/GPU/áudio/Windows/console. SHA remoto no PR/recibo posterior à publicação. Próximo comando de conteúdo: abrir Jardim/Bosque pelo launcher congelado do handoff para avaliação humana e continuar acabamento viável, mantendo TPL-01..17 explícitos. Sem merge/release/deploy.

**Gates frescos:** `--run npm run host:certify`, sessão **2026-10-29T12-45-15-176Z-399846**, **READY/sete gates PASS**: árvore/lint/TypeScript, frontend **1233 PASS/11 skip**, Clippy lib, Rust **1098 PASS/109 ignored**, smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário PASS pelo launcher **12-53-21-137Z-429188**; fmt PASS em **12-53-36-009Z-430088**. Relatório certificado congelado antes desses `--run` sobrescreverem o diagnóstico compartilhado; logs/recibos incluídos na proteção privada. Sem mudança de código/locks/segurança, auditorias de dependências não repetidas; nenhuma guarda/skip/ignore/golden alterada. Original BYOR **558bea6c…529be9** e modificado existente **261618d9…76192** reconferidos intactos por SHA, somente leitura, sem cópia/download para o jogo.

**Proteção:** recibo **b574d9e2cb01673f199f5e21f1b8af5dd636902b70e6e75270acdbec042f180e**, **1088 operações/observações e 28 capturas**. Backup **`templates-nalu-cycle-20261029-a9a97383.tar.gz`**, **3970384 bytes**, SHA **8825ce36fa03d603f1735757f9ee88f8003686233ab8d8ae56d2f0f1be55a830**, no destino privado existente `RetroDevStudio-UI-2026-10-27`. **138 arquivos/7720112 bytes** relidos integralmente; manifesto **013bf6b3b554771f54048a546f939c63769efe199c0874dd1a3f3e6084ce4fbe**. Inclui projeto Jardim completo, cópia nativa do apply e evidências; Bosque inalterado conserva proteção anterior. **Mesmo filesystem; cópia independente fora do host não qualificada**, owner operador, retenção até aceite/cópia privada independente verificada. Não é pacote de catálogo. Publicação documental na mesma branch/PR #112; recibo de publicação posterior ao push, separado do arquivo selado. Este commit não incorpora seu próprio SHA.

---

### Checkpoint 2026-10-29 UTC — progresso visual e farol do Jardim (Experimental)

Continuação autorizada do programa de autoria, entrada **be53aa116b579e475f672db9c729cb7c97ffa5e9**, mesma raiz/branch/PR #112; checks do SHA de entrada SUCCESS. Host diagnose fresco READY, fingerprint **60249508…**, lock **dd99a22f…**. App congelado **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**, launcher oficial/jobs=1. Nenhum código de produto/jogo, seed, registry, lock ou guarda alterado externamente. **Zero templates novos distribuídos**, TPL-01; lacunas do editor continuam reservadas ao backlog existente.

**Jardim Mares:** indicador de três espaços e farol apagado/aceso feitos pela UI. Cobertura 16×16 e dois faróis **24×24**, cinco cores visíveis por recurso, documentos PixelEditor e paleta compatível no banco 2. Seis instâncias do indicador compartilham cobertura/pérola existente. Três Objetivos com contador `Perolas`, requisitos 1/2/3, ator Nalu e área não sólida **320×224** escondem coberturas, revelando as pérolas. Objetivo principal continua exigindo três e retorno ao sensor do farol; esconde sua imagem apagada e revela a acesa, em **(140,52)**. Textos/camadas organizados pela UI: **19 entidades/quatro camadas/zero sólidos/30 arquivos autorais**, sem referências de camada penduradas. **Bosque não mudou**, seus 24 arquivos reconferidos por hash, sem nova partida alegada.

**Orçamento corrigido como conteúdo:** primeira versão dos faróis 32×32 gerou estimativa de **101% de DMA**, ROM `f6a49ff8…`. Tentativa/PNGs/documentos/cena/grafo/ROM preservados em `budget-candidate/`, sem promoção. Redesenho nativo 24×24 reduziu a **95%**, mantendo aviso no painel de hardware; 12 sprites/80 e quatro bancos. Nenhuma guarda elevada. Não confundir estimativa com desempenho real ou ausência de aviso global.

**Jornada nativa após salvar/fechar/reabrir/rebuild:** início contador0/indicador000/conclusão0; farol antes das três não conclui. Oeste **contador1/flags[1,0,0]**, repetir oeste mantém1; leste **contador2/flags[1,1,0]**; terceira **contador3/flags[1,1,1]**, ainda conclusão0; retorno ao farol **conclusão1** e feixes visíveis. Verificação independente dos framebuffers sem edição: espaços com **[4,4,4]→[21,4,4]→[21,21,4]→[21,21,21]** pixels claros; farol apagado/aceso **27→41**. Nova partida pelo toolbar restaura contador/conclusão/três flags em zero, espaços [4,4,4] e farol27. **TPL-12 permanece:** sonda nativa y=-10, seguida de retorno pelos controles e conclusão preservada. Não há contenção segura nem replay pelo controle.

ROM executada/exportada/recompilada, hashes independentes iguais: **455e3ae0658867ace006e2f83fd1fbfdd08b757c3612e778d7e593f5f729054a**, **524288 bytes**. Revisão **0 erros/0 avisos/28 OK**, separada do aviso DMA95% no painel. O indicador é **composição de sprites com câmera fixa**, pode se sobrepor ao personagem nessa faixa e não implementa vínculo numérico/ancoragem do HUD (TPL-03). TPL-06 avançou em feedback; trilha/replay/distribuição permanecem parciais. Leitura do roadmap/instruções atualizada, sem novo backlog paralelo.

Evidência privada **`RDS_WORK_ROOT/sessions/templates-pearl-meter-20261029/`**: expectativas congeladas, `ui-actions.jsonl`, `mares-meter-native-result.json`, `native-visual-check.json`, `reset-native-result.json`, `pixel-assets-report.json`, `budget-candidate/`; capturas **07/09/10/11/12/16**, revisão/exportação **17**, reset **18**. Uma ação de organização clicou a camada já ativa e a desmarcou; a ausência do botão habilitado interrompeu QA. Seleção/atribuição refeitas na UI, sem inferir defeito do motor. Autoria por controles nativos; scripts só dirigem QA/leem DOM/RAM/ELF/protegem evidências. Sem mutação programática de store/RAM ou avanço de frames para jogar; nenhuma geração raster/conversão externa nova. Tauri/WebKit/Xvfb/software; sem aceite humano, GPU/áudio físico, desempenho real, Windows ou console. App/driver/display :184 próprios encerrados, alheios preservados.

**Gates frescos:** launcher `--run npm run host:certify` PASS, sessão **`2026-10-29T11-11-45-952Z-114090`**; relatório **READY/sete gates**: estrutura/lint/TypeScript, frontend **1233 PASS/11 skip**, Clippy lib, Rust **1098 PASS/109 ignored**, smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário PASS em **`2026-10-29T11-18-37-654Z-134948`**; fmt PASS em **`2026-10-29T11-19-08-338Z-136229`**. `host-certified.json` congelado antes dos `--run` adicionais alterarem o diagnóstico global. Nenhum teste/ignore/guarda/lock alterado. Auditorias não repetidas nesta fatia sem mudança de dependência/segurança; resultados/12 avisos permitidos da execução anterior continuam no checkpoint abaixo. BYOR original/modificado reconferidos intactos, referência só pelo ambiente do gate existente, sem cópia/download para os jogos.

**Proteção:** recibo **2dce24d788aead03e62165a465dea76d88af3f6f389af756f7dcf02fee53bd0c**, **876 operações/observações/20 capturas**. Backup privado **`templates-pearl-meter-20261029-455e3ae0.tar.gz`**, **3440821 bytes**, SHA **927479d2c69edb7c1ff5c9419b44dea3218493e83db29eb529a100823a69178d**, no destino existente `RetroDevStudio-UI-2026-10-27`. **129 arquivos/7185738 bytes** relidos integralmente, manifesto **bddf567b17ed43e54f5e2cb1d4947c86a16658ecbe6d50bc3aba65757a87bcea**, recibos ao lado e no runtime. Bosque permanece protegido pelo pacote anterior. Mesmo filesystem, **cópia independente fora do host não qualificada**; owner operador, reter até aceite/proteção independente verificada. Não é pacote de catálogo. Commit/SHA remoto no Git/PR #112 e recibo privado de publicação posterior ao push, sem embutir o próprio SHA neste commit. Sem merge/release/deploy. Próximo: abrir os dois candidatos pelo launcher do handoff para avaliação humana e continuar acabamento viável, mantendo os limites do roadmap explícitos.

---

### Checkpoint 2026-10-29 UTC — selo de vitória autorado no Bosque (Experimental)

Continuação de “prossiga”, entrada **52a478f55e002357cf6129a305a39a4287e6b5b0**, mesma raiz/branch/PR #112. **Zero novos templates distribuídos** (TPL-01). Nenhum código de produto/jogo, registry, seed, lock, guarda ou decisão arquitetural foi alterado externamente. App congelado **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**, launcher oficial, jobs=1, um build/core por vez. Host diagnose fresco READY. A missão continua sendo autoria pela ferramenta; lacunas vão ao roadmap existente.

**Bosque Aurora:** cadeado e broto dourado originais **32×32/cinco cores visíveis**, desenhados/salvos no PixelEditor com documentos nativos. Duas instâncias em (264,56), composição opaca: o objetivo com requisito de três sementes esconde o cadeado, revelando o broto. Bandeira permanece como marco. HUD estático `BROTO DOURADO = VITORIA`, três textos e dois selos organizados em Interface. **14 entidades/quatro camadas/128 sólidos/24 arquivos autorais**; mesmo cenário/personagem/controles/SFX, quatro bancos existentes. Sem nova geração raster ou conversão externa nesta fatia. TPL-06 teve avanço de conteúdo; trilha, HUD progressivo, derrota/replay e distribuição continuam parciais.

**Jornada nativa após salvar/encerrar/reabrir/rebuild:** contador **0→2→3**, portão **0→1**, conclusão **0→1**. Duas sementes bloqueiam x=218; voltar/saltar recolhe a terceira, observada em **(208,128)**; chegada **(274,168)** revela o broto. Teclado X11 nativo e leituras observacionais DOM/RAM/ELF, sem teleporte, escrita de memória/store ou avanço de frames do core. ROM executada/exportada, hashes independentes iguais: **254875044b65a0b31d2eba6eac46bb6d61a5b180fc52418bb164f46bcd8d4c35**, **524288 bytes**. Revisão **0 erros/1 aviso de fonte compatível/21 OK**. A sonda de combate foi revertida no Inspector; **24 arquivos byte a byte iguais** ao checkpoint jogado. Novo build preservou esse SHA; Parar/Testar reinicializou contador/portão/conclusão em **0/0/0**. Isso não implementa replay pelo controle dentro do jogo.

**Sondas e limites:** Carregar Cena conectado ao Start produziu ramo C vazio na ROM `54b64000…` (TPL-15/P1); tentativa W3C sem movimento não qualifica Start consumido. Golpe autoral aceitou Lume/portão comuns, dano12/vida100, mas o build falhou em símbolos `rds_strike_*` ausentes e manteve o core descarregado (TPL-16/P1). O caminho exige dados MUGEN; caixas nativas do ArtStudio não bastam. Não alegar o `#error` de MUGEN inferido numa leitura estática: a recusa real foi a compilação C. Arena original não entregue. Com a sonda de três nós aberta, dois builds concluíram mas o guard stale recusou execução; fechar Lógica→Cena estabilizou a revisão e permitiu testar (TPL-17/P2, causa não isolada). Reprodução, owners e aceites futuros no roadmap; nenhum loader/combate externo foi criado.

**Erratas preservadas:** capturas iniciais sem sprites/uma preta não isolam defeito dos novos assets: os mesmos bytes depois mostraram a cena inteira. Não promovê-las a regressão determinística nem apagar as tentativas. A primeira execução do roteiro final recusou contador inicial 1, pois a caminhada manual anterior já coletara um item; o roteiro válido recomeçou pelo toolbar com entrada neutra. Autorrepetição desativada somente no Xvfb próprio evitou filas de repetição; eventos W3C liberados e entradas nativas observadas. Falhas de localização da UI ao reverter a sonda não restauraram arquivos: foi preciso voltar do workspace Debug e fechar o drawer Console antes do Inspector. Restauração final foi pela interface.

Evidência privada **`RDS_WORK_ROOT/sessions/templates-feedback-20261029/`**: `receipt.json`, `ui-actions.jsonl`, `bosque-seal-native-result.json`, `start-probe/`, `strike-probe/`, `probe-errata.json`; quadros estáveis **16/17/18**, revisão/exportação **21**, reset **24**. **Jardim Mares não mudou**, 24 arquivos fonte reconferidos pelo manifesto anterior; sua prova/hashes/limite de borda continuam no checkpoint abaixo, sem execução nova alegada. Nível atual Tauri/WebKit/Xvfb/software; sem aceite humano, GPU/áudio físico, desempenho real, Windows ou console. Processos próprios/display :183 encerrados; alheios preservados.

**Gates frescos desta fatia:** launcher `--certify` **PASS**, sessão **`2026-10-29T09-14-14-547Z-2092641`**. Host **READY/sete gates**: estrutura, lint, TypeScript, frontend **1233 PASS/11 skip**, Clippy lib, Rust **1098 PASS/109 ignored**, smokes oficiais SGDK/PVSnesLib. Também PASS: fmt, gates próprios dos **cinco pacotes** registrados e auditorias. npm: **zero vulnerabilidades**; cargo audit: **exit 0 com 12 avisos permitidos pela política existente**, logs preservados, sem alegação de ausência de avisos. Cargo-audit 0.22.2 já estava instalado. Clippy padrão incluindo binário PASS pelo launcher **`2026-10-29T09-38-50-537Z-2174908`**. Relatório certificado congelado em `host-certified.json` antes desse `--run` sobrescrever o diagnóstico compartilhado. Nenhuma dependência/lock, teste/skip/ignore/golden, guarda ou política de auditoria alterada. Referência BYOR pelo ambiente, SHA **558bea6c…529be9**; original/modificado reconferidos intactos, sem cópia/download para os jogos.

**Proteção desta fatia:** recibo **12f44ed3ff4b69c2c1d711f8b4e8cb9d07ee756eeeb84fa900d97479ea8c3d49**, **599 operações/observações e 24 capturas**. Backup privado do Bosque/evidências **`templates-feedback-20261029-25487504.tar.gz`**, **3995647 bytes**, SHA **6d1b01ff71e6d92c43bacc11a4805cfb49c79fecb973c7de6f1b2b7eadfde90b**, no destino existente `RetroDevStudio-UI-2026-10-27`. **130 arquivos/8895805 bytes** relidos integralmente; manifesto **1bf09c2a476c0940d117e94f217ce52848786f98603d336750d4fa42ca47fd73**, recibos ao lado e no runtime. Jardim permanece protegido pelo pacote anterior, sem duplicar seu conteúdo inalterado. **Mesmo filesystem; cópia independente fora do host não qualificada**, owner operador, reter até aceite/cópia privada independente verificada. Não é pacote de catálogo. SHA remoto/publicação no Git/PR #112 e recibo privado posterior ao push; este commit não embute seu próprio SHA. Sem merge/release/deploy. Próximo comando de conteúdo: launcher congelado do handoff, abrir os candidatos para avaliação humana e continuar acabamento viável; manter TPL-01..17 explícitos.

---

### Checkpoint 2026-10-29 UTC — cenário do Bosque e exploração Jardim Mares (Experimental)

Continuação autorizada do anexo/“PROSSIGA”, base **29b53493346f539aa8686931d67732dcf1e2662c**, mesma raiz/branch/PR #112; checks do SHA de entrada SUCCESS. **Zero novos templates distribuídos**: TPL-01 continua impedindo projeto salvo → pacote/catálogo. Nenhum código/seed/registry/lock/guard alterado. Autoria de conteúdo pelos controles do app congelado **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**, launcher oficial, jobs=1, um build/core por vez. Não implementar lacunas de editor/motor nesta missão.

**Bosque Aurora:** nova paisagem original com raízes/flores/pedras/piso/ilha, convertida pelo pipeline existente do SGDKForge para **320×224/15 cores visíveis** e importada pela UI. Troca no tilemap original, células limpas pelo Inspector, piso y=200/ilha y=160 e **128 sólidos** pintados pela UI; personagem/portão/bandeira/sensor e sementes reposicionados. Mantém 11 entidades/quatro camadas e três coletas/contador/passagem/objetivo. Depois de salvar, encerrar/reabrir e rebuild: **0→2→3 sementes, portão 0→1, conclusão 0→1**. Duas sementes bloqueiam x=218; voltar a x≈124, saltar e alcançar a ilha coleta a terceira. Na conclusão, x=274/y=168. ROM executada e exportada, bytes/hash conferidos independentemente: **131587e2c7cfec58e8729e228c19608608b8860db325dc8cd8a25e082fffaf20**, **524288 bytes**. Revisão **0 erros/1 aviso/17 OK**; desapareceu a aproximação de 2788 pixels (TPL-04 resolvido nesta instância), resta o aviso impreciso da fonte compatível (TPL-08). Builtin anterior não foi substituído.

**Jardim Mares:** instância própria criada pelo wizard e montada no Studio. Nalu, tartaruga de casco dourado; laguna de corais com caminhos escurecidos/simplificados após a primeira ROM; três pérolas e retorno ao farol. Nalu foi importada pelo ArtStudio e preparada no PixelEditor em folha **160×32/cinco quadros/duas poses de nadadeiras**; pérola **16×16** desenhada no PixelEditor e compartilhada pelas quatro instâncias. Quatro ramos de entrada/movimento conectados pelas portas; cima dy=-2, baixo dy=2, esquerda/direita dx=-2/+2, gravidade false. Comportamentos de contador/coleta única/objetivo com requisito 3; HUD estático; camadas Background/Camera/interface/jogabilidade, dez entidades, **zero sólidos**. Câmera fixa, SFX e música técnica herdados. IDs ausentes da antiga camada Gameplay foram retirados recriando/atribuindo a camada pela UI.

Jornada final do Jardim após encerrar/reabrir/rebuild, por teclado nativo e leituras observacionais de RAM: início (144,96), farol com **0 pérolas/conclusão 0**; oeste **1**, leste **2**, espiral **3**, retorno (146,66) **conclusão 1**. Sonda de borda levou a **y=-10**; retorno pelos controles a (146,62), conclusão preservada. **TPL-12 impede qualificar contenção da área**. ROM executada/exportada: **2c67153cf691848fa23e1d62fa469cb4ee526f5d40938c205dbc6a4b135350e7**, **524288 bytes**, revisão **0 erros/0 avisos/19 OK**. Revisão verde não detecta esse defeito de gameplay. Ambos os candidatos seguem parciais: distribuição, trilha, progresso do HUD e apresentação/replay não acabados; no Jardim também limites/direção de animação/colisão de exploração. Não promover a pronto por build/ROM verdes.

**Limites reproduzidos e continuação:** importar cenário no fim da lista deixou sprites invisíveis na ROM `96a85a79…`, apesar de RAM/coletas funcionarem (TPL-09); **Definir Variavel/Estado (FSM)** novos mostram parâmetros sem campos de edição e bloquearam o puzzle de sequência (TPL-10); remoção de sequências pode reidratá-las e o merge de prefab conserva animações fora da folha nova (TPL-11); digitar -2 no número do nó resultou em +2, corrigido no conteúdo pelas setas do controle (TPL-13); exclusão de entidade deixa ID/contagem da camada (TPL-14). Owners/reprodução/aceites em **TPL-01..14 no roadmap existente**. O puzzle não virou projeto funcional; exploração foi a atividade independente seguinte. Arena/nave, parallax/transições e composição musical ficam sem promessa de suporte, com aplicações futuras já mapeadas.

**Recuperação explícita:** a tentativa de cenário importado no fim foi protegida em `failed-import-project.tar.gz`; restauraram-se **19 arquivos byte a byte** do checkpoint autorado anterior, com `recovery-receipt.json`. Isso recuperou o projeto, sem fabricar capacidades do editor. A troca de cenário/posições/colisão foi refeita pela UI. Nenhum campo de JSON/C do jogo foi escrito por script para autoria. Fontes/prompts raster originais e conversões técnicas ficam no runtime; conversor existente do SGDKForge, sem mudar suas fontes. São candidatos técnicos, sem promoção estética humana.

Evidência privada desta continuação: **`RDS_WORK_ROOT/sessions/templates-content-20261029/`**, `receipt.json`, `ui-actions.jsonl`, `bosque-native-result.json`, `mares-native-result.json`, fontes/prompts/specs/jobs de arte e capturas reais. Quadros finais **37/38/39/40** (Bosque) e **29/30/31/32/33/35** (Jardim), revisão/exportação **41/36**. A captura inicial `27-mares-victory.png` tem nome prematuro: RAM ainda indicava conclusão **0**; não é evidência de vitória. O recibo final usa a jornada repetida **33/35**, com conclusão **1**. Falhas e sondas preservadas.

Nível exercitado: **Tauri/WebKitWebDriver/Xvfb/software**, teclado/ponteiros nativos e leitura DOM/RAM/ELF, sem mutação de store ou memória para jogar. Sem aceite humano, desktop físico/GPU/desempenho/áudio físico, Windows ou console. O baseline 16/16 do checkpoint anterior não foi contado como execução nova. Host diagnose desta continuação READY; certificação/gates finais, hashes do recibo e proteção no adendo de fechamento abaixo. Projetos em `/home/misael/Documents/RetroDevProjects/{Bosque_Aurora,Jardim_Mares}/project.rds`; instruções no README de arte existente. Sem merge/release/deploy.

**Fechamento desta continuação:** certificação **READY/sete gates**, sessão `2026-10-29T07-55-51-422Z-1805366`: check:tree, lint, TypeScript, frontend **1233 PASS/11 skip**, Rust **1098 PASS/109 ignored**, Clippy lib e smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário e fmt também PASS. A primeira certificação terminou BLOCKED (**1097 PASS/1 FAIL/109 ignored**): faltou aplicar `RDS_HAMOOPIG_ROM`, já exigida no handoff quando o artefato REX modificado está presente. Referência localizada no backup do operador, SHA **558bea6c…529be9**, usada somente leitura pela variável; reteste dirigido 1/1 e certificação inteira passaram, sem mudar testes/ignores/guardas ou apagar artefatos. Original e modificado permaneceram com hashes idênticos aos de entrada; sem download/cópia para os projetos. É requisito do gate REX existente, não dos jogos autorais. Falha/logs/reteste preservados; `host-certified.json` congelado antes dos launchers seguintes sobrescreverem o relatório compartilhado. Avisos preexistentes de teste Rust permanecem nos logs; auditorias de dependências não repetidas, pois dependências/segurança não mudaram.

Recibo final **`f01c8ae393ea05ab07f424782095dd74ae4daaf2d7f104e7e1c545035de99611`**: **20/24 arquivos autorais**, sem caminhos absolutos nos JSONs nem IDs de camada pendurados; **1299 operações/observações**, **45 capturas**, fontes/prompts/specs e quatro jobs de conversão. PNGs conferidos: cenários com 15 cores e nenhum pixel transparente; Nalu/pérola com cinco cores visíveis e alpha binário. Backup privado **`templates-content-20261029-131587e2-2c67153c.tar.gz`**, **14540513 bytes**, SHA **7777e3e9ca7af34525c26d59770ae74bbcc0eb5257e9c011ea565e87f05a02eb**; **230 arquivos/21041822 bytes** relidos integralmente e comparados por tamanho/SHA, manifesto **64efc584c13f8dba383237c017d39aa1a9eb39dd18f075a1ec07a647c64bb47a**. Destino privado existente `RetroDevStudio-UI-2026-10-27`; recibos/manifesto ao lado do pacote, `protection-receipt.json` também no runtime. **Mesmo filesystem, cópia independente fora do host não qualificada**, owner operador; reter até aceite e proteção independente. Não é pacote de template. Processos próprios/display :182 e links temporários do picker encerrados/removidos; fontes/projetos/evidências alheios preservados. Próximo comando de conteúdo: launcher do app congelado no handoff, abrir os dois projetos para avaliação humana; lacunas continuam reservadas ao backlog. Publicação documental/SHA remoto no Git/PR #112 e recibo privado de publicação; este commit não embute seu próprio SHA.

---

### Checkpoint 2026-10-29 UTC — autoria no Studio: Bosque Aurora parcial (Experimental)

Pedido do anexo: produzir pela interface, deixando lacunas do editor para implementação futura. Raiz única/branch `codex/new-host-cohesion-20261024`/PR #112, entrada limpa **b80ae708a4f1ebe31998f0247ce1b97cea499fd4**, checks CI/Linux/Desktop SUCCESS. Host diagnose fresco **READY**, fingerprint `60249508…`, lock `dd99a22f…`; launcher/pins oficiais, jobs=1, um build/emulador por vez. **Nenhum código de produto, seed, JSON/C do jogo ou guard foi editado externamente.** Sem downloads/dependências/arquitetura novos.

**Zero novos templates concluídos/distribuídos.** Catálogo mantém nove entradas e `project_mgr::seed_project_template` materializa builtins/doadores; Revisar/exportar produz ROM, não pacote autoral para o catálogo. Implementar essa lacuna nesta missão contrariaria o pedido. Backlog **TPL-01..08** no roadmap existente, com reprodução/owner/prioridade/aceite e sequência de gêneros. O programa prosseguiu em arte/conteúdo/organização/provas independentes; não criar catálogo/empacotador paralelo. O builtin continua com o conteúdo anterior.

**Bosque Aurora** é uma instância parcial criada pelo wizard (`Bosque_Aurora/project.rds`, na pasta padrão de projetos). Abrir esse arquivo, não criar outra instância esperando encontrar as mudanças. Direção: raposa Lume, floresta azul/verde, sementes âmbar, portão/bandeira. Arte original existente preservada; semente **16×16** desenhada/salva no PixelEditor com documento nativo. Pela UI: três coletas (clareira/trilha/copa), contador, movimento com salto apoiado/força112, portão (232,176), chegada (280,176), objetivo, instruções HUD, quatro células do céu e organização Gameplay/Interface. O grafo manual foi substituído selecionando/apagando nós e aplicando Comportamentos; Start/música mantidos. Scripts privados só dirigem controles nativos, leem DOM/RAM/ELF e verificam/protegem evidência.

**Provas frescas**, app **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**: runner canônico `reference-platformer` **16/16 PASS**, `2026-10-29T01-45-45-457Z` (teclado/salto/áudio encaminhado, pintura/Undo/Redo, persistência/passagens). Jornada própria: criar → build/jogar → editar/salvar → encerrar app/reabrir → **11 entidades/quatro camadas** preservadas → novo build SGDK → teclado → Stop → revisar/verificar/exportar. Na partida final após reinício: contador **0→2→3**, portão **0→1**, conclusão **0→1**, leituras observacionais de RAM pelos símbolos ELF. Com duas sementes, bloqueado em **x=218**; voltar/saltar coleta a terceira sobre a plataforma e abre a passagem. Sem teleporte, avanço de frames no core ou mutação do modelo por API nessa partida. ROM reaberta/executada/exportada, comparada independentemente: **7935b17a702674bb4eeddff261668e5b0662b756ebf8d12adf63265a3c646ee8**, **524288 bytes**. Antes da pintura: `8dd15396…`; células (1..4,0) 0→1 e colisão **88** preservada. Revisão: zero erros/17 OK/dois avisos.

Evidência privada: **`RDS_WORK_ROOT/sessions/templates-authoring-20261028/`**, `receipt.json` SHA **5e3d2ccc8d0716955fa93c3ee906f16681206f1ffaa2fdaa31d6c73b084c1d23**, manifesto de **19 arquivos autorais**, **490 operações/observações** em `ui-actions.jsonl`, baseline copiado e capturas inspecionadas. `20-reopened-game.png`, `21-final-gate-closed.png`, `22-final-platform.png`, `23-final-victory.png` são quadros reais 320×224; `*-window.png`/`24-review-export.png` contextualizam a UI. Recibo verifica observações/hashes, não aceite humano ou um novo teste distribuído de produto.

**Defeito de conteúdo x ferramenta x ambiente:** baseline não reproduziu falha geral de build/input do plataforma relatado. Conteúdo herdado tem salto manual sem condição de apoio, objetivo curto por segurar Direita, amostras no céu e título técnico longo; a instância tratou movimento/regras/percurso/amostras/nomes/texto. Terreno e música continuam provisórios; fonte do cenário tem **16 cores opacas/2788 pixels aproximados** para 15 + transparência. HUD não expõe contador; conclusão ainda é flag/remoção da bandeira/SFX, sem apresentação/replay acabados. Outros gêneros não receberam novo modelo; puzzle de regras é próximo conteúdo viável, ainda não criado.

Recusas preservadas: três sementes disputavam PAL1 com a raposa e o build corretamente abortou; atribuir paleta a uma instância recusava a redução do conflito remanescente (TPL-02). Resolvido **como conteúdo**, pelos controles do recurso compartilhado: cinco índices compatíveis com a bandeira, fixação PAL2, índice15 da bandeira/fonte branco. Quatro bancos/zero conflitos, seis sprites estimados, pico cinco/scanline, ~6KB VRAM estimada; não são medidas de DMA/ciclos físicos. Paleta Pro interceptava topo; Guiado com brush mantido permitiu pintar sem remover DOM. Fonte compartilhada é compatível, mas revisão usa indevidamente texto de aproximação para esse aviso; TPL-08 distingue do aviso real do cenário.

Primeiro Xvfb próprio recebeu SIGTERM/exit143, causa não isolada; driver perdeu a página depois do display. Projeto salvo reabriu; não atribuir a OOM/template. Rascunho anterior foi arquivado antes de dispensá-lo pela UI, com conteúdo salvo confirmado; reabertura final sem aviso. Falhas do instrumento (GET com body, seleção de option, campo encoberto/hidratação) foram corrigidas só no driver privado. App/driver/display próprios encerrados, sessões alheias preservadas.

Proteção privada verificada: `templates-authoring-bosque-7935b17a.tar.gz`, **10092150 bytes**, SHA **94f2213520c130f38fd98d567855e39bf2c69666ea2c9ce4d82e4bb1d82bca7a**, **163 arquivos/16294644 bytes** comparados integralmente ao manifesto. Pacote/manifesto/recibo no destino de backup existente `RetroDevStudio-UI-2026-10-27`; recibo também no runtime. Mesmo filesystem; cópia independente fora do host não qualificada. Owner operador, retenção até aceite e proteção independente verificada; backup não é distribuição de template.

Limites: Tauri/WebKitWebDriver em display virtual/software, input nativo e observação; sem participante humano, desktop/GPU/áudio físico, Windows ou console. Não houve mudança de produção/QA rastreada nem nova suíte completa/certificação; **READY/1233/1098 abaixo são da rodada anterior**. Gates desta fatia documental/de conteúdo: execução real acima, recibo/hash, `npm run check:tree`, `git diff --check` e revisão dos cinco documentos/referências. Publicação/próximo comando no handoff existente; SHA final pelo Git/PR #112, sem autorreferência no commit. Sem merge/release/deploy/promoção. Próxima ação de produto: TPL-01; conteúdo independente pode seguir em puzzle/arte pelos controles existentes, mantendo parcial.

---

### Checkpoint 2026-10-28 — diagnóstico funcional e correções verificados localmente (Experimental)

Pedido nas quatro frentes concluído na raiz única, branch codex/new-host-cohesion-20261024/PR #112, base 407bc03e. Código publicado: 2783f234708d8d6b422d1179d249303da3a862a7, 041daec7471046ea8f5ccc40c0f82aa25f186955 e b608469545f4b4aaa6ef47798e69489e18277bcd. CI e Desktop E2E desses três incrementos SUCCESS; o HEAD documental/QA final tem checks próprios, conferir no remoto. Sem merge/release/deploy, dependência/lock novo ou alteração das Decisões Arquiteturais Consolidadas. **Diagnóstico entregue; etapa ampla ainda não fechada.** As 16 jornadas continuam parciais e sem aceite humano.

Executável congelado: **fdf0c4fb7eecc4b5b91295d7f26f2098c9b8b1abc564aabc61308d0d7aa84f5c**, 427657968 bytes, build oficial 2026-10-29T00-10-50-754Z-269022 (noite local 28/10), em RDS_WORK_ROOT/sessions/product-diagnosis-20261028/binaries/final. Fontes de produção coincidem com b6084695; snapshot de 959 fontes/receitas por SHA. Construção em árvore suja antes do commit, sem alegação hermética/reprodutível. Única mudança posterior ao build/certificação: helper de QA legado passou a clicar Analisar escolhas antes de importar MUGEN, conforme o fluxo atual; Node --check e regressão Strider nativa passaram. Fonte do produto permaneceu byte-idêntica. Candidatos bc8aca0a/72e2233b/b8ad297c/bf1595f1 e seus recibos/falhas estão preservados por nome/hash; caminhos binaries/final de relatórios antigos indicam o caminho no momento da execução, não o app atual.

**Sete correções:** PixelEditor mantém documento/histórico por projeto ao trocar modo/workspace; salvo compara conteúdo confirmado e ignora respostas antigas; PNG/documento reutilizam escritor atômico/sincronizado e rollback em falha reportada; identidade ROM C independe de mapa de nodes e edição C invalida revisar/exportar; catálogo/wizard/backend recusam modelo MD-only com SNES antes de reservar pasta; rodapé conta componentes sprite, não todas as entidades; overlay C mostra sprites/DMA de nodes indisponíveis, preservando FPS e VRAM medida do VDP. Regressões e antes/depois no índice existente, seção product_diagnosis_20261028, e matriz/owners em docs/handoffs/NOVO_HOST_INICIO.md.

**15 jornadas finais no mesmo app: 14 PASS/1 FAIL delimitado.** Autoria MD a partir do modelo: edição UI, duas passagens/objetivo, SFX, salvar e reinício/reabrir; pixels 10 passos; C original 22 passos; MUGEN completa 103 animações/417 ocorrências (pixels/paleta/ELF/ROM/RAM, duração UI/Undo/Redo, efeito temporal e restauração/exportação exata); E4 modelo/instância; E2E5 golpe/caixas/eventos/SFX/HUD; paletas/câmera/cenário; recuperação com interrupção; QA RC A–H; onboarding; fixture SNES; starter SNES criado/editado/salvo/reaberto/PVSnesLib/Snes9x/exportado. Extras: cadeia CMD/CNS 200 com 336 ticks sem divergência contra referência independente, 296 frames corretos a 0 vblank e 7 controles negativos recusados; Strider VelSet 2.5→3.75 px/tick por Inspector, duplicação, reinício e teclado com 0 divergências. Idle 0 da cadeia original é stand-in autoral (common1.cns ausente); HitDef/PlaySnd/poweradd opacos, não CNS integral nem equivalência com runtime MUGEN. Locomoção Strider usa fixture autoral, facing fixo e VelSet constante; não prova colisão/dano/combate/PAL. Não confundir com a demo autoral 0/20/21/200, que preserva CNS como referência.

Mugenesis: caminho escolhido compila o C original pelo wrapper existente, não reconstrói o motor em cenas/nodes. 6 manifests/251 recursos/177 SPRITE de catálogo/**0 instâncias de cena**. Treino/Idle selecionado por teclado; aguardar controle disponível depois da introdução, neutro 10 frames x=23040, Right→26814 e Left→22843; ataques enviados, sem prova de partida completa. Captura VDP/Cena–Arte–Lógica e edição de bloco C passaram. ROM original **ff909dbf499b23bbc06c7951e4bdde698834a4eb2ac66ff9a1e7ec3575b533b9**; editada/executada/exportada **90fe6369814ed3abeaa6bffa8943c1d0ab6830188dcf9ec5bf8c9e65e9ccae1b**. Recibo, ELF, manifesto de entradas, log e identidade SDK retidos por build. SDK conteúdo **fa4d70402a5819eca642e6f9d10a9cfbcc1a97de0c4769b2d788175365b498aa**. Os 403 arquivos de fontes/inc/res originais e 105 receitas SGDKForge reconferidos intactos, com cópias privadas congeladas; raiz alheia tinha WIP e não recebeu commit desta tarefa.

**FAIL mantido:** importador SGDK genérico preserva 251 recursos por SHA, 0 sprites em cena e rodapé 0/80, mas recusa fita de tiles 142×1 como plano MD (64×64/128×32/32×128). Não elevar limite, descartar animações ou executar ROM antiga. Usar o C original para este doador; conversão gráfica continua parcial. SNES demonstrado é starter de sprite, não o modelo de plataforma MD; plano compartilhado de paletas ainda informa MD-only. Música autoral geral, demais perfis com corpus real, conflitos/reimportação e cancelamento durante conversão/build não foram qualificados nesta rodada.

Certificação final **READY/sete gates**, sessão 2026-10-29T00-36-51-938Z-384696: check:tree, lint, tsc, frontend **1233 PASS/11 skip**, Rust **1098 PASS/109 ignored**, Clippy e smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário, fmt e sintaxe do harness também PASS. Nenhum skip/ignore/guarda/golden novo ou enfraquecido. BYOR Hamoopig fornecido por RDS_HAMOOPIG_ROM, SHA 558bea6c…, sem download; avisos Rust preexistentes permanecem nos logs. Certificação congelada em certification/ antes de novas sessões --run sobrescreverem o diagnóstico compartilhado; não inferir sete gates pelo último host-readiness global. Auditorias de dependências desta rodada não foram executadas nem alegadas, pois dependências/segurança não mudaram.

Falhas preservadas: falso Salvo/perda de pixels no app anterior, cleanup intermediário apagando recusa de paleta (corrigido sem afrouxar teste), XDG privado ocultando Wine Flatpak (instalação existente reutilizada por FLATPAK_USER_DIR), sonda enum corrigida para 32 bits pelo ELF, Arcade/introdução contaminando medida de movimento (recusadas, depois Treino/ctrl/neutro), SNES incompatível deixando esqueleto (agora preflight), helper antigo esperando Importar sem Analisar (agora interação explícita) e cópia auxiliar de upstream com nome errado depois de gates verdes (retomada correta). Nenhuma tentativa FAIL foi substituída por PASS. Captura do wizard com target fora da rolagem não foi aceita como prova visual do disabled; esta propriedade tem teste DOM/backend. Captura com Salvando não prova save concluído; usar o relatório e frame posterior estável.

Proteção privada: product-diagnosis-20261028-fdf0c4fb.tar.zst, **635990914 bytes**, SHA-256 **6842d762ca615b4caf1805787df25279b70016424ce61d76dd876b3bd52da726**, 5309 registros/2662887000 bytes verificados por leitura integral. Destino privado existente RetroDevStudio-UI-2026-10-27, recibo ao lado e em RDS_WORK_ROOT/sessions/product-diagnosis-20261028/protection-receipt.json. 35 projetos/snapshots próprios, entradas Ken/Mugenesis/receitas, binários e evidências preservados; um link SDK é só referência, SDK deve ser restaurado pelo tooling oficial e identidade conferida. Mesmo filesystem: **backup independente fora do host não qualificado**. Owner operador; retenção até aceite humano e cópia privada independente verificada. Nenhum dado/asset/ROM/binário/captura bruto publicado no Git. App/drivers próprios encerrados; Xvfb :181 próprio encerrado com PID/cwd/UID qualificados, display :173 alheio preservado.

Limites: automação Tauri/WebKit em Xvfb, com teclado/cliques nativos, controles DOM e observações do harness; não Vite, participante humano, desktop/GPU/áudio físico, hardware ou todas as jornadas Windows. FPS observado por software ~5–7 não qualifica desempenho real. Pixels pendentes ficam em memória até Salvar; rollback de dois arquivos não é transação contra corte de energia. Cenas C capturadas são referências, novos recursos podem exigir .res/C externo. Próximo: roteiro humano já existente, alvo desktop/Windows e restauração de amostra em backup independente; aprofundar SNES/importadores dentro dos contratos, sem outro motor universal. Para abrir o app congelado, usar launcher oficial com RDS_WORK_ROOT e conferir SHA; comandos e prioridades no handoff.

### Checkpoint 2026-10-27 — Mugenesis: C original compilado e executado pelo Studio (Experimental)

Mesma branch/PR #112. Decisão do operador aplicada: preservar e executar a lógica C original. `legacy_sgdk_overlay` foi estendido, sem pipeline paralelo nem Makefile fictício: sem Makefile e com `build.bat` delegando a `tools/sgdk_wrapper`, o build no Linux chama o `build_sgdk_wine_bridge.sh` do ancestral SGDKForge com `--output-dir out/tests/rds_<ms>` e `--report-dir out/tests/rds_<ms>_logs` (contrato do wrapper para builds não-default; `out/rom.bin` alheio intocado). A ROM só é aceita se o recibo `linux_wine_build_report.json` daquele run diz `buildado`/exit 0, `output_dir` igual ao run e SHA-256 igual ao arquivo; falha, recibo ausente ou SHA divergente nunca executam ROM antiga. Fora do Linux o modo recusa explicitamente. Antes do build, assets do overlay cujo conteúdo divergiu do arquivo da raiz C (hardlink quebrado) recusam o build, para nenhuma edição ser ignorada em silêncio.

Recursos x instâncias: no overlay C (`SgdkSpriteInstancing::NativeCatalogOnly`) e no import genérico quando os SPRITE excedem `MD_SPRITES_PER_SCREEN` (80), os recursos ficam apenas no catálogo de assets/ledger, sem entidade, câmera ou grafo; aviso `sprite_catalog_only`. Limite, validações e conflitos não foram alterados. O Explorer mostra o escopo de edição: consumido pelo C (assets de `res/` no mesmo arquivo), só organização (cenas/entidades/grafos do `rds/`), requer integração (C e `.res`).

Baseline oficial do wrapper: `out/tests/rds_baseline_20261027152018` buildado. Prova no Tauri real (Xvfb `:171` próprio, driver E2E, cenário novo `sgdk-native-c`), binário `0e9e0fe3d1724f1a277d5aa9040ed96ecd1354d2908ae5f180728c997e6027ef`: abrir raiz original → overlay `rds/` com 6 manifests/251 recursos/177 SPRITE no catálogo e **0 sprites em cena**, cada asset igual à origem por SHA → Build & Run → wrapper real (18:56:50–18:58:02 UTC) → ROM `8a85d3002523d60db9f036107c683552ece09193f9b161ab02cb4ce0e0e194b0` (3538944 bytes) igual ao recibo → Genesis Plus GX. Observado: tela-título Mugenesis com Ken e Ryu; Start/direcionais/botões aceitos pelo joypad e menu "ESCOLHA O MODO" (Arcade, Time Attack, Bonus Round, Demo, Options) exibido; 8 framebuffers distintos; áudio com amostras não nulas (pico 0,04). Parar → fechar → reabrir manteve o catálogo. Luta não foi exercitada; FPS ~5 em renderização por software. ROM construída da árvore de trabalho do SGDKForge, que contém alterações locais de outros agentes (não comitadas), não de um commit. Overlay `rds/` e runs `out/tests/` ficam na raiz original (`rds/` não rastreado no SGDKForge; nada comitado lá).

Falhas cobertas por regressão Rust com wrapper falso: build recusado, recibo ausente com `out/rom.bin` antigo, SHA adulterado, asset desvinculado; não exercitadas no app real. Níveis: testes automatizados e execução nativa em display virtual sob driver; sem sessão de desktop, aceite humano ou hardware. Evidência privada: `RDS_WORK_ROOT/sessions/sgdk-native-c-20261027/`.

Gates: check:tree, lint, tsc, fmt, Clippy `-D warnings` PASS. `host:certify` **BLOCKED** só por `rex_resources::byor_preview_of_modified_artifact`: a referência BYOR `hamoopig-reference.bin` (diretório `RetroDevStudio-CANONICAL-2026-09-21`) não existe mais neste host; o teste falha igual sem as mudanças desta fatia. Restante: 1203 frontend/11 skip, 1075 Rust passados/102 ignorados. Restaurar a referência (ou `RDS_HAMOOPIG_ROM`) e recertificar.

Limites: o jogo é executado, não convertido; cenas, estados e transições do Studio não representam o motor C e não entram no build. Diagnósticos de cena do Studio (ex.: banner VRAM do overlay) ainda aparecem no modo C e não descrevem a ROM nativa. Windows sem integração do wrapper. Próximo: escopar diagnósticos ao build nativo, exercitar uma luta, aceite humano.

### Checkpoint 2026-10-27 — SGDK dividido: recursos recuperados, jogo original ainda não reconstruído

Código `79eee48addecfb9de052af21c9ad617dcab24b7f`, fixture de teste `ec23be8c`, sobre `f43292e4`; mesma branch/PR #112. Mugenesis_Demo (SGDK 2.11) importava apenas `res/resources.res`, contendo música, e omitia cinco manifests. O importador agora enumera todos e preserva arquivos homônimos de origens diferentes sob `sgdk-source` (43 grupos no doador), mantendo destinos antigos quando inequívocos. Regressão cobre dois personagens com PNGs homônimos/pixels diferentes, música no canônico, reimportação estável e `Resources.RES` sem inserção dupla.

Binário final **`0ad1b0d3594a33697f566bf99439477cdcd934bde336623abba9347a1625e3e2`** (420072768 bytes), build oficial `2026-10-27T17-21-32-339Z-1287491`; três fontes/testes/harness conferidos por SHA contra `79eee48a`. Construído em árvore suja, sem alegar build limpo/reprodutível. Prova Tauri via wizard: anterior `826e2553…` reproduziu **1 manifesto/1 recurso/0 sprites**; intermediário `a2d01551…` e final importaram **6 manifests/251 recursos/177 recursos de sprite**, cada cópia comparada por SHA à origem. Captura final inspecionada; editor exibe recursos e VRAM estimada 32/64 KB.

**O jogo ainda não foi reconstruído.** O importador coloca os 177 recursos de sprite como entidades simultâneas; Build & Run recusa o limite de 80. Há 174 conflitos de paleta e 24 cenas de recursos, não as cenas/estados originais do jogo. Zero FSMs/transições detectadas e 531 nodes heurísticos não comprovam o motor C de luta. Não houve execução de ROM reconstruída nem equivalência de gameplay. Tentativa integral de 300 s e repetição diagnóstica final de 30 s permanecem FAIL; o passo de integridade dos recursos é PASS. Não elevar limites, descartar recursos arbitrariamente ou substituir silenciosamente o teste pela ROM original.

Certificação final **READY** `2026-10-27T17-09-52-668Z-1247418`: sete gates, **1203 frontend/11 skip, 1072 Rust/102 ignored**, smokes oficiais SGDK/PVSnesLib; fmt e Clippy padrão incluindo binário PASS. Relatório preservado antes de outro launcher sobrescrever o diagnóstico compartilhado. Certificação intermediária `16-47-45-208Z-1155772` também passou. Tentativa `17-02-10-654Z-1217208` ficou BLOCKED por exceção `document is not defined` em timer HUD após teardown, apesar dos 1203 testes aprovados. DeliveryPanel e teste eram idênticos a `f43292e4`; corrigida só a fixture, que monta o campo após navegação, verifica foco real e conclui timers antes de desmontar. Primeira tentativa dirigida acusou timer adicional, preservada; final 7/7 PASS (`17-09-22-332Z-1245698`), depois suíte completa sem exceções. Navegação de produto e tratamento de exceções não foram afrouxados.

Evidência privada em `RDS_WORK_ROOT/sessions/sgdk-split-resources-20261027/`: before/after/final, fontes por hash, binários, certificações e recibos; projetos próprios retidos em `projects/before`, `projects/after`, `projects/final`, com mapa `project-retention.json`. Nenhuma escrita desta tarefa no SGDK original; os 403 arquivos de res/src/inc ficaram iguais durante o teste final. App/drivers/Xvfb próprios encerrados; sessão final `2026-10-27T17-24-52-815Z-1302223`. Lock inicial do operador preservado até ele fechar o app. Retenção até aceite e proteção privada independente; este runtime local não é backup fora do host. Assets, ROMs, capturas e projetos não entram no Git público.

Atalho existente **RetroDev Studio — Testar** atualizado para o binário final `0ad1b0d3…`, pelo mesmo launcher/runtime. SHA, permissão executável e `desktop-file-validate` conferidos; recibo `desktop-shortcut-update.json`. O novo binário foi exercitado na sessão Tauri própria; o atalho em si não foi reaberto nesta fatia. Sua descrição informa reconstrução integral pendente. A nota do atalho `826e2553…` abaixo é histórica.

Próxima fatia: preservar C e integrar build/teste original ao contrato existente, ou converter a lógica para cenas/nodes com escopo explícito; preferência enviada ao operador, ainda sem resposta nesta rodada. `legacy_sgdk_overlay` existe, mas a delegação atual exige Makefile na raiz do projeto, ausente no doador que usa wrapper SGDKForge. Nenhum desses caminhos está qualificado para este jogo. Experimental, aceite humano, Windows operacional e backup independente continuam pendentes. Commit/push/checks do fechamento devem ser conferidos no remoto; sem merge/release/deploy.

---

### Checkpoint 2026-10-27 — recuperação após interrupção validada localmente (Experimental)

Atalho local solicitado pelo operador: `RetroDev Studio — Testar`, arquivo `retrodev-studio-testar.desktop` na pasta retornada por `xdg-user-dir DESKTOP`. Executável/validado com `desktop-file-validate`, usa o launcher oficial, runtime externo e binário congelado `826e2553…`. Abertura pelo próprio `.desktop` conferida no desktop KDE/KWin (janela 1280×800), perfil normal do usuário; aplicativo deixado aberto para teste. Recibo na sessão `2026-10-27T16-20-55-177Z-1064804/desktop-shortcut.json`. Não constitui novo aceite humano nem nova certificação do produto; fontes de produto inalteradas.

Recuperação `108fd2d3`, ArtStudio `ba60d5e1` e instrumentos `79608626` publicados na mesma branch/PR #112 OPEN, sem merge/release/deploy. App final **`826e2553cfc6d20351acd6e7d3561b18dba043ecb7c4679d4ca7013dd9b56814`**, 419453528 bytes, build oficial `15-04-15-015Z-803464`. As sete fontes de produto coincidem com o commit; construção em árvore suja, sem alegação de build limpo/reprodutível. Índice existente `data/studio_grafico/ui-cohesion-20261027.json`, seção `draft_recovery_hardening`, liga requisitos/provas/hashes/falhas e proteção privada. Atlas completo LOT025 permanece corrigido, com regressão vinculada no índice MUGEN.

O rascunho v2 usa projeto/cena/revisão/base e o próprio scenePersistence, agora com confirmação nativa atômica/sincronizada/leitura no escritor existente. Migra legados sem apagar material inválido, recusa respostas/saves antigos e limpeza de outra revisão. Estados editor/confirmado/salvando/salvo/falha e decisões de conflito são explícitos. Restaurar/Undo/Redo mantém conteúdo pendente em memória; a cena só é gravada pelo save canônico com base comparada. ArtStudio deixa de substituir sheet explícita pela imagem antiga durante hidratação assíncrona. Sem dependência, banco/store/autosave/pipeline concorrente.

**13 sessões nativas finais PASS no mesmo app:** três partidas frias de recuperação (ledger final-2), cenário separado de falhas (19 passos/quatro SIGKILLs), qa-rc A–H (32 casos visuais/48 capturas) e oito regressões (ledger final-4): autoria até vitória/áudio, MUGEN completa 103 animações/417 ocorrências, E4, E2/E5, paletas, REX E6 delimitado, onboarding e SNES. Ao todo 13 interrupções completas próprias, com PID/starttime/subárvore WebKit, antes de cleanup/pagehide; duas cenas/dois projetos, Undo/Redo/save/reabrir, falha real de escrita/repetir, resposta real atrasada recusada, conflito externo com decisão, leitura/quota simuladas identificadas sem encher disco. Build/core/export usam a revisão recuperada; SHA de cada export conferido independentemente. Inspector salva em 600 ms; o harness cria pendência por edição/save/Undo nativos, sem editar JSON/storage externamente para simular sucesso.

**Certificação nova READY**, sessão `2026-10-27T15-46-50-018Z-950770`: sete gates, **1203 frontend PASS/11 skip; 1071 Rust PASS/102 ignored**, smokes oficiais SGDK/PVSnesLib. Clippy padrão incluindo binário, fmt, npm audit, licenças e cargo audit PASS; warnings transitivos aceitos e dois avisos preexistentes de teste Rust permanecem nos logs, sem novos ignores/exceções. Recibo completo copiado antes de outro launcher sobrescrever o diagnóstico compartilhado. Novos gates/documentação não requalificam Windows ou usabilidade humana.

Falhas preservadas: reprodução inicial 5 pass/4 fail; perda real de localStorage sob SIGKILL completo, corrigida por confirmação nativa; sheet ArtStudio 64×64 substituída por 32×32, corrigida por identidade/geração. Instrumentos antigos corrigidos com controles negativos (duas linhas da topbar, recortes visíveis, badge/Solo e mapa panorâmico); não foram afrouxadas margens, prazos ou integridade. Candidatos intermediários/ledgers com FAIL continuam preservados. Inicio autoral final teve page crash sem causa isolada; tentativa seguinte confirmou display ausente/GTK panic. Xvfb antigo terminou por SIGTERM de origem desconhecida; sem atribuição a OOM/produto. Display próprio recriado/qualificado por PID/starttime/socket, critérios/app/harness inalterados e oito regressões reexecutadas. Evidência raw, erratas e diário intermediário em `RDS_WORK_ROOT/sessions/draft-recovery-20261027`; tentativas originais não viraram PASS.

Nove entradas originais reconferidas por SHA. Pacote privado local **`draft-recovery-evidence-79608626.tar.zst`**, 514710214 bytes, SHA-256 `e41435059697de9fb69eb6ce2b2b5b63b792c3b0c1aacc23e1900f127eaed5ca`, 3163 arquivos verificados por leitura integral; manifestos/logs/recibos/capturas/projetos/rascunhos/binários retidos no destino privado existente. Mesmo filesystem, **backup independente fora do host não qualificado**. Não publicar dados/corpus nem apagar evidências para liberar espaço. Retenção: até aceite humano e verificação de cópia privada independente.

Limites: debounce de 2 s + confirmação de I/O; antes do recibo há risco de perda. Escrita atômica/CAS não é transação do projeto nem garantia contra todo corte de energia/escritor externo. MUGEN demonstrada continua autoral, não CNS integral; REX E6 não prova causalidade física comercial. **16 jornadas parciais; humano, Windows operacional e cópia independente pendentes**. Próximo: roteiro neutro já preparado no handoff, em cópia autoral controlada, e proteção privada independente pelo operador. Executar app congelado pelo launcher; não retomar pesquisas/motor universal nem promover maturidade. Checks de cada SHA publicado têm estado próprio; conferir PR #112 ao fechar/publicar.

---

### Checkpoint 2026-10-27 — atlas MUGEN e verticais principais validados localmente (Experimental)

Código publicado `1925716ae4210d87f73e7c092a10a63a70627a56`, mesma branch `codex/new-host-cohesion-20261024`/PR #112; CI e Desktop E2E desse SHA PASS. Binário final `35fe9ab21ab0383305de1aeac2ef6b0b48805f83b5b2543bfc3ae06f007fff41` (418656160 bytes), construído de árvore dirty e ligado ao commit por hashes das fontes. Índice `data/studio_grafico/mugen-atlas-20261027.json`: mapa requisito → implementação/owner → prova → resultado → limite, relatórios/capturas por hash, falhas e retificações. Índice anterior da UI e decisões arquiteturais preservados.

LOT025 foi reproduzido no app anterior: 177192960 pixels de grade preenchida para 11208960 pixels de ocorrências úteis. O adaptador SGDK existente agora divide o recurso por animação e inicializa uma tabela lógica estática, preservando índices, máximos residentes e paleta compartilhada; **guarda de 67108864 pixels mantida por página**, sem truncar quadros. Revisão MUGEN memoriza somente pixels compostos idênticos dentro da conversão; todas as ocorrências, transformações, proveniência e budgets continuam separados. Três testes Rust novos cobrem preservação, recusa acima da guarda e memoização sem fundir ocorrências/transformações. Não há store/importador/motor/dependência nova.

No mesmo binário final, série após reboot com **12 sessões desktop PASS**: três MUGEN completas consecutivas, três autorais e seis regressões (E4 modelo/instância; E2/E5 golpe/caixas/evento/som/texto/HUD; paletas/câmera/cenário/HUD; REX E6 delimitado; onboarding→Stop→revisar/verificar/exportar; SNES build/run). MUGEN seleciona todas as ações pela UI: 103 animações/417 ocorrências, 11208960 pixels de BMP comparados ao atlas convertido, paleta igual entre páginas, índices/contagens no ELF/ROM/RAM e maior página 1720320 pixels; máximos 114 tiles/15 sprites. Edição de duração de o3 pela UI, recusa de zero, desfazer/refazer, salvar/fechar/reabrir, efeito temporal no core, restauração byte-idêntica, inspeção exata/retorno e recusas stale passaram. Exportações finais independentes iguais aos próprios baselines: `094b8f14…`, `532cef39…`, `db3938f2…`; títulos de projetos diferentes permitem hashes diferentes entre corridas. Metadados iniciais em 498/488/479 ms; isto não é duração da análise/conversão completa.

Certificação `2026-10-27T09-22-41-547Z-2002991`: READY, sete gates PASS, frontend **1174/11 skip**, Rust **1070/0 falhas/102 ignored**, smokes SGDK/PVSnesLib oficiais; fmt e Clippy padrão incluindo binário adicionais PASS. Mesmas fontes/OS/lock antes do reboot; diagnóstico fresco posterior `10-54-29-594Z-66753` READY no mesmo fingerprint `60249508…` e lock `dd99a22f…`, sem apresentar diagnóstico como outra certificação. Falhas de permissão da fixture, display anterior, timeout inicial e pré-condição incorreta de hit-test ficam preservadas. Terceira tentativa da série anterior interrompida por suspensão confirmada (09:41:14Z→10:19:10Z), depois reboot; a série inteira foi reiniciada, sem relaxar critérios/prazos. Captura anterior do erro é histórica LOT025; reprodução fresca está no log, sem inventar screenshot novo desse erro. Capturas finais de exportação e Inspector em 125% conferidas.

Originais Ken (7 arquivos), snapshot LOT025 (35 arquivos), Sonic e referência BYOR Hamoopig reconferidos por SHA; três exportações finais também reconferidas ao encerrar. Relatórios, imagens, binários anterior/intermediário/final, logs/recibos e 11 projetos gerados preservados em pacote privado local `ui-mugen-evidence-1925716a.tar.zst`: **1287 arquivos/1418302875 bytes de entrada**, arquivo **291807298 bytes**, SHA `a22c1490e9b39f4bba966ad0289629a242964deb546f6fe5a2b1c74b114f7f97`, todos os bytes lidos do pacote comparados ao manifesto. Destino local identificado no handoff; é o mesmo filesystem, sem cópia independente/fora do host qualificada. Fontes/documentos/índice são proteção Git; ROMs/projetos/capturas/pacote não entram no repositório público. Serviços temporários próprios encerrados, zero app/driver restantes e inibidor de idle liberado; trabalho alheio preservado.

Limites: demonstração autoral explicitamente escolhida usa estados 0/20/21/200 e facing fixo, CNS original preservado como referência. Todas as animações na ROM não equivalem a todos os golpes originais jogáveis. Quantização original de 22 cores VDP para 15 slots aproxima 2707 pixels e continua avisada; a paginação não acrescenta alteração ao atlas convertido. Avisos de orçamento permanecem; sem certificação de toda transição/hardware físico. REX E6 não estabelece causalidade de física comercial; som comercial separado. As 16 jornadas seguem parciais, **aceite humano pendente** (roteiro neutro preparado), Windows sem requalificação operacional. Page: 20 referências Git com metadados, recuperação binária remota não qualificada; 23 ZIPs maiores continuam declarados não enviados/sem referências nesta Page, sem listagem exaustiva da Biblioteca. Push informou alertas Dependabot na branch padrão, não atribuídos ao lock desta PR; nenhuma auditoria nova de dependências alegada. Próximo: avaliação humana do binário final pelo roteiro do handoff, preservando limites/erratas e qualificando proteção privada fora deste disco. Sem merge/release/deploy ou promoção.

---

### Checkpoint 2026-10-27 — continuidade do anexo: atlas MUGEN em validação final (Experimental)

**Retomada 10:56 UTC após suspensão/reboot:** a segunda corrida completa PASS (`09-33-45-540Z-2059455`); a terceira FAIL na análise, com 2311976 ms transcorridos contra orçamento inalterado de 120000 ms. Journal confirma PrepareForSleep em 09:41:14Z e resume em 10:19:10Z, exatamente quando o timeout foi registrado; reboot seguinte em 10:21:43Z. Preservados ledger, falha e `suspend-erratum.json`, sem atribuir defeito isolado ao produto. Novo diagnóstico `10-54-29-594Z-66753` READY, mesmo fingerprint/lock; hash do app inalterado. Nenhum processo antigo vivo. Xvfb próprio reiniciado (sessão 75377); nova série de **três** corridas frias completas, depois três autorais e seis regressões, critérios/prazos/código intactos. Plano `planned-validation-after-reboot.json`, ledger `final-validation-after-reboot.json`, ferramenta 8897. Inibição temporária só de idle durante o processo de QA; não altera configuração global nem impede suspensão explícita. Próximo: acompanhar a série, preservar qualquer falha, completar índice/documentos/PR sem alegar o aceite pendente.

Base preservada `44c582bb`/PR #112, checkout único limpo na entrada. CI e Desktop E2E desse SHA confirmados verdes no GitHub; não houve merge. Diagnóstico fresco neste host BigLinux x64 retornou READY (fingerprint `60249508…`, lock `dd99a22f…`), plano do launcher conferido, jobs=1 e 233 GiB livres. Page privada lida: contexto JSON `8bcb48b5…` e manifestos acessíveis; 20 referências do bundle Git têm metadados presentes, mas recuperação binária remota continua não qualificada. Os 23 ZIPs maiores seguem declarados não enviados e sem referências nesta Page; não há listagem exaustiva da Biblioteca geral disponível. Dez documentos locais coincidem com o contexto remoto; AGENTS/handoff têm continuidade posterior publicada, preservada.

Jornada autoral fresca PASS no Tauri `73b69d84…` (sessão `2026-10-27T08-12-30-381Z-1686133`). Reprodução do snapshot LOT025: primeira tentativa recusou save de arquivos congelados 0444, preservando rascunho; errata e cópia privada byte-idêntica com escrita só do proprietário preparadas fora da fonte. Segunda tentativa (`2026-10-27T08-16-50-319Z-1711045`) chegou ao build e reproduziu a guarda de 64 MP. Entrada: 103 animações/417 ocorrências, células 160×168, linha máxima 64; retângulo 10240×17304 = 177192960 px, contra 11208960 px das ocorrências. Originais preservados; cadeia/hash e critérios congelados em `RDS_WORK_ROOT/sessions/mugen-atlas-20261027/`.

Implementação em andamento, ainda não certificada: `compiler/sgdk_emitter.rs` planeja páginas por animação quando o retângulo ultrapassa a guarda; inicializa tabela lógica estática preservando índices e máximos de residência. `compiler/build_orch.rs` usa as mesmas páginas e uma paleta compartilhada, mantendo a guarda por página. Dois testes dirigidos PASS: 417 ocorrências/pixels/paletas sem perdas e recusa de página individual >64 MP. Harness existente ganha `RDS_MUGEN_FULL_ACTIONS=1`, com seleção explícita de todas as ações pela UI, auditoria independente de BMPs/índices no ROM+RAM e exportação. Syntax check passou após correção de parêntese local; build debug em execução na sessão `2026-10-27T08-28-07-020Z-1768147`. Arquivos ainda não commitados. Próximo: aguardar esse build, fixar SHA do binário, executar build/run no snapshot e a vertical E1 completa; corrigir bloqueadores antes dos gates completos e três partidas frias finais. Nenhum claim de atlas resolvido, usabilidade humana, CNS geral ou promoção.

Atualização: o binário intermediário `72b781b1…` completou build/run do snapshot LOT025 (ROM 1179648 bytes, sessão `2026-10-27T08-32-02-171Z-1787449`). Na importação nova de todas as ações, uma tentativa não iniciou GTK após o Xvfb encerrar com SIGTERM (causa do encerramento não isolada); display reiniciado e verificado, falha preservada. A tentativa seguinte `2026-10-27T08-38-32-594Z-1822649` terminou por timeout de 120s após análise, antes do relatório de importação. Não é aceite do fluxo completo. `mugen_profile.rs` agora memoriza apenas pixels compostos idênticos dentro de cada conversão (célula/offset/flips), mantendo todas as ocorrências e guardas do relatório; teste semântico dirigido em execução. Próximo: concluir esse teste, reconstruir/fixar novo binário e repetir a vertical completa com os mesmos critérios. Sem processos de teste antigos vivos; Xvfb atual permanece próprio na sessão de ferramenta 13168.

Atualização 09:14 UTC: teste da revisão visual PASS (ocorrências/durações separadas, offsets/flips distintos); novo binário congelado `35fe9ab2…`. A execução `08-59-46-491Z-1913762` importou todas as ações dentro dos mesmos 120s, auditou 103 páginas/417 ocorrências/pixels/paleta/índices ROM+RAM, editou/desfez/refez/salvou/reabriu, mediu duração no core, restaurou bytes e inspecionou a ocorrência correta. Ainda **FAIL global**: uma pré-condição do harness rejeitou o alvo `inspect-message` antes do clique nativo subsequente. O alerta é filho não interativo da superfície; teste dirigido dos eventos originais confirmou propagação/abertura exata (10/10, sessão `09-10-44-727Z-1956690`). Falha e errata preservadas antes da repetição: harness aceita filhos não interativos da mesma superfície, mantendo coordenadas, clique nativo, recusas e resultados estritos; código do aplicativo não mudou. Corrigido também contexto do projeto importado no relatório de falha, que ainda indicava fixture padrão. Repetição integral em andamento `09-14-40-795Z-1969672`; exportação final, regressões e certificação continuam pendentes nesta rodada.

Atualização 09:22 UTC: primeira vertical completa PASS no mesmo `35fe9ab2…`, relatório `studio-e1-2026-10-27T09-14-43-984Z-report.json`. Auditou 11208960 pixels, 103 animações/417 ocorrências compiladas; maior página 1720320 px, máximos residentes 114 tiles/15 sprites. Cliques nativos em `inspect-message` também passaram no aplicativo original. Revisão/exportação pela UI e SHA independente iguais ao baseline testado `ca6f5388…1f0b6`; ROM 1179648 bytes. Toda a seleção de ações foi feita pela UI, com demonstração autoral explícita: não é conversão integral do CNS. A redução original de 22 cores VDP para 15 slots (2707 pixels aproximados) continua avisada pelo importador; a auditoria pixel a pixel compara as páginas ao atlas convertido, não promete cores SFF sem quantização. Certificação nova em andamento `09-22-41-547Z-2002991`; partidas frias/regras de regressão ainda pendentes.

Atualização 09:35 UTC: certificação nova `2026-10-27T09-22-41-547Z-2002991` **READY**, sete gates PASS, frontend **1174/11 skip**, Rust **1070/0 falhas/102 ignored**, smokes oficiais SGDK/PVSnesLib. Fmt via launcher `09-32-41-706Z-2054288` e Clippy padrão incluindo binário `09-32-52-398Z-2055185` PASS; sem alteração adicional de fonte. Relatório/log/recibo copiados para `sessions/mugen-atlas-20261027/certification/` antes de outro diagnóstico. Invocação direta de cargo pelo PATH global não encontrou executável; nenhum fmt foi executado por ela, launcher oficial resolveu o ambiente. Sequência congelada `planned-final-validation.json`: mais duas MUGEN completas (para três consecutivas), três autorais e E4/E2E5/paletas/E6/onboarding/SNES; executada sequencialmente, parando em qualquer falha. Ledger privado `final-validation-ledger.json`, sessão de ferramenta 86568; segunda MUGEN em andamento. Índice público `data/studio_grafico/mugen-atlas-20261027.json` ainda marca validação em andamento; requisitos/provas/limites definidos. Código ainda não commitado; sem promoção/merge/release.

Atualização 09:37 UTC: cinco arquivos de código/testes/harness revisados e publicados em `1925716ae4210d87f73e7c092a10a63a70627a56`, remoto da mesma branch conferido; PR #112 segue OPEN para a base de recuperação. Hashes dos cinco arquivos coincidem com o commit. Documentos/índice continuam locais em fechamento, sem claims finais de partidas frias ainda. O push informou seis alertas Dependabot na branch padrão do repositório (1 alto/5 moderados); isto não identifica o lock do head da PR. Nenhuma dependência mudou nem se declara auditoria nova de dependências nesta fatia. Segunda MUGEN completa já importada, seguindo build/edição/core/exportação no mesmo binário congelado.

---

### Checkpoint 2026-10-27 — coesão da UI principal validada localmente (Experimental)

Código `d32337142dcde6deb6d1a6d4232c014ed7f56963`, base `a2e4d58a`, branch `codex/new-host-cohesion-20261024`/PR #112. Binário final `73b69d84fd1db9045f86c7336905722a011d21c3a5083c27cd03222f5c0702c4` (417754784 bytes), construído da árvore ainda não commitada; os 33 arquivos de código/testes/harness foram conferidos por SHA contra o commit. Índice curado: `data/studio_grafico/ui-cohesion-20261027.json`. Fontes, SDKs e caches reutilizados na raiz única, um job pesado por vez; nenhuma dependência, store ou pipeline concorrente.

Shell com áreas nomeadas e Salvar/Testar/Revisar visíveis, modos de exibição recolhidos, wizard com nome/pasta/console antes dos modelos, diálogos com foco/Escape e ferramentas do canvas por aprofundamento. Inspector usa largura completa para alcance da edição e controles que quebram linha; captura em 1366×768/125% revelou e motivou a correção, depois confirmada nas três corridas finais (largura relativa 0,877). Seleção de ocorrência limpa mensagem/drafts antigos do Personagem.

Sessão de projeto/cena/destino invalida respostas antigas; saves serializados preservam rascunhos novos; build usa a revisão efetivamente salva e não executa revisão ultrapassada. Recibo de quadro real do build sobrevive a Stop. Entrega invalida mastering por contexto/artefato, exige SHA verificado/exportado igual ao build e expõe falha de auditoria com tentativa novamente. Plano de paletas isola respostas/propostas antigas. Triagem MUGEN lista metadados antes da conversão; a análise integral continua obrigatória para liberar e efetivar importação.

No **mesmo binário final**, três corridas frias autorais e três MUGEN E1/E3 consecutivas PASS; metadados em 502/480/503 ms. Mais seis sessões PASS: modelo/instância E4; golpe/caixas/som/HUD E2/E5; paletas/câmera/cenário/HUD; REX E6; onboarding→build/run→Stop→verificar→exportar com SHA/bytes idênticos e retorno de foco; build/run SNES. Autorais incluem editar, salvar, destruir janela, reabrir e jogar pelo teclado até vitória com som associado. MUGEN usa ações 0/20/21/200, ken1.act e demonstração autoral, com efeito temporal medido em quadros, restauração de bytes e recusas de conteúdo stale. E6 prova cópia/IPS por aplicação independente, original íntegro, execução e reversão; não isola causalidade de física no gameplay comercial.

Certificação `2026-10-27T03-56-46-001Z-1128073`: READY, sete gates, **1174 frontend/11 skip**, **1067 Rust/0 falhas/102 ignored**, smokes oficiais SGDK/PVSnesLib. Fmt e Clippy padrão (incluindo binário) adicionais PASS; build debug PASS. Dois warnings antigos de teste Rust preservados. O log/recibo da certificação foi copiado: diagnósticos posteriores do launcher sobrescrevem o JSON compartilhado e removem sua lista de gates; esse diagnóstico não substitui o recibo de execução.

Falha intermediária da certificação anterior preservada (1066 Rust pass/1 fail/102 ignored): diagnóstico BYOR lia a referência por caminho antigo, embora o artefato modificado já estivesse restaurado. Correção **somente de teste** usa o resolvedor existente `RDS_HAMOOPIG_ROM`, confere SHA e exige pixels distintos/prévia idêntica ao artefato; reteste dirigido e suíte completa PASS, sem desativar gate ou acrescentar ignore. Falha inicial de fmt e correções do instrumento também constam no índice e nos recibos. Nenhum código de produto foi editado durante o estado BLOCKED.

QA automatizado em Tauri/WebKitWebDriver/Xvfb (ações nativas e DOM/observações do harness existente), **sem participante humano**. Projetos, binários, capturas e logs preservados nos destinos oficiais externos/ignorados; corpora BYOR originais reconferidos por SHA ao final. Serviços temporários próprios encerrados. Não há promoção do produto nem entrega geral das 16 jornadas: atlas completo LOT025 e conversão geral de CNS, aceite humano, Windows e superfícies avançadas permanecem pendentes/Experimental. Próximo: abrir o app pelo launcher para avaliação humana da UI; continuar o diagnóstico delimitado do atlas LOT025 conforme o handoff existente, sem elevar guardas ou iniciar outro motor. Sem merge/release/deploy.

---

### Checkpoint 2026-10-24 — novo host e continuidade da coesão do produto

Preparação em `codex/new-host-cohesion-20261024`, sobre recuperação pública `95d5ef23`; PR dirigida à branch de recuperação, sem merge/release/promoção. Entrada: `docs/handoffs/NOVO_HOST_INICIO.md`. Launchers `scripts/new-host.sh`/`.ps1` funcionam como nível zero; `new-host.mjs` coordena sessões e delega instalação ao bootstrap/host-manager existente. Node/npm/Rust continuam fixados; cache e Cargo target por lock, jobs limitados, temporários não ocultos e recibos separados, sem alterar HOME/perfil global ou baixar BYOR. A falta de espaço bloqueia sem limpeza destrutiva.

Diagnóstico de jornada consolidado por referência à reavaliação, pareceres A/B/C, coverage e adendos. As 16 jornadas seguem parciais e sem estudo humano; LOT028 teve build/run/export. Próxima missão continua sendo `PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`, uma frente sequencial que entrega verticais autoral/MUGEN e coerência de contexto/revisões. Não iniciar outra pesquisa de decompilação universal; som comercial continua separado.

Na preparação, o npm global deste host era Node26/npm12, enquanto o launcher ativou o pin Node24/npm11. Audit da base encontrou seis pacotes afetados (duas severidades altas); manutenção limitada a Vite6.4.5, Vitest4.1.12 e Undici7.30.1, sem major/dependência nova ou exceção. Detalhes e estado real dos gates em `docs/handoffs/VALIDACAO_NOVO_HOST_2026-10-24.md`. Não confundir teste neste host já provisionado com instalação limpa em outro OS; Windows requer prova operacional própria. A necessidade de backup privado sobrevivente antes da formatação continua; GitHub não contém projetos/capturas/contexto privado completos.


Resultados medidos nesta preparação: host:certify READY (7 gates), suíte frontend final: 1164 aprovados/3 skips; Rust: 1066 aprovados/102 ignorados; suíte dirigida: 58/58, cinco crates, fmt/clippy, smokes SGDK/PVSnesLib, bundle frontend e reentrada offline do instalador aprovados no host existente. npm audit zero vulnerabilidades; cargo-audit rc0 com 12 warnings permitidos, sem exceção nova. Windows: parser/plano sem Node executados em Linux, instalação operacional não demonstrada. Portable novo e jornadas GUI/humana não executados. Resumo curado/hash da fonte final em data/development_host_20261024/validation.json.
---

### Checkpoint 2026-10-24 — retomada orientada à coesão das jornadas

Reavaliação documental/de código com inspeção de capturas históricas; sem nova execução GUI, suite de testes ou certificação. Base pública anterior 87b6b7fd; código runtime continua igual a a8550af0. Plano operacional em docs/handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md e fundamentação em REAVALIACAO_PRODUTO_2026-10-24.md, no mesmo diretório. A fonte operacional de estado continua neste Memory Bank/Current Wave; os dois handoffs são plano e evidência de avaliação.

Retificação do resumo de migração de 2026-10-21: a auditoria avançou além dos primeiros lotes. LOT028 registra edição, salvar/reabrir, Build & Run, verificação e exportação byte-idêntica; LOT031 acrescenta execução/Stop e deslocamento compatível com Right, sem isolar causalidade por evento/frame ou keyup. Não repetir que nenhuma ROM foi compilada/executada na auditoria. As 16 jornadas de coverage.csv continuam parciais e não houve aceite humano de usabilidade.

Prioridade: uma frente sequencial de integração do produto, reaproveitando editorStore/studioContext/runtimeLink/plano de paletas e serviços canônicos. E0 reconciliar/reproduzir; E1 contexto/revisões/save-build-run-review; E2 vertical autoral; E3 MUGEN real; E4 navegação e edição compartilhadas; E5 regressão REX delimitada; E6 certificação técnica e preparação/execução humana quando houver participante. Não abrir novo motor universal, importador, plataforma ou megastore paralelo nesta missão.

Casos prioritários: Review mostra “ainda não executado” após emulação; LOT025 tem dois builds bloqueados pelo atlas de 177192960 px, com teto de 67108864; LOT029/030 têm guards MUGEN, alguns anteriores à edição observada. Não elevar o teto, perder frames ou imputar causa ao hardware/último clique sem investigação. UI dirty após Undo, antes de Salvar, não caracteriza corrupção por si só. A tabela antiga de requisitos deve ser lida com o adendo da rodada 4; não reabrir o antigo defeito PAL0 como fato atual sem reprodução.

Preservados contratos, lotes, pins e erratas. Os hashes atuais de coverage, ACHADOS, HANDOFF_PROXIMO_AGENTE, BACKLOG_PROPOSTO e SESSION coincidiram com o backup privado project-data-v4. Pendência sonora e limites de generalidade permanecem separados. Experimental mantido; nenhum merge, release, promoção ou mudança de fonte runtime.

---

### Checkpoint 2026-10-19 UTC (rodada 4) — Studio Gráfico: paletas planejadas no build e composição personagem + cenário + HUD (Experimental)

## 2026-10-21 — continuidade para reinstalação do host

A branch pública `recovery/studio-preformat-20261021` preserva o código runtime do Studio local `a8550af0e0bdd74c44478f94d301576b988747a1`, com igualdade de árvores em `src/`, `src-tauri/`, `crates/` e `scripts/`. O primeiro snapshot é `50ad8e20`; o HEAD de recuperação inclui este checkpoint documental. Não houve merge, release ou promoção; Experimental mantido. A branch `main` não representa essa ponta local.

Entrada de retomada: `docs/handoffs/PREFORMAT-CONTINUITY-2026-10-21.md`. O histórico original completo, overlays locais, projetos, evidências binárias e contexto de agentes estão no backup privado preformat, com relatórios por arquivo. O laboratório REA `ee8c581f`, a frente comercial `40a17169` e a integração `03ddc59d` continuam separadamente recuperáveis no bundle; não presumir que esta branch integra todas as pesquisas. O snapshot público omite 80 evidências binárias novas, identificadas no manifesto do handoff, mantendo código e fixtures autorais necessárias. Não dar push do bundle bruto ao repositório público.

Os relatos textuais da auditoria de jornada estão em `docs/studio_grafico/auditoria_20261020/`; galeria de 61 cartões, capturas e logs completos continuam privados. As 16 jornadas foram parciais/bloqueadas, sem aceite humano completo nem aceite Build → ROM → Emulação nessa auditoria. Priorizar a recuperação do host e o fechamento das jornadas/fricções registradas. Preservar erratas e limites dos revisores. Pendência sonora separada; decompilação universal não demonstrada.

Coleções de ROMs ficam sob backup manual do operador e não foram removidas. A limpeza liberou espaço removendo apenas intermediários Cargo regeneráveis; fontes, trabalho local, evidências de validação, ferramentas instaladas e binário 016 foram preservados. O bundle foi restaurado em diretório independente; houve também clone novo do snapshot público e verificação da igualdade da fonte. Isso não é certificação do sistema reinstalado: executar bootstrap, diagnose, gates e certify de novo no novo OS.

A proteção final depende do destino sobrevivente confirmado pelo operador e do estado VERIFIED dos relatórios privados. O contexto da sessão ativa é um prefixo datado, complementado pelo handoff. Não declarar a formatação liberada com base apenas no censo ou em arquivos com estado WRITING/FAILED.

---


Produção `ae0d66cd`, binário 016 `d3777958…b782b8`. Plano determinístico de paletas no build/editor/inspeção, troca por golpe, importação de cenário pela UI. `cert4-nodegraph` FAIL preservado (janela de 2,5 s perdia o salto em host lento; Adendo I), `r4i-nodegraph-001` PASS só com mudança no harness; `studio-paletas` PASS (cert4 + r4i); `host:certify` tentativa 1 interrompida, tentativa 2 READY (7 gates, 1145 frontend, 1066 Rust/102 IGNORE), fmt OK. Manifesto `data/studio_grafico/final-manifest-r4.json`. Atalho local de teste e projeto de demonstração criados (não é release). Reserva/renomear/remapeamento não exercitados; validação humana pendente. Sem push/release/promoção.

### Checkpoint 2026-10-19 UTC (rodada 3) — Studio Gráfico: identidade no mesmo caminho e HUD ancorado com câmera (Experimental)

Checkpoint anterior preservado (`cce18a00`). `checkRuntimeNavigation` confere sempre o SHA do conteúdo atual (lido no clique); HUD usa o plano WINDOW com câmera de mundo. Binário 014 `5f4c815a…`: cert3-e1e3 (com E3c) e cert3-e2e5 PASS; studio-hud-camera: 6 falhas preservadas (harness/medição) e r7 PASS, controle negativo no 013 falha como esperado; `host:certify` READY. Defeito aberto: tilemap em projeto MUGEN usa PAL0 fixo e estraga as cores do personagem/fonte. Manifesto `data/studio_grafico/final-manifest-r3.json`. Validação humana: sessão preparada, não executada. Sem push/release/promoção.

### Checkpoint 2026-10-19 UTC (rodada 2) — Studio Gráfico Integrado: lacunas técnicas da revisão fechadas (Experimental)

Mesmo branch/worktree. Vínculo com identidade de conteúdo (troca de asset/imagem com mesmos IDs agora é recusada); caixas editáveis por ocorrência com efeito acerto/sem acerto na ROM; tiles/colisão interpolados e câmera de mundo funcional; camadas Colisões/Áudio na inspeção; auditoria/renomear/aplicar ao modelo/reverter com cópia em `.rds/backups`; E6 completo (editar perfil → cópia+IPS → jogar → voltar à original); teclado em campos não vai mais ao joypad. Binário final 013 `cf928038…`: 9/9 jornadas `cert2-*` PASS em corrida única + `cert2-mugen-real-oracle` (entrada do oráculo; projeto mantido); `host:certify` tentativa 1 FALHOU no gate frontend sem causa atribuída, tentativa 2 READY (ambas preservadas). Manifesto `data/studio_grafico/final-manifest-r2.json` (verificável). Abertos: HUD rola com a câmera, efeito de jogabilidade do campo E6 (herdado), leitor de tela, facing, PAL; validação humana pendente. Sem push/release/promoção.

### Checkpoint 2026-10-19 UTC — Studio Gráfico Integrado S0–S6: fatia integrada demonstrada (Experimental)

Branch `codex/rex-studio-grafico-20261019` (worktree `REX-STUDIO-GRAFICO-2026-10-19`, base `40a17169`). Contexto compartilhado com retorno/câmera/desfazer; editor Personagem por ocorrência (Ken real, `occurrence_ids`, eventos de som); golpe autoral por Clsn1×Clsn2; texto de interface ligado à vida; vínculo `retrodev.runtime_link/v1` + Inspecionar; ajustes temporários de teste; revisão navegável + exportação; ponte para perfis REX comprovados. Binário final `6e87ba14…`: jornadas E1/E3, E2/E5, E4, E6 PASS; `mugen-real` (+oráculo Pillow) e `mugen-import` PASS; `nodegraph-authoring` falha preexistente reproduzida no baseline, retentativa PASS; `host:certify` READY. Estado, falhas preservadas, mapa REQ e próximos passos: `docs/studio_grafico/MISSION.md`, `REQUIREMENTS_MAP.md`, `data/studio_grafico/final-manifest.json`. Validação humana pendente; sem push/release/promoção.

### Auditoria de conclusão 2026-10-19 UTC — M0–M5 conferidos contra o pedido reapresentado

Sobre eb2ee726, a implementação e o binário66cb3d71…c12e5 permanecem idênticos aos gates/jornadas finais. Auditoria adicional reavaliou42grupos de requisitos e os artefatos efetivos:287pins,12IPS,22capturas e quatro traces368295eventos; expectativas comerciais regeneradas sem entrada de captura modificada. Reanálise dos mesmos dados, não novas corridas/cobertura ou promoção. Índice consolidado304registros em `data/rex_profiles/commercial_recovery_20261016/completion-experiment-index.json`, mapa/evidência em `COMPLETION-AUDIT.json`, reprodução e falha001do auditor preservada no adendo de `MISSION.md`. A lacuna documental do índice inicial restrito aoM0 foi corrigida com navegação derivada, sem segunda fonte de estado ou resultados inventados. Hostdiagnose novoREADY; certificado final7gates/1049frontend/1038Rust e seis jornadas permanecem aplicáveis à produção inalterada. Limites Experimental, sessões MAME/GX separadas, causalidade gráfica condicional, transferência GoldenAxe de memória, quatro reservados somente estáticos e somOPEN continuam intactos.

### Checkpoint 2026-10-19 UTC — recuperação comercial M0–M5 demonstrada nos domínios delimitados (Experimental)

Na branch isolada `codex/rex-commercial-recovery-20261016`, derivada da integração03ddc59d, a retomada reconciliou df688146 sem alterar integração/pesquisa. M0–M4 preservam os aceites delimitados e evidências anteriores; a cadeia comercial Enigma→buffer→cópia→layout/descritor/SAT→DMA→pixels e sua edição/reversão foram reexecutadas na UI final. M4 usa reconstrução semântica tipada do corpo, MOVE+postincrement+DBRA, condições/estado/origem/desconhecidos nos nodes; edição de largura muda opcode, além de constantes. Não é compilador de topologia geral.

M5: segunda implementação contígua GoldenAxe (inicializadores/um DBRA, diferente da grade aninhada Sonic) passou140/140ida e138/138volta na UI nativa. Cópia5725630a…09f18/IPS independente, um byte2AA2, span432bytes com162posições discriminantes; reversão restaura SHA75613dde…5df4b. Consumo/estado original e editado observados no MAME externo, com controles qualificados; sessão GX/UI distinta demonstra efeito de memória. Vídeo inalterado nesse episódio; não há alegação de efeito visual editado ou engine completa. Quatro alvos reservados passaram reconstrução/publicação/IPS com zero código REX e zero perfil adicional após freeze; não houve chamada nos episódios congelados desses quatro. Métrica estática/publicação não vira consumo comercial.

Duas falhas nativas do primeiro alvo preservadas: cabeçalho legado e canvas fixo320×224 contra frame256×192. Adendos anteriores a novas medições autorizaram correções genéricas sem dependência/core/tolerância novos. Fonte final18f9ab59, freeze1351b0b, nativo7a03e81c; binárioSHA66cb3d71ea4f5df2efd37b031fe0c4c76b822b11d55d55ca240024638c7c12e5. No mesmo binário: Sonic135/135ida+128/128volta; autoralv2 88/88ida+88/88volta,162bytes/3309pixels/RGBA0. Provas autorais/comerciais e referências condicionais medidas permanecem separadas.

Certificação final `certify-20261019T012630Z` READY: sete gates exit0,1049frontend/3SKIP e1038Rust/94IGNORE; Clippy padrão-Dwarnings e fmt também exit0. Skips/ignores não são PASS; números herdados não contam como execuções novas. Integridade dos16links M2/M3/M4, quatro traces privados e quatro fontes REX congeladas conferida; auditoria histórica bruta exit1 preservada e reconciliada como quatro fontes avançadas citadas duas vezes, sem artefato ausente. Dois JSON não rastreados preexistentes preservados por hash e backup pequeno verificado.

Limites: entrada Sonic assistida e regiões declaradas; geometria/câmera/animação/paleta medidas, sem previsão de física/cena inteira; MAME e GX não são uma sessão; Nemesis sem entrada/chamador traçados; sem validação humana de usabilidade, recuperação universal, outros consoles ou certificação Windows. V1FAIL86/89, BYOR1/2 anteriores, falhas de protocolo/instrumento e pendência sonoraOPEN mantidos. Sem bloqueio restante dentro dos domínios aceitos, sem push/merge remoto/release/promoção. Custo M5 primeiro alvo:418adições/22remoções de produção em7fontes, excluindo testes; configuração/instrumentação/testes separados.

Inventário, matriz requisito→implementação→teste→resultado→limite, índice e comandos em `docs/rex_profiles/commercial_recovery_20261016/MISSION.md`; aceites M2/M3/M4/M5 e manifesto final em `data/rex_profiles/commercial_recovery_20261016/`. Primeira retomada reproduzível: `rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/prepare-native-reproduction.py data/rex_profiles/commercial_recovery_20261016/m5-ui-golden-axe-journey-v3.json data/rex_profiles/commercial_recovery_20261016/m5-ui-golden-axe-freeze-v3.json m3-native-REPLAY-golden-001` — valida pins, cria só caminhos novos e imprime o comando exato; usar ID inédito.

### Checkpoint 2026-10-18 UTC — M5 candidato genérico congelado; validação final pendente

M0–M4 mantêm os aceites delimitados e falhas históricos. M5 encontrou cópias contíguas MOVE.B/W/L + DBRA único com LEA absolute-short/long/PC-relative e MOVEQ/MOVE.W, diferentes do loop aninhado primário. Primeiro alvo Golden Axe: chamada real observada,432bytes, D/A completos e SR previstos, seis negativos recusados; uma leitura ROM não-transferência explicitamente separada em adendo após falha original preservada. Batman/MUSHA não atingiram regiões no episódio congelado; ToyStory atingiu duas vezes mas verificador ainda recusa leituras de código sobrepostas à janela de fonte. Não são PASS de estado nem bloqueios funcionais dos jogos.

Extensão genérica do mesmo CopyGrid/ponte/publicador, sem despacho por título/hash, atribuída ao primeiro alvo Golden Axe; perfil genérico revisão2, domínio discreto1,2,4 para cópia contígua e contrato anterior1,2 para grade. Sete testes Rust PASS/0IGNORE incluem quatro regiões comerciais, reconstrução tipada original/editada e publicação; aplicador IPS independente exato nas quatro. Quarenta testes frontend da ponte PASS. Primeira tentativa de publicação falhou ENOSPC no TMPDIR da sessão (/run/user/1000 cheio); repetição usa scratch privado em disco, sem apagar arquivos alheios. Não contar sete testes como jornada UI nem como três transferências zero-código.

Freeze de produção e custos sem testes em m5-generic-adaptation-freeze.json; quatro ROMs reservadas até esse freeze. Próximo: sondar reservados sem alterar produção, congelar correspondência GX original/efeito de memória para Golden Axe, construir app final e executar UI/ida+volta afetadas e host:certify. M5 e missão permanecem em andamento; Experimental, sem push. ROMs/dumps/capturas apenas scratch privado.

### Checkpoint 2026-10-18 UTC — M4 consolidado no domínio comercial; M5 a selecionar

IR CopyGrid existente regenerou30bytes sem cache de origem: original-rebuilt igual à ROM inteira c7da53a1…81ebb; edited-rebuilt igual à cópia UI cb471c95…ad97a. Cinco testes Rust PASS/0IGNORE, incluindo BYOR normalmente ignorado, com recusas de operador/fluxo/mapa/alias. MAME editado no observerv3 byte-idêntico observou4096MOVE.W/8192bytes; destino4a51997c…6e8e4, A0FF6000/A1FF4020, D1/D2FFFF e D0 preservado; SR2300 previsto/observado (original2304). Seis negativos de trace recusados. Hipótese inicial de papéis D0/D1 preservada, corrigida antes do trace editado e discriminada por quatro vetores de sentinela/CCR.

Jornada nativa M4 passou135/135, incluindo sete checks dos detalhes de nodes: operações/contadores DBRA/FFFF, estado/pointers, origem e desconhecidos, com edição de opcode e efeito comercial pela ponte canônica. Sem novo código de produção/classe/core. M3 permanece128/128ida+volta; último certifyREADY1047frontend/1036Rust em fontes de produção idênticas. Estados externos não viram badge estático do app. Demais registradores/stack/IRQs/ciclos/áudio não comparados; referência visual condicional explicitamente medida, não física prevista. Mapa em m4-bounded-acceptance.json. Próximo: proteger checkpoint e congelar seleção/expectativas M5 para implementação diferente, sem contar Kosinski compartilhado. Experimental; missão em andamento, sem push.

### Checkpoint 2026-10-18 UTC — M3 consolidado no escopo condicional; M4 congelado

M3 PASS128/128 ida+128/128volta no SHA22dc259a…5347, com prévia anterior à edição, persistência/fechar/reabrir/cópia/IPS/execução/comparação/reversão exata. Certify020824Z terminou READY:1047frontend/3SKIP,1036Rust/93IGNORE, sete gates exit0. Escopo e mapa requisito→teste→limite em m3-bounded-acceptance.json; referência condicional medida explicitamente, não previsão de física/cena inteira. Falhas001 e003, etapas110/110 e históricoM2/v1/BYOR/som permanecem visíveis.

M4 congelado antes da execução externa editada em m4-freeze-v2.json: usar IR CopyGrid existente, reconstrução sem bytes salvos, condição DBRA e estado delimitado. Contadores reais D1/D2, D0 preservado; hipótese inicial D0/D1 errada é preservada e substituída após sentinelas distintas. Original002 passou4096leituras/escritas, memória e registradores observados/CCR, quatro vetores sintéticos do verificador; não é holdout nem qualificação CPU autoral. Próximo: cinco testes de reconstrução/recusas incluindo BYOR ignorado, depois MAME editado com observerv3 idêntico e jornada de detalhes dos nodes; um job pesado por vez. M5 pendente. Sem alteração adicional de produção; Experimental, sem push.

### Checkpoint 2026-10-18 UTC — M3 cadeia comercial na UI: 128/128 ida e 128/128 volta; cert final pendente

No app22dc259a…5347, prévia comercial antes da edição → Stop → nodes/edição MOVE.B↔MOVE.W → Salvar → encerrar/reabrir → cópia/IPS → episódio preparado → comparação → reversão passaram. Cópia cb471c95…ad97a, um byte1B6F8, IPS independente exato; retorno restaura ROM SHA c7da53a1…81ebb e RGBA13723a0e…ae5f1. Originais intactos; stream Enigma adulterado, região adulterada, ROM errada, domínio3/no-op, patch divergente, resultado antigo, cor errada e largura antiga recusados. Resposta atrasada de outro contexto é controle da suíte do componente, separado do controle E2E de resultado antigo. 10534pixels originais/8067editados,2008posições condicionais discriminantes, RGB0 e core/canvas exatos. Trajetória/câmera/coordenadas/animação/paleta são entradas observadas; sem alegar física/cena inteira prevista. Expectativa não recebe captura modificada.

Falha003124/126 preservada: header sob toolbar; Stop+Enquadrar+hit-test real antes de Delete passaram sem relaxar guardas. Corridas anteriores110/110 preservadas como etapa anterior. Certificação da árvore QA final pendente, depois proteger fechamentoM3; M4/M5 pendentes. Experimental; sem push/release/promoção. Processos das jornadas encerrados, zero vivos.

### Checkpoint 2026-10-18 UTC — M3 ida/volta comerciais aprovadas; complemento de sequência pendente

No app22dc259a…5347, ida110/110 e volta110/110 passaram no cenário canônico. Cópia cb471c95…ad97a difere só em1B6F8, IPS independente exato; reversão restaura SHA c7da53a1…81ebb. Persistência, fechar/reabrir, republicação, original/original, no-op, ROM/região errada, domínio3, patch divergente e resultado antigo passaram. Original10534pixels, editada8067pixels e2008posições condicionais que rejeitam width1: RGB0, core/canvas exato, destino12224 e SAT independente conferem. Referência não usa captura modificada; controles de geometria/estado são explicitamente medidos. Falha001 de envelope de recusa preservada, adendo002 corrigiu apenas QA. Nenhuma alegação de trajetória completa/hardware.

M3 ainda receberá complemento explícito de prévia comercial ANTES da edição na mesma sessão e controle de stream Enigma adulterado. As corridas110/110 ficam preservadas; sem mudança de oráculo/tolerância. Depois, nova certificação da instrumentação QA e checkpoint protegido. M4/M5 pendentes; missão em andamento, Experimental.

### Checkpoint 2026-10-18 UTC — M3: referências originais GX qualificadas antes da edição

M2 fechado no domínio declarado em d9d0dc54; ref m2-closed/bundle004 verificado, metadados protection-mission-004.json. M3 continua em preparação: nenhuma cópia comercial executada. Survey GX original encontra cópia concluída no quadro137; framebuffer180 repete referência exata. Cauda4096bytes é bcb49f12…92064, não zerada, igual em todas as fronteiras amostradas e ao MAME. Isso não prova estabilidade intraquadro.

GX autoral qualificado separadamente: antesDMA atraso0, depoisDMA atraso1;1024pixels por quadro e13quadros reservados por caso exatos. Primeira hipótese255 incorreta FAIL preservada; adendo usa conversão GX239 já qualificada, não captura. Modelo independente de descritores/SAT passou cinco quadros originais176–180:10245/10317/10390/10461/10534pixels, RGB0, tiles e cores errados recusados. Coordenadas/câmera/frame e bits de seletor de paleta0x6000 são entradas medidas explícitas; ponteiro/tile/flip/prioridade pinados. Hipótese inicial de base inteira imutável reprovou e permanece preservada. Modelo não prevê trajetória/física nem cena completa. Próximo: preparar jornada comercial no runner canônico, congelar cópia/reversão e predição causal independente antes de executar a primeira edição. M4/M5 pendentes; Experimental, sem push.

### Checkpoint 2026-10-18 UTC — M2 consolidado no domínio observado; M3 em preparação

Qualificação autoral de fase IRQ/DMA:1024pixels exatos, quatro quadros de treino e treze reservados; fase errada e identidade errada recusadas. Adendo anterior à medição comercial002:8482pixels reais conferem com tolerânciaRGB0;48pixels encobertos excluídos por domínio. Os16sprites projetados têm vínculo layout→lookup→descritor→SAT→DMA,715escritas verificadas e cinco negativos recusados. FF4000 é buffer descomprimido antes da cópia e tabela reutilizada depois. Falha visual001 permanece FAIL6912/8217; não foi apagada nem reclassificada.

Certificação pós-fase certify-20261018T012359Z READY:1047frontend/3SKIP,1036Rust/93IGNORE, sete gates exit0. App22dc259a…5347 mantém jornadas34/34 e regressões autorais88/88ida+volta; fmt/clippy padrão/lint passaram. Cadeia original assistida observada no MAME, com correspondência GX restrita à fronteira inicial da cópia; não são a mesma sessão. Nemesis não teve entrada/chamador traçados. Projeção usa estado observado e não é oráculo contrafactual da edição. Aceite e mapa requisito→teste→limite: data/rex_profiles/commercial_recovery_20261016/m2-bounded-acceptance.json.

M3 inicia pela preparação original-only de referências GX antes de editar, incluindo fonte8192bytes não presumida zerada e instante inicial da cópia. M3–M5 ainda não demonstrados. Experimental; sem push/release/promoção. Missão em andamento; histórico de falhas, BYOR e somOPEN preservado em MISSION.md.

### Checkpoint 2026-10-17 — M2: DMA qualificado; projeção visual reprovada, fase ainda aberta

V3 autoral passou4controles+3capturas+4DMA. Comercialv3 preservou Enigma/cópia;17registros SAT conferem. Análise DMA002 passou67SAT+67paletas, destinos finais exatos e arte249tiles pinada emVRAM;001FAIL do controle negativo preservado. Origem ampliada NÃO tem cauda zerada. Witness visual001 FAIL6912/8217: falta qualificar fase CPU/VDP/imagem com sinal autoral, sem escolher captura por melhor coincidência. M2 aberto;M3–M5 não iniciados.

Produto permanece no SHA22dc259a…5347: replay pausado34/34 e regressões autorais88/88ida+volta, cert anteriorREADY1047frontend/1036Rust. Clippy padrão e lint final passaram. Novo certify após DMA adiado pelo preflight de RAM/swap, sem iniciar job pesado. Experimental; sem push/release/promoção. Detalhes/falhas/adendos: `docs/rex_profiles/commercial_recovery_20261016/MISSION.md` e `data/rex_profiles/commercial_recovery_20261016/`.

### Checkpoint 2026-10-17 — M2: replay pausado corrigido e verificado; DMA em qualificação

MAME v2 qualificou a captura do alvo apresentado após duas hipóteses de superfície reprovadas e preservadas. O episódio comercial v2 produziu capturas reais e vinte amostras de cabeças do laço de sprites. O replay GX preparado preserva a fronteira inicial de cópia; igualdade com RAM final do MAME reprovou e permanece registrada, sem alegação de sessão única.

A primeira jornada nativa no app74033134…670e passou replay/framebuffer/RAM, mas falhou na apresentação do canvas pausado. Correção genérica integrada, com regressões verificadas: assinatura passiva de frames e guardas de ROM/época/ordem; sem avanço artificial, nova dependência ou mudança do core. Testes específicos frontend8/8 e TypeScript passaram. Certificação anterior READY (1045frontend/1036Rust) antecede a correção; nova certificação terminou READY:1047frontend/1036Rust,3SKIP/93IGNORE; todos os sete gates passaram. Build canônico passou; binário22dc259a…5347. Jornada de replay pausado passou34/34, incluindo duas épocas/180frames e RGBA referência/core/canvas exato; falha anterior preservada. Regressão autoral v2 no mesmo novo SHA passou88/88ida e88/88volta;162bytes/3309pixels exatos. Clippy default complementar ainda pendente.

M2 segue aberto: DMA interno e dataflow gráfico completo ainda desconhecidos. M3–M5 não iniciados; Experimental, sem push/release/promoção. Histórico v1/v2/BYOR/som permanece separado. Estado/reprodução/falhas/adendos em `docs/rex_profiles/commercial_recovery_20261016/MISSION.md` e `data/rex_profiles/commercial_recovery_20261016/`.

### Checkpoint 2026-10-17 — recuperação comercial: consumo Enigma/cópia observado no MAME; M2 aberto (Experimental)

Worktree `codex/rex-commercial-recovery-20261016`, base03ddc59d; M0 consolidado78d64311,
M1 congelado2a9d318f, instrumento autoral congelado17cd5bca. Pesquisaee8c581f e integração
preservadas limpas. No MAME0.289 externo, estado de fase especial preparado explicitamente:
PC171E/retorno1B6D8/A0=65432/A1=FF4000/D0.word=0; buffer4096 confere SHA322a1483…44d0;
4096 leituras/escritas em1B6F8, referência do destino8128 confere integralmente.
Não é sessão GX/app; nenhuma edição/cópia comercial executada ou prova gráfica nova.
Quatro qualificações autorais e dez negativos de registro passaram; falhas de ferramenta,
clock global estrito e snapshot ausente preservadas. Clock recua36ns na fronteira notifier/CPU.
M2 ainda exige superfície gráfica, correspondência com app e host:certify; M3–M5 não iniciados.
Host diagnoseREADY; houve adiamento por RAM<3GiB. Janela recuperada às06:36UTC, certify em execução, sem resultado pressuposto.
Detalhes, requisitos/testes/limites/retomada: `docs/rex_profiles/commercial_recovery_20261016/MISSION.md`.
Resultados/metadados: `data/rex_profiles/commercial_recovery_20261016/`; comercial só no scratch.
Produção Rust/TS/dependências alteradas0; v1FAIL86/89, v2autoral88/88 ida/volta e somOPEN preservados.
Retomada: conferir término do certify atual e preflight; depois qualificar revisão candidata indicada no MISSION.md.
Sem push/merge/release/promoção. Missão não concluída.

### Checkpoint 2026-10-16 — recuperação comercial: M0 consolidado (Experimental)

Worktree isolado `codex/rex-commercial-recovery-20261016`, base reconciliada `03ddc59d`; pesquisa `ee8c581f` preservada. Host diagnose novo READY. Inventário, limites e índice em `docs/rex_profiles/commercial_recovery_20261016/MISSION.md`; auditoria de artefatos e proteção em `data/rex_profiles/commercial_recovery_20261016/`. V1 FAIL 86/89, v2 autoral 88/88 ida/volta, duas tentativas BYOR e som OPEN são evidência herdada separada; nenhuma nova prova comercial ou mudança de produto. M1–M5 pendentes. Sem push/merge/release/promoção.

# 06 - AI MEMORY BANK & CONTEXT TRACKER

### Checkpoint 2026-10-16 — aceite autoral visual copy v2 fechado; v1 preservada (Experimental)

O operador autorizou explicitamente corrigir o oráculo após a falha v1, com
fundamentação no core pinado, vetores literais e novo freeze antes da jornada.
Adendo/modelo/vetores/expectativas/specs congelados em d8be191e, às 23:09:14 UTC,
antes da primeira jornada v2. É correção metodológica posterior à observação,
não validação cega. Fonte oficial46a55214…16872: palette_init→pixel_lut[1],
MAKE_PIXEL RGB565, color_update_m5 normal; config_default e negociação de
formato 2 verificados no código e por auditoria estática do binário pinado.
Paleta codificada CRAM, framebuffer RGB565→RGBA no adaptador e canvas da UI
estão separados. O contrato vale só para app/core/configuração/mode pinados,
sem generalização a hardware real ou outros cores. Não há novo codec/classe/node.

Antes da jornada passaram 31 vetores literais, 9 negativos de conversão,
11 de imagem/buffer e 13 do comparador real. Incluem preto, canais isolados,
intermediários, máximo, misturas, curva verde RGB565 vs555, conversão antiga,
alteração de um nível em cada canal e tentativa de ampliar tolerância.
O compositor espacial/oráculo RAM v1 não mudou. Comparação absoluta v2 usa
**zero tolerância RGBA**; geometria, ROI, posições, RAM, guardas, identidade,
publicação e conjunto causal mantêm os critérios anteriores. Freeze permaneceu
intacto durante as duas corridas; apenas os três checks do componente de cor
mudaram de resultado nas novas observações.

Reutilizado app SHA 74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e,
core Genesis Plus GX SHA 07c10476…8310b1 e ROMs pinadas, sem rebuild ou alteração
em src/ ou src-tauri/. Jornada nativa **88/88 ida 1→2 + 88/88 volta 2→1**:
recuperar→nodes→editar/no-op→salvar→encerrar→reabrir→cópia/IPS→emular.
Nas seis capturas, oráculo/core/canvas têm RGBA idêntico byte a byte, zero
pixels divergentes. Scope 484 bytes igual em cada largura, diferença exata
162 bytes e 3309 posições de pixels; original/repetição idênticos, no-op sem
publicação, reversão para a ROM base SHA fbc72b25…0435. A cópia e IPS são os
mesmos do produto anterior; classe copy_grid e pipeline canônico intactos.

**V1 continua 86/89 REPROVADA**, com suas três falhas de imagem absoluta e todos
os artefatos preservados por hash. **BYOR permanece sem vínculo gráfico
demonstrado**, duas tentativas anteriores reutilizadas, sem nova alegação
comercial ou PC/chamador/args observados. **Pendência sonora nodegraph-authoring
OPEN**, histórico mantido. Aceite fechado é da cena autoral nesta combinação
pinada; não promove maturidade geral. Sem participante humano.

Certificação da rodada: **READY** — tree/lint/tsc, **1045 frontend passed/3 skipped**,
**1036 Rust passed/93 ignored**, Clippy lib/padrão -D warnings, fmt e
upstream SGDK/PVSnesLib oficiais passaram. Snapshot/log preservados. Regressões v1 ainda
aplicáveis 60/60, 63/63 e 55/55 reaproveitadas no mesmo binário; comportamento do
comparador v1 preservado e testado. Relatório, hashes, escada de evidências,
matriz requisito→implementação→teste→resultado→limite e reprodução em
`docs/rex_profiles/integration_20261016/VISUAL-COPY-V2-RESULTS.md`,
`VISUAL-COPY-CONTRACT-V2.md` e `VISUAL-COPY-V2-REPRODUCE.md`;
evidência `data/rex_profiles/integration_20261016/evidence/visual-copy-v2/`.
Sem push/merge/release/promoção/dependência ou core novo; pesquisa ee8c581f preservada limpa.


### Checkpoint 2026-10-16 — cópia ligada à cena autoral; aceite gráfico v1 bloqueado (Experimental)

Sobre 2f078dc2, com freeze b0f9f8d8 e oráculo 8a0cd9d2 anteriores ao build/core,
a classe copy_grid existente alimenta descritores carregados de recurso de 64 bytes,
buffer fonte, destino e conversão autoral explícita em 112 palavras VDP via SGDK.
Nenhuma classe/node/codec/publicador/dependência/core novo. A apresentação e o
wrapper ABI são autoria de QA, não código recuperado. No binário app
74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e,
a GUI nativa edita 1→2, salva, encerra, reabre do disco, gera cópia/IPS e executa.
Os 484 bytes de scope completo (fonte/destino/mapa/guardas/marcador) conferem nas
duas larguras; diff exato de 162 bytes e 3309 posições de pixels; core/canvas são
idênticos. No-op tem plano vazio e publicação bloqueada; original/repetição
são idênticos; volta 2→1 restaura a ROM SHA fbc72b25…0435. Nove negativos
anteriores ao core rejeitam dados incorretos. Diagnóstico agora distingue região
recuperada e não sugere evento autoral; grafos autorais/mistos e portas mantêm
validação; a entrada executável do engine não mudou. Sem participante humano.

**A imagem absoluta v1 foi REPROVADA e a entrega integral NÃO está aprovada.**
O oráculo congelou 255 ±7; core oficial observado entrega 239. A fonte da revisão
indicada pelo binário explica esse nível por CRAM 0..14 e expansão RGB565. O erro
estava na suposição do oráculo. A instrução explícita proíbe alterar expectativas
após observar; v1, tolerância, capturas e relatórios permanecem intactos. Exceção
para contrato v2 foi pedida, sem pressupor aprovação. Gates verdes não mudam
esse resultado. Detalhes em VISUAL-COPY-COLOR-DIAGNOSIS.md.

BYOR: revalidação estática de 37 pontos e codec Enigma de 4096 bytes SHA 322a1483…44d0
passa novamente, pesquisa ee8c581f limpa. Primeiro episódio neutro 180/Start 1/
neutro 180/direita 120/neutro 60 termina em título: três cargas, 15 amostras,
inputs aceitos/consultados, controle reproduzível, nenhum framebuffer diferente
original/cópia e nenhuma fonte igual ao recurso estático. Trace indisponível;
PC/chamador/args e consumidor comercial continuam desconhecidos. Segunda
tentativa com Start tardio foi congelada em 50363df3: 600/10/240/1200/60 frames;
três cargas, 15 novas amostras, cena de gameplay visível, original/cópia ainda
idênticos e recurso estático não observado na fonte. Continua bloqueada.
**Parte comercial não concluída. Pendência sonora nodegraph-authoring OPEN,
com histórico preservado e sem investigação nova.**

Regressões no mesmo binário: copy-grid 60/60, comparação holdout 63/63,
comparação com chamada opaca 55/55. Certificação **READY**: 1045 frontend passed/3 skipped, 1036 Rust passed/93 ignored;
Clippy lib/padrão -D warnings, fmt e upstream SGDK/PVSnesLib passaram. Relatório
preservado antes do novo diagnose. Corrida autoral final 86/89: só as três
comparações de cor absoluta reprovam, mesmo após conferir os hashes do oráculo,
input neutro e identidade na captura.
Relatório, cadeia, requisito→implementação→teste→resultado→limite e reprodução:
`docs/rex_profiles/integration_20261016/VISUAL-COPY-RESULTS.md` e
`VISUAL-COPY-REPRODUCE.md`; evidência `data/rex_profiles/integration_20261016/evidence/visual-copy/`.
Sem push, merge, release ou promoção; bytes/patches/capturas comerciais só em scratch privado.


### Checkpoint 2026-10-16 — copy-grid no motor semântico, edição de largura comprovada (Experimental)

Sobre 89189485, com contrato congelado em 2eed076d e pesquisa ee8c581f
preservada limpa, entrou a classe genérica `copy_grid` no caminho existente
SemanticEngine/rexProfileEdit/revisão/publicação/persistência. Perfil em dado
`m68k.copy_grid.v1`; nenhum crate, registry, path-dep ou core novo. Núcleo Rust
valida os oito operandos, DBRA/sign-extension, mapa, aliases, alinhamento e
spans; reconstrução de campos tipados não usa bytes de procedência. Canvas
compacto entrada→cópia→saída, oito mappings e proposta de stride/span;
somente largura byte/word é editável, sem compilação de topologia.

No app SHA 51b338ced43399545e7df6388d270a632991050083d32659db8369e8c77acc02,
GUI 004 **60/60**: declarar/recuperar/revisar/editar 1→2/salvar pelo menu/
encerrar/reabrir/cópia+IPS/executar original e cópia. Diff único 0x410 na
fixture autoral; IPS independente e base intacta. WRAM coincide entre o core
do produto Genesis Plus GX e BlastEm; 72 bytes diferem exatamente como previsto.
Fixture e região BYOR pinada passaram quatro execuções independentes cada,
com sentinel e referência de toda WRAM relevante (stack reservada excluída).
BYOR no backend real mudou somente 0x1B6F8; corpus/patch continuam privados.
Regressões no mesmo binário: comparação curada **63/63**, anterior opaca
**55/55** e 60 entradas. Host certify **READY**, frontend **1043/3 skips**,
Rust **1036/93 ignored**, lint/tsc/Clippy, upstream SGDK/PVSnesLib verdes.
Fmt/diff check passaram; falhas do roteiro preservadas sem mudar expectativas.
Controle reverso 2→1 também passou **60/60** na GUI e voltou ao SHA autoral exato.

**Pendência sonora preexistente do nodegraph-authoring permanece aberta.**
Prova é de região em harness com estado inicial declarado; não há observação
de chamada pelo jogo original, consumidor gráfico, vídeo/áudio ou vivacidade
de flags/registradores. Não é decompilação universal nem compilador do grafo.
Contrato, mapa requisito→implementação→teste→resultado→limite, métricas, hashes,
controle reverso e reprodução: `docs/rex_profiles/integration_20261016/COPY-GRID-RESULTS.md`
e `COPY-GRID-REPRODUCE.md`; evidência `data/rex_profiles/integration_20261016/evidence/copy-grid/`.
Sem push, merge, release, promoção ou alteração de outra frente.


### Checkpoint 2026-10-16 — comparação recuperada do laboratório na jornada canônica (Experimental)

No destino `codex/rex-integrator-sonic-103104`, base `3aee1128`, foi incorporada
somente a fixture autoral e o pacote de comparação da pesquisa `ee8c581f`.
Backend real rederiva a região declarada `0x240..0x25E`, normaliza `>=` assinado,
limiar 5 e nove mappings; a assinatura do pacote coincide sem exceção na revisão.
No app SHA `f913ed903f64bbd8a86e2f269d9e872f8b596344eb48723fab1b415aa6c8f46b`,
a jornada GUI passou **63/63**: recuperar → abrir nodes → editar limiar 5→6 →
Salvar pelo menu → destruir janela → reabrir do disco → cópia/IPS → execução.
A regressão da jornada anterior, com guarda e chamada opaca, passou **55/55**
e 60 casos no mesmo binário. A correção de produto verifica request_id e hash
do perfil na resposta da ponte; comparação assinada fica explícita. Sem node,
classe, codec ou publicador novo, sem alteração de registry ou dependências.

ROM autoral base SHA `8246bb88…f6f218`, 2593 bytes; cópia `65e48daa…4528`,
IPS `bf9faf05…cc09`. Única diferença em `0x247`; original intacta; aplicador
Python independente reproduz a cópia. Mesmo Genesis Plus GX v1.7.4 46a5521,
SHA `07c10476…10b1`, com SHA dos bytes efetivamente carregados conferido.
No domínio `INT32_MIN,-1,0,4,5,6,INT32_MAX`, ledger observado mudou
`0,0,0,0,1,1,1`→`0,0,0,0,0,1,1`. Contador/estado finais observados:
`0x7FFFFFFF`/`1`. Inputs por caso são declarados pelo caller autoral; não há
captura de argumentos do jogo nem prova de chamada em ROM comercial. Flags,
registradores, stack, vídeo/áudio e outros estados não foram comparados.

`host:certify` **READY**, exit 0: tree/lint/tsc, frontend **1041/0/3 skips**,
Clippy, Rust **1032/0/92 ignored**, Ghidra operacional e upstream SGDK/SNES.
Fmt e diff check passaram. Gates não promovem recuperação universal nem
usabilidade humana. **Pendência sonora preexistente do nodegraph-authoring
permanece aberta**: falha e aprovação no mesmo binário não foram diagnosticadas
nem apagadas por esta missão. O aviso herdado de #[test] duplicado também foi
preservado. GUI 001 (61/61, save por API) e GUI 002 (falha do localizador do
botão com atalho) ficam no histórico; GUI 003 usa o clique nativo corrigido.

Mapa requisito→implementação→teste→resultado→limite e comandos/hashes completos:
`docs/rex_profiles/integration_20261016/REQUIREMENTS.md`, `REPRODUCE.md` e
`data/rex_profiles/integration_20261016/evidence/`. Próximo candidato de pesquisa:
contrato de memória/proveniência de copy-grid como inspeção somente leitura,
condicionado a tipos/portas/lowering/testes antes de habilitar execução ou edição;
nenhuma outra classe foi integrada nesta rodada. Sem push/merge/release/promoção.


### Checkpoint 2026-10-02 — barreira incremental de frames em Build & Run

No branch `codex/rex-sonic-multiframe-ui`, commit de harness `8166d4f1`, a
coleta do E2E agora espera dez frames novos depois da nova sessão, além de
conferir o SHA da ROM, sessão diferente, hold encerrado e framebuffer não
preto. O primeiro gate (`5b9d2b9`) só exigia contador absoluto ≥10 e podia
aceitar frames de uma ROM idêntica já carregada; a nova barreira ancora no
primeiro contador pós-sessão, exige delta ≥10 e reancora quando o renderer zera.
Seis testes Vitest passaram; ao remover o teste incremental por mutação, os dois
casos de contador retido/resetado falharam como esperado.

Replay local `reference-platformer`, app SHA
`1845aebf1597a18cab74dd763d03fcf75c25ef2ec834c165fed5dc9529ccb8b0`: 16/16.
A célula autoral do tilemap `(25,1)/1001` mudou `0→2`; a ROM construída e a
reaberta compartilham SHA `fbbdd384…16511d4a`, e a célula reaberta voltou a
`1bd5bd07`. Relatório bruto local:
`src-tauri/target-test/validation/reference-platformer-2026-10-02T23-03-26-132Z-report.json`;
resumo/manifesto versionado em
`data/rex_profiles/sonic_multiframe/evidence/2026-10-02-frame-barrier-r2/`.
`host:certify` READY: frontend 912/3, Rust 839/0/76, Clippy, lint, TypeScript,
check:tree e validação upstream SGDK/PVSnesLib success. CI consultado no SHA
`8166d4f` tinha três success e três in_progress na primeira consulta; a consulta
final às 23:26:04Z confirmou CI 6/6 success, sem falhas ou pendências. Sem merge,
release ou promoção; PR #99 segue draft e depende de #98.

### Checkpoint 2026-09-30 (o) — MUGEN: **cadeia original do Ken (Stand_X) convertida da fonte e comparada com referência independente** (Experimental mantido)

Frente `codex/rex-mugen-original-chain`, dependente de `codex/rex-mugen-real` (PR #90 @ `508db51b20c701f61a8fcdbc9bf43a642d28fa3c`);
PR dependente publicado sem merge/release. Detalhe, auditoria com arquivo:linha, tabela operação → implementação → teste → resultado → limite em
`docs/rex_profiles/mugen_sgdk/ORIGINAL_CHAIN.md`; hashes e números em `ORIGINAL_CHAIN_EVIDENCE.json`; contrato em `crates/rex-mugen/CONTRACT.md` («Cadeia original»).
Conserve (i)–(o) na integração futura (`0194f94` continua fora da base).
**Atualização do merge de consolidação (2026-10-02): `0194f94` foi incorporado
nesta base pelo merge da cadeia (#92); (i)–(o) estão todos presentes, sem duplicação.**

**Cadeia.** `ken.cmd:963` `[State -1]` (comando `x`, `command != "holddown"`, `statetype = S`, `ctrl = 1`, reentrada `stateno = 200` + `time > 5`) → `ken.cns:285` Statedef 200
(`ctrl 0`, `velset 0,0`, `anim 200`) → AIR 2+2+2 → `ken.cns:343` `ChangeState 0 ctrl 1` em `AnimTime = 0`. **`common1.cns` não existe** (pacote nem máquina): o estado 0 é um
**stand-in autoral declarado**; HitDef, PlaySnd, poweradd, juggle, movetype, physics e 55 dos 56 controladores do `-1` ficam **não convertidos**, listados com origem e motivo.
Estado 200 = parcial; estado 0 = autoral. Nenhuma instalação externa foi presumida equivalente.

**Produto.** `core/mugen_chain.rs` (subconjunto mínimo e reutilizável: comandos de 1 elemento, gatilhos simples, `ChangeState`, `Statedef type/ctrl/anim/velset`), nó
`mugen_state_program` (programa como string JSON + digest que cobre o mapeamento de fonte; adulterar bloqueia o build), runtime `rds_mc_<v>_*` na ordem comandos → −1 → estado
atual → rastro → avanço, anel de rastreio na RAM (pad amostrado, estado, `vtimer`), revisão de origem na UI (4 classes: convertido/aproximado/autoral/não convertido), opção
`original_chain` + escolha de cadeia no assistente. `authored_visual_demo` segue padrão. O editor de grafos só conhece parâmetros string/número e rejeitava tipos
desconhecidos (corrigido, com teste).

**Prova.** Referência independente `scripts/verify-mugen-chain.py` (lê CMD/CNS/AIR sozinha, lógica de 3 valores sobre todos os controladores do `-1`/`-2`, alimentada pelo pad que a ROM amostrou):
**0 divergências** no core direto (197 ticks) e na UI real com teclado nativo (336 ticks), 7 controles negativos recusados, 184/295 quadros de pixels idênticos ao Pillow
(defasagem 0 vblank pelo `vtimer`; 1 tick = 1 vblank). Toque → 1 ataque de 6 ticks; segurar → 1 ataque; 2º toque cedo ignorado; `Time = 6` reentra; X+baixo não ataca.
Fluxo UI: importar → revisar origem → salvar → reiniciar → reabrir (relatório e digest idênticos; editor de grafos intacto) → Build & Run → teclado nativo. Instâncias independentes
provadas na ROM real. Negativos: dependência ausente, condição não suportada, comando incorreto/ausente, mapeamento adulterado, estado ambíguo/animação ausente.

**Caminho de input.** Sem lotes: `emulator_run_frame` quadro a quadro (core de debug ≈ 10,6 quadros/s); os «dez ticks» vinham do harness (duas requisições + polling ≈ 1 s). Entrega pode cair
no quadro em curso ou no seguinte; semântica de comando = borda (segurar não repete). **Limitação medida, não corrigida:** o joypad é nível, não fila: 1 de 9 toques nativos (6 ms) se perdeu;
recomendação: latch de 1 pressão por quadro em `emulator_send_input` (afeta todos os cenários; fora desta frente).

**Regressões e gates.** Reexecutados no binário final (app `2f8457a9432b1fee7cf595ad9d6fe61546a752b1dda43a3fe541a21c06bdb39d`): `mugen-real` + oráculo Pillow (204/211 quadros), `mugen-import`,
`mugen-control`, `mugen-locomotion`, strider real e provas reais da cadeia. `mugen-real` falhou 2× sob carga do host (flutuação do harness) antes de passar sem mudança de código. Gates: tree, lint, tsc, fmt,
clippy `-D warnings`, frontend 831/0/6, Rust 832/0/75, `crates:gates` 4 pacotes. ROM UI `028158917e7cb847276b7f536204424fed6f743548b53034332398fbfc47d513`,
ELF `ad21039b6677685719cd0b0f4da90fa0218cbc75231b26cdd7891b1af3e02d6d`; ROM backend `c421c92d5065e4d8ff8de22aa3541e3b5d4795e27f249190f2a0959cbc6ae666`; programa `87cbd0bbee56468bc12db16790deaffbdabd5609841996526917f9eeefb58a14`;
core Genesis Plus GX v1.7.4 `46a5521` (`07c10476…`). CI por SHA: consultar no PR.

**Não provado:** conversão integral do Ken, colisão/dano/combate, facing, andar/pular/agachar (dependem do `common1.cns`), fidelidade ao motor MUGEN real (nenhum runtime original executou; borda do botão simples e `buffer.time` padrão não confirmados na doc primária), PAL, tempo real.

### Checkpoint 2026-09-30 (n) — Ken Majik real: triagem, revisão visual e cadeia SGDK → ROM → core → UI comprovadas (Experimental mantido)

Frente isolada `codex/rex-mugen-real`, dependente de `codex/rex-mugen-locomotion`
@ `b53ce7a6a474cf2194d82b7f83c82d3fd4085b42` (PR #87 confirmado aberto,
base UX v2 `d1b5a4d2bc37d4a9d3c78ea708b899ed44a38d7a`). Worktree
`/home/misael/Projects/REX-MUGEN-REAL-2026-09-30`; checkout canônico e seus
arquivos não rastreados preservados. `0194f9465e759a3ba3d6fae84b4f5aef0576a4af`
estava fora desta base e foi conservado: incorporado pelo merge de consolidação
de 2026-10-02 ((i)–(n) presentes, sem duplicação). Sem merge/release.
Matriz única, comparação Forge → RetroDev, limites e reprodução em
`docs/rex_profiles/mugen_sgdk/REAL_MISSION.md`; manifesto completo de hashes
e metadados em `REAL_EVIDENCE.json`, sem pixels/ROM/corpus BYOR no Git.

**Fonte e diagnóstico.** Operador autorizou expressamente `Ken_Majik_.zip`,
SHA `b244ec9a105fa0131b37c075dc06b032a87cf0f839f46ec7054ac60d9bd6f14c`;
`ken8.def`, SFF v1.0.1.0 com 201 sprites, AIR 102 ações, `ken1.act`;
`common1.cns` ausente e introdução absoluta registrados. Consulta Forge
somente leitura, licença MIT conferida, sem transplante/preparo do doador.
Pillow PCX independente confrontou os 201 índices/paletas com Rust sem
divergência: a primeira falha era **ACT ignorada**, não decoder. Outra falha
na fronteira BMP/tiles perdia 172 pixels de preto opaco no idle por associar
RGB preto ao índice de máscara 0; corrigida e coberta por regressão.
Corrigidos também pares numéricos escalares que causavam panic e orçamento
que contava atlas inteiro residente apesar do streaming SGDK existente.

**Produto.** Triagem Rust reutilizável anterior à conversão: DEF inequívoco,
duplicados/case/referências ausentes ou ambíguas, versões, inventário de
sprites/ações/controllers e localização; digest conferido novamente ao
importar. Seleção ACT/ações explícita, fonte intacta e derivados rastreáveis.
Wizard canônico recebe revisão com miniaturas reais, ação/quadro, original e
RGB333 na mesma escala, checker, eixo opcional e duração AIR; escolhas,
relatório e pixels reabrem. Stage/screenpack continuam na rota existente.
Piloto seleciona 0/20/21/200, 21 elementos AIR/18 células, 104×104, âncora
(51,98), durações 6/5/2; 15 cores opacas, zero fusões e sem redução de resolução.
**CNS original não convertido:** modo `authored_visual_demo` explicitamente
rotulado, grafo/controllers originais preservados como referência, facing
fixo à direita, sem acerto/dano/colisão. Nenhum flip nas ações selecionadas.

**Aceite real.** UI Tauri: selecionar/analisar/inspecionar/importar → editar
VelSet do estado 20 (2,5 → 1,5) → salvar/encerrar/reabrir → Build & Run oficial
→ teclado nativo →/←/Z, acks mesma sessão/seq → core/canvas integralmente
iguais. App `9b602ff3519f179804722da1f3ba3b35d28bdb1deeb2fb3d646c7a29d4ce5d36`;
ROM UI `0e8af2eb8015beb6830b5074f8ed52e8537d4e9bf86f48d023d9d27f8febe6fe`;
ELF `6e3eae8d525cbe1361c3d70812998122fabfbb6c6dee8bf302ab359a020b7fec`.
Core oficial Genesis Plus GX v1.7.4 `46a5521`, hash
`07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1`.
Oráculo externo independente passou em 21 prévias, 27 frames compilados por
projeto, 204 core e 212 UI: pixels/máscara, geometria, ordem e ticks exatos;
paleta/sprite/eixo/flip/imagem antiga alterados são recusados. Galeria de
mesma pose fonte/prévia/core/UI e sequência GIF inspecionadas, locais em
`~/.retrodev/mugen-real-2026-09-30/oracle/`.
UI mede caminhada 384/256, volta −448/256, paradas imóveis. Solicitação de
toque nativo foi observada em lote de 10 ticks: **dois** ataques completos
de 6 ticks, idle entre eles e depois; comando autoral de nível pode repetir
enquanto pressionado. Backend de um tick prova um ciclo. Não alegar input
instantâneo/um único ataque na UI. Curva RGB565 do core verificada pela fonte
imutável `46a55214d0dab654e5a525ae0c54921ca9716872`, separada da prévia RGB.
Custos compilados: 96 tiles/3.072 B residentes, até 8 peças, pico 4 peças e
104 px/scanline, até 3.072 B de tiles por troca. CPU/DMA temporal, hardware
físico, PAL e FPS real não medidos; warning conservador permanece.

**Validação.** `mugen-import`, `mugen-control`, `mugen-locomotion` verdes no
mesmo app; 14 processos próprios por cenário, 0 vivos. Gates: tree, lint,
tsc, fmt, clippy `-D warnings`, frontend 828/0/6 (834), Rust 818/0/72 (890),
`crates:gates` quatro pacotes, syntax harness e oráculo. Patch transitivo
único `brace-expansion` 5.0.9 → 5.0.12 remove vulnerabilidades altas; audit
no limiar high passa com quatro moderadas Vitest registradas como dívida de
teste. RustSec passa com oito avisos informacionais herdados, cadeias e IDs
registrados no documento de missão; nenhuma dependência Rust nova/alterada.
Licenças reexecutadas (334 npm/499 Cargo/15 toolchains). Host READY,
fingerprint `60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`.
`host:certify` passou: READY, frontend 831/0/3 com ambiente oficial habilitado,
Rust 818/0/72 e validação upstream Linux SGDK/PVSnesLib/core `success: true`.

Commits de produto `90481e7d50b047ff0711d09290abbfe2b6269041`, QA
`44a850c8e11b14d178683129dbb3ff9a454b2a99`, segurança
`23df72290ccdf29acbe5322756c35979d9af23f0`. Publicar PR dependente da branch
de #87, consultar CI pelo SHA final (não presumido neste checkpoint).
Esta prova é do piloto delimitado; não promove suporte geral MUGEN nem maturidade.

### Checkpoint 2026-09-29 (i) — integrador, **PR #86 MUGEN → SGDK MESCLADO no tronco do integrador; `rex-mugen` promovido a `fluxo-do-usuario-comprovado` co escopo medido; frente MUGEN UX v2 aberta** (Experimental mantido; sen release)

**Ordem recibida:** "Revisar PR #86 para merge humano no tronco de integración.
Non adicionar funcionalidade nova." Seis verificacións con comando fresco
(11:40Z–11:52Z UTC, detalle completo na célula de revisión de
`docs/rex_profiles/ROUND_STATE.md`): (1) diff final = #85 + curaduría, 113
ficheiros reconciliados (72 + 43 − 2 de solapamento), 0 arquivos alheios, 0
borrados; (2) `src-tauri/Cargo.toml` conserva as catro path-deps
(`rex-addressing`, `rex-kosinski`, `rex-gameplay`, `rex-mugen`) e 0 marcadores
de conflito; (3) CI verde en `35d0450` — `validate` push+PR
(`36549832173`/`36549838756`), `linux-validate` ×2 e `desktop-smoke` PR
(`36549838729`); (4) a documentación deixou de afirmar que a fronte non fora
publicada; (5) os límites MUGEN seguen explícitos na descrición do PR, na
célula (h) e no `nao_alega` do rexistro; (6) #85 intacto e draft nese intre.
**Merge executado:** `gh pr merge 86 --merge` → `10c1a3c` (pais `e319fb9` +
`35d0450`), `mergedAt 2026-09-29T11:51:51Z`. Método `merge` pola política do
repo e porque squash/rebase destruirían `b410de0`, a proba de procedencia do
#85. **Consecuencia medida en #85:** GitHub marcouno `MERGED` automaticamente
ás 11:51:53Z porque `bd02e3c` tornou-se alcanzable desde o tronco; non se
executou ningunha acción sobre el (sen merge manual, sen comentario),
`isDraft=true` e os 22 commits permanecen intactos.
**Rexistro:** `rex-mugen` pasa de `gates-proprios-aprovados` a
**`fluxo-do-usuario-comprovado`** por ordem expresa do operador, co alegato
estrictamente escopado ao caso medido no E2E `mugen-import` (binario
`1b46ff50…`): importación → panel → Build & Run → edición no Inspector →
salvar/reiniciar/reabrir, sen soporte xeral. Seguen fóra e declarados: SFF v2,
som, stage, colisión lóxica, teclado/golpe pola UI, reapertura do relatorio,
rótulo «FPS» do Inspector e licenza do runtime C `mg_*` (non se copia, non se
asume). **Experimental mantido:** a promoción é un degrau interno da escada;
ningunha etiqueta de UI, roadmap ou release mudou. **CI da emenda:** rollup
terminal verde en `6f74ea7` (run `36565719916`, jobs `validate` e
`linux-validate` success); o CI do commit de medición `f0d0756` non se volta a
pinar para non mover o tronco outra vez — consúltase con
`gh api repos/Misael-art/RetroDevStudio/commits/f0d0756/check-runs`. Evidencia
en `data/rex_profiles/mugen_sgdk/evidence/2026-09-29-revision-merge/`.
**Frente MUGEN UX v2 aberta** (rama `codex/rex-mugen-ux-v2` @ `f0d0756`, sen
código nesta rolda), por orde: (1) relatorio de compatibilidade reabrible;
(2) rótulo correcto de duración/animación no Inspector en vez de «FPS»;
(3) limpeza do harness para non deixar a app viva tras o reinicio (achado
`run4`/`run7`); (4) proba de teclado e golpe pola UI; (5) só entón avaliar
SFF v2, som e stage. **Fechado por ordem do operador:** merge e promoción.
**Aberto:** licenza do runtime `mg_*`, soporte xeral de MUGEN e calquera
release.

### Checkpoint 2026-09-29 (m) — MUGEN UX v2, lote 4: **locomoção horizontal por `VelSet` (x constante, Q8.8) importada, editável e comprovada na ROM** (Experimental mantido)
Rama `codex/rex-mugen-locomotion` (dependente de `codex/rex-mugen-ux-v2` @ `d1b5a4d`, CI verde por SHA). `0194f94` (checkpoint (i), só docs) segue fóra das duas ramas: conservar (i), (j), (k), (l) e (m) na integración sen duplicar.
**Subconjunto** (contrato completo em `crates/rex-mugen/CONTRACT.md`, «Locomoção horizontal»): `VelSet x = N` / `value = N[, 0]`, `N` literal decimal, `trigger1 = 1`; px por tick (1 tick = 1 quadro emulado), x+ = direita, facing fixo à direita, Q8.8 com arredondamento ao mais próximo, deslocamento = `floor(Σ vx_q8/256)`; estado sen `VelSet` mantém a velocidade. Recusado com motivo (`unsupported`, sen ligar o nó): expressão/`const()`, outro gatilho, y≠0, x omitido, parámetro extra, fóra da faixa. **`PosAdd`/`PosSet`/`VelAdd` seguen fóra.**
**Cadea:** CNS → `parse_velset` → nós `set_velocity` de perfil (corpo + entrada) no grafo da entidade (persistido em `graph_ref`) → Inspector («Velocidade dos estados», px/tick, aviso de arredondamento, diagnóstico) → `LogicOp::MugenSetVelocityX` → runtime (`vx`/`xacc` por entidade). **Corrixido:** a máquina de estados era global (`fsm_state`); agora `fsm_state_<entidade>` (duas entidades con FSM non compartían estado por accidente).
**Prova nova.** Rust: 7 testes de produto + `mugen_strider_real_build_run_locomotion` (ROM/core reais, 195 quadros, 0 divergências vs contrato). Desktop `mugen-locomotion` (build final: app `f74e17be99abdf19a095d778dafa96f27edfdb72d4865a7787003def1fc24796`, `dist/index.html` `ad9b20abad2ffc865376095121a1ebbf1fc74b308bf610953604b039d8888ac0`, ROM `fda7472c023fca6e29cbb6678963ed9e032bdc41b0b71dd4071437b357246fc9`, ELF `b20bbd08d430b62ce3dbc19e22bf910c345ac067ce148c0dfa894377e21632a8`, fixture `strider.*` em `mugen-locomotion-2026-09-29T19-01-27-240Z-report.json`; 480 quadros): importar → relatório (4 VelSet `direct`) → digitar velocidade (`x`, `const(...)`, `200` recusados; `2.4` com aviso; **2.5 → 3.75**) → duplicar (2ª entidade parada) → salvar → reiniciar → reabrir → Build & Run → teclas nativas: sen input parado em x=96; Right e Left deslocam; troca Right→Left segurando; soltura → idle com posição constante; velocidade editada (960/256) e não editada (−448/256) batem **em todos os quadros** (0 divergências; x final 204 = esperado 204); animação 4/6 ticks independente da velocidade (19 trechos); ataque 3/8; outra entidade em x=288 intacta (visual e RAM); RAM em repouso = visual. Negativo: import con `x = const(...)` recusado e visível.
**Regressões reexecutadas no mesmo código (verdes; hash do app por execução, o build muda o hash):** `mugen-import` app `d00dcc3bbb2fccbd6d90731a5930ab17218cfc4a283cdf291bbb36ec700faeec`, ROMs `9108cb9a…` (idle 5/9) e `8e7e4a22…` (20/9); `mugen-control` app `567c94879d1757e7eefc5c4409f5f6003c85fe07676c844d094026d5e4b20408`, ROM `3c1fc3e8…`. Detalhe: `mugen-import` (relatório reabrível, 5/9 → 20/9), `mugen-control` (ataque por teclado, duração 4→12), coerência das duas representações (testes Rust), encerramento de sesións en sucesso e falla controlada (14 procesos acompañados, 0 vivos). A repetición da dixitación do Inspector agora é o helper `typeIntoInputAndExpect` (≤3 tentativas registadas; só acepta campo = texto dixitado + evidencia específica); nas execucións deste lote todas as entradas foron aceitas na 1ª tentativa; a causa do timeout antigo segue **sen atribuír**.
**Limitações:** PAL non medido; tempo real non certificado (core de debug ≪ 60 fps; medida en quadros emulados); sen colisión, límite de pantalla, chan, física, facing nin combate; fixture usa `command = 5` (neutro, extensión RetroDev); só un personaxe/fixture; SFF v2/son/stage fóra. Non se consultou o SGDK Forge nin se copiou código seu; a semántica de `VelSet` segue o coñecemento do MUGEN, sen cópia de documentación.

### Checkpoint 2026-09-29 (l) — MUGEN UX v2, lote 3: **coerência de duração no backend, limpeza própria do harness e personagem importado controlado pelo teclado** (Experimental mantido)
Rama `codex/rex-mugen-ux-v2` sobre `916da06` (CI de `916da06`: `CI` e `Desktop E2E` ainda `in_progress` na última consulta — não presumido; consultar por SHA). `0194f94` (checkpoint (i), só docs) segue fóra da rama; conservar (i), (j), (k) e (l) na integración sen duplicar.
**1. Coerência.** `mugen_anim_table` valida `frame_durations` × `mugen_frames[].duration` na geração: valor diferente ou comprimento diferente **bloqueia o build** (`#error`) com animação, quadro e valores; legado sen `frame_durations` usa `mugen_frames` só na geración (proxecto nunca reescrito); Inspector mostra o conflito e non edita. Testes Rust novos (5 unitarios + regresión de divergencia ponta a ponta); a proba 5/9 → 20/9 reexecutada verde. Política em `crates/rex-mugen/CONTRACT.md`.
**2. Limpeza do harness.** Falla real: a 2ª instância do app (após reiniciar) escapaba ao `finally`. Agora o harness acompanha sesións e PIDs (starttime de `/proc`), fecha todas as sesións no `finally`, espera limitada, SIGTERM→SIGKILL só a PIDs seus. Prova: sucesso e **falla controlada** (`RDS_E2E_INJECT_FAILURE=after-restart`) com 14 procesos acompañados (driver, driver nativo, as 2 instâncias do app e filhos), 0 vivos, confirmado por `ps` externo.
**3. Controle pelo teclado** (`--scenario mugen-control`, fixture autoral `walker`; app `83933a2e…`, frontend `dist/index.html` `75038b65…`, ROM `5b152a96…`, ELF `0a32e7a2…`, fixture `walker.{def,air,cmd,cns,sff}` sha em `mugen-control-2026-09-29T14-43-50-116Z-report.json`): importar → compatibilidade (sprites/animações/comandos/estados direct; colisões/som/stage ausentes) → duração da caminhada 4→12 pelo Inspector (`0` recusado, «Mantido: 4») → salvar → reiniciar → reabrir → relatório reaberto → Build & Run (ROM em execução = compilada) → foco → ArrowRight/KeyZ **nativos**. Observado: intenção e ack da mesma sessão/seq; sen input, idle o tempo todo (RAM=0); segurando →: verde **12**, azul **6**, gap de idle 1 tick, RAM=animação de caminhada; solto: volta ao idle; KeyZ: hitA **3**, hitB **8** uma só vez, RAM=animação de ataque; sen input outra vez: idle. Ação declarada como «animação de ataque».
**Prova herdada:** relatório reabrível, 5/9 → 20/9 (`mugen-import` reexecutado no binário do lote, verde). **Limitações:** **sen movimento de posición** (VelSet/PosAdd non convertidos; borda esquerda constante); só comando direção segurada e botão; sen acerto/dano/colisão; PAL e tempo real non medidos (core de debug ≪ 60 fps; medida em quadros emulados); leitura de RAM dependente do símbolo `rds_mugen_<v>_anim` no ELF; SFF v2/som/stage fóra.
Gates: `check:tree`, `lint`, `tsc`, `npm test` 821/0/6, `cargo fmt --check`, `clippy --lib` e `clippy` `-D warnings`, `cargo test --lib` 803/0/70, `crates:gates` (4 pacotes), `node --check`.

### Checkpoint 2026-09-29 (k) — MUGEN UX v2, etapa 2: **tempo por quadro editável no Inspector, em ticks de 1/60 s** (Experimental mantido)
Rama `codex/rex-mugen-ux-v2`, sobre `2522569` (CI `CI` + `Desktop E2E` `success`, consultado por SHA). **Integração futura:** `0194f94` (checkpoint (i), só docs) está fóra desta rama (`0194f94...HEAD` = 1 vs 1); conservar (i) e este (j)/(k) ao integrar, sen duplicar nin reescrever historia.
**Achado da auditoria** (unidades em `crates/rex-mugen/CONTRACT.md`, «Unidades de duração»): a duración é por elemento, em ticks de 1/60 s (`-1` = parado; gerador aceita `-1|1..=255`); o Inspector expunha só «Animacoes (FPS)», campo que **não altera a ROM** das animações MUGEN. Agora: animações MUGEN mostram «Quadro N (ticks)» (ajuda para iniciantes, `= s`), gravando `frame_durations[i]` **e** `mugen_frames[i].duration` só do quadro editado; entradas `0`, `<-1`, `>255`, vazias ou não inteiras dão diagnóstico com «Mantido: N» e não mudam o estado; sen ação que uniformice. Animações nativas seguem com FPS.
**Prova nova** (`--scenario mugen-import`, pela UI: importar → editar → salvar → encerrar → reabrir → Build & Run; binário `c44f5305…`, `dist/index.html` `f8c27a72…`): idle `action_0` 5/9 ticks; editado o quadro 1 para 20 → ROM `9b521159…` → `5f75177a…`; **medido no core em quadros emulados** (cada `putImageData` do viewport = 1 quadro): original 5/9 (23 e 22 trechos, todos exatos), editado 20/9 (10 e 11 trechos, todos exatos), 0 trechos fora; `action_200` 3,6,4,2 intacta no disco; valores recusados `0`, `-2`, `x` mantêm 20; relatório MUGEN reabrível. Instância pós-reinício encerrada.
**Limitações:** em ms de parede o core de debug roda ~7× abaixo do tempo real no harness (razão 0,548 ≈ 5/9 correcta) — por isso a medida é em quadros; um só personagem/animação (probe), não é suporte geral a animações MUGEN; `frame_durations` vs `mugen_frames.duration` sen conferência no gerador; PAL não medido. Gates: `check:tree`, `lint`, `tsc`, `npm test`; Rust não tocado (gates Rust não reexecutados).

### Checkpoint 2026-09-29 (j) — MUGEN UX v2, etapa 1: **relatório de compatibilidade reabrible** (Experimental mantido)
Rama `codex/rex-mugen-ux-v2`. Novo menú Projeto → «Relatorio MUGEN» (`menu-action-mugen-report`) reabre o panel a partir de `assets/mugen/<id>_import_report.json` no disco (`showMugenCompatibility(dir, true)`), sen depender do estado da sesión que importou; «Fechar» limpa o estado. Sen relatorio → aviso explicativo. Proba: `npm test` 813/0/6, E2E desktop `--scenario mugen-import` verde co paso novo `report_reopened_after_restart` (importar → reiniciar app → reabrir proxecto → menú → mesmas categorías, totais e perdas que o panel da importación e que o JSON gravado). Fóra de escopo (non iniciado): SFF v2, son, stage, comandos de golpe.

### Checkpoint 2026-09-29 (h) — integrador, **PR #85 MUGEN → SGDK integrado na árbore do integrador: importación de personaje, panel de compatibilidade e edición persistente probados na UI** (Experimental; publicado como PR #86 sen merge, sen release, sen promoción de maturidade naquele intre — o merge e a promoción rexístranse no checkpoint (i))

**Estado real desta superficie.** O produto acepta **un** caso de uso MUGEN:
importar un personaje do subconxunto `air` + `sff v1` + paleta nivel VDP +
`cmd`/`cns` lidos como perfis, e levalo a ROM real por Build & Run. O degrau
declarado en `crates/registry.json` para `rex-mugen` era
**`gates-proprios-aprovados`** neste checkpoint — non se subiu a
`backend-integrado` nin a `fluxo-do-usuario-comprovado` aqui, porque a
promoción era decisión do operador; o que existe é evidencia (a promoción
escopada rexístrase no checkpoint (i)). Todo o fluxo permanece etiquetado
`Experimental` no informe do E2E e na UI.

**Commits desta célula:** `b410de0` (merge curado do PR #85 sobre o tronco do
integrador; pais `e319fb9` + `bd02e3c`; índice de 72 ficheiros, +7910 / −88) e
o commit de curaduría que rexistra esta célula (reescribe a entrada `rex-mugen`
de `crates/registry.json`, emenda `docs/rex_profiles/ROUND_STATE.md` e reforza
unha aserción do harness). **Neste intre o PR #85 mantense draft no remoto:
non se fixo
merge del, nin release, nin promoción de maturidade, e non se lle engadiu
comentario ningún — o #85 só se referencia. (Tras o merge de #86, GitHub
marcouo MERGED automaticamente por alcanzabilidade; ver checkpoint (i).)**

**Publicación desta frente (2026-09-29, ordem expresa do operador: "faça push
da branch `codex/rex-integrator-mugen-85` e abra um PR integrado no GitHub, sem
merge, sem release e sem promoção de maturidade").** Antes do push, o tronco do
integrador `codex/rex-integrator-crates-registry` adiantouse en fast-forward
`00f9d29..e319fb9` (publica `aa959a9` + `e319fb9`; `git fetch` antes do push
confirmou 0 atrás / 2 á frente) para que o diff do PR sexa exactamente a
integración de #85 máis a curaduría. Esta frente quedou en `d36df92` no remoto
e abriu-se o **PR #86** (`Integrate experimental MUGEN import flow`, base
`codex/rex-integrator-crates-registry`, head `codex/rex-integrator-mugen-85`,
24 commits, 113 ficheiros, +18009/−90, `isDraft=false`, `mergeable=MERGEABLE`,
`mergeStateStatus=CLEAN`), coa descrición obrigatoria completa: base, merge
curado, curaduría, conflito de `src-tauri/Cargo.toml`, os 11 gates do destino
coas contaxes, os 8 puntos do E2E e as 8 limitacións rexistradas. **CI
terminal sobre o SHA pinado `d36df92`, medido por consulta pontual sen monitor
permanente:** catro runs `completed`/`success` — `CI` `36542842781`
(`linux-validate` 08:27:36Z→08:40:54Z; `validate` →08:50:28Z), `Desktop E2E`
`36542842770` (`desktop-smoke` →08:46:52Z), `CI` `36542937864` (`validate`
→08:52:04Z; `linux-validate` →08:41:42Z) e `Desktop E2E` `36542937819`
(`desktop-smoke` →08:48:23Z); `CodeRabbit` `pass` (reviews desactivados para
esta base) e `Sourcery review` `skipping`. Despois desa medição, `eaf980c`
(só os dous documentos de estado: rexistro desta mesma publicación) entrou na
mesma branch por fast-forward `d36df92..eaf980c`, e o seu CI tamén é terminal
verde — `CI` `36546968827` (push) + `36546969248` (pull_request) e `Desktop E2E`
`36546969249` (pull_request), todos `completed`/`success` (`CodeRabbit` `pass`,
`Sourcery` `skipping`); **non houbo run `Desktop E2E` de `push` porque o
disparador `push` do workflow filtra por `paths:` e `docs/` non está nessa
lista** — o gate de PR seguiu executado e verde. O CI do commit que leva esta
liña non se volveu pinar aqui para non mover o head outra vez: consúltase con
`gh pr checks 86`. **Aínda sen merge nese intre: #86 quedou
aberto para revisión humana (pecha na célula (i)) e #85 segue draft.**

**Revisión das 5 superficies centrais tocadas (todas reservadas ao integrador).**
`src-tauri/src/lib.rs` (+91/−14): envolve a importación externa nas dúas vías,
chama `discard_failed_import(project_dir, origin)` segundo a orixe reservada do
cartafol e fusiona `mugen_profile::summary_line()` no aviso de éxito.
`src/App.tsx` (+74): estado `mugenCompatibility`, render do panel,
`__RDS_E2E__.setNextExternalImportPath` e `testid` de confirmación.
`src/core/diagnostics.ts` (+45/−2): `mugenImportCause()` con causa + acción
suxerida para os catro casos e peche «Nenhum projeto foi criado.».
`scripts/e2e-tauri-build-run.mjs` (+291/−2): escenario `mugen-import`.
`src-tauri/Cargo.toml`: único conflito da integración, 2 liñas de path-deps,
resolto conservando `rex-kosinski`, `rex-gameplay` **e** `rex-mugen`, sen apagar
avanço do integrador (`git diff --diff-filter=U` = 0, ningún marcador na árbore).

**Barra no destino (todos rc=0).** `npm run check:tree`, `npm run lint`,
`npx tsc --noEmit`, `npm test` **812 passed / 0 failed / 6 skipped**, `cargo fmt
--check`, `cargo clippy --lib -- -D warnings`, `cargo clippy -- -D warnings`,
`cargo test --lib` **796 executados / 0 fallos / 70 ignorados**, `npm run
crates:gates` cos 4 paquetes, `node --check` do harness e `npm run host:certify`
(host **READY**, fingerprint `60249508…`, lock `dd99a22f…`, smoke oficial
SGDK/PVSnesLib `Success: true`). A barra foi **reexecutada íntegra sobre a árbore
final curada** (2026-09-29T03:00Z–03:17Z) despois de reescribir o rexistro e
reforzar a aserción do harness, con contaxes idénticas; o E2E non se volveu
executar porque entre run7 e esa reexecución non mudou ningún byte de produto,
de fixture ou do escenario. Reconciliación independente da contaxe Rust: base
`a08c2c6` 770/66 + PR 15/3 (os 18 `#[test]` de `mugen_profile.rs`, 3 deles
`#[ignore]`) + integrador 11/1 = **796/70**; os 781/0/69 anunciados pola fronte
son unha medición anterior á súa propia entrega. **Débeda preexistente, non
atribuíble ao PR:** `cargo clippy --all-targets` reproba con 46 avisos de
`#[cfg(test)]` (`rex_context` 18, `rex_aplib` 8, `rex_resources` 5, `project_mgr`
5, `rex_codecs` 4, e 1 cada un en `logic_recovery`, `holdout`,
`graphics_discovery`, `lib.rs:165`, `build_orch:5227`); cruzadas as 45
localizacións únicas coas liñas engadidas polo PR, **0** caen nelas. Rexístrase e
non se corrige (atribúese, non se arrecula o avance alleo).

**E2E desktop `mugen-import` verde** (run7, 2026-09-29T02:46Z–02:47Z, binario
SHA-256 `1b46ff50…`, fixture autoral con SHA por arquivo). As 7 validacións
pedidas polo operador están probadas, con separación honesta entre o que proba o
core e o que só proba a interface: (1) a falla non deixa projeto fantasma
(`failed_import_does_not_leave_a_project_that_looks_valid`,
`failed_import_into_existing_empty_dir_keeps_the_dir_empty`, e no E2E a
comprobación explícita de que o `escapeName` desta execución non chegou ao
disco); (2) o relatório aparece na UI (tests do panel + asercións DOM, 7
categorías `{sprites/animations/commands/states: direct, collisions: manual,
sound/stage: absent}`, texto cru de 15 527 caracteres); (3) o éxito resume perdas
(`successful_import_summarizes_losses_by_category`,
`sentinel_summary_exposes_every_loss_class`, e o console `[MUGEN] probe
(Experimental): 12 funcionam igual, 0 con diferenca, 1 precisam de ajuste seu, 0
nao convertidos`); (4) os caminhos fora do paquete recusanse (4 tests negativos +
o negativo do E2E); (5) o projeto aberto anterior non muda tras a falla
(`activeProjectDir` invariado — **só probado no E2E**, sen test Rust); (6) o
personaxe aparece no core (Build & Run real, mostra no canvas 320×224 en (96,96):
idle0=11, idle1=14; a proba `mugen_probe_real_build_run_edit_and_effect` segue
`#[ignore]`); (7) a edición no Inspector persiste tras salvar, reiniciar e
reabrir (x 96→140, reapertura en 140, ROM `10658a6c…` vs `5a6aff76…`, personaxe
na posición nova e vella baleira — **só probado no E2E**).

**Dous achados na superficie do propio integrador.** (a) A aserción do projeto
fantasma comparaba só o *conteo* de cartafoles `Mugen_Escape_*`, polo que non era
discriminante cando xa existía un de outra execución — endurecida para esixir que
o nome desta proba non estea no disco, e run7 reexecutado despois do endurecemento.
(b) Tras o reinicio do E2E queda unha instancia de `retro-dev-studio` viva
(observado en run4 e run7) — rexistrada como límite do harness, **non** corrixida
nesta rolda. O cartafol `Mugen_Escape_1790639205721` que aínda existe en
`~/Documents/RetroDevProjects` non é un fantasma MUGEN: o seu `project.rds`
declara `template_id = "starter_guided"`, `source_kind = "builtin"`, polo que o
creou o onboarding doutra rolda; non se borrou.

**Condición do host (non escondida).** O output primario pasou a ser un panel
rotado `1280x800+0+0` e o compositor recorta alí as xanelas, así que o
redimensionado a 1920×1080 CSS era imposible (`inner=948x564`, factor físico/CSS
1,35). Un vixía temporal **fóra do repo** colocou só a xanela da app de proba no
monitor externo (`3456x1458+1281+0`, físico 2592×1458 = 1920×1080 CSS) para
reproducir o mesmo viewport da proba da fronte. Non se mudou a configuración de
pantallas do operador nin se alterou o harness para aceptar outra xeometría.

**Limites rexistrados (o que non se alega).** SFF v2, som, stage e colisión
lóxica seguen fóra. Comando por teclado e golpe son proba técnica/core, **non**
de UI. O relatório de compatibilidade non ten reapertura futura. O Inspector usa
a etiqueta «FPS» para unha animación MUGEN (rótulo inadecuado, coñecido). Non se
copia o runtime C `mg_*` (base HAMOOPIG de terceiros, licenza non verificada —
`docs/rex_profiles/mugen_sgdk/AUDIT.md`) e non se asume licenza estra. **Aberto,
en mans do operador:** promoción de degrau, licenza e fluxo de usuario completo
(para á importación, edición de animación e xogo).

**Evidencia:** `data/rex_profiles/mugen_sgdk/evidence/2026-09-28-integracao-integrador/`
(logs por paso, informe do E2E, 6 capturas, `LEIAME-e2e-e-host.md` cos descartes
explícitos das execucións non válidas e `SHA256SUMS` de 26 ficheiros verificados)
e `data/rex_profiles/mugen_sgdk/evidence/2026-09-29-pos-curaduria/` (reexecución
da barra sobre a árbore final, `LEIAME.md` con rc/comando/log/medida por gate e
`SHA256SUMS` de 11 ficheiros verificados).

**Arquivos alheios á rolda** (`APJ-unpack`, `a.out`, `apultra-decode`,
`.mimosa/`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/`,
`data/canonical-local-2026-09-21/`, `__pycache__/` e o log de consulta CI da
fronte) seguen intocados: non executados, non stagingados, non apagados.

### Checkpoint 2026-09-26 (g) — integrador, **aPLib em Rust canônico**: decoder aceito pelos vetores, um bug de formato achado por arbitragem em stream real e aceite BYOR das duas streams (Experimental; sem merge, sem release, sem promoção)

**Commits desta frente** (`codex/rex-integrator-aplib-decode`, baseada no trunk
do integrador `d0744b0`, +8 commits): `9a9b66d` (vetores da agente B importados
para namespace próprio, 49 arquivos pinados por SHA + hash agregado `3a9d7e9e…`),
`d27be00` (`aplib_decode`/`AplibLimits` em `src-tauri/src/tools/reverse/decomp/
rex_aplib.rs`, variante SGDK **raw sem header `"AP\0"`**), `9fb2c12`
(`verify_aplib_resource` em `rex_resources.rs:148` — recusa `compression != Aplib`,
exige `expected_len`, decodifica **sem dicionário** — e a garantia de que a via
LZ4W continua recusando header APLIB), `d10d5ab` (correção do token `110` + os
dois vetores discriminadores + script de reconstrução) e `a69614e` (aceite BYOR
das duas streams reais + perna JS independente); `73961e5` registra o estado na
matriz e no consolidado. **Push feito** após `git fetch` (branch nova no remoto;
CI consultado **uma vez**: `validate`, `linux-validate`, `desktop-smoke`
`in_progress`; sem monitor permanente).

**Hipótese testada:** um decoder que passa nos 49 vetores pinados por dois
oráculos decodifica corretamente os streams APLIB do alvo visível. **A hipótese
estava errada**, e a frente só o soube porque o aceite BYOR foi executado: com
**todos** os 49 vetores verdes, o decoder divergia de cada um dos dois
decodificadores de referência em **703 dos 16 000 bytes** do TileSet real
(`0x2e4d4`), com enquadramento idêntico (`bytes_consumed` 4485, plain 16 000 B;
antes `34a894c3…`, depois `dd7affc3…`).

**Causa (defeito de produto, não de fixture):** o token `110` não gravava
`offset_history`, então o rep-match seguinte reusava offset obsoleto. A regra
"quem escreve no histórico são `10` **e `110`**; `111` não escreve e devolve LWM
a 3" **não estava** na especificação da agente B, e nenhum vetor importado coloca
um rep-match depois de `110`/`111` — lacuna de cobertura, não de conteúdo. Por
isso os dois novos casos entraram como vetores **irmãs**
(`data/rex_profiles/integrator/aplib/discriminating/`, SHA por arquivo, `ORIGEM.md`
com receita de reconstrução e de ambos os oráculos) e o conjunto pinado de B
permaneceu íntegro (`verify_vectors.py` rc=0). Autoridade do formato: **os dois
decodificadores externos** (`apultra` exemplar `64be2a7a…`, origem declarada
commit `8f340057…`; `apj.jar` SGDK v2.11 `2d8cdc63…`, hash conferido **antes** da
primeira execução) mais o JS da agente A (`aplib.mjs`, conteúdo `62425497…`) —
três caminhos concordantes; nem o produto nem o port da agente A são autoridade.
Não-vacuidade provada removendo a correção: **só** o teste novo cai.

**Aceite BYOR (`#[ignore]`, falha honesta sem arquivo/identidade):** ROM
`558bea6c…`; TileSet `0x21b44` → stream `0x2e4d4` (4485 → 16 000 B, `dd7affc3…`);
TileMap `0x21b4c` → stream `0x2d534` (1196 → 2 240 B, `c196aa5b…`); separação
estrutural `0x2d534 + 1196 < 0x2e4d4`. Nenhum byte comercial entra no
repositório: só offsets, comprimentos e SHA-256.

**Gates (árvore commitada):** `cargo test --lib` **687 passed / 0 failed / 54
ignored**, `--ignored byor_aplib` **1 passed**, `cargo clippy -- -D warnings`
rc=0, `cargo fmt -- --check` limpo, `npm run check:tree` OK. `cargo
clippy --all-targets` **não** é baseline limpa neste repositório (21 falhas de
estilo pré-existentes em `#[cfg(test)]`, inclusive código não tocado por esta
rodada) — o gate declarado é o outro.

**Não provado / aberto (registrado, não promovido):** **não há encoder aPLib**,
então a paridade bidirecional exigida por `CONTRACTS` §4
(`decode(produto, encode(ref))` e `decode(ref, encode(produto))`) e a
editabilidade **sem expansão** de um recurso APLIB continuam abertas — este é o
próximo incremento; os 95,90 % de correspondência por pixel do alvo seguem
medidos **só em JS**, não no produto (reconstrução visual e reinserção com
transação são etapas separadas); identificação continua assistida pelo header
(sucesso de decode não prova identificação); `work-limit`/`cancelled`/`overflow`
são política do produto sem vetor de oráculo; a variante com header `"AP\0"` está
fora do escopo. **A linha aPLib da matriz de codecs NÃO foi promovida** (missões
desta rodada vetam promoção de maturidade, merge e release); o que existe é
evidência registrada em `docs/rex_profiles/ROUND_STATE.md` e no adendo §8 de
`docs/rex_profiles/APLIB_TILEDIMAGE_PROXIMA_PROVA_2026-09-26.md`. Arquivos
alheios à rodada (`APJ-unpack`, `a.out`, `apultra-decode`, `.mimosa/`,
`src-tauri/src-tauri/`, corpus `data/canonical-local-2026-09-21/`) seguem
intocados: não executados, não stagingados, não apagados.

### Checkpoint 2026-09-26 (f) — integrador, **piso do formato medido**: o déficit do corpus é qualidade de parsing, não falta de espaço (Experimental; sem merge, sem release, sem promoção)

**Commits deste lote:** `c296102` (instrumento de piso `dp_floor.py` + varredura
`floor_sweep.py` + emenda §9 do `BENCH_SPEC.md`) e `563c5f0` (dumps opcionais de
material fora do repositório + teste que decodifica os streams de piso pelo
decoder do produto), seguidos do commit de evidência/documento
(`.../evidence/2026-09-26-r5-floor-dump/`, §6 de
`LZ4W_ENCODER_444_VS_448_2026-09-26.md`, linha `encode` e histórico de
`ROUND_STATE.md`). PINO DO CODIFICADOR INTACTO: `rex_codecs.rs @
bee8524f…` — nada neste lote toca o caminho de produção, então o replay 68k `r14`
continua valendo.

**Por que este passo veio antes de mexer no compressor.** O checkpoint (e) deixou
uma pergunta em aberto com resposta cara de adivinhar: dos −9 156 B de déficit do
corpus, quanto era culpa do parse guloso e quanto é limite do formato? Sem esse
número, integrar um DP seria aposta. Com ele, é decisão.

**O instrumento.** DP de custo explícito sobre `(posição i, literais pendentes p
0..14)` — 1 word de descritor + 1 por literal + 1 de offset para match longo +
terminador de 2 words, na janela do codificador (0x4000 words) e na convenção de
offset do produto (espaço dicionário+saída, sem o bit 0x8000). O estado `p` não é
ornato: sem ele o modelo erra, e foi exatamente o bug do DP portado de `LZ4W.java`
que piorou o produto (382 B contra 380 B) no checkpoint (d).

**Duas correções metodológicas que este checkpoint deve registrar.**
1. *Matches maximais não são ótimos.* A primeira versão restringia cada fonte ao
   seu comprimento máximo; passou 25 vezes no selftest aleatório e **falhou na
   26.ª** (`plain=[2,2,1,2,1,0,2,1,1,1,1,2] dict=[2]`: 10 words contra 9 da busca
   exaustiva). O número que a versão restrita dava para o fixture (444 B) era
   coincidente com o correto por acaso — e teria sido publicado como piso.
2. *O selftest precisava ser não-vacuo.* Contando os tipos de transição emitidos,
   as duas primeiras configurações **nunca** produziam um match longo nem
   encostavam no teto curto de 16 words. Entraram então "fontes distantes"
   (dicionário acima de 0x100, onde só o formato longo alcança), "repetição"
   (alfabeto de 1 word, tetos de 16 e 257) e "janela curta" (o recorte de `WINDOW`
   jamais exercido por entrada pequena com janela real). 1 165 entradas depois, a
   DP coincide com a busca exaustiva em todas.

**Medida (rounda `2026-09-26-r5-floor-dump`).** Gap produto − piso, no plain **sem
edição**: positivo em **160/160** recursos do corpus; soma **9 394 B** (ajuste
7 480 B em 128, validação 1 914 B em 32); mediana 56/60 B; máximo 150 B; **zero
empates e zero perdas** no corpus. Agregado: soma de slots 225 562 B, soma de
pisos 225 324 B → a folga somada do corpus viraria **+238 B** (hoje −9 156 B), e
**125/160** recursos teriam o plain não-editado cabendo no slot contra **1** hoje
— mas 35 continuariam fora, porque a sobra não é uniforme. No fixture autoral o
produto **já está no piso** (444 B == `rescomp` == DP): o gap de 146 B contra slot
de 144 B da edição canônica não é culpa do parse, e o incremento de parsing não
abre aquele alvo.

**Reconciliação por caminhos independentes.** Os 9 394 B aparecem somados (a) em
Python, pelos comprimentos que o modelo anuncia, e (b) em Rust, pelos 161 streams
lidos do disco e decodificados por `lz4w_decode_with_dictionary` — todos voltam ao
plain exato consumindo-se inteiros. E o `bench.json` de r5 é campo a campo idêntico
ao da rodada pinada r4 (161/161 linhas; resumo inteiro igual fora de
`tempo_rodada_ms` 25 526 → 23 352), o que prova que instalar o dump não moveu
nenhuma medição.

**Custo do instrumento:** 59,4 s para os 161 recursos em Python não otimizado
(~0,4 s/recurso) — cabe no orçamento de 2 s/recurso da especificação, então a
viabilidade de um DP no produto não está limitada por tempo neste primeiro exame.

**O que este checkpoint NÃO afirma (e por isso o incremento ainda não entrou).**
O piso é do plain sem edição, logo "cabe no slot" é condição necessária: um bit
invertido custa tipicamente 2–6 B por cima do piso. Não houve replay no
desempacotador 68000 dos streams de piso — é obrigação de quem integrar, no pino
novo, junto com o teto de hardware de 16 385 words, a proteção de dependentes, os
limites de tempo/memória e a recusa honesta (`needs_space`) quando não couber. E
o DP como escrito é O(posições × candidatos × comprimentos): no produto vai
precisar de orçamento por posição, e um teto de candidatos faria do resultado um
**limitante superior** (só "gap > 0" continua valendo com poda; "gap == 0" não).

**Gates:** `cargo test --lib` 669 passed / 0 failed / 53 ignored; `cargo clippy --
-D warnings` rc=0; `cargo fmt -- --check` rc=0; `dp_floor.py --selftest` rc=0.
`clippy --all-targets` mantém 10 achados **pré-existentes** em `project_mgr.rs`,
`holdout.rs`, `lib.rs`, `graphics_discovery.rs`, `build_orch.rs`,
`logic_recovery.rs` — nenhum em `rex_*.rs`, nenhum introduzido aqui. Frontend
intocado neste lote.

**Higiene BYOR:** os dumps de material (806 arquivos, 11 613 804 B) ficaram em
`/tmp/rex-lz4w-floor-dumps-2026-09-26` e são descartáveis; o versionado é o
SHA-256 de cada um dentro de `floor-sweep.jsonl`. O caminho de dump é recusado por
asserção se estiver dentro do repositório.

**Próximo comando (PASSO 3, integração):** portar a DP para `rex_codecs.rs` atrás
de orçamento explícito, re-pinar o codificador, refazer o replay 68k no pino novo e
publicar antes/depois com perdas e empates pela especificação congelada.
**Em paralelo (PASSO 5):** TiledImage/APLIB em frente separada. **Bloqueio:**
nenhum externo. **Fora de escopo por ordem do operador:** merge, release, promoção
de maturidade, expansão de ROM, realocação de ponteiros, promoção do marco do
fixture para cobertura BYOR.

### Checkpoint 2026-09-26 (e) — integrador, capacidade REAL do codificador LZ4W medida, um incremento pinado e o descarte silencioso da UI corrigido (Experimental; sem merge, sem release, sem promoção)

**Commits da entrega:** `2ffb076` (benchmark congelado), `39c0fd9` (incremento
do codificador + replay 68k `r14`), `6351f15` (aviso de UI) e o commit de
documentação que traz este registro — todos sobre `47f2c89` (ETAPA E), branch
`codex/rex-integrator-profiles-codecs`. Nada além disso ficou não commitado: os
arquivos alheios à rodada (`.mimosa/`, `APJ-unpack`, `a.out`,
`apultra-decode`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/`,
`data/canonical-local-2026-09-21/`) permanecem intactos e **não** staged — o
último é corpus BYOR e nunca entra no git.

**Objetivo recebido:** tornar mais recursos comprimidos editáveis **sem
expansão**, *medindo a capacidade real do encoder* — em vez de acumular ajustes
de parsing sem saber qual gargalo fecha.

**Decisão metodológica central:** congelar a medição antes de mexer no
codificador. `scripts/rex_profiles/integrator/lz4w_recompress/BENCH_SPEC.md`
(§1-§8) fixa conjuntos (S-A fixture autoral, S-B corpus BYOR), split de
validação por `índice % 5` (32 recursos) vs ajuste (128), as 4 edições por
recurso definidas **antes** de medir, orçamento (2 s/recurso, 120 s/rodada,
publicado como perda se estourar), a barreira de re-decode do que o codificador
emite, e a regra de honestidade que o operador exigiu: **no-op que preserva o
stream original não conta como sucesso do encoder** — sai em coluna própria
(`noop_preservando_stream`). O teste do benchmark é `#[ignore]` e só roda com
`RDS_REX_BENCH_OUT` absoluto; ele **falha** se a ROM do corpus ou do fixture
faltar ou divergir do SHA pino (aceite BYOR sem `return` silencioso).

**Linha de base (roda `r1`, `rex_codecs.rs @ 656bdc9f…`):** 160 recursos LZ4W
verificados, folga somada **−13 188 B**, **1** recurso com folga ≥ 0; das 644
edições predefinidas **2 cabem**, **523** `needs_space`, **119** no-op. Fixture:
re-encode do plain não editado = **448 B** contra o `rescomp` de **444 B**.

**Diagnóstico token a token (não se começou por reescrever o compressor):** três
instrumentos independentes e concordantes — `tokens.py` (tokenizador próprio,
só imprime depois de reproduzir o plain e consumir o stream inteiro),
`model_encoder.py` (réplica **linha a linha do codificador daquela linha de
base**, validada por igualdade byte a byte, o que permite inverter decisões sem
reverter código) e `probe_candidates.py` (varredura sob três modelos: ideal sem
cap, real dicionário-primeiro, mesclado). A divergência está em **uma posição**:
no word 200 do plain do fixture, o dicionário tem 2 329 candidatos e o melhor
representável `(3, 156)` está na **tabela de saída**; na ordem dicionário-primeiro
o teto de 128 candidatos se esgota no dicionário antes de a saída ser consultada
(`melhor_só_dict = (2, 1135)`, não representável). Alcançar aquele candidato
naquela ordem custaria ~2 330 avaliações — **18× o teto**; na ordem mesclada ele
chega em **3**. Conclusão registrada: o defeito é a **ordem** em que o orçamento
é gasto, não o tamanho do orçamento. (Redação anterior, já retirada do estado
corrente, atribuía o gap ao cap ou ao lazy de 1 passo — a sonda refutou as duas.)

**Incremento entregue (único, delimitado):** `find_best` intercala as duas listas
descendentes por proximidade com **mesmo** cap de 128, **mesma** janela
(0x4000 words), **mesmo** `consider()`, **mesmo** filtro de aceite e **mesma**
regra lazy. Formato intocado.

**Antes/depois com perdas e empates declarados:** comparação recurso a recurso do
campo `reencode_base` entre `r1` e `r2` (161 linhas = 160 do corpus + 1 do
fixture): folga somada **−13 188 → −9 156 B** (+4 032 B), no corpus **158
melhoraram / 0 pioraram / 2 empataram**, fixture **448 → 444 B, byte a byte
idêntico ao stream do `rescomp`**. Reproduzido **campo a campo** no pino final
`bee8524f…` (roda `r4`: 161/161 linhas iguais, resumo igual exceto o tempo de
rodada 27 440 → 25 526 ms). Replay no **desempacotador 68000 oficial** do SGDK
2.11 sob MAME 0.289 (`lz4w-68k/evidence/2026-09-26-r14`, 12 casos, 7 ROMs): as
streams do codificador novo batem 68k == jar v1.43 == esperado-Rust, e a recusa
contratual além do teto de hardware (`i16`, off 16386) continua divergindo no
68k por contrato. Determinismo entre duas corridas registrado no manifesto.

**O que o incremento NÃO resolveu (e isso é o achado, não um rodapé):** a
editabilidade **não** aumentou. Continua **1/160** recurso com folga não
negativa (`0xc8cc8`, +2 B), e a coluna nova de **capacidade por amostragem**
(24 bits invertidos por recurso, espaçados uniformemente; um bit só "cabe" se o
re-encode cabe **e** a re-decodificação reproduz o plain editado) diz o mesmo:
só `0xc8cc8` tem bit amostral cabível (16 de 24), os outros 159 têm zero, e a
edição canônica de 1 pixel ali custa **146 B contra slot de 144 B** (`needs_space`
honesto, nada forçado). Mediana do déficit restante **56 B/recurso** contra
2-6 B por bit: **empatar com o `rescomp` é condição necessária, não
suficiente.** Amostragem é amostragem — exaustivo seria O(bits) codificações por
recurso e estouraria o orçamento.

**UI (obrigação de corretude do PASSO 4, não extra):** o descarte de edição fora
do intervalo era silencioso (`paintAt` retornava cedo; o formulário não validava
nada). `editRejectReason` agora explica tile/linha/coluna/índice/nenhum-recurso
no painel (`rex-resource-notice`) e como `warn` no log da ferramenta, preserva a
fila válida e **não** envia o candidato inválido. A guarda do **núcleo** continua
definitiva (o teste afirma que `rexResourceApplyEdit` recebe só a edição boa).
Nenhum controle inválido foi exposto para facilitar teste — os campos aceitam
entrada livre porque o usuário pode digitar qualquer valor, e é esse caso que a
mensagem cobre.

**Gates (todos rc=0, medidos nesta ordem, um job pesado por vez):**
`check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` **701 passed / 6
skipped**, `cargo fmt --check`, `cargo clippy -- -D warnings`,
`cargo test --lib` **669 passed / 0 failed / 52 ignored**; §5 do diagnóstico
reexecutado (passo 4 dif == log versionado). Nota: `cargo clippy --all-targets`
tem 10 achados **pré-existentes** em arquivos que este lote não toca
(`project_mgr.rs`, `holdout.rs`, `lib.rs`, `graphics_discovery.rs`,
`build_orch.rs`, `logic_recovery.rs`) — nenhum em `rex_*.rs`.

**Higiene de evidência:** `sa-dict.bin` (391 560 B, **fixture autoral**) é
versionado uma vez (`r1`); cópias byte a byte idênticas em `r2/r3/r4` foram
substituídas por `sa-dict.bin.sha256` com a verificação `cmp` registrada.
`bench.json` só contém metadados (offsets, comprimentos, contagens) — nenhum
byte da ROM comercial. Cada rodada ganhou `manifest.json` com pino do codificador;
onde o hash da fonte **não** foi registrado no momento da corrida (`r2`, `r3`)
isso está dito em vez de inventado, e `r4` fecha a lacuna.

**Próximo incremento (PASSO 3, medido antes de integrar):** parse de **custo
explícito** — caminho mais curto sobre as words com custo real de token +
literais + descrito + word de offset, respeitando ≤15 literais/token e o teto de
128 candidatos — para obter o **piso** por recurso; validar contra busca
exaustiva em entradas pequenas e **não** chamar de "ótimo" sem essa comparação.
Contexto que a mídia anterior não tinha: o DP ótimo do `LZ4W.java` já foi
tentado nesta rodada, ficou verde no suíte e **piorou** (382 B vs 380 B); um DP
fiel precisa de estado `(posição × literais pendentes mod 15)`.

**Bloqueios e fora de escopo:** nenhum externo. Permanecem fora por ordem do
operador: merge, release, promoção de maturidade, expansão de ROM, realocação de
ponteiros, promoção do marco do fixture para cobertura BYOR, e misturar
otimização LZ4W + codec novo (aPLib) + UI num único commit. O alvo comercial
`0xc8cc8` segue **BLOQUEADO** quanto a efeito de jogo.

### Checkpoint 2026-09-26 (d) — integrador, ETAPA E: edição de recurso comprimido com efeito **causal demonstrado na aplicação** (Experimental; sem merge, sem release, sem promoção)

**HEAD na abertura deste checkpoint:** `d4043eb` (branch
`codex/rex-integrator-profiles-codecs`). Não commitados neste momento:
`scripts/e2e-tauri-build-run.mjs` (cenário novo + helpers),
`src-tauri/src/tools/reverse/decomp/rex_resources.rs` (teste de fronteira +
limpeza de lints), `scripts/rex_profiles/integrator/lz4w_fixture/{README.md,gen_fixture.py}`,
`scripts/rex_profiles/integrator/lz4w_fixture/analyze-frame.py` (novo), os dois
relatórios de evidência e o `manifest.json` em
`data/rex_profiles/integrator/lz4w-fixture/evidence/2026-09-26-e2e/`, e o
`fixture-build-report.json` versionado (sha da receita + registro de reprodução).

**Hipótese:** a cadeia LZ4W do produto — descoberta → decode → transação canônica
→ BPS → re-aplicação → emulação — produz um efeito observável **na tela do app**
quando a edição é feita pela interface real sobre o núcleo real, e os negativos
alcançáveis pela interface são recusados sem escrita.

**Evidência a favor (medida, binário `e69077927863c15788bf2006e344f71f4a4b84408714201c48a67d450fc26574`,
core Genesis Plus GX v1.7.4 `46a5521`):** cenário E2E `rex-lz4w-fixture-effect`
verde **duas vezes** com o código final (run10 e run11, `rc=0` lido nos próprios
logs, não de notificação). Pela UI: recurso único (header 95464, stream `0x5f988`,
slot 444 B, `1/5 candidatos` verificados), prévia == fonte recomposto
(`19cc30aefe4da564`), no-op honesto, edição `tile 0, row 5, col 7 → idx 15`
aplicada pela transação (modificada `e55dba92…`, BPS `52ce036f…` de 74 B, 268
bytes distintos confinados em `5f9a1..5fb3f`, `diferenteForaDoSlot:0`), BPS
re-aplicado à base reproduzindo o hash exato, cópia reaberta decodificando no
plain editado (`917048cc35508e9a`). Pela emulação: **1 byte** no WRAM (`0x5e`,
`f0→ff`) e **exatamente 1 pixel de tela** diferente, na coordenada `(7,5)` prevista
pelo fonte **antes** de qualquer emulação, com as classes de cor esperadas
(`0x212021 → 0x8c008c`), canvas do app == framebuffer do core (320×224). Pelos
negativos: fila de intervalo guardada (0 entradas, 0 escritas, sha da cópia
inalterado; controle positivo enfileira 1) e `rom_identity_mismatch` quando o
arquivo muda sob o painel (TOCTOU), com a ROM do fixture verificada intacta.

**Evidência contra / limitações (registradas como não provadas, não como sucesso):**
(a) a perna de **VRAM não é alcançável** — o core devolve
`retro_get_memory_size(VIDEO_RAM) == 0` enquanto `emulator_read_memory` responde
`ok:true` com dados vazios; a comparação ingênua diria "0 divergências" de forma
**vaciada**, então o relatório publica `vram.observed:false` com o motivo e a
cadeia fica provada por WRAM + framebuffer; (b) o DAC do Mega Drive **funde** as
16 palavras de paleta autorais em **11 cores** (índices colididos
`[0,1,2,3,4,6,7,8,9,10]`) — índice→cor é função mas não é injetiva, logo a
identidade do pixel alterado é estabelecida por **posição** e a cor só confirma a
classe (diagnóstico em `analyze-frame.py`); (c) a recusa de intervalo do **núcleo**
é **inalcançável pela UI**: `CompressedResourcePanel.tsx` descarta
`editTile >= num_tiles` no cliente, então o E2E prova a guarda do cliente e a
recusa do núcleo (`rex_resources.rs:634`) foi fixada pelo teste unitário
`apply_rejects_tile_outside_resource_without_writing` (que também asserta que a
cópia em disco não mudou); (d) isto é prova de **mecanismo em dado autoral** — o
alvo comercial `0xc8cc8` continua `semanticState: BLOQUEADO`, e nenhuma afirmação
visual é feita sobre ele.

**Retratação de redação no estado corrente:** a frase "a tela do app ainda não foi
capturada por emulação" (ROUND_STATE, linha da ETAPA D) estava desatualizada e foi
substituída; ela permanece verdadeira apenas para o alvo comercial.

**Reprodução durável do artefato testado:** `build-fixture.sh` reproduziu o ROM
bit-idêntico (`159298eb…`, 393216 B) em caminho versionado-de-receita e o
`fixture-build-report.json` do tronco agora registra a receita atual
(`gen_fixture.py 3e474f44…`, sha anterior `1445132f…` produzia o mesmo ROM — a
diferença é comentário + achatamento de `tile_pixels`). `/tmp` deixa de ser a única
origem; gap declarado: o cenário ainda alimenta a cópia em `/tmp`.

**Relatório técnico da etapa (consolidação auditável):**
`docs/rex_profiles/RELATORIO_ETAPA_E_2026-09-26.md` — veredito, tabela de artefatos
com SHA-256 reconferido contra o disco, método com as cinco barreiras não-vacuosas,
os dez passos com valores medidos, o argumento de causalidade, onde vive cada
negativo, as limitações não provadas, portas com a reconciliação 699↔702 e a receita
de reprodução. Todo número foi confrontado com o `manifest.json` e com o
`rex-lz4w-fixture-effect-report-run11.json` antes do commit; a auditoria acrescentou
ao relatório e ao manifesto a limitação de que **as corridas rc=0 abriram a ROM em
`/tmp`** (`fixture.romPath`), com o caminho durável devolvendo o mesmo SHA.

**Gates deste checkpoint:** `cargo test --lib -- --nocapture` **669 passed / 0 failed /
51 ignored**; `cargo clippy -- -D warnings` limpo; `cargo fmt --check` limpo;
`npm run check:tree`, `npm run lint`, `npx tsc --noEmit` rc=0; `npm test`
**699 passed / 6 skipped (705)**, arquivos 75/1 skipped (76); `npm run host:certify`
**READY** (fingerprint `60249508…`, lock `dd99a22f…`) com a mesma suíte Rust
(669/0/51) e **702 passed / 3 skipped** no frontend. A diferença 699↔702 é
reconciliada e não é comparação de tips: os 3 testes a mais vêm de guardas por
disponibilidade de toolchain em `scripts/decomp/decomp-scripts.test.mjs`
(`HAS_SGDK_BUILD_TOOLCHAIN`, `GHIDRA_AVAILABLE`, `HAS_M68K_TOOLS`), que o profile
`full` exporta; total idêntico (705), zero falhas nas duas corridas. Log das
portas promovido com `gates-2026-09-26.log` no pacote de evidência. Achado paralelo honesto: `cargo clippy
--all-targets` (gate mais estrito que o documentado) falha em 10 lints de código
de teste **pré-existente** de outros módulos (`build_orch.rs`, `project_mgr.rs`×5,
`graphics_discovery.rs`, `holdout.rs`, `logic_recovery.rs`, `lib.rs`) — atribuídos
e **não** corrigidos nesta rodada.

**Próximo comando:** commit deste conjunto revisado + `git push` após fetch seguro.
**Bloqueio externo:** nenhum. Por ordem do operador continuam fora do escopo:
merge de PR, release e promoção de maturidade; expansão de ROM/realocação de
ponteiros; bytes comerciais no staging.


### Checkpoint 2026-09-26 (c) — integrador, ETAPA D: edição de 1 pixel com efeito **previsto** que sobrevive ao 68000, em fixture autoral (Experimental; sem merge, sem release)

**HEAD no checkpoint:** `a96fb15` (branch `codex/rex-integrator-profiles-codecs`), com
três arquivos de trabalho modificados e não commitados neste instante
(`src-tauri/src/tools/reverse/decomp/rex_resources.rs`,
`scripts/rex_profiles/integrator/lz4w_68k/driver_integrator.rs`,
`scripts/rex_profiles/integrator/lz4w_68k/reproduce.sh`) mais o pacote do fixture
(`scripts/rex_profiles/integrator/lz4w_fixture/`) e os dois pacotes de evidência
(`data/rex_profiles/integrator/lz4w-fixture/`,
`data/rex_profiles/integrator/lz4w-68k/evidence/2026-09-26-r13/`) como não rastreados.
Os 7 commits anteriores e o checkpoint pendente do Memory Bank permanecem intactos
(`658d756` + `13a5792` + `a96fb15`). Arquivos alheios continuam intocados.

**Hipótese:** a meta da rodada (uma edição de recurso comprimido com efeito causal
demonstrado) era alcançável **sem** tocar a ROM comercial, desde que o consumidor do
recurso fosse conhecido por construção e a edição respeitasse a granularidade real do
formato.

**Evidência a favor (medida):** fixture SGDK 2.11 autoral
(`scripts/rex_profiles/integrator/lz4w_fixture/`, ROM `159298eb…`, TileSet LZ4W em
header `95464`/stream `391560`, 16 tiles 8x8, plain 512B, empacotado 444B). O aceite
`--ignored` do produto: decode == fonte recomposta; no-op honesto; a edição **prevista
antes de qualquer emulação** `tile 0, linha 5, coluna 7: índice 0 -> 15` re-codifica a
440B e **cabe** no slot de 444B pela transação canônica (identidade, evidência,
dependentes, roundtrip, BPS); a ROM modificada reabre e re-decodifica para o plain
planejado; a coordenada de tela prevista é `(7,5)` e a prévia é renderizada (SHA dos
pixels e do PNG no log). Durabilidade: runF do replay 68000 (`…/lz4w-68k/evidence/
2026-09-26-r13/runs/runF`) desempacota no `lz4w_unpack` oficial, sob MAME 0.289, tanto
o stream do rescomp (`i30`) quanto o **escrito pelo produto** (`i31`) para exatamente
512 bytes, `68k == jar == esperado`, sem sobrescrever vizinhos.

**Evidência contra / medida negativa (registrada em vez de escondida):** o codificador
do produto gasta **mais** que o empacotador oficial no plain não-editado (448B vs 444B;
no fixture anterior, 380B vs 378B), então folga inicial é **negativa**. No fixture sem
plantio, a varredura **exaustiva** dos 15.360 candidatos de 1 pixel deu `0 cabem`
(`…/lz4w-fixture/evidence/2026-09-26/fixture-acceptance-exhaustive-before-plant.log`,
8,40 s). Causa estrutural: o LZ4W casa **words de 16 bits**, não pixels — uma edição de
1 pixel só encurta o stream se tornar dois words adjacentes idênticos. O plantio do
near-miss (`linha 5, coluna 7` guarda `(v+1)&15`) cria exatamente essa condição; sem
ele não haveria caso positivo, o que tornaria o teste inútil como discriminante.
Um porte do DP ótimo de `LZ4W.java` foi implementado, ficou verde no suíte inteiro e
**piorou** o resultado (382B vs 380B) — foi **revertido** (`git checkout --`) em vez de
entregue; o modelo de custo de 1 palavra/token ignora o chunk de 15 literais (custo
real de 16 literais + match curto: 20 words, não 17), logo um DP fiel precisa do estado
`(posição x literais pendentes mod 15)`.

**Correção de redação (retratação parcial):** o bloqueio comercial é o **consumidor não
provado** (a sonda do core só alcança as regiões que o libretro expõe; CRAM e o destino
do desempacotador ficam `missing`), **não** ausência de espaço — a edição canônica do
aceite BYOR (`pixel (0,7,4) -> idx 15`) cabe e é aplicada. A ROM comercial não foi
alterada nem instrumentada nesta rodada.

**Últimos comandos e resultados:** `cargo test --lib -- --ignored --nocapture
fixture_lz4w` -> 1 passed em 1,21 s (planta primeiro) e o log de 8,40 s da varredura
exaustiva anterior; `bash scripts/rex_profiles/integrator/lz4w_68k/reproduce.sh` com
`REX_CODECS_SHA=656bdc9f…` -> 7 execuções, 12 casos, 11 `68k == jar == esperado` e 1
divergência **esperada** (run16, além do teto 16385); `cargo test --lib` -> 668 passed /
0 failed / 51 ignored. **Próximos comandos:** `cargo fmt --check`,
`cargo clippy -- -D warnings`, `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`,
`npm test`, `npm run host:certify`, depois commit + conferência remota por fetch antes
de qualquer push. **Bloqueio concreto:** nenhum externo nesta etapa; a ETAPA E (tela do
app capturada por emulação no cenário E2E `rex-lz4w-fixture-effect`) é o trabalho
seguinte, e a meta visual **não** será declarada concluída enquanto `semanticState`
estiver BLOQUEADO.

### Checkpoint 2026-09-26 (b) — integrador retomado: contrato LZ4W fechado contra o 68000 real (Experimental; sem merge, sem release)

**Estado de partida preservado** (exigência do prompt de retomada): 7 commits locais
não enviados (`e942848..7e19d6a`) + a alteração pendente no Memory Bank, que foi
commitada verbatim como `658d756` antes de qualquer outra escrita. Arquivos
alheios na árvore (`APJ-unpack`, `apultra-decode`, `a.out`, `.mimosa/`,
`src-tauri/src-tauri/`, `data/canonical-local-2026-09-21/`) **não foram executados,
apagados nem staged**; continuam fora do escopo deste checkpoint.

**Hipótese testada:** o decoder do produto tratava a janela de busca do compressor
(`0x4000` words) como limite do formato e, portanto, recusava um offset que o
desempacotador 68000 oficial ainda lê corretamente. **Evidência a favor (medida no
hardware, não simulada):** `.long_match` em `tools_a.s` faz
`move.w (a0)+,d0; add.w d0,d0; bcs .lm_rom; lea -2(a1,d0.w),a2` — aritmética de
16 bits com displacement sinalado ⇒ leitura para trás exige `value >= 0x4000`, ou
seja `off <= 16385`. Replay sob MAME 0.289 com o `lz4w_unpack` montado do asm
oficial (identidade conferida contra `libmd.a`: 5056 bytes, SHA-256 `ff18bacb…`,
em **cada** uma das 6 construções de ROM): `i15` (off 16385, `value 0x4000`) é
reproduzido **byte a byte** pelo 68k e pelo jar; `i16` (off 16386, `value 0x3FFF`)
**diverge no hardware** no byte 0 (`0x24` em vez de `0xBE`, leitura para frente
aliassando a ROM) enquanto o jar de 32 bits reproduz o pretendido. **Evidência
contra nenhuma alternativa:** o produto aceita até 16385 e recusa de 16386 em
diante, exatamente como o hardware; os goldens são calculados à mão, não pela
fórmula do produto.

**Commit do produto:** `13a5792` separou
`MATCH_LONG_FORMAT_MAX_OFFSET_WORDS` (16385, formato/decoder) de
`ENCODER_WINDOW_WORDS` (0x4000, estratégia/codificador) e acrescentou 8 regressões
(16384/16385 aceitos, 16386 recusado citando o teto medido, `value 0` = off 1,
fonte-ROM acima do teto não-ROM aceita — limites independentes —, fonte-ROM além
do histórico recusada, truncamentos dentro de segmento estruturados, e um andador
de tokens que exige que todo offset não-ROM emitido caiba na janela legível).
Cabeçalho obsoleto do módulo corrigido (o arquivo já trateia streams prev-block).

**Prova externa obrigatória executada** (`Rust encode -> 68k decode`, fora do
roundtrip interno): 10 casos / 6 ROMs, todos com veredito esperado —
`i20..i24` (famílias emitidas pelo encoder atual: literais+cauda ímpar, curtos
off 2/off 1, longo auto-referente de 620 B, longo `value 0x0000`, dicionário
misto) idênticos no 68k e no jar; `i09` (stream **original** do recurso 0xc8cc8
com o menor prefixo-dicionário aceito pelo produto, medido em 4096 bytes)
idêntico; `i18` (edição canônica re-codificada pelo encoder **atual**) idêntico
no 68k, e o slot continua o bloqueio real: **150 bytes contra 144** →
`needs_space`, nada forçado por sobrescrita; `i14` é a prova profunda: off 16384
emitido pelo encoder, reproduzido byte a byte pelo hardware. Receita, pins,
SHA-256 por execução e limites do que está provado em
`docs/rex_profiles/LZ4W_68K_ORACLE.md`; evidência (logs, comprimentos, hashes —
**sem byte algum da ROM comercial**) em
`data/rex_profiles/integrator/lz4w-68k/evidence/2026-09-26/`; ferramenta de
medição vendorada com proveniência em `scripts/rex_profiles/integrator/lz4w_68k/`
(SHAs por arquivo em `PROVENANCE.md`). **As suítes A e B continuam não
integradas**; só a ferramenta de medição foi copiada, com origem no commit
`9b2389d` do worktree da agente-B.

**ETAPA C (precisão da observação) aplicada:** toda alegação de "não é
descompactado" foi rebaixada ao que foi medido — *nenhuma diferença observada nas
regiões que o core expõe* (`emulator_read_memory` regiões 2/3; CRAM e a
chamada/destino do desempacotador ficam `missing`, porque o core libretro não
expõe tracer e instrumentar o jogo exigiria modificar a ROM comercial, o que está
fora da autorização). O relatório do E2E passou a publicar `observed` e
`coverage` em vez de uma única frase conclusiva.

**Gates neste HEAD:** `cargo test --lib` **668 passed / 50 ignored**; `cargo
clippy -- -D warnings` limpo; `cargo fmt --check` limpo; testes BYOR ignoráveis
reexecutados antes do commit (`160/191` verificados, `preservados=159`, varredura
`fit=4` só no alvo conhecido). Frontend intocado por este checkpoint (a mudança em
`scripts/e2e-tauri-build-run.mjs` é texto de relatório/comentário, sem alteração
de asserção).

**Próximo comando exato:** retomar a ETAPA D — varredura limitada dos recursos
LZ4W com tiles comprovadamente em tela reutilizando `Lz4wDictionaryIndex`; se
nenhum couber no slot, o caminho autorizado é **aPLib em Rust canônico** com os
vetores da agente-B e oráculo independente, ou fixture SGDK autoral rotulado como
fixture (nunca como sucesso BYOR). Bloqueio concreto atual: **nenhum recurso LZ4W
conhecido aceita reinserção dentro do espaço original** (`fit=4` apenas em
0xc8cc8, todas as edições `needs_space`), e expansão de ROM/realocação de
ponteiros não está autorizada nesta rodada.


### Checkpoint 2026-09-26 — retratação da classe do alvo, sonda causal sem diferença observada e três defeitos de formato corrigidos (Experimental; sem merge)

O operador reabriu apenas o aceite semântico/visual do alvo 0xc8cc8. **Retratação**: a leitura "9 paletas × 16 cores" e o mecanismo "cor de transparência tornada opaca" eram inferências sem evidência de consumidor — retirados do estado corrente (histórico preservado nos checkpoints 2026-09-25 (b)/(c)). O "efeito de recolorimento dos lutadores" era **ruído de medição**: o resume do loop vivo entre runs separados avançava o jogo por tempo real variável, dessincronizando os frames comparados. A sonda causal nova — WRAM/VRAM lidas via `emulator_read_memory` (regiões 2/3 do GPGX; CRAM não é exposta) com run_frames determinístico — **não mediu nenhuma diferença** entre original e modificado em 900 frames, com controle original/original idêntico (determinismo e metodologia validados). **Precisão (ETAPA C, 2026-09-26): isso não prova que "o recurso 0xc8cc8 não é descompactado"** — a sonda só alcança as regiões que o core expõe (regiões 2/3; CRAM e a chamada/destino do desempacotador ficam `missing`). O que fica registrado é *ausência de diferença observada nas regiões amostradas*, que é enunciado mais fraco; consumidor continua **não provado** e a edição semântica deste recurso permanece **BLOQUEADA** (o E2E registra `semanticState: BLOQUEADO`, agora com campos `observed`/`coverage` explícitos, e exige frames idênticos).

**Três defeitos reais corrigidos nesta rodada**: (1) o encoder emitia matches longos não-ROM com offset até 0x8000 words, mas o 68000 lê o word de offset como int16 após duplicação — v < 0x4001 é referência PARA FRENTE, fora do formato; janela do encoder e validação do decoder restauradas ao limite oficial de 0x4000 (o 18bdff92, artefato do binário pré-correção, decodificava byte 30 como índice 1 com dano colateral em 36-44); (2) o preview em grade lia a faixa de tiles linearmente (`src=(y*8+x)*4`), escondendo edições fora do tile 0/linha 0 — mapeamento corrigido + teste de regressão; (3) a transação não verificava a ida-e-volta — agora redecodifica o novo stream com o mesmo dicionário e recusa qualquer divergência. Evidência de bytes: intervalo alterado [30,31), byte 30 0x00→0xF0 (pixel (0,7,4)→índice 15, a única edição que coube: needs_space honesto de 150>144 nas demais posições com o encoder corrigido). Índice de dicionário reutilizável (`Lz4wDictionaryIndex`) para a varredura (item 7); varredura orçada (64 candidatos/recurso, progresso, checkpoint promovido para `scripts/rex_profiles/integrator/analysis-2026-09-26/rex-scan-checkpoint.log`): fit=0 nos 18 recursos com tiles em tela. Simulação do desempacotador 68000 (`scripts/rex_profiles/integrator/analysis-2026-09-26/rex_68000_sim.py`, fiel a tools_a.s: COPY_MATCH, .lm_len via salto relativo, .lmr com tabela de paridade, ROM-source em espaço do stream): asm ≡ Rust nos streams decodificáveis; 25/191 headers são falsos positivos estruturais (tamanho 0/inválido). **Superação metodológica (2026-09-26): a simulação deixou de ser o padrão — o desempacotador real foi montado do `tools_a.s` oficial e executado sob MAME; ver checkpoint do integrador abaixo e `docs/rex_profiles/LZ4W_68K_ORACLE.md`.** E2E final: fluxo UI completo (verificar/prévia/no-op/editar/transação/BPS re-aplicado com hash exato/salvar-reabrir com prévia alterada `74c38128`/canvas == core 320×224/frames idênticos). 159 recursos verificados preservados. Gates locais verdes; push `0ba067b`+; sem merge/release.

### Checkpoint 2026-09-25 (c) — formato chunky corrigido e efeito observado no jogo pela UI (Experimental; sem merge)

O operador identificou o defeito que invalidava a prova visual anterior: tiles MD 4bpp são **chunky (nibble empacotado)** — `byte = tile*32 + linha*4 + col/2`, nibble alto na coluna par — e não planar. Confirmado na fonte (`ImageUtil.convert8bppTo4bpp` do rescomp do toolchain pinado: `result[i] = (data[2i]<<4)|data[2i+1]`) e consistente com o editor de tiles Sonic já existente (`sprite_composition`). Correção no produto: contrato único `md_pixel_location`/`md_read_pixel_index`/`md_write_pixel_index` (preserva o outro nibble e todos os demais bytes), **golden literal assimétrico** `12 34 56 78` -> índices 1..8 com expectativa escrita à mão (não derivada do renderer), testes de primeira/última posição, no-op e limites.

**Efeito observado no jogo, pela UI, com o E2E `rex-lz4w-effect` completo**: fluxo inteiro pela interface (verificar 160 recursos -> prévia chunky -> no-op -> edição pelo formulário pixel (0,0) índice 15 -> transação aplicada (159 preservados) -> BPS re-aplicado à cópia da base com hash exato -> **salvar/reabrir**: a ROM modificada reabre no painel com identidade própria e prévia de pixels diferente -> ROM modificada executada no core). Duas capacidades registradas em separado: framebuffer do core via `emulator_observe` (determinístico) e **apresentação pelo canvas do app** — o canvas 320×224 exibe byte a byte a subimagem 256×192 do core em (0,0) (HAMOOPIG usa 256×192; comparador localiza o conteúdo dentro do canvas). **Efeito**: frame 2 das timelines determinísticas, 3174 px em caixa (56,114) 208×94 — **os dois lutadores recolorem**. Explicação honesta: o alvo 0xc8cc8 não é tile — são **288 bytes = 9 paletas × 16 cores** (classe PALETA) e o pixel (0,0) editado é a cor 0 da paleta 0, a cor de transparência, tornada opaca; todo sprite com paleta 0 recolore. A asserção do E2E agora codifica o efeito esperado por classe (paleta: recolorimento da faixa dos sprites; tile: caixa pequena). hashes: modified `a51cfaf9…` (idêntico ao teste Rust — determinismo), patch `2aaf7808…`. Pendente honesto: recurso da classe TILE renderizando em tela que aceite edição transacional (varredura completa por tile em andamento a pedido do operador; 18 recursos com tiles em tela por casamento invariante de paleta recusam 1 pixel no tile 0). Gates: frontend/tsc/lint limpos, Rust 23 rex + suíte, fmt/clippy ok; push `da5851d`; sem merge/release.

### Checkpoint 2026-09-25 (b) — cadeia LZ4W pela UI até patch verificado; efeito visual bloqueado no alvo (Experimental; sem merge)

Na branch integradora `codex/rex-integrator-profiles-codecs` (PR #78), a cadeia de recurso comprimido chegou à UI do produto com transação canônica. **No produto (Rust + IPC + UI)**: `reinsert_transaction` com identidade SHA da ROM, evidência re-verificada contra os bytes, tamanhos/overflow, dicionário fixado, no-op explícito, dependências verificadas sobre o conjunto analisável declarado (160/191 recursos LZ4W verificados no corpus congelado; 159 preservados + 1 editado) e patch BPS pelo pipeline canônico re-aplicado à base com hash exato. Nova aba "Recursos comprimidos" no Reverse Workspace: listagem estrutural rotulada, prévia chunky 4x com pixels SHA-256, edição por formulário (tile/linha/coluna/índice) e por clique, proveniência com caminhos da cópia modificada e do patch. Aceites BYOR separados em testes `#[ignore]` com SHA-256 obrigatório (ausência de ROM = falha, nunca PASS silencioso).

**E2E `rex-lz4w-effect`** (binário canônico reconstruído): navegação pela UI, verificação (160 recursos), prévia, no-op, edição via formulário, transação aplicada, patch BPS re-aplicado à cópia da base com hash exato, e timelines original-vs-modificado no core Libretro com `emulator_run_frames` + `emulator_observe` (framebuffer direto do core, determinístico). **Resultado honesto: nenhum frame difere** — o alvo 0xc8cc8 (9 tiles, frame 24×24 confirmado pela estrutura SpriteFrame na ROM, classe faísca de golpe) não renderiza na janela explorada (boot, título, round, caminhada com contato, 6 golpes com snapshots densos); o protótipo teto pode não invocar faíscas visualmente. Negativos comprovados em produção: ROM com identidade errada recusada; dependente conhecido alterado recusado pela UI (`dependent_modified: 0x91a00 dependente de 0x8ff8e`); falta de espaço (`excessive_output`); resposta da transação distinta exibida como erro do painel. Bloqueio exato registrado: encontrar um recurso LZ4W com renderização observada (candidatos: estados de KO/fim de round; grafo de ponteiros SpriteDefinition -> TileSet para achar o recurso renderizado). Zero divergências nos 159 recursos verificados preservados — nada disso equivale o jogo inteiro. Gates: frontend 699/6, Rust 655/0/50, clippy/fmt/tree limpos; commits coesos, push `0a6f689`, CI por consulta pontual; sem merge/release.

### Checkpoint 2026-09-25 (a) — primeira cadeia real comprimida executada no produto (Experimental; sem merge)

Na branch integradora `codex/rex-integrator-profiles-codecs` (PR #78, sobre #77), o LZ4W SGDK foi implementado em Rust canônico (`src-tauri/src/tools/reverse/decomp/rex_codecs.rs`) com oráculo oficial bidirecional: `decode(produto, encode(lz4w.jar, x)) == x` e `decode(lz4w.jar, encode(produto, x)) == x`. Dois defeitos reais foram fechados durante o diferencial: (1) literais são words LE copiadas verbatim (não BE); (2) match longo exige comprimento ≥ 3 (byte extra 0 = "sem match") e o offset longo é negação de **15 bits** (`& 0x7FFF`). Descoberta estrutural decisiva: **todos** os ~190 streams LZ4W da HAMOOPIG congelada são prev-block (o ResComp empacota cada recurso com os bytes anteriores como dicionário, flag ROM source); o decoder ganhou `lz4w_decode_with_dictionary` (port exato do unpacker: offsetAdj +1/token, +1/word longo, -comprimento/match) e o teste de corpus verifica 100+ streams decodificando exatamente `numTile*32` bytes com dicionário = prefixo da ROM. O encoder ganhou dicionário + lazy matching (o autocontido dá needs_space em 157/160 — honesto, os originais dependem do dicionário).

Primeira cadeia real executada no produto (`rex_resources.rs`, teste `chain_scan_decode_edit_reinsert_on_frozen_corpus`): scan estrutural de headers TileSet -> verificação por decode exato -> edição determinística de pixel -> re-codificação com dicionário -> reinserção em cópia sem expansão -> diff de 74 bytes confinado à região do stream (header `0x25788`, stream `0xc8cc8`, 9 tiles; ROM original `558bea6c…` -> modificada `a51cfaf9…`) -> o stream reinserido decodifica para a edição e **todos os outros recursos verificam byte a byte idênticos** (nenhum dependente quebrado; candidatos com dependentes ou sem espaço são recusados de forma estruturada). Identificação é estrutural assistida e rotulada (header declara codec/tamanho), não descoberta automática. Pendentes para o aceite integral da rodada: prévia PNG no produto, IPC/UI, efeito observado no core Libretro via E2E desktop, aPLib decoder/encoder, perfis de endereçamento no produto. Agentes A e B entregaram parciais (PRs #80/#79) e estão bloqueados por limite de uso até ~15:21; MD linear completo do A (3 commits) e vetores Nemesis/Enigma/aPLib/LZ4W do B. Gates do integrador: 17 testes rex focados verdes, clippy/fmt limpos; sem merge/release.

### Checkpoint 2026-09-24 (e) — rodada REX paralela iniciada: contratos v1 e base confirmada (Experimental; sem merge)

Branch integradora `codex/rex-integrator-profiles-codecs` criada sobre `0d8c413` (sem merge/release; cadeia #75→#76→#77 conferida OPEN/MERGEABLE com bases corretas — #76 sobre `codex/nodegraph-organize-authoring`, #77 sobre `codex/reusable-behaviors`). Validação independente do integrador, distinta das provas do executor: o CI remoto do HEAD `0d8c413` agora está **verde em todos os checks** (`validate`, `linux-validate`, `desktop-smoke` consultados via `gh pr checks 77`), resolvendo a pendência do checkpoint 2026-09-25 (c); os quatro relatórios de prova foram reconferidos programaticamente (coleta 4/4, independência 6/6, NodeGraph 13/13, reference-platformer 16/16, todos `failed=0` e app SHA `9a6afe4b7c822b0ab750f8b518bb16376dae75b2698406161f3683d442d8a696`, binário local com o mesmo hash); o corpus local teve os quatro SHA-256 reconferidos (Sonic BYOR, HAMOOPIG, Taiketsu, doador PNG). Diff do harness `59714bd..0d8c413` revisado por inteiro: mudanças **endurecem** gates (avanço de quadros exigido, apoio real observado, liberação de B consumida pela ROM, trajetórias preservadas em falha, áudio medido durante fonte ativa com SFX de salto); nenhuma flexibilização detectada.

Contratos REX v1 congelados em `docs/rex_profiles/CONTRACTS.md` (perfil/evidência/endereçamento/codec/recurso comprimido; erros estruturados; status cumulativos separados; oráculo externo fixado antes da implementação). Estado da rodada e dono do job pesado único (integrador) em `docs/rex_profiles/ROUND_STATE.md`, matriz inicial toda `blocked`. Worktrees A (`/home/misael/RDS-REX-A-addressing`, branch `codex/rex-a-addressing`) e B (`/home/misael/Projects/REX-B-CODECS-2026-09-24`, branch `codex/rex-b-codecs`) sobre a mesma base `0d8c413`; prompts A/B/integrador versionados em `docs/handoffs/`. Corpus preservado intacto e somente leitura para A/B. Próximo passo: publicar branch, alinhar A/B com os contratos, agentes em paralelo e integração MD linear/SSF2 + aPLib/LZ4W com cadeia real comprimida.

### Checkpoint 2026-09-25 (c) — PR #77 e correção de gate Desktop E2E no CI (Experimental; sem merge)

Branch `codex/collect-counter-goal` publicada, PR dependente [#77](https://github.com/Misael-art/RetroDevStudio/pull/77) contra `codex/reusable-behaviors` (#76), sem merge/release. O primeiro Desktop E2E remoto do HEAD `5eaa4af` falhou em `reference-platformer` por duas asserções herdadas do comportamento antigo: procurava `static s32 logic_var_reference_score` embora o C atual declare `static volatile s32` desde `6ab0b44`, e exigia áudio não nulo numa janela tardia após o VGM do template (gerado para tocar meio segundo e terminar). O E2E agora exige explicitamente a declaração `static volatile s32`, mantém comparação de layout não vazia/igual após salvar e reabrir, e aciona um SFX de salto pelo teclado nativo para medir crescimento de frames não nulos recebidos e renderizados no AudioContext durante uma fonte ativa. A prova acústica/loopback permanece separada e inconclusiva quando indisponível. Regressão local `reference-platformer-2026-09-25T01-09-09-520Z-report.json` passou 16/16 no mesmo app SHA `9a6afe4b7c822b0ab750f8b518bb16376dae75b2698406161f3683d442d8a696`; projeto preservado em `/home/misael/Documents/RetroDevProjects/Reference_Platformer_1790298551976`. Novo CI do commit de follow-up ainda pendente neste checkpoint; não usar o CI falho anterior como aceite.

### Checkpoint 2026-09-25 (b) — guarda por instancia e validação integrada (Experimental; sem merge)

Na branch `codex/collect-counter-goal`, sobre HEAD inicial `59714bd`, foi confirmado um defeito real distinto do falso negativo do salto: duas entidades com grafo serializado idêntico e mesmo `node_id` compartilhavam a guarda de `event_start` (`graph_sha256` truncado + nó), de modo que só o primeiro script de início executava. O teste em `ast_generator.rs` usa AST real e C emitido, falhou antes da correção (1 declaração para 2 entidades) e passou depois. A guarda agora codifica `entity_id` e `node_id` em hexadecimal, preservando identidade sem colisão da sanitização ou hash curto; `event_update` segue por quadro. Nenhuma mudança em `volatile`. O harness desktop passou a esperar apoio/borda de input efetivamente consumidos na ROM e registrar trajetórias de RAM, sem afrouxar negativos.

Gates: `cargo fmt --check`, `cargo clippy -- -D warnings`, Rust 634 passed / 47 ignored, lint, `tsc --noEmit`, frontend 696 passed / 6 skipped, `check:tree`, `node --check` do E2E e `host:certify` passaram. Build canônico `npm run build:debug` com frontend atualizado gerou o app SHA `9a6afe4b7c822b0ab750f8b518bb16376dae75b2698406161f3683d442d8a696`. No mesmo binário, em sequência: `collect-goal-2026-09-25T00-25-09-531Z-report.json` 4/4, ROM `4ffc4da9478869c876459cb46205a9c6d503a2fb2624b99c023239aac340dccd`; `behaviors-independence-2026-09-25T00-31-49-668Z-report.json` 6/6, ROM `56f014ff828a7e5e018241abb579a8394dd4793f12863e4b36c8644755061a98`; `nodegraph-authoring-2026-09-25T00-46-31-751Z-report.json` 13/13, ROM `3044e663a6285c9622d28a0a3fd11dee888a1e48c2d2daa3225596bd8f09bd04`. Projetos gerados foram preservados com `RDS_E2E_KEEP_PROJECT=1`. Tentativas falhas e trilhas permanecem em `target-test/validation`: apoio ainda falso no primeiro toque, botão ainda não liberado na ROM, amostragem que perdeu quadros intermediários, e uma colisão transitória na porta 4444 do driver. Nenhuma dessas falhas foi promovida a prova positiva.

Provas: coleta creditou cada item uma vez, contador 1→2, passagem abriu em 2, objetivo one-shot e recarga da mesma ROM zerou contador/flags; pixel B e áudio sem linha de base continuam inconclusivos. Salto: ápices J1/J2/segurado/J4 15/15/15/15, pressão no ar sem reinício, botão segurado sem novo salto no pouso, apoio independente; passagens bloqueadas dos dois lados, saída de sobreposição e abertura no limiar com C independente ainda fechada. NodeGraph incluiu troca real Z→X, persistência/reabertura e vitória por teclado. Limite: "reiniciar partida" provado aqui por recarga da ROM; reinício de cena e reset interno não foram equiparados. Passagem continua restrita ao movimento horizontal do comportamento. Próximo passo: revisão final do diff/staging, commits coesos, push da branch e atualização do PR dependente; acompanhar CI sem merge/release.

### Checkpoint 2026-09-25 — reprodução do salto e causa das falhas do E2E (Experimental; sem correção de produto)

Na branch `codex/collect-counter-goal`, HEAD `59714bd`, o app SHA `77ec65468b424ef5d1049dc2e4250581bf866f35d5028c58110305d0a9bdfa94` foi reexercitado pelo E2E `behaviors-independence` com `--skip-build` e `RDS_E2E_KEEP_PROJECT=1`. Falha J1 reproduzida na ROM SHA `b2371fa816f4a59c05da44152fecafba6578331c8246f3be1823ec408e1c2ee2`; projeto `/home/misael/Documents/RetroDevProjects/Behaviors_1790294005954`, trilha `src-tauri/target-test/validation/behaviors-independence-2026-09-24T23-53-24-306Z-failed-salto-J1-trace.json`. O ACK nativo de X/B foi verdadeiro, mas na ROM o Player 2 ficou em `y=176`, `vel_y=0`, `_on_ground=0` durante o toque; somente depois o apoio virou 1. A espera inicial inferia apoio por Y estável sem verificar o apoio real. O C gerado preservado contém o ramo `BUTTON_B && !rds_joy_prev_1`, a condição `spr_player__player_2_on_ground` e a escrita de impulso `spr_player__player_2_vel_y = -64`. A falha J4 posterior mostrou ACK de soltura com `rds_joy_prev_1=16` ainda na ROM no momento da nova pressão: faltava um quadro de liberação consumido. Outra falha de medição contava ápices só depois do toque, omitindo a subida durante o toque. Não há evidência de que `volatile` ou a guarda `event_start` tenham causado essas falhas.

O harness `scripts/e2e-tauri-build-run.mjs` agora observa posição, velocidade, apoio e botão anterior na RAM, grava trilha integral quando `sampleUntil` falha, espera apoio real e a liberação de B consumida pela ROM, e inclui amostras do toque no ápice. Reexecução no mesmo app: `behaviors-independence-2026-09-25T00-02-10-776Z-report.json` passou 6/6; ROM SHA `d6c6a845cd2cabe24868a3219dd62c470440d8e26e7748bec339874cc9eb1ac7`. Salto: ápices J1/J2/segurado 15/15/15, J4 11, Player 3 5, Player 2 enquanto Player 3 no ar 11; passagem A/B abertas em score 28 e C fechada. Projeto completo preservado em `/home/misael/Documents/RetroDevProjects/Behaviors_1790294533598`; C gerado SHA `724200fe8fedd1fe773cc859d3263945adcc26972a2a111772512e6987008fbc`, ELF SHA `65b8ce616ff0879f1425e661b0b82b3c572a5e9e501feddfc0c9de8a3ecfe3ef`, ROM local coincide com o relatório. `node --check`, `check:tree` e `git diff --check` passaram. Próximo trabalho: avaliar guardas de `event_start` para duas instâncias equivalentes no AST/C real e executar os três E2Es sequenciais após build canônico e gates; coleta 4/4 neste app é prova herdada, `nodegraph-authoring` ainda não foi reexecutado neste app. Nenhum commit ou push nesta etapa.

### Checkpoint 2026-09-24 (d) — diagnóstico inicial da regressão de salto (Experimental; sem push)

Handoff recebido na branch `codex/collect-counter-goal`, HEAD `59714bd`, três commits à frente de `origin/codex/collect-counter-goal`; somente `data/canonical-local-2026-09-21/` está não rastreado e deve ser preservado. `npm run host:diagnose`: READY (fingerprint `60249508…`, lock `dd99a22f…`). Antes de build pesado: 84 GiB livres, 6,3 GiB de RAM disponível; não encerrar processos de outras sessões.

Evidência herdada: `collect-goal-2026-09-24T21-15-11-612Z-report.json` passou 4/4 no app SHA `77ec65468b424ef5d1049dc2e4250581bf866f35d5028c58110305d0a9bdfa94`, ROM SHA `3754f582f063c59fb42007717f11393ef21595583137bb64a70e5b01860251a2`. O `keyboard_collect_goal` registra contador 1→2, passagem fechada→aberta, objetivo uma vez e recarga da mesma ROM com estado zerado. Pixel do item B e áudio sem controle não são prova. Os últimos relatórios de `behaviors-independence` e `nodegraph-authoring` completos são anteriores (app SHA `12dc97d9…`); tentativas posteriores deixaram screenshots `21-23-34-639Z` e `21-20-08-009Z`, mas não relatório final. Não reutilizar esses relatórios como aceite do app atual.

Hipótese atual ainda não confirmada: possível interação de ordem/estado na ROM gerada após a guarda `event_start`; `volatile` não está implicado. Inspeção inicial: o comportamento de salto começa em `event_update`, lê `input_pressed` e `condition_on_ground` da entidade alvo; `sgdk_emitter` emite lógica no `SpriteUpdate`, com `rds_joy_prev` atualizado no `VSync`. A física escreve `_on_ground` por entidade. O teste auxiliar `generate_ast` em `ast_generator.rs` remove guardas e não serve para validar o programa final; `event_start_runs_once_per_match_not_every_frame` usa AST real, mas não cobre duas instâncias equivalentes. Próximo passo exato: preservar um projeto/reprodução atual e seu `main.c`, ROM, hashes e trajetória RAM; comparar C com `edb3477`, identificar onde o impulso some e então escrever regressão que falhe antes da correção. Rodar os três E2Es no mesmo novo binário apenas depois da correção e dos gates. Nenhuma mudança de produto foi feita neste checkpoint.

### Checkpoint 2026-09-24 (c) — salto do chão e prova física da passagem (Experimental; sem merge)

PR #76. Salto de "Movimento e salto" só com apoio (novo nó `condition_on_ground`, estado de apoio por entidade medido em todo quadro na física SGDK). Passagens encadeáveis no mesmo movimento. E2E `behaviors-independence` 6/6 no binário `12dc97d9…` (commit `dec2f65`): salto do chão, pressão no ar sem reinício, segurar sem voo, novo salto após pousar, apoio independente; passagem bloqueia pela esquerda/direita a 8 px/quadro sem sobrepor a colisão, quem começa sobreposto sai, atravessa no mesmo lugar após o limiar e a outra passagem (60) segue fechada — tudo por posição na RAM contra limites de colisão. `nodegraph-authoring` 13/13 no mesmo binário. Matriz: `docs/REX_BEHAVIORS.md`.

### Checkpoint 2026-09-24 (b) — comportamentos reutilizáveis (Experimental; sem merge)

Branch `codex/reusable-behaviors`, dependente do PR #75. "Movimento e salto" e "Passagem condicionada" parametrizados, gerando nós canônicos; instâncias com id único na cena, plano com conflitos antes de aplicar/editar/remover, duplicação de entidade remapeando comportamentos. E2E `behaviors-independence` 6/6 no binário `ccd0dab9…` (commit `9fb0c89`): duas cópias do jogador com controles/velocidades próprios, editar/desfazer, cópia remapeada, remoção, reinício e teclado com controles negativos; passagem abre no score 20. Defeitos corrigidos: salto sem efeito em entidades que compartilham sprite (variável de física errada no gerador), cópias de prefab herdando lógica manual/`graph_ref`, edição perdida ao trocar de entidade, commit obsoleto após refazer, grupo recolhido encobrindo nós. `nodegraph-authoring` reexecutado 13/13 no mesmo binário. Matriz: `docs/REX_BEHAVIORS.md`.

### Checkpoint 2026-09-24 — NodeGraph organizado e editável (Experimental; sem merge)

Branch `codex/nodegraph-organize-authoring` (sobre a arte da raposinha). Organizar pelas conexões reais (só posições, semântica guardada), fixar, organizar seleção, desfazer/refazer com Ctrl+Z/Ctrl+Y, registro visual único, cartões em português com entidade/miniatura, portas tipadas, ímã de conexão com Esc, grupos e navegação por entidade, regras editáveis com "Senão". E2E desktop `nodegraph-authoring` 13/13 no binário `bcd94007…` (commit `bb0b2d0`): pulo trocado de A/Z para B/X comprovado jogando, limiares 12/60 independentes, som `victory`, sobreposições 93→0, reinício/reabertura preservados, grafo de 106 nós em 22 ms. Corrigidos: `BUTTON_START`→`BUTTON_A`, histórico apagado pelo eco do autosave, Backspace apagando nó. Usabilidade humana não validada. Matriz: `docs/REX_NODEGRAPH_AUTHORING.md`.

### Checkpoint 2026-09-23 (d) — arte da raposinha e paisagem no template (Experimental; sem merge)

Branch isolada `codex/reference-platformer-fox-art`. Os placeholders do template `reference_platformer` foram substituídos por candidatos técnicos criados a partir de fontes originais: raposinha kawaii de cachecol vermelho e espada de madeira (cinco quadros 32×32), portão 24×32, bandeira 16×32 e fundo de montanhas/floresta 320×224. Conversão e workset validados com o SGDK Forge; primeiro plano de grama/terra/tijolo continua provisório. A arte é `technical_candidate`, com aprovação estética humana pendente. Rebuild desktop do commit `9901b5f` SHA `9224bdd04343d14402e83b61d842a4ee0fe485c62805bb6715b1fbcfc629cb37`; autoria guiada 10/10 e reference-platformer 16/16 reexecutados nesse binário, incluindo salvamento/reinício/reabertura e vitória por teclado. Evidências finais versionadas e hashes em `data/reference_platformer_art/README.md` e `data/reference_platformer_art/doc/evidence/`; evidências anteriores preservadas. Não confundir este checkpoint com o aceite de arte final.

### Checkpoint 2026-09-23 (c) — autoria guiada ponta a ponta (Experimental; sem merge)

Aceite `authoring-acceptance` passou 10/10 no binário `6cebe930…` (commit `a6c02af`): criar fase, ver recursos, editar cenário/colisão/animação, duas passagens, associar som, salvar, reiniciar, reabrir, compilar e vencer jogando pelo teclado, com o som `victory` observado nas amostras recebidas do core. Corrigidas perdas silenciosas de trabalho (recarga do disco na hierarquia e no salvar com falha, debounce do NodeGraph), PPM no WebView, overrides de prefab, semântica de tile vazio, paredes laterais e identidade da ROM no Build & Run. Regressões reexecutadas: reference-platformer, ADDQ, branch-compare, reinserção Sonic. Matriz: `docs/REX_AUTHORING_ACCEPTANCE.md`.

### Checkpoint 2026-09-23 (b) — cenário/colisão/animação pela UI e reinserção gráfica em ROM (Experimental; sem merge)

E2E `reference-platformer-2026-09-23T03-06-00-927Z-report.json` 16/16: fosso pintado (visual + colisão) e FPS idle 12 editados pela UI chegam à ROM (descida física no fosso, região visual alterada vs. controle, troca de frame a cada 5), junto com a segunda passagem. Corrigidos: reidratação do NodeGraph que apagava edições locais; override parcial de sprite em instância de prefab que invalidava o salvar (outras edições aninhadas do Inspector em prefabs não auditadas); validação do NodeGraph para referência de entidade e parâmetros. Etapa 6: reinserção de tiles 4bpp com tamanho preservado no frame Sonic stand (DPLC `0x217FE`, tiles 11..16 compartilhados com o frame 5), E2E `inspection-sonic-tiles` passou (negativos, BPS, base intacta, 96 pixels no torso em jogo, reabertura). Regressões reexecutadas: Sonic paleta + jogo canônico, ADDQ e branch-compare verdes. Pendentes: associar SFX pela UI, concluir o objetivo por teclado nativo no fluxo autoral, loopback acústico.

### Checkpoint 2026-09-23 — fluxo autoral: input real, SFX audível, passagens reutilizáveis (Experimental; sem merge)

Branch `codex/rex-reference-goal-pilot`, commit `c3f6de4`. Corrigidos defeitos que invalidavam provas anteriores: KeyZ chegava como MD C (GPGX: RetroPad Y=A), Build & Run deixava `coreEpoch` obsoleto (teclado recusado; o fallback no core mascarava), `SOUND_PCM_CH_AUTO` tornava todo SFX XGM v1 mudo, `input_pressed` era "segurado", BGM reiniciava por frame, passagem só bloqueava pela direita, entidades de mesmo asset colapsavam, colisão pintada não tinha efeito físico. E2E `reference-platformer-2026-09-23T02-17-00-937Z-report.json` (binário `95095d3d…`) passou 15/15, incluindo salto/movimento nativos lidos da RAM, áudio encaminhado ao AudioContext e segunda passagem criada pela UI (Inspector duplicar/posicionar + painel Passagens) com abertura independente. SFX de vitória provado por teste real contra controle com WAV silenciado. Loopback acústico inconclusivo no host. Pendentes: animação na ROM, validação de regra pela UI, autoria completa sem preparação, reinserção gráfica em ROM. Matriz em `docs/REX_REFERENCE_GOAL_PILOT.md`.

### Checkpoint 2026-09-22 — passagem transitável ligada ao objetivo autoral (Experimental; sem merge)

A branch dependente `codex/rex-reference-goal-pilot` agora mantém entidade `passage_blocker`, marcador `goal` e sensor `goal_sensor` separados. O bloqueador visual e sólido é contornado somente quando `goal_open` vale 1; inputs equivalentes observaram player `x=41..50` bloqueado e `x=57..66` após atravessar, com pixels da barreira `399→0`. O score foi lido da RAM real nas fronteiras abaixo/igual/acima de 6 e 12, e após 8 frames: score 8 em ambas as ROMs, abrindo só limiar 6. O grafo/C compara o score já armazenado após incrementar. A UI expõe `Pontos para abrir passagem`; foi exercitado editar 6→12, salvar, fechar/reiniciar, reabrir e confirmar source mapping antes de compilar/executar.

E2E desktop final `src-tauri/target-test/validation/reference-platformer-2026-09-22T23-32-40-004Z-report.json`; binário exercitado SHA `f0eada419f91f8b05b0a0ddf2484684f14ef0bf0b9fbb85eb23235e68c72e319`. As ROMs imutáveis testadas: limiar 6 `0351d890630885daf2115fca32c6c94bcc6d4461f721f9516150960b59adcd8c`, limiar 12 `bd97076a3a85c1bd3b5b2986664bb1214b1fc975bf28ba4ef6b457597afd87ee`. O contato real com sensor leu `goal_reached=1`; no C gerado, a chamada PCM precede a escrita one-shot observada. A captura acústica desta chamada não é medida. O smoke genérico de salto fica separado e inconclusivo se faltar ACK/efeito visual; isso não é usado como evidência da passagem. As capturas, fonte e cópias ROM são anexadas pelo workflow Desktop E2E.

O perfil e o comportamento seguem **Experimental**, limitados ao grafo/template Mega Drive provado. ADDQ e branch-compare continuam regressões separadas; sem aumento do conjunto de instruções, sem declaração de suporte geral e sem merge. Consulte `docs/REX_REFERENCE_GOAL_PILOT.md` para a matriz comprovado/pendente.

### Checkpoint 2026-09-22 — perfil ROM→Node delimitado (Experimental; implementado; equivalência e causalidade pendentes)

Foi implementado o primeiro perfil de recuperação de lógica ROM com contrato exato: Mega Drive/M68K, `ADDQ.W #1,D0; RTS` em quatro bytes contíguos, source mapping por offset/hash, flags word completas, nenhum efeito de memória, estados independentes e patch somente para cópia distinta com SHA-256 e imediato `1..8`. A UI `ReverseWorkspace` e o NodeGraph carregam o nó `rom_addq_word`, com origem `rom_recovered`, sem sobrescrever lógica existente. O emissor SGDK materializa a semântica preservando `D0[31:16]`; o emissor SNES bloqueia explicitamente esse perfil MD-only.

Limitações são parte do contrato: callers indiretos/PC-relative e trace dinâmico continuam desconhecidos; a varredura estrutural lista apenas `JSR` absoluto; bytes fora do corpo de quatro bytes não são inferidos. A fixture durável `src-tauri/tests/fixtures/logic_recovery_sgdk/` (com o resumo versionado `e2e-proof-report.json`) e a receita `npm run fixture:logic-recovery` agora cobrem separadamente node→C→ROM e rotina vinculada→patch→ROM. O E2E final `src-tauri/target-test/validation/logic-recovery-2026-09-22T14-06-47-769Z-report.json` passou com SGDK/Genesis Plus GX oficiais: estado/input comum `0x12340058`, warmup controlado de 120 frames, uma asserção, oracle independente de D0/flags em WRAM, node/original-original/no-op/#2, hashes completos e reabertura com operação, conexão e source mapping. O ROM efetivamente gerado pelo grafo reaberto é identificado como `generated_from_reopened_nodegraph` e foi observado como `0x12340058→0x12340059`; original #1 repete o resultado e patch #2 produz `0x1234005A`. O relatório também fixa o binário Tauri realmente testado pelo SHA `47afc7269b9873d8664abe9594375482c00f3b77b09b76235b1f14d457cb8c78`. ROMs: node `6d4fb26780426fd73c010840d4facbd8059ddeb29e4e777106a1fa9fb63f18a4`; grafo `728be5cb72b7a38704a1acdd70db7e47801265f921cf6b14902ca060461aa7a8`; rotina `2e0a6b19b6f73891e16a5a23c4df211721e13eb59b0431b43ceb9601bb181ce2`; patch #2 `08c69960430610c983f0721a63ac8f538d74fc8896c7927abfda8e9621af7e86`. Isso fecha a causalidade somente para o perfil/fixture delimitado, não equivalência geral, Sonic ou callers reais. A ROM autoral `/tmp/rds-reference-platformer-proof.bin` continua corretamente rejeitada.

### Checkpoint 2026-09-22 — autoria persistente de tilemap (Experimental)

O relatório fresco `src-tauri/target-test/validation/reference-platformer-2026-09-22T02-58-57-254Z-report.json` fecha o fluxo desktop nativo do template `reference_platformer`: paleta PPM `P6` carregada por IPC seguro de bytes do projeto, pintura `col=1,row=25` `0→2`, undo/redo `0→2`, colisão separada preservada em `88`, save, leitura do JSON salvo, reabertura com valor `2` e rebuild. A ROM inicial/autoral mudou a ROI do tilemap de `92e737c5` para `26a7da45`; o mesmo hash foi observado após a reabertura. O emissor SGDK agora transporta `cells[]` como overlay esparso via `VDP_setTileMapXY`, preservando o mapa-base carregado por `VDP_drawImageEx`; `cells` vazio mantém o caminho legado. O tileset PPM não depende mais do `asset://` MIME/decoder do WebView na paleta.

O cenário continua `Experimental`: a prova é do jogo builtin autocontido, não de equivalência/reconstrução de ROM comercial. O checkpoint de tilemap antecede o aceite inicial do bloco F, registrado acima; esse aceite é restrito à fixture SGDK e ao perfil `ADDQ.W #1,D0; RTS`.

### Checkpoint 2026-09-21 — template builtin de jogo de referência (Experimental)

Na branch `codex/rex-sonic1-pilot`, foi adicionado o template registry `reference_platformer` e sua materialização nativa no backend. O projeto é autocontido para Mega Drive: player com três animações, colisão/física/input, objetivo com overlap, tilemap/mapa de colisão, câmera, dois SFX, BGM VGM e NodeGraph de movimento/salto/objetivo. Assets são gerados pelo próprio template; não há ROM comercial, BYOR ou dependência de corpus.

Prova local real: build com SGDK oficial detectado no host produziu ROM com assinatura `SEGA`; a ROM carregou no núcleo Libretro oficial, executou 45 frames com `Right`, mudou o framebuffer e manteve pixels não vazios. Um conflito inicial de símbolos (`goal` sprite vs. `goal` SFX) foi corrigido renomeando o SFX para `goal_sound`. O template e o build real têm testes dedicados; o template continua `Experimental`.

Em 2026-09-22, o cenário WebDriver nativo `reference-platformer` passou no binário canônico: wizard, quatro entidades visíveis, NodeGraph persistido, salvar, build oficial, ROM de 524.288 bytes com cabeçalho `SEGA`, framebuffer 320×224 não vazio, ACK nativo de Right/A, movimento (`diffBytes=924`), salto (`diffBytes=462`), pausa/retomada, fechamento, reabertura e novo build/run. Relatório final: `src-tauri/target-test/validation/reference-platformer-2026-09-22T01-29-49-822Z-report.json`. O emitter SGDK agora carrega paletas sem sobrescrever `PAL0` de tilemap, marca sprites como `VISIBLE`, escreve velocity runtime para `set_velocity` e limita a física ao piso derivado do collision map.

Na mesma base, a inspeção visual desktop passou para HAMOOPIG e Taiketsu usando somente as referências preservadas localmente: HAMOOPIG `558bea6c…f8529be9`, candidato independente `42128/192`, preview `256×16`, frames `spr_ryo_100/frame-0..4`, persistência e recomposição após reinício; Taiketsu `3967996a…42bc7c`, `spr_spark0/frame-0`, nativo `24×24`, pixels idênticos antes/depois da reabertura. O cenário Sonic atual passou a identificação, composição, edição de paleta, BPS, comparação base/aplicada e integridade da BYOR, mas expirou no segundo trecho de boot da trajetória canônica; portanto essa reexecução não é contada como aceite novo do gameplay Sonic, e a evidência aprovada anterior permanece explicitamente histórica.

O teste manual `reference_platformer_real_toolchain_build` agora também exige stream de áudio Libretro não vazio e não silencioso depois do build oficial; passou com SGDK/Libretro instalados. Isso comprova playback determinístico do core para a música autoral do template, não equivalência de hardware. Pintura/undo-redo de tilemap ainda tem cobertura unitária/UI, mas não uma prova desktop autoral dedicada; recuperação de rotina ROM para nós continua bloqueada por ausência de rotina delimitada, source mapping e equivalência independente.

Não alterar as decisões arquiteturais consolidadas por causa desta fatia. Ainda faltam a prova de edição autoral detalhada de sprites/tilemaps/áudio, a recuperação de rotinas ROM para nós e qualquer afirmação de equivalência com jogos importados.

### Checkpoint 2026-09-20 — Sprite-Frame-02 multi-recurso (Experimental)

Branch isolada `codex/rex-sprite-frame-02`, commit de implementação `470ae81`, dependente de `codex/rex-sprite-frame-01-integration`, sem merge. A composição assistida foi generalizada para `spr_ryo_100/frame-0..4` (frame 4 deduplicado com frame 2) e para `spr_spark0/frame-0` de Taiketsu. ROMs BYOR: HAMOOPIG `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`; Taiketsu `3967996af4efe197284dd80e48a3b457aa381f8e0ba098851b5dbb59fc42bc7c`. Fontes: Ryo `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`; Spark `cafaf180ba006903242aa822fb3c0dceb42424a9e0bd07a5a19b75f33a4bf196`.

Destino local verificado: binário `src-tauri/target-test/debug/retro-dev-studio`, SHA `743e22d58668a47734b1ace47fd597e35554303c9e2527765d6a3f9ed0fba476`, frontend `791d6a7`. Taiketsu desktop passou seleção nativa, pixels independentes antes/depois, salvar, reinício, atualização visual da lista persistente, reabertura e recomposição na sessão `inspection-1789914271-00000000`; pixel independente `601829b5a8ab8853fdc1d9047f95ecdfcc6e0f91f73a88ae226ad55c3e70679f`; offsets `0x80060+0x120`, paleta `0x2e134+0x20`, descritor `0x22f94`, nativo `24×24`, CSS `72×72`. Cancelamento separado fechou `cancelled` na sessão `inspection-1789914403-00000000`. A prova Ryo dos frames 0–4 é histórica e vinculada ao binário `082c66d…`; matriz em `docs/REX_SPRITE_FRAME_02_MULTI_RESOURCE.md`.

Classificação permanece Experimental e restrita às ROMs/recursos comprovados. A ROM fornece bytes/offsets/paleta/descritores; metadados do doador fornecem identidade semântica, frame, posições/flips/transparência e transformação do compilador. Não declarar extração automática geral, animação ou reconstrução do jogo.

### Checkpoint 2026-09-20 — destino combinado #70 + #71 certificado e reexecutado

Ancestralidade revalidada por SHA: #69 = `ee70bc4444830eaaa5914175729e23feca06b94e`; #66/#67/#68 = `ba637cf`/`9f77b40`/`09e1d13`, nenhum ancestral de #69. `10c89d1` não é ancestral de #69; seu patch equivalente `e998bbd` é que está na linha de inspeção. O #70 (`8843018`) é ancestral do #71 (`d9fe40d`), e os heads REX chegaram ao destino por `177c831`, `63e730d` e `af6c0f3`. O resultado combinado está sendo preparado em `codex/rex-sprite-frame-01-integration`, sem merge. A comparação de código/testes e a distinção entre ausente, equivalente e presente estão registradas no Current Wave e em `docs/REX_SPRITE_FRAME_01_HAMOOPIG.md`.

Os holdouts `.mimosa`, `.zcode`, `src-tauri/.mimosa` e `src-tauri/src/tools/reverse/decomp-recovery/` permanecem não rastreados e não staged; não foram restaurados nem removidos. No destino `codex/rex-sprite-frame-01-integration`, `check:tree`, lint, tsc, Vitest `622/6`, Rust `615/40`, clippy/fmt e `host:certify` passaram; a certificação reportou frontend `625/3`, Rust `615/40` e upstream SGDK/PVSnesLib `Success: true`.

O build canônico do `d9fe40d7b5fcf56127889e4e1095413083b8dd63` gerou `/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/debug/retro-dev-studio`, 370.695.936 bytes, SHA `e1174d3b0ef8ff45c41dea91535050f99e9f4fc55368a99cd379ca52c86d460c`. A prova desktop no mesmo binário passou com ROM HAMOOPIG SHA `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`, sessão `inspection-1789907881-00000000`, run `run-inspection-1789907881-00000000-00000001`, candidato `42128/192`, frames 0→1→0, pixels independentes, mutação rejeitada, salvar/reiniciar/reabrir e negativo de wizard. O cancelamento foi separado e passou com sessão/run `inspection-1789907951-00000000`/`run-inspection-1789907951-00000000-00000001`, ambos `cancelled`.

Capturas do destino: frame-0 `inspection-2026-09-20T12-37-49-567Z-sprite-frame-0.png` SHA `0fd0d4c5bec385a8594cbb4a93f2d57c81698381588876306c35cb4c8c0a7784`; frame-1 `...sprite-frame-1.png` SHA `d25bc82ebfba9d2a1318dd77d8a8b42b04e167b338d33bb59eec4e7b931a6ec0`; sprite após reinício `...sprite-after-restart.png` SHA `7aa6a80a850159f9e1c8aeb02ee931012776e2640ae7a6706b8811d6dbb43685`. O fluxo permanece Experimental e sem merge.

### Checkpoint 2026-09-20 — PR #71 frame-0/frame-1 reexecutado no HEAD final

No branch isolado `codex/rex-sprite-frame-01`, o HEAD `f0d33470f7e677ab6f5012e0488c152e1258c667` contém o código já provado do PR #71 e o rustfmt exigido pelo CI (`f0d3347`). O build canônico `/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/debug/retro-dev-studio` foi refeito com sucesso e tem SHA-256 `e0fec553aceb18df25d30fc22d3655ff8b8f3fdfc00b6fbbed69a28b87da8982`. O frontend runtime da prova desktop corresponde ao commit de código `5b16970d2c35057805e1ea509da077cade5c13fd`; `f0d3347` é apenas formatação de teste Rust.

ROM BYOR: `/home/misael/RetroDevStudio/investigation-sgdk-equivalence-2026-09-10/hamoopig/reference.bin`, 917.504 bytes, SHA `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`. Fonte PNG doadora: `/mnt/sdcard/Projects/Sgdk Forge/SGDK_projects/HAMOOPIG [VER.001] [SGDK 211] [GEN] [ENGINE] [FIGHTING]/res/sprite/ryo/100.png`, SHA `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`; ambas foram preservadas, sem substituir a ROM atual do projeto.

E2E desktop final da seleção `frame-0 → frame-1 → frame-0`, sessão `inspection-1789869813-00000000`, run `run-inspection-1789869813-00000000-00000001`: passou com o rótulo correto `label=prévia anterior removida na troca` e `previousPreviewRemovedOnChange=true`; esse E2E comprova limpeza da prévia anterior na troca, não resposta fora de ordem. A prova determinística de resposta fora de ordem está em `src/components/tools/InspectionPanel.test.tsx:335`: promises controladas mantêm A pendente, B conclui e A é liberada por último; imagem, seleção e proveniência B permanecem. Identidade da ROM/sessão/candidato, offsets e tamanhos foram confirmados no desktop. Frame-0: `0x863A0+0x800`, descritor `0x22260`, paleta `0x2CC68+0x20`, nativo `64×104`, CSS `192×312`, PNG `8bb4dc723fa4d9435f6eaa3ce1c2248df7a20e30b800a6c56bfdd0a54fa96168`, canvas `c70a3dfcb4726662c8f8588f6c5ab576f9b64ff7f37198fc72dcae151fde22dc`, referência RGBA independente `50cba0a2432bb73bcfc5a9c2b0e42668935df3a4c7c2b8e8a0f0e88c3bf46c58`, índices `938611103b7d79af7e599fe024fa4adef53a8de898d9a06e00d9da15e451196c`. Frame-1: `0x86BA0+0x840`, descritor `0x222A2`, mesma paleta, nativo `64×104`, CSS `192×312`, PNG `48f82e1ccfb3e96552858cdeb99e535c1823b23e7f938286024d43a047f0fdc8`, canvas `c63a0fd26c561806f5319fb24380983db10b99998048c678f81d2bf45c7fbde0`, referência RGBA independente `15dab9d16df147cc1bb81348fbc0d0a7e65458b34d3d77541df536024af768d0`, índices `77b3b0dba715b352c3ace058abefa5d5d1918d2393dc2064b60a9ed01e0e1903`.

Salvo com frame-1 selecionado, o app foi encerrado e reiniciado; wizard tratado somente por controles visíveis. A seleção, composição, proveniência, ROM, sessão, candidato `0xA490+192` e offsets foram restaurados; pixels foram capturados novamente, CSS `192×312`, escala inteira 3×, `pixelated`, `fullyVisible=true`, `unobstructed=true`. Negativo do wizard: `unobstructed=false`, `selectionUnchanged=true`, `syntheticEvents=false`. Negativos de frame desconhecido e associação frame/metadado divergente foram rejeitados sem reutilização de preview anterior. Capturas finais: frame-0 `inspection-2026-09-20T02-03-19-690Z-sprite-frame-0.png` (SHA `3cd14965d1812455d0fb800b7cb3d4e4a8bc006ccd8de1d4fb0ab09c0b579db8`), frame-1 `...sprite-frame-1.png` (SHA `a810c47180e7b0f0fdef96a20a7f66188adf3c3e689d174c7853c541d28deb6e`), pós-reinício `...sprite-after-restart.png` (SHA `3873e4a1c2f066bb51b7f7379a11617c7e0fe6b3f6d2514665b326d3b06ec891`).

Suíte frontend reexecutada isoladamente com `--pool=forks --maxWorkers=1 --no-file-parallelism`: `621 passed / 6 skipped`; o teste focado após o caso determinístico passou `8/8`; `host:certify` passou com `624 passed / 3 skipped` e Rust completo aprovado (testes ignorados permanecem condicionais). O primeiro timeout/erro de worker ocorreu somente na execução concorrente com a compilação Rust; a repetição serial não removeu nem afrouxou testes. O desktop não foi repetido para esta alteração exclusiva de teste/rótulo; as capturas dos dois frames permanecem válidas. O holdout `src-tauri/src/tools/reverse/decomp-recovery/object_diff.rs` continua intacto apesar do I/O error `rg` reproduzível; não houve limpeza.

Cancelamento permanece explicitamente **herdado do executor do PR #70** e não foi reexecutado nesta alteração de composição. A fatia continua **Experimental**, assistida por metadado doador; não certifica extração automática geral, animação ou reconstrução do jogo. Nenhum merge foi feito.

### Checkpoint 2026-09-19 — REX-04 correção visual do frame no PR #71

No branch `codex/rex-sprite-frame-01`, o commit `30cd753fa0f67d873ff02b30244359657d8f70f1` corrige a apresentação do frame composto sem ampliar o escopo assistido: a imagem saiu do grid que permitia colapso e passou a uma área própria com largura mínima, rolagem inteira e `shrink-0`; metadados ficam abaixo, em linhas separadas. O CSS força `content-box`, `width:192px`, `height:312px`, `max-width:none`, `max-height:none` e `image-rendering:pixelated`, preservando transparência e proporção. O E2E agora mede o retângulo efetivo subtraindo as bordas e reprova se o conteúdo não for exatamente `192×312`, escala 3×, pixelated, visível, desobstruído e sem sobreposição dos metadados.

Build canônico: `/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/debug/retro-dev-studio`, SHA-256 `c73bd83e8df66ccb1bd08aff55b5ab40ef85ffa8334d84be1e53fa27518b6dc6`; frontend carregado declarou o mesmo commit. ROM BYOR SHA `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`; fonte doadora SHA `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`.

E2E desktop passou com sessão `inspection-1789849980-00000000`, composição independente e mutação rejeitada, salvar/reiniciar/reabrir, negativo de wizard e releitura integral dos pixels. O log registra, antes e depois do reinício: `css.width=192`, `css.height=312`, `boxSizing=content-box`, bordas 1px descontadas, `content.width=192`, `content.height=312`, `integerScale=true`, `pixelated=true`, `fullyVisible=true`, `unobstructed=true`, `metadataBelow=true`. PNG composto `8bb4dc723fa4d9435f6eaa3ce1c2248df7a20e30b800a6c56bfdd0a54fa96168`; RGBA independente `50cba0a2432bb73bcfc5a9c2b0e42668935df3a4c7c2b8e8a0f0e88c3bf46c58`; canvas `c70a3dfcb4726662c8f8588f6c5ab576f9b64ff7f37198fc72dcae151fde22dc`; índice `938611103b7d79af7e599fe024fa4adef53a8de898d9a06e00d9da15e451196c`. Log SHA `0f1dd209e76bd87140ba66fb6babfe0a8c97cdb330e30316ff7609945d842350`; captura pós-reinício SHA `b1653fb8ff2b3fbb83791950ed9e663394fea5417f7e5094c2f953a836b582da`.

O preflight reportou uma tentativa inicial de conexão recusada do driver, mas a execução WebDriver subsequente completou normalmente; não foi tratado como sucesso prematuro. A área de sprite está legível na captura pós-reinício. O cancelamento continua explicitamente herdado do executor do PR #70. A composição segue **Experimental**, assistida por metadado doador; não representa extração automática geral, animação ou reconstrução do jogo.

### Checkpoint 2026-09-19 — REX-04/Sprite-Frame-01 HAMOOPIG reexecutado no HEAD final

No branch isolado `codex/rex-sprite-frame-01`, o build canônico do produto em `2425bd0383d800fe66ab956f5f9be135c0e1494b` gerou `/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/debug/retro-dev-studio` com SHA `4d9f95790b6758271240d21ae186d5e1079cb8590cfd15c0037231fd8fb47b8d`. O frontend carregado declarou o mesmo commit. A execução `sprite-frame-01-e2e-final-head.log` passou com ROM BYOR `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`, fonte doadora `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`, sessão `inspection-1789834584-00000000`, recurso `spr_ryo_100/frame-0` e frame nativo 64×104.

A composição independente continuou com PNG `8bb4dc723fa4d9435f6eaa3ce1c2248df7a20e30b800a6c56bfdd0a54fa96168`, RGBA do PNG `50cba0a2432bb73bcfc5a9c2b0e42668935df3a4c7c2b8e8a0f0e88c3bf46c58`, canvas WebKit `c70a3dfcb4726662c8f8588f6c5ab576f9b64ff7f37198fc72dcae151fde22dc` e índices `938611103b7d79af7e599fe024fa4adef53a8de898d9a06e00d9da15e451196c`. O candidato de tiles permaneceu separado (`0xA490`, 192 bytes, PNG `33c3dd82d68b123f0e37b3baa1163cad69ef33c522dad80139ae9b611a6dd13f`, pixels `a5b33b5c97f32106fda7e610da91ff3bcce67c92375d673ee25f7389af1ed480`). A mutação visual foi rejeitada; após reinício a prévia foi capturada novamente com `fullyVisible=true`, `unobstructed=true`, hit-test em `IMG`, e identidade ROM/sessão/candidato confirmada. O negativo do wizard rejeitou o clique nativo obstruído (`selectionUnchanged=true`, `syntheticEvents=false`). Capturas: `inspection-2026-09-19T16-16-06-738Z-sprite-before-restart.png` e `inspection-2026-09-19T16-16-06-738Z-sprite-after-restart.png`.

O cancelamento é explicitamente **herdado do executor do PR #70**, não reexecutado nesta alteração de composição; não deve ser contado como nova prova deste binário. A árvore continua com os untracked de outras sessões preservados e não staged. A documentação abaixo mantém os checkpoints históricos; este checkpoint é o destino atual da matriz.

### Checkpoint 2026-09-19 — REX-04/Sprite-Frame-01 HAMOOPIG fechado no desktop

Commit `57460b8` publicado na branch isolada `codex/rex-sprite-frame-01`; PR #70 foi preservado sem merge. A fatia não trata prévia de tiles como sprite: compõe somente `spr_ryo_100/frame-0` (64×104) com tiles, posições, ordem vertical ResComp, flips, paleta MD RGB333 e transparência, explicitamente marcada como Experimental e assistida por metadado doador.

Referências: ROM BYOR histórica de 917.504 bytes, SHA `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`; fonte `res/sprite/ryo/100.png`, SHA `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`; offsets compilados `0x863A0/0x800`, `0x2CC68/0x20`, `0x22260/0x30`. RGBA independente do PNG: `50cba0…`; canvas WebKit: `c70a3d…`; índices do frame: `938611…`.

Binário canônico final: `/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/debug/retro-dev-studio`, SHA `529372408000893eea87f23bf47fedf5552af69301a75294b17b878888606fba`, frontend `57460b8`. E2E final passou com identificação, catálogo/candidato independente `0xA490+192`, composição, mutação rejeitada, salvar, reiniciar, reabrir e releitura de pixels; sessão `inspection-1789833207-00000000`. O negativo do wizard registrou obstrução e seleção inalterada. Evidências: `src-tauri/target-test/validation/sprite-frame-01-e2e-final-2.log` e screenshots `inspection-2026-09-19T15-53-12-704Z-sprite-{before,after}-restart.png`.

Diagnóstico corrigido durante a execução final: um run foi rejeitado honestamente por HTTP 400 `element click intercepted` porque o drawer Console cobria o controle; o harness passou a fechá-lo por botão visível e clique WebDriver nativo, sem remover overlay por JavaScript. O cancelamento continua explicitamente herdado da evidência do PR #70 e não foi repetido nesta alteração de composição. Holdout, scanner, oráculo de paletas, IPC/UI e arquivos untracked de outras sessões permanecem preservados.

### Checkpoint 2026-09-19 — prova visual de reabertura endurecida no harness `0e34773`

O cenário `inspection-complete` foi reexecutado sem repetir os testes do scanner. O binário/frontend permaneceram no produto `441533f8c231e38be185f0526fd609559e8ffec5`, SHA `97569a6f9b9c70402e8d6ebdec877a0450e338b45e39cb363f3b082398bb662`; o harness alterado está em `0e34773`. A ROM HAMOOPIG preservada tem 917.504 bytes e SHA `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`.

Sessão `inspection-1789823471-00000000`, run `run-inspection-1789823471-00000000-00000001`: identificação/análise concluídas; candidato `inspection-candidate-tile4bpp_block@0000A490-0000`, offset `42128`, tamanho `192`, `tile4bpp_block`, preview `256x16`; PNG SHA `33c3dd82d68b123f0e37b3baa1163cad69ef33c522dad80139ae9b611a6dd13f`; pixels RGBA SHA independente `a5b33b5c97f32106fda7e610da91ff3bcce67c92375d673ee25f7389af1ed480`. A mutação de um pixel continuou rejeitada (`d1eabd7d37515d98eb8313c34ce4bf9e0eb5fbd65ba572fc8127183ef8a37954`).

Após reinício, o wizard foi tratado por controles visíveis; o mesmo helper de clique WebDriver, em modo esperado-bloqueado, registrou `unobstructed=false`, overlay do wizard, `selectionUnchanged=true` e `syntheticEvents=false`, sem clicar no elemento coberto. Depois, a sessão/candidato foram reabertos e o painel foi rolado até a prévia: viewport `1920x1080`, retângulo `201.156x14.4375`, `fullyVisible=true`, `unobstructed=true`, hit-test em `IMG`, tamanho renderizado suficiente. A captura efetivamente apresentada está em [after-restart](/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/validation/inspection-2026-09-19T13-10-56-962Z-after-restart.png), SHA `2da6ed188265be20d196b0e964c38baa6ddbe47c266a76f7f4ac6faf99ddd49e`; [before-restart](/mnt/sdcard/Projects/RetroDevStudio/src-tauri/target-test/validation/inspection-2026-09-19T13-10-56-962Z-before-restart.png), SHA `6ef0053a33c8647cfbb12becf0fdbcde051ab972f040a5cd03e49a031011c238`.

O cancelamento permanece explicitamente **evidência herdada do executor**, não reexecutada nesta rodada: `run-inspection-1789820344-00000000-00000001`, sessão `inspection-1789820344-00000000`. O estado segue Experimental e sem merge.

### Checkpoint 2026-09-19 — integração isolada auditada para #69

O PR #69 e os PRs REX #66–#68 eram linhas paralelas; nenhum head REX é ancestral do #69. `10c89d1` também não é ancestral do #69: `e998bbd` é o patch equivalente já presente na inspeção. Nesta branch isolada, #66/#67/#68 foram integrados por `177c831`, `63e730d` e `af6c0f3`, respectivamente. O holdout foi restaurado pelo merge de #66 — não “preservado” de um HEAD que já o continha — e os conflitos foram resolvidos por código, sem cópia indiscriminada. Untracked de outras sessões permanecem preservados.

No PR #70, `441533f` corrige a prova de reabertura após reinício: o wizard é tratado por controles visíveis, o negativo de hit-test confirma que um clique nativo não atravessa o overlay, e a sessão/candidato/prévia são revalidados após o reinício. A execução histórica em `9f0167e` comprovou restauração de estado, mas a captura pós-reinício coberta pelo wizard permanece preservada somente como evidência da lacuna visual.

Comparação: #66 trouxe holdout, confronto e renderer chunky; #67 trouxe cache/avanço monotônico e guarda contra streams periódicos; #68 trouxe o oráculo independente de paletas/pixels; #69 trouxe IPC/UI, progresso, cancelamento, catálogo, prévias e persistência. No destino `af6c0f3`, todos esses conjuntos estão presentes e exportados conjuntamente (`holdout` + `inspection`).

Matriz anterior: binário `f7f14045cc7fa1dec41bbe076d612932412a454261d5666dff507b0ec3e6c42c`, sessão `inspection-1789788024-00000000`; restauração de estado passou, mas a captura pós-reinício ficou coberta pelo wizard. Matriz corrigida em `441533f`: binário canônico `97569a6f9b9c70402e8d6ebdec877a0450e338b45e39cb363f3b082398bb6622`, frontend runtime e Git `441533f8c231e38be185f0526fd609559e8ffec5`; HAMOOPIG `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`, candidato `42128/192`, `256x16`, PNG `33c3dd82d68b…6dd13f`, pixels RGBA `a5b33b5c97f3…ed480`, mutação rejeitada; negativo de obstrução `topTestId=project-wizard-body`, `unobstructed=false`, sem disparar seleção; cancelamento reexecutado no mesmo binário com `run-inspection-1789820344-00000000-00000001` e sessão `inspection-1789820344-00000000` cancelados; reabertura visual corrigida com sessão `inspection-1789820281-00000000`, run `run-inspection-1789820281-00000000-00000001`, screenshots `inspection-2026-09-19T12-17-53-569Z-{before,after}-restart.png`; negativo controlado `1f3d1060ffd631dd9ecbebf8b940a797cf597c10198497d1f5707d4e1785553a`, 17º candidato `16384/128` sem preview.

Gates locais do destino: check:tree, lint, TypeScript, Vitest `618/6`, clippy, fmt e Rust `608/40` passaram. O rebuild canônico passou via shell de login após diagnóstico do primeiro erro de PATH (`cargo metadata` não encontrado no processo `rtk npm`). `host:certify` passou no destino: frontend `621/3`, Rust `608/40`, upstream SGDK/PVSnesLib `Success: true`. CI remoto será disparado ao publicar o branch; classificação continua **Experimental**, sem merge e sem certificação de extração completa/reconstrução.

### Checkpoint 2026-09-18 — REX-04 inspeção visual: hardening e bloqueio E2E do WebKit

Corrigidos os três achados funcionais: listener de progresso instalado antes de `inspectionStart` com reconciliação por `inspectionStatus`; respostas assíncronas de catálogo/prévia/status protegidas por sequência, sessão, filtro e candidato; e sessões persistidas listáveis/selecionáveis após reinício, com aba “Inspeção visual” acessível antes de existir manifesto. Adicionados seletores de QA aos controles e testes atrasados/remount no painel.

Diagnóstico: o timeout da descoberta real foi localizado no scanner de tiles, que recalculava janelas sobrepostas e podia retroceder o cursor; aplicado cache dos blocos avaliados e avanço monotônico. Testes focados de `graphics_discovery`: 14 passados, 2 ignorados; clippy verde. O binário canônico foi recompilado com hash `03674e8b2f1f88bbecf66f724f1b3f8a3a3e11442a8fcb879f9ad50ddca19180` antes da última rodada de UI.

A E2E desktop ainda não fecha: o WebKitWebDriver falha no clique nativo (`POST /element/.../click` com mensagem vazia) e eventos DOM/Enter não ativam “Identificar base”; a sessão fica sem `inspection-start`, portanto cancelamento/salvar/reinício não podem ser afirmados. O runner registra a chamada e preserva o estado; a classificação permanece **Experimental**, sem aceite. O erro I/O independente continua reproduzido em `src-tauri/src/tools/reverse/decomp-recovery/object_diff.rs` (`stat`, `sha256sum`, `wc` retornam `Input/output error`) e não foi apagado. `host:diagnose` READY; `host:certify` permanece pendente da rodada final.

### Checkpoint 2026-09-17 — REX-04 inspeção visual desktop (Experimental)

Implementada no branch `codex/rex04-inspection-ipc` a fatia de inspeção visual somente leitura: abertura BYOR e identificação por conteúdo, catálogo de extração, descoberta em `spawn_blocking`, evento de progresso/cancelamento, paginação/filtros de candidatos, regiões UNKNOWN preservadas, prévias PNG reais com proveniência, escolha manual de paleta e persistência/reabertura com verificação da identidade da ROM. A aba é isolada no Reverse Workspace e não promove candidatos a recursos confirmados.

Hardening: catálogo validado contra bytes normalizados e serialização canônica; intervalos, overflow, cobertura, status, schema e limites verificados; artefatos usam escrita imutável sem panic e deduplicação de referências; caminhos são contidos e re-hashados; erros IPC carregam `code`, `message` e `retryable`; IDs de candidatos vêm do backend e sessões correlacionam ROM, catálogo, run e geração.

Gates locais: lint, TypeScript, build frontend, Vitest completo (615/6 em execução independente; 618/3 no run da certificação antes de ENOSPC), cargo fmt/clippy e Rust lib (592/40) passaram. `host:diagnose` final está READY, mas duas execuções de `host:certify` terminaram por `ENOSPC` nos workers da suíte frontend mesmo depois de remover de forma recuperável o cache gerado `src-tauri/target-test/dev`; a certificação completa permanece bloqueada por capacidade do host. Não há promoção de REX-04, nem aceite inferido do PR #68; hashes canônicos HAMOOPIG/Taiketsu preservados. Limitação conhecida: a substituição concorrente de caminhos de artefato não é coberta; cancelamento ocorre em pontos seguros entre fases.
    ### Rodada 4b — corrida de época no backend fechada sob o mutex (2026-09-13)

Re-revisão de `1a1fc65` reproduziu corrida P1: conferência de época antes do mutex permitia input antigo aplicar controles ao core novo. Corrigido: época conferida DENTRO da seção crítica (`emulator_send_input_locked`, lock mantido até o set_joypad); a recarga incrementa `CORE_EPOCH` sob o mesmo lock. Teste determinístico força a interleaving e exige recusa sem aplicação. 5 passagens de UI no binário canônico com motivo correto por passagem (stale-session rejeitada pelo oráculo de sessão estranha após navegar de volta para a aba Jogo e fechar o drawer de Console que abre sozinho com erros). Rust 561/36; store 86/86; frontend 614/6.

### Re-revisão e905e20 — REV-05 fechado na rodada 4 (2026-09-12)

Três lacunas fechadas: (1) hold de sessão na primeira linha da carga/stop (invalidação antes do await; envios bloqueados e contados); (2) negativos reais novos — blocked-during-load (teclas na janela pendente: hold, sessão nula, 4 bloqueios, sem ack, canvas inalterado) e inflight-across-reload (request A atravessa a transição sem crédito e sem vazamento — A/B 20/20 no mesmo processo); (3) corrida de resposta antiga coberta pelo inflight; stale-session preservado com rótulo preciso. Política no backend: `CORE_EPOCH` (load incrementa, send recusa obsoleta, drain de controles). Achado: vazamento real de send_input através da recarga (frame 0, estável em 3 execuções) fechado pela época. Store 86/86.

### Re-revisão e905e20 — 2026-09-12: REV-05 parcial

Host diagnose READY; 83 testes do store passaram; PR #63 e905e20 OPEN com 8 checks verdes consultados. ACK ok:true e geração frontend são melhorias confirmadas, mas aceite integral não sustentado. `loadRomIntoEmulator` só invalida/troca sessão depois de await emulatorLoadRom: a sessão antiga permanece válida durante a carga pendente. Probe de ordem sobre handler real preservado em `/home/misael/RetroDevStudio/review-e905e20/load-order.cjs` e `.json`.

Harness atualizado tem negativos sem teclas e sessão divergente; faltam teclas presentes com backend recusando/pendente e prova de nenhum Step após falha de ACK. Negativo de sessão envia input novo após recarga completa e cobra época velha, não resolve ACK antigo atrasado numa troca A→B. Corrigir invalidação no início/ordenação e medir esses negativos reais. Relatório completo `/home/misael/RetroDevStudio/review-e905e20/REVIEW.md`.

Diferença 614/3 versus 611/6 consistente com pré-requisitos condicionais no código, mas conjunto exato de IDs não comparado nesta revisão. Sem reexecução de certify completo/UI; nenhuma alteração de produto ou merge. Experimental; REV-01..04 mantêm aceites anteriores.


### Re-revisão 2026-09-12 — REV-04 aceito; REV-05 parcial

Revisados b09772a / 87108bb e HEAD documental 7873886. Host diagnose READY. **REV-04: 15 testes focados passaram**, incluindo regiões vazias, índices divergentes e sequência não canônica. Aceite local desses achados; não equivalência universal.

**REV-05 ainda não prova entrega aceita:** o handler atualiza lastSentJoypad antes de emulatorSendInput e ignora resposta estruturada ok:false (só captura Promise rejection). Probe com handler real extraído/transpilado e backend recusando retornou right:true, erro null, predicado do harness aprovado. Isso comprova falso positivo do oráculo, não falha espontânea do runtime. Solicitação, confirmação e consumo não devem compartilhar rótulo. Corrigir ACK ok:true correlacionado à sequência/sessão; cobrir recusado, pendente, resposta tardia e reset entre cargas. Manter prova de teclado e canvas real, mas repetir o positivo com confirmação antes de cada Step.

Evidências duráveis: `/home/misael/RetroDevStudio/review-rex-2026-09-12/REVIEW.md`, `input-ack-probe.cjs`, `input-ack-probe.json`. PR #62 checks principais verdes; PR #63 em novo HEAD 7873886 com checks ainda em execução na consulta. Nenhum merge. Sem alterações de produto; sem reexecução de UI real, suíte integral ou host:certify nesta revisão. Classificação Experimental/fatias iniciais.


### Re-revisão REX — 2026-09-11: aceite parcial de d3e8f11

REX-REV-01/02/03 corrigidos no escopo testado: SMD padrão, parsing de header curto e undo com identidade. Execução independente do núcleo reverso: **94 passed / 1 ignored**, incluindo as cinco regressões anteriores. Host diagnose READY. PR #62 cc88bb3 e #63 d3e8f11 com checks validate/linux-validate/desktop-smoke verdes consultados; nenhum merge realizado.

**REX-REV-04 ainda parcial:** dois probes independentes adicionais reprovaram (0 passed / 2 failed, exit 101). `evaluate_identical_equivalence` aprova regiões vazias e índices de frame incompatíveis (0 versus 999) com hashes iguais. Corrigir completude e identidade das observações; os testes anteriores misturavam múltiplas ausências e não isolavam esses casos.

**REX-REV-05 permanece bloqueado:** desktop-ui-proof.py itera chaves right/start do roteiro contra keymap com ArrowRight/Enter. Reprodução da expressão em JavaScript: 180 frames, 70 com input solicitado, **zero teclas selecionadas**. Assim os checkpoints não certificam o roteiro declarado. Corrigir mapeamento joypad→teclas, simultâneos/press/release, observar input real e confirmar conclusão de cada frame; delay de 4ms e DOM click não provam contagem exata/hit-testing. Carga compartilhada e canvas do produto são melhorias, mas não fecham o aceite.

Evidências: `/home/misael/RetroDevStudio/re-review-rex-2026-09-11/REVIEW.md`, `input-probe.json`, `oracle-probes.log`, snapshot isolado `source/`. Apenas testes adicionais na cópia externa; produto intocado. Não reexecutados UI real, suíte completa, build oficial ou host:certify nesta revisão. Classificação: **Experimental**, fatias iniciais; extração REX-04 e reconstrução por nós continuam pendentes.


### Revisão independente REX — 2026-09-11: aceite reprovado

Avaliado `cdf9a24b44c5d4d02e4cc6670a76cba47d07f1d3` (PR #63 sobre #62). Host diagnose READY; checks remotos validate/linux-validate/desktop-smoke consultados verdes, mas não cobrem os defeitos abaixo. **Não aceitar REX-02 como robusto/concluído; endurecer oráculos REX-00/03.** Não houve entrega ROM→jogo editável por nós.

Prova independente em cópia isolada de git archive: **83 testes existentes passaram, 5 regressões novas falharam, 1 ignorado, exit 101**. Implementação preservada; só testes acrescentados na cópia externa. Evidência durável: `/home/misael/RetroDevStudio/review-rex-2026-09-11/REVIEW.md`, `review-tests.log`, `manifest.json` e `source/`.

- REX-REV-01 (P1): SMD usa erroneamente blocos 512 e transformação própria; fixture independente do formato padrão de 16KiB é rejeitada. Os testes do executor geram entradas com o próprio interleave errado, inclusive a prova sobre bytes reais. Corrigir algoritmo e golden independente; referência primária Genesis Plus GX `core/loadrom.c`, `deinterleave_block`.
- REX-REV-02 (P1): 272 bytes com assinatura SEGA são aceitos pela identificação e causam panic no slicing do header (`loader.rs:82`). Validar tamanho antes de indexar em todos os entrypoints.
- REX-REV-03 (P1): `rex_undo_normalization` aceita raw alterada porque zero passos significa zero verificação; falta checar hashes/tamanhos de entrada e saída e cadeia inteira.
- REX-REV-04 (P1): equivalência retorna passed para 180 frames declarados sem framebuffer/regiões/estado final e para regiões com IDs/tamanhos diferentes. Ambos reproduzidos. Exigir completude e identidade dos dados antes de comparar.
- REX-REV-05 (P2): desktop-ui-proof.py usa IPC/canvas independente e binário anterior, sem teste dos controles visíveis; imprime matches sem reprovar por divergência. Reclassificar como probe IPC; criar teste da UI real com asserções no HEAD final.

Preservados código do executor, corpus e ROMs. Nenhum merge. Revisão não reexecutou suíte completa, UI desktop ou host:certify; não certifica release. Próximo: corrigir REX-REV-01..05 com negativos independentes e gates no destino antes de prosseguir à extração REX-04.


### Re-revisão REX — REV-04 e REV-05 fechados na rodada 3 (2026-09-12)

A rodada 3 reproduziu um novo falso positivo no REV-05: `lastSentJoypad` era gravado antes do IPC e só `.catch()` era tratado, mas `emulator_send_input` sinaliza falha por valor resolvido `{ok:false}` — logo os "180/180" mediam passagem pelo handler, não entrega aceita.

Corrigido: `lastJoypadRequest` (intenção) separado de `lastJoypadAck` (gravado só com `ok:true`), correlacionados por **sessão de carga + sequência monotônica**; ack de seq anterior ou de sessão anterior é descartado. Sessão gerada no frontend — suficiente, pois a época é capturada no fechamento do envio e reconferida na resolução; contrato Rust/TS inalterado. Ciclo de vida ancorado em `setEmulatorLoaded`, invalidando tudo em stop/recarga. 10 testes em `editorStore.test.ts` (recusado, pendente, atrasado, sessão anterior).

Reexecutado pela UI real (binário `856cc431…`, ROM `558bea6c…`): positivo PASS com 3 transições confirmadas por ack; negativo sem teclas e negativo de sessão obsoleta ambos FAIL-AS-EXPECTED, este último recusado por `ack de sessão estranha`. O positivo confirma **3 transições, não 180** — o número anterior contava verificações vazias que passavam vacuamente. Framebuffer segue 166/180 e não discrimina input.

Limitações declaradas: o ack confirma a última transição de cada frame (envios intermediários no mesmo frame não são confirmados individualmente); e o ack prova aceitação pelo backend, **não** consumo pelo jogo — o efeito de runtime é registrado à parte.

Armadilha de build registrada: `cargo build` não roda o `beforeBuildCommand`, e o binário embutia `dist` antigo; grep no binário é inconclusivo (assets comprimidos). O harness ganhou preflight de contrato em runtime e o binário medido veio de `npm run build:debug`.

Gates: `host:certify` READY, Rust 560/36, frontend 614/3. Classificação segue **Experimental**; REX-04 não iniciado; nenhum merge.

### Re-revisão REX — rodada 2 (2026-09-11), parcialmente superada pela rodada 3

REV-04: regiões vazias = missing; frame_index comparado por posição + sequência canônica 0..n-1 (probes do revisor adotados). REV-05: mapeamento campo→código de tecla corrigido (bug raiz: `start`/`right` comparados contra `Enter`/`ArrowRight`), teclado nativo WebDriver com codepoints, observação do produto via `lastSentJoypad` no store (180/180 observações de joypad por frame conferem, 2 press/2 release; a coincidência de framebuffer com o backend é 166/180 — a janela de boot 0..13 é excluída e não discrimina input, ver achado do efeito de estado), auto-teste negativo detecta ausência de input (exit 1). Achados novos: recarga quente ≠ power-on (14 frames; protocolo agora warm-up → pause → stop → load startPaused), loop livre iniciava frames fantasma pausado (gate adicionado), efeito de ordem do core invalida WRAM A/B como oráculo (corroboração apenas). Gates: Rust 560/36, frontend 601/6.

### Programa REX — REX-REV-01..05 corrigidos (2026-09-11)

Cinco achados do aceite reprovado corrigidos com regressões do revisor adotadas verbatim: SMD no formato padrão 16 KiB (GPGX `deinterleave_block`, golden independente, passo `deinterleave_smd_frame16k`; manifests antigos rejeitados), identificação exige 0x200 bytes sem panic em nenhum entrypoint, `rex_undo_normalization` valida identidade completa (entrada/cadeia/saída — raw alterado rejeita), oráculos de equivalência exigem observação completa e contrato de região (region_id/size), e a prova de UI agora usa o caminho do controle visível "Carregar ROM" (`__RDS_E2E__.loadRomForEmulation`), controles Pausar/Step, teclado do produto e canvas real do app com 4/4 checkpoints byte-idênticos ao backend + auto-teste negativo (exit 1) + hash do binário. Gates no HEAD: Rust 557/36, frontend 601/6, provas reais passando.

### Programa REX — REX-02 executado (2026-09-11)

Identificação MD por conteúdo e normalização reversível entregues em `codex/rex-02-normalizacao` (base PR #62): variantes raw/smd(±512)/byteswap16 com passos de `NormalizationStep` hash-por-passo no manifesto, `rex_undo_normalization` byte-exato, truncamento provável como erro e divergência header×tamanho como nota (evidência real: HAMOOPIG 0xFFFFF vs 0xE0000). 12 testes unitários + prova real nas duas referências com round-trip SMD em bytes reais; run `rex02-md-identification-v1` no ledger. Contêineres zip/7z continuam não suportados (erro explícito, sem dependência nova). Próximo: REX-04 (extração visual organizada).

### Programa REX — REX-00/01/03 executados (2026-09-10)

Primeira fatia do executor entregue em `codex/rex-00-oraculos` (base `a75fd30`): oráculos de equivalência (`tools/reverse/equivalence.rs`, `rex-equivalence/v1`) sobre o parity harness, ledger v2 (`decomp-ledger/v2` com corpus por conteúdo, capacidades por perfil e runs de cenário append-only, migração v1→v2 testada) e matriz de capacidades MD honesta (nada `verified_for_profile`). Provas medidas no host READY: HAMOOPIG mesma-ROM 180 frames com input definido — determinismo só entre power-ons frescos, veredito `indeterminate` porque o core não expõe VRAM/SRAM (missing registrado), e **savestate restore não é fiel ao power-on** (achado novo); negativo Taiketsu — prévia regenerada com 12.620 px não pretos e heartbeat rejeitada pelos oráculos (150/180 frames divergentes, WRAM divergente); UI desktop real (tauri-driver) com 4/4 checkpoints byte-idênticos ao backend. Evidências duráveis em `/home/misael/RetroDevStudio/rex-evidence-2026-09-10/`; ledger em `~/.retrodev/decomp_work/ledger.json`. Nada disso promove superfície nem fecha GUARD-SGDK-EQUIVALENCE-01 (que agora tem reprodução formal do negativo). Próximo: REX-02/04.

### Planejamento Programa REX — 2026-09-10

A pedido do operador, o plano canônico `12_DECOMPILACAO_PAREADA_PLANO.md` foi ampliado com o Programa REX: 17 tickets (REX-00 a REX-16), dependências, contratos, corpus/holdout, migração SGDK 1.60/1.80/2.00→2.11, extração/editabilidade, patches, IR/nodes, jogo novo e expansão por plataformas. Prompt vigente: `PROMPT_AGENTE_RECONSTRUCAO_ROM.md`. É planejamento, não implementação ou promoção. Estimativa inicial de 24 semanas refere-se somente a um perfil MD delimitado e deve ser recalibrada após corpus/gates; não há prazo ou garantia universal. Primeiro trabalho do executor: baseline/proveniência/oráculos, incluindo mesma-ROM com input e UI. PR #61 permanece draft sob investigação. Não há autorização nova de merge, dependências ou envio externo de ROM. Host diagnose desta rodada: READY, fingerprint d68f75b76d036d7cd200befab0255bd9479604798bf9c0fcbea892c7ce2ceef1.


### GUARD-SGDK-EQUIVALENCE-01 — aceite suspenso (2026-09-10)

O usuário contestou a fidelidade da prévia importada; PR #61 permanece draft e não deve ser integrado como conversão fiel. Execução sem exceção e heartbeat não certificam preservação do jogo original. Os candidatos anteriores abaixo são históricos, não entrega final aceita.

Referência padrão escolhida pelo usuário: `/mnt/sdcard/SGDKForge/SGDK_projects/HAMOOPIG [VER.001] [SGDK 211] [GEN] [ENGINE] [FIGHTING]/out/rom.bin`, 917504 bytes, SHA-256 `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`. Cópia imutável local e relatório em `/home/misael/RetroDevStudio/investigation-sgdk-equivalence-2026-09-10/`.

Prova independente: exatamente essa ROM carregada no backend real do desktop, Genesis Plus GX v1.7.4 46a5521, 180 comandos de frame e 180 eventos recebidos, framebuffer 320x224. `hamoopig/backend-reference-180.png` mostra título completo, personagem, logo e textos, visualmente coerente com a imagem externa fornecida. Não é comparação pixel a pixel sincronizada, certificação de gameplay, desempenho ou carregamento via botão. Harness `backend-reference.py`; relatório `hamoopig/backend-reference.json`. Tentativas anteriores `same-rom-desktop.py` falharam: override de invoke não funciona porque a propriedade é não gravável; suas capturas/status não certificam carregamento.

A prévia importada foi regenerada de recursos com lógica parcial, não corresponde aos bytes da referência. Próximos gates separados: (1) ROM idêntica, input e frames nos caminhos externo/interno; (2) migração de fonte SGDK preservando comportamento e origem; (3) fonte → IR/nodes → C com estados, paletas, planos e criação/liberação de sprites preservados; (4) métricas de decompilação pareadas com fonte/ELF. Recursos de estados alternativos não podem ser contabilizados como atores simultâneos; catálogo total não equivale a residência em VRAM.

Compatibilidade 1.60/1.80/2.00 → 2.11 solicitada: pendente de fixtures e validação por versão; os dois projetos fornecidos já portados para 2.11 não demonstram migração automática dessas versões. Não substituir assets ausentes por arte/áudio inventados. Preservar doadores e créditos. Nenhuma promoção de Experimental.



### Estado operacional — revisão independente de runtime e decompilação (2026-09-10)

- **#60 integrado** em `main` (`616abdbcceb787879a7a1f2071c46919ed71bb06`). A integração desta revisão é rastreada pelo PR #61; os checks verdes de `90aae29` antecedem a correção de residência descrita abaixo e não a certificam. O candidato de produto final é `c042ecfc9ebb5fa419682d23bb4db4b42fc0b68e`.
- **GUARD-IMPORT-RUNTIME-01:** a prévia importada do Taiketsu tentava alocar 2.459 tiles de sprites (78.688 bytes) simultaneamente e passava `NULL` de `SPR_addSprite` para `SPR_setAnim`. A captura de 15.835 pixels não pretos era **ADDRESS ERROR**, não execução de jogo. Portanto os antigos registros `14/14 IBRE`/`emulation_visible_ok` só demonstram imagem produzida; não certificam ausência de exceção ou equivalência de gameplay.
- Correção em revisão: cenas acima dos 420 tiles padrão usam residência de sprites pela janela visível; liberam os que saem antes de alocar os que entram, reservam VRAM descontando os tiles de background e guardam posição/animação/loop/visibilidade enquanto fora da tela. Ao reentrar, a animação reinicia no primeiro frame; não se promete continuidade temporal fora da tela. Falhas de capacidade/animação permanecem sinalizadas, sem desreferenciar ponteiro nulo.
- **Prova real local pós-correção:** Taiketsu importado, SGDK oficial, Genesis Plus GX, 150 frames, heartbeat em RAM **52 → 112** nos últimos 60 frames com Right pressionado, erro de residência **0**, 17.192 pixels não pretos e captura inspecionada sem tela de exceção. Escopo: **prévia de recursos importados**, não jogo de luta original convertido. Grafo mantém 357 nodes, 344 edges, 5 bridges e conversão por entidade 0. Artefatos: `src-tauri/target-test/validation/sgdk-taiketsu-real/`; evidência anterior preservada externamente em `/home/misael/RetroDevStudio/taiketsu-runtime-review-2026-09-10/before`.
- QA adicional: C efetivamente emitido compilado com AddressSanitizer/UBSan; entrada/saída do viewport, liberação antes de alocação, estado de animação/loop/visibilidade, retorno nulo e erros persistentes passaram. Harness local em `target-test/validation/sprite-residency/`, não substitui hardware real. 24 testes unitários do emitter passaram. Certificação integral de `c042ecf`: **host:certify READY**, 604 testes frontend e 524 Rust (33 ignored), upstream SGDK/PVSnesLib oficiais, clippy completo e fmt verdes. Binário desktop compilado pelo script canônico. Build & Run real MD/SNES confirmado; teclado Right observado no histórico de input da ROM MD em RAM. O primeiro clique automatizado SNES não iniciou build e o harness falhou a asserção final; outro clique explícito pelo controle habilitado executou o fluxo. Ocorrência semelhante na prévia Taiketsu; causa do primeiro clique não isolada, falhas preservadas e não contabilizadas como sucesso. No desktop Taiketsu, heartbeat em RAM 161→166 e erro de residência zero confirmaram execução após Build & Run.
- **GUARD-DECOMP-DETERMINISM-01 fechado localmente:** Etapa A real rerodada em `90aae29`; SMOKE_TEST e BLUE_CIRCUIT têm **14/14 objetos exatos cada**, além de ROMs idênticas em duas cópias limpas. GCC LTO exigiu semente por arquivo e o mesmo caminho de compilação, arquivado em diretório exclusivo após cada passe. Nenhum objeto anterior é reutilizado. Relatório em `target-test/validation/decomp/etapa-a-report.json`; histórico em `/home/misael/RetroDevStudio/decomp-review-2026-09-10`.
- Métricas corrigidas do parser nm/Ghidra: SMOKE_TEST 876 funções (sem ELF original para boundary); BLUE_CIRCUIT 778, precision 0,9632107 / recall 0,3701799. Taiketsu original: 1.536 funções, precision 1 / recall 0,1126302; rebuild do **doador original** ainda bloqueado por `registerState` no boot customizado. Esse bloqueio é distinto do crash da prévia importada corrigido acima. Provenance diff cobre apenas o primeiro objeto comparável, explicitamente.
- Entrega verificável local: `/home/misael/RetroDevStudio/verified-2026-09-10-c042ecf/LEIA-ME.md`, launcher `abrir-studio.sh`, projetos editáveis MD/SNES e prévia importada, ROMs, logs e screenshots em `evidence/`. `evidence/provenance.json` registra o estado final de integração/CI e hashes dos artefatos. O launcher depende do binário debug e das dependências deste host; não é instalador portátil nem certificação de release. Auditoria npm registrou 4 avisos moderados preexistentes; não se afirma ausência de vulnerabilidades.
- **GUARD-SPRITE-PRIORITY-01:** revisão do header SGDK oficial confirmou `TILE_ATTR(pal, prio, flipV, flipH)`. O gerador passava `priority_high` no quarto argumento, espelhando o sprite e fixando prioridade alta. Correção nos caminhos direto e de residência: prioridade no segundo argumento, flips desligados. Teste negativo reproduziu a falha antes da mudança; nova regressão cobre foreground/background em ambos os alocadores. Revalidação do candidato final e hashes da entrega são registrados em `evidence/provenance.json`; os números de `c042ecf` acima são o baseline anterior a esta correção.
- GOV-01 no checkout original permanece: preservar `.mimosa`/`.zcode` e dados de outras sessões. Nenhuma promoção de Experimental, nenhuma UI/LLM de decompilação e nenhuma distribuição de ROM comercial autorizada nesta rodada.
**Status:** ENTRADA CANONICA
**Ultima Atualizacao:** 2026-09-08 (HOST-WIN-01 validado no Windows; A/B/C revisados; GOV-01 original preservado)

**GUARD-DECOMP-DETERMINISM-01 (2026-09-10, em validação):** contador completo revelou 3/14 objetos exatos no SMOKE_TEST, apesar de ROM idêntica. Probes preservados em `/home/misael/RetroDevStudio/decomp-seed-probe-2026-09-10`: semente fixa remove IDs LTO aleatórios; descompressão das seções LTO mostrou `getcwd()` divergente mesmo com `-ffile-prefix-map`. Benchmark agora usa semente por arquivo e duas cópias limpas no mesmo `compile-workspace`, arquivando cada árvore integral em rebuild-a/b antes da próxima; política e flags constam no relatório. Não remove seções da comparação nem reutiliza objetos. Ghidra console inclui sufixo `(GhidraScript)`: parser corrige esse formato e mantém rejeição de endereço inválido. Nova Etapa A em execução; não herdar aceite 2/2 antigo.

**Atualização 2026-09-10 — GUARD-ANIM-01 integrado:** PR #60 mergeado em `616abdbcceb787879a7a1f2071c46919ed71bb06` após todos os checks verdes no commit `4377914`; host:certify Linux READY, 604 frontend/494 Rust, provas oficiais MD/SNES. O conjunto #58/#59 passou baseline local (604 frontend/522 Rust), mas Etapa A real foi reaberta: parser Ghidra não obteve resultado válido e cópia encontrou symlink de configuração `.agent`. Configurações de agente não fazem parte do snapshot de build; fontes/ROMs do doador ficam intactas. Correção/diagnóstico e nova medição em andamento; não declarar Etapa A concluída.

**Integração em revisão (2026-09-09 — GUARD-IMPORT-DECOMP-01):** PRs #58/#59 combinados apenas no worktree `codex/import-decomp-review`, sobre #60; nenhum merge desses PRs em main nesta rodada. Revisão corrige ledger que silenciava corrupção, serializa atualizações e grava atomicamente, distingue versões da ROM por identidade imutável, aceita anotações reais `nm -l`, rejeita endereços Ghidra inválidos e deduplica métricas; objetos do rebuild são contados recursivamente em ambos os lados. Hash reutiliza implementação existente, sem nova dependência direta sha2. Import code-only exige manifests vazios válidos; falhas/recursos não suportados não viram sucesso vazio. Testes e certificação em andamento.

**Retificação de alcance das provas herdadas:** 14/14 IBRE e pixels não pretos dos checkpoints abaixo medem import/build/captura, não equivalência ou gameplay. GUARD-ANIM-01 demonstrou que essa captura podia ser uma tela de exceção. Contagem antiga “2/2 objetos” ignorava objetos aninhados; resultados da Etapa A precisam de nova medição com o contador corrigido. Os números históricos ficam preservados, sem aceite ampliado. GO segue limitado a Fase 0 Sprint 1 + Etapa A, sem LLM/UI.

**Atualização ativa (2026-09-09 — GUARD-ANIM-01):** PR #57 integrada em `10d15f6` após CI verde. A prova anterior de framebuffer não preto não certificava gameplay: entrada Direita revelou `ADDRESS ERROR` do SGDK. Causa reproduzida: `SPR_setAnim(..., 1)` sem segunda linha de animação no atlas rescomp. Correção materializa sequências por linha, preserva tempos individuais e rejeita frames inexistentes. Teste oficial agora exige a cena verde conhecida após 60 frames com Direita pressionada: passou com 42.496 pixels de cena; o framebuffer antigo tinha zero. Não extrapolar esta prova dirigida para todos os jogos, nem para paridade de importações. Validação integral e integração desta correção ainda em andamento; #58/#59 seguem em revisão.

**Atualização ativa (2026-09-08 — GUARD-NATIVE-01/GUARD-ROM-01):** PRs #55/#56 integradas com CI verde. Abertura direta Linux revelou descoberta incompleta do compilador gerenciado e checksum SGDK invalidado pelo mastering do header; correções e provas negativas registradas no Current Wave. Código `a775762` certificado READY (604 frontend/492 Rust), abertura direta MD/SNES com pixels reais e sem diagnóstico bloqueante; checksum final MD confirmado byte-a-byte pelo sizebnd oficial. Próximo gate: CI e integração no destino. #53 e GOV-01 continuam abertos; nenhuma promoção de maturidade.

**Atualização anterior (2026-09-08 — GUARD-PATH-01):** reproduzida e corrigida perda do PATH do shell ao preparar Java no build SGDK. Testes antes 1 passed/2 failed, depois 3 passed; host:certify Linux READY com provas oficiais MD/SNES. Detalhes e limites no Current Wave: a relação causal completa com o exit 5 de nm (#53) ainda requer evidência Windows; nenhuma promoção de maturidade.

**Atualização ativa mais recente (2026-09-08 — HOST-WIN-01 fechado tecnicamente no runner):** o PR #51 (`codex/host-win01-detection`, SHA `ed80c82`) passou `host:certify` no Linux (`READY`; fingerprint `77bbc2a76ab04417b2c5e4f0ddcd82e10dcc4ef220883510652c9f67e632425c`; lock `dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377`) e o Desktop E2E Windows `34220094748` terminou **success**, com **16/16 cenários**: Mega Drive, SNES, overflow, warnings, healthy, error e stale, sem skips. A correção usa os artefatos oficiais imutáveis SGDK 2.11 (`sgdk211.7z`, SHA-256 `5cc704b7e3a15183c33e721a1d7f84c067cf78808754556d03bb14764df51437`, 54.060.415 bytes) e PVSnesLib 4.5.0 (`pvsneslib_450_64b_windows.zip`, SHA-256 `22c56150f3e8cb38702d4ad5e565c0b4b685807300d612061d87a7f5aea2a69f`, 9.994.749 bytes), com descoberta canônica de MSVC/WebView2/npm e handoff do cache gerenciado para o app. Para o SGDK Windows, o Make nativo `mingw32-make` é preferido quando disponível; o fallback oficial permanece e o shell alternativo usa `SHELL=sh.exe`/`-j1`. **A-01** continua com prova negativa real aprovada (`1 passed`) e controle positivo MD/SNES byte-a-byte idêntico; **B-01** segue revisado (5 focados; reprodução antes 4 passed/1 failed); **C-01** está integrado em `main` (`bd45299`). Nenhum PR foi mergeado nesta retomada: a decisão depende dos checks/proteção/revisão finais. **GOV-01 continua parcial no checkout canônico:** `.mimosa` e `.zcode` pertencem a outra sessão/processo vivo e permanecem intactos; o branch externo certificado não fecha essa causa. Nenhuma superfície foi promovida para Stable; gameplay, leitor de tela real e release continuam não medidos.

**Atualização ativa mais recente (2026-09-08 — retomada delimitada do Integrador):** **A-01 fechou a prova negativa operacional**: com SGDK/m68k-elf-gcc oficiais, um `logic_math` com `%` falha no build, não retorna `rom_path`, não anuncia ROM gerada e registra o nó como `unsupported` sem localização C; uma ROM antiga pré-existente no diretório de saída não é reutilizada. O controle positivo MD/SNES permanece verde e as ROMs suportadas continuam byte-a-byte idênticas; isso não prova gameplay nem semântica completa. **B-01 foi revisado**: 5 testes focados passam; revertendo somente as comparações corrigidas, a reprodução termina em **4 passed / 1 failed**, pois o caso acima do orçamento volta a produzir `Warning` em vez de `Error`. **HOST-WIN-01** foi publicado no PR #51: descoberta de MSVC via `VCToolsInstallDir`/`vswhere`, WebView2 pelo registro do runtime e instalação exata de npm `11.16.0`; o host Linux da validação ficou `READY` e o `host:certify` local passou, mas Windows real ainda depende do CI. Os fixtures POSIX executáveis foram marcados como skip no runner Windows, mantendo o desktop-smoke como prova operacional. PR #50 (A-01) e PR #51 seguem sem merge enquanto os checks remotos não estiverem verdes. **GOV-01 continua parcial:** `.mimosa` e `.zcode` no checkout canônico pertencem a outra sessão/processo vivo e permanecem intactos. Nenhuma superfície foi promovida; acessibilidade por leitor real, gameplay e release continuam não medidos.

**Atualização ativa anterior (2026-09-07 — INT-R1h, primeira fatia de agente integrada):** **C-01** entregue por C e **INTEGRADO** após revisão do Integrador. Correção de 1 elemento em `Console.tsx:192` (`role="log"` + `aria-live="polite"` + `aria-label`): entradas do console — inclusive erros, que abrem o drawer sozinhos — não eram anunciadas para leitores de tela. O Integrador **não aceitou o handoff pela descrição**: reproduziu a regressão (revertendo só o componente, `1 failed | 4 passed`; restaurando, `5 passed`), conferiu que o diff tem exatamente os 2 arquivos da allowlist, validou a alegação de base equivalente (`Console.tsx` idêntico entre `1b2a45b` e `e5e8407`) e confirmou o limite declarado (o componente desmonta com o drawer fechado). Gates no destino: `tsc` 0, `lint` 0, `npm test` **597 passed / 6 skipped (603)** — total 602→603 e passados 596→597, exatamente **+1**, sem teste perdido ou silenciosamente pulado; `cargo` não executado por diff Rust vazio, o que fica **declarado**. **Limite:** é validação unitária de atributos ARIA, **não** prova de anúncio por leitor de tela real. **GOV-01 recorreu** por `.mimosa` e `.zcode` na raiz, ambos com processo vivo de outra sessão: **nada foi movido ou apagado** e o gate **não foi afrouxado**. Propostas de C verificadas de forma independente: **C-02** e **TOOLS-01** abertos como `PROPOSTO` (TOOLS-01 exige aprovação por ampliar a allowlist), `ToolNotices` arquivado.

**Atualização anterior (2026-09-07 — INT-R1g, FLAKE-01 investigado e fechado):**

**Atualização anterior (2026-09-07 — INT-R1e, host Linux alcançou READY):** `bash scripts/bootstrap.sh --ensure --profile full` completou com **exit 0** e `npm run host:diagnose` retornou **`READY`, exit 0, nenhum item não-ready** — os 20 checks passam, incluindo os 7 que bloqueavam a baseline (`jdk21`, `ghidra`, `m68k_gcc`, `sgdk`, `pvsneslib`, `libretro_md`, `libretro_snes`). Fingerprint `82f39923…fff5a` e lock `d531c4b9…5bb5d` **inalterados**: mesmo host, mesmo contrato, mudou só o provisionamento. **ENV-01 e ENV-02 fecham como MELHOROU.** Correção registrada com data e motivo, sem apagar o original: a baseline de 2026-09-06 observou bootstrap exigindo sudo e saindo em exit 1; agora o launcher reportou `sudo not required` — o substrato do host mudou desde então, e **nenhuma autenticação foi contornada**. A restrição de host em A-01/B-01/C-01 fica suspensa. **Limite que continua valendo:** `host:certify` **não** foi executado, nada foi promovido, e o fluxo `Build -> ROM -> Emulação` segue **NÃO MEDIDO** neste SHA. HOST-WIN-01 continua `BLOQUEADO` — este READY é do host Linux, não do runner Windows.

**Atualização anterior (2026-09-07 — INT-R1d, três fatias liberadas com restrição declarada):** por ordem do operador, A-01, B-01 e C-01 passaram a **LIBERADO** sobre `main` `1b2a45bebef6adf0471e46bda608e429bffc480b`, em worktrees e branches disjuntos. **Desvio registrado explicitamente:** a regra vigente exige host **READY** para liberar edição de produto, e o host segue **`DRIFTED`**; em vez de tratar a condição como cumprida, as fatias foram escopadas para não dependerem do host — todas são prováveis por teste unitário. Acompanha a liberação a proibição de declarar build real, ROM, emulação ou medição dinâmica: o que depender de toolchain/core fica **`NÃO MEDIDO`**, e PROF-01 continua valendo (o profiler estima, não mede). Arquivos centrais seguem reservados ao Integrador; HOST-WIN-01 continua `BLOQUEADO`. Detalhes, listas exatas de arquivos e critérios de aceitação no Current Wave.

**Atualização anterior (2026-09-07 — INT-R1c, convergência integrada em `main`):** o PR #41 foi mergeado em `main` por ordem expressa do operador; `main` = `b8987050b02146a1576bc871b39396745afb15b9`. O Programa de Reprodutibilidade (contrato de host, `host-manager.mjs`, `rust-toolchain.toml` versionado, protocolo de host no `AGENTS.md`, gates de `cargo fmt`/licenças/RustSec) passa a existir no tronco, junto com UI fatia 1 e parity rev-2. CI do PR: `validate` PASS, `linux-validate` PASS, `desktop-smoke` **FAIL**. **Limite que não pode ser suavizado:** `main` fica sem gate remoto completo verde, porque o E2E Windows depende de HOST-WIN-01 — detectores `msvc`/`webview2`/`npm` do contrato reportam ausência onde há defeito de detecção — adiado para as Etapas 5-8 enquanto o Windows estiver congelado. Isso **não** certifica `Build -> ROM -> Emulação`; ENV-01/ENV-02 seguem abertos e nenhuma superfície foi promovida. Também registrado: o verde histórico do `desktop-smoke` era sustentado pelo downloader que este programa remove.

**Atualização anterior (2026-09-07 — rodada INT-R1b, convergência executada):** sob autorização do operador, `origin/main` `9b36d2e` foi **mergeado** (não rebaseado) em `convergence/reproducibility`. Destino `1ef03e9b17d27d4d2bce18d698137eb2e3b4fc87` + correções `cc9338f`; a divergência 48/17 virou **0 atrás / 19 à frente** e CONV-01 deixa de bloquear a base. O merge expôs **dois defeitos que nenhum tronco tinha sozinho**: `lib.rs` não compilava (`E0063`) porque `interrupted_install_result`, de `origin/main`, construía `DependencyStatus` sem o campo `applicable` do contrato de host — corrigido com `applicable: true`, pois marcar `false` esconderia o panic no Runtime Setup; e um `clippy::unusual_byte_groupings` em `frame_buffer.rs:116` que **não foi corrigido** por ser área reservada a B e não ser falha de gate. Registrado também que `origin/main` **não tem passo `cargo fmt` no CI** (2171 linhas de diff), gate que chega com este programa. Gates de código verdes no destino: check:tree 0, tsc 0, lint 0, `npm test` 596/6 skipped, fmt 0, clippy 0, `cargo test --lib` **481 passed / 0 failed / 30 ignored**. Isso **não** certifica `Build → ROM → Emulação`: ENV-01/ENV-02 seguem abertos, host `DRIFTED`, reparo dependente de autenticação do operador. Nenhuma superfície promovida, nenhuma fatia A/B/C liberada. Detalhes e próximo passo no Current Wave.

**Atualização anterior (2026-09-06 — rodada INT-R1 do integrador):** ENV-01, ENV-02, GOV-01 e GOV-02 foram reproduzidos no mesmo SHA `0c245386`, com fingerprint e lock digest idênticos aos da baseline. A leitura de convergência da baseline foi corrigida: o `main` local estava obsoleto e, contra o remoto, `origin/main` `9b36d2e00b228a6be3764dbd7d35f5182a78d292` e `HEAD` divergem em **48/17**, sem ancestralidade em nenhuma direção. Achado dominante **CONV-01**: o Programa de Reprodutibilidade não está em `origin/main` (sem `scripts/host-manager.mjs`, sem `toolchains/host-requirements.lock.json`, sem seção de protocolo de host no `AGENTS.md` de lá) e a branch `convergence/reproducibility` nunca foi publicada. Logo não existe base integrada e **nenhuma fatia de código foi liberada**; PROF-02 foi confirmado por inspeção em ambos os troncos, sem correção. Nada foi movido, removido, commitado ou promovido. Tickets INT-01/INT-02/A-01/B-01/C-01 e o próximo passo exato estão no Current Wave.

**Atualização anterior (2026-09-06 — organização documental autorizada):** avaliação do código `0c245386` preservada em [AVALIACAO_DESENVOLVIMENTO_2026_09_06.md](AVALIACAO_DESENVOLVIMENTO_2026_09_06.md), com IDs estáveis e limites da inspeção. [13_PLANO_EXECUCAO_PARALELA.md](13_PLANO_EXECUCAO_PARALELA.md) reúne cronograma estimativo, comparação por evidências e prompts Integrador/A/B/C. Nenhuma rodada de implementação foi liberada ou lançada nesta sessão; leitura paralela pode começar, mas código depende de ticket/base/ownership e host READY. Host observado DRIFTED, bootstrap bloqueado por autenticação, check:tree com falhas preexistentes. Sem promoção de maturidade, alteração de produto ou mudança de decisão arquitetural. Detalhes e próximo passo no Current Wave.

**Atualizacao anterior (2026-09-02 - segunda deriva de toolchain, agora no Rust):** a convergencia de UI avancou (PR #34 `ui-fatia1` em `main` por `0541837`) e logo em seguida **`main` ficou vermelho sem nenhuma mudanca de codigo de produto**. Causa: os dois workflows usavam `dtolnay/rust-toolchain@stable`, que segue o canal. A ultima run verde (2026-07-29) instalou **1.97.1**; a run de 2026-09-02 instalou **1.98.0 (88d9e12ae, 2026-08-18)**, que estreou `clippy::chunks_exact_to_as_chunks` e, sob `-D warnings`, reprovou 7 arquivos intocados (`build_provenance.rs`, `audio_pipeline.rs`, `compatibility_harness.rs` x2, `parity_harness.rs`, `project_mgr.rs`, `tools/reverse/graphics.rs`). Corrigido pela PR #38: pin de `ci.yml` **e** `desktop-e2e.yml` em `dtolnay/rust-toolchain@1.97.1` — a versao comprovadamente verde — com `components: rustfmt, clippy` explicito, porque refs de versao instalam o perfil `minimal` e sem isso o pin trocaria falha de lint por ferramenta ausente. Evidencia: #38 fechou com `validate: pass` e `desktop-smoke: pass`. **Esta e a segunda ocorrencia da mesma classe de falha em duas rodadas consecutivas** — depois do PVSnesLib em 2026-07-29, agora o Rust: dependencia externa nao fixada quebrando o baseline sem commit nosso. Isso eleva a prioridade do `rust-toolchain.toml` versionado (entrega da PR #29, ainda parada), que valeria tambem para build local e nao so para CI. Limites honestos: o pin **congela** em 1.97.1 e nao corrige os 7 sites de `chunks_exact`, que continuam pendentes para quando o toolchain subir de proposito; e o pin de `desktop-smoke` em `windows-2022` segue sendo mitigacao, como ja registrado. Registro adicional da rodada: a PR #35 (`ui-overhaul`) versionava 104 arquivos e 19 MB de mockups em `.codex/`, diretorio nao declarado em `docs/08_TREE_ARCHITECTURE.md`, o que reprovava `npm run check:tree`; foi **destrackeado em vez de afrouxar o gate**, coerente com a reversao do afrouxamento de `.serena` na rodada 71 e com o descarte deliberado do commit `e812828`. Nenhuma superficie foi promovida; nenhuma decisao arquitetural consolidada foi alterada.

**Atualizacao anterior (2026-07-29 - convergencia executada e regressao real do SNES exposta):** a convergencia saiu do diagnostico para execucao. Entraram em `main`: PR #30 (registro do diagnostico), PR #32 (spike de decompilacao curado a partir do PR #23) e PR #33 (`fix/desktop-e2e-runner-pin`). O achado dominante desta rodada e que **restaurar o gate expos um bug real de produto que estava enterrado sob tres camadas de mascaramento**: o bloqueio de billing do Actions escondia a falha de WebDriver do `Desktop E2E`, que por sua vez escondia que o **build SNES estava quebrado**. `render_pvsneslib_makefile` emitia `include ${PVSNESLIB_HOME}/devkitsnes/snes_rules` **antes** de `export ROMNAME`; versoes recentes do PVSnesLib passaram a abortar nesse caso com `snes_rules:60: *** "ROMNAME must be set before including snes_rules"`. Como a toolchain e baixada do upstream a cada execucao de CI, **o SNES quebrou sem nenhuma mudanca no nosso codigo** — ele passava em 2026-07-13 (run `29242338658`). Corrigido movendo `ROMNAME` para antes do include (compativel com as duas versoes: a antiga so usa `$(ROMNAME)` dentro de regras, expandidas no uso) e coberto pela regressao `pvsneslib_makefile_sets_romname_before_including_snes_rules`, que nao existia — motivo pelo qual a quebra passou em silencio. Evidencia de fechamento: run do PR #33 com `Run Mega Drive desktop smoke: success` **e** `Run SNES desktop smoke: success`, primeiro `Desktop E2E` completo verde desde 2026-07-13; `cargo test --lib` **441 passed / 0 failed / 24 ignored** no Windows. Limite honesto obrigatorio: o pin de `desktop-smoke` em `windows-2022` e **mitigacao, nao solucao** — ele congela a imagem do runner e a fragilidade de compatibilidade entre `msedgedriver` e Edge continua aberta. Licao estrutural registrada: a toolchain externa **nao esta fixada**, e essa e exatamente a classe de falha que `toolchains/host-requirements.lock.json` (PR #29) fecha. Nenhuma superficie foi promovida; nenhuma decisao arquitetural consolidada foi alterada. Detalhe operacional completo em `docs/06_CURRENT_WAVE_AI_BANK.md`.

**Atualizacao anterior (2026-07-17):** a branch `codex/reproducibility-program` preserva as Etapas 0/1/2/4 concluidas e fechou os gaps comuns/Linux executaveis: Runtime Setup delega integralmente ao contrato bloqueado, navegador/driver entram no fingerprint, `bigsudo` e automatico no BigLinux, E2E produz evidencia por commit, npm audit esta zerado, npm install scripts possuem allowlist, Tauri/updater/CSP/asset scope foram endurecidos, licencas e metricas arquiteturais ganharam inventario e o CI ganhou validacao Linux/RustSec/Rustfmt. O lock continua `0df750697ecb9a171c11e13d1d3c137f5a8bd9da43ca9448310b630a7f0e9dea` e o fingerprint atual e `b84c6668f17e8eafc0f48eab5097254c529644e8e5cf04ffb9afedd079f9e39c`. Windows foi congelado pelo operador e permanece pendente; logo Etapas 5-8 nao podem receber conclusao formal. Release publico segue proibido sem Windows, signing/updater/licencas de redistribuicao. RustSec tem zero vulnerabilidades, mas registra risco transitivo GTK3/glib informado no Current Wave. Evidencias, testes e proximo comando exato estao em `docs/06_CURRENT_WAVE_AI_BANK.md`.

**Atualizacao anterior (2026-07-28 - diagnostico de produto e inicio da convergencia):** foi registrado `docs/DIAGNOSTICO_PRODUTO_2026_07_28_NAO_CANONICO.md` (NAO canonico) mapeando 8 gaps entre o estado atual e "produto completo", com evidencia verificada em codigo/Git/GitHub. Achado dominante: **o gap principal nao e falta de feature, e falta de convergencia** — `main` parado desde 2026-07-13 enquanto quatro branches vivas acumulavam 7 a 36 commits sem merge. Fatos verificados: CI remoto estava morto desde 2026-07-17 por billing externo (jobs com `runner_id=0`, zero steps) e foi **destravado ao tornar o repositorio publico**; a raiz do repo hospeda 10 worktrees git vivos (~112.000 arquivos) e duas tinham trabalho nao commitado, incluindo ~4.000 linhas de UI Fase B em `.worktrees/ui-overhaul-fase-a`, preservadas em `.claude/cleanup-backups/`; a rodada 83 nao commitada foi **descartada apos backup** por ser superconjunto invertido do PR #25 ja mergeado em `main` (que tem o mesmo guard por revisao mais guards de `generation`/`projectDir` e o contrato `SceneDraftReceipt`). Ordem de convergencia definida: PR #29 (`reproducibility-program`) -> PR #28 (`gameplay-parity-slice`) -> PR #23 (`w7-4-blastem-parity`, exige rebase) -> `ui-overhaul-fase-a`. Nenhuma superficie foi promovida; nenhuma decisao arquitetural consolidada foi alterada.

**Atualizacao anterior (2026-07-13 - Gameplay Parity):** a branch limpa `codex/gameplay-parity-slice`, baseada no `main` certificado em `e700477e`, porta exclusivamente a camada Parity da PR #23: harness/Libretro, contratos e comandos IPC, UI/servico/store, testes e provisionamento canonico de cores. Nenhum arquivo de Decompilacao, Linux, Node ou UI geral entrou. Parity permanece **Experimental**, sem gameplay 1:1 ou cycle accuracy; audio mede o stream entregue pelo core e traces PC/VDP/DMA/scanline ausentes ficam `missing`. Gates locais completos e build debug passaram (**500 frontend / 2 skipped; 481 Rust / 30 ignored**). A prova real host-local foi executada e registrou `blocked_core_missing` por ausencia de core Mega Drive `.so`; auto-provisionamento existente e Windows-only, sem substituicao por fake.

**Atualizacao anterior (2026-07-13 - Node build provenance):** a branch isolada `codex/node-build-provenance`, baseada em `main` `9548dbc`, integra um source map versionado de **proveniência de build** entre NodeGraph, IR Rust, C gerado e ROM. Mappings existem somente quando marcadores do emitter delimitam trecho C real; o restante fica `unsupported` com motivo. O Inspector valida hash/versao e exibe “Proveniência de build observada”. Gates locais completos e build debug passaram (**480 frontend / 2 skipped; 440 Rust / 24 ignored**). A prova SGDK/Libretro oficial e Windows-only e nao esta disponivel neste host Linux, sem substituicao por fake. Node Engine, NodeGraph e Inspector continuam **Experimental**; nao ha observacao de PC, registradores, emulador ou `RuntimeEvidence`. Estado detalhado e proximo gate em `docs/06_CURRENT_WAVE_AI_BANK.md`.

**Atualizacao anterior (2026-07-06 rodada 86 - frente UI fatia 1 v2):** branch `codex/ui-fatia1-tokens-registry` em worktree isolado (`RetroDevStudio-ui-fatia1`), partindo de `main` `9001d2a`; numeracao 78-85 pertence as frentes Linux/parity/integracao em branches proprias. A rodada implementa a fatia 1 v2 do estudo nao-canonico `docs/ESTUDO_UI_PRODUTO_NAO_CANONICO.md` (criado e commitado nesta frente): (1) tokens semanticos `--rds-*` estendidos em `src/styles/index.css` (accent/hover/on-accent/surfaces/text) com migracao de prova em `ToolbarButton` e raiz do shell; o anel `:focus-visible` global ja existia em `main` e foi mantido; (2) **Surface Registry** em `src/core/surfaceRegistry.ts` (`minPersona`/`maturity`/`capability`/`roadmapRef`) derivando o rail (`WORKSPACE_ITEMS`) como fonte unica, com **gate registry x roadmap** em `surfaceRegistry.test.ts` que falha se a linha correspondente sumir da matriz de `docs/03_ROADMAP_MVP.md`; (3) **seletor de persona** Guiado/Criador/Pro/Hacker no topbar com default `pro` (zero regressao provada em teste), gating do rail e dos comandos `workspace.logic/artstudio`, persistencia localStorage, auto-switch para Scene quando o workspace ativo fica oculto e sugestao local de transicao; (4) **densidade de shell** `compact/standard/wide` em `workspaceLayout.ts` (corte compacto subiu para 1440 e passa a cobrir Steam Deck 1280 e notebooks 1366), `data-density`/`data-shell-persona` na raiz do shell e layout salvo por perfil de densidade com fallback para a chave legada; (5) **EmptyState** padrao (`src/components/common/EmptyState.tsx`) aplicado ao Hierarchy sem projeto com CTA real "Abrir projeto"; (6) **autosave de rascunho local** em `scenePersistence.ts` (localStorage por projeto, debounce 2s, badge no topbar, banner de recuperacao que restaura no editor SEM gravar em disco; o persist canonico limpa o draft); (7) auditoria **undo/redo** com teste de contrato em `editorStore.test.ts` (addEntity/updateEntity/updateBackgroundLayer/removeEntity empurram historico; collision paint usa begin/commitHistoryCapture como entrada unica, por design); (8) **metricas locais de produto** em `productMetrics.ts` (100% local, sem rede, opt-out, TTFR e gatilhos objetivos de persona guiado->criador e criador->pro; pro->hacker sem gatilho ate existir superficie de reversa gated). Matriz do roadmap ganhou 5 linhas Experimentais (Surface Registry, Seletor de persona, Shell adaptativo por densidade, Autosave de rascunho local, Metricas locais). Gates no worktree: `check:tree` OK, `lint` OK, `tsc --noEmit` OK, `npm test` **48 arquivos passed / 453 testes passed / 2 skipped / 1 failed** - a unica falha e `scripts/build-environment.test.mjs > prepends the user Cargo bin to PATH on Windows`, **pre-existente em `main` neste host Linux e corrigida pela frente Linux (rodadas 78+) em branch propria; nao tocada aqui para nao misturar escopos**. Gates Rust nao rodados nesta rodada: zero mudanca Rust (diff 100% frontend/docs); CI cobre no push. `tauri-driver` ausente no host: QA-RC desktop fica para host com driver/CI. Status honesto: todas as superficies novas sao **Experimental**, sem promocao Stable; as insercoes canonicas da secao 12 do estudo (tese no PRD, regra normativa do registry no roadmap, linha no tree) permanecem **NAO aplicadas**, aguardando decisao humana. Proximos passos da frente UI: bloco H estendido com asserts por resolucao, drawers overlay no compacto, UI de opt-out de metricas, varredura completa de tokens nos componentes restantes.

**Atualizacao anterior (2026-06-28 rodada 77 - W7.4/W7.5 em hardening):** branch `codex/w7-4-blastem-parity`, partindo de `origin/main`/`main` em `9001d2a`. A rodada adiciona Cross-Core Parity e Cycle Report como superficies **Experimental/em hardening**, sem promocao Stable e sem claim de equivalencia gameplay 1:1. Backend: `parity_harness.rs` preserva divergencia de estado final mesmo quando hashes de framebuffer divergem, valida caminhos obrigatorios para ROM/golden/core e gera `cross-core-parity-report.{json,md}`; `parity_run_cycle_report` gera `rds-cycle-report/v1` com timings de frame no host, hashes, estado final e evidencias `m68k_cycle_trace`, `z80_cycle_trace`, `vdp_scanline_trace`, `dma_timing` marcadas como `missing` quando o core Libretro nao expoe traces internos (`not_cycle_accurate=true`). Dependencias/Libretro: `blastem_libretro` entrou como candidato Mega Drive oficial de instalacao/autodetect ao lado de Genesis Plus GX e PicoDrive; o upstream Libretro foi verificado, mas neste host nao havia `blastem_libretro.dll`, entao a validacao real local usou `Genesis Plus GX v1.7.4 46a5521` vs `PicoDrive 2.05-046e5ff`. Frontend: `parityService.ts`, `editorStore.ts` e `ToolsPanel.tsx` ganharam abas **Cross-Core Parity** e **Cycle Report**, ambas `Experimental`, com erros acionaveis, resumo de divergencias/limitacoes e store do ultimo relatorio. Evidencia host-local: teste ignorado `w7_4_w7_5_real_cores_generate_reports_when_available` passou e gerou reports em `src-tauri/target-test/validation/w7-4-w7-5-real-parity/project/.rds/reports/`; a ROM dummy BYOR-safe divergiu entre cores, o que foi reportado como divergencia, nao como falha mascarada. Gates desta rodada: `check:tree`, lint, tsc, `npm test` **47 arquivos / 442 testes**, `cargo check --lib`, clippy, `cargo test --lib` **457/0/24**, preflight SGDK `Ready: SIM`, `build:debug` e `qa-rc` **A-H passed** (`manual-qa-status.json` 2026-06-28T21:04:51.484Z). Readiness de promocao deve ser lido como governanca de branch ate merge em `main`.

**Atualizacao anterior (2026-06-17 rodada 71 - W7.3 finalizada):** branch `codex/w7-3-parity-robustness`, commit de codigo `e8f5e82` (sobre `f189be0`). Fechou as lacunas deixadas pela rodada 70: (1) `scripts/check-tree.cjs` voltou a NAO ignorar `.serena` (afrouxamento revertido) e `.serena/` foi movido para backup fora da raiz; (2) `ProjectCapabilityPanel.tsx` deixou de chamar parity com `golden_path` vazio (botao que sempre falhava removido; agora orienta para a aba **Tools -> Parity Capture**, superficie canonica - nao existe `RuntimeConsolePanel` na arvore); (3) `ParityCaptureSection` atualiza `lastParityReport`; (4) cobertura de UI parity ampliada (`ProjectCapabilityPanel.test.tsx`, `ToolsPanel.test.tsx`); (5) **causa raiz Rust/QA-RC resolvida** - SGDK em path com espaco (`F:\Projects\Sgdk Forge`) quebrava o make (`*** empty variable name. Stop.`); `build_orch.rs` passa `SGDK`/`GDK` ao make como caminho sem espacos (8.3 ou junction `mklink /J`), com regressao `megadrive_build_passes_space_free_sgdk_paths_to_make`. Gates verdes no commit: check:tree, lint, tsc, `npm test` **411**, clippy, `cargo test --lib` **436/0/23**, preflight **Ready: SIM**, `qa-rc` **A-H passed**, `release:readiness:promotion` com unico bloqueador = governanca de branch (2 a frente de `origin/main`), apontando para `e8f5e82`. Artefatos frescos 2026-06-17: EXE portable (23.555.584 B), MSI (8.249.344 B), `release-manifest.json` (`commit=e8f5e82`). Limites honestos: NAO e BlastEm, NAO faz cycle accuracy, NAO prova gameplay 1:1. Gameplay Parity **Experimental**; nenhuma promocao Stable.

**Atualizacao anterior (2026-06-17 rodada 70 - W7.3 parity/capture robust layer):** branch `codex/w7-3-parity-robustness` criada a partir de `main` (`d17dfde`) para implementar a camada de gameplay parity capture. Backend: `parity_harness.rs` (~742 linhas, 13 testes), `project_capability.rs` (campo `gameplay_parity`), `libretro_ffi.rs` (`pub mod test_helpers`, `capture_runtime_state_bytes`), `lib.rs` (comando `parity_run_capture`). Frontend: `parityService.ts` (6 testes), `projectCapability.ts` (interfaces + `gameplay_parity`), `editorStore.ts` (`lastParityReport`), UI portada em `ProjectCapabilityPanel.tsx` e `ToolsPanel.tsx` (tab "Parity Capture"). Gates: tsc, lint, **406/406 npm test**, clippy OK, **18/18 parity tests** + **434/434 cargo test --lib** (1 pre-existing SGDK toolchain detection failure). `npm run build:debug` OK (41MB EXE). Release/portable build em LTO (timeout ~20 min, retornar em sessao dedicada para `build:portable` + `build:msi`). Superficie **Experimental/em hardening**; nenhuma promocao Stable.

## ATENCAO PARA AGENTES DE IA

**Este arquivo continua sendo a entrada oficial do estado operacional.** Para reduzir token bounds, o conteudo foi fragmentado em:

| Arquivo | Uso |
|---------|-----|
| `docs/06_CURRENT_WAVE_AI_BANK.md` | Estado atual, Wave S+, sessoes recentes, decisoes e proximos passos |
| `docs/06_AI_MEMORY_BANK_WAVE_A_R.md` | Historico arquivado das waves A-R |

**Fluxo canonico:** leia este arquivo primeiro e siga imediatamente para `docs/06_CURRENT_WAVE_AI_BANK.md`.
**Atualizacao ativa mais recente (2026-05-30 rodada 69):** a branch `codex/ui-final-operational-hardening` foi aberta a partir de `origin/main`/`main` em `935c604262f7f46198416d139b39ace4cdf550ac` para retomar uma implementacao interrompida e publicada em `origin/codex/ui-final-operational-hardening`. A rodada fecha somente a fatia A+B do handoff anterior: shell/topbar/abrir-importar e NodeGraph sem overlays invasivos. O menu Projeto agora separa `Novo Projeto`, `Abrir Projeto`, `Importar Projeto Externo` e `Importar Asset`; o wizard usa os mesmos nomes explicitos, e `Importar Asset` exige projeto ativo, abre o ArtStudio e registra orientacao para imagem/spritesheets, `command.dat` e audio canonico em `assets/audio`. No NodeGraph, `Logic Context` foi dockado no rail direito `nodegraph-context-rail`, fora da area mensuravel `nodegraph-canvas`, com eventos isolados para nao interferir em pan/drag; o oracle desktop captura esse rail e falha com `nodegraph-context-overlaps-canvas` se houver invasao do canvas. Gates frescos: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**44 arquivos / 400 testes**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**417 passed / 23 ignored**), `npm run build:debug`, `npm run preflight:sgdk-e2e`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-upstream-windows.ps1 -SkipRustTests` e `npm run test:e2e:desktop:qa-rc` A-H passaram. Duas tentativas de `npm run release:readiness:promotion` nesta branch foram encerradas apos timeout local sem retorno (aprox. 15 min antes do commit e 40 min apos o push) e nao contam como verde; o gate e de promocao institucional e deve ser rerodado em destino limpo/main apos merge. Schemas Tauri gerados foram preservados em `F:\Projects\RetroDevStudio-cleanup-backups\ui-final-hardening-generated-schemas-20260530-194757.patch` e `ui-final-hardening-generated-schemas-post-readiness-timeout-20260530-202321.patch` antes de restauracao seletiva. Nenhuma superficie foi promovida para Stable; NodeGraph, ArtStudio, SGDK Visual No-Code e importadores continuam **Experimental/em hardening**.

**Atualizacao ativa anterior (2026-05-30 rodada 68):** `F:\Projects\RetroDevStudio` voltou a ser o checkout canonico unico do projeto, limpo e alinhado com `origin/main` em `87096854bb19b3e563fd7bfd834250d41807f920`. Esse `main` contem a frente SGDK Visual No-Code Core B (`c726e43`) e a frente SGDK semantic core A (`8709685`) integrada por fast-forward. `git worktree list` aponta somente para o diretorio canonico; os worktrees antigos foram removidos ou arquivados em `F:\Projects\RetroDevStudio-cleanup-backups\archived-dirs-20260530-102456`, com diffs sujos preservados em `F:\Projects\RetroDevStudio-cleanup-backups\archive-20260530-102456`. Resta apenas `F:\Projects\RetroDevStudio-agent-sgdk-semantic-core`, pasta vazia sem vinculo Git bloqueada por processo externo/handle do Windows; ela pode ser apagada apos o processo que a segura ser encerrado. Gates finais no checkout canonico: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**44 arquivos / 397 testes**), `cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri\Cargo.toml --lib -- --nocapture --test-threads=1` (**417 passed / 23 ignored**), `npm run preflight:sgdk-e2e`, `validate-upstream-windows.ps1 -SkipRustTests`, `npm run test:e2e:desktop:qa-rc` A-H, `npm run build:portable`, `npm run build:msi`, `npm run release:manifest` e `npm run release:readiness:promotion` (`Pronto para promocao: SIM`). Isto organiza o projeto em um unico diretorio funcional e compilado; SGDK Visual No-Code, NodeGraph, ArtStudio e Semantic Core continuam **Experimental/em hardening**, sem promocao Stable.

**Atualizacao ativa anterior (2026-05-30 rodada 67):** a frente SGDK Visual No-Code Core A foi consolidada sobre `origin/main` apos a entrada do Core B. O backend agora adiciona relatorios experimentais de IR semantico, cobertura de nodes, round-trip estatico, restricoes de hardware Mega Drive e export de node graph com familias `vdp_validator`, `dma_budget` e `palette_hblank`, alem de comandos IPC Tauri e wrappers frontend (`sgdkSemantic.ts` / `sgdkSemanticService.ts`). A superficie continua **Experimental/em hardening**: reports estaticos deixam `emulation_visible_ok` nulo quando nao ha gate real, bridges seguem explicitas e nada foi promovido para Stable. Gates da branch antes da consolidacao: `check:tree`, `lint`, `tsc`, `npm test` (**44 arquivos / 386 testes**), `cargo clippy`, `cargo test --lib` (**416 passed / 23 ignored**), `preflight:sgdk-e2e`, `validate-upstream-windows.ps1 -SkipRustTests`, corpus SGDK real 122 projetos, relatorios verticais de logica, matriz SGDK 7/7 e no-code SGDK oficial com toolchain/Libretro reais. Esta rodada existe para somar a base semantica ao hardening visual, nao para declarar SGDK/Node Engine completos.

**Atualizacao ativa anterior (2026-05-30 rodada 66):** a frente SGDK Visual No-Code Core B foi implementada na branch `codex/sgdk-visual-nocode-core-b`, em worktree isolado `F:\Projects\RetroDevStudio-agent-sgdk-nodegraph-artstudio`, partindo de `origin/main` e sem tocar o worktree principal sujo. NodeGraph ganhou canvas com pan/zoom por botao do meio e `Space + drag`, snap-to-grid, grid/minimap escalados, categorias visuais de nodes, group boxes, ponte read-only para bridges, estilos de edge hover/ativo, feedback compacto de hardware (tiles, palettes, sprites/frame, sprites/scanline, VRAM, DMA e estrategias como streaming/banks/palette swaps/multiplexing) e criacao visual de transicoes a partir de `SpriteComponent.commands`/`command.dat`. ArtStudio ganhou metadados de animacao por frame (`frame_durations`, `loop_start`, `onion_skin`, `hitboxes`), timeline com mover/duplicar/remover e drag/drop de frames, editor de duracao/loop/onion/hitbox, preview com onion skin e hitbox overlays, palette manager experimental, comando manual com validacao de tokens, estrategia concreta de importacao de arte sem dependencia nova e helpers testaveis. O contrato TypeScript/Rust de `AnimationDef` foi estendido com defaults/compatibilidade serde para preservar projetos antigos. Gates executados na branch: focused Vitest NodeGraph+ArtStudio OK (**58 testes**), focused Rust round-trip OK (**1 teste**), `npm run check:tree` OK, `npm run lint` OK, `npx tsc --noEmit --pretty false` OK, `npm test -- --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000` OK (**44 arquivos / 397 testes**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` OK, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` OK (**414 passed / 23 ignored**) e `npm run test:e2e:desktop:qa-rc` OK A-H com SGDK real via `GDK=F:\Projects\MegaDrive_DEV\sdk\sgdk-2.11`, `tauri-driver` local e `RDS_EDGE_DRIVER_PATH=F:\Projects\RetroDevStudio-main-promotion\toolchains\webdriver\msedgedriver.exe`; evidencias `qa-rc-2026-05-30T12-43-55-834Z-*`. Commit tecnico `feat: harden sgdk visual no-code UX` foi pushado para `origin/codex/sgdk-visual-nocode-core-b`. Status honesto: SGDK Visual No-Code, NodeGraph e ArtStudio continuam **Experimental/em hardening**; nenhuma superficie foi promovida para Stable/pronta.

**Atualizacao ativa anterior (2026-05-27 rodada 65):** PR #17 (`codex/asset-browser-production-x-rebased`) foi integrado em `main` por merge commit `634e2478a19d80d6acbf91216a9d5472de4cb115`, contendo `c4ed1f8aeae2d72b697e1122533b6a1addcf1ce7` e a fatia tecnica `3191e7e`. `git merge-base --is-ancestor c4ed1f8aeae2d72b697e1122533b6a1addcf1ce7 HEAD` passou no destino, `origin/main...HEAD` ficou `0/0` e o worktree `F:\Projects\RetroDevStudio-main-promotion` estava limpo antes do registro documental. Checks remotos do `main` no merge commit: `CI` push `success` (`26529217211`) e `Desktop E2E` push `success` (`26529217613`); os checks remotos previos do branch tambem estavam verdes. Gates pos-merge em `main`: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**44 arquivos / 386 testes**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**413 passed / 23 ignored**), `npm run release:readiness:promotion` (`Pronto para promocao: SIM`) e `git diff --check`. Builds finais: `npm run build:debug`, `npm run build:portable`, `npm run build:msi` e `npm run release:manifest` passaram; artefatos esperados: debug EXE `39773184` bytes, portable EXE `22909952` bytes e MSI `8048640` bytes, com hashes registrados no `src-tauri/target-test/validation/release-manifest.json` gerado no HEAD final. Asset Browser agora esta em `main` como **Experimental/em hardening**; nenhuma superficie foi declarada Stable/pronta. A limpeza de worktrees so pode remover worktrees limpos e mergeados; worktrees sujos seguem preservados com patch.

**Atualizacao ativa mais recente (2026-05-27 rodada 64):** a frente Asset Browser X foi reconstituida de forma conservadora em `codex/asset-browser-production-x-rebased`, criada a partir de `origin/main` `5090d5957ceddcfbe9ac730391479616ce357cd6`, sem rebasear a branch antiga divergente. O worktree original `F:\Projects\RetroDevStudio-agent-x-asset-browser` permanece preservado em `codex/asset-browser-production-x` (`2aca62e860b92f8c298822e1d467140d8d8e7b78`), sem remoto, com os schemas gerados sujos ja salvos antes em `F:\Projects\RetroDevStudio-cleanup-backups\asset-browser-x-audit-dirty-20260526-224618.*` e novamente em `F:\Projects\RetroDevStudio-cleanup-backups\asset-browser-x-current-dirty-20260527-045031.*`. A curadoria reaproveitou apenas o delta ainda util: busca/filtros por tipo/gerado/orfao/over-budget, classificacao de assets, resumo rapido de orcamento usando `HwStatus`, marcador de orfao, preview seguro para nao-imagens, detalhes de cena/grafo em "Usado por", abertura direta no ArtStudio sem inserir na cena e regressao de UI/modelo. Foram descartados como superseded/ruido os commits antigos de workspace shell, Runtime Setup, NodeGraph, command.dat, GameMaker/Godot ja absorvidos por `main`, alem de schemas Tauri gerados; ruídos criados por build/QA foram preservados em `F:\Projects\RetroDevStudio-cleanup-backups\asset-browser-x-rebased-generated-noise-20260527-064710.*` e `asset-browser-x-rebased-cargo-noise-20260527-065137.*` antes da limpeza. Gates locais da branch rebased: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**44 arquivos / 386 testes**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**413 passed / 23 ignored**), `npm run test:e2e:desktop:qa-rc` A-H com `RDS_EDGE_DRIVER_PATH=F:\Projects\RetroDevStudio-main-promotion\toolchains\webdriver\msedgedriver.exe` e evidencias `qa-rc-2026-05-27T09-49-29-979Z-*`, e `git diff --check`. Asset Browser continua **Experimental/em hardening**; nenhuma superficie foi declarada Stable/pronta.

**Atualizacao ativa mais recente (2026-05-26 rodada 63):** PR #14 (`codex/godot-2d-subset-y`, head `230ed12d8d755b33fceb0e70af7790386e2c8161`), PR #15 (`codex/command-palette-shortcut-editor-r`, head `6f282d0fd0459fb765cbcf61f1b39400bdc0566d`) e PR #16 (`codex/e2e-create-game-from-zero-s`, head `b4bf3d42917b4748614d1148e7a19abc5dedbf80`) foram confirmados integrados em `main` pelos merge commits `0c0f59e451b158f55c85a928f451f1d9b610d034`, `f20ccd19bb033cea95507ea45b6a5e99042a7029` e `42db9fb30dcc79d659929c6f0d285f2be449d325`. `git merge-base --is-ancestor` confirmou os tres heads dentro do destino. Apos `git fetch --prune origin`, `git checkout main` e `git pull --ff-only origin main`, o readiness inicial pos-merge executou build/baseline/upstream/desktop E2E, mas bloqueou por governanca porque a validacao migrou `src-tauri/tests/fixtures/projects/megadrive_dummy/scenes/main.json` de `schema_version` `1.6.0` para `1.7.0` e tocou arquivos gerados sem diff material; o estado foi preservado em `F:\Projects\RetroDevStudio-cleanup-backups\main-readiness-post-pr15-pr16-dirty-20260526-221524.patch`, `.status.txt` e `.hashes.txt`. O ajuste tecnico minimo `9a058f004d43ae16d3047add78c1a4254ceb48a6` (`test: refresh megadrive fixture schema version`) foi pushado em `main`, deixando o destino local/remoto nesse SHA antes do registro documental. Gates pos-merge em `main`: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**43 arquivos / 379 testes**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**413 passed / 23 ignored**), `npm run release:readiness:promotion` (`Pronto para promocao: SIM`) e `git diff --check`. Checks remotos confirmados via GitHub API: PRs #14/#15/#16 com `validate` e `desktop-smoke` `success`; `main` em `9a058f004d43ae16d3047add78c1a4254ceb48a6` tambem com `validate` e `desktop-smoke` `success`. Godot 2D subset, Command Palette/Shortcut Editor e Create Game E2E estao integrados apenas como superficies Experimentais/em hardening; nenhuma superficie foi declarada Stable/pronta. Auditoria inicial de `codex/asset-browser-production-x`: worktree `F:\Projects\RetroDevStudio-agent-x-asset-browser`, branch local `2aca62e860b92f8c298822e1d467140d8d8e7b78`, sem remoto `origin/codex/asset-browser-production-x`, sujo em `src-tauri/gen/schemas/acl-manifests.json`, `desktop-schema.json` e `windows-schema.json`; backup preservado em `F:\Projects\RetroDevStudio-cleanup-backups\asset-browser-x-audit-dirty-20260526-224618.patch`, `.cached.patch`, `.status*.txt`, `.hashes.txt` e `.log.txt`. Comparacao: `origin/main...HEAD = 106/6`, `HEAD` nao e ancestral de `origin/main` e `origin/main` nao e ancestral de `HEAD`; a branch mistura commits antigos parcialmente absorvidos com uma fatia Asset Browser ainda nao limpa. Decisao conservadora: nao rebasear, nao fechar e nao remover ate curadoria manual/tecnica dedicada do patch e dos commits unicos.

**Atualizacao ativa anterior (2026-05-26 rodada 60):** PR #12 (`codex/nodegraph-execution-inspector-w`, head `28263357e5c01c2bbe4aca98d39a8451658d6066`) e PR #13 (`codex/save-sram-project-settings-u`, head `96d49579da778eef8e8176643e7db6c947dd9cb9`) foram confirmados integrados em `main` pelos merge commits `d4b3b5942dde886f35965b5cc71f297d2e5e8520` e `ee07110ea22804dc8cb36296b6b281f8d316e07d`. O `main` final local/remoto esta em `ee07110ea22804dc8cb36296b6b281f8d316e07d`, e `git merge-base --is-ancestor` confirmou os dois heads dentro do destino. Gates pos-merge em `main`: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --no-file-parallelism --maxWorkers=1` apos timeout isolado de worker no primeiro `npm test`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**406 passed / 22 ignored**), `npm run release:readiness:promotion` e `git diff --check`. O readiness final retornou `Pronto para promocao: SIM`; a primeira tentativa detectou sujeira gerada por validacao, preservada antes da limpeza em `F:\Projects\RetroDevStudio-cleanup-backups\main-readiness-dirty-20260526-150245.patch`, e o rerun verde tambem teve diff gerado preservado em `F:\Projects\RetroDevStudio-cleanup-backups\main-readiness-dirty-postsuccess-20260526-151520.patch`. NodeGraph Inspector e Save/SRAM estao integrados como superficies Experimentais/em hardening; nenhuma superficie foi declarada Stable. Proxima leva: abrir/processar `codex/godot-2d-subset-y`, `codex/command-palette-shortcut-editor-r` e `codex/e2e-create-game-from-zero-s`; `codex/asset-browser-production-x` permanece intocada ate auditoria do worktree sujo.

**Atualizacao ativa anterior (2026-05-25 rodada 57):** apos a integracao AAA em `main` e o registro documental `72c31f787b1b8af0b6811134bb74181c2be903e5`, a triagem governada foi corrigida com rebase final das branches pendentes sobre `origin/main`. `codex/release-manifest-packaging-z` PR #11 (`a699e02`), `codex/nodegraph-execution-inspector-w` PR #12 (`e2bf5b1`) e `codex/save-sram-project-settings-u` PR #13 (`49626a9`) estao abertos com `CI / validate` e `Desktop E2E / desktop-smoke` verdes em `push` e `pull_request`, aguardando autenticacao/merge humano. `codex/godot-2d-subset-y` (`30b495c`), `codex/command-palette-shortcut-editor-r` (`0ff2506`) e `codex/e2e-create-game-from-zero-s` (`4d1f717`) foram rebaseadas, validadas, pushadas e estao com checks remotos de `push` verdes; `gh auth status` continua sem login, entao PRs locais nao puderam ser criados para Y/R/S. `git merge-tree --write-tree origin/main <branch>` ficou limpo para Z/W/U/Y/R/S apos o rebase final. A branch `codex/asset-browser-production-x` tem remoto ausente e worktree com gerados sujos, portanto foi preservada e nao removida. Em `main`, `npm run build:debug`, `npm run build:portable`, `npm run build:msi` e `npm run release:readiness:promotion` passaram; readiness retornou `Pronto para promocao: SIM` em `72c31f787b1b8af0b6811134bb74181c2be903e5`. Artefatos finais: `src-tauri/target-test/debug/retro-dev-studio.exe`, `src-tauri/target-test/release/retro-dev-studio.exe` e `src-tauri/target-test/release/bundle/msi/RetroDev Studio_0.1.0_x64_en-US.msi`. Isto nao promove SGDK/Node Engine/GameMaker/Godot/MUGEN/Ikemen/OpenBOR/SNES/ArtStudio/AAA para Stable; todas as superficies parciais seguem Experimental/Em hardening ate evidencia institucional completa.

**Atualizacao ativa anterior (2026-05-25 rodada 56):** apos a integracao AAA em `main` (`fc925e2b200ca92409e7773fd0126484d4798505`), a triagem governada inicial das branches pendentes foi executada sem limpeza destrutiva. Um commit documental posterior em `main` exigiu o rebase final registrado na rodada 57.

**Atualizacao ativa mais recente (2026-05-25 rodada 55):** PR #10 (`codex/aaa-capability-layer-q`) foi aberto e mergeado em `main` por `962e856aeee948c0e6b96be9ec3fb4d6b053ecd9`, contendo `d3651ecec3a41652ba2f2731ddb6577071221c81`. A branch ja tinha sido rebased sobre `origin/main` (`25166c7ff8712dad286e73b41ae5e577029d9e67`) e validada localmente com `check:tree`, `lint`, `tsc`, `npm test` **357/357**, `cargo clippy`, `cargo test --lib` **398 passed / 22 ignored**, `build:debug`, `preflight:sgdk-e2e`, `test:e2e:desktop:qa-rc` A-H (`qa-rc-2026-05-24T20-49-39-814Z-*`), `validate-upstream-windows.ps1 -SkipRustTests` e `git diff --check`. Em `main` pos-merge, os checks remotos `CI / validate` e `Desktop E2E / desktop-smoke` do commit `962e856aeee948c0e6b96be9ec3fb4d6b053ecd9` completaram com `success`, e `npm run release:readiness:promotion` retornou `Pronto para promocao: SIM`. A camada adiciona diagnostics experimentais de capability, ROM mastering, runtime contracts, audio, asset quality e templates SGDK no produto, mas **nao** declara AAA pronto nem promove SGDK/Node Engine/GameMaker/Godot/MUGEN/OpenBOR/SNES/ArtStudio para Stable.

**Atualizacao ativa anterior (2026-05-24 rodada 54):** branch `codex/aaa-capability-layer-q` foi rebased sobre `origin/main` (`25166c7ff8712dad286e73b41ae5e577029d9e67`) e validada localmente no head tecnico `c3bea9799347ed1650fc8544419e551857b586cc`. Gates frescos pos-rebase: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` **357/357**, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` **398 passed / 22 ignored**, `npm run build:debug`, `npm run preflight:sgdk-e2e`, `npm run test:e2e:desktop:qa-rc` A-H (`qa-rc-2026-05-24T20-49-39-814Z-*`), `powershell -ExecutionPolicy Bypass -File scripts\validate-upstream-windows.ps1 -SkipRustTests` e `git diff --check`. A camada adiciona diagnostics experimentais de capability, ROM mastering, runtime contracts, audio, asset quality e templates SGDK no produto, mas **nao** declara AAA pronto nem promove SGDK/Node Engine/GameMaker/Godot/MUGEN/OpenBOR/SNES/ArtStudio para Stable.

**Atualizacao ativa anterior (2026-05-24 rodada 53):** PR #9 (`codex/full-product-cohesion-integration`) foi mergeado em `main` por `b1fa27bced08163f751ab5615332cb0a793fc06a`, contendo `b80accca85312e531783caa1d3ec9a58ed4b4101`. Apos o merge, `main` recebeu o hotfix `f59309c067b467cf21ad48ddc5d6c4415012d78e` para alinhar o build real ao preflight: `BuildEnvironment::detect()` agora aceita `GDK`/`GDK_WIN` como aliases oficiais de SGDK, alem de `SGDK_ROOT` e `toolchains/sgdk`. `npm run release:readiness:promotion` passou no destino com `Pronto para promocao: SIM`; gates locais rodados incluem `check:tree`, `lint`, `tsc`, `npm test` **350/350**, `cargo clippy`, `cargo test --lib` **383/22 ignored**, `build:debug`, `build:portable`, `build:msi`, `preflight:sgdk-e2e`, `test:e2e:desktop:qa-rc` A-H (`qa-rc-2026-05-24T16-02-05-806Z-*`), `validate-upstream-windows.ps1 -SkipRustTests` e `git diff --check`. Artefatos gerados: `src-tauri/target-test/debug/retro-dev-studio.exe`, `src-tauri/target-test/release/retro-dev-studio.exe` e `src-tauri/target-test/release/bundle/msi/RetroDev Studio_0.1.0_x64_en-US.msi`. Checks remotos do PR #9 estavam verdes; no hotfix `f59309c`, `CI / validate` e `Desktop E2E / desktop-smoke` remotos tambem completaram com `success`. Sem promocao SGDK/Node Engine/GameMaker/Godot/MUGEN/OpenBOR/SNES/ArtStudio/AAA para Stable; superficies parciais continuam Experimental/Em hardening conforme roadmap.

**Atualizacao ativa anterior (Agente Q, branch `codex/aaa-capability-layer-q`):** criada camada experimental de evidencia pratica, sem claim de "AAA pronto": modelo Rust/TypeScript `ProjectCapabilityReport`, comandos Tauri `inspect_project_capability`, `inspect_rom_mastering`, `inspect_runtime_contracts`, `inspect_audio_pipeline`, `list_sgdk_pattern_templates` e `inspect_asset_quality`, e paineis integrados em Debug/Tools, Build/Game status, Inspector, ArtStudio e NodeGraph. ROM mastering so inspeciona SEGA/SNES, regiao, SRAM, checksum, tamanho, alinhamento, SHA256 e extensao; runtime evidence probe fica desligado por padrao; templates SGDK entram como galeria Experimental. Status: capability diagnostics **Experimental**, sem promocao de SGDK/Node Engine/ArtStudio/SNES/GameMaker/MUGEN/OpenBOR.

**Atualizacao ativa anterior (2026-05-23 rodada 51, branch `codex/release-manifest-packaging-z`):** adicionou `scripts/release-manifest.mjs` e o script npm `release:manifest`, gerando `src-tauri/target-test/validation/release-manifest.json` para distribuicao interna auditavel. O manifesto registra versao, commit, branch, data, EXE debug, EXE portable, MSI, SHA256/tamanho, readiness report, resumo de toolchains, CI quando disponivel, signing e updater. Cobertura: schema minimo, hashes SHA256, erro acionavel para artefato ausente, leitura correta do upstream report e bloqueio de assinatura falsa sem certificado real. Status historico honesto: `validate-upstream-windows.ps1 -SkipRustTests` falhou duas vezes com `toolchain_missing` e `release-readiness.md` seguia `Pronto para promocao: NAO`; a branch precisa de rebase e validacao fresca sobre `origin/main`.

**Atualizacao ativa anterior:** em `2026-05-20 (rodada 50)`, a branch `codex/product-ui-workspace-redesign` fechou o **bloco H** do QA RC com asserts automaticos em `scripts/e2e-tauri-build-run.mjs` e **12 screenshots** (`H-ui-layout-*`) para 1366x768, 1920x1080 e 2560x1080 sobre Scene/Logic/Game/Debug. E2E: `clickByTestId`, retorno a Scene antes do botao Objeto->Art pos-Logic (Inspector desmontado com `showRight=false`), espera do side rail do NodeGraph apos lazy-load, timeout de arranque do driver em `qa-rc`, janela 1920 no onboarding RC. Topbar: scroll horizontal no bloco central. Gates: `check:tree`, `lint`, `tsc`, `npm test` **322/322**, `cargo clippy`, `cargo test --lib`, `preflight:sgdk-e2e`, `validate-upstream-windows.ps1 -SkipRustTests`, `build:debug`/`portable`/`msi`, QA RC A-H verde (`qa-rc-2026-05-20T07-45-07-583Z-*`). UI hardening **SIM para a fatia H**; promocoes SGDK/Node Engine inalteradas (**sem** promocao Stable institucional).

**Atualizacao ativa anterior:** em `2026-05-19 (rodada 48)`, a branch `codex/project-cohesion-full-build` consolidou `main` (GameMaker vertical via PR #8) com `codex/command-dat-artstudio-node-runtime`: coexistem `compatibility_harness`/`gml_to_nodes` e `input_commands`/`input_command`/ArtStudio Comandos. GameMaker e command.dat permanecem **Experimental**; SGDK/Node Engine sem promocao Stable institucional nesta rodada.

**Atualizacao ativa anterior:** em `2026-05-19 (rodada 47)`, a branch `codex/command-dat-artstudio-node-runtime` fechou uma frente paralela em worktree isolada (`F:\Projects\RetroDevStudio-command-dat`) para transformar `command.dat` local/BYOR em comandos visuais e nodes executaveis. O parser canonico Rust (`src-tauri/src/core/input_commands.rs`) e o espelho frontend (`src/core/inputCommands.ts`) suportam o subset `[Command]`, `name`, `command`, `time`, direcoes `_1.._9`, aliases `D/F/B/U/DF/DB/UF/UB`, `_P/_K`, botoes MUGEN `a,b,c,x,y,z`, simultaneo `+`, sequencias por virgula e janela por frames. `SpriteComponent.commands` persiste bindings experimentais; ArtStudio importa arquivo local, mostra chips visuais por perfil Mega Drive/SNES/teclado/mouse e associa comandos a sequencias; NodeGraph ganhou `input_command`, quick action e codegen SGDK/SNES com matcher por ring buffer. Tokens fora do subset geram `unsupported_tokens` e bloqueiam C via `#error` acionavel. A prova real `official_sgdk_nocode_game_builds_and_runs_with_real_toolchain --ignored` passou com SGDK v2.11/Libretro reais e o projeto no-code persistente inclui Hadouken por `input_command`, ROM real e framebuffer visivel. Gates finais verdes: `check:tree`, `lint`, `tsc`, `npm test` **315/315**, `cargo clippy`, `cargo test --lib` **344/16 ignored**, preflight SGDK/E2E, `build:debug` e QA RC A-G. Superficie segue **Experimental**, sem scraping de wikis e sem claim de compatibilidade total de todos os dialetos.

**Atualizacao ativa anterior:** em `2026-05-18 (rodada 46)`, a branch `codex/product-compatibility-wave` iniciou hardening real de importadores sem mexer no core SGDK/Node/BLAZE. A base `main` estava limpa/alinhada em `a0fe109` e `npm run release:readiness:promotion` passou com `Pronto para promocao: SIM` antes da feature. O perfil `gamemaker` passou de Parcial/nao importavel para **Experimental/importavel** com adapter GMX/GMZ/GMEZ em `src-tauri/src/core/project_mgr.rs`: extrai pacotes 7z via `sevenz-rust2` ja existente, detecta layouts `sprites/objects/rooms` e `Assets/Sprites/Objects/Rooms`, importa rooms/instances/sprites/objetos, cria entidades editaveis/camera por view e preserva GML como bridge semantica visivel (`logic_hints`, `graph_origin=gamemaker_gmx`, `imported_semantics.source=gamemaker_gmx`). Cobertura focada passou: teste unitario de GMX, matriz de perfis e teste host-local ignorado contra `F:\Projects\Game Maker\Basic_platform_game_example.gmez` e `F:\Projects\Godot\Super Bowsette Source Code Beta 0.1\src`. Isto nao declara conversao GameMaker nativa completa, nao cobre `.yyp/.yy` modernos e nao prova ainda SGDK C/ROM/emulacao para GameMaker.

**Atualizacao ativa anterior:** em `2026-05-18 (rodada 45)`, o PR #5 (`https://github.com/Misael-art/RetroDevStudio/pull/5`, branch `codex/sgdk-stable-node-engine-blaze`) foi integrado em `main` por merge commit `a31357072c93431ce441ff51a88a51004365ca88`, contendo o head `7768f4bcc3c2109eac4ec2531bd8078a8dfeba81`. Apos rerun do `Desktop E2E` remoto, os checks `CI`, `Desktop E2E` e `CodeRabbit` ficaram verdes; o `main` local foi atualizado por fast-forward e `npm run release:readiness:promotion` passou com `Pronto para promocao: SIM`. Em seguida foi aberta a branch `codex/product-professionalization-wave` para avancar UX/CX sem regressao. Primeira fatia implementada: registro central de atalhos (`src/core/shortcuts.ts`) com agrupamento, normalizacao, deteccao de conflitos e matching de eventos; o menu/topbar agora mostra atalhos em tooltips/labels, `Ctrl+/` abre o mapa central e `Ctrl+Alt+F/S/R` aciona foco/layout salvo/restaurado. Cobertura: `src/core/shortcuts.test.ts`, `App.test.tsx` para menu/atalho central, `npm run check:tree`, `git diff --check`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**307/307**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` e `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**336 passed / 15 ignored**) verdes. Isto nao promove novas superficies: command palette, editor de shortcuts, ArtStudio, importadores, SNES parity e debug/profiling avancado seguem pendentes/Experimentais ate prova dedicada.

**Atualizacao ativa anterior:** em `2026-05-17 (rodada 44)`, a branch `codex/sgdk-stable-node-engine-blaze` endureceu a prova Stable com framebuffer visivel obrigatorio (`non_black_pixels > 0`) via `corpus_libretro_visible_smoke`. A causa das ROMs pretas em **Mega Drive Breakout** e **Procedural Animation** foi `XGM_startPlay` bloqueando saida visivel no Libretro; a correcao compila com `-DRDS_CORPUS_VISIBLE_SMOKE` (`RDS_EXTRA_FLAGS` -> `EXTRA_FLAGS` do SGDK) e suprime BGM nesse modo, injetando paleta/texto deterministico em `sgdk_emitter.rs`. O runner `sgdk_corpus_real_build_rom_emulation_report --ignored` fechou **122/122** com **68** build/ROM/emulacao visivel (`emulation_visible_ok=68`), **54** bridge formal, **0** falhas, `stable_candidate=true`, `fake_toolchain_used=false` (report em `src-tauri/target-test/validation/sgdk-corpus-real-build/`). Regressoes: `sgdk_corpus_regression_mega_drive_breakout_visible_framebuffer`, `sgdk_corpus_regression_procedural_animation_visible_framebuffer`. No-code real e BLAZE compat real permanecem verdes; barra local incluiu QA RC `qa-rc-2026-05-18T02-34-48-725Z-*`. SGDK Stable local: **SIM**; Node Engine Stable local: **SIM**; `support_status` publico permanece sem promocao automatica nesta fatia.

**Atualizacao ativa anterior:** em `2026-05-13 (rodada 41)`, o PR #4 (`https://github.com/Misael-art/RetroDevStudio/pull/4`) foi confirmado como mergeado em `main` por merge commit `91bb8eb354389e370bb59d6a5ae84c21b4a1429f`, contendo o head `d21939ce83f360072a64637170922c78e2dd149d` da branch `codex/sgdk-nocode-production-ui`. Os checks remotos de `pull_request` estavam verdes no SHA do PR: `CI` run `25788180025` e `Desktop E2E` run `25788180007`; havia um run separado de `Desktop E2E` no evento `push` com falha no mesmo SHA, mas ele nao era o gate de PR usado para merge. `main` local foi atualizado por fast-forward, `git merge-base --is-ancestor d21939ce83f360072a64637170922c78e2dd149d HEAD` confirmou o head do PR em `main`, e `npm run release:readiness:promotion` passou em `main` com `Pronto para promocao: SIM`, divergencia `+0 / -0`, commit `91bb8eb354389e370bb59d6a5ae84c21b4a1429f`. O readiness reexecutou `check:tree`, `lint`, `tsc --noEmit`, `npm test` **301/301**, `cargo clippy`, `cargo test --lib`, `build:debug`, `validate-upstream-windows.ps1 -SkipRustTests` e desktop E2E simples; consumiu QA RC A-F de `qa-rc-2026-05-13T01-31-23-216Z-*`. UI/CX production hardening esta integrado em `main`, mas SGDK Stable: **NAO**; Node Engine Stable: **NAO**. Ainda faltam AST C completo, round-trip/build/emulacao dos 122 projetos, reducao governada dos gaps do corpus e ROM/emulacao institucional de jogo 100% no-code. `BLAZE_ENGINE` permanece blocker/stress corpus legitimo.

**Atualizacao ativa anterior:** em `2026-05-13 (rodada 40)`, a branch `codex/sgdk-nocode-production-ui` foi estabilizada para fechamento: o shell manteve topbar compacta com badge/popover de warnings, status bar inferior, viewport com toggles pequenos para camera/bounds/labels/staging/warnings/key color, Hierarchy com badges compactos e Inspector com campos editaveis antes do diagnostico importado colapsado. A transparencia de magenta agora usa flood fill a partir da borda, tornando transparente somente a cor-chave conectada ao fundo e preservando magenta legitimo isolado no interior do sprite. O `NodeGraphEditor` declara o vocabulario no-code obrigatorio (`input_*`, movimento, spawn/destroy, animacao, camera, timer, variaveis, flow, FSM, audio, tilemap, hardware budget e bridge) e expoe `autoLayoutNodeGraph`; o compilador experimental `src/core/nodegraph/nodeCompiler.ts` prova C deterministico para um jogo Mega Drive 100% por nodes em teste unitario. No backend, `src-tauri/src/core/sgdk_corpus_inventory.rs` emite semantic gaps acionaveis (`impact`, `severity`, `suggestion`, flags de bloqueio no-code/build/round-trip) e `node_candidates` por projeto. O corpus real `F:\Projects\MegaDrive_DEV\SGDK_Engines` continuou com **122 projetos** e gaps agregados inalterados (`preprocessor_condition=1471`, `function_like_macro=484`, `unsupported_resource_kind=236`, `assembly_source=150`, `multiline_macro=90`, `inline_assembly=47`, `lossy_source_encoding=33`), mas o report regenerado registra **32.251 candidatos de nodes** em **100 projetos**. Gates locais frescos desta estabilizacao: `npm run check:tree` OK, `npm run lint` OK, `npx tsc --noEmit` OK, `npm test` **301/301**, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` OK, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` **333 passed / 11 ignored**, `cargo test sgdk_corpus_inventory` **4 passed / 1 ignored**, `cargo test sgdk_corpus_inventory_real_corpus_report --ignored` OK, `cargo test sgdk_matrix_corpus_ --ignored` **7/7**, `npm run preflight:sgdk-e2e` OK, `validate-upstream-windows.ps1 -SkipRustTests` OK, `npm run test:e2e:desktop:qa-rc` A-G OK com evidencias `qa-rc-2026-05-13T01-31-23-216Z-*`, `build:debug` OK, `build:portable` OK e `build:msi` OK. Readiness de promocao continua nao promocional fora de `main`: deve ser lida como governanca de branch/PR ate merge e rerun no destino canonico. Isto **nao** promove SGDK nem Node Engine: ainda nao ha AST C completo, round-trip/build/emulacao dos 122 projetos nem ROM de jogo no-code institucionalmente provada.

**Atualizacao ativa anterior:** em `2026-05-12 (rodada 38)`, foi criada a branch `codex/sgdk-nocode-engine-hardening` a partir de `origin/main` (`4bf4db585b0091e0a8c0460450832067bcf6c05c`). Baseline inicial passou: `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**292**), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` e `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` (**329 passed / 10 ignored**). Foi adicionado `src-tauri/src/core/sgdk_corpus_inventory.rs` com scanner estrutural SGDK (C-lite/RES/assets/source mapping/semantic gaps) e comandos IPC `inspect_sgdk_project_inventory` / `inspect_sgdk_corpus_inventory`. O teste ignorado `sgdk_corpus_inventory_real_corpus_report` catalogou o corpus real `F:\Projects\MegaDrive_DEV\SGDK_Engines` com **122 projetos** e gerou `src-tauri/target-test/validation/sgdk-corpus-inventory.json` (**20,817,228 bytes**) contendo resumo e `project_details` por projeto. Gaps agregados: `preprocessor_condition=1471`, `function_like_macro=484`, `unsupported_resource_kind=236`, `assembly_source=150`, `multiline_macro=90`, `inline_assembly=47`, `lossy_source_encoding=33`. A verificacao local pos-implementacao passou `check:tree`, `lint`, `tsc --noEmit`, `npm test` (**292/292**), `cargo clippy`, `cargo test --lib` (**332 passed / 11 ignored**), o filtro `sgdk_corpus_inventory`, o corpus real ignorado, `sgdk_matrix_corpus_ --ignored` (**7/7**), `preflight:sgdk-e2e`, `test:e2e:desktop:qa-rc` A-G, `build:debug`, `build:portable`, `build:msi` e `validate-upstream-windows.ps1 -SkipRustTests`. Apos o commit tecnico `37a0c52`, `npm run release:readiness:promotion` reexecutou baseline, build debug, upstream e desktop E2E verdes, mas retornou `Pronto para promocao: NAO` porque a branch estava 1 commit a frente de `origin/main`; isso e bloqueio de governanca pre-merge/main, nao evidencia de Stable. Isto **nao** promove SGDK nem Node Engine: SGDK segue **Experimental**, Node/Phase D segue **Experimental/Parcial**, e o inventario ampliado mostra trabalho real restante antes de AST/round-trip/no-code Stable.

**Atualizacao ativa anterior:** em `2026-05-11 (rodada 37)`, o PR #3 (`https://github.com/Misael-art/RetroDevStudio/pull/3`) foi confirmado com `CI` e `Desktop E2E` remotos verdes no SHA `d2fec08eba2ec68d31714439bd92e8637d423114` (runs `25704763249`, `25704763247`), `draft=false`, `mergeable=true`, e foi mergeado em `main` por merge commit `76ccd7d978ea741771478d89053818285213d32e`. `main` local foi atualizado por fast-forward e `npm run release:readiness:promotion` passou no commit `76ccd7d` com `Pronto para promocao: SIM`, divergencia `+0 / -0`, baseline local, upstream oficial e desktop E2E simples verdes. A mudanca integrada endurece Runtime Setup com retry/cache/fallback e adiciona validacao visual de NodeGraph. Isto mantem o core MVP promovivel em `main`, mas **nao** promove SGDK nem Node Engine: SGDK segue **Experimental**, Node/Phase D segue **Experimental/Parcial** sem jogo completo criado por nodes e sem AST C completo; `BLAZE_ENGINE` segue blocker/stress corpus legitimo.

**Atualizacao ativa anterior:** em `2026-05-11 (rodada 36)`, apos a promocao do PR #2, foi aberta a branch `codex/product-hardening-runtime-setup` a partir de `main` para avancar hardening implementavel sem inflar status. `src-tauri/src/tools/dependency_manager.rs` passou a usar retry/backoff para downloads/metadados oficiais, cache local de metadata de GitHub Releases em `toolchains/.cache/github-releases/`, fallback para cache quando a API falha e mensagens acionaveis para rate limit/erro remoto sem expor tokens; `.gitignore` ignora esse cache. `src/components/nodegraph/NodeGraphEditor.tsx` ganhou `validateNodeGraph` com erros para refs/portas quebradas, incompatibilidade de tipo/kind e ciclos `exec`, alem de avisos de entrada ausente/no solto e preview no painel. Cobertura nova: testes Rust do cache/rate-limit/retry e teste Vitest de validacao do grafo. Gates frescos nesta branch: `check:tree`, `lint`, `tsc --noEmit`, `npm test` (**292**), `cargo clippy`, `cargo test --lib` (**329** passed / **10** ignored), `validate-upstream-windows.ps1 -SkipRustTests` (`success=true`), `preflight:sgdk-e2e`, `test:e2e:desktop:qa-rc` A-G (`qa-rc-2026-05-11T23-49-20-465Z-*`), `sgdk_matrix_corpus_ --ignored` (**7/7**) e `build:debug`/`build:portable`/`build:msi`. Isto nao promove SGDK nem Node Engine: SGDK segue **Experimental**, Node/Phase D segue **Experimental/Parcial** sem jogo completo criado por nodes e sem AST C completo; `BLAZE_ENGINE` segue blocker/stress corpus legitimo.

**Atualizacao anterior adicional:** em `2026-05-11 (rodada 35)`, o GitHub CLI foi instalado via `winget` (`gh 2.92.0`), mas o host local nao tinha sessao `gh` nem `GH_TOKEN`/`GITHUB_TOKEN`. O conector GitHub autenticado como `Misael-art` confirmou PR #2 em `head_sha=3b2b33e15f688939f7cca038be00ab3c1b8ad0b5`, `draft=true`, checks `CI` e `Desktop E2E` de pull_request verdes (`25698765825`, `25698765818`), marcou o PR como ready e fez merge commit `35ab81ff63628ad50d4f5afff289f32013171c99` em `main`. Em `main`, `npm run release:readiness:promotion` passou com `Pronto para promocao: SIM` no mesmo commit, consumindo QA A-G fresco `qa-rc-2026-05-11T21-20-39-556Z-*`, baseline, upstream e desktop smoke. Isso fecha a governanca tecnica de promocao do core MVP em `main`; SGDK segue **Experimental**, `support_status` inalterado, Node/Phase D segue heuristica sem AST C completo, e `BLAZE_ENGINE` continua blocker/stress corpus legitimo.

**Atualizacao anterior adicional:** em `2026-05-11 (rodada 34)`, na branch `feat/sgdk-vram-residency-streaming-r14`, foi corrigido um bloqueio novo do `desktop-smoke` remoto: a consulta de release oficial do SGDK em `api.github.com` estava sem autenticacao e esbarrou em `403 rate limit exceeded`. `src-tauri/src/tools/dependency_manager.rs` agora injeta `Authorization: Bearer ...` a partir de `RDS_GITHUB_TOKEN`/`GITHUB_TOKEN` somente para `https://api.github.com/`; `.github/workflows/desktop-e2e.yml` passa `${{ github.token }}` como `RDS_GITHUB_TOKEN`. Cobertura: `github_api_get_uses_ci_token_only_for_github_api`. Gates locais pos-correcao reexecutados: `check:tree`, `lint`, `tsc --noEmit`, `npm test` (291), `cargo clippy -D warnings`, `cargo test --lib` (326 passed / 10 ignored), `validate-upstream-windows.ps1 -SkipRustTests`, `preflight:sgdk-e2e`, `sgdk_matrix_corpus_ --ignored` (7/7), `test:e2e:desktop:qa-rc` A-G (`qa-rc-2026-05-11T21-20-39-556Z-*`), `build:debug`, `build:portable` e `build:msi`. Isto nao muda status de produto: PR #2 segue como trilha de promocao; merge/main e `release:readiness:promotion` no destino continuam obrigatorios. SGDK **Experimental**; `support_status` inalterado; Fase D continua heuristica.

**Atualizacao anterior adicional:** em `2026-05-11 (rodada 33)`, na branch `feat/sgdk-vram-residency-streaming-r14`, o hotfix `7bf026b` (`fix(e2e): harden live stale and toolbar overflow`) foi commitado e pushado. Ele corrige o estado `DESATUAL.` imediato apos edicao de cena validada, ajusta o oraculo E2E para revalidacao que completa rapido e impede que widgets informativos da topbar interceptem botoes centrais no runner remoto. Passaram localmente `check:tree`, `lint`, `tsc --noEmit`, `npm test` (291), `cargo clippy -D warnings`, `cargo test --lib` (325 passed / 10 ignored), `validate-upstream-windows.ps1 -SkipRustTests`, `preflight:sgdk-e2e`, matriz desktop local 16/16, `test:e2e:desktop:qa-rc` A-G (`manual-qa-status.json` `2026-05-11T18:15:08.061Z`, evidencias `qa-rc-2026-05-11T18-14-46-427Z-*`), `sgdk_matrix_corpus_ --ignored` (7/7), `build:debug`, `build:portable` e `build:msi`. No GitHub Actions, o SHA `7bf026b` passou `CI` e `Desktop E2E` em `push` e `pull_request` (runs `25689348726`, `25689348725`, `25689350772`, `25689350771`). O PR #2 existe, mas segue `draft/open`; `gh` nao esta instalado neste host. `release:readiness:promotion` foi reexecutado em worktree limpo e falhou apenas porque a branch continua muitos commits a frente de `origin/main`; a promocao real ainda exige merge/main e rerun no destino. SGDK **Experimental**; `support_status` inalterado; Fase D continua heuristica; `BLAZE_ENGINE` segue blocker legitimo auditavel.

**Atualizacao anterior adicional (2):** em `2026-05-11 (rodada 32)`, na branch `feat/sgdk-vram-residency-streaming-r14`, o host Windows foi rechecado sem exigir novo codigo de setup: os scripts canonicos localizaram `cargo`, `tauri-driver` (`C:\Users\misae\.cargo\bin\tauri-driver.exe`), `msedgedriver` e WiX/cache existentes. Passaram `check:tree`, `lint`, `tsc --noEmit`, `npm test` (290), `cargo clippy -D warnings`, `cargo test --lib` (325 passed / 10 ignored), `release:readiness:baseline` com auxiliares, `preflight:sgdk-e2e` (`Ready: SIM`), `test:e2e:desktop:qa-rc` A-G (`qa-rc-2026-05-11T11-53-47-951Z-*`), `validate-upstream-windows.ps1 -SkipRustTests` (`success=true`), `sgdk_matrix_corpus_ --ignored` (7/7), `build:portable` e `build:msi`. `release:readiness:promotion` rodou em modo estrito e saiu com codigo 1 apenas por governanca; o snapshot pre-commit documental indicou branch +201 vs `origin/main`, e a branch continua a frente apos registrar esta rodada. SGDK **Experimental**; `support_status` inalterado; Fase D continua heuristica; `BLAZE_ENGINE` segue blocker legitimo auditavel.

**Atualizacao anterior adicional (3):** em `2026-05-10 (rodada 31)`, na branch `feat/sgdk-vram-residency-streaming-r14`, o host Windows foi preparado e a barra tecnica local voltou a ficar verde: Rust MSVC `1.95.0`, Visual Studio Build Tools/VC Tools, `cargo-clippy`, `tauri-driver v2.0.6` e WiX 3.14 cacheado em `%LOCALAPPDATA%\tauri\WixTools314`. Passaram `check:tree`, `lint`, `tsc --noEmit`, `npm test` (290), `cargo clippy -D warnings`, `cargo test --lib` (325 passed / 10 ignored), `sgdk_matrix_corpus_ --ignored` (7/7), `validate-upstream-windows.ps1 -SkipRustTests` (`success=true`), `preflight:sgdk-e2e` (`Ready: SIM`), `test:e2e:desktop:qa-rc` (A-G passed), `build:portable` e `build:msi`. O MSI foi desbloqueado apos falha ambiental de download do `wix314-binaries.zip` (`timeout: global`) via cache local verificado por SHA-256. `release:readiness:baseline` passou os gates, mas a promocao segue **NAO** por governanca: branch continua +200 vs `origin/main` e ha worktree amplo a consolidar. SGDK **Experimental**; `support_status` inalterado; Fase D continua heuristica.

**Continuacao rodada 23 (codigo, sem commit/push):** grafos Phase D encadeiam no terminal por *papel*; `tail_node` apos `scroll_bg`. Tilemap: `buildTilemapAuthoringBrush` no Inspector/Hierarchy; paleta com `resolveProjectAssetPath`. Viewport: DOADOR/STAGING/INFERIDA + moldura staging; Inspector: `Pos:`.

Em caso de conflito documental, a hierarquia continua sendo:
`docs/06_AI_MEMORY_BANK.md` -> `docs/03_ROADMAP_MVP.md` -> `docs/09_AGENT_DEV_MODE.md`.

---

### CHECKPOINT operacional (2026-05-11 - rodada 37, main)

- **Escopo da rodada:** integrar PR #3 apos CI remoto verde e rerodar readiness de promocao no destino real.
- **PR/CI remoto:** PR #3 (`https://github.com/Misael-art/RetroDevStudio/pull/3`) estava `open`, `draft=false`, `mergeable=true`, com head `d2fec08eba2ec68d31714439bd92e8637d423114`. GitHub Actions passou `CI` run `25704763249` e `Desktop E2E` run `25704763247`; o job `desktop-smoke` concluiu todos os cenarios MD/SNES, overflow/warning/healthy/error/stale com sucesso.
- **Merge/main:** PR #3 foi mergeado por merge commit `76ccd7d978ea741771478d89053818285213d32e`; `git checkout main` + `git pull --ff-only origin main` atualizou o destino local por fast-forward.
- **Readiness em main:** `npm run release:readiness:promotion` saiu com codigo 0 e `Pronto para promocao: SIM` em `main`, commit `76ccd7d978ea741771478d89053818285213d32e`, divergencia `+0 / -0`. O report foi atualizado em `src-tauri/target-test/validation/release-readiness.json`/`.md`.
- **Gates consumidos pelo readiness:** `check:tree`, `lint`, `tsc --noEmit`, `npm test` (**292**), `cargo clippy`, `cargo test --lib`, `build:debug`, `validate-upstream-windows.ps1 -SkipRustTests` (`success=true`) e desktop E2E simples. QA A-G consumido do report fresco `manual-qa-status.json` de `2026-05-11T23:49:43.761Z`.
- **Status honesto:** core MVP continua tecnicamente promovivel em `main`. SGDK permanece **Experimental**, Node Engine permanece **Experimental/Parcial**, nao ha AST C completo nem jogo completo por nodes validado; `BLAZE_ENGINE` continua blocker/stress corpus legitimo.

### CHECKPOINT operacional (2026-05-11 - rodada 36, branch `codex/product-hardening-runtime-setup`)

- **Escopo da rodada:** avancar hardening de produto e NodeGraph apos a promocao de PR #2, em branch nova baseada em `main`, sem promover superficies experimentais.
- **Runtime Setup/rede:** `dependency_manager.rs` agora centraliza requests oficiais em `send_request_with_retry` (3 tentativas, backoff curto, status transientes), usa cache local de metadata de GitHub Releases em `toolchains/.cache/github-releases/` e cai para esse cache quando a API falha. Mensagens de rate limit/erro remoto orientam configurar `RDS_GITHUB_TOKEN`/`GITHUB_TOKEN` ou tentar novamente depois, sem registrar valor de token. `.gitignore` passou a ignorar `toolchains/.cache/`.
- **NodeGraph:** `NodeGraphEditor.tsx` exporta `validateNodeGraph`, detectando referencias de node/porta quebradas, incompatibilidade entre portas `exec`/`data`, mismatch de `dataType`, ciclos `exec`, entrada ausente e nos soltos. O painel mostra contagem erro/aviso e preview das primeiras ocorrencias. Isto e base real de validacao, mas ainda nao fecha Phase D.
- **Cobertura focada:** `cargo test --manifest-path src-tauri\Cargo.toml dependency_manager -- --nocapture --test-threads=1` OK (**8** testes); `npx vitest run src/components/nodegraph/NodeGraphEditor.test.tsx` OK (**16** testes); `npx tsc --noEmit` OK.
- **Baseline completo:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**292** testes); `cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings` OK; `cargo test --manifest-path src-tauri\Cargo.toml --lib -- --nocapture --test-threads=1` OK (**329** passed / **10** ignored).
- **Fluxo real/toolchains/corpus:** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-upstream-windows.ps1 -SkipRustTests` OK (`upstream-validation.json success=true`, `2026-05-11T20:47:15-03:00`); `npm run preflight:sgdk-e2e` OK (`Ready: SIM`); `npm run test:e2e:desktop:qa-rc` OK A-G (`manual-qa-status.json` `2026-05-11T23:49:43.761Z`, evidencias `qa-rc-2026-05-11T23-49-20-465Z-*`); `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri\Cargo.toml --lib -- --ignored --nocapture --test-threads=1` OK (**7/7**), mantendo `BLAZE_ENGINE` como blocker/stress corpus legitimo.
- **Packaging:** `npm run build:debug`, `npm run build:portable` e `npm run build:msi` OK. Artefatos verificados: Debug EXE 36,087,808 bytes (`2026-05-11 20:53:36`), Portable EXE 20,592,640 bytes (`2026-05-11 21:01:20`) e MSI 7,331,840 bytes (`2026-05-11 21:01:05`).
- **Status honesto:** core MVP continua promovido tecnicamente em `main` pela rodada 35. Esta branch melhora robustez e validacao, mas **nao** torna SGDK Stable, **nao** torna Node Engine Stable e **nao** resolve AST C/round-trip completo para SGDK_Engines. A proxima promocao exige PR desta branch, CI remoto verde e readiness se/apos merge em `main`.

### CHECKPOINT operacional (2026-05-11 - rodada 35, main)

- **Escopo da rodada:** remover bloqueio de governanca do PR #2, promover a branch candidata para `main` e executar readiness no destino real de promocao.
- **GitHub/gh:** `gh` nao existia no host; `winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements` instalou GitHub CLI `2.92.0` em `C:\Program Files\GitHub CLI\gh.exe`. `gh auth status` confirmou ausencia de login local e nao havia `GH_TOKEN`/`GITHUB_TOKEN`; o conector GitHub da sessao estava autenticado como `Misael-art` e foi usado para as operacoes governadas.
- **PR/merge:** PR #2 (`https://github.com/Misael-art/RetroDevStudio/pull/2`) foi confirmado em `head_sha=3b2b33e15f688939f7cca038be00ab3c1b8ad0b5`, `draft=true`, `mergeable=true`; checks pull_request `CI` (`25698765825`) e `Desktop E2E` (`25698765818`) estavam verdes. O PR foi marcado como ready e mergeado por merge commit `35ab81ff63628ad50d4f5afff289f32013171c99`.
- **Main:** `git checkout main` + `git pull --ff-only origin main` deixou `main` em `35ab81ff63628ad50d4f5afff289f32013171c99`; `git merge-base --is-ancestor 3b2b33e15f688939f7cca038be00ab3c1b8ad0b5 HEAD` confirmou o SHA do PR dentro de `main`.
- **Readiness em main:** `npm run release:readiness:promotion` saiu com codigo 0 e `Pronto para promocao: SIM` em `src-tauri/target-test/validation/release-readiness.md`, commit `35ab81ff63628ad50d4f5afff289f32013171c99`, branch `main`, divergencia `+0 / -0`. Gates consumidos: `check:tree`, `lint`, `tsc --noEmit`, `npm test` (**291**), `cargo clippy`, `cargo test --lib` (**326** passed / **10** ignored), `build:debug`, `validate-upstream-windows`, `desktop-e2e` e QA A-G fresco `qa-rc-2026-05-11T21-20-39-556Z-*`.
- **Status honesto:** core MVP esta promovivel em `main` pela barra tecnica atual; nao houve promocao de SGDK para Stable, Node Engine para Stable, nem fechamento de Phase D/AST. `BLAZE_ENGINE` continua blocker/stress corpus legitimo; superficies ArtStudio/RetroFX/Reverse/Asset Extractor/Memory/VRAM seguem experimentais salvo prova dedicada.

### CHECKPOINT operacional (2026-05-11 - rodada 34, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Escopo da rodada:** resolver falha de CI causada por rate limit da GitHub API durante instalacao automatica do SGDK no desktop smoke remoto, sem criar dependencia nova e sem relaxar teste.
- **Causa raiz:** `dependency_manager.rs` consultava GitHub Releases via `api.github.com` sem token; apos varias execucoes remotas no mesmo dia, o runner recebeu `403 rate limit exceeded` antes de baixar o asset SGDK.
- **Correcao:** helper `github_api_get` adiciona `Authorization: Bearer <token>` somente para URLs `https://api.github.com/`, lendo `RDS_GITHUB_TOKEN` primeiro e `GITHUB_TOKEN` como fallback. O workflow `desktop-e2e.yml` injeta `${{ github.token }}` como `RDS_GITHUB_TOKEN` no job.
- **Cobertura:** teste Rust `github_api_get_uses_ci_token_only_for_github_api` garante token no GitHub API e ausencia de token em API externa.
- **Gates locais:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**291**); `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` OK; `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` OK (**326** passed / **10** ignored).
- **Fluxo real/artefatos:** `validate-upstream-windows.ps1 -SkipRustTests` OK (`upstream-validation.json` `success=true`, `2026-05-11T18:14:21-03:00`); `preflight:sgdk-e2e` OK; `sgdk_matrix_corpus_ ... --ignored` OK (**7/7**); `test:e2e:desktop:qa-rc` OK A-G com evidencias `qa-rc-2026-05-11T21-20-39-556Z-*`; `build:debug`, `build:portable` e `build:msi` OK. Artefatos verificados: Debug EXE 36,062,208 bytes (`2026-05-11 18:23:36`), Portable EXE 20,574,208 bytes (`2026-05-11 18:34:08`) e MSI 7,323,648 bytes (`2026-05-11 18:33:52`).
- **Status honesto:** a correcao endurece CI/setup e nao promove produto. PR #2 ainda precisa de checks remotos verdes no SHA corrente, merge para `main` e `release:readiness:promotion` no destino. SGDK segue **Experimental**; Phase D segue heuristica.

### CHECKPOINT operacional (2026-05-11 - rodada 33, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Escopo da rodada:** corrigir falhas reais do `Desktop E2E` remoto no PR, consolidar branch pushada, verificar CI remoto e registrar o bloqueio externo restante sem claim de promocao.
- **Git/governanca:** commit `7bf026b` (`fix(e2e): harden live stale and toolbar overflow`) pushado para `origin/feat/sgdk-vram-residency-streaming-r14`; PR #2 (`https://github.com/Misael-art/RetroDevStudio/pull/2`) permanece `draft/open`. `gh --version` falha porque `gh` nao esta instalado; a verificacao remota foi feita pela API publica do GitHub. Sem autorizacao/autenticacao para merge, a entrega fica como PR pronto para promocao, nao MVP fechado.
- **Correcoes de codigo:** `editorStore` marca validacao live como `stale` no momento da mudanca de cena ja validada; runner desktop aceita transicao rapida de revalidacao para `LIVE`; topbar/metrics deixam de interceptar clique no Build/Run em largura de runner remoto.
- **Baseline local:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**291** testes); `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` OK; `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` OK (**325** passed / **10** ignored).
- **Fluxo real/QA/corpus:** `validate-upstream-windows.ps1 -SkipRustTests` OK; `npm run preflight:sgdk-e2e` OK (`Ready: SIM`); matriz desktop local 16/16 OK; `npm run test:e2e:desktop:qa-rc` OK, `manual-qa-status.json` `2026-05-11T18:15:08.061Z`, blocos A-G `passed`; `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1` OK (**7/7**).
- **Packaging:** `npm run build:debug`, `npm run build:portable` e `npm run build:msi` OK. Artefatos canonicos existentes: `src-tauri/target-test/debug/retro-dev-studio.exe` (timestamp local `2026-05-11 15:50:56`), `src-tauri/target-test/release/retro-dev-studio.exe` (`2026-05-11 15:27:21`) e `src-tauri/target-test/release/bundle/msi/RetroDev Studio_0.1.0_x64_en-US.msi` (`2026-05-11 15:27:05`).
- **CI remoto:** SHA `7bf026b` verde no GitHub Actions: `CI` push `25689348726`, `Desktop E2E` push `25689348725`, `CI` pull_request `25689350772`, `Desktop E2E` pull_request `25689350771`. O blocker anterior do PR (`25670163191`, `smoke_snes` + `live_stale_*`) foi resolvido.
- **Readiness estrito:** `npm run release:readiness:promotion` reexecutado em worktree limpo apos push; baseline, upstream, desktop smoke, QA consumido e artefatos passaram; resultado final `Pronto para promocao: NAO` apenas por governanca (branch muitos commits a frente de `origin/main`). Rerun em `main` ainda e obrigatorio apos merge.
- **Status honesto:** SGDK permanece **Experimental**; `support_status` inalterado; Phase D continua heuristica, sem AST C completo; nao criar tag/release antes de merge e readiness verde no destino.

### CHECKPOINT operacional (2026-05-11 - rodada 32, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Escopo da rodada:** preparar/confirmar o host para execucao local completa, rerodar os gates de hardening e registrar o bloqueio real sem inflar escopo.
- **Git/governanca:** worktree versionavel limpo antes das atualizacoes documentais; branch rastreia `origin/feat/sgdk-vram-residency-streaming-r14`; o snapshot pre-commit documental era `origin/main...HEAD = 0/201`, e cada commit documental posterior aumenta a contagem sem alterar a natureza do bloqueio. `Rascunho.txt` existe na raiz, mas esta ignorado em `.git/info/exclude` e nao deve ser versionado sem curadoria.
- **Baseline local:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**290** testes); `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` OK; `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --nocapture --test-threads=1` OK (**325** passed / **10** ignored).
- **Readiness/QA:** `npm run release:readiness` inicial mostrou fotografia **NAO** por baseline/QA nao consumidos nesta rodada e governanca; `npm run release:readiness:baseline` executou baseline + auxiliares com gates tecnicos verdes; `npm run preflight:sgdk-e2e` OK (`Ready: SIM`); `npm run test:e2e:desktop:qa-rc` OK com `manual-qa-status.json` `2026-05-11T11:54:18.251Z`, blocos A-G `passed` e evidencias `qa-rc-2026-05-11T11-53-47-951Z-*`.
- **Toolchains/corpus:** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-upstream-windows.ps1 -SkipRustTests` OK (`upstream-validation.json success=true`); `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1` OK (**7/7**). `BLAZE_ENGINE` continua blocker legitimo auditavel, sem assert de ROM.
- **Packaging:** `npm run build:portable` gerou `src-tauri/target-test/release/retro-dev-studio.exe`; `npm run build:msi` gerou `src-tauri/target-test/release/bundle/msi/RetroDev Studio_0.1.0_x64_en-US.msi`; `release:readiness:promotion` tambem regenerou o EXE debug canonico.
- **Readiness estrito:** `npm run release:readiness:promotion` rodou baseline, upstream e Desktop E2E simples, consumiu `manual-qa-status.json` fresco e saiu com codigo 1 por um unico bloqueio de governanca contra `origin/main` (201 commits a frente no snapshot pre-commit documental).
- **Status honesto:** nao declarar fechamento do MVP nesta revisao. A retomada exata e consolidar/mesclar a branch candidata ou manter o PR como trilha de governanca, rerodar `npm run release:readiness:promotion` no destino de promocao e sincronizar README/onboarding se o merge mudar a leitura publica. SGDK permanece **Experimental**; `support_status` inalterado; Phase D continua heuristica, sem AST C completo.

### CHECKPOINT operacional (2026-05-10 - rodada 31, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Escopo da rodada:** preparar host Windows e fechar a barra tecnica local sem inflar escopo nem promover superficies experimentais.
- **Host/toolchain:** `scripts\setup-rust.ps1` instalou Rust MSVC `1.95.0`; Visual Studio Build Tools 2022/VC Tools foi instalado via `winget`; `scripts\run-cargo-msvc.cmd --version` passou; `rustup component add clippy` instalou `cargo-clippy`; `cargo install tauri-driver --locked` instalou `tauri-driver v2.0.6`; WiX 3.14 foi cacheado em `%LOCALAPPDATA%\tauri\WixTools314` com SHA-256 `6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31`.
- **Correcoes de codigo desta rodada:** Clippy novo exigiu `sort_by_key` em tres ordenacoes (`ast_generator.rs` e `project_mgr.rs`); foi aplicado o menor diff sem alterar comportamento.
- **Baseline verde:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**290** testes); `scripts\run-cargo-msvc.cmd clippy --manifest-path .\src-tauri\Cargo.toml -- -D warnings` OK; `scripts\run-cargo-msvc.cmd test --manifest-path .\src-tauri\Cargo.toml --lib -- --nocapture --test-threads=1` OK (**325** passed / **10** ignored).
- **Corpus/official toolchains/desktop:** `scripts\run-cargo-msvc.cmd test sgdk_matrix_corpus_ --manifest-path .\src-tauri\Cargo.toml --lib -- --ignored --nocapture --test-threads=1` OK (**7/7**; BLAZE segue blocker legitimo auditavel); `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-upstream-windows.ps1 -SkipRustTests` OK (`upstream-validation.json success=true`); `npm run preflight:sgdk-e2e` OK (`Ready: SIM`); `npm run test:e2e:desktop:qa-rc` OK com `manual-qa-status.json` `2026-05-10T19:51:16.583Z`, blocos A-G `passed` e evidencias `qa-rc-2026-05-10T19-50-53-457Z-*`.
- **Packaging:** `npm run build:portable` gerou `src-tauri/target-test/release/retro-dev-studio.exe`; `npm run build:msi` gerou `src-tauri/target-test/release/bundle/msi/RetroDev Studio_0.1.0_x64_en-US.msi`. Primeira tentativa de MSI falhou por ambiente (`tauri-bundler` timeout ao baixar `wix314-binaries.zip` do GitHub); a retomada foi cachear WiX 3.14 localmente e rerodar o comando canonico.
- **Readiness:** `npm run release:readiness:baseline` executou baseline + auxiliares com gates tecnicos verdes. A promocao publica continua bloqueada por governanca: branch sem upstream proprio e +200 commits vs `origin/main`, alem de worktree amplo ainda nao consolidado antes do commit/PR. `release:readiness` simples sem `--manual-qa-json` ainda mostra A-F pendente por nao consumir o report de QA; a trilha de promocao usa o JSON explicitamente.
- **Status honesto:** SGDK permanece **Experimental**; `support_status` inalterado; Phase D continua heuristica, sem AST C completo; ArtStudio/RetroFX/Reverse/Asset Extractor/Memory/VRAM continuam experimentais salvo prova dedicada futura. `Rascunho.txt` e rascunho operacional solto na raiz; nao versionar sem curadoria.

### CHECKPOINT operacional (2026-05-10 - rodada 30, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Escopo da rodada:** inspeccao real de estado, baseline local possivel, readiness e saneamento de falso positivo em scripts de QA; sem promocao de produto.
- **Git/governanca:** branch sem upstream proprio, `HEAD` em `7467046`, `origin/main...HEAD = 0/200`; worktree amplo e sujo com mudancas em docs, scripts, frontend, backend Rust e testes. `Rascunho.txt` existe na raiz como rascunho operacional nao canonico e nao deve ser versionado sem curadoria.
- **Baseline frontend:** `npm run check:tree` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` OK (**290** testes).
- **Bloqueio Rust/MSVC:** `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` nao executou porque `cargo` nao esta no PATH; `scripts\run-cargo-msvc.cmd clippy ...` e `scripts\run-cargo-msvc.cmd test ...` falharam por `vswhere.exe not found at "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"`. Retomada: instalar/provisionar Rust + Visual Studio Build Tools/Installer com VC tools, confirmar `vswhere.exe` e rerodar clippy/test pelos comandos canonicos.
- **Desktop QA:** `npm run preflight:sgdk-e2e` falhou com `tauri-driver: FALTA`; `toolchains/sgdk` OK e `toolchains/webdriver/msedgedriver.exe` OK. `scripts\diagnose-desktop-e2e.ps1` agora executa sem crash e confirma `tauri-driver` ausente. Retomada: provisionar `tauri-driver` via cargo em host com Rust e rerodar preflight + `npm run test:e2e:desktop:qa-rc`.
- **Upstream oficial:** `scripts\validate-upstream-windows.ps1 -SkipRustTests` foi corrigido para propagar exit code real do wrapper `.cmd` mesmo com stdout/stderr capturados. Report fresco: `success=false`, `blocking_status_codes=["toolchain_missing"]`, fase `upstream_smoke` falhou por ausencia de `vswhere`/MSVC. Isso substitui o falso positivo anterior desta mesma rodada.
- **Readiness:** `npm run release:readiness` gerou `Pronto para promocao: NAO`; bloqueadores: baseline institucional nao executada pelo agregador, worktree sujo, branch +200 vs `origin/main`, portable/release EXE ausente, MSI ausente e QA A-F pendente na fotografia atual.
- **Status honesto:** SGDK permanece **Experimental**; `support_status` inalterado; `qa-rc` de `2026-05-02` continua evidencia historica, mas nao e fotografia fresca de `2026-05-10`.

### CHECKPOINT operacional (2026-05-02 — rodada 29, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Baseline real antes da edicao:** o `qa-rc` A-G ja passava, mas a experiencia de criador ainda era dispersa: viewport informativo porem pesado em banners, tilemap com estado visivel mas acoes afastadas do alvo, selecao densa dependente de lista/spotlight sem solo persistente, e Logic/Art ainda pareciam continuacoes fracas do objeto selecionado.
- **Viewport / composicao:** `ViewportPanel` passou a montar um contexto de autoria (`creatorWorkflow`) com labels de mundo, janela MD 320x224, camera, regiao editavel, entidade selecionada, fontes e tilemap ativo. A mesa de composicao no stage ganhou foco de entidade, centralizacao e **Solo** para reduzir caos em cenas grandes.
- **Selecao densa:** o picker por Shift+clique agora tem acao `Selecionar + foco` e **Isolar alvo**, com solo visual persistente no canvas ate o usuario desligar. Alt+clique/teclado/filtros/spotlight da rodada anterior continuam.
- **Tilemap central:** a faixa de pintura no viewport mostra alvo/brush/tool e ganhou acoes `Focar alvo` e `Voltar select`, evitando que o usuario precise lembrar em qual painel a paleta/estado esta.
- **Objeto -> Logic -> fonte / Art:** Inspector e Logic ganharam pontes por `data-testid`/UI real para objeto -> Logic, Logic -> Scene, source paths multiplos/fallback honesto e objeto -> Art. Art mostra `artstudio-scene-context-bridge` para retornar a Cena sem reset mental.
- **Provas reais no app:** `qa-rc-2026-05-02T05-14-22-572Z-*` cobre composicao de cena, pilha densa com picker/solo, tilemap grande em paint, objeto -> Logic -> fonte, Art -> Scene com contexto e fluxo continuo salvar/reabrir/build/ROM `SEGA`.
- **Ainda heuristico / Experimental:** Fase D continua sem AST C completo; `entity_role`, `confidence`, `role_reason`, `driver_functions` e quick actions sao assistivos/heuristicos. `BLAZE_ENGINE` permanece blocker legitimo auditavel; SGDK **Experimental**; `support_status` inalterado.
- **Gates:** `check:tree` OK; `lint` OK; `tsc --noEmit` OK; `npm test` **288** passed; `cargo clippy -D warnings` OK; `cargo test --lib --test-threads=1` **325** passed / **10** ignored; `cargo test sgdk_matrix_corpus_ --ignored` **7** passed; `validate-upstream-windows -SkipRustTests` **exit 0**; `preflight:sgdk-e2e` **Ready: SIM**; `qa-rc` **A-G OK** (`qa-rc-2026-05-02T05-14-22-572Z-*`).
- **Governanca:** sem commit/push.

### CHECKPOINT operacional (2026-04-30 — rodada 28, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Cena densa (B):** picker com filtros (`all/sprite/tilemap/camera/imported`) + `Spotlight` de isolamento visual no viewport durante preview.
- **UX (G):** contagem `filtradas/total` e estado vazio orientado por filtro, reduzindo tentativa-e-erro.
- **Ainda heuristico / Experimental:** inferencia de papel continua heuristica; spotlight/filtro melhoram usabilidade, nao elevam status de AST/importador; SGDK **Experimental**.
- **Gates:** `check:tree`, `lint`, `tsc`, `npm test` (**277**), `cargo clippy -D warnings`, `cargo test --lib` (**325**/10 ignored), `cargo test sgdk_matrix_corpus_ --ignored` (**7**), `validate-upstream-windows -SkipRustTests` (**0**), `preflight:sgdk-e2e`, `qa-rc` (**A-G**, `qa-rc-2026-04-30T09-26-03-255Z-*`).
- **Governanca:** sem commit/push.

### CHECKPOINT operacional (2026-04-30 — rodada 27, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Cena densa (B):** picker `viewport-dense-stack-picker` com navegacao de teclado (`↑/↓/Enter/Esc`) e pre-selecao visual por hover/focus no viewport.
- **Art (F):** `ArtStudioPanel` reentra em `Scene` com contexto preservado; se a entidade for tilemap, ativa `paint` com brush canonico sem perder foco.
- **Prova:** regressao frontend `ArtStudioPanel.test.ts` cobrindo retorno contextual.
- **Ainda heuristico / Experimental:** Fase D continua sem AST completo; picker e quick actions sao assistivos (nao inferencia forte); SGDK **Experimental**.
- **Gates:** `check:tree`, `lint`, `tsc`, `npm test` (**277**), `cargo clippy -D warnings`, `cargo test --lib` (**325**/10 ignored), `cargo test sgdk_matrix_corpus_ --ignored` (**7**), `validate-upstream-windows -SkipRustTests` (**0**), `preflight:sgdk-e2e`, `qa-rc` (**A-G**, `qa-rc-2026-04-30T08-32-55-700Z-*`).
- **Governanca:** sem commit/push.

### CHECKPOINT operacional (2026-04-30 — rodada 26, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Viewport / cena densa / tilemap (A/B/C):** **Shift+clique** com pilha >1 abre picker denso; **Alt+clique** mantem ciclo; faixa tilemap embute **`TilePalette`**; hints toolbar **Shift=lista · Alt=ciclo**; logs duplo-clique / Inspector alinhados a paleta no stage.
- **Logic (E):** `appendExecChainEdgesFromLayout` + botao **Encadear exec (layout)**; quick actions **projectile_motion**, **camera_rig**, **fighter_combat**, **support_state_tick**, **hud_vblank_tick**; empty state ordenado por `entity_role` (mapa fixo; heuristica).
- **Inspector (D):** botoes **Abrir fonte (n)** por caminho unico (`source_paths` ∪ `external_source_refs`).
- **Ainda heuristico / Experimental:** Fase D sem AST completo; encadeamento layout e quick actions sao **atalhos de autor** a revisar por jogo; SGDK **Experimental**; corpus **BLAZE** continua blocker auditavel.
- **Gates:** `check:tree`, `lint`, `tsc`, `npm test` (**276**), `cargo clippy -D warnings`, `cargo test --lib` (**325**/10 ignored), `cargo test sgdk_matrix_corpus_ --ignored` (**7**), `validate-upstream-windows -SkipRustTests` (**0**), `preflight:sgdk-e2e`, `qa-rc` (**A-G**, `qa-rc-2026-04-30T02-28-49-421Z-*`).
- **Governanca:** sem commit/push.

### CHECKPOINT operacional (2026-04-30 — rodada 25, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Viewport / cena densa / tilemap (A/B/C):** `collectEntitiesUnderPoint` + **Alt+clique** cicla sobreposicoes sem iniciar arrasto; **duplo-clique** em tilemap ativa pintura (`buildTilemapAuthoringBrush`, `activeTilemapId`); duplo-clique em entidade com grafo abre Logic; faixa **Fluxo tilemap** (`viewport-tile-paint-flow-strip`) mostra alvo/brush/ferramenta; tooltip do overlay e do Navegador do Mundo alinhados a autoria.
- **Objeto -> logica -> fonte (D/E):** `NodeGraphEditor` — cartao inferencia + `openProjectSourcePath` para primeiro `source_paths` / `external_source_refs`; mensagens de erro explicitas se faltar editor/caminho.
- **Art (F):** `ArtStudioPanel` — `artstudio-no-sprite-context` + retorno a Cena.
- **Ainda heuristico / Experimental:** Fase D sem AST; inferencia importada; corpus **BLAZE** e cenarios com build bloqueado **improprios para autoria completa**; SGDK **Experimental**.
- **Gates:** `check:tree`, `lint`, `tsc`, `npm test` (**275**), `cargo clippy -D warnings`, `cargo test --lib` (**325**/10 ignored), `cargo test sgdk_matrix_corpus_ --ignored` (**7**), `validate-upstream-windows -SkipRustTests` (**0**), `preflight:sgdk-e2e`, `qa-rc` (**A-G**, `qa-rc-2026-04-30T01-16-50-322Z-*`).
- **Governanca:** sem commit/push.

### CHECKPOINT operacional (2026-04-30 — rodada 24, branch `feat/sgdk-vram-residency-streaming-r14`)

- **Viewport / autoria (BLOCO A):** `ViewportPanel.tsx` — cartao `viewport-world-authoring-strip` quando mundo largo ou colisao em px maior que 320x224: texto orientado a autoria, ate 3 avisos de `hwStatus.warnings` (colisao/mapa), botoes **Centro colisao**, **Modo colisao**, **Pan livre** (desliga clamp ao mundo), **Clamp on**; callback `focusCollisionMapCenter`.
- **Logic / heuristica importada (BLOCO E):** `project_mgr.rs` — papel lexical **`hud_actor`** (sinais `hud`, `score`, `health`, `lifebar`, `gauge`, `font`, `ui_`); ramo Phase D com no **`role_hud_scroll_tick`** (`scroll_tilemap`, label explicitando HUD/heuristica); prioridade de papel e faixa Y em `sprite_role_priority` / `sgdk_role_lane_base_y` atualizadas. `importedEntityContext.ts` + `HierarchyPanel.tsx` — rotulo **HUD / UI** e chip **HUD** alinhados ao resto do shell.
- **Limites honestos:** Fase D continua sem AST C completo; posicoes donor/staging/inferida e grafos seguem **heuristicos** onde nao ha prova estrutural; cenarios de corpus com build bloqueado (ex. linha BLAZE) permanecem **improprios para autoria completa** ate resolver blockers de hardware/doador.
- **Gates desta rodada (host):** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (**275** passed), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1` (**325** passed / **10** ignored, mesma continuacao de sprint), `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1` (**7** passed), `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\validate-upstream-windows.ps1 -SkipRustTests` (**exit 0**, ~171s, `processSweep.strategy=cim`), `npm run preflight:sgdk-e2e` (**Ready: SIM**), `npm run test:e2e:desktop:qa-rc` (**OK** `qa-rc-2026-04-30T00-28-55-771Z-*`, A-G).
- **Governanca:** SGDK **Experimental**; `support_status` inalterado; **sem commit/push**.

### CHECKPOINT operacional (2026-04-21 — commit consolidado)

**Git:** mensagem `fix(md): validar CollisionMap world-sized; endurecer teste matriz SGDK P2` na branch `feat/desktop-e2e-workflow` (`git log -1 --oneline`).

- **Rust / hardware:** `md_profile.rs` e `snes_profile.rs` — `CollisionMap` world-sized (scroll/plataforma) deixa de ser **fatal** por exceder viewport; mantem validacao conservadora (tile multiplo de 8, limites de grid e de bytes em `data`, integridade `len` vs `width*height`, overflow com `checked_mul`); aviso quando o mundo em pixels excede a area visivel. Testes de regressao: `collision_map_wider_than_viewport_is_non_fatal_with_warning` (MD e SNES).
- **Corpus matriz Platformer 2:** teste renomeado `sgdk_matrix_corpus_platformer_2_partial_flow_documents_build_blocker`; com `--ignored`, doador ausente **panic** salvo `RDS_SGDK_MATRIX_CORPUS_SKIP=1`; assert final exige ROM com marca `SEGA`; leitura da ROM no ramo fake usa `project.join(rom_path)`.
- **Documentacao:** `docs/SGDK_REAL_CORPUS_VALIDATION_MATRIX.md` (linha 1, comando e evidencia); `docs/06_CURRENT_WAVE_AI_BANK.md` (rodada 11+). Comentario UGDM em `CollisionMap` (`entities.rs`) alinhado a mapas maiores que viewport.
- **Gates verificados nesta entrega:** `npm run check:tree`, `npx tsc --noEmit`, `npm test`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1`, e `cargo test sgdk_matrix_corpus_platformer_2_partial_flow_documents_build_blocker ... --ignored` no host com corpus (ex.: `mode=sgdk_detect rom_sega=true`).
- **Governanca:** SGDK permanece **Experimental**; `support_status` nao promovido; matriz linha 1 **Parcial** (programa dos seis titulos incompleto).

### CHECKPOINT operacional (2026-04-22 — rodada 12)

- **Build/constraints:** `build_orch.rs` passa `project.template_metadata.source_kind` para `validate_scene_with_source_kind` (MD/SNES).
- **Regressao:** `sgdk_managed_vram_overflow_warns_but_native_still_aborts`.
- **Corpus matriz:** helper com `stamp_imported_sgdk_metadata` + assert `source_kind=imported_sgdk`.

### CHECKPOINT operacional (2026-04-23 — rodada 13)

- **Resolver SGDK:** `resolve_sgdk_import_root` + integracao em `import_sgdk_project`; testes `sgdk_resolver_*`; ambiguidade multi-candidato falha com mensagem e lista de roots.
- **Matriz corpus:** `cargo test sgdk_matrix_corpus_ ... --ignored --test-threads=1` => **6/6** no host; linha 2 `MATRIX_PE` com `resolution_kind=mddev_reference_redirect`.
- **Gates locais desta rodada:** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `cargo clippy -D warnings`, `cargo test --lib --test-threads=1`, `npm run preflight:sgdk-e2e`, `npm run test:e2e:desktop:qa-rc`.

### CHECKPOINT operacional (2026-04-23 — rodada 14)

- **MD hardware model:** `md_profile.rs` deixou de usar apenas `vram_used` agregado para SGDK importado; agora separa `asset_total`, `resident`, `streamable` e `dma/frame` com `analysis_mode=sgdk_managed`.
- **Build audit:** `build_orch.rs` emite linha `MD VRAM analysis: ...` antes da validação fatal/warn, permitindo QA entender por que passou com warning vs bloqueou.
- **Corpus real:** `sgdk_matrix_corpus_` ampliado para incluir `BLAZE_ENGINE`; suite no host: 7/7 testes passando (6 com ROM `SEGA` + 1 bloqueador esperado auditavel).
- **Gates da rodada:** `check:tree`, `lint`, `tsc --noEmit`, `npm test`, `cargo clippy -D warnings`, `cargo test --lib --test-threads=1`, `cargo test sgdk_matrix_corpus_ --ignored`, `validate-upstream-windows -SkipRustTests`, `preflight:sgdk-e2e`, `test:e2e:desktop:qa-rc`.

### CHECKPOINT operacional (2026-04-24 — rodada 15)

- **MD `HwStatus` + `md_profile`:** composicao de residencia por categoria + contadores `banks`/`cells` da heuristica `sgdk_managed`; `vram_used`/`dma_used` mantem a semantica agregada da rodada 14.
- **Build / matriz:** `MD VRAM analysis` e `MATRIX_* hw` incluem `spr_res`, `tile`, `hud`, `strm_spr`, `anim_sw`, `banks`, `cells`; regressao `sgdk_managed_vram_overflow_warns_but_native_still_aborts` asserta `spr_res=` no log; corpus BLAZE asserta `banks=` no log de build.
- **SGDK:** continua **Experimental**; sem promocao de `support_status`.

### CHECKPOINT operacional (2026-04-25 — rodada 16)

- **Frontend:** `src/core/assetInstantiation.ts` + testes; `AssetPreview.tsx` (estados de carregamento); `InspectorPanel.tsx` (texto de diagnostico do preview); `ToolsPanel.tsx` (regra de instanciação).
- **Gates nesta entrega parcial:** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, vitest focado (`assetInstantiation`, `InspectorPanel`). Suite completa / Rust / E2E nao rerodada nesta continuacao.
- **SGDK:** continua **Experimental**; sem promocao de `support_status`; sem commit automatico.

### CHECKPOINT operacional (2026-04-25 — rodada 17)

- **E2E `qa-rc`:** bloco G alargado (cena `entry_scene`, `projectSourceKind`, onboarding, `instantiateBrowserImageAsset`, reopen `entityCount`, Inspector fallback testid).
- **Viewport:** contador `tm-fallback` + onboarding condicionado a cena vazia.
- **Gates:** `npm test` 246/246; `cargo clippy -D warnings`; `cargo test --lib`; `sgdk_matrix_corpus_` ignorados 7/7; `preflight:sgdk-e2e`; `test:e2e:desktop:qa-rc` OK.
- **Limite:** `validate-upstream-windows.ps1` falhou (WMI/CIM); nao equivaler a gate verde até corrigir host ou script.
- **SGDK:** Experimental; sem commit/push.

### CHECKPOINT operacional (2026-04-25 — rodada 18)

- **Gate oficial Windows:** `scripts/validate-upstream-windows.ps1` agora isola o sweep de processos num caminho resiliente (`Get-CimInstance Win32_Process` com fallback para `Get-Process`), materializa `ExitCode` do `cargo` antes de decidir o resultado, e escreve `processSweep`, timeouts e estado do self-test em `upstream-validation.json`.
- **Cobertura do fallback:** `src/core/validateUpstreamWindows.test.ts` força falha CIM via `RDS_VALIDATE_FORCE_CIM_FAILURE=1` + `-SelfTestProcessSweep` e asserta `processSweep.strategy === "get-process"` sem esconder o fallback no report.
- **Asset visual state canonico:** `src/core/assetVisualState.ts`, `src/core/useProjectAssetVisualState.ts` e `src/components/common/AssetPreview.tsx` centralizam `idle/loading/loaded/missing/failed/legacy_fallback`; `InspectorPanel.tsx` e `ViewportPanel.tsx` passam a falar a mesma lingua para preview real, erro, ausente e tilemap legado sem `cells[]`.
- **Produto/CX SGDK importado:** `App.tsx` abre a `entry_scene` e seleciona a primeira entidade visual relevante; Inspector mostra preview/caminho/estado visual/fallback explicito; `scripts/e2e-tauri-build-run.mjs` bloco G foi atualizado para procurar os sinais novos do Inspector (`Estado visual` / preview/fallback testids).
- **Gates desta rodada:** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1`, `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\validate-upstream-windows.ps1 -SkipRustTests`, `npm run preflight:sgdk-e2e` e `npm run test:e2e:desktop:qa-rc`.
- **Governanca:** SGDK continua **Experimental**; sem mudanca de `support_status`; sem commit/push nesta sessao.

### CHECKPOINT operacional (2026-04-26 — rodada 20)

- **Produto/CX da IDE:** `importedEntityContext.ts` passou a derivar papel, classe, confianca e detalhe auditavel da entidade importada; `HierarchyPanel.tsx` mostra chips de papel importado e usa o mesmo foco de cena do `App.tsx`; `InspectorPanel.tsx` ganhou cartao de contexto importado com resumo, funcoes-chave e caminhos-fonte; `ViewportPanel.tsx` e `SceneAssetHealthBadge.tsx` passaram a exibir o mesmo vocabulario de saude visual; `AssetBrowserSelectionCard.tsx` passou a mostrar referencias de cena, papel importado e item-guia.
- **Arquitetura/frontend:** o shell agora compartilha contratos pequenos e reusaveis para foco de cena, estado visual, saude de assets e browser de assets, em vez de replicar `ifs` em `App.tsx`, `ToolsPanel.tsx`, `InspectorPanel.tsx` e `ViewportPanel.tsx`. `sceneWorkspaceContext.ts` passou a preferir entidade foco por score semantico, e `assetBrowserModel.ts` ordena referencias por foco/papel em vez de ordem acidental.
- **Fase D importada:** `src-tauri/src/ugdm/components.rs` ganhou `ImportedLogicSemantics`; `project_mgr.rs` passou a calcular `entity_semantic_profile`, persistir `imported_semantics`, promover `external_source_refs`/`logic_hints` com `driver_functions` e `source_paths`, reconhecer `beat_em_up_close_range_signals`, evitar colapsar tudo no sprite primario e materializar `graph_ref`/movimento/rotulos conforme papel (`player_avatar`, `enemy_actor`, `projectile_actor`, `fighter_actor`, etc.). Ledger e testes de corpus agora carregam o motivo do papel e as fontes reais por entidade.
- **Provas/gates desta rodada:** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (`27` ficheiros / `272` testes), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1` (`320 passed / 0 failed / 10 ignored`), `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1` (`7 passed / 0 failed / 0 ignored`), `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\\\validate-upstream-windows.ps1 -SkipRustTests` (`success=true`, `processSweep.strategy=get-process`, `usedCanonicalRetry=false`), `npm run preflight:sgdk-e2e` (`Ready: SIM`) e `npm run test:e2e:desktop:qa-rc` (`code=0`, `manual-qa-status.json` em `2026-04-26T05:19:54.185Z`, blocos A-G `passed`) verdes.
- **Governanca:** SGDK continua **Experimental**; `support_status` permanece inalterado; a limitacao honesta continua sendo a Fase D sem parser/AST completo, apesar do ganho material de semantica e rastreabilidade.

### CHECKPOINT operacional (2026-04-25 — rodada 19)

- **Produto/CX da IDE:** `sceneWorkspaceContext.ts` passou a dar o mesmo contexto importado/overlay/nativo para `App.tsx`, `HierarchyPanel.tsx`, `InspectorPanel.tsx` e `ToolsPanel.tsx`; a IDE agora destaca cena ativa, entidade guia, fallback legado e proximo passo de forma consistente, em vez de espalhar sinais tecnicos por painel.
- **Desacoplamento real:** `sceneAssetHealth.ts`, `assetBrowserModel.ts`, `useAssetBrowserState.ts`, `SceneWorkspaceNotice.tsx`, `AssetBrowserSelectionCard.tsx` e `SceneAssetHealthBadge.tsx` extraem responsabilidades que estavam crescendo dentro de `ViewportPanel.tsx` e `ToolsPanel.tsx`. O Asset Browser ganhou decisao de instancia visivel (sprite vs tilemap) com `reason` auditavel e texto de acao.
- **Gate oficial Windows endurecido alem do fallback CIM:** `scripts/validate-upstream-windows.ps1` deixou de depender apenas de `%OS%`; a deteccao de Windows passou a usar `OS`, `$IsWindows` e `System.Environment.OSVersion`. No backend Rust, `build_orch.rs` injeta `OS=Windows_NT` antes de chamar o make SGDK em Windows, evitando que `common.mk` caia no ramo Linux e procure `m68k-elf-gcc`.
- **Cobertura nova:** `src/core/validateUpstreamWindows.test.ts` agora cobre tambem o caso sem `%OS%`; `src-tauri/src/compiler/build_orch.rs` ganhou o teste `megadrive_build_forces_windows_os_env_for_sgdk_make`.
- **Gates desta rodada:** `npm run check:tree`, `npm run lint`, `npx tsc --noEmit`, `npm test` (`267` testes), `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --test-threads=1` (`319` passed / `0` failed / `10` ignored), `cargo test sgdk_matrix_corpus_ --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture --test-threads=1` (`7` passed / `0` failed), `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\validate-upstream-windows.ps1 -SkipRustTests`, `npm run preflight:sgdk-e2e` e `npm run test:e2e:desktop:qa-rc` verdes. `upstream-validation.json` desta rodada ficou com `success=true`; `manual-qa-status.json` de `2026-04-25T18:43:11.668Z` voltou com blocos A-G `passed`.

### CHECKPOINT operacional (2026-09-08 — rodada HOST-WIN-01/A-01/B-01/C-01 integrada)

- **Integração em `main`:** PR #51 (`ed80c82`) → `8f9c9f8`; PR #49 (`a05f9b4`) → `fbfbf92`; PR #50 (`724342b`) → `5310a0a`; PR #48 (C-01, `883556a`) já contida e não reaplicada. Os quatro SHAs confirmados por `git merge-base --is-ancestor`, não pelo status das PRs. Merges autorizados explicitamente pelo operador, um a um, com o SHA reconfirmado imediatamente antes de cada merge.
- **Achado que domina a rodada:** o Desktop E2E é **intermitente**. O commit `8f9c9f8` falhou (run `34244326095`) e passou 16/16 no re-run **sem alteração de código**. A instabilidade é anterior à rodada (`bd45299` também falhava) e não foi introduzida pela #51. Gatilho provável: concorrência no provisionamento de toolchain no runner Windows.
- **Consequência para governança:** enquanto o mesmo commit puder dar verde ou vermelho, "gates verdes em `main`" **não** é evidência confiável de certificação. Qualquer conclusão futura baseada num único run verde deve ser tratada como não estabelecida.
- **Correção de diagnóstico registrada:** `SGDK real: FALTA / Ready: NAO` no preflight do passo MD ocorre **também nos runs que passam** (o SGDK é provisionado dentro do passo). Não é discriminante de falha, e a causa de B-01 atribuída a ele **não** está provada. B-01 não tem defeito de produto demonstrado — o que não equivale a defeito descartado.
- **Cobertura não fechada:** o verde de A-01 (`724342b`) foi obtido contra `8f9c9f8`, antes de `main` avançar para `fbfbf92`; a combinação A-01 + B-01 só é exercida em `5310a0a`, que fechou `Desktop E2E` e `CI` verdes na **primeira tentativa** (run `34252075629`), 16/16, ledger de 16 marcadores, sem `failure`/`skipped`. Ambas tocam `build_orch.rs`; o verde de primeira tentativa evidencia ausência de conflito semântico entre as fatias, mas não remove a intermitência da suíte.
- **GOV-01:** inalterada e isolada. `.mimosa`/`.zcode` preservados na raiz fiscalizada (pertencem a outra sessão); `check:tree` falha ali e passa em worktree limpo. Nenhuma exceção adicionada à árvore, nada movido ou apagado.
- **Limite de host:** `host:certify` completo e validação oficial Windows não são executáveis a partir do host Linux desta sessão; evidência Windows só via CI remoto. `host:diagnose` local `READY`, lock `d531c4b…`, medido antes do merge da #51 (que altera o lock).
- **Governança:** SGDK continua **Experimental**; nenhuma superfície promovida a Stable; gameplay completo, acessibilidade com leitor de tela real e release seguem **não medidos**.

### CHECKPOINT operacional (2026-09-09 — linha 8 da matriz SGDK: TaiketsuUltraHeroGenesis importado, ROM e grafo semântico provados)

- **Pergunta que abriu a rodada:** "já conseguimos importar `TaiketsuUltraHeroGenesis/src` e disponibilizar a estrutura lógica em nodes?" — a capacidade existia (importador SGDK + NodeGraph, Experimental); o jogo específico **nunca tinha passado pelo pipeline** (zero referências no repo/corpus).
- **Resposta com evidência real (host Linux, SGDK 2.11 oficial, Genesis Plus GX oficial, `fake_toolchain_used=false`):** a linha 8 `sgdk_matrix_corpus_taiketsu_ultra_hero_genesis_partial_flow_documents_build_blocker --ignored` fechou **Passou**: import direto da raiz efetiva `TaiketsuUltraHeroGenesis/src` (`resolution_kind=direct`, `source_kind=imported_sgdk`, 5 cenas, 0 warnings, tilemap/animação/colisão/`graph_ref` presentes), build com ROM `SEGA` (`mode=sgdk_managed`, `resident_kb=32`, `banks=2/8`, `fatal=0`) e emulação visível (90 frames, `320x224`, `non_black_pixels=15856`).
- **Estrutura lógica em nodes — número real:** o extrator semântico entrega grafo de **362 nodes / 344 edges** (`fsm_state=12`, `fsm_transition=5`, `sprite_move=88`, `spawn_entity=99`, `set_position=42`, `sprite_anim=17`, `vdp_validator=26`, `palette_hblank=14`, `destroy_entity=28`, `timer=12`, `scroll_tilemap=6`, `input_held=2`, `event_update=1`, `bridge_unconverted_source=10`) com cobertura `FSMs=2 / states=12 / transitions=5 / actions=245 / bridges=10 / blocking_gaps=5`; reports persistidos em `src-tauri/target-test/validation/sgdk-taiketsu-real/` (incl. `sgdk-nodegraph-report.json`).
- **Limites honestos registrados na linha 8 da matriz:** (1) a materialização por entidade no projeto importado ficou `converted_nodes=0`/`bridge_nodes=0` — o grafo de 362 nodes vive na camada semântica exportável (IR/reports), **não** como FSM nativa editável por entidade no editor (Fase D segue heurística, sem AST completo); (2) passos `sprite_anim` do grafo importado foram ignorados por nomes de animação não casados (`animacao 'idle' nao encontrada`) nos sprites por estado do doador — residual concreto para futura rodada de endurecimento da Fase D em jogos de luta.
- **Mudanças de código (só infra de teste, zero produto):** helper `sgdk_matrix_corpus_donor_path` aceita `RDS_SGDK_MATRIX_CORPUS_ROOT` (mesmo contrato do `RDS_SGDK_CORPUS_ROOT`); runner compartilhado da matriz agora retorna a ROM copiada em tmp (`Option<PathBuf>`) e imprime `MATRIX_* logic:` com contagens converted/bridge; vertical semântico ganhou label `TaiketsuUltraHeroGenesis`; matriz documental ganhou linha 8 + nota 2026-09-08 em `docs/SGDK_REAL_CORPUS_VALIDATION_MATRIX.md`.
- **Gates desta rodada (todos medidos no host):** `cargo clippy -D warnings` OK; `cargo test --lib` **487 passed / 0 failed / 32 ignored**; `sgdk_matrix_corpus_ --ignored` **8/8** (7 títulos ausentes pulados via `RDS_SGDK_MATRIX_CORPUS_SKIP=1`, linha 8 rodada real e determinística em 3 execuções); `cargo fmt --check` OK; `npm run lint` OK; `npx tsc --noEmit` OK; `npm test` **601 passed / 6 skipped** (63 arquivos); `check:tree` OK em worktree limpo e no checkout canônico falha **apenas** pelos diretórios GOV-01 (`.mimosa`/`.zcode`, de outra sessão — preservados, nada novo introduzido); `host:diagnose` `READY` (lock `dd99a22f…`); `host:certify` ficou **BLOCKED exclusivamente por `gate_failed:check:tree` da GOV-01** — bloqueio ambiental pré-registrado, sem relação com esta mudança. Backup íntegro do doador em `/tmp/rds-taiketsu-backup/` (original não modificado).

### CHECKPOINT operacional (2026-09-09b — validação desktop da linha 8 no app real + fix de comentários `//` em `.res`)

- **App real validado com o import do Taiketsu:** o app debug (`build:debug`) foi lançado via `tauri-driver`/WebKitWebDriver e o import executado pela API canônica do shell (`window.__RDS_E2E__.importSgdkProject`, o mesmo caminho do wizard). Resultado: **0 erros de console**; cena com 65 entidades renderizada (sprites, hitboxes, hierarquia "CONFORMIDADE MIGRADA", inspector, thumbnails); workspace de lógica com o grafo da entidade editável em lanes, source mapping `src/main.c` e painéis honestos (heurística, gaps, hardware feedback "Sprites/frame 63/80"); Resumo SGDK Logic com 189 nodes heurísticos gerados e badge "EQUIVALÊNCIA GAMEPLAY NÃO CERTIFICADA". Projeto importado pelo usuário fica em `~/Documents/RetroDevProjects/TaiketsuUltraHeroGenesis`. 63 warnings benignos de fetch de asset com fallback `Image()` (assets renderizam; ruído de console a melhorar depois).
- **Bug de produto encontrado e corrigido (regressão real, não específica do doador):** comentários `//` em manifests `.res` (estilo HAMOOPIG, ex.: `//305 = 304` no `sprite.res` do Taiketsu) eram parseados como recursos falsos (`kind='//305'`, name `'='`) e apareciam na UI como **5 "gaps bloqueantes" falsos** com texto truncado. Correção nos **dois** parsers: `parse_sgdk_manifest` (`project_mgr.rs`) e `parse_resource_manifest` (`sgdk_corpus_inventory.rs`) agora ignoram linhas `//` e `;` (comentário oficial do rescomp), cada um com teste de regressão dedicado.
- **Números pós-fix (linha 8 rerodada):** import/build/ROM/emulação idênticos (ROM `SEGA`, 90 frames, `non_black_pixels=15856`); grafo semântico sem as bridges falsas: **362→357 nodes**, bridges **10→5** (`bridge_unconverted_source=5`), gap kind `unsupported_resource_kind` **eliminado**; os 5 `blocking_gaps` restantes são os limites reais da Fase D (`assembly_source`, `complex_state_expression`, `preprocessor_condition`). `converted_nodes=0`/`bridge_nodes=0` por entidade **permanece** (limite heurístico honesto, candidato a futura rodada de endurecimento da Fase D para padrões de jogos de luta).
- **Gates pós-fix:** `fmt` OK; `clippy -D warnings` OK; `cargo test --lib` **489 passed / 0 failed / 32 ignored** (+2 testes de regressão); `lint`/`tsc` OK; `npm test` **601 passed / 6 skipped** (1 falha transitória de worker Vitest no primeiro run — intermitência conhecida de I/O do `/mnt/sdcard`, verde de primeira na rerodada); vertical semântico e linha 8 rerodados verdes. Commit de follow-up no PR #58.

### CHECKPOINT operacional (2026-09-09c — cobertura de lógica do corpus local SGDKForge: 13/13 extraídos, 10 com fluxo completo)

- **Pergunta:** "conseguimos cobrir a lógica de todos os jogos funcionais em `/mnt/sdcard/SGDKForge/`?" — corpus novo do operador, distinto da raiz de referência da matriz. Mapeamento: `SGDK_projects/` com 14 diretórios (12 com fontes + ROM compilada própria; 4 variantes stub vazias de KIRBY/TAIKETSU sem nenhum `.c`), `SGDK_Engines/` com engines (HAMOOPIG-SGDK, Blast-Engine, UltraDrive, PlatformerEngine, MegaDriving, MDSDRV, Awesome_MegaDrive, SGDK-examples) e o TaiketsuUltraHeroGenesis (já coberto pela linha 8). Nenhum outro jogo funcional com ROM própria fora de `SGDK_projects/`.
- **Método (sem tocar no corpus do operador):** staging `/tmp/sgdkforge-corpus` com symlinks dos 12 jogos funcionais + `TaiketsuUltraHeroGenesis/src` (referência); inventário semântico via `sgdk_corpus_inventory_real_corpus_report --ignored` e prova funcional via `sgdk_corpus_real_build_rom_emulation_report --ignored` (import → build SGDK 2.11 real → ROM `SEGA` → emulação visível Genesis Plus GX), ambos com `RDS_SGDK_CORPUS_ROOT` apontando ao staging. Artefatos: `target-test/validation/sgdk-corpus-inventory.json` e `target-test/validation/sgdk-corpus-real-build/sgdk-corpus-real-build-report.{json,md}`.
- **Resultado — cobertura de lógica: 13/13 jogos têm a lógica extraída** (node candidates por jogo: 247–902; total ≈ 5,6 mil; gaps agregados: `preprocessor_condition=247`, `function_like_macro=23`, `assembly_source=16`, `multiline_macro=9`). **Prova funcional: 10/13 com fluxo completo IBRE** (import + build real + ROM `SEGA` + emulação visível): BLUE_CIRCUIT, Celestial Chase Revive, Celestial Chase visual benchmark, GOTHAM_OVERDRIVE, KIRBY CLOUDE, KIRBY GROK BUILD, MARE_BRAVA, SMOKE_TEST, TAIKETSU ULTRA REBIRTH e TaiketsuUltraHeroGenesis. **3/13 bridge_only** (lógica extraída como bridges/candidates, sem projeto nativo buildável nesta rodada): FORGE_REFERENCE (190 candidates), _agent_laboratory (308), _agent_training (428) — o runner registra a categoria honestamente, no mesmo padrão dos 54 bridge-only do corpus de referência. `failed=0`, `fake_toolchain_used=false` em todas as entradas.
- **Segunda regressão de robustez real corrigida (commit no PR #58):** `.mddev/project.json` gravado com **BOM UTF-8** por ferramentas Windows (BLUE_CIRCUIT, Celestial Chase benchmark) derrubava o import inteiro ("expected value at line 1 column 1"). Fix: `load_mddev_project_meta` faz strip de `\u{feff}` antes do `serde_json` + teste de regressão. Pós-fix, os 2 projetos passaram a importar e fecharam IBRE.
- **Gates Rust:** `fmt` OK; `clippy -D warnings` OK; `cargo test --lib` verde (+1 teste de regressão BOM → 490 testes). Frontend não alterado nesta fatia.
- **Follow-ups candidatos (fora do escopo desta rodada):** (1) converter os 3 bridge_only em projetos buildáveis (provável necessidade de anchors de cena/tilemap no importador); (2) cobrir engines/exemplos se o operador quiser engine-code no escopo; (3) silenciar/compactar os warnings benignos de fallback de assets no viewport.

### CHECKPOINT operacional (2026-09-09d — próximos passos executados: corpus re-estagado por projeto real + warnings de fallback agregados)

- **Diagnóstico dos 3 bridge_only da rodada anterior:** `_agent_training` e `_agent_laboratory` são **diretórios-wrapper** contendo projetos aninhados (HYBRIDO_MUAY_THAI — completo; LIVE_BAR_FR2 e SCENE_TILEMAP_CURATION_FIXTURE — completos; TAINA_RESAMPLING_ROUTE_LAB — stub vazio, confirmado com retry por causa dos soluços de I/O do cartão SD). `FORGE_REFERENCE` é **doador code-only**: o `resources.res` só tem comentário ("usa fonte built-in do SGDK"), então o importador não materializa cena/assets e o runner registra bridge-only honesto (190 candidates extraídos).
- **Corpus re-estagado por projeto real (14 doadores, mesmo método de symlinks):** resultado final `failed=0`, **13/14 com fluxo completo IBRE** — entraram como IBRE: HYBRIDO_MUAY_THAI (luta, `non_black_pixels=15954`), LIVE_BAR_FR2 (71680), SCENE_TILEMAP_CURATION_FIXTURE (6844). Único residual: FORGE_REFERENCE (code-only, 190 candidates) — converter doadores code-only em projeto nativo buildável é feature do importador (Fase D), registrada como follow-up, não hackeada nesta rodada. Inventário semântico rerodado: gaps agregados `preprocessor_condition=230`, `function_like_macro=21`, `assembly_source=15`, `multiline_macro=9`.
- **Warnings de fallback de assets agregados (UX):** o viewport emite **um único** aviso de fallback `Image()` por sessão de carregamento (`assetFallbackWarnedRef`) em vez de uma linha por asset (63 no Taiketsu importado). O fallback em si é benigno e continua ativo. `lint`/`tsc` OK; suíte frontend medida nesta rodada.
- **Lição de host registrada:** `find` sobre o cartão SD pode retornar resultado vazio por soluço de I/O — reconfirmar com retry (aconteceu duas vezes nesta rodada com o mesmo comando: 0 resultados → cheio no retry).

### CHECKPOINT operacional (2026-09-09e — doadores code-only buildáveis via Fase D + cobertura das engines do SGDK_Engines)

- **Import code-only implementado no caminho canônico:** `import_sgdk_project` agora detecta doador code-only (manifests `.res` presentes + fontes C + nenhum recurso importável — caso FORGE_REFERENCE, que usa só a fonte built-in do SGDK) e, em vez de rejeitar, cria projeto nativo com cena `code-only`: entidade `code_only_logic` com `graph_ref` → `graphs/sgdk_import_code_only.json` contendo grafo ponte honesto (`event_update` → `bridge_unconverted_source` não bloqueante, `source_file` rastreável ao `main.c` do doador), `imported_semantics` com `audit_flags=["code_only_donor"]`, ledger `sgdk-import/v4` e warning auditável. Teste de regressão dedicado (`import_sgdk_project_supports_code_only_donor_with_bridge_scene`). O emitter já tratava `bridge_unconverted_source` não bloqueante como `NoOp`, então o C gerado compila.
- **Prova real:** corpus SGDKForge rerodado — **14/14 IBRE, `bridge_only=0`, `failed=0`**. FORGE_REFERENCE fechou fluxo completo (ROM `SEGA`, emulação visível com 795 px não-pretos — coerente com jogo de texto/fonte built-in). Relatório: `target-test/validation/sgdk-corpus-real-build/sgdk-corpus-real-build-report.json`.
- **Cobertura das engines (`SGDK_Engines/`, 8 projetos estagiados):** inventário semântico **8/8 com lógica extraída** — SGDK-examples 2.744 candidates, SGDK_MegaDriving 634, HAMOOPIG-SGDK 351, Blast-Engine 233, UltraDrive 53, PlatformerEngine 39, MDSDRV 41, Awesome_MegaDrive 0 (tooling/docs). No build/emu, as 8 importam e são classificadas **bridge-only** — correto: são bibliotecas/suites de exemplo, não jogos standalone; o gate `emulation_visible_ok > 0` do runner (correto para jogos) panica nesse corpus e **não foi afrouxado** — o relatório JSON da varredura fica como evidência. Conversão de exemplos de engines em projetos buildáveis exigiria estagiamento por exemplo + adequação por convenção de cada engine (follow-up registrado, não feito).
- **Gates:** `fmt`/`clippy -D warnings` OK; `cargo test --lib` verde (+1 teste → 491); frontend não alterado nesta fatia. SGDK segue **Experimental**; nenhuma promoção de `support_status` — o import code-only materializa pontes honestas, não AST/FSM.




### CHECKPOINT operacional (2026-09-09 — GO formal da Fase 6: decompilação pareada, Fase 0 Sprint 1 + Etapa A provadas; branch `codex/decomp-pareada-fase0-sprint1`)

> Nota de integração: esta frente é **separada** do PR #58 (import/nodes); checkpoints 09-09b..e vivem naquela branch e devem ser reconciliados no merge pelo integrador.

- **GO formal do operador (2026-09-09):** "trabalhar na decompilação de ROMs e desenvolver esta capacidade testando com `TaiketsuUltraHeroGenesis/src/out/rom.bin`", escopo confirmado por pergunta: **Sprint 1 da Fase 0 + Etapa A, sem LLM** (Etapa B permanece bloqueada até as métricas da A registradas; UI/LLM exigem GO específico com BYOK+orçamento+kill-switch).
- **Núcleo estático implementado e testado** em `src-tauri/src/tools/reverse/decomp/` (árvore autorizada; `#![allow(dead_code)]` documentado — consumidores de produção chegam nas fases seguintes): `triage.rs` (header SEGA/tier), `symbols.rs` (nm/`nm -S`), `rom_library.rs` (pares BYOR + `DecompLedger` `decomp-ledger/v1` em `RDS_DECOMP_WORK`), `ghidra_bridge.rs` (analyzeHeadless; programa **literal** + PATH do filho injetado com diretório validado — padrão exigido pelo scanner Mimosa após bloquear execução com caminho dinâmico), `fingerprint.rs` (SHA-256 por função), `object_diff.rs` (objdump `-dr` normalizado por símbolo), `decomp_orch.rs` (orquestrador). 19 testes unitários novos; `sha2 = "0.10"` promovida a dependência direta (já transitiva no lock).
- **Etapa A executada em 3 pares Tier 0** (relatório `target-test/validation/decomp/etapa-a-report.json`; ledger em `RDS_DECOMP_WORK`): `SMOKE_TEST` (864 funções) e `BLUE_CIRCUIT` (766 funções; boundary Ghidra **precision 0,946 / recall 0,369**) fecharam **self-compare determinístico** — ROM do rebuild duplo idêntica byte-a-byte e objetos 2/2 exatos; `TaiketsuUltraHeroGenesis` medido contra o ground truth real (1.536 funções de texto do `symbol.txt`, 1.295 hashes únicos): boundary **precision 1,0 / recall 0,113** (release build do autor) com **rebuild não reproduzível** no host (boot customizado exige `registerState`, ausente da lib SGDK 2.11/gcc 13.2) — nota honesta no ledger, sem MatchExact.
- **Armadilhas do donor-rebuild resolvidas no core** (reutilizáveis para corpus): cópia do doador pulando `out/`/`.git`/`build`; `ensure_res_dep_files` cria `res/*.d` vazio (makefile.gen 2.x faz `cp res/*.d`, que falha em build limpo); `.d` com paths do build Windows do autor nunca entram no rebuild.
- **Gates:** fmt/clippy OK; `cargo test --lib` com 19 testes novos verdes; frontend sem alteração (601/6 skipped medidos na rodada anterior); `check:tree` OK (subdir `decomp/` sob `tools/reverse/` permitido); GOV-01 segue o único bloqueio ambiental do `host:certify`.
## Checkpoint 2026-09-19 — composição multi-frame assistida

Na branch `codex/rex-sprite-frame-01`, a composição de sprite deixou de estar limitada ao único `spr_ryo_100/frame-0`. O manifesto agora parametriza os frames 0 e 1 do recurso doador HAMOOPIG: frame 0 usa tiles `0x863A0 + 0x800` e descritores `0x22260`; frame 1 usa tiles `0x86BA0 + 0x840` e descritores `0x222A2`; ambos usam a paleta `0x2CC68 + 0x20` da ROM BYOR SHA-256 `558bea6c80c76ec3da23afd584d4b56ece7722847ab1efc8c2f23f43f8529be9`. O painel passou a selecionar o `frame_id` preservando o recurso e a proveniência assistida.

O oráculo E2E também seleciona o manifesto por `frame_id`, mantém os hashes PNG/RGBA separados e conserva negativos de ordem de tiles, paleta, flip e mutação de pixels. A máscara de transparência do frame 1 coincide com a segunda célula independente do PNG doador SHA-256 `1ff180a0737f5b3c8c156effc481de037d2daba1bce4993dda54598bbd7aa63b`. Outros recursos permanecem deliberadamente sem composição automática até que bytes compilados, frame, paleta, fonte e transformações tenham a mesma rastreabilidade. A superfície continua Experimental; não cobre animação, edição do jogo ou extração geral.
### Checkpoint 2026-09-20 — Sonic 1 visual pilot

Branch isolada `codex/rex-sonic1-pilot`, código/harness em `57c2780` e documentação de evidência em `243c3a6`, sem merge. ROM BYOR local fixada por SHA `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb` (`531.577` bytes). A fatia assistida `sonic1_sonic/stand` usa bytes comprovados em `0x21AFE+0xA120`, paleta `0x2388+0x20` e mapping `0x21293+21`; o oráculo independente base é `ce95ea66f2cfcec40a0fb12cb35fe5e88530de036de9f897333ce762f06b40d4`. O fluxo UI inclui edição RGB333 em cópia, BPS com CRC da base, aplicação separada, emulação e reabertura persistida; `InspectionPanel 8/8`, composição Rust `9/9`, patch `5/5` e frontend `622/6` passaram com `TMPDIR=/tmp`. O build canônico `src-tauri/target-test/debug/retro-dev-studio` tem SHA `70314bc2289df512fe401fd1b97d17c859f9d6540f8ca8a08d87c4f991cd7ddb`; o desktop E2E final passou com pixels base `ce95ea…`, edição/reabertura `91ee4a…`, patch `35c91e…` e ROM aplicada `d381b1…`. Detalhes em `docs/REX_SONIC1_PILOT.md`. Limitação: Experimental, perfil assistido, sem extração universal ou reconstrução/lógica.

### Checkpoint 2026-09-21 — execução Sonic observável e efeito de paleta separado

No commit de código `c0ad292` foi corrigida a prova de execução do piloto Sonic: a UI usa `emulator_run_frames` em lotes, envia START no frame 900 e expõe ROM, core, frames, framebuffer, pixels não pretos e hash RGBA. O build canônico usado no desktop foi `src-tauri/target-test/debug/retro-dev-studio`, SHA `b069a5fb8928023699816e164876bb39faf58615cbc62fcac3c04bc51f42d77d`; frontend `index-tGPqe_u5.js`, SHA `74d3c8b61a5ff3e25accb547b60f3526d6d96d5a621f69985ba37d612cfc7952`.

O E2E `inspection-sonic` passou no fluxo real identify → compose → edit → save → BPS → apply → run base/applied → restart/reopen. A ROM BYOR original foi relida no fim e permaneceu em `531577` bytes, SHA `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`. Sob o mesmo core `Genesis Plus GX v1.7.4 46a5521`, 1200 frames e START no frame 900, a base produziu framebuffer `320×224` SHA `680faf…` e a aplicada `02b1fb…`; a ROI não preta e o contador de pixels magenta-like diferenciaram a mutação (`0` na base, `189` na ROI aplicada). A prova separa explicitamente “carregou e produziu frames/framebuffer” de “alteração de paleta apareceu no jogo” e inclui capturas reais base/aplicada/reaberta.

Evidências finais: `src-tauri/target-test/validation/sonic1-pilot-2026-09-21T03-56-34-468Z/` e capturas `inspection-2026-09-21T03-56-06-406Z-sonic-*`. O primeiro resultado histórico de 60 frames preto permanece preservado como lacuna anterior, não como prova atual. A superfície continua Experimental, assistida e restrita a esta ROM/recurso; não há declaração de extração universal, equivalência do jogo inteiro ou lógica/nós recuperados.

### Checkpoint 2026-09-21b — PR #74: superfície canônica de jogo e bloqueio de salto

Continuação sobre `5284d458` na branch isolada `codex/rex-sonic1-pilot`, sem merge. A ação `Jogar versão modificada` usa o `loadRomIntoEmulator` canônico já usado pela superfície de emulação; a UI expõe path, tamanho, SHA, core, framebuffer, frames renderizados e ACK de input. Nenhum emulador ou caminho exclusivo do harness foi criado.

Destino: binário `src-tauri/target-test/debug/retro-dev-studio`, SHA-256 `7b6ad560b899195b1b22b6a415c38bf6c2d594bbf4f806a7486858a9ac6158ff`; frontend `dist/assets/index-N1yRKj1H.js`, SHA-256 `45523954b6c9cdd8cca8adf727e81ccde60b16973c9b77eb84ce9871150a04eb`; ROM BYOR `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531.577 bytes; ROM aplicada `d381b1eed8f47dcd08890007b58b90cd5e3cabdaed96deac9b1e7336b1558e4d`; BPS `35c91e8d31a64d72a09f664deb67ec9ebe42015f0dd4aeb20cb95f9283ab817c`; core `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1` (`Genesis Plus GX v1.7.4 46a5521`).

O E2E `inspection-sonic` (sessão `inspection-1789983205-00000000`) reexercitou identificação, edição, BPS, base/aplicada, reinício/reabertura, identidade da ROM modificada, framebuffer real `320×224` e preservação da BYOR. Após `frames >= 1800`, a captura `src-tauri/target-test/validation/inspection-2026-09-21T09-33-12-050Z-sonic-game-modified-before-controls.png` (SHA-256 `8a8b9b0de5bdeea7ea2f6cb2a7bbf27e01a1f304911922ce4484252b284bb03f`) mostra Sonic em gameplay, sem o cartão da fase. ArrowRight chegou pelo handler/IPC e alterou a máscara/centróide horizontal independente.

### Checkpoint 2026-09-21c — PR #74: movimento e salto reais na Game View canônica

Continuação no branch `codex/rex-sonic1-pilot`, sem merge. A execução desktop `inspection-sonic` com prefixo `inspection-2026-09-21T14-23-44-938Z` passou no binário `src-tauri/target-test/debug/retro-dev-studio` SHA-256 `126e8b7e341a8b8605011360750ce661d80381a3f0ab8f2adeb149fce317ac10`, ainda sobre `4b96ec3` dirty pelas correções atuais de harness/UI. ROM BYOR: `/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin`, `531577` bytes, SHA `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`; ROM aplicada `d381b1eed8f47dcd08890007b58b90cd5e3cabdaed96deac9b1e7336b1558e4d`; BPS `35c91e8d31a64d72a09f664deb67ec9ebe42015f0dd4aeb20cb95f9283ab817c`; core `Genesis Plus GX v1.7.4 46a5521`, SHA `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1`.

O produto agora expõe `Jogar ROM base` além de `Jogar versão modificada`, ambos pela Game View canônica (`loadRomIntoEmulator`). A prova de identidade do personagem não usa mais ROI magenta como oráculo: a primeira localização usa o template independente do frame `sonic1_sonic/stand` e a trajetória usa WRAM região `2`, objeto candidato `0xD000`, validada pela correlação visual inicial (`center.x≈78,5`, WRAM `x=80`, `y=944`) e pelos deltas causados por input nativo. Na ROM aplicada, `ArrowRight` foi ACK pelo handler do produto e moveu WRAM `x` de `80` para `451`; `KeyZ/A` foi ACK e produziu salto com `y=940 → 904` (`yVel=-1272`) e depois `844`. Pausa/retomada passaram (`2250 → 2260` frames). A sessão foi salva, o app reiniciado, a mesma sessão reaberta, a ROM modificada carregada novamente por interface, e a BYOR original foi relida intacta.

Evidências: `src-tauri/target-test/validation/inspection-2026-09-21T14-23-44-938Z-sonic-base-trajectory.json` SHA `bf766dbb20777aaaed8739f49bc137cb4d5269466f7111aa65518f2b6bc20b65`; `...sonic-trajectory.json` SHA `eb3195bd3746cd270355a5ec4356c21fb1615760dcd98daff0452465a4411b8d`; capturas `...sonic-game-base.png` SHA `a0d57b7194f23106aa30efe5489ec57730d78d6be85625884a50de6e42320aa8`, `...sonic-game-modified-before-controls.png` SHA `44a9fb25b49860f61bf273ce9550f53eab42c19cbe194361666344e2cfff0d45`, `...sonic-game-modified-after-restart.png` SHA `8ae8fb27536fa9037a51b0b097c0383e95d273fd5cf01cb742ba8f52ed26dab9`. Negativos integrados passaram para ROM errada por hash, imagem antiga reutilizada por framebuffer SHA e tecla `Q` sem ACK novo; cenários negativos dedicados ainda podem ser separados se o revisor exigir isolamento por caso. Próximos passos: commit limpo, build canônico no SHA final, E2E/gates finais e CI; manter Experimental e não avançar para lógica/nós.

### CHECKPOINT operacional (2026-09-26 — frente do integrador: encoder aPLib e capacidade medida)

Branch `codex/rex-integrator-aplib-decode`. HEAD deste checkpoint: `290c8ec` (docs da matriz). Cadeia não enviada ao iniciar a barra: `632c195` (encoder guloso + `needs_space`), `745dc59` (cobertura de offsets distantes + capacidade congelada), `3a3db96` (rep-match), `068e89e` (rastreador de tokens), `19bc865` (token `111`), `2f0bd4b` (aceite por oráculo independente), `290c8ec` (registro na matriz). Alterações não commitadas: apenas esta entrada do Memory Bank. Nenhum arquivo alheio foi tocado; os não rastreados preexistentes (`.mimosa/`, `APJ-unpack`, `a.out`, `apultra-decode`, `data/canonical-local-2026-09-21/`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/`) permanecem como estavam — removi só `src-tauri/analysis/`, duplicata byte a byte (`diff -rq` = idênticos, 8/8) dos dumps regeneráveis que já vivem em `src-tauri/target-test/analysis/aplib/` e que eu mesmo produzi com `RDS_APLIB_DUMP`.

**Hipótese da rodada.** "Tornar mais recursos comprimidos editáveis sem expansão" exige encoder, e encoder exige capacidade *medida* em vez de alegada. A hipótese operacional era: o gap de 44 B (444×…) entre o stream do produto e o do oráculo não vinha de token indisponível no formato, e sim de escolha de parse do guloso — literalmente de rearmar LWM. Isso previa que (a) adicionar o `111` e o rep-match reduziria o gap sem tocar no formato, e (b) a mesa de tokens diria em números onde o parse diverge.

**Evidência a favor.** `token_dump.py` fecha a contabilidade (`1 + Σtags + Σdados = stream consumido`, custo em bits + rabo do último tag = tamanho real) para os **35 streams bem-formados** do acervo — 9 goldens, 16 de dois oráculos sobre 8 plains, 2 discriminantes, 8 dumps do produto — com zero falha; os 7 negativos são recusados cada um pelo motivo estrutural que o define. **7 das 8 mesas de tokens do produto são idênticas às dos dois oráculos** (`apultra` v1.4.8 `64be2a7a…` e `apj.jar` do SGDK 2.11) em contagem por tipo, plain produzido e custo. A perna 2 da paridade do CONTRACTS §4 (oráculo desempacotando stream do produto) passou em **8/8** por `oracle_encode_parity.py`, e a não-vacuidade do aceite foi provada por controle: um bit invertido na tag de `tile_like` foi aceito pelo oráculo mas produziu hash diferente → o script apontou FAIL e saiu com rc=1. Pinos congelados por igualdade em `aplib_encode_tem_a_capacidade_medida_congelada_por_plain`; `text_rep` 29→28 B (igual ao oráculo), `noisy_runs_16k` 1365→1364 B.

**Evidência contra / ainda não alegado.** Optimalidade não é alegada: não houve comparação exaustiva com parse ótimo, e a única divergência restante é real — `noisy_runs_16k` sai 1364 B contra 1205 B do oráculo, e a mesa atribui: o produto paga **+433 B** de `match-10` (305× a 3,36 B contra 179× a 3,31 B) para economizar 272 B entre literais e rep-matches. O `111` economiza 2 bits por ocorrência mas **não** chegou a encolher stream nos dois casos fixados (`ABCDA`, `01 00 02`), porque estoura o tag e cobra um tag extra. Não há oráculo 68000 sob MAME para stream do produto aPLib (só existe para LZ4W), nem reinserção em slot: `reinsert` em `rex_resources.rs` continua caminho exclusivo de LZ4W, então **nenhum recurso APLIB da ROM é editável sem expansão pelo produto hoje** — ligar o encoder a essa via é frente separada, sem autorização para expandir ROM ou realocar ponteiros. A célula da matriz permanece `blocked` por decisão de missão.

**Últimos comandos e resultados.** `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` → rc=0. `cargo test --lib -- --nocapture` → `699 passed; 0 failed; 54 ignored`, 61,97 s. `cargo clippy -- -D warnings` → rc=0. `npm run check:tree` → `OK: Estrutura da raiz conforme docs/08_TREE_ARCHITECTURE.md.` `npx tsc --noEmit` → rc=0. Jobs pesados um por vez, nenhum em background.

**Próximo comando.** `git fetch origin` + `git push origin codex/rex-integrator-aplib-decode` (fast-forward: 0 atrás, 7 à frente), depois conferência pontual de CI. **Sem merge, sem release, sem promoção de maturidade.**

**Bloqueio.** Nenhum técnico. Dois itens ficam entregues à decisão do operador: (a) promover a célula APLIB da matriz e (b) autorizar a frente "encoder → reinsert", que depende da mensagem clara de descarte fora de faixa no UI e da guarda do backend já existentes. O incremento de parse seguinte (rearmar LWM encurtando match, com busca exaustiva em entradas pequenas) está medido mas deliberadamente não executado, porque a meta exige a prova do modelo antes de alegar ganho.

### CHECKPOINT operacional (2026-09-27 — frente do integrador: aPLib entra na transação canônica e na fronteira de produto)

Branch `codex/rex-integrator-aplib-decode`. HEAD deste checkpoint: `41a05b6` (UI) sobre `56faf0d` (transação Rust) e `48562b7` (gate de paridade endurecido, passo 1). Alterações não commitadas: apenas esta entrada e a célula correspondente em `docs/rex_profiles/ROUND_STATE.md`. Os não rastreados preexistentes (`.mimosa/`, `APJ-unpack`, `a.out`, `apultra-decode`, `data/canonical-local-2026-09-21/`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/`, `scripts/rex_profiles/integrator/aplib/__pycache__/`) permanecem intocados — nada alheio foi apagado nem staged. O item (b) do bloqueio do checkpoint anterior ("autorizar a frente *encoder → reinsert*") é exatamente o que esta barra executou; o item (a), promover a célula APLIB da matriz, continua com o operador.

**Hipótese da rodada.** A reinserção do aPLib não pede arquitetura nova: pede que a sequência de guardas existente aceite um segundo *contrato de histórico*, e que a UI deixe de pressupor LZ4W. Isso previa que (a) as sete guardas poderiam ser compartilhadas sem remover validação específica do LZ4W e (b) nenhum caminho precisaria "adivinhar" codec, porque o header TileSet do SGDK já declara `compression`.

**Implementação.** `TransactionLimits` (orçamentos de decode/encode aPLib e LZ4W), `RecursoVerificado` (o recurso verificado carrega o próprio contrato), `verify_resource_set` (varre candidatos dos **dois** codecs, ignora quem falha na verificação e **recusa sobreposição cross-codec** com `invalid_reference`), `RecursoEditavel::{desempacotar, recodificar_no_espaco}`, `transacao_canonica` (as sete guardas numa só sequência: identidade → evidência → tamanhos → no-op → re-codificação dentro do espaço comprovado → ida-e-volta → cópia + dependentes → BPS re-aplicado com hash exato) e `reinsert_transaction_aplib`. `reinsert_transaction` (LZ4W) foi redirecionada para a mesma função: o corpo de 162 linhas deixou de ser duplicado, mas `verify_lz4w_resource_set`, o dicionário de comprimento par, o índice de dicionário e o encaixe por orçamento de espaço continuam no caminho dele e seguem exercitados pelos testes originais. A fronteira de produto (`list_resources` → `preview_resource` → `apply_resource_edit`) rotula e despacha pelo codec lido do header; os artefatos passam a chamar-se `rex-{codec}-modified-*` / `rex-{codec}-patch-*`.

**Duas mudanças de semântica registradas explicitamente** (não absorvidas em silêncio): (1) `verified_preserved` conta agora sobre o **conjunto dos dois codecs**, então um "preservados N" de ROM mista não é comparável byte-a-byte com o mesmo número de antes; (2) `analyzed_scope` declara o denominador por codec (`3/3 candidatos (LZ4W 2/2 de LZ4W, aPLib 1/1 de aPLib)`); a asserção pré-exigente `contains("2/2")` do tronco LZ4W continua válida por construção desse texto. No painel, o escopo deixou de dizer "Recursos comprimidos LZ4W" e passou a contar por codec.

**Evidência a favor (capacidade medida, foram os números que escolheram a fixture).** Sobre os streams dos oráculos: `tile_like` empata o oráculo em **41 B**, mas a menor edição de 1 pixel custa **+3 B** (44 > 41) — *nenhuma* edição cabe num slot assim, e isso é propriedade do codec sobre aquele plain, não defeito do encoder; `pseudo_random_8k` empata em 294 B com delta mínimo **+1**; `noisy_runs_16k` é o único com folga medida (oráculo **1 366 B**, produto **1 364 B**) e tem edição de 1 pixel de custo **zero** (tile 64, linha 3, coluna 4, índice 11 → 15 → re-codifica em 1 364 B). A fixture de edição usa esses números; a de recusa usa o slot apertado de 41 B e exige que a mensagem carregue `41` e `8192`. Gate de paridade reexecutado nesta célula: **esperado 16 | executado 16 | aprovado 16 | divergente 0**, rc=0, com os dois oráculos independentes (`apultra` v1.4.8 `64be2a7a…`, `apj.jar` SGDK 2.11 `2d8cdc63…`). Novos testes verdes: `conjunto_verificado_reconhece_lz4w_e_aplib_na_mesma_rom`, os cinco `reinsert_aplib_*` (com `excessive_output`, `dependent_modified` e `rom_identity_mismatch`/`evidence_mismatch` cobertos) e `ui_edite_recurso_aplib_pela_mesma_fronteira_do_lz4w`, mais o teste do painel para ROM mista. **Não-vacuidade provada por mutante:** neutra o ramo aPLib de `verify_resource_set` → **6** testes falham (fronteira de produto, tronco e conjunto); o mutante do painel derruba exatamente a asserção `(LZ4W 1, aPLib 1)`. Ambos revertidos e suíte reexecutado.

**Evidência contra / ainda não alegado.** Nada aqui toca o alvo comercial: o passo 4 (reconfirmar `0x2e4d4`/`0x2d534`/paleta derivando de novo dos manifestos atuais, onde existem claims conflitantes `0x2cbc8`/`0x2CC68`) e o passo 5 (fluxo completo pelo app e execução com o desempacotador usado pelo jogo) seguem abertos, e o E2E canônico do fixture **não** foi reexecutado nesta célula — a UI mudou e precisa ser reexecutada antes de qualquer alegação sobre ela. Os dois oráculos de host não substituem o replay 68000. A edição semântica do recurso comercial continua bloqueada, e a ETAPA E continua aceita apenas no escopo do fixture autoral LZ4W. **Achado de fixture registrado:** a semente de dependência cross-codec precisa vir da **cauda** do stream aPLib — com a cabeça (32 B) a transação era aceita, porque a edição começa no tile 64 (offset 2 048 de 16 384) e os primeiros ~170 B re-codificados permanecem idênticos; a guarda existia, o fixture é que não exercitava dependência real.

**Últimos comandos e resultados.** `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` → rc=0. `cargo clippy -- -D warnings` → rc=0 (a primeira corrida falhou com 5 lints `doc list item without indentation` da minha própria doc-string numerada; corrigida a doc, sem `#[allow]`). `cargo test --lib -- --nocapture` → **706 passed; 0 failed; 54 ignored** (699 no pino anterior + os 7 desta barra). `npm run check:tree` → OK. `npx tsc --noEmit` → rc=0. `npm run lint` (`--max-warnings=0`) → rc=0. `npm test` → **702 passed; 6 skipped (708)**; delta reconciliado com o 699/705 registrado anteriormente: **+3**, sendo 2 do `6351f15` (avisos de descarte na UI) e 1 deste checkpoint (painel de ROM mista). `python3 scripts/rex_profiles/integrator/aplib/oracle_encode_parity.py src-tauri/target-test/analysis/aplib` → rc=0, 16/16. Jobs pesados um por vez, nenhum em background.

**Próximo comando.** `npm run build:debug` e em seguida o cenário E2E do fixture (as asserções existentes não podem se mover: "exatamente 1 recurso LZ4W", o regex do rótulo `stream (\d+) B`, `.includes("noop")`), depois `git fetch origin` + `git push origin codex/rex-integrator-aplib-decode` e consulta **pontual** do CI no SHA publicado (passo 2, ainda em aberto: `4a389ff`/`cb8557c` verdes, Desktop E2E registrado pela última vez em `e8e834a`; o run fantasma de 14 falhas em background foi substituído e não conta como evidência). **Sem merge, sem release, sem promoção de maturidade.**

**Bloqueio.** Nenhum técnico externo. Ficam abertos o passo 2 (CI por SHA publicado), o passo 4 (reconfirmação dos offsets do TiledImage HAMOOPIG) e o passo 5 (fluxo pelo produto com replay do desempacotador do jogo). Promover a célula APLIB da matriz continua decisão do operador.

### CHECKPOINT operacional (2026-09-27 — frente do integrador: passo 5 fechado, as quatro pernas do recurso aPLib real na mesa)

Branch `codex/rex-integrator-aplib-decode`. HEAD deste checkpoint: `8f2f3f1`, sobre `ce6ed3c` (cenário WebDriver) e `7c65cd5` (varredura de capacidade), que fecham o passo 5 aberto em `94bfa81` (pernas 1 e 3: `5880a22`, `d43fdde`). Alterações não commitadas ao redigir esta entrada: o pacote de evidência `data/rex_profiles/integrator/aplib/evidence/2026-09-27-passo5-perna2-barra/`, esta célula e a célula correspondente em `docs/rex_profiles/ROUND_STATE.md`. Os não rastreados preexistentes (`.mimosa/`, `APJ-unpack`, `a.out`, `apultra-decode`, `data/canonical-local-2026-09-21/`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/`, `scripts/rex_profiles/integrator/aplib/__pycache__/`) permanecem intocados — nada alheio foi apagado nem staged; o corpus continua somente-leitura e fora do versionamento.

**Hipótese da rodada.** O fluxo de edição de um recurso comprimido real, conduzido pela frente do produto (não por chamada Rust direta), produz bytes que o desempacotador do próprio jogo executa com efeito de tela previsível. Previa duas coisas: (a) a barra é capaz de expressar uma edição que caiba no slot comprovado, e (b) a edição-alvo das pernas 1 e 3 — índice 0, transparente — servia de pino também para a barra.

**A hipótese (b) era falsa, e a barra a refutou antes de qualquer implementação.** O `#[ignore]` da perna 1 morria em `excessive_output` para **todos** os índices 1..15 no pixel `(53,0,4)`. A causa não é o codec: `CompressedResourcePanel.tsx:273` faz `setPaintIndex(Number(event.target.value) || 1)`, então digitar 0 escreve `"1"` no campo antes de `editRejectReason` (linhas 40-42), que reserva 0 como transparente. Medido no navegador: o `value` do DOM após digitar 0 é `"1"`, e o desfecho é byte a byte o do índice 1 explícito (942 B alegados contra 938 B de orçamento), enquanto o índice 0 real custou 937 B nas pernas 1 e 3. **Registrado com asserções que o vigiam, não corrigido** — alterar a semântica de paleta da UI é decisão do operador, e o cenário agora falha se a UI passar a expressar o 0 ou se o clamp mudar de valor.

**Evidência a favor (o alvo foi escolhido por medida, não por opinião).** `7c65cd5` varre os **4** recursos aPLib da ROM com o codificador do produto (75 325 ms, 10 770 tentativas): `0x2e4d4` e `0x2f65a` não aceitam nenhuma edição de 1 pixel que a barra expresse, e mesmo contando o índice 0 o piso passa do slot (4 540 > 4 485; 7 439 > 7 420) — a barra não os edita em nenhuma circunstância. Restam `0x2e12a` (folga 1 B) e `0x2cd94` (folga 0). Dentro de `0x2e12a`, o tile 53 tem exatamente dois pares cabíveis, ambos a 938 B (o teto), e essa lista está pinada no teste do lib. Perna 2 (`ce6ed3c`, cenário `rex-aplib-byor-effect`): `rexResourceList` → `rexResourcePreview` → `rexResourceApplyEdit` (no-op e edição) → reabertura da cópia; cópia `80249128…` com hash anunciado == SHA no disco, 917 504 B (sem expansão), **800** bytes distintos todos dentro de `[0x2e12a, +938)`, **0** fora do slot, **163** preservados, BPS `58ae4f0b…` reaplicado sobre ROM íntegra reproduzindo a cópia, guarda anti-descarte exercida (linha 8 → aviso + fila vazia asserida). Verde duas rodadas, ambos os relatórios no pacote, 62 campos idênticos e um único divergente (texto livre que editei entre as corridas). Perna 4 (`8f2f3f1`): o teste refaz a chamada com os campos da barra, **obriga** o hash `80249128…` e então emula três corridas frescas sob Genesis Plus GX v1.7.4 `46a5521`; coordenadas previstas antes de executar e observadas iguais (`[[213,207],[285,135]]`), **232** pixels em **116** frames, 2 por frame, determinismo base-vs-base **0**, **0** fora dos retângulos das células, e a janela ancorada em evidencia anterior a esta frente (frames 59/69/129/179 batem byte a byte com `rex-evidence-2026-09-10/backend-hamoopig/checkpoint-rgba-hashes.json`).

**Evidência contra / ainda não alegado.** (1) A diferença 119/238 (perna 3) contra 116/232 (perna 4) é real, não atribuída a mecanismo nenhum, e registrada como limite da medição, não resolvida por redação. (2) O `#[ignore]` da perna 4 usa o core do harness da lib, não o app distribuído. (3) BYOR não é dependência provisionável: cenário e os dois aceites não rodam no CI, então o que o CI cobre aqui é o contrato, não esta ROM. (4) Uma edição de 1 pixel de 1 recurso de 1 ROM não prova os outros 3 recursos nem o resto do jogo nem hardware real. (5) O relatório da perna 2 declara em seus próprios limites que o efeito em tela daquela edição não fora executado no core; isso continua verdadeiro para o artefato isolado e só se fecha lendo o pacote inteiro. (6) A linha aPLib da matriz **não foi promovida**: a condição declarada do bloqueio foi alcançada, mas promoção de maturidade é vetada pela ordem do operador.

**Últimos comandos e resultados (árvore final, em `8f2f3f1`).** `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` → rc=0. `cargo clippy --lib -- -D warnings` → rc=0. `cargo test --lib -- --nocapture` → **706 passed; 0 failed; 63 ignored**. `cargo test --lib rex06_hamoopig_aplib -- --ignored --nocapture` → 1 passed, 12,24 s. Varredura `--ignored` → 1 passed, 75,43 s. `npm run check:tree` / `npm run lint` / `npx tsc --noEmit` → rc=0. `npm test` → **702 passed; 0 failed; 6 skipped (708)**; os 6 skips reconciliados um a um no manifesto (4 guardas de toolchain em `scripts/decomp/decomp-scripts.test.mjs`, 2 `describe` só-win32 em `src/core/validateUpstreamWindows.test.ts`), e o invariante entre pinos é 702/0. `npm run host:certify` → READY (fingerprint `60249508…`). O log de gates promovido é o da árvore final: um log anterior tinha `cargo fmt --check` rc=1 e foi descartado, com rex06 reexecutado depois do fmt (run `1790493156`) para que o hash do binário bater com o commit. Jobs pesados um por vez, nenhum em background, nenhum processo alheio morto.

**Push e CI registrados por SHA.** `git fetch` + `git push origin codex/rex-integrator-aplib-decode` → fast-forward `94bfa81..f633e07` (0 atrás, 4 à frente). Consulta **pontual**, sem monitor permanente, no SHA publicado `f633e07dbb6bf4ad67ce3f4d829df626bdd069c9`: workflow `CI` → **success** (`validate`, `linux-validate`); workflow `Desktop E2E` → **success** (`desktop-smoke`); run ids `36303792634` / `36303792614`. Isso fecha o passo 2 e o passo 7 do briefing. O que esse verde **não** cobre: os dois aceites `#[ignore]` e o cenário `rex-aplib-byor-effect`, que consomem BYOR — BYOR não é dependência provisionável, então o CI atesta o contrato, não esta ROM.

**Bloqueio.** Nenhum técnico; nenhum item do briefing desta frente fica aberto. Três decisões ficam com o operador: (a) promover — ou não — a célula APLIB da matriz tendo as quatro pernas do passo 5 na mesa; (b) decidir a semântica do índice 0 na UI (o achado está vigiado por asserções, não corrigido); (c) autorizar qualquer frente que dependa de rodar BYOR no CI, o que por política não é provisionável. **Sem merge, sem release, sem promoção de maturidade.**

### CHECKPOINT operacional (2026-09-27 — frente do integrador: entregas 1, 2 e 3 do briefing; o índice 0 deixou de ser achado)

Branch `codex/rex-integrator-aplib-decode`. HEAD desta célula: ver `git log` — os commits do trabalho são `794033e` (entrega 1, registro da matriz), `af5d5d0` (conserto na UI), `d769629` (pino do índice 0 no codec + varredura no domínio real da barra), `eae825a` (regressões no cenário WebDriver) e `ad3ff57` (durações por aplicação e espera de prévia assentada), sobre `19c880f`/`f633e07` (passo 5). Nada alheio foi staged ou apagado: `.mimosa/`, `APJ-unpack`, `a.out`, `apultra-decode`, `data/canonical-local-2026-09-21/`, `scripts/rex_profiles/integrator/aplib/__pycache__/`, `src-tauri/.mimosa/`, `src-tauri/src-tauri/` seguem não rastreados e intocados; o corpus continua somente-leitura e fora do versionamento.

**Ordem recebida e o que ela decidiu.** Três entregas delimitadas, sem novo GO intermediário: (1) corrigir o estado documental — separar capacidade técnica de maturidade, sem deixar `blocked por decisão de missão` onde o critério foi atendido, preservando histórico; (2) corrigir o índice 0 — "o campo atual usa `min=1` e `Number(value) || 1`, transformando 0 em 1; o índice 0 pertence ao domínio 4bpp e deve ser representável", com tratamento explícito de vazio/decimal/negativo/NaN/acima de 15 e sem substituição silenciosa de entrada inválida por outra cor, e as asserções que preservavam o defeito substituídas por regressões; (3) validar e publicar, reconfirmando espaço e hashes em vez de copiar números antigos. **A decisão (b) do checkpoint anterior ("decidir a semântica do índice 0 na UI") foi executada pela ordem expressa da entrega 2 e sai da lista de pendências do operador.** Seguem com o operador: (a) promover ou não a célula APLIB da matriz e (c) autorizar qualquer frente que dependa de rodar BYOR no CI.

**Semântica, escrita para não ser confundida.** O campo é índice de paleta do **pixel** no 4bpp: domínio `0..15`, e o 0 é o índice que o VDP lê como transparente no plano de tiles. Editar o índice de um pixel **não** edita a cor RGB de nenhuma entrada da paleta — isso é outra superfície, que este painel não toca. A frase está no cabeçalho do painel e em cada queixa de índice inválido.

**O conserto.** `CompressedResourcePanel.tsx` passou a guardar o **texto** do campo (`useState("1")`) e a validá-lo em `paintIndexRejectReason` por forma (vazio, não número, não inteiro, fora de 0..15 — cada uma com queixa própria terminando em "A fila atual foi preservada"); `editRejectReason` aceita agora inteiro em `[0, 16)`; pintura por clique e botão compartilham o mesmo `queuePaint`. A guarda definitiva continua no núcleo, inalterada. Quatro testes novos no arquivo do painel (que passa a ter 10): "digitar índice 0 mantém 0 no campo e a transação recebe índice 0", "entrada de índice inválida diz o motivo e não entra na fila no lugar de outra cor", "pintura por clique usa o índice do campo, inclusive 0, e recusa campo inválido", "índice 0 sobrevive a desfazer (re-editar o pixel), reabrir o recurso e ao no-op". No lib, o pino `indice_0_e_do_dominio_4bpp_ate_o_stream_aplib` confere o bit a bit: `0x5A → 0x0A` no nibble baixo (coluna par), `0xA5 → 0xA0` no alto (coluna ímpar), vizinhos intactos, e o índice 0 sobrevivendo a re-codificação + decode sobre o plain autoral.

**Números re-medidos, não copiados.** Aplicando a edição pinada das pernas 1 e 3 (tile 53, linha 0, coluna 4, índice 5 → **0**) com o encoder atual: **937 B** escritos no slot de **938 B** (folga 1 B), cópia `69389ec2b400220c7a069e4c36326ca3c26d81e85ff0ab81bf798dc9ae4038ac`, BPS `8bf6d3df…` de **853 B**, **781** posições do slot diferentes, prévias `a6a4b603…` → `227a4c2f…`, 164 recursos verificados. Log durável: `.../cargo-sweep-ignorado-final.log` (7 passed, 0 failed, `--ignored`).

**Varredura re-ancorada (`rex-aplib-capacidade-da-barra/v2`, 82 466 ms, 10 740 tentativas).** Ela media 1..15 e deixou de descrever a interface; agora mede os dois domínios lado a lado. `0x2e12a`: piso 932 B (barra, 0..15) vs 934 B (sem o 0), cabíveis **1 694** vs **1 619** — o índice 0 abre **+75** edições de 1 pixel. `0x2cd94`: 78 vs 77 (**+1**). `0x2e4d4` (piso 4 540 > slot 4 485) e `0x2f65a` (7 439 > 7 420): **0** nos dois domínios — para esses dois o conserto da UI não muda nada. Total de edições cabíveis com índice 0: **76**. Higiene de medição corrigida nesta célula: o tile 53 entrava duas vezes na lista de alvos (varredura completa de 64 pixels + amostra genérica `(0,0)`/`(0,4)` por tile), o que contava uma edição em dobro; com `sort_unstable + dedup` as tentativas caem 10 770 → **10 740** (−30 = 2 pixels duplicados × 15 índices) e os cabíveis de `0x2e12a` 1 695 → **1 694** — o único par duplicado que cabia era justamente o do índice 0. A lista pinada do tile 53 passou a `[[0,4,937],[7,5,938],[7,7,938]]`, com `pin_cabiveis == vec![0]` e o cruzamento `cabiveis_sem_indice_0 ==` contagem das entradas com índice ≥ 1 asseridos no teste.

**Prova de UI reexecutada — quatro corridas, registradas como aconteceram.** Cenário `rex-aplib-byor-effect`, schema `v2`. (1) 10:34Z, após build: falha no WebDriver em `setPanelInput("rex-resource-paint-index", …)` com "o setter de HTMLInputElement.value só aceita instância de HTMLInputElement" — em WebKit é o que ocorre quando o elemento não está lá; a espera do harness era por `rex-resource-canvas`, e o painel desmonta prévia **e** campo juntos ao começar a re-decodagem, então a sondagem podia ver o canvas do estado anterior e passar cedo. (2) 10:45Z, mesmo binário, com `selectResource` esperando a condição assentada (campo de índice montado **e** botão aplicar habilitado, i.e. `busy === false`): **verde**, 23 passos. (3) 10:52Z, **build completo novo**: passou 5a, **5b** (o índice 0) e os 14 índices de 6a, e morreu no orçamento de 60 s do desfecho em §6b com a edição na fila e sem erro no painel. (4) 10:58Z, mesmo binário da (3) e orçamento medido: **verde, rc=0**, com `aplicacoes_ms = [7621, 272..327 ×14, 7400]`. O alvo prévio das pernas 2/4 foi preservado como regressão (§6b, 5→4 em `(53,7,5)`): cópia `80249128…`, BPS `58ae4f0b…` reaplicado sobre base íntegra reproduzindo a cópia, 800 bytes distintos, 0 fora de `[0x2e12a, +938)`, 163 preservados. **Achado aberto, honesto:** a corrida (3) estourou 60 s num passo que custa ~7,4 s cronometrados — não foi lentidão sistemática, e a causa daquele travamento único **não foi estabelecida**; o que mudou desde então é diagnóstico (duração por aplicação no relatório, orçamento 180 s, marcadores de passo, `setPanelInput` reportando os testids presentes), não produto.

**Efeito em tela.** A perna 3 já executou a cópia `69389ec2…` no desempacotador do próprio jogo (`rex05`: 2 pixels por frame, **119** frames, coordenadas `[[212,200],[284,128]]`, primeiro frame 59) e a perna 4 executou a cópia da barra `80249128…` (`rex06`: **232** pixels em **116** frames, exatamente as posições previstas `[[213,207],[285,135]]`); os dois testes `--ignored` foram reexecutados hoje às 10:29Z (07:29 local) com o código atual e os relatórios estão no pacote; os dois registram `core.sha256 = 07c10476…`, o mesmo `core_sob_teste` do manifesto, e o vínculo com o binário de teste que os produziu (`app_lib-716403bf8cac2e87`) vive no manifesto e nos logs de `--ignored` — o relatório `rex05` em si não imprime esse caminho, o que fica declarado como limite do pacote. O que a entrega 2 fecha é a **identidade**: a barra produz byte a byte o artefato que o núcleo rodou — a asserção do hash da cópia em disco está no cenário, não só na narrativa.

**Gates.** `npm run check:tree` rc=0 · `npm run lint` rc=0 · `npx tsc --noEmit` rc=0 · `npm test` → **706 passed, 0 failed, 6 skipped** (invariante anterior 702; **+4** = as quatro regressões do painel) · `cargo fmt -- --check` rc=0 · `cargo clippy -- -D warnings` rc=0 · `cd src-tauri && cargo test --lib -- --nocapture` → **707 passed, 0 failed, 63 ignored** (invariante anterior 706; **+1** = o pino do índice 0). Distinção que aprendi a registrar ao corrigir uma invoco errada: `src-tauri/.cargo/config.toml` fixa `target-dir = "target-test"` **relativo ao diretório de invocação**, então `cd src-tauri && cargo …` cai em `src-tauri/target-test` enquanto a forma da raiz (`cargo … --manifest-path src-tauri/Cargo.toml`) cai em `src-tauri/target` — medido com `cargo metadata` nos dois diretórios. O log que carrega os 707 testes mostra `target-test/debug/deps/app_lib-716403bf8cac2e87`, o binário amarrado no manifesto como `harness_de_teste`, de modo que essa corrida é a de `src-tauri`; os logs de `fmt` e `clippy` não imprimem caminho, então a forma exata dessas duas invocações não é decidível pela evidência (o que muda é o diretório de alvo, não o veredito). O `rc=101` no meio da série foi erro de invoco meu: `cargo` rodado na raiz, sem `--manifest-path` ("could not find Cargo.toml"); reexecutei e os números acima são das corridas corretas.

**Evidência promovida.** `data/rex_profiles/integrator/aplib/evidence/2026-09-27-entrega2-indice-0-na-barra/` com `manifest.json` amarrando por SHA-256: binário sob teste `d192fd51…` (build da corrida 3, exercitado nas corridas 3 e 4), core Genesis Plus GX v1.7.4 `46a5521` `07c10476…`, ROM `558bea6c…`, cópias `69389ec2…`/`80249128…`, BPS `8bf6d3df…`(853 B)/`58ae4f0b…`(739 B), os dois relatórios verdes do WebDriver, os dois logs de falha, o JSON v2 da varredura, os relatórios `rex05`/`rex06` e os logs de gates. **ROM e capturas derivadas não são versionadas** — só hashes.

**Limites que continuam sendo parte da alegação.** Um dos 4 recursos aPLib de uma ROM BYOR; os dois recursos ineditáveis em 1 pixel nos dois domínios; execução sob core de harness, não hardware nem app distribuído; BYOR não roda no CI, então o CI atesta o contrato e não esta ROM; "editável" não é "compreendido" — a classe do alvo segue desconhecida. **Maturidade:** nada promovido; o produto continua `Experimental` (a UI o declara no cabeçalho do painel). **Sem merge, sem release, sem promoção de maturidade.**

**Push e CI registrados por SHA.** `git fetch` + `git push origin codex/rex-integrator-aplib-decode` → fast-forward `19c880f..9a4335f` (0 atrás, 6 à frente). Consulta **pontual**, no SHA publicado `9a4335f72bf0f463faa23cdfdd5db45059c71983`: workflow `CI` → **success** (`validate`, `linux-validate`), run `36315702049`; workflow `Desktop E2E` → **success** (`desktop-smoke`), run `36315702070`. O que esse verde **não** cobre continua sendo os aceites `#[ignore]` e o cenário `rex-aplib-byor-effect`, que consomem BYOR: BYOR não é dependência provisionável, então o CI atesta o contrato, não esta ROM. `npm run host:certify` foi executado antes do push (rc=0, `READY`, digital `60249508…`, log promovido no pacote). Este parágrafo foi escrito no commit só de texto `3326228`, que à época ficou sem consulta própria (precedente: `19c880f`, run `36305001760`).

**Consulta pontual do HEAD final `9e63adc` (revisão de 2026-09-27, a pedido do operador).** Push `9a4335f..9e63adc` (2 commits só de texto). `GET /repos/Misael-art/RetroDevStudio/commits/9e63adcc…/check-runs` → `validate` **completed/success** (job `108614432239`, 20m56s) e `linux-validate` **completed/success** (job `108614432149`, 12m40s); run `36317340061`, encerrado às 12:17:25Z. `Desktop E2E` não existe nesse SHA por filtro de caminhos do workflow (`.github/workflows/desktop-e2e.yml`: `src/**`, `src-tauri/**`, `scripts/e2e-tauri-build-run.mjs`, `scripts/build.mjs`, `package*.json`) — `9e63adc` tocou só os dois documentos e o `manifest.json` do pacote; ausência explicada, não lida como PASS nem como falha. **Regra terminal:** o CI da rodada para de ser consultado aqui — o commit que registra esta célula é só texto e não recebe consulta própria, sob pena de uma consulta por commit de registro ao infinito. Nenhum observador ficou de pé (o `gh run watch` desta sessão terminou sozinho; `ps` não retorna `gh run` vivo).

### CHECKPOINT operacional (2026-09-27 — frente do integrador: a edição contextual do recurso aPLib fecha pela **interface**, com dois defeitos reais achados por ela; Experimental; sem merge, sem release, sem promoção)

**Frente e HEAD.** Branch `codex/rex-context-aplib-tilemap`, base canônica
`/home/misael/Projects/RetroDevStudio-CANONICAL-2026-09-21`. A célula é a prova pelo
produto dos itens 1 a 4 do briefing do operador; os quatro commits que montaram a
superfície já estavam publicados (`c731485` fixture autoral com esperado **antes**
de compilar, `b9cbe8e` modelo de contexto no núcleo, `560347e` IPC somente leitura,
`896a372` UI contextual). Desta célula: `e44f39d` (núcleo), `16ce6bf` (UI) e
`7e10944` (cenário E2E `rex-context-fixture-effect`). **Ordem recebida que guiou o
fechamento:** "O próximo resultado visível deve ser uma edição contextual
utilizável, não apenas outro relatório do backend" + "Não aceite coordenadas,
dimensões ou offsets da UI como autoridade" + "Depois execute o caso BYOR já
comprovado, distinguindo camada reconstruída de framebuffer completo".

**O que passou a existir de fato (medido no WebView, não no núcleo).** Binário
`f56be4517058e38c…` (18:51:20-03:00 = 21:51:20Z; nenhum fonte do produto é mais
novo — `find … -newer <binario>` vazio), cenário rc=0 com 17 passos e 15 638 ms:
a barra descobre o TileSet sozinha (`0x5fa38 — aplib · 16 tiles (stream 169 B)`),
monta contexto com identidade + vínculos + proveniência por vínculo, e a **camada
composta lida do `<img>`** é igual ao esperado do oráculo externo no empacotamento
certo (RGB `7dc94b02…`; alpha provado à parte, 0 divergências RGBA). Os quatro
cliques sob `B`/`H`/nenhum/`V` convergem no **mesmo** pixel de fonte
(`tile 2, linha 4, coluna 7`, índice atual 11) e a barra diz
`4 ocorrências neste mapa verificado`, nomeando o TileMap. Uma edição (11→3) pela
transação canônica altera **exatamente** as quatro posições previstas, 129 bytes,
**0** fora de `[0x5fa38, +169)`, com o único byte do tileset em `0x5fa57`; cópia
`1d6da6d9…`, BPS `2fafda41…` reaplicado reproduzindo o hash da cópia; salvar/reabrir
restaura com identidade **revalidada**. Escala de página 0,75 e clique fora da
camada também assidos.

**Os dois defeitos reais que a interface achou — e que o núcleo não veria.**
(1) **Zoom pedido ≠ zoom desenhado**: o preflight `img { max-width: 100% }` com o
envolucro de flex encolhendo por padrão achatava **só a largura** — 4x de uma camada
120x72 desenhava `193,66x288` px, o pixel deixava de ser quadrado, `image-rendering:
pixelated` perdia o efeito e o mapa ponteiro→pixel da frente passava a corresponder
a outra imagem. Correção `16ce6bf`: `maxWidth: none` nas duas prévias, `shrink-0` no
envolucro dimensionado e trilho `overflow-x-auto` (rolar em vez de comprimir).
(2) **Identidade conferida depois da varredura**: com outro arquivo no caminho, a
transação varria os 205 candidatos (512 KB) e a recusa saía como "recurso não
verificado nesta ROM" depois de >60 s — o **sintoma** descrevendo a cena e escondendo
a **causa**, e o E2E estourando o timeout sem nenhuma superfície de erro. Correção
`e44f39d`: a identidade abre a sequência, o custo da recusa volta a ser um hash, e a
mensagem diz `nada foi varrido e nada foi escrito`. Em ambos os casos o teste foi
escrito e observado **falhando antes** (no de identidade, o primeiro rascunho passou
de imediato e não era RED; ficou discriminante ao usar `stream_offset` de **outra**
ROM, que morria em "recurso 0x109 não verificado nesta ROM"). O E2E agora **assere**
a recusa em ≤1,5 s em vez de só observar.

**Erro meu registrado com log.** A primeira versão desta perna cobrava na barra o
`data_size` do `symbol.txt` (170 B) — mas o símbolo dá o **array linkado**, com byte
de padding; o que a barra anuncia é o **consumo medido** pelo decode (169 B), que é o
que o oráculo `apj.jar` re-empacota. O cenário passou a ler `external-verify.json`
(exigindo `independente_do_produto === true`, SHA do jar, ROM e o `pixels_sha256` da
camada), a cobrar `medido <= array` e a conferir a cauda como zero, registrando
`preenchimento_nonzero`. Logs das três corridas falhas (run2 slot, run3 zoom, run4
identidade) estão versionados no pacote junto da verde.

**Caso BYOR reexecutado (o binário mudou, então a evidência antiga estava
invalidada).** `rex-aplib-byor-effect` rc=0, 0 linhas de ERRO: cópia `80249128…`,
BPS `58ae4f0b…` reaplicado sobre base íntegra, 800 bytes distintos, **0** fora de
`[0x2e12a, +938)`, 163 recursos preservados, 14 edições recusadas por
`excessive_output` e o índice 0 produzindo a cópia `69389ec2…` que a perna 3 já
tinha executado no core — **idêntico aos pinos publicados** antes desta célula. A
perna 14 do cenário contextual abre o BYOR pelo produto e **declara** a prévia como
camada reconstruída (`1018 ocorrências neste mapa verificado`, TileMap `0x21b28` de
1120 células), mantendo as oclusões não modeladas explícitas na barra: camada ≠
framebuffer.

**Negativos e atribuição honesta.** Seis obrigatórios: quatro alcançados e asseridos
pela UI (ghost sem vínculo, tile fora do conjunto, identidade trocada na leitura e na
escrita, resposta obsoleta no mesmo tick, descarte por troca de ROM, clique fora da
camada). Dois são **inalcançáveis por construção** nesta fixture — a referência
inválida e o banco sem cores vivem em `ctx_ghost`, que o linker deixou **sem** struct
`Image`, então não há como a UI chegar lá; ficam provados no núcleo por
`composicao_recusa_referencia_fora_do_tileset_em_vez_de_pintar_ruido` e
`composicao_recusa_banco_que_a_paleta_nao_tem_cores`, e a matriz registra a atribuição
em vez de inflar a prova de interface.

**Gates e host (logs no pacote).** `npm run host:certify` rc=0 — `READY`,
fingerprint `60249508…`, lock `dd99a22f…`, incluindo `check:tree` OK, `lint` OK e
**737** testes de frente (3 skipped) — e `cargo test --lib -- --nocapture
--test-threads=1` **737 passed / 0 failed / 66 ignored** em 104,30 s. Fora do
certify: `cargo fmt --check` OK, `cargo clippy -- -D warnings` limpo,
`npx tsc --noEmit` OK, harness com `node --check` + eslint limpos. Um job pesado por
vez, serializado (E2E fixture → E2E BYOR → certify → fmt/tsc/clippy); nenhum
observador de CI ficou de pé. **Invocação que errei e consertei no meio:** `cargo
clippy` na raiz do repositório falha com "could not find Cargo.toml" — a barra do
projeto é rodar de `src-tauri` (`.cargo/config.toml` fixa `target-dir = target-test`
relativo ao diretório de invocação).

**Limites que continuam sendo parte da alegação.** A frente continua `Experimental`
e a UI declara isso. "Verificada" nomeia o que foi conferido (ponteiro do struct
`Image`, decode com tamanho exato, round-trip pelo oráculo externo) e **não** prova
que o jogo carrega ou exibe o recurso. Não existe controle de "editar só esta
ocorrência": sem duplicação e realocação de tile isso seria destrutivo. Contagem de
ocorrências é **por mapa verificado**, nunca do jogo inteiro. Prioridade (bit 15) é
conferida na palavra da célula mas não entra na composição esperada. O perfil vale
para o toolchain pinado (rescomp `502a4670…`, apj `2d8cdc63…`, libmd `ef904a37…`) e
para os recursos demonstrados. BYOR não é dependência provisionável: os dois
cenários consomem ROM local explícita e não rodam no CI — o CI atesta o contrato, não
esta ROM. **Sem merge, sem release, sem promoção de maturidade.**

**Evidência promovida.** `data/rex_profiles/integrator/context_fixture/evidence/2026-09-27-interface/`
com `manifest.json` amarrando por SHA-256: binário sob teste `f56be451…`, ROM
autoral `705b72eb…` (393 216 B, **não** versionada — refaz pelo README do fixture),
ROM BYOR `558bea6c…` (só hash), oráculo externo `apj.jar` `2d8cdc63…`, as três
receitas autorais (ground truth pré-compilação, `fixture-build-report.json`,
`external-verify.json`), o relatório verde do WebDriver (`3778e45e…`), os três logs
de falha que produziram as correções, o relatório da reexecução BYOR (`ea14fd21…`) e
os logs de gates/certify. O bloco `gates.shas_de_todos_os_artefatos_promovidos` do
manifesto amarra **os 12 arquivos versionados do pacote** por SHA-256 (re-conferidos por
`sha256sum` às 22:24Z; o manifesto não hashia a si mesmo). **Sem merge e sem release: HEAD
desta célula fica na branch da frente.**

**Gates desta célula (medidos, não copiados).** `npm run check:tree` rc=0 **depois** de
criar o diretório de evidência (o `host:certify` rodou antes de
`data/rex_profiles/integrator/context_fixture/` existir, então a conferência de árvore foi
repetida de propósito às 22:23:37Z e o resultado foi **acrescentado ao log promovido**, com
rc medido do processo do npm e não de um pipe — a primeira versão media o `grep`) ·
`npx tsc --noEmit` rc=0 · `npm test` **737 passed, 3 skipped** · `cargo fmt -- --check`
rc=0 · `cargo clippy -- -D warnings` rc=0 (a barra do projeto roda clippy **de
`src-tauri`**: `src-tauri/.cargo/config.toml` fixa `target-dir = "target-test"` relativo ao
diretório de invocação, e rodar na raiz dá "could not find Cargo.toml") · `cargo test --lib`
**737 passed, 0 failed, 66 ignored** (104,30 s) · `node --check` e eslint do harness
`scripts/e2e-tauri-build-run.mjs`, ambos limpos · `npm run host:certify` rc=0, `READY`,
digital `60249508…`. Onde cada número mora, para não pedir confiança: no
`host-certify-2026-09-27.log`, `npm test` está na linha 1450, `cargo test --lib` na 2335 e
`READY`/fingerprint nas 2342/2344; no `gates-rust-ts-2026-09-27.log`, fmt na 2, clippy na 4,
tsc na 8 e `check:tree` nas 9–11. Execução serializada, um job pesado por vez.

**Push e CI registrados por SHA.** Push `896a372..7e10944` (fast-forward, 3 commits:
`e44f39d` núcleo, `16ce6bf` UI, `7e10944` cenário) → runs criados às **22:10:22Z**:
`CI` `36354347243` e `Desktop E2E` `36354347306`. Consulta **pontual** nos SHAs relevantes:
`b9cbe8e` → `validate`/`linux-validate`/`desktop-smoke` **completed/success**; `896a372` →
idem, **success**; `560347e` → **zero check runs** (o commit entrou no push cujo tip era
outro; ausência explicada pelo comportamento do GitHub em pushes em lote, **não** lida como
PASS nem como falha); `7e10944` → **`in_progress` nas duas consultas feitas nesta célula**
(a última às 22:21:29Z): o veredito não estava disponível no momento do registro, então
consta como **não estabelecido**, não como verde. **Regra terminal aplicada
(precedente `19c880f`):** nenhum monitor de CI ficou de pé e a conclusão dessa execução é
reportada **fora** do repositório — criar um commit só para registrar o veredito geraria
uma consulta por commit de registro, ao infinito. O commit que contém este parágrafo é só
de texto (docs + evidência) e não recebe consulta própria. O que o CI cobre aqui é o
contrato: os dois cenários consomem ROM local explícita e não rodam no CI.

### CHECKPOINT operacional (2026-09-28 — frente do integrador: `crates/` formalizado na árvore e duas bibliotecas standalone integradas uma por vez; nenhuma delas alegada ao produto; sem merge, sem release, sem promoção)

**Frente e HEAD.** Branch própria `codex/rex-integrator-crates-registry` sobre a
base canônica `9b27941` (que é o HEAD da rodada contextual de 2026-09-27). A rodada
anterior tinha deixado as duas suítes (agente A de endereçamento, agente B de
codecs) **fora** deste tronco; o operador mandou mudar isso no modo certo: cada
frente continua no seu módulo e na sua evidência, e o integrador fica com as
superfícies compartilhadas. **Ordem recebida:** "Reserve para si manifests
compartilhados, registro de módulos, IPC, UI, harness principal e documentos de
estado. Integre uma entrega por vez; não espere a conclusão das duas para começar a
revisão. Formalize crates/ nas convenções do projeto, preservando a finalidade de
check:tree", e a decisão em sete itens que fixou: `crates/` é a
localização **oficial** das bibliotecas Rust independentes com gates próprios;
integração ao aplicativo é etapa **posterior**, depois da revisão de cada biblioteca;
proibido criar `Cargo.toml` de workspace na raiz só para fazê-las compilar; a gate de
árvore não pode virar caixa livre ("não permita qualquer diretório
indiscriminadamente"); pacote esperado ausente **reprova**; "não registre 'integrado
ao produto' só porque o pacote compila"; e a matriz precisa diferenciar
`biblioteca implementada → gates próprios aprovados → backend integrado → fluxo do
usuário comprovado`.

**O que passou a existir (cinco superfícies, todas do integrador).** (1)
`docs/08_TREE_ARCHITECTURE.md` declara `crates/<nome>/` mais `crates/registry.json` e
`crates/README.md`, com regras de inserção explícitas. (2) `scripts/check-tree.cjs` e
o espelho `scripts/check-tree.ps1` aceitam `crates/` **sob condição de registro**:
diretório não registrado reprova, registro sem `Cargo.toml` reprova, arquivo solto
que não seja registro/README reprova, e o resto da verificação de primeiro nível
permanece. Um dos sete testes novos (`scripts/check-tree-crates.test.mjs`) exige
que as duas implementações aceitem o **mesmo** conjunto de diretórios — a gate
espelhada não pode divergir silenciosamente. (3) `crates/registry.json`, schema
`rex-crate-registry/v1`, é a fonte única da lista; `crates/README.md` registra os
três comandos, os quatro degraus e a frase-operativa "compilar não significa
integrado". (4) `scripts/crates-gates.mjs` + `npm run crates:gates` emitem, por
pacote registrado e na ordem pedida, `cargo fmt --manifest-path <m> -- --check`,
`cargo clippy --manifest-path <m> --all-targets -- -D warnings` e
`cargo test --manifest-path <m> --locked`, com `CARGO_TARGET_DIR` fora da árvore
rastreada e rc=1 para registro ausente/schema errado/pacote sem manifesto. (5) CI:
passo *Crate package gates* nos dois jobs de `.github/workflows/ci.yml`, com
`outcome` na janela de resumo; como os dois jobs rodam em todo push/PR, a ativação
dos gates não exigiu afrouxar filtro de caminho nenhum.

**Não-vacuidade provada, não alegada.** A regra "pacote declarado sem manifesto
reprova" foi mutada temporariamente (`if (false && fs.existsSync(...))`) e caíram
**exatamente** os dois testes que a cobrem; revertido, o suíte voltou a verde. O
mesmo critério vale para o gate de árvore: os testes afirmam sobre a saída do
script numa árvore falsa via `RDS_CHECK_TREE_ROOT`/`RDS_CRATES_ROOT`, e a
existência desse gancho de ambiente está documentada como suporte a teste, não como
comportamento do produto.

**Integração da B (primeira, sozinha).** `3fea06e` + `1af7017` (PR #81, pino revisto
`0b752b7`) entraram por `cherry-pick -x` como `crates/rex-kosinski`, sem merge de
branch e sem tocar a branch da agente. Gates medidos 2026-09-28T02:48Z: fmt OK,
clippy `--all-targets -D warnings` OK, `test --locked` **25 executados / 0 falhas / 0
ignorados** (22 contract + 3 mutations) — a mensagem do commit anuncia 24, registro o
número medido. **A primeira corrida falhou** e a causa não era do pacote: 15 de 25
testes com "fixture golden/…: No such file or directory", porque o crate lê fixtures
por `CARGO_MANIFEST_DIR + ../../data/rex_profiles/codec/kosinski` e esse perfil só
existia na outra linha de branch da B. Fechei como integrador: importei os dados e os
scripts geradores no **mesmo pino**, conferi as 27 linhas de `manifest.tsv` (0
divergências de SHA) e reproduzi o hash agregado `ea866df7…`. **Não reescrevi o teste
de outra agente.** Devolvido à B como trabalho dela: vendorizar as fixtures dentro do
crate (ou receber o caminho por variável de ambiente) para o pacote ser relocável, e
acrescentar a metadata `license` que falta. Ficaram fora desta entrega — e isso está
no registro, não escondido: o contrato v1 do **encoder** (`0b752b7`) e o WIP não
commitado `src/encode.rs`.

**Integração da A (segunda, separada).** Os 17 commits do intervalo
`9b27941..57e51d3` (PR #82) entraram por `cherry-pick -x`, zero conflitos, e o
`git mv` de `scripts/rex_profiles/addressing_runtime/rex-addressing` para
`crates/rex-addressing` executou exatamente o "passo 2" que o `CONTRATO.md` do próprio
perfil apontava como pendente do integrador; a seção "Por que está aquí e non en
`crates/`" do README do pacote foi substituída pela localização atual, e a resolução
do integrador entrou no contrato **como adenda datada** — evidência histórica não se
reescreve. Gates medidos 2026-09-28T02:58Z já na localização nova: fmt OK, clippy OK,
`test --locked` **81 executados / 0 falhas / 9 ignorados** (77 em 10 targets + 4
doc-tests). Os 9 ignorados são os 8 BYOR e o preimage exaustivo, então o gate
ordinário do pacote não depende de ROM comercial — requisito do item 4 da ordem.
Diferença medida e registrada: o README do pacote anuncia 72 testes, a suíte
integrada executa 77. Devolvido à A: os 15 `.expect()` de produção não têm varredura
adversária que prove o invariante no gate. WIP da A (`tests/resource_reader.rs`,
`tests/support/banked.rs`) segue no worktree dela e não foi tocado.

**Matriz e não-promoção.** Seção nova no estado corrente de
`docs/rex_profiles/ROUND_STATE.md` ("Matriz de bibliotecas standalone (`crates/`)"),
com os dois pacotes em `biblioteca implementada: verified` + `gates próprios
aprovados: verified` e **`backend integrado: blocked`** e **`fluxo do usuário
comprovado: blocked`** nos dois. Nenhuma das matrizes anteriores (endereçamento da A,
codecs da B) foi mexida: continuam `blocked`, que é a verdade operacional. Não há
`rex-kosinski` nem `rex-addressing` em `src-tauri/Cargo.toml`, não há adaptador, não
há chamada real pelo backend, e os 737 testes do produto não exercitam os dois
pacotes. `docs/rex_profiles/CONTRACTS.md` ganhou a §6 formalizando a reserva de
superfícies (manifests e lockfiles, registro de módulos, `src/core/ipc/`,
`src/components/`, `scripts/e2e-tauri-build-run.mjs`, `scripts/check-tree.*`,
`scripts/crates-gates.mjs`, `ci.yml`, documentos de estado) e preservando o namespace
de evidência de cada frente.

**Decisão arquitetural registrada (não conflita com as consolidadas).** `crates/`
passa a ser a localização oficial das bibliotecas Rust **standalone** desta árvore,
dirigidas por `--manifest-path` a partir do registro, **sem** workspace na raiz e
**sem** dependência do produto. Isso é decisão de *convenção de árvore e de gates*,
não das "Decisões Arquiteturais Consolidadas": o aplicativo continua com o build que
já tinha.

**Gates desta barra (logs versionados, cada número com onde mora).** Pacote
`data/rex_profiles/integrator/crates_registry/evidence/2026-09-28-barra-de-entrega/`,
com `manifest.json` amarrando SHA-256 por arquivo e o HEAD sob barra `9f83d15f…`:
`check:tree` rc=0 (`gates-frontend.log:6`) · `lint` rc=0 (`:10`) · `tsc --noEmit`
rc=0 (`:14`) · `npm test` **747 passed / 6 skipped (753)** em 118,35 s (`:41-42`, rc
`:46`) · `npm run crates:gates` rc=0, seis gates verdes (`gates-crates.log`: kosinski
`:6/:9/:61`, addressing `:64/:67/:238`, rc `:241`) · `cargo fmt -- --check` rc=0 e
`cargo clippy -- -D warnings` rc=0 do produto (`gates-rust-produto.log:3,6`) ·
`npm run host:certify` rc=0 com **READY**, fingerprint `60249508…`, lock `dd99a22f…`
e `cargo test --lib` **737 passed / 0 failed / 66 ignored** (`host-certify.log:2357`,
`Success: true` `:2363`, `READY` `:2364`). Reconciliação: o registro anterior era
**737/3 (740)**; **+13** são exatamente os dois arquivos de teste desta rodada
(verificados isolados: 13 passed / 0 skipped), e os 3 skips a mais estão em suítes
pré-existentes condicionadas a toolchain/plataforma
(`src/core/validateUpstreamWindows.test.ts`, `scripts/decomp/decomp-scripts.test.mjs`),
não nesta entrega. Os 737 do produto não se moveram porque nenhum fonte de produto
mudou. Jobs pesados serializados, um por vez; nenhum observador de CI deixado de pé.

**Push, CI e a gate reprovada pelo próprio gate.** O push abriu a branch remota
`codex/rex-integrator-crates-registry` no SHA `a556e86`; a consulta foi pontual, sem
monitor, e o rollup terminal (`…/2026-09-28-barra-de-entrega/ci-consulta-a556e86.log:80`)
dá `linux-validate` **success** (`:60`), `desktop-smoke` **success** (`:77`) e
`validate` (windows-latest) **failure** (`:73`, `:78`) — passo 15 *Frontend tests*,
**2 failed / 729 passed / 22 skipped (753)**; o total de 753 bate com o Linux, e os
22 skips foram depois lidos no log do próprio job Windows e decompostos (host-manager 5 +
`decomp-scripts` 11 + `linux-host-scripts` 6 — apêndice de
`…/2026-09-28-gate-cross-platform/ci-windows-1abad5d-extract.log`). Os passos 10 *Structure check* e 13
*Crate package gates* passaram no Windows: os gates dos dois pacotes também correm lá.
Quem reprova são **dois testes meus** (`scripts/check-tree-crates.test.mjs:77`, `:96`)
contra **código meu**: `scripts/check-tree.cjs:47` compunha com `path.join` o caminho
que a gate **imprime**, então no Windows saía `crates\registry.json` enquanto o
espelho `.ps1` imprime `crates/registry.json` — as duas implementações da mesma gate
divergiram na saída. O exame achou um segundo defeito, de veredito: o `.cjs` passava
`path.normalize` no `manifesto` declarado, e no Windows as duas margens convergiam em
barras, portanto uma declaração fora do caminho canônico seria **aceita em silêncio**
— a checagem mordia só no Linux. Reparo `882272c`: caminhos exibidos viram literais
POSIX nas duas implementações e a comparação passa a ser literal (o `.ps1` foi
apertado no mesmo ponto); as duas asserções continuam estritas — o errado era a
produção, não o teste. Não-vacuidade provada por mutação no Linux (reverter o caminho
exibido derruba exatamente 1 teste; reintroduzir o `path.normalize` derruba
exatamente 1 teste; restauração conferida por SHA-256) e paridade real entre `.cjs` e
`.ps1` executados com `pwsh 7.6.6` em quatro casos (`…/2026-09-28-gate-cross-platform/red-green-mutacao.log`
e `parity-cjs-ps1.log`). Barra do reparo: `check:tree`, `lint` e `tsc --noEmit` rc=0,
`npm test` **749 passed / 6 skipped (755)** — os 2 a mais são os dois testes novos
(`gates-frontend-fix.log`). **O veredito pendente chegou medido:** no SHA do reparo
(`1abad5da356781d…`, run 36375754209) o job `validate` de `windows-latest` fechou
**success** (job 108781125205, 03:57:59Z→04:21:14Z, dezoito passos em success), com o
passo 15 *Frontend tests* — onde antes reprovava — e o 16 *TypeScript check* passando.
No runner Windows a suíte da gate aparece com **9 testes e 0 falhas**; os caminhos
impressos são POSIX lá (`crates/rex-kosinski/Cargo.toml`, `crates/rex-addressing/Cargo.toml`)
e o shell do runner é PowerShell. Contagens: **733 passed / 22 skipped (755)** no Windows
contra **749 / 6 (755)** local, decompostas arquivo por arquivo nas duas margens e
reconciliadas (18 − 2 = 16 = 22 − 6 = 749 − 733). Extrato com linha por linha em
`…/2026-09-28-gate-cross-platform/ci-windows-1abad5d-extract.log`; a varredura da mesma
classe nos testes de `scripts/` não achou outra asserção que componha caminho com API de
caminho — mas devolveu um item para o próprio integrador: `crates-gates.mjs:119-123` ainda
aceita o campo `manifesto` como declarado, e quem reprova a declaração torta é o
`check:tree`, que roda antes no mesmo job; a ordem ficou registrada em vez de a checagem
ser duplicada. **Ainda não provado:** integração ao produto, fluxo de usuário, maturidade.

**Limites que continuam sendo parte da alegação.** `crates/` é degrau de
**biblioteca**: a rodada não torna nada "integrado", não prova fluxo de usuário e não
promove maturidade — as duas bibliotecas seguem de frente `Experimental`. O produto
continua com os codecs que já tinha (LZ4W e aPLib na transação canônica e na UI), e
nenhuma linha de `src-tauri/src/tools/reverse/decomp/` foi tocada aqui. A comparação
com ferramenta externa (koscmp) continua fora da suíte ordinária, no script do perfil
(`scripts/rex_profiles/codecs/kosinski_runtime/differential-vs-koscmp.sh`). ROM
comercial e corpus BYOR seguem fora da árvore e fora dos gates. **Sem merge, sem
release, sem promoção de maturidade.**

### 2026-09-28 — integración da fronte A ao produto (`backend integrado`) e rolda de aceite

**Subida de degrau, medida e con non-vacuidade.** `crates/rex-addressing` deixou de ser
só biblioteca con gates propios: entrou en `src-tauri/Cargo.toml` como
`rex-addressing = { path = "../crates/rex-addressing" }` (sen workspace na raiz;
`Cargo.lock` de 495 a 496 entradas `[[package]]`, a nova **sen** campo `source` e cero
crates externos), o adaptador vive en
`src-tauri/src/tools/reverse/decomp/rex_addressing.rs` (SHA `7bd75ea9…`, sen cambios
desde a integración) e o comando Tauri `rex_addressing_read_snapshot` está rexistrado
en `generate_handler!`. O contrato do adaptador é decisión do integrador: serialización
no adaptador (o crate segue libre de Tauri/serde), erros estruturados
`InspectionError { code, message, retryable }` sen aplanar falhas do núcleo, perfil e
estado explícitos sen autodeección, identidade da ROM conferida no límite de acceso a
bytes (`rex_read_rom` + `platform::identify_md`, literal `rom_identity_mismatch`), e
só a lectura con snapshot fixo nos dous perfís MD exposta — `read_sequence`, as
escritas e os tres perfís SNES declarados como non expostos no rexistro
(`crates/registry.json`, `maturidade: backend-integrado`). Medido 08:14Z–09:25Z:
**17 probas do adaptador / 0 falhas**, suite `cargo test --lib` **754 / 0 / 66**
(base 737 + 17), gates rc=0. Non-vacuidade: RED observado (16 fallos antes da
implementación) e tres controles de mutación (garda de identidade, procedencia do
segmento, aplanamento de erros) mataron 1/2/8 testes con restauración conferida por
SHA. Fluxo de usuario segue `blocked`: ningún chamador da interface usa o comando e
non hai pantalla de enderezamento.

**Rolda de aceite (segunda perna do día).** `git ls-remote` deu `0e5f804` en
`codex/rex-rust-addressing` — cinco commits mais recentes ca pin `30cb311` xa
integrado (15 vectores en `vectors/acceptance-v1.json`, SHA `54ba2b6e…a216` pinada
dentro de `tests/acceptance.rs`, esperado dun oráculo independente: táboa `boards.bml`
de bsnes + modelo GPGX; rexenerar o JSON require `REX_ACEITE_ESCRIBIR=1` con
`--ignored`, que non se executou). Entraron un a un: dous que tocaban o crate
reescritos de `scripts/…/rex-addressing/` a `crates/rex-addressing/` conservando
autor, data e mensaxe, tres de solos `docs/` por `cherry-pick -x`. **Achado sobre o
mi propio traballo, non de A:** a promoción `9f83d15` deixara
`examples/resource_report.rs` na ruta vella (o paquete graduado ás 08:14Z non tiña
exemplo e `clippy --all-targets` nunca o lintaba) e catro ligazóns relativas do README
do paquete apuntaban tres niveis por riba da raíz. Reparado en `daefb43` (blob
idéntico `7f9a8f5b…`, 0 ligazóns rotas, receitas `cd …` e `CONTRATO.md` §0.1
corrixidos; a evidencia histórica co worktree de A mantense tal cal). Re-medido
11:44Z–12:02Z: gates do paquete **138 executados / 0 falhas / 10 ignorados** en 17
targets (reproducindo exactamente os números de A), exemplo rc=0 desde a localización
nova (resumo `27bebc7b…`), `cargo test --lib` **754 / 0 / 66** con `CARGO_RC=0`
directo (a primeira captura pipesouse a `tail -30` e o seu rc era o de `tail`;
conservouse como `captura-defectuosa-rc-do-pipeline-e-tail30.log`), e barra de
frontend no HEAD final `1f30467` 12:18Z–12:20Z con rc=0 nos tres (`npm test` **749
pasados / 6 saltados / 755**). Evidencia en
`data/rex_profiles/addressing_runtime/evidence/2026-09-28-aceite-integrado/`
(manifesto autocomprobado: 7 artefactos listados, 7 presentes, 0 diverxencias).
**O que a rolda non prova:** os vectores gradúan `read_resource`/`read_sequence`,
superficies que o adaptador non expón — non son evidencia do adaptador nin suben
ningún degrau.

**Estado aberto desta fronte.** Licenza: `rex-addressing` entra no inventario como
`source: workspace` co `license: UNLICENSED` que o paquete xa declaraba; **escoller
licenza é decisión do operador**, non se fixo por suposición. Fronte B: o paquete
`rex-kosinski` ten empacotamento e gates propios (tip `6a2218e`, 52 fixtures con
SHA-256 dentro do crate), pero a perna seguinte — chamadas reais de decode/encode polo
backend adaptadas ao contrato de codecs existente (`CodecError { code, detail }`,
preservando decodificar/codificar/reinserir como operacións distintas; o exemplo de
edición en contedor non substitúe a transación canónica) — aínda non executou. Nada
deste día é merge, release nin promoción de maturidade; ambos os paquetes seguen
`Experimental`. Deuda coñecida e allea, rexistrada como fallo sen tocar: `cargo clippy
--all-targets -- -D warnings` do produto dá rc=101 con 45 lints en código de proba
alleo (0 en `rex_addressing.rs`) e `npm run security:audit` dá rc=1 por
`EALLOWSCRIPTS` (config do host anterior; ningún ficheiro npm se modificou).

### 2026-09-28 — integración da fronte B ao produto (`backend integrado`, só ese degrau)

**Que se fixo.** A perna B executou despois da A, unha entrega por vez. Primeiro
entrou a entrega mais recente da B no crate (`0b752b7..6a2218e`, pino conferido con
`git ls-remote` ás 14:38:34Z): encoder v1, paridade koscmp bidireccional, contedor de
edición autoral e 52 fixtures vendorizadas con SHA-256 dentro do paquete, por
`cherry-pick -x` con paridade byte-exata (diff = 0 bytes) e gates re-medidos **51/0/0**.
Despois construíuse o adaptador `src-tauri/src/tools/reverse/decomp/rex_kosinski.rs`
por TDD estrito: dous RED observados e guardados (capa codec e capa IPC, ambos E0432
`rc=101`), GREEN **16/16** (10 capa codec + 6 capa IPC). O adaptador mapea
`KosError`/`EncError` ao `CodecError { code, detail }` do contrato de codecs do produto
1:1 (truncated / invalid_reference / excessive_output / work_limit / empty_input;
stream_limit / work_limit), preserva `bytes_consumed` (contrato v1 §3: o padding
post-terminator non se consume) e expón **dous comandos Tauri reais**, separados como
pedía a misión: `rex_kosinski_decode` e `rex_kosinski_encode` (`run_heavy_command_
off_main_thread`, rexistrados en `generate_handler!`). `Cargo.lock` gañou 5 liñas: só a
entrada local `rex-kosinski` sen campo `source`, cero crates externos novos.
**Números medidos no destino:** `cargo test --lib` **770/0/66** (base 754 + 16),
`clippy --lib -D warnings` rc=0, `fmt --check` rc=0, `check:tree` rc=0, barra de
frontend sen cambios (749/6/755, rc=0). Non-vacuidade: mutacións M1/M2/M3 mataron
1/1/2 probas e a restauración conferíouse por SHA-256 do adaptador (`3b4115ab…`).
Evidencia con manifesto autoconferido (4/4/0) en
`data/rex_profiles/kosinski_runtime/evidence/2026-09-28-adaptador-backend/`. Commits:
`3428b69` (adaptador + IPC), `9894e88` (evidencia), `4daefe8` (rexistro + matriz),
`daa52da` (rollup CI de ebfa8ea).

**Fronte A pechada por SHA.** O rollup CI do push `ebfa8ea` conferíose con consultas
pontuais: `CI` success; `Desktop E2E` fallou o escenario `reference_goal` cun timeout no
límite (15274 ms sobre orzamento de 15000 ms, 'esgotamento de tempo, nao um defeito
confirmado'); a reexecución do job fallido **no mesmo SHA** deu success. Veredicto por
SHA, sen aprobación retroactiva de ningunha entrega anterior. Log en
`.../2026-09-28-aceite-integrado/ci-consulta-ebfa8ea.log`; manifesto a 8/8/0.

**O que a rolda non proba.** `rex-kosinski` está en `backend-integrado`, non máis alá:
ningunha pantalla chama os comandos (fluxo do usuario bloqueado), ningún recurso real
BYOR se decodificou/recodificou polo produto, e o contedor `edit::build/open/reinsert`
**non se expón** — a propia doc del di «NON transacción canónica de producción», e a
distinción decodificar/codificar/reinserir presérvese por exclusión declarada, non por
implementación.

**Estado aberto.** Licenza dos dous crates (`UNLICENSED`, `source: workspace`) segue
decisión do operador. O siguiente degrau para B é fluxo do usuario (UI que chame
decode/encode) ou reinserción na transación canónica — ambos requiren decisión explícita
do operador antes de calquera promoción.

### 2026-10-01 — retomada da integração: preservação, revisões (#91, A, C, D) e curadorias preparatórias

**Tronco confirmado, não presumido.** `origin/main` está em `616abdb` (merge do PR
#60, 2026-09-10) e **não** é o tronco de trabalho: o tronco é a linha do integrador
`codex/rex-integrator-crates-registry` @ `0194f94` (checkpoint i), da qual descende
linearmente toda a cadeia MUGEN: `d1b5a4d` (UX v2, checkpoint l) → `b53ce7a` (#87
locomoção, checkpoint m) → `508db51` (#90 Ken real) → `2793430` (#91 cadeia original).
Todos publicados e com CI verde por SHA (consultas pontuais `gh` em 2026-10-01:
CI + Desktop E2E success nos cinco SHAs).

**Preservação antes de integração (nada foi destruído).** Mapeadas 14 worktrees; as
branches `codex/rex-corpus-a`, `codex/rex-corpus-b`, `codex/rex-corpus-e` e
`pr-85-mugen` são locais (sem upstream). Backup verificável em
`~/Projects/REX-HANDOFF-2026-10-01/backup-integracao-2026-10-01/`: bundle `--all`
(`refs-todas-2026-10-01.bundle`, verify OK, SHA no manifesto), cópias dos untracked
relevantes com `MANIFEST-COPIAS.sha256`, `MANIFEST-canonical-local.sha256` (2613
arquivos, 228 MB de evidência local que fica no lugar) e
`MANIFEST-E-staging-ROM.sha256` (ROM comercial BYOR — **fora do Git**, só hash).
Patches de A/B do handoff `084414Z` validados contra o estado vivo
(`A-unstaged.patch` idêntico; staged de A/B e unstaged de B vazios, correto).
**A branch antiga `codex/rex-integrator-profiles-codecs` está `ahead 2` só porque a
ref remota dela é velha: os dois commits (`ea92a61`, `7003d2a` — docs TiledImage/aPLib)
JÁ ESTÃO no tronco `0194f94` e em `2793430`.** Nada perdido, nada a resgatar; não
duplicado. Sem `reset --hard`, sem `clean`, sem force-push, sem remoção de worktree.

**Worktree exclusiva de integração:** `~/Projects/REX-INTEGRATION-2026-10-01`, branch
`codex/rex-integrator-mugen-chain` @ `2793430`. Gates reproduzidos no destino em
2026-10-01: `npm test` **831 passed / 6 skipped (837)**, `cargo test --lib`
**832 / 0 / 75**, `check:tree` OK, `tsc --noEmit` rc=0, `lint` rc=0 — idênticos aos
números de `ORIGINAL_CHAIN_EVIDENCE.json`. Host **READY** (fingerprint `60249508…`,
gerado 2026-09-30). SGDK/E2E completos e `host:certify` ficam para as pernas de
integração efetiva, um por vez.

**Revisão #91 (cadeia original do Ken) — aprovada, com um limite registrado.**
Evidência do próprio cenário confere: `ORIGINAL_CHAIN_EVIDENCE.json` reexecuta as
provas do Ken real neste binário (oráculo Pillow 21/204/211 quadros + controles
negativos; e2e `mugen-import`/`mugen-control`/`mugen-locomotion` no mesmo app SHA).
Estado 0 autoral separado de arte original (`origin: stand_in`/`source` no programa,
verificado no `mugen_chain.rs`; UI com passo `source_and_origin_review`). Semântica de
botão reconciliada: a borda de subida é **observada, não imposta** (CONTRACT «Semântica
de entrada»), a janela `buffer.time` fica em classe `approximate` por `cmd.html` não
confirmado (403). Input solicitado/aceito/consumido separados no `input_path` do JSON
(driver_requests / keydowns vistos pela página / ticks de A no jogo; 1 de 9 toques
perdido, medido). Limites do oráculo declarados (§4: a mesma leitura de doc nos dois
lados; nenhum runtime MUGEN executado). Falha de host tem diagnóstico (carga ≈ 9;
terceira execução verde sem mudança de código). **Nenhum latch global de input entrou
no diff** (só harness e2e + script de verificação). **Limite registrado:** o digest do
programa cobre o mapeamento **como selado** — pega mutação isolada do programa (teste
`tampered_program_is_refused_by_validate` muta condição/linha/texto), mas NÃO re-lê os
CMD/CNS/AIR em disco no build: divergência coerente programa+digest regenerados, ou
drift da fonte pós-conversão, não é detectada. A formulação do ORIGINAL_CHAIN.md §3
(«cobre o mapeamento») é literalmente verdadeira, mas não deve ser lida como
«verifica contra a fonte». Follow-up sugerido (não executado): re-verificar
`SourceRef.text`/hash do pacote no build.

**Revisão A (Kosinski) — aprovada; 1 correção de documento pendente.** O ciclo fecha
consumidor + variante + saída: o alvo do LEA é o próprio offset do stream
(`lea $3F09A,A0` @ `0x03082` → recurso `offset:258202`), variante declarada `base`
(sem alegar modular/Kosinski+), saída verificada contra `koscmp` (21 decodificações +
5 rejeitos), e o relatório **não** alega ausência de codec — só ausência de marcadores
de fluxo (0/5 imagens), com §4 separando o que não foi provado (nenhuma execução de
ROM; `0x085A2` não é declarado descompressor). Gates re-medidos nesta retomada:
`cargo test --offline` **157/0/0** (bate com o relatório). Pendente: a edição NÃO
commitada de `RELATORIO-INTEGRACION.md` (diff em `084414Z/A-unstaged.patch`) afirma
que «o tronco é `codex/collect-counter-goal`» — **falso** (o repo tem `origin/main` e
o tronco é a linha do integrador); resolver na integração de A, não acatar. Nota de
procedência: a imagem "Sonic 1" local (531577 bytes, SHA `c7da53a1…`) tem checksum de
cabeçalho divergente do varejo (declarado 57871, observado 30221) — A e D usam a
mesma imagem, pinada por SHA.

**Revisão C (áudio Ancient) — aprovada com um achado.** A tabela BE32 confere com as
instruções e registradores (`move.l (a0,d0.w),d1` = long big-endian; `adda.l d1,a0` =
alvo relativo à TABLE; `andi.w #$ff`+`lsl.w #$2` = 256×4) e o leitor
(`readSongIndex`/`u32be`) implementa exatamente isso. Extração de eventos NÃO é
promovida a reprodução sonora (§3: sem captura, «cadeia é estrutural, não acústica»).
Testes re-medidos: vitest **23/23**. **Achado:** o §5 diz que o padrão isolado
`2a 02 1c` «confirma um controlador da família SMPS» em Mega Man Wily Wars — padrão
de 3 bytes **não identifica família**; vale como refutação da detecção por banner
(necessária mas insuficiente, como o próprio §5 admite), não como identificação.
Reformular para «candidato SMPS não refutado» ou acrescentar vínculo estrutural
(forma da tabela de dispatch, protocolo de barramento 68k→Z80) antes de qualquer
alegação SMPS. O perfil Ancient entregue não depende dessa frase.

**Revisão D (sprites Sonic 1) — aprovada.** Mapping/DPLC/arte/paleta cada um com
verificação por padrão de bytes + hash, e o papel do DPLC (tile_slot = ordem de carga,
não índice de arte) registrado antes da interpretação. **Duas** fontes independentes:
oráculo reimplementado do s1disasm fixado (`064e3c6…`) e oráculo do piloto anterior,
byte-idênticos; amostra reservada `fr_Stop1` passou sem mudança de implementação.
A distância entre prova estática e observação de jogo está dita onde deve (§3:
DMA/VRAM por frame NÃO executado; «plausibilidade visual não é prova»); a comparação
visual com captura de jogo fica rotulada como comparação. Testes re-medidos: vitest
**44/44**. Runtime em emulador permanece a pendência declarada.

**CI das frentes de corpus — causa raiz, sem culpa de código.** C (`cc540d4`) e D
(`c2635d5`) estão **vermelhas por `npm audit`** (6 vulnerabilidades, advisory
brace-expansion) porque partem de `b53ce7a`, que é anterior ao fix `23df722`
(presente na cadeia #90/#91). Não é infraestrutura nem defeito das frentes. As
curadorias abaixo resolvem por base.

**Curadorias preparatórias (locais, revisáveis, sem push/merge).** Em
`~/Projects/REX-INTEGRATION-2026-10-01`, sobre `2793430` (que já contém o fix de
deps), por território isolado: `codex/rex-integrator-corpus-c` @ `a055777`
(`cherry-pick -x` de `8077900`→`19f3b84`→`cc540d4`; vitest 23/23; `check:tree` OK) e
`codex/rex-integrator-corpus-d` @ `5fba745` (`cherry-pick -x` de `3ae412a`→`c2635d5`;
vitest 44/44; `check:tree` OK). As worktrees das agentes não foram tocadas; nenhum
commit delas foi reescrito. A entra depois que o relatório dela for resolvido (ver
acima); B segue com trabalho untracked em curso na worktree dela (4 arquivos,
preservados com SHA) — nada a integrar ainda.

**Próxima ação.** Abrir PRs revisáveis: (1) `codex/rex-integrator-mugen-chain` →
tronco (cadeia UX v2→#87→#90→#91 inteira, linear, sem duplicação); (2)
`codex/rex-integrator-corpus-c` e (3) `codex/rex-integrator-corpus-d` → cadeia, um
por vez, com CI re-medido no destino. Pendências com dono: reformulação SMPS do §5
de C; resolução do relatório de A; correção da ref remota velha de
`rex-integrator-profiles-codecs` (opcional, cosmética). Sem merge remoto, release ou
promoção de maturidade nesta rodada.

**Adenda da mesma rodada (ainda 2026-10-01).** PRs abertas, **sem merge**: **#92**
(`codex/rex-integrator-mugen-chain`, `b0e23a3` → `codex/rex-integrator-crates-registry`),
**#93** (curadoria C `a055777`), **#94** (curadoria D `5fba745`) — ambas empilhadas
sobre a cadeia. CI verificado por consulta pontual: **success** nas três branches de
curadoria (o audit de brace-expansion desapareceu com a base nova, como previsto).
Curadoria de A também preparada: **#95** (`codex/rex-integrator-corpus-a`,
`0c651de` = cherry-picks `-x` dos 7 commits de A sobre `2793430`, + `f1b271c`
adenda do integrador no relatório: re-medição no destino **157/0/0** +
`check:tree` OK, veredicto consumidor+variante+saída, e correção factual — a
afirmação «o tronco é `codex/collect-counter-goal`» está apenas no diff NÃO
commitado de A e não entra na cadeia; a adenda §7 do relatório registra a correção
para a agente aplicar ao rebasear). Ref remota velha de
`codex/rex-integrator-profiles-codecs` corrigida por push fast-forward
(`d0744b0..7003d2a`) — a branch local deixa de parecer «ahead 2». CI da branch de A
em andamento no momento do registro; veredicto por SHA a conferir na PR #95.
Permanecem sem merge, release ou promoção; pendências com dono: SMPS de C, WIP do
relatório de A, B (untracked, trabalho em curso), auditoria de segurança completa.

### 2026-10-02 — consolidação das frentes no destino único: #92/#93/#94/#96 incorporados; #97 bloqueado por P1; ressalvas C/D e artefato órfão registrados (Experimental; proposta isolada, sem merge remoto/release)

**Topologia real medida antes do merge.** `merge-base 0194f94 8cf2aec = f0d0756`:
o tronco `codex/rex-integrator-crates-registry` e a cadeia MUGEN são IRMÃOS sobre
`f0d0756` — a frase do checkpoint de 2026-10-01 ("descende linearmente do
crates-registry") vale para conteúdo e intenção, não para ancestralidade de
commits; o merge de consolidação é o que une as linhas de fato. Histórico
preservado: merge `--no-ff`, checkpoint (i) intacto, nenhum commit reescrito.

**Branch de consolidação isolada:** `codex/rex-integrator-consolidation`
(worktree `~/Projects/REX-INTEGRATION-2026-10-01`), sobre `0194f94`:
`2e8b545` merge de `codex/rex-integrator-mugen-chain` @ `8cf2aec` (#92 —
resolução do conflito do Memory Bank por cronologia dos checkpoints:
(o)→(n)→(i)→(m)→(l)→(k)→(j)→(h), título (h) do tronco, zero duplicação; as duas
linhas "0194f94 continua fora da base" agora trazem atualização do merge) →
`dfeb0fe` curadoria C @ `a055777` (#93) → `5da9d1b` curadoria D @ `5fba745`
(#94) → `052d3d6` frente A @ `c469f27` (#96). Território de cada frente
verificado contra o HEAD antes de cada merge: só `scripts|docs|data
/rex_corpus_{a,c,d}/`, nenhum arquivo fora, nenhum binário >200 kB. `#95`
(abortado) permanece OPEN sem ação — supersedido por #96, fechamento é decisão
do operador. **#84 (`codex/rex-gameplay-recovery`) fica FORA desta consolidação**
por falta de revisão específica e coordenação de dependências; nada foi feito
contra a branch.

**#97 (B) NÃO incorporado — bloqueio verificável.** O review independente
(`~/Projects/REX-HANDOFF-2026-10-01/review-pr97/review-pr97.json`, commit
`420e632`) achou P1: `$FF4000` é WRAM (não porta de dados VDP) e o consumidor
pós-decode copia um layout **64×64 de IDs de bloco em bytes** (stride 128, pad 64
por linha) para `$FF1020` — não é nametable VDP 64×32; os campos "paleta/flip/
prioridade" do compositor do #97 não são consumidos por essa rotina. O estado
remoto de `codex/rex-corpus-b` segue em `420e632` (sem commit de correção). A
paridade 196/196 contra oráculos não é afetada pelo P1; os vínculos gráficos do
Sonic 1 SIM. **Nenhum desses vínculos entra no produto** até a frente B corrigir
em seu território (reclassificar o destino como WRAM/layout de blocos 64×64 e
re-rotular os renders de mapa como hipótese não-consumida). Bloqueio para a
integração de B: commit novo em `codex/rex-corpus-b` após `420e632` corrigindo o
enunciado.

**Ressalvas C/D registradas antes de aceitar alegações (não corrigidas aqui —
história não reescrita; dono: frentes).** (C) §5 de
`docs/rex_corpus_c/AUDIO_CHAIN_ANCIENT_MD.md` diz que o padrão `2a 02 1c`
"confirma um controlador da família SMPS": padrão de 3 bytes não identifica
família — vale como refutação de detecção por banner (necessária, insuficiente),
não como identificação; "candidato SMPS não refutado" é o enunciado suportável.
C não pode concluir ausência de SMPS a partir de banner ausente (SMPS-Z80 não
publica banner — o próprio §5 documenta). (D) `frame-record.schema.json` não
inclui `rom_used` no nível do registro (só os manifests do CLI o carregam): o
catálogo proposto precisa do campo no schema para a invalidação por revisão de
ROM funcionar; os hashes RGBA precisam ser datados APÓS a mudança RGB/alpha;
ranges de DPLC continuam com os limites do §8 (mecanismo incremental não
re-derivado). Nenhuma dessas correções foi feita em território alheio.

**Artefato local órfão registrado sem incorporação.**
`data/rex_profiles/kosinski_runtime/evidence/2026-09-28-adaptador-backend/
ci-consulta-a08c2c6.log` (untracked no checkout canônico, 1264 B, polling de CI
de 2026-09-28, 8 tentativas `in_progress`): permanece no lugar, NÃO incorporado a
nenhum manifesto de evidência (não verificado contra uma execução reconstituída);
decisão de incorporar/descartar é da próxima varredura de evidência do
kosinski_runtime.

**Política npm de scripts.** A política canônica do repo é `.npmrc
strict-allow-scripts=true` + `allowScripts {esbuild@0.25.12: true, fsevents:
false}` presa por `scripts/security-contract.test.mjs`. A config global do host
(`allow-scripts = ["9router,@bonsai-ai/claude-code"]`) é ambiente do operador,
fora do repo; NADA foi afrouxado. Não existe gate `EALLOWSCRIPTS` no repo; se
apareceu em log, é do toolchain externo do host — investigar pela configuração
npm local, sem imprimir valores além da política versionada.

**Consolidação (continuação do checkpoint de 2026-10-02) — gates no destino,
build, bloqueio E2E e publicação.** Gates re-medidos na branch
`codex/rex-integrator-consolidation` @ `4840266` (merge `2e8b545` + curadorias
`dfeb0fe`/`5da9d1b` + A `052d3d6` + adendo `4b66fff` + plano da fatia
`4840266`): `check:tree` OK; `lint` rc=0; `tsc --noEmit` sem erros; `npm test`
**898 passed / 6 skipped** (831 da retomada + 23 de C + 44 de D — soma exata);
`cargo fmt --check` rc=0; `cargo clippy -- -D warnings` rc=0; `cargo test --lib`
**832 / 0 / 75** (idêntico à retomada — frentes de corpus não tocam
`src-tauri/`); `crates:gates` **4 pacotes OK**; build canônico `build:debug`
rc=0 em 6m25s, binário
`src-tauri/target-test/debug/retro-dev-studio` SHA-256
`06011c6d6c54bfa06fa37af89832de30c731f29869a0eb29c77104c4ca3f6e12`;
`host:certify` rc=0 (READY regenerado 2026-10-02T09:49Z, lock `dd99a22f…`), com
evidência de preview LZ4W regenerada (`rom=261618d9…`, `pixels=5dac5c29…`,
rgba_mod≠rgba_orig).

**Matriz E2E MUGEN no destino: BLOQUEIO DE HOST VERIFICÁVEL.** O display físico
do host mudou para 1280×800 (modo ativo 800×1280, retrato) com escala
fracionária ≈1,35 do compositor: `set_window_rect` não é honrado sob Wayland
(janela presa em 948×314) e sob X11 forçado (`GDK_BACKEND=x11`) a janela redimensiona
(outer 1280×762) mas o viewport CSS fica ≈952×567 — o assert do harness
(|inner−alvo|≤64×96 contra 1920×1080) é matematicamente insatisfazível nesse
display; Xvfb não está instalado. 5 tentativas com logs (1920×1080 nativo ×2,
1280×780 ×2, GDK_SCALE/DPI ×1). **Não é falha do código e não houve afrouxamento
de gate.** Cenários afetados: `mugen-import`, `mugen-control`, `mugen-locomotion`,
`mugen-original`. As últimas verdes desses cenários (2026-09-30/10-01) são do
CONTEÚDO idêntico da cadeia (os merges não alteram `src-tauri/` nem `scripts/`)
— valem como prova herdada dos cenários, não como prova do destino. **Próximo
comando exato:** com display ≥1920×1080 restaurado (ou Xvfb instalado:
`sudo pacman -S xorg-server-xvfb`) rodar, na branch de consolidação, sobre o
binário já construído:
`xvfb-run -s "-screen 0 1920x1080x24" env RDS_MUGEN_REAL_SOURCE=/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8 RDS_E2E_KEEP_PROJECT=1 node scripts/e2e-tauri-build-run.mjs --scenario mugen-original --skip-build --app src-tauri/target-test/debug/retro-dev-studio`
seguido de `mugen-import`, `mugen-control`, `mugen-locomotion` e do oráculo
independente `python3 scripts/verify-mugen-real.py --source <ken8> --backend
<pasta-backend-do-run> --output <json>` — Strider autoral (`mugen-import`,
fixture do repo) e Ken real (fonte local `ken8`, oráculo Pillow) permanecem em
trilhas separadas, sem substituição geométrica.

**Publicação da proposta.** Branch `codex/rex-integrator-consolidation` enviada
com PR sobre o tronco `codex/rex-integrator-crates-registry` (sem merge, sem
release, sem promoção). Para entrada remota futura: **#92 primeiro** (merge da
cadeia no tronco); #93/#94/#96 dependem de retarget para a base resultante;
#97 aguarda a correção P1 pela frente B; #84 segue fora desta consolidação.
Dívidas de crates apontadas por A (`rex-addressing::md_linear::translate`
mascara sem conhecer tamanho do arquivo; `tables_for` aceita primeira entrada
muito abaixo do mapa; glob de aceite `m02` em `rex-kosinski`) permanecem
registradas para tratamento mediante regressão — nenhuma regressão observada
(crates:gates 4/4); licenças intocadas. Consultas de CI serão pontuais por SHA
da branch publicada, sem commit documental por consulta e sem observadores
vivos.

### Checkpoint 2026-10-02 — Sonic multi-frame e pintura visual, proposta isolada (Experimental)

Branch `codex/rex-sonic-multiframe-ui`, base #98 `0ef540e95463faf74bc32202744ed27872592d8e`.
Código/ frontend provado: `f646ccf6de220f38dc9bf2b175cd56d79ff4be82`; app canônico SHA
`1845aebf1597a18cab74dd763d03fcf75c25ef2ec834c165fed5dc9529ccb8b0`.
Dez frames Sonic assistidos por mapping/DPLC do perfil Rev00, pintura visual pela
paleta real (0 transparente), confirmação de compartilhamento, cópia cumulativa,
BPS e salvar→reiniciar app→reabrir. Base BYOR `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`
(531577 B) permanece byte-idêntica. Nenhuma ROM ou imagem comercial foi versionada.

**Defeitos corrigidos com regressões discriminantes:** ordem das células VDP por
coluna (prévia Sonic herdada e pesquisa D usavam linha; antigo golden concordante
não era prova independente); edição posterior agora preserva a pintura/paleta
anterior; selecionar outro frame já invalida uma composição pendente. Geometria
composição→pintura tem uma única resolução no backend. O teste autoral 2×2 e o
acesso de pintura (8,8) falharam antes da correção. Stand RGBA correto:
`7354bcfb6af04b6dc5d95c56adbaca232f9658a5edb0cb4dbd98a98582c462e7`.
Frente D precisa corrigir seus renders no território próprio; provas históricas
ficam preservadas, sem recertificar intenção de coordenadas antigas.

**Prova nova no mesmo app:** `sonic-multiframe` passou dez composições com RGBA
independente, controles nativos, acúmulo pintura/paleta, BPS byte-exato e reabertura
visual (centro+quatro cantos em IMG, metadados abaixo). Isso é prévia estática,
não execução dos dez frames. Regressão separada `inspection-sonic-tiles` passou
recusas, edição/BPS/aplicação, observação de 1200 frames no core e reinício/reabertura:
96 pixels alterados no Sonic, ROI x=74..85/y=170..177. Não prova teclado/movimento/salto.
Pillow: dez PNGs exatos e vinte mutações recusadas. Undo age na fila pendente; troca
de frame não persiste essa fila. Novos bancos/overlap/VRAM herdada são recusados.

**Gates finais:** `host:certify` READY, upstream SGDK/PVSnesLib `Success: true`;
frontend 906/3 (direto 903/6, total909), Rust839/0/76, UI13/13;
fmt/clippy(lib/default)/lint/tsc/check:tree/crates:gates4/4 passaram. Fingerprint
`60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2`, lock `dd99a22f…`.
Auditoria npm padrão: EALLOWSCRIPTS (config usuário); por chamada isolada preservando
política repo: rc0 no limiar high, quatro moderados Vitest `GHSA-82fw-gwwq-j7x9`.
Cargo audit: rc0, oito avisos permitidos. Não se declara zero vulnerabilidades.

**Display:** monitor físico perdeu a resolução; prova final usa Xvfb externo de QA
fixado e com assinatura verificada, SHA `5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351`,
autenticação própria/sem TCP, sem sudo/instalação de sistema/mudança dos monitores.
Processos do cenário e do display foram encerrados. Limites e corridas intermediárias
estão no relatório; não foi contado timeout como sucesso.

**Evidência e próximo passo:** `docs/rex_profiles/sonic_multiframe/REPORT.md` e
`data/rex_profiles/sonic_multiframe/evidence/2026-10-02/manifest.json` fixam código,
app, fontes, resumos e arquivos locais por hash. PNG/base64/arrays RGBA ficam ignorados.
Proposta dependente da #98 para revisão, sem merge/release/promoção. #97(P1) e #84
não entram; nenhum checkout de outro agente foi alterado. CI remoto pertence ao SHA
publicado, não é prova BYOR. Após a revisão, integrar na ordem da base e revalidar o
fluxo afetado no destino; não usar a prova de um perfil como decompilação universal.

### Complemento 2026-10-02 — PR #99 e barreira de identidade no E2E

A proposta Sonic multi-frame segue draft, dependente da #98, sem merge/release.
Produto/frontend e binário permanecem `f646ccf` / `1845aebf…b8b0`.
Harness `5b9d2b96a4e6fd47ba938b88b33a463398d96ef4`: a coleta agora exige o SHA
compilado na Game View, sessão nova fora de hold e dez frames renderizados.
A aceitação antiga (canvas não preto) podia coletar ROM anterior/boot; quatro
regressões discriminam esse caso. A comparação exata do tilemap foi mantida.

No CI de `86fb1b8`, um desktop falhou no tilemap após reabertura, reproduzido
localmente; a repetição remota única passou. A causa dinâmica específica das
falhas iniciais não é estabelecida por seus logs incompletos. Com a barreira,
`reference-platformer` passou 16/16 no mesmo app, incluindo pintura/reabertura
(ROI `1bd5bd07`), teclado e duas passagens. Nova certificação: READY, upstream
Success:true, frontend910/3, Rust839/0/76. As provas BYOR Sonic continuam separadas.

Evidência complementar em `data/rex_profiles/sonic_multiframe/evidence/2026-10-02-frame-barrier/`.
Auditoria histórica: 57/58 hashes reconfirmados; fontes pelo Git pinado. O JSON
host-readiness anterior foi sobrescrito pela certificação; o log READY permanece
íntegro. A nova saída tem cópia congelada; não se reescreveu a evidência antiga.
CI posterior pertence ao SHA consultado na PR, sem alegação de verde herdado.
Nenhuma frente, corpus ou worktree de outro agente foi alterada.

### Checkpoint 2026-10-03 — fatia de cadência Sonic 1 (Etapas 1–6, branch própria)

Frente `codex/rex-sonic-cadence` (worktree REX-SONIC-CADENCE-2026-10-02), filha
da base da #98/#99. Entrega: um iniciante abre a própria ROM Sonic 1 (BYOR),
vê os 18 quadros reais de `id_Wait` na ordem do script, entende a duração em
unidades medidas, muda o byte de intervalo na CÓPIA pelo pipeline canônico
(offset 0x13BAE, 1 byte, base intacta), vê previsão/oráculo H_N+1, exporta e
aplica BPS pela UI, JOGA base e modificada na Game View real, salva/fecha/
reabre com edição e procedência restauradas — e a cadência efetiva é medida
no próprio core, provada por verificador independente.

Números congelados ANTES das corridas (EXPECTATIONS-ETAPA5.md + Addendum-A +
Retificação A, cada um commitado antes de tocar código) e confirmados na
run-4: byte 23 → gaps de 24 frames de tela; byte 40 → 41 (veredito H_N+1,
NTSC; PAL não medido). allPass 48/48 no driver + 35/35 no
`scripts/qa/sonic-cadence-journey-verifier.mjs` (recalcula do hex bruto;
recargas 58/35, razão da moda 1,0, cobertura idle 1,0, discriminante 24≠41).
Falhas honestas registradas: run-2 (amostragem ao vivo estruturalmente
impossível: contador ×10 em ViewportPanel e IPC faminto o pump) e run-3
(borda inclusiva do `record_from`; 1402×1401 linhas). Produtos derivados:
comando `emulator_run_frames_sampled` (lote com mutex no core, índices
absolutos, identidade ROM no retorno; unit-tested) e CX-EVAL.md com quatro
fricções residuais documentadas (drawer do console, wizard na reabertura,
contador ×10, custo de IPC por leitura).

Binário da prova: `2f09ced2…` reconstruído no HEAD exato `ec2c0a2`; pins
Xvfb `5bfd315a…` e ROM `c7da53a1…`. Gates completos em
`data/rex_profiles/sonic_cadence/evidence/2026-10-03-journey/gates.json`
(check:tree/lint/tsc/npm test/clippy -D/fmt/cargo test 846/0/79/certify/audits).
Séries brutas, prints e arquivos-ROM ficam LOCAIS (hash pinados no manifesto);
só metadados/métricas/resumos são versionados. Classificação mantida:
Experimental / local profile validation — sem merge, release ou promoção de
maturidade por esta frente; integração é decisão do integrador.

### Checkpoint 2026-10-03 — jornada integrada de animação Sonic 1 (Etapas 1–6, branch própria)

Frente `codex/rex-sonic-anim-integrada` (worktree REX-SONIC-ANIM-INTEGRADA-2026-10-03),
filha de `codex/rex-sonic-cadence` @ a59e7dc (PR #100); PR desta frente é
dependente daquela. Entrega: na UI real de inspeção, uma ROM BYOR do usuário
atravessa abrir → localizar `id_Wait` com 18 quadros reais → pintar 1 pixel
com confirmação de compartilhamento → mudar a duração para 40 → conferir a
cópia pelos dois bytes crus → exportar/aplicar BPS → JOGAR a cópia na Game
View com identidade dos bytes confirmada → salvar/destruir janela/reiniciar/
reabrir com sequência, duração, pixel e procedência restaurados → restaurar
SÓ a duração mantendo o pixel intacto. Regra central provada: duas edições de
domínios diferentes coexistem sem uma desfazer silenciosamente a outra
(`changed_offsets` cumulativo `[80814, 139582]`, `bytes_changed=2`; ledger
nomeia por operação; voltar a 23 devolve a cópia só-pixel `b1ed600d…`).

Expectativas congeladas antes das corridas (a657423), com histórico honesto
de 4 execuções: run-1 FAIL por suposição do driver (não do produto) —
corrigida pelo Addendum-1 (R-1..R-4, congelado sozinho em 717ec2d); run-2 e
run-3 FAIL no gate de boot do PASSO 7 — o traço cru da run-3 provou pump
vivo e lento (~5,5 fps em software rendering Xvfb; série 10→660 crescente,
zero mensagem de falha), classificado como meio e não expectativa, com única
correção M-1 (orçamento do gate 120s→300s só nesta jornada; limiar de 890
frames intocado) congelada no Addendum-2 (03986d0) antes de mexer no harness.
Run-4: **allPass 24/24 checks nomeados, 10/10 passos, sem aborto**, binário
`03628796…` reconstruído no HEAD exato `b824e11` (gate de proveniência
dist==HEAD ativo); pins Xvfb `5bfd315a…`, ROM base `c7da53a1…`, cópia da
jornada `3274e7c4…` (0x13BAE=40 + nibble 15 em 0x2213E), BPS `4c039980…`.

Gates completos no HEAD final `db57f5d` (inclui correção de um lint que a
própria frente introduzira em Etapa 4, com teste revalidado): check:tree,
lint, tsc, npm test 918/0 (6 skipped), fmt, clippy canônico `-D warnings`
verde, `--all-targets` com dívida preexistente da base registrada em
`gates.json`, cargo test --lib 850/0/80, host:certify READY. Sem mudança de
dependências (audits não disparados). CX (E10): roteiro de três tarefas
entregue com **validação humana pendente** por design — a frente não afirma
"iniciante consegue" sem participante. Série bruta, logs, prints e
arquivos-ROM ficam LOCAIS (hashes pinados no manifesto em
`data/rex_profiles/sonic_anim_integrada/evidence/2026-10-03-journey/`).
Classificação mantida: Experimental / local profile validation — sem merge,
release ou promoção de maturidade por esta frente; integração é decisão do
integrador.

### Checkpoint 2026-10-03 — frente VISUAL da jornada Sonic (ETAPAs 1–4, branch própria)

Frente `codex/rex-sonic-anim-visual` (worktree REX-SONIC-ANIM-VISUAL-2026-10-03),
filha da entrega `codex/rex-sonic-anim-integrada` @ 8edf69d (PR #101); PR
dependente daquela. Missão: tornar a capacidade atual visualmente correta e
utilizável, sem ampliar codecs/variantes/animações.

ETAPA 1 (fechada, `256779d`): causa do preview walk-1 todo magenta após
reabertura estabelecida com reprodução e evidência — sob compositor acelerado
do WebKitGTK, janela destruída/recriada nunca repinta o bitmap do `<img>`; A/B
com `WEBKIT_DISABLE_COMPOSITING_MODE=1` restaura byte-exact (relatório
`89a35a2b…`, análise offline da captura defeituosa: 12258 mismatches, bloco
magenta 120×120 defasado +99px em y; extração/deco, bytes da ROM, host e
caminho de screenshot exonerados). Registrado em
`docs/rex_profiles/sonic_anim_integrada/evidence/2026-10-03-visual/CAUSA-MAGENTA.md`.

ETAPA 2 (fechada, `87a9b48`+`ac08fbb`): workspace de animação na UI real —
área dedicada com grupos (duração/cor/pixels), comparação lado a lado
Original · ROM base intocada vs Cópia atual via composição `from_base` com
guarda de oracle estendida, estado pendente/aplicado/salvo, política de
PROPOSTA para Mais lento/Mais rápido (nada grava sem "Aplicar duração"),
mensagens inline junto da operação, bloco de ações (BPS, aplicar, jogar,
observar) e retomada por banner + cache de sessão viva. Gates E2-1..E2-10
congelados em `EXPECTATIONS-VISUAL-ETAPA2.md` (`d4eb3ef`) antes de implementar.

ETAPA 3 (fechada, `94f5fca`→`932f2c6`→`a0067d8`→`b396abb`): correção NO
PRODUTO — `app_lib::run()` define `WEBKIT_DISABLE_COMPOSITING_MODE=1` em
Linux antes do Builder (trade-off: render por software, aceito e registrado).
Jornada retificada (E3-1 aborta se a mitigação estiver no ambiente do harness;
E3-2 gate de raster da janela via pixmap X11 vs raster independente; E3-3
prova offline discriminante contra a captura defeituosa arquivada; E3-4
remontagem hidratada pelo contrato E2-7 e banner que cede à reabertura
explícita) passou **allPass 28/28 no binário final** `ce54d579…` construído em
`a0067d8` limpo (gate de proveniência ativo), sem mitigação de ambiente, com
sprite visível pós-reabertura na 1ª captura (0 mismatches, magenta_fraction
0,57 = matte correto) e restauração seletiva preservando o pixel. Expectativas
`EXPECTATIONS-VISUAL-ETAPA3.md` congeladas sozinhas antes de implementar.

ETAPA 4 (fechada neste checkpoint): `CX-ROTEIRO.md` revisado contra a
superfície entregue (caminho real Ferramentas → Reverse Workspace → Inspeção
visual; política de proposta; "Editar cor da paleta"; comparação lado a lado;
banner que cede; tarefa 2b nova de pixel+comparação) — **validação humana
continua pendente por design**; nenhuma alegação de usabilidade.
Reconciliação de gates com comandos realmente executados em
`GATES-ETAPA4.md`: check:tree, lint, tsc, vitest 930/0/6skip, fmt, clippy
CANÔNICO, cargo test --lib 850/0/80 e host:certify READY (fingerprint
`60249508…`) executados no HEAD da ETAPA 4; `clippy --all-targets` e audits de
segurança NÃO aparecem como aprovados (dívida preexistente de 46 falhas de
código de teste da base; dependências inalteradas — `git diff` vazio de
package/lock/Cargo desde a base — auditorias ficam a cargo do CI do PR).

Classificação mantida: Experimental / local profile validation — sem merge,
release, promoção ou push forçado por esta frente; Linux-only para a
correção de apresentação; integração é decisão do integrador.

### Checkpoint 2026-10-05 — integrador: consolidação Sonic #103→#104 e inspeção
somente-leitura de consumidores/recursos (PR #109, sem merge)

Frente exclusiva do integrador: worktree `~/Projects/REX-INTEGRATION-2026-10-05`,
branch `codex/rex-integrator-sonic-103104` (o checkout canônico permanece em
`codex/rex-mugen-locomotion @ b53ce7a`, intocado). PR #109 empilhada sobre a
cabeça do #104 (`codex/rex-sonic-sequencia`), 6 commits, HEAD `de4d1f5`.

Entrega (ordem do operador, Missão E passos 9–11): comando read-only
`rex_inspection_sonic_consumers` + DTO congelado `consumers-info/v1` + painel de
7 níveis em português simples (produto→IPC→UI), demonstrando o consumidor
verdadeiro do recurso da fase especial e recusando o falso líder (janela 4×4)
com os 3 motivos fixos. Contrato congelado em
`docs/rex_profiles/integration_20261005/EXPECTATIONS-INSP-2026-10-05.md` (texto
intacto) + `ADENDO-1` datado (ambiguidade §1×§5-T4: troca de entrada da tabela
sempre diverge um sítio → recusa TOTAL da cadeia por §1). Revisão B/C/D
registrada em `REVISAO-B-C-D-2026-10-05.md`: B aprovada para consumo parcial,
C/D como referência de contrato; **Enigma continua fora do produto** (decoder
externo LGPL-mdcomp pinado por hash; nada foi transplantado).

Prova no MESMO binário final `8c781bb0468e…` (build de `35c6657`, driver QA com
Xvfb `5bfd315a…` e ROM BYOR `c7da53a1…` verificados por SHA em cada run,
`system_display_modified=false`): jornada de regressão `sonic-sequencia-journey`
**42/42 allPass** (obrigatória porque a UI foi tocada) e cenário novo
`sonic-consumers-inspection` **24/24 allPass** — com painel aberto pelo caminho
nativo e sondas técnicas rotuladas; somente-leitura provado (bytes idênticos,
ledger 0, reinspeção idempótica, base preservada). A run-1 do cenário novo foi
INCONCLUSIVE por **bug de asserção do harness** (comparava literal estofado
`0x065432` contra o formato congelado `{:#x}` = `0x65432`; as 6 entradas
conferiam byte a byte com os pins) — registrada com a linha bruta em
`data/rex_profiles/integration_20261005/evidencia-insp/verdicts-linha-bruta.txt`,
corrigida em `d614fd2` e reexecutada, sem reescrever expectativa congelada.

Gates em `de4d1f5`: `check:tree`/`lint`/`tsc --noEmit` rc=0; `npm test` 936/0
(6 skip); árvore Rust idêntica a `35c6657` (diff toca só `scripts/`) —
`cargo fmt --check`, `cargo clippy -- -D warnings` (canônico, sem
`--all-targets`) e `cargo test --lib` 869/0 valem por esse commit e estão
marcados como HERDADOS com o motivo; `crates:gates` OK (4 pacotes);
`host:certify` rc=0. Rollup CI terminal no SHA exato `de4d1f5`: todos SUCCESS
(Sourcery SKIPPED de fábrica), consultado por segmento único, sem monitor.

Classificação mantida: a entrega para em **vínculo estrutural estático provado
pela interface**; candidata ≠ referência ≠ vínculo ≠ consumo observado ≠
equivalência — nada foi promovido; sem merge, sem release, sem push forçado;
ROM, binário, screenshots e patches derivados da ROM comercial permanecem fora
do índice (só SHA-256 e referência). Pendente do operador: decisão de merge e
promoção; frente MUGEN UX v2 (#66) não iniciada por falta de ordem.

### Checkpoint 2026-10-06 — integrador: leitura nativa dos seis layouts Sonic (Enigma no núcleo), Experimental

Branch `codex/rex-integrator-sonic-103104` (PR #109, sem merge). Audit corrigido em commit próprio (`167a8de2`); B integrada por
`cherry-pick -x` e re-empacotada como `crates/rex-enigma` (0 dependências; `lib.rs` = B salvo rustfmt; risco jurídico residual do
s1disasm é decisão do operador). Núcleo `sonic_layouts.rs` (layouts-info/layout-grid/layout-cell v1), seleção salva na sessão
(`layouts_selection`), UI "Mapa de IDs", nomenclatura VDP corrigida (dados C00000/controle C00004). Binário `02ab2eec…` (de `ac670155`):
`sonic-layouts-journey` 73/73, `sonic-sequencia-journey` e `sonic-consumers-inspection` allPass; BYOR Enigma 6/6 byte a byte. Detalhes e
limites em `docs/rex_profiles/integration_20261006/ENTREGA-LAYOUTS-2026-10-06.md`. Nada observa o jogo em execução; A/C/D não integrados.

### Checkpoint 2026-10-06 (fecho) — integrador: revalidação da leitura nativa dos layouts após correção do rex-enigma

Ordem de 8 passos do operador (MISSÃO: fechar tecnicamente a leitura nativa dos layouts). Commits sobre `43bb42f6`:
`9a12a741` (rex-enigma **0.2.0** recusa `value_offset != 0` com `UnsupportedParameter` — domínio comprovado é só 0;
TDD completo; igualdade L2 com B **retificada por ADENDO datado**, o que substitui a frase "`lib.rs` = B salvo rustfmt"
do checkpoint anterior por "original de B + rustfmt + delta funcional versionado"), `7489fdd7`
(`PROVENIENCIA-2026-10-06.md`: mdcomp LGPL excluído sem declarar risco eliminado; s1disasm sem licença explícita —
nenhuma licença inventada; oráculos research-only por execução), `1f1bd819` (trava src-tauri → 0.2.0) e o commit de
fecho. Gate de segurança fechada pelo caminho canônico: npm **11.16.0 isolado** (runtime declarado) rc=0; host
npm 12.0.2 dá `EALLOWSCRIPTS` rc=1 (causa no ADENDO; `npm audit` direto não substitui o gate). Revalidação no
binário final `c784dc04…` (build de `1f1bd819`): gates da barra todos rc=0; BYOR Rust ignorados 17/17 serial
(run-1 falhou por env errado meu — registrado INCONCLUSIVE; run-2 abortou por `longjmp` do encoder C aPLib sob
paralelismo — artefato de outra frente, declarado); BYOR Enigma python **6/6** byte a byte vs oráculo com consumo
igual aos pins; jornadas layouts **73/73**, consumers **24/24**, sequencia **42/42** allPass no mesmo binário.
Evidência nova em `data/rex_profiles/integration_20261006/evidencia-fecho/` (SHA256SUMS); herdada do binário
`02ab2eec…` preservada sem reatribuição. Pendências: B S1–S3 (paridade offset≠0 → 0.3.0), decisão de distribuição
(risco residual s1disasm), revisão do pacote atual a solicitar ao principal, CI terminal só vale no SHA final
pushado, aviso pré-existente `ast_generator.rs:3479` (#[test] duplicado, test-profile). Composição gráfica é a
missão seguinte. Sem merge, release ou promoção.

### Checkpoint 2026-10-07 — integrador: remontagem somente-leitura da fase especial Sonic (paredes e objetos confirmados), Experimental

Código `d85485b1`; binário `762e10b5…` (build de `d85485b1`, árvore limpa). Módulos genéricos `rex_nemesis` (decoder Nemesis) e `rex_mdgfx`
(tiles, mappings, PLC, CRAM, composição indexada) + perfil `sonic_ss_walls` + IPC `rex_inspection_sonic_ss_walls/_wall_compose` + UI
`SonicSsWallPanel` (painel da célula do Mapa de IDs). Confirmado por pixel contra o core genesis_plus_gx: paredes IDs 1–36 × 16 frames e
13 pares (ptr/campo/frame) dos IDs 39,41–44,49,65,74 em 2 capturas independentes (sementes 11/23); produto = referências Python
independentes; canvas desktop = oráculo JS. Jornadas no binário final: layouts 85/85, consumers 24/24, sequencia 42/42. Não confirmado:
23 pares só da exploração, IDs 37/45–48/50/51/59–64/70–73 sem imagem, IDs 58/66–69 sem arte (base 0x7B2 fora do PLC). Paleta é sempre
candidata estática (nunca estado do jogo). Detalhes, limites e reprodução em
`docs/rex_profiles/integration_20261007/FECHO-SS-REMONTAGEM-2026-10-07.md`. Sem push/merge/promoção; edição e reinserção ficam para missão posterior.

### Checkpoint 2026-10-07 (b) — integrador: pulo do Sonic 1 localizado, pulo duplo PROPOSTO e lógica em nodes, Experimental

Localizados nos bytes (objdump m68k do toolchain): `Sonic_Control` 0x12C58 + tabela de modos 0x12CC0, `Sonic_Jump` 0x133EA, `Sonic_JumpHeight` 0x13498, flag `$3C(a0)` (escrita 0x1344A, reset 0x137E4). Pulo duplo como patch IPS de 105 bytes
(`data/rex_profiles/integration_20261007/patches/`), verificado no core genesis_plus_gx (A/B/C, toque/segurando): 2º salto no ar, ápice 910→870/816, sem triplo; nunca aplicado a ROM do repositório.
Três NodeGraph v1 descritivos (70 nós/72 arestas) com origem/endereço/bytes por nó; deserializer do produto mantém tudo; não abertos visualmente no editor. Detalhes e limites em
`docs/rex_profiles/integration_20261007/PULO-DUPLO-E-LOGICA-2026-10-07.md`. Corpos das demais rotinas não recuperados; sem hardware real.

### Checkpoint 2026-10-08 — integrador: perfil `m68k.platformer_jump.v1` (localizar o pulo por assinatura e editar constantes), Sonic 1 + Sonic Delta, Experimental

Novos módulos genéricos `rex_sigscan` (padrões com capturas), `rex_platformer_jump` (perfil), `rex_jump_ipc` (comandos `rex_jump_locate/_edit`) e painel `RexJumpLogicPanel` na aba Code. Localiza 1 instância no Sonic 1 e 3 no Sonic Delta Reloaded
(layouts de objeto diferentes; o Delta exigiu 2 variantes). Edição de constantes sem crescer a ROM (cópia + IPS, nunca sobrescreve); efeito medido no core: apice do pulo 94→182 (impulso) e 34→81 (corte), iguais no Sonic 1 e no Sonic do Delta; as outras duas
instâncias do Delta não afetam o Sonic. Limites: forma+consistência (não prova uso), pareamento só mútuo, cap/imps não verificados em execução, edição direta no canvas ainda não ligada. Detalhes em
`docs/rex_profiles/integration_20261007/PERFIL-PULO-ASSINATURA-2026-10-08.md`.

### Checkpoint 2026-10-08 (b) — integrador: ponte canvas ↔ ROM do pulo (editar no nó gera cópia + IPS), Sonic 1 + Sonic Delta, Experimental

Grafo gerado do perfil `m68k.platformer_jump.v1` agora carrega identidade da ROM/valor original/faixa/offsets; botão "Abrir como nodes", painel "Ponte ROM ↔ nodes" no editor e campo `RomValueInput` nos cartões editáveis.
Editar o valor no nó → ponte lista as diferenças → núcleo revalida (faixa, bytes antigos, identidade da ROM) e grava cópia + IPS. Jornada desktop `jump-canvas-journey` 24/24 (Sonic 1 e Delta), conferida no disco. O grafo segue descritivo
(nunca altera a ROM sozinho). Não reexecutei as outras jornadas desktop com o editor alterado. Detalhes: `docs/rex_profiles/integration_20261007/PERFIL-PULO-ASSINATURA-2026-10-08.md`.


### Checkpoint 2026-10-09 — integrador: ponte canvas → pulo → ROM → gameplay fechada (fronteiras, regressão do editor, persistência, efeito da cópia), Sonic 1 + Sonic Delta, Experimental

Branch `codex/rex-integrator-sonic-103104` (sem push/merge/release/promoção). Binário final `ad06bfa8c047…` construído em `67b720da` (árvore limpa); produto (`src`, `src-tauri`) idêntico ao de `e044a53c`. Detalhes, pins completos (ROMs-base, 8 cópias e IPS por SHA, core, Xvfb, host) e histórico em
`docs/rex_profiles/integration_20261007/FECHO-PULO-CANVAS-GAMEPLAY-2026-10-09.md`; evidência com `SHA256SUMS` em `data/rex_profiles/integration_20261007/evidencia-pulo-canvas-gameplay/`.

Fronteiras (commit `d91e6897`, reconfirmadas): duplicados recusados; grafo revisado contra o canônico da ROM (topologia/origem/campo não viram "lógica aplicada"); identidade obrigatória no canvas e no formulário; resultado assíncrono associado a ROM/instância/valores; publicação conjunta cópia+IPS sem apagar arquivo alheio; domínio IPS (`0x1000100`, EOF, tamanhos). Regressão do editor no binário final: `nodegraph-authoring` 13/13, `jump-canvas-journey` 87/87 (inclui salvar → destruir → reiniciar → reabrir do disco), `jump-profile-journey` 24/24, layouts 85/85, consumers 24/24. Prova causal (cópias do canvas, teclado nativo, RAM como sonda rotulada): allPass; impulso +88 px (segurar), corte +47 px (toque), `both` ambos; no Delta só a instância `a` (`0x16914`) afeta o Sonic observado (`b`/`c` sem efeito; nada se afirma sobre quem são).

Falhas preservadas: 5 execuções de gameplay anteriores reprovaram/ficaram inconclusivas por protocolo do "segurar" (limiares nunca mudaram; adendos v2/v2.1/v2.2 congelados antes de cada rodada; errata de numeração no fecho). `jump-profile-journey` reprovou 2/24 por expectativa antiga (`jump-error`→`jump-failure`), corrigida sem afrouxar. Correção de doc: dois imediatos de 16 bits editados, três bytes efetivamente diferem.

Não verificado em execução: `cap`, `imps`, `impw`, `cutw`; faixa aceita pelo perfil ≠ "segura em gameplay". Usabilidade humana NÃO testada (sem participante). Gates em `67b720da`: check:tree/lint/tsc rc=0, vitest 1018/0 (6 skip), fmt/clippy canônico rc=0, `cargo test --lib` 941/0 (88 ignorados), `host:certify` rc=0 READY; audits e `clippy --all-targets` não rodados. Sem CI remoto (sem push). A PR #110 não foi integrada.

Próximo alvo preparado (nada executado): rotina `$085A2` do Streets of Rage (World), com consumidores estáticos e saídas esperadas já versionadas — `PROXIMO-ALVO-STREETS-OF-RAGE-2026-10-09.md`. Vida/anéis não iniciados.

### Decisão 2026-10-09 — integrador: direção do REX = recuperação de lógica universal no futuro, sem casos customizados (ordem do operador)

Registrada em `docs/14_REX_ARQUITETURA_UNIVERSAL.md` (referenciada em `docs/08_TREE_ARCHITECTURE.md`, `docs/12_DECOMPILACAO_PAREADA_PLANO.md`, `AGENTS.md` e `CLAUDE.md`). Não altera as "Decisões Arquiteturais Consolidadas". Conteúdo: (1) decisão e consequências — código novo que nomeia jogo/campo é sinal de alarme; "universal" é direção, nunca alegação; desconhecido permanece desconhecido; (2) arquitetura-alvo motor × perfil (dado versionado) × escada de evidência L0–L6, com classificação inicial dos módulos de `decomp/` (a auditoria completa é a F0); (3) problema aberto: observar execução de forma genérica — os cores Libretro não expõem o PC pela API padrão; opções C (amostragem por quadro, já usada no pulo), A (executor m68k mínimo isolado com teste diferencial) e B (core com gancho de PC, exige aprovação de dependência); (4) escopo dentro/fora; (5) fases F0–F5 com critério de saída mensurável (o pulo vira o 1º perfil em dado; `$085A2` do Streets of Rage é o teste de generalidade F3; vida/anéis só na F5); (6) métrica de generalidade por alvo e regra de parada (se o código novo por alvo não cair em três alvos seguidos, re-arquitetar); (7) protocolo para qualquer agente (classificar motor/perfil/evidência/caso, congelar expectativas antes de medir, declarar nível de evidência, só o integrador atualiza docs canônicos em rodadas paralelas). Pendências do operador: D1 sonda (C+A recomendado; B só com aprovação), D2 local dos perfis em dado (`data/rex_profiles/specs/` proposto), D3 escopo SoR 1/2/3, D4 risco jurídico de distribuição. Nada foi implementado por esta decisão; é documentação de direção.

### Checkpoint 2026-10-09 (b) — integrador: F0 do REX universal fechada (auditoria e contrato), Experimental

Expectativas congeladas em `e6a56860`; resultado em `docs/rex_profiles/integration_20261007/FECHO-F0-AUDITORIA-CONTRATO-2026-10-09.md`. Auditoria reproduzível de 70 arquivos (`data/rex_profiles/integration_20261009/auditoria/`): motor 50 / perfil 7 / misto 7 / caso 6; achados corrigem `docs/14` §2.1 (dois perfis com mecânica duplicada, `inspection.rs` e `sprite_composition.rs` como maior débito de generalidade, executor m68k parcial já existente em `rex-gameplay`, SHA-256 implementado seis vezes). Contrato em tipos sem uso em produção: `rex_evidence.rs` (L0–L6, base obrigatória de L3 em diante) e `rex_profile_spec.rs` (esquema + validação estrita); rascunho do pulo como dado em `data/rex_profiles/specs/` reproduz o `locate()` do código na ROM sintética e em ROMs reais (Sonic 1: 1, Delta: 3 instâncias idênticas). Gates: `cargo test --lib` 961/0, clippy/fmt/check:tree/lint/tsc rc=0; único arquivo de produto existente alterado: `decomp/mod.rs`. Jornadas desktop não reexecutadas por declaração prévia (código morto). Próximo: F1 (içar mecânica genérica para os dois perfis; exige reexecutar jornadas). Pendências do operador: D1–D4 do doc 14. Sem push/merge/release/promoção.

### Checkpoint 2026-10-09 (c) — integrador: F1 do REX universal fechada (núcleo de edição, publicação e motor de perfis em dado), Experimental

Expectativas congeladas em `9543b256`; fecho em `docs/rex_profiles/integration_20261007/FECHO-F1-NUCLEO-DE-EDICAO-E-MOTOR-2026-10-09.md`. Extraídos `rex_edit` (Patch/apply/IPS estrito/plano de campos) e `rex_publish` (cópia+IPS sem sobrescrever) e promovido `rex_profile_engine` (subsumes/pair/follow); o pulo virou adaptador do motor com o perfil em dado `data/rex_profiles/specs/m68k.platformer_jump.v1.json` (experimental), com o `locate` antigo mantido só como oráculo de teste. Equivalência: `JumpInstance` completo idêntica em variantes sintéticas e em ROMs reais (Sonic 1: 1, Delta: 3). Segundo perfil sintético passou pelo mesmo corpo de teste em commit sem `.rs` (`cdfdd52b`; 10 fixtures). Binário `a56a60c7…` (build de `cdfdd52b`): canvas 87/87, perfil 24/24, `nodegraph-authoring` 13/13, gameplay allPass; **as 8 cópias e 8 IPS têm SHA idêntico aos do código antigo**. Gates: `cargo test --lib` 971/0, clippy/fmt/check:tree/lint/tsc rc=0, vitest 1018/0, `host:certify` rc=0. Limites: cobre só a classe subsumes/pair/follow; `counter_threshold_state_gate.v1` não migrado (F1b; risco de o esquema não cobri-lo); `inspection.rs` e `sprite_composition.rs` intocados. Sem push/merge/release/promoção. Pendências do operador: D1–D4 do doc 14.

### Checkpoint 2026-10-09 (d) — integrador: motor de perfis declarativos (conclusão de F0 + F1), Experimental

Base real encontrada `95138430` (a F0/F1 estreita da sessão anterior foi preservada e reutilizada). Expectativas congeladas em `48a9833e`; fecho em `docs/rex_profiles/integration_20261007/FECHO-MOTOR-DE-PERFIS-DECLARATIVOS-2026-10-09.md`; correções do plano em `ADENDO-CORRECOES-DO-PLANO-2026-10-09.md` (o `TraceBackend` só atende ao mock; execução isolada não demonstra chamada pelo jogo; efeito e trace não formam escala total; a rotina `$085A2` do SoR é idêntica à do Sonic em 160 bytes — registrado por ordem do operador, não reconferido; três perfis seguidos com zero código novo são sucesso). Não altera as "Decisões Arquiteturais Consolidadas".

Entregue: contrato `rex-profile-spec/v2` (capturas tipadas, restrições, empate explícito, projeção para nodes, procedência, vínculo com ROM, limites, evidência com referência e escopo; offset de arquivo × endereço de barramento × deslocamento de endereço efetivo); `rex_profile_engine`, `rex_profile_graph` (projeção e revisão do grafo), `rex_profile_registry` (perfis embutidos enumerados de `data/rex_profiles/specs/*.json` por `build.rs` + pasta de perfis em execução), `rex_profile_ipc` (comandos `rex_profile_catalog/locate/edit`; `rex_jump_*` removidos); `rex_edit`/`rex_publish` reutilizados. O pulo virou dado (revisão 2); `rex_platformer_jump.rs` e `rex_jump_ipc.rs` compilam só em teste (adaptadores + oráculos). Frontend genérico: `profileGraphBridge.ts`, `RexProfileLogicPanel.tsx`, `ProfileGraphBridgePanel.tsx`. Segundo perfil autoral `m68k.authored_timer_gate.v1` em `data/rex_profiles/authoring/timer_gate/`, commit só de dado `103ee686`, depois do congelamento `ece9823b` (512 arquivos, `sha256sum -c` OK), com o mesmo binário `08339204…`.

Provas: equivalência motor × código antigo (localização e grafo, mesma assinatura estrutural) em ROM sintética e em ROMs reais (Sonic 1: 1; Delta: 3); 4 grafos salvos antes da migração reabrem nas ROMs reais; mutação 15/15. Jornadas no binário `08339204…`: profile 24/24, canvas 87/87 com as 8 cópias e 8 IPS de SHA idêntico ao código anterior, nodegraph 13/13, consumers 24/24, layouts 85/85 na 2ª execução (a 1ª reprovou num clique bloqueado após reinício), jornada do segundo perfil 66/66. Gameplay: 1ª execução reprovou (14/19; Delta inconclusivo por G6 na variante `noop`, a ROM original, por validade do input nativo); **repetição no mesmo binário: allPass 19/19** (+88 impulso/segurar, +47 corte/toque, `b`/`c` sem efeito). Mutação no HEAD final 15/15; `host:certify` rc=0 READY. Gates em `103ee686`: check:tree/lint/tsc rc=0, vitest 1033/0 (6 skip), fmt/clippy rc=0, `cargo test --lib` 1008/0 (90 ignorados).

Limites: uma classe (`pair` + `subsumes` + `follow`), m68k; `counter_threshold_state_gate.v1` não migrado (F1b); o segundo perfil é sintético e não cego, e motivou um ajuste de validação antes do congelamento; consumo em execução não é observado em nenhum alvo; `inspection.rs`/`sprite_composition.rs` intocados; usabilidade humana não testada. Lacunas L1–L9 no fecho. Próximo (proposta, não implementada): `PROPOSTA-INVESTIGACAO-INSTRUMENTACAO-DO-CORE-2026-10-09.md`. Sem push/merge/release/promoção; PR #110 não integrada. Pendências do operador: D1–D4 do doc 14.

### Checkpoint 2026-10-09 (e) — integrador: confiança das evidências + F1b (classe contador→comparação→estado no motor compartilhado), Experimental

Base `d8b1e0cf`. Expectativas congeladas em `7e0fe350`; fecho em `docs/rex_profiles/integration_20261007/FECHO-F1B-EVIDENCIA-E-CLASSE-SEMANTICA-2026-10-09.md`. Não altera as "Decisões Arquiteturais Consolidadas". Sem push/merge/release/promoção; PR #110 não integrada.

**Evidências por origem** (`rex_evidence_origin.rs`, `data/rex_profiles/evidence/curated.json`): toda afirmação de execução é `declarada` (só o JSON do autor), `histórica curada` (registro embutido, com relatório+SHA, binário, commit, ROM, instância e arquivo de perfil a que se aplica) ou `observada pelo aplicativo` (com identificador da sessão); o resto é desconhecido. Perfil de pasta nunca herda curadoria; registro só vale para ROM + instância + arquivo de perfil listados; integridade do registro não é veracidade. Negativos N1–N5 escritos e vistos reprovar antes (`fcf9a462`), verdes depois. Nada foi apagado: 8 registros do pulo (4 herdados de antes da migração) e 1 da classe semântica (prova de 2026-09-28, herdada).

**F1b:** esquema novo `rex-semantic-profile/v1` (o `rex-profile-spec/v2` e os hashes dos dois perfis v2 não mudaram); o registro escolhe a classe pelo esquema do arquivo e o motor pelo `analyzer.kind`; o analisador é `crates/rex-gameplay`, reutilizado sem alteração. A classe passou a usar catálogo, localização (com `declared_regions`), projeção/revisão do grafo (a revisão re-deriva da ROM), persistência no grafo da entidade, anti-obsoleto, `rex_edit::Patch` e `rex_publish::publish_pair`. Removidos do produto: comandos `rex_gameplay_*`, `RexGameplayRulePanel` e a escrita própria; `rex_gameplay.rs` compila só em teste. Blocos `recovered_rule` já gravados não são apagados: o painel os mostra como formato anterior e preenche a região para re-recuperar. Seleção sempre rotulada (candidato por varredura estrutural | região declarada); chamada externa continua opaca.

**Demonstração:** variante autoral executável nova (`data/rex_profiles/authoring/counter_gate/`, ROM `df1b57b1…`; outros registradores, endereços, passo, ordem do `CMP` e operador `<`; não cega). Referência independente = core Libretro: 60 casos na original e 60 na cópia editada (limiar 40 → 100), 0 divergências em processo e pela interface; 5 casos mudam; só contador e estado são comparados. Binário `acc49225…` (de `f018c762`): `semantic-gate-journey` 50/50, `jump-profile` 24/24, `jump-canvas` 87/87 com 8+8 SHA idênticos, `profile-authoring` 66/66, `nodegraph-authoring` 13/13 — todas na 1ª execução. **`jump-gameplay-journey` REPROVOU (14/19; Delta inconclusivo por validade do toque) e não foi repetida**; a leitura dos 11 relatórios versionados mostra que a falta de confirmação do input no toque ocorre em todas as execuções, com qualquer binário (`gameplay-validade-do-toque.md`) — causa da falta de confirmação não isolada. Mutação 22/23, sobrevivente fechado com teste. Gates: cargo 1026/0 (92 ignorados), vitest 1026/0, clippy/fmt/tsc/lint/check:tree rc=0, `host:certify` READY.

**Correções por adendo:** `103ee686` contém também um gerador Python auxiliar (não é "só dados"); resíduo de pilha é pista, não comprovação temporal de chamada (investigação não implementada).

**Limites:** uma classe semântica, um analisador, 12 instruções, só o limiar editável; segundo perfil da classe semântica não demonstrado; aceitar a classe custou código de motor (~720 linhas em `rex_profile_semantic.rs`); a variante executável é autoral; consumo em jogo comercial não observado; usabilidade humana não testada. **Pendente para quem continuar:** estabilizar a confirmação do toque no `jump-gameplay-journey` (medição, não REX) antes de usá-lo de novo como regressão; pendências D1–D4 do doc 14.

### Checkpoint 2026-10-10 — missão 3 em andamento (diagnóstico de input, ainda sem fechamento)

Retomada no checkout `/home/misael/Projects/REX-INTEGRATION-2026-10-05`, branch `codex/rex-integrator-sonic-103104`, HEAD `c2c26b6562b62423ad7e2819cb37352f32111cb2`. Árvore limpa na reconciliação; `host:diagnose` READY (fingerprint `60249508…`). Binário **não** reconstruído: `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25`, frontend `index-QJIgg2kn` com commit de build `8814a910a1ef07f96b7d99d19f71b8f2235b584e`. O commit `c2c26b65` só altera o harness externo. O gate de commit do frontend vale para inspeção, não para `jump-gameplay-journey`. Gameplay 14/19 e mutação 22/23 continuam falhas preservadas. Estado e comando exato: `docs/rex_profiles/integration_20261007/MISSAO3-ESTADO-2026-10-10.md`.

Diagnóstico v2.2 concluído (saída 0, `allPass` nulo; quantitativo em `DIAGNOSTICO-INPUT-v22-2026-10-10.md`; não aprova a regressão). Canvas novo concluído: saída 0, 87/87, manifesto `d2312b9916a013ba9745305cb4970ab36f6a48743d00f82d5c622b723d5e3f5e`. Primeira `jump-gameplay-journey` v3 concluída com saída real **1**: relatório `jump-gameplay-2026-10-10T03-48-51-643Z-report.json`, **18/19**, falha única `delta.G2_imp` toque +13 contra o teto 12. A segunda corrida não foi executada. Detalhe em `JOGADA-GAMEPLAY-v3-A-2026-10-10.md`. As quatro tentativas sem salto têm o botão lido pelo core e efeito físico ausente; borda do jogo e aptidão do personagem permanecem desconhecidas (`ANALISE-TENTATIVAS-SEM-SALTO-v3-2026-10-10.md`). Adendo v4 (`v4-quadros-exatos`, exatamente 3/120 quadros do core pelos controles da interface) registrado antes de medir. A calibração curta dos itens 1 a 9 passou no mesmo binário `40c98750…`: saída 0, 44/44, relatório `jump-gameplay-2026-10-10T08-58-59-365Z-calibracao-passo.json`. Cada passo do core foi +1 e a segunda leitura 200 ms depois não andou; a apresentação não acompanhou o core e não decide. O aperto de 3 foi lido nos quadros 43–45 e a soltura no 46. A distinção seguinte, saída 0, leu 3 quadros (36–38, soltura 39) e 120 quadros (40–159, soltura 160) na mesma sessão e época. Uma tentativa de toque no original, saída 0, teve N=3 exato e ápice 47 px; não é veredito G. O protocolo não commitado `v4-controle` tem calibração preservada em `04-calibracao-v4-a/` (saída 0, 156/156; não é jornada nem veredito G) e fica fora desta medição. As duas jornadas `v4-quadros-exatos` terminaram com saída real 0 e 19/19, no mesmo binário `40c98750…` e no mesmo harness, sem edição entre elas. Relatórios `jump-gameplay-2026-10-10T09-19-02-947Z-report.json` (SHA `6525f9eb…`) e `jump-gameplay-2026-10-10T13-42-03-665Z-report.json` (SHA `8db655f3…`). G2 ficou em +88 na segura e +5 no toque, teto 12 intacto. Isso fecha o par automatizado e não reclassifica a v3 (18/19). Não é confiabilidade de teclado em tempo real. G7 é observação visual, fora dos 19 checks. O motor está congelado em `08100d31`, manifesto `CONGELAMENTO-MOTOR-2026-10-10.sha256` (516 arquivos, SHA `e541f5e9…`), antes do segundo perfil semântico. O segundo perfil `m68k.counter_equality_state_gate.v1` entrou depois, no commit `7113e762`, sem Rust ou TypeScript de produção. A jornada `semantic-gate-journey` no binário `40c98750…` saiu 0, **49/49**, relatório `semantic-gate-2026-10-11T01-07-05-187Z-report.json` (SHA `2f2814dc…`): igualdade sem guarda, passo 2, só contador e estado; dois casos mudam ao limiar 12. Não é descompilação universal. A bateria nova de mutação, na árvore `8b4a0681`, matou 23/23 por teste nomeado; baseline depois 287 passed e 0 failed. Relatório `11-mutacao/mutacao.json` (SHA `e76c8249…`). O 22/23 antigo permanece. `jump-profile-journey` no mesmo binário saiu 0, **24/24**, Sonic 1 e Delta (`jump-profile-2026-10-11T01-25-34-104Z-report.json`, SHA `43ae7100…`). `profile-authoring-journey` saiu 0, **66/66**, temporizador autoral (`profile-authoring-2026-10-11T01-27-41-888Z-report.json`, SHA `b865aed3…`). `nodegraph-authoring` no mesmo binário saiu **1** na primeira corrida (1320 Hz em 7,29) e **0** na segunda, 13/13, com 1320 Hz em 1244 (`nodegraph-authoring-2026-10-11T08-34-57-984Z-report.json`, SHA `db9dbd62…`). A primeira não é reclassificada. O som neste binário não ficou estável. Os oito gates na árvore `1ce5378e` saíram 0, inclusive `host:certify` READY com fingerprint `60249508…`. G7 foi observado nas capturas das duas jornadas: o sprite da segura de `both` aparece acima do original (`OBSERVACAO-G7-APICE-v4-2026-10-11.md`). Isso não fecha a missão. Proposta futura, não implementada: libretro alternativa com amostra de PC (`PROPOSTA-LIBRETRO-ALTERNATIVA-PC-2026-10-10.md`); o binário `40c98750…` continua a identidade das provas atuais. **Missão em andamento.** Sem push, merge, release ou promoção.

### Checkpoint 2026-10-27 (b) — SGDK: grafo C sem perdas ligado ao build (Experimental)

Auditoria pedida pelo operador: o importador lia o C por padrões de linha (sem parser) e os nodes heurísticos não entravam no build; editar node não mudava a ROM. Operador aprovou parser real (`tree-sitter` 0.25 + `tree-sitter-c` 0.24, registrado em `02_TECH_STACK.md`).

Entregue: `src-tauri/src/core/sgdk_c_graph.rs` — cada `.c/.h` de `src/` e `inc/` vira árvore de nodes (função → bloco → statement; `if/switch/case/laços/#if` estruturados; o resto vira folha de C bruto editável). Toda faixa de bytes pertence a uma folha → regeneração byte-a-byte. Índice `rds/code/index.json` com funções, chamadas, `entry_points` e máquinas de estado (`switch` com ≥2 `case`). Overlay legado gera/atualiza `rds/code/` no import e na reabertura; grafo existente nunca é sobrescrito (fonte alterada → `stale`). Build overlay: se o C regenerado difere da raiz, copia a raiz para `rds/.rds/c_build/run_<ms>/` (symlinks preservados, `out/rom_head.bin` copiado para o wrapper) e compila lá; raiz original intacta; fonte alterada fora do Studio com grafo editado → build recusado. IPC `sgdk_c_graph_index/file/update_node` (edição reconstrói a estrutura e mantém o SHA-base; só arquivos do índice). UI: `CGraphPanel` no Explorer ao selecionar `src/`/`inc/` `.c/.h` do host — árvore de nodes, editor de C por node, "Aplicar ao C".

Provas: round-trip exato **86/86** arquivos Mugenesis (1145 funções, 33 FSMs) e **57/57** OpenBOR (326 funções, 4 FSMs); erros de parse localizados (`#if` dentro de inicializador, `__attribute__`; 759 nodes Mugenesis concentrados em `mg_gen/*` gerado, 13 no OpenBOR) ficam como C bruto, sem perda. Build real Mugenesis pelo wrapper oficial: ROM do C original e ROM do C regenerado dos nodes (com edição neutra) **idênticas** `8a85d300…` (teste ignorado `legacy_sgdk_overlay_c_graph_real_rom_equivalence`). Edição semântica chega à ROM provada só com wrapper falso (`legacy_sgdk_overlay_builds_c_regenerated_from_edited_c_graph`); no wrapper real não exercitada. OpenBOR não teve build (o `rds/` existente lá não é overlay do Studio; não foi tocado).

Limites honestos: nodes são C estruturado, não blocos visuais de alto nível (vocabulário NodeGraph/emitter não foi conectado a esse grafo); FSM = `switch` detectado, sem semântica de transição; `.res` continua somente leitura; import genérico (não overlay) segue no caminho heurístico antigo; UI não exercitada no app Tauri real; Windows sem wrapper. `scripts/new-host.test.mjs` falha 6/19 também sem estas mudanças (`work_root_must_be_a_non_hidden_subdirectory`, ambiente).

### Checkpoint 2026-10-27 (c) — SGDK grafo C: edição real chega à ROM, OpenBOR compilado, blocos, transições de FSM e painel no app Tauri (Experimental)

Fecha os cinco itens pendentes do checkpoint (b).

- **Blocos (vocabulário NodeGraph):** statements simples viram `block` (`call` ou `assign`) com `node_type` do vocabulário existente (`sprite_move`, `sprite_anim`, `spawn_entity`, `destroy_entity`, `input_held`, `scroll_tilemap`, `action_sound`, `dma_budget`, `palette_op`, `vdp_op`, `sprite_op`, `system_op`, `set_variable`, `c_call`). Editar os campos reescreve só aquele statement (`update_c_graph_block`, IPC `sgdk_c_graph_update_block`). Chamadas com comentário nos argumentos não viram bloco (sem perda). Corpus: Mugenesis 12892 `set_variable`/2000 `c_call`/+ SGDK; OpenBOR 1421/866/+ SGDK.
- **Transições de FSM:** atribuições a subjects de `switch` ou a variáveis com nome de estado (state/mode/phase/step/scene), e chamadas set/change/goto/enter/switch…State/Scene/Mode. A origem vem do `case` ou do `if (var == X)` que envolve; sem guarda = `*` ("qualquer"). Flags booleanas e destino único não viram FSM. Índice recalculado após cada edição. Corpus: Mugenesis 45 FSMs/64 transições; OpenBOR 19 FSMs/70 transições (ex.: `actor->state` → `OB_ST_GROUND/ATTACK/DEATH`). Muitas transições ainda com origem `*` (guarda não local).
- **Robustez corrigida:** grafos não editados agora são reconstruídos com o parser atual ao reabrir (antes, grafos antigos ficavam sem blocos para sempre). O build pelo wrapper SGDKForge roda sempre numa cópia `rds/.rds/c_build/run_*` com saída padrão `out/`. Isso elimina a dependência de `out/rom_head.bin` (que impedia compilar o OpenBOR) e nunca escreve no host. `src/inc/res`/arquivos da raiz são copiados, o resto vira hardlink, e só a cópia do build atual é mantida. A cópia anterior duplicava o projeto inteiro: o `rds/` do Mugenesis chegou a 11 GB, foi limpo nesta sessão, e as saídas de teste próprias em `out/tests` foram removidas.
- **Provas reais (wrapper oficial, `legacy_sgdk_overlay_c_graph_real_rom_equivalence --ignored`):** Mugenesis original = regenerado `8a85d300…`; bloco `gApp.transitionFrames = 12 → 13` (`src/core/app.c`) → `29e0791f…`. OpenBOR (primeiro build pelo Studio; `rds/` tinha só `.gitkeep` e virou overlay) original = regenerado `3e3c58cf…`; mesma edição → `9459fdac…`. O `out/rom.bin` antigo do OpenBOR (`60526807…`) é anterior a 10 fontes, então não é comparável.
- **App Tauri real (Xvfb `:173`, driver E2E, binário `0f8c371da299593c70e5499bf52ef6dfa3179c4286dd6fd11cdbfcb2f8d73cd9`, cenário `sgdk-native-c` estendido):** 10/10 passos. Abrir → build original `8a85d300…` com recibo → input nativo → painel aberto em `src/core/app.c` → valor do bloco editado no formulário → grafo persistido → Build & Run → ROM `29e0791f…` com recibo, diferente da original, renderizando → raiz C intocada → grafo restaurado → reabrir. A 1ª tentativa falhou por o cenário não voltar ao Explorer após o build (corrigido no cenário). O painel foi movido para cima do preview "Read-only", após inspeção da captura. Relatório: `scratchpad/e2e-native-c/sgdk-native-c-2026-10-28T01-48-08-910Z.json`; capturas em `src-tauri/target-test/validation/`.

Limites: os blocos cobrem statement simples (chamada/atribuição); laços/condições editam como C. A FSM é inferida por convenção de nomes e guardas locais, sem prova de equivalência semântica. Gameplay da ROM editada não foi exercitado além do boot. Sem aceite humano; o chip "READ-ONLY HOST" do resumo do overlay ainda aparece. Windows sem wrapper.

### Checkpoint 2026-10-28 — SGDK C nativo: origem de transições por caminho reverso, cena capturada do VDP e VRAM real (Experimental)

Três problemas relatados pelo operador.

**1. Transições com origem "qualquer".** `sgdk_c_graph` agora faz caminho reverso:
- cada transição guarda a função, as condições (locais e dos chamadores, classificadas em `input`/comando, `timer`, `collision`, `state`, `event`) e os efeitos do mesmo bloco (som, sprite, cena, scroll, paleta, VDP, com `node_id`);
- um índice global de pontos de chamada (todos os arquivos, até 4 níveis) sobe até o `case`/`if (var == X)` que guarda o estado;
- o casamento de estado aceita o mesmo campo final por outro caminho (`p->state` × `player.state`) e chamadas de troca pelo substantivo final (`APP_changeScene` × `gApp.currentScene`); nomes são tokenizados (verbo + substantivo final), com prefixos de hardware SGDK excluídos (`VDP_setScrollingMode` não conta);
- origem: `local`, `caller` (com `via` = cadeia `funcao@arquivo:linha`), `unguarded` (chamadores sem guarda de estado, mas com o gatilho do chamador ligado, ex.: `hit_ground` → colisão) ou `unknown`.

Corpus: OpenBOR origem conhecida 18 → **37/70** (local 18 + chamador 19), Mugenesis 10 → **20/64**; demais com gatilho ligado. Limite: chamadas por ponteiro de função/tabela não são seguidas. O painel mostra origem, via, gatilhos e efeitos clicáveis.

**2. Cena ilegível.**
- *Causa:* os recursos do Mugenesis são TILESET em fita (`hud_tiles.png` 1136×8); a tela é montada pelo C em runtime, então nenhum recurso isolado mostra o jogo.
- *Solução genérica:* `emulator/vdp_snapshot.rs` lê o VDP do savestate do Genesis Plus GX 1.7. O GPGX **não** expõe VRAM pela API Libretro (região 3 = 0 bytes, sondado). O layout `state.c`/`vdp_context_save` é ancorado pela WRAM byte a byte e validado pelos registradores do modo 5; cabeçalho ou WRAM divergentes recusam. VRAM em u16 LE (confirmado pela cadeia de links da SAT).
- *Recomposição:* planos A/B (tiles 4bpp, paletas, flips, scroll H tela/célula/linha e V) e sprites pela cadeia de links. Contra o framebuffer do próprio core no título do Mugenesis: **diferença máxima 4 níveis por canal (RGB565), 0 pixels acima de 8**; níveis de cor ~34/passo como o GPGX.
- *Gravação:* `core/rom_scene_capture.rs` grava `scenes/rom_capture_<nome>.json` + `assets/rom_capture/<nome>/` (plano B com backdrop, plano A, um PNG por sprite na posição da tela) e nunca sobrescreve. Botão "Capturar cena" (`capture_rom_scene`).
- *Limites:* prioridade por tile/sprite e plano Window não compostos; a cena é referência visual de um quadro; o painel de paletas acusa conflitos nessas imagens multi-paleta.

**3. Alerta de VRAM enganoso.** Era a análise estática da cena de entrada do Studio (4 KB do HUD), não o jogo.
- Projeto overlay C nativo agora tem `analysis_mode=native_c`: só os limites do Mega Drive, sem warnings estimados.
- `emulator_vram_usage` mede a VRAM real do core (snapshot do VDP quando a API não expõe), na barra superior ("VRAM real"), na barra de status e no painel de hardware.

**Provas:** E2E real `sgdk-native-c`, binário `3810f7eda26a8f9b50c3b8e52513381b89bf5e16514243543c985108994dee9f`, **12/12**: "VRAM real 13 / 64 KB" no medidor; captura com 15 entidades (2 planos + 13 sprites), ativa no editor e conferida na imagem (menu "ESCOLHA O MODO", Ken e Ryu); edição de bloco → ROM `29e0791f…` e demais passos anteriores. A captura do E2E ficou em `rds/scenes/rom_capture_quadro_20261028024108.json` do Mugenesis (overlay do Studio).

### Checkpoint 2026-10-28 (b) — Captura da ROM organizada por prioridade e linha de paleta; mapa de paletas A–D (Experimental)

Relato do operador: o painel de paletas acusava conflito em capturas, mas o jogo não tem conflito (cada parte da tela usa sua linha da CRAM). Também pediu tela coesa quanto a tile/sprite.

- **Causa:** a captura gravava cada plano inteiro como uma imagem; uma imagem misturava várias linhas de paleta e o planejador (corretamente) via >15 cores num recurso.
- **VDP (`vdp_snapshot.rs`):**
  - `plane_pixel` devolve índice, linha de paleta e prioridade de cada pixel dos planos A, B e Window. O Window segue R3/R17/R18 e substitui o plano A na região dele.
  - Sprites carregam o bit de prioridade.
  - A composição segue a ordem do VDP: backdrop, planos baixos, sprites baixos, planos altos, sprites altos. Sombra/realce e o limite por linha não são modelados.
  - Contra o framebuffer real continua com **diferença máxima de 4**.
- **Captura (`rom_scene_capture.rs`):**
  - Grava uma imagem por (prioridade, plano, linha de paleta) e um sprite por entrada da SAT, e cada entidade usa exatamente uma linha.
  - `scene.layers` segue a ordem de prioridade: `rom_planes_low`, `rom_sprites_low`, `rom_planes_high`, `rom_sprites_high`.
  - `scene.palettes` declara as 4 linhas da CRAM (`cram:pal0..3`, banco fixado, `uses` das entidades).
  - O planejador do build fica sem erro (teste em `plan_megadrive`).
- **Mapa de paletas (`PalettePanel`/`ViewportPanel`):**
  - Sempre visível sob o resumo, com uma linha por banco A–D (PAL0–3): ✓ ou "!", amostras e "n/15 usados · restam m".
  - O checkbox de filtro oculta no viewport os objetos daquele banco.
  - "Mapa de paletas no viewport" desenha sobre cada objeto um selo com a letra do banco, a cor do banco e ✓ ou "!", com a validação vinda do mesmo plano do build.
- **Não feito:** botão "otimizar paletas" (unir paletas parecidas), anotado pelo operador como futuro.

### Checkpoint 2026-10-28 (c) — Fluxo Cena ↔ Arte ↔ Lógica, lógica C acessível e etiquetas organizadas (Experimental)

- **Barra de fluxo (`StudioContextBar`):** segmentos Cena · Arte e animação · Lógica (nodes) · Interface, focados no objeto selecionado, em toda tarefa; a seleção é preservada.
  - Antes não havia "Cena", e "Personagem" designava a Arte.
  - Nomes unificados: o rail mostra "Lógica"; as tarefas são rotuladas "Arte"/"Lógica".
  - Botões adicionados: no Inspector, "Abrir na Arte" e "Editar lógica (nodes)" (este agora sempre visível); na Arte, "Ver na Cena" e "Editar lógica"; na Lógica, "Ver na Cena" e "Arte e animação".
- **Lógica:**
  - O estado vazio guiado ficava sob a barra flutuante, cortado e inacessível. Agora começa abaixo da barra, rola e respeita o painel lateral.
  - Em projeto C nativo a Lógica abre por padrão em "Código do jogo (C)" (`GameCodeLogic`): arquivos por pasta com contagem de FSM/funções, busca por arquivo/função/estado e o `CGraphPanel`, começando pelo arquivo com mais máquinas de estado. "Nodes do Studio" continua disponível.
- **Viewport:**
  - Selo de paleta, nome e modo de posição viram uma etiqueta única por objeto.
  - `viewportTagLayout.layoutTags` posiciona sem sobreposição (seleção primeiro); objetos na mesma origem formam lista empilhada.
- **Mapa de paletas:** cada banco tem cabeçalho, amostras numa linha e o estado abaixo.
- **Provas:** E2E real `sgdk-native-c` passou com o fluxo Cena → Arte → Lógica (código C) → Nodes → Arte → Cena, com a seleção preservada (capturas `*-flow-*.png`, 2026-10-28T09-23). O ajuste de layout do mapa de paletas (só CSS) veio depois e não foi repetido no app real: o host ficou sem memória (≈1 GB livre) e a janela do WebKit deixou de redimensionar. Gates frontend verdes.

### Checkpoint 2026-10-28 (d) — Zoom da Arte e sprite capturado ligado ao recurso e ao C (Experimental)

- **Zoom da Arte:** `getInitialSourceZoom` usa a área visível real do stage, sem o teto fixo de 2×. Peças pequenas (8–32 px) ampliam em passos inteiros até 24×, e folhas grandes reduzem para caber. "Ajustar" usa a mesma regra.
- **Ligação sprite → recurso → C (`core/rom_sprite_link.rs`):**
  - Na captura, cada sprite da SAT é procurado pixel a pixel (cores em 3 bits por canal, como o VDP, com ou sem espelhamento) nas folhas `SPRITE` dos manifestos (`project_mgr::sgdk_sprite_resource_images`), pré-filtradas pelas cores. Peças com menos de 8 pixels opacos não são ligadas.
  - O símbolo do recurso é procurado no C indexado. Uma referência fora de função (tabela/array) é seguida uma vez pelo nome da tabela até as funções que a usam.
  - Cada referência traz arquivo, linha, função (do grafo C) e `node_id`.
  - O resultado fica em `assets/rom_capture/<nome>/links.json` (IPC `rom_capture_links`).
- **UI:**
  - Inspector e Lógica (código C) mostram "No código do jogo": o recurso, o retângulo na folha e as funções que o usam.
  - O clique abre a Lógica em "Código do jogo (C)", no arquivo, com o node selecionado e rolado até ele (`codeFocusStore`, `CGraphPanel.focusNodeId`).
- **Prova real (Mugenesis, quadro do menu):** 13/13 sprites ligados em 2,2 s.
  - Ken → `mg_ken_g0` (`res/mugen/ken/sheets/g0.png`) e Ryu → `mg_ryu_g0`, com o retângulo exato de cada peça. Os dois seguem pela tabela `sheets` até `frameRenderBounds()` em `src/mg/mg_fight.c:1556`.
  - Sombra do Ken → `mg_ken_shadow`, usada em `scene_demo_fight_init()`.
- **Não validado no app real:** o E2E foi bloqueado pelo ambiente.
  - (1) O shell passou a ter `WAYLAND_DISPLAY=wayland-0` e o app abria no desktop real, onde a janela não redimensiona. Para o E2E, rodar com `env -u WAYLAND_DISPLAY GDK_BACKEND=x11 DISPLAY=:173`.
  - (2) Em seguida, o build Wine falhou porque o tmpfs `/run/user/1000` (1,5 GB) está cheio. A causa é `forge-sessions/1bf5a050/audio.raw` (1,5 GB), de outra sessão (Xvfb `:100`), que não foi removida.
- **Atualização (d):** E2E real `sgdk-native-c` **14/14** com o tmpfs liberado (rodar com `env -u WAYLAND_DISPLAY GDK_BACKEND=x11 DISPLAY=:173`).
  - A captura teve 17 entidades e 13 sprites ligados.
  - O Inspector mostrou `mg_ken_shadow`; o clique levou à Lógica com `MG_fightUseSharedShadow(&mg_ken_shadow)` (`scene_demo.c:1692`) selecionado e o editor do bloco aberto.
  - O node é centralizado só dentro da árvore (antes rolava a página e escondia as abas).

### Checkpoint 2026-10-28 (e) — Corpus SGDK real no app: catálogo de sprites, reabertura robusta, falhas de build claras (Experimental)

- **Importador:**
  - Grava `rds/assets/sprites/sgdk_sprite_catalog.json` (frame do `.res`, colunas/linhas, asset do overlay, refs no C; IPC `sgdk_sprite_catalog`). A Arte fatia pela grade do catálogo.
- **Reabertura (`legacy_overlay_needs_reimport`):**
  - Um overlay `rds/` existente volta pelo importador quando não abre ou quando faltam índice, grafo C ou catálogo. Antes, reabrir pulava o importador.
  - Se só a cena de entrada sumiu, ela é reapontada para outra cena válida (`main.json` primeiro) e o resto é preservado.
  - Só depois disso ocorre o backup em `rds/.backup/overlay_<ms>/` (com `motivo.txt`) e a recriação.
- **Build:**
  - A recusa do wrapper traz o motivo concreto, lido do log do make ou da linha `wine_bridge_status=blocked`.
  - No playtest, o bloqueio de ROM Mastering vira aviso: continua bloqueando exportar, mas não cobre a cena.
- **Lógica:** pastas com código vêm antes dos headers sem função.
- **E2E real `sgdk-corpus`, 15 pastas com `src`:**
  - Todas abrem, mostram o C em nodes e (com SPRITE no `.res`) o sprite na Arte.
  - Fluxo completo (build → captura com 0 conflito de paleta) em HAMOOPIG, Mugenesis (sprite → C ✓), OpenBOR, REINA_CHAN (sprite → C ✓), FORGE_REFERENCE e TAIKETSU HERO ×2.
  - Recusa do wrapper "título SAMPLE PROGRAM": KIRBY, Celestial ×2, SMOKE_TEST e TAIKETSU REBIRTH ×2. É política do SGDKForge; corrigir em `rom_head.c` do projeto.
  - SHADOWDANCER não tem `build.bat` nem Makefile.
  - BLAZE tem rescomp acima de 15 min (o build passa do orçamento do E2E).
- **Limites conhecidos:**
  - `#if` dentro de inicializadores fica como C bruto.
  - Ponteiros de função não são seguidos.
  - Recursos IMAGE viram uma cena cada (BLAZE tem 29).

### Checkpoint 2026-10-28 (f) — Editor de pixels Mega Drive na Arte (Experimental)

- **Onde fica:** modo "Editor de pixels (MD)" na Arte, ao lado de "Preparar e animar". O layout segue o do Piskel adaptado ao Studio: ferramentas à esquerda, canvas no centro, prévia/paletas/hardware/layers/transformar/exportar à direita e frames embaixo.
- **Modelo (`src/core/pixelEditor.ts`):**
  - Cada pixel é `linha*16+índice`, e o índice 0 é sempre transparente.
  - Cores em 9-bit (0..7 por canal).
  - O canvas é sempre múltiplo de 8.
- **Ferramentas, com atalhos:** lápis P (pincel 1–8, espelho ↔/↕), borracha E, balde B, trocar cor A, reta L (Shift 0/45/90), retângulo R e círculo C (Shift perfeito, cheio opcional), dithering D, clarear/escurecer U (na mesma linha, por luminância), seleção S, mover M (wrap, todos os frames/layers), conta-gotas I.
  - X troca primária e secundária; `[` e `]` mudam o pincel; H/V espelham; Ctrl+Z/Y desfaz e refaz.
- **Paletas:**
  - 4 × 16 da CRAM com o índice 0 marcado, contagem "n/15 usadas · restam m", editor 9-bit e as 512 cores mestras.
  - A "trava de paleta por tile" recusa misturar linhas num tile 8×8.
- **Hardware:** cores e tiles únicos (dedup com flip), VRAM, peças de até 4×4 tiles por frame e carga por scanline (limite 20), com avisos.
- **Animação:** frames (novo/duplicar/mover/excluir), onion skin e prévia de 1–24 FPS, que pode gravar a duração em ticks de 60 Hz. As layers são de edição; o export junta tudo.
- **Importar:** "Editar frames de …" quantiza a folha da Arte numa linha só. Para sprite do jogo, usa o quadro e a grade do `.res` e o nome do recurso.
- **Salvar:**
  - Grava uma folha horizontal em PNG 4-bit indexado (o formato que o rescomp lê) e `.rdspixel.json` editável, ambos em `assets/sprites/pixel/` (IPC `save_pixel_art_asset`/`load_pixel_art_doc`).
  - Em seguida recarrega na Arte.
  - Copia a paleta CRAM em C e a linha `.res`.
- **E2E real `pixel-editor` (Mugenesis):** `mg_ken_g121` com 64×64 e 2 frames entrou em PAL0 (8/15 cores, 95/97 tiles únicos, 4 peças, 2/20 por scanline). Depois uma reta foi desenhada e o arquivo salvo como PNG 128×64, 4-bit, tipo 3.
- **Não feito:**
  - Shadow/Highlight.
  - Atributos por tile (prioridade/flip) e tilemap.
  - Exportar GIF ou ZIP.
  - Seleção laço e por cor.
  - Atribuição automática de várias linhas de paleta.
