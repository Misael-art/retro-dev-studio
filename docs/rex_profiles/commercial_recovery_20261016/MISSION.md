# Recuperação comercial REX — missão 2026-10-16

Registro de experimentos e decisões desta missão; estado canônico em docs/06_AI_MEMORY_BANK.md.
Agente único; Experimental; sem push, merge remoto, release ou promoção.

## M0 — reconciliação e inventário (consolidado)

Integração limpa em 03ddc59de38cc3d9c448b893da72a3efd575030a, branch codex/rex-integrator-sonic-103104; pesquisa limpa em ee8c581f07494c22100c688f09f02db0caacd56b, branch codex/rex-rea-lab-20261015. Base comum 3aee11283d2edc4a9163ea4993ee64625538530b. Worktree próprio derivado da integração, codex/rex-commercial-recovery-20261016. Nenhum cherry-pick: comparação e copy_grid já incorporados no destino; pesquisa reverse8 continua fora do produto.

| Capacidade / implementação e commit | Local / entrada | Origem da prova herdada | Limite / próximo elo |
|---|---|---|---|
| Perfis declarativos, identidade, revisão, publicação (fechos F0/F1/F1b em integration_20261007) | App, assinatura automática + revisão assistida | pulo Sonic/Delta e segundo perfil autoral; históricos separados | PC/chamador/args não medidos; universal é direção |
| Comparação assinada / SemanticEngine, 628a422e + 8b6c70af + e830381f | App, região declarada 0x240..0x25E | autoral, GUI 63/63; guarda/opaca 55/55, herdados | edição somente limiar; operador/topologia não compiláveis |
| copy_grid, 2f078dc2 | App, região declarada; width byte/word | autoral GUI 60/60; BYOR em harness isolado | chamada comercial e consumidor gráfico desconhecidos |
| Cena gráfica copy_grid v1, d394296c | App, fixture SGDK assistida | autoral FAIL 86/89; RAM/delta causal aprovados | três falhas de cor preservadas, nunca PASS |
| Oráculo/cena v2, d8be191e + 03ddc59d | QA + app existente, mesma cena | autoral 88/88 ida e volta; zero tolerância RGBA | correção autorizada posterior à falha; não prova comercial |
| BYOR Enigma/copy_grid, 50363df3 + d394296c | App, seleção estática + amostras por quadro | comercial, dois episódios sem diferença visual | ausência de diferença não prova ausência de chamada; não repetir sem hipótese nova |
| aPLib raw, af5d5d0/d769629/ad3ff57 e manifest 2026-09-27 | App, header estrutural + edição UI | HAMOOPIG 558bea6c…, um recurso em tela por dois pixels | artefato local precisa ser localizado; classe semântica desconhecida; não é prova atual |
| Nemesis/MD gfx/SS walls, d85485b1 | App, perfil e seleção assistida | Sonic: 16 frames de paredes + 13 pares de objetos, pixels do core | somente leitura; entrada por RAM preparada; cores antigas derivadas empiricamente |
| reverse8 relacional, pesquisa ee8c581f | Só pesquisa, limites declarados | comercial em harness + variantes autorais A/B; 512 inputs cada | sem nodes/lowering no produto, sem consumo no jogo |
| TraceBackend existente | App, mock apenas | PC sintético por contador de quadros | não atende core real; frame-end/RAM não demonstram chamada |
| nodegraph-authoring / som | App | histórico de falha e sucesso no mesmo binário | pendência OPEN separada, sem reclassificação |

Números acima são históricos, não testes executados nesta missão. Evidência nova M0: diagnóstico READY, reconciliação Git e auditoria de integridade/disponibilidade. Auditoria distingue MATCH, MISMATCH, ABSENT e PRESENT; ausência não é reprovação funcional ou aprovação. Manifestos herdados permanecem intactos.

## Índice inicial de experimentos (M0)

O índice consolidado de protocolos, execuções e resultados está no adendo de auditoria de conclusão ao fim deste diário. As duas entradas abaixo são o registro inicial preservado.

| ID | Hipótese / entradas | Comando / orçamento | Resultado / decisão |
|---|---|---|---|
| M0-HOST-001 | host satisfaz lock dd99a22f… | rtk npm run host:diagnose, 60 s | exit 0, READY; fingerprint 60249508… |
| M0-AUDIT-001 | manifestos pinados ainda disponíveis e íntegros | rtk proxy node scripts/rex_profiles/commercial_recovery_20261016/audit.mjs data/rex_profiles/commercial_recovery_20261016/m0-audit.json, 60 s | consultar relatório; somente integridade, sem execução funcional |

## Proteção e reprodução

Refs Git dedicadas e bundle incremental contra base comum, verificação e hashes registrados em data/rex_profiles/commercial_recovery_20261016/protection.json. Bundle fora do repositório em /home/misael/rds-scratch/commercial_recovery_20261016/; exclui corpus e builds. Sua restauração exige a base comum já presente. Checkouts originais intocados.

Retomada: a partir deste worktree, `rtk proxy node scripts/rex_profiles/commercial_recovery_20261016/audit.mjs` faz auditoria somente leitura; para registrar, passar caminho novo inexistente. M0 não aprova M1–M5. Próximo: congelar Sonic fase especial e instrumento externo após confirmar pins e superfícies existentes. Nenhuma execução comercial nova nem alteração de produto até aqui.

M0-AUDIT-001 retornou exit 1: 131 MATCH, duas divergências nos documentos canônicos recém-atualizados pela própria missão, zero ausências. O resultado bruto foi preservado. O auditor agora compara esses dois arquivos também com os bytes do checkpoint original, sem mudar manifestos herdados; DOCUMENT_ADVANCED somente se o hash histórico confere. M0-AUDIT-002 registra a reconciliação, não converte alterações de evidência em aprovação.

Fechamento M0: M0-AUDIT-002 exit 0, 131 MATCH + 2 DOCUMENT_ADVANCED + 4 PRESENT, sem ausências/divergências inexplicadas no conjunto auditado. `npm run check:tree` e `git diff --check` passaram. Gates funcionais não repetidos: somente documentação e auditor externo foram alterados. Bundle verificado e referências protegidas. M0 não certifica produto novo.

## M1 — alvo congelado

`data/rex_profiles/commercial_recovery_20261016/m1-freeze.json` fixa identidade, regiões, hipótese, domínio de endereços, episódio preparado, edição mínima, controles, orçamento e parada antes da instrumentação comercial. Seleção assistida; presença de paredes/objetos na tela é evidência herdada, não nova execução. Original do corpus foi lido e seu SHA confere. Cadeia estática tem consumidor de cópia conhecido; a apresentação e chamada atuais permanecem desconhecidas. Entrada natural e equivalência entre runtimes não são presumidas. Não repete os dois episódios anteriores. M2 precisa qualificar coleta antes de abrir a execução comercial.

## M2 — qualificação autoral antes do comercial

Qualify-009 passou quatro execuções autorais: positivo, sem chamada, outros argumentos/destino e coleta capada recusada. Identidade errada é recusada nas três capturas completas. Foram conferidos quatro bytes distintos de leitura/escrita, máscaras do barramento16, CURPC de cada operação e sete transferências às portas VDP por valores/ordem; não apenas contagens. No-call chega ao breakpoint da continuação sem entrada, portanto essa parada sozinha não demonstra chamada/retorno. Os controles não qualificam DMA interno.

Tentativas001–006 preservadas: modo Lua wx inválido; crash na binding bpset sem parâmetros opcionais, diagnosticado sob GDB; wrapper shell confundido com ELF; PC bruto com prefetch; A7 exposto como SP. Não são falhas de ROM/produto nem PASS. Qualify007/008 passaram;009 acrescentou fronteiras exatas de input/preparação por frame notifier antes da medição comercial. `m2-instrument-freeze.json` fixa instrumento, qualificação e orçamento. Nenhum dado comercial foi executado nessa qualificação. Próximo comando: `rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/run-commercial.py commercial-001`.

## M2 — observação comercial medida; marco ainda aberto

Commit de instrumento congelado: 17cd5bca46aa8dcc96fc66a0e68f8844eb3be3b9.
`commercial-001`: MAME0.289 ELF fcb54790…f2f3bc1, ROM c7da53a1…c81ebb;
1290 callbacks de frame, Start ativo500..509, byte preparadoFFF600=10 no1110.
Execução real9,06s, exit0; 126239 eventos, 55395908 bytes privados,
SHA035d4db022a2de533f86632a07cc20b75593143ebea9f9c0a932ba0d9e6fc4b7.
Nenhuma perda declarada; orçamento não excedido. Não é a sessão do aplicativo.

| Requisito → implementação | Teste / resultado novo | Limite |
|---|---|---|
| Identidade de ROM/runtime/instrumento | hashes por manifesto, identidade em cada evento e sequência contínua | runtime separado MAME; não herda sessão GX |
| Chamada de descompressão | PC171E, retorno empilhado1B6D8, A0=65432 A1=FF4000 D0.word=0; retorno com SP+4, A0 avançou634 | entrada preparada, não caminho natural |
| Recurso → buffer | snapshot4096 SHA322a1483…44d0 confere pin anterior | saída desse recurso apenas |
| Buffer → consumidor de cópia | 4096 leituras e4096 escritas na instrução1B6F8; endereços/bytes exatos | região declarada, largura original1 |
| Referência independente do destino | índices64×64, stride128, buracos zerados observados antes da cópia; scope8128 SHA b691f262…801ba46 idêntico | consumidor após setup LEAs; A0/A1 no entry ainda são valores anteriores |
| Consumidores posteriores | leituras em1B212/1BD18/1BD1C/1BD24/1BD28/1BD7C; 1639 escritas VDP posteriores | sequência temporal não fecha dependência de dados até imagem |
| Recusas do verificador |10/10: run errado, tempoCPU reverso, gap, caller, source/destination, valor, largura, terminal ausente e perda | mutações do registro original; não execuções adicionais de ROM |
| Tempo | uma regressão36ns na fronteira callback de preparação→primeira leitura; relógioCPU não regride | tentativa de verificador global estrito reprovou e está preservada; não se inventa clock corrigido |
| Apresentação | duas tentativas de snapshot não criaram arquivo: lookup':screen' ausente | falta enumerar dispositivo real e qualificar captura; nenhum PASS visual |
| Correspondência app/GX | auditoria local identifica replay existente que restaura estado inicial | não executada; estado preparado externo precisa identidade própria e adendo antes da medição |

Prova nova é consumo e cópia no runtime externo; **M2 não fechado**, pois faltam
qualificação da superfície gráfica necessária, correspondência com o episódio
do aplicativo e host:certify da instrumentação. **M3–M5 não iniciados**; não se
muda de classe para contornar o gate. Nenhuma transformação foi publicada.

## Restrição de recursos observada — histórico antes de 2026-10-17

`host:diagnose` continuaREADY para dependências. Isso não reserva recursos.
Durante a preparação do próximo job, leituras sucessivas mostraram2,3–2,7GiB
MemAvailable e swap elevada. O preflight atual está em
`data/rex_profiles/commercial_recovery_20261016/host-resource-block.json`, exit75.
A regra aplicável de `docs/rex_profiles/ROUND_STATE.md`, seção "Regras de execução
e job pesado", exige reavaliar RAM/swap e adiar abaixo de cerca3GiB. Nenhum
processo alheio foi encerrado nem memória/swap/cache alterados.

Para destravar: disponibilizar janela sem jobs pesados concorrentes e pelo menos
3GiB de RAM disponível, com swap estável. Não é necessária dependência nova nem
aprovação arquitetural. A preparação por replay pode reutilizar
`emulator_play_replay`/ReplayCapture existente; isso evita inventar IPC de escrita
em RAM, mas ainda exige congelamento e teste no app. O próximo experimento deve
ter adendo antes de executar: enumerar screen, qualificar CPU vs callback clock,
observar VDP/DMA necessário, gerar replay GX preparado e comparar os elos
relevantes, com IDs separados. Não substituir o trace MAME por PC sintético.

## Reprodução inicial — comandos históricos

Neste worktree, verificação leve reproduzível (usar saída inédita):

```sh
rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/verify-commercial.py /home/misael/rds-scratch/commercial_recovery_20261016/commercial-001 /home/misael/rds-scratch/commercial_recovery_20261016/reverify-001.json
```

Primeiro comando de retomada do trabalho pesado, que recusa recursos insuficientes
antes de iniciar certificação e preserva relatório/log em scratch próprio:

```sh
rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/preflight.py --certify
```

Após o host permitir, requalificar qualquer instrumento alterado com novo ID e
adendo; não rerodar o mesmo episódio só para produzir verde. A reprodução histórica
intacta está em `VISUAL-COPY-V2-REPRODUCE.md`; v1 continuaFAIL86/89, v2 autoral88/88
ida/volta herdados, BYOR1/2 e somOPEN separados. Nenhum gate herdado é contado
como teste executado agora. Build/E2E e certify desta nova instrumentação ausentes.

Artefatos comerciais (ZIP derivado, events com valores, snapshots de buffers) somente
em scratch privado. Git recebe métricas, hashes, resultados delimitados e instrumentos.
Nenhum fonte de jogo/disassembly/ROM foi importado. O app existente SHA
74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e foi auditado;
não foi recompilado nem usado em nova jornada. Produção Rust/TS alterada:0 linhas;
novo motor transferido:0; não há alegação de generalidade comercial demonstrada.

Estado dos processos: execuções MAME/GDB da missão terminaram; nenhum daemon ou
job pesado ficou em background. Checkouts de integração/pesquisa permaneceram
limpos e nos HEADs reconciliados. Worktree da missão contém apenas seus commits,
node_modules compartilhado por symlink com lock idêntico e relatórios gerados.
Backup incremental inicial e checkpoint final ficam no scratch; base comum
3aee1128 é requisito de restauração. Missão **não concluída**.

## Adendo operacional 2026-10-17 — janela de recursos recuperada

Às06:36UTC, três amostras acima3GiB e swap em queda permitiram iniciar
`preflight.py --certify`, serialmente. A restrição anterior é histórico preservado,
não justificativa para encerrar agora. Certificação ainda em execução no commit
que registra este adendo; nenhum resultado verde pressuposto. O agregador canônico
usa seu cargo-target nativo, sem copiar build/corpus nem escrever em checkout alheio.

`m2-followup-addendum.json` fixa a próxima revisão ANTES de qualquer execução dela:
observe-v2.lua enumera screens, explicita contexto de clock, amostra20 entradas
D762 cujo retorno é1B268 e observa SATFFF800..FFFA7F/mappings. O qualificador
original congelado é reaproveitado por adaptador, sem mudar expectativas autorais.
A nova revisão só passou sintaxeLua até aqui; qualificação e comercialv2 pendentes.
O instrumento original, seu qualificador e o comercial001 continuam intactos.
Após terminar certify e passar preflight, próximo comando independente:
`rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/qualify-v2.py qualify-v2-001`.


## Estado vigente — 2026-10-17, M2 aberto

As seções anteriores registram etapas históricas. A primeira certificação terminou READY em `certify-20261017T063614Z`: frontend 1045 PASS/3 SKIP, Rust 1036 PASS/93 IGNORE; sem falhas. Uma nova certificação está em execução após a correção de apresentação descrita abaixo; o resultado anterior não certifica essa alteração.

`qualify-v2-002/003` reprovaram a hipótese de que o bitmap ativo do screen correspondia à PNG apresentada. Falhas e entradas preservadas. `m2-snapshot-target-addendum.json` congelou a leitura do mesmo alvo apresentado, via video.snapshot_pixels, antes de `qualify-v2-004`: quatro controles autorais passaram e três pares RGB32/PNG foram exatos, com mutante de um pixel recusado. Isso qualifica captura, sem criar um oráculo visual independente do jogo.

`commercial-v2-001` observou novamente Enigma/copy, vinte cabeças do laço de construção de sprites (não vinte chamadas), SAT e portas VDP; 66.893.989 bytes privados, SHA75ad10d3…638b13. Duas capturas da cena comercial real foram produzidas. Transferências DMA internas e dependência completa até pixels ainda não foram provadas.

`prepared-replay-001` reprovou por pressupor pitch640 no core. `m2-app-replay-pitch-addendum.json` precedeu `prepared-replay-v2-001`: fonte RGB565320×224/pitch1440, linhas empacotadas para640 como o callback existente; nenhuma calibração de cor. O layout inicial copiado confere b691f262…801ba46. A comparação com o layout FINAL do MAME reprovou: houve uma escrita posterior em um byte no runtime externo. Essa falha continua registrada. O adendo de correspondência restringiu a comparação à fronteira de cópia inicial previamente prevista/observada; não equipara as duas sessões.

`ui-correspondence-001` no binário74033134…670e passou identidade, recusas de ROM/estado, controle de framebuffer errado, replay nativo, RGBA de referência e RAM. Reprovou na igualdade canvas/core; não houve aprovação da jornada nem execução de original-repeat. A escuta de frames estava acoplada ao loop que avança a execução, ausente quando carregado pausado. A correção genérica em andamento mantém uma assinatura passiva e identifica os eventos por ROM carregada, época e sequência independente do contador rebobinável. `m2-paused-presentation-addendum.json` foi congelado antes de medir o novo binário. Não há escrita de pixels pelo harness nem frame adicional para disfarçar a falha.

Produção Rust/TS agora alterada nesta correção; a antiga métrica zero pertence ao checkpoint anterior. Nenhuma dependência adicionada ou core substituído. node_modules deste worktree possui links para dependências existentes com lock idêntico; caches mutáveis ficam locais. M3–M5 continuam não iniciados. Próximo: terminar certificação, build canônico próprio e repetir a jornada afetada com novo ID/hash, preservando a reprovação anterior.

` sprite-analysis-001 ` reprovou a suposição de que todas as vinte amostras pertenciam ao mapping da parede. Fonte/falha preservadas. `sprite-analysis-002` verificou os dezessete descritores cobertos: cinco leituras e oito bytes de escrita SAT por registro, valores/endereços/ordem exatos (136 bytes), usando interpretação estática de coordenadas assinadas, tamanho, link e base de tile. Três amostras no endereço9FA9 foram excluídas explicitamente por não terem domínio de leitura coberto. Quatro controles de trace adulterado recusados; referência autoral literal e quatro resultados incorretos discriminados. Análise posterior do registro existente, não expectativa reservada nem prova de M4, DMA interno ou framebuffer independente.

Certificação pós-correção `certify-20261017T100758Z` terminou READY, sete gates exit0:1047frontend/3SKIP e1036Rust/93IGNORE. O ajuste final de guarda durante carga reutiliza a recusa por época nula já testada; lint/TypeScript serão reconfirmados no build final. Clippy default e fmt complementam o gate Linux --lib. Observerv3 somente passou sintaxe; qualificação/comercial ainda pendentes.

Build canônico pós-correção terminou exit0: binário próprio `src-tauri/target-test/debug/retro-dev-studio`, SHA22dc259a3275e1ac8687a4072b241fba81c934e36cde5b474a027f7527c25347. TypeScript -b/Vite e build nativo passaram; fmt --check passou. A spec `app-spec-correspondence-v3-paused-fix.json` conserva replay, RAM, RGBA, core, dimensões e critérios da tentativa reprovada, alterando somente app_sha256, id e output; freeze antes da nova corrida em m2-rebuilt-app-replay-freeze.json. Nenhum PASS de canvas foi pressuposto. Preflight após build adiou E2E por swap em crescimento; RAM acima3GiB.

Auditoria pós-correção exit1 preservada:125MATCH+6MISMATCH+2DOCUMENT_ADVANCED, sem ausências. Os seis deltas são runner/viewport/frame_buffer, cada um citado em dois manifestos herdados. A reconciliação separada verifica seus hashes no checkpoint03dd, documenta alterações intencionais e confirma código de conversão de pixels byte-idêntico. Manifestos históricos intactos, sem reclassificar o audit bruto como PASS.

`app-correspondence-v3-paused-fix-001` no binário22dc259a…5347 passou34/34: duas épocas distintas,180frames exatos por replay, igualdade RGBA referência/core/canvas e quatro regiões de RAM pinadas. ROM/estado errados recusados; framebuffer esperado errado reportou mismatch. Correspondência GX original/original com referência separada do mesmo core; não é oráculo independente do jogo nem equivalência temporal com MAME. A comparação MAME é apenas o layout inicial copiado, conforme adendo anterior. Cleanup: cinco processos acompanhados, zero vivos; Xvfb próprio encerrado pelo wrapper. Regressão autoral v2 no novo SHA iniciada, resultado não pressuposto.

Regressão autoral v2 no binário22dc259a…5347 passou88/88 ida e88/88 volta, três cargas por jornada com referência/core/canvas exatos;162bytes e3309posições de pixels, publicação/persistência/reabertura/patch e reversão exata. Prefixos10-23-59-498Z e10-25-51-342Z; controles/expectativas herdados como regressão reutilizada, medições agora novas. Ambas encerraram oito processos próprios, zero vivos. Sem claim comercial derivado dessa fixture.

Antes da primeira execução v3, inspeção da fonte MAME corrigiu o armazenamento dos registradores:32u16, não32u8. Draft original preservado em3847a41b; adendo storage-002 e hashes de observador/qualificador atualizados antes de medir. A v3 deve passar quatro casos originais, três pares PNG/native target e quatro casos DMA antes de autorizar comercialv3.

## M2 — revisão v3 e limite temporal da apresentação (2026-10-17/18UTC)

Qualify-v3-001 passou quatro controles originais, três pares PNG/mesmo alvo e quatro casos DMA: habilitado, desabilitado, outra origem/destino e incompleto recusado. A captura interna é somente leitura via save items; fonte MAME0289 confirma registradores armazenados em32u16. Comercial-v3-001 terminou em10,016s,185405eventos,89.765.275bytes, SHA7a6ee735…d62bc2. Entrada/retorno/cópia e dez negativos passaram. Dezessete registros/136bytes de SAT conferiram, três amostras9FA9 excluídas.

A análise DMA001 reprovou seu controle de valor errado: o primeiro byte adulterado não tinha escrita anterior observada e era depois sobrescrito. Fonte/resultado preservados. Adendo002 restringiu esse controle a bytes com escrita precedente conhecida, mantendo todas as expectativas positivas. DMA002 passou quatro recusas;67transferências de SAT e67de paleta,41.116bytes reobservados após escritas,2.182leituras não pareadas excluídas. Últimos640bytes SAT e128bytes paleta conferem exatamente com destinos VRAM/CRAM finais. Arte249tiles emVRAM142 confere SHA5c36a38a…02860. Isso qualifica o elo de transferência no MAME, não hardware nem sessãoGX.

Origem ampliada8192bytes contém segunda metade NÃO zerada, SHA bcb49f12…92064; predição width2 do destino12224bytes SHA4a51997c…6e8e4 foi produzida antes de qualquer edição comercial. Não publicar presumindo cauda vazia ou correspondência temporal entre runtimes.

Witness visual001 reprovou:8217pixels projetados,6912divergentes, tolerância0. Modelo normal de sprites usa SAT/VRAM/CRAM1290 e paleta oficial MAME; todos os15RGB esperados existem na captura, mas isso não aprova geometria ou alinhamento temporal. Não selecionar retrospectivamente um frame que coincida. Próximo: qualificar fase de apresentação com fixture autoral de sprite atualizado por IRQ6/DMA e sinal conhecido, congelando o alinhamento antes de nova comparação comercial. M2 ainda aberto; M3–M5 não iniciados.

Clippy padrão exit0 e lint final exit0. Nova certificação após DMA foi adiada pelo preflight:1,3–1,5GiB disponíveis e swap crescente; sem job pesado iniciado, nenhum processo alheio encerrado. A certificação READY1047/1036 anterior é preservada, não reclassificada.

## Estado vigente — M2 consolidado, M3 em preparação

Qualificação autoral de fase IRQ/DMA:1024pixels exatos, quatro quadros de treino e treze reservados; fase errada e identidade errada recusadas. Adendo anterior à medição comercial002:8482pixels reais conferem com tolerânciaRGB0;48pixels encobertos excluídos por domínio. Os16sprites projetados têm vínculo layout→lookup→descritor→SAT→DMA,715escritas verificadas e cinco negativos recusados. FF4000 é buffer descomprimido antes da cópia e tabela reutilizada depois. Falha visual001 permanece FAIL6912/8217; não foi apagada nem reclassificada.

Certificação pós-fase certify-20261018T012359Z READY:1047frontend/3SKIP,1036Rust/93IGNORE, sete gates exit0. App22dc259a…5347 mantém jornadas34/34 e regressões autorais88/88ida+volta; fmt/clippy padrão/lint passaram. Cadeia original assistida observada no MAME, com correspondência GX restrita à fronteira inicial da cópia; não são a mesma sessão. Nemesis não teve entrada/chamador traçados. Projeção usa estado observado e não é oráculo contrafactual da edição. Aceite e mapa requisito→teste→limite: data/rex_profiles/commercial_recovery_20261016/m2-bounded-acceptance.json.

M3 inicia pela preparação original-only de referências GX antes de editar, incluindo fonte8192bytes não presumida zerada e instante inicial da cópia. M3–M5 ainda não demonstrados. Experimental; sem push/release/promoção. Missão em andamento; histórico de falhas, BYOR e somOPEN preservado em MISSION.md.

Retomada exata: `rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/preflight.py`; congelar o gerador original-only GX e suas expectativas antes de medir. Não executar cópia comercial antes de congelar origem ampliada, episódio e referência visual independente no escopo declarado. Checkpoint local de fechamento e bundle incremental verificado protegem esta etapa; metadados de proteção registram o commit efetivamente incluído, sem hash circular.

## M3 — preparação original-only e referências condicionais

M2 fechado no domínio declarado em d9d0dc54; ref m2-closed/bundle004 verificado, metadados protection-mission-004.json. M3 continua em preparação: nenhuma cópia comercial executada. Survey GX original encontra cópia concluída no quadro137; framebuffer180 repete referência exata. Cauda4096bytes é bcb49f12…92064, não zerada, igual em todas as fronteiras amostradas e ao MAME. Isso não prova estabilidade intraquadro.

GX autoral qualificado separadamente: antesDMA atraso0, depoisDMA atraso1;1024pixels por quadro e13quadros reservados por caso exatos. Primeira hipótese255 incorreta FAIL preservada; adendo usa conversão GX239 já qualificada, não captura. Modelo independente de descritores/SAT passou cinco quadros originais176–180:10245/10317/10390/10461/10534pixels, RGB0, tiles e cores errados recusados. Coordenadas/câmera/frame e bits de seletor de paleta0x6000 são entradas medidas explícitas; ponteiro/tile/flip/prioridade pinados. Hipótese inicial de base inteira imutável reprovou e permanece preservada. Modelo não prevê trajetória/física nem cena completa. Próximo: preparar jornada comercial no runner canônico, congelar cópia/reversão e predição causal independente antes de executar a primeira edição. M4/M5 pendentes; Experimental, sem push.

Experimentos: `m3-gx-reference-001` PASS (90s/180frames; observado3,866s), `gx-phase-qualify-001` FAIL cores, `gx-phase-qualify-002` PASS duas cadências (90s;1,089s), `m3-original-model-inputs-001` PASS (90s;0,378s), `m3-original-model-verification-001` FAIL base imutável, `...002` PASS cinco pares sem nova execução do jogo. Cada freeze/data aponta instrumentos, entradas e hashes; dados de RAM/ROM/arte/capturas privados. Ambos os verificadores reprovados continuam intactos. O modelo visual nunca recebe framebuffer para construir expectativas.

Fonte oficial pinada `Genesis-Plus-GX/46a55214d0dab654e5a525ae0c54921ca9716872/core/state.c` e `core/cart_hw/md_cart.c` consultada: save/load inclui RAM/contextos/registradores e remapeia bancos para cart.rom carregada. Não assumir identidade de ROM no save-state; a identidade do aplicativo e os bytes de cópia devem ser conferidos separadamente. Sem novo core/dependência.

Retomada: `rtk proxy git status --short`; adaptar somente QA da jornada `semantic-gate-journey` para replay preparado e modelo condicional, conservando editor/ponte/publicador/persistência canônicos. Congelar spec/expectativas antes de medir; resultados autorais permanecem regressão separada.

## M3 — jornada comercial candidata congelada antes da primeira execução

Spec `m3-forward-journey.json`, freeze `m3-forward-freeze.json`: byte112376(1B6F8)12→32, cópia prevista SHA cb471c95cd72fd3f82c725b70d2654fadd2b9672ced80fee772528a0cc1ad97a; checksum original inválido, política existente o preserva. Destino12224bytes previsto4a51997c…6e8e4; world16384bytes width1/2 independentes em scratch. Constructor não aceita imagem, recebe somente RAM de controle e fontes pinadas; executado sobre original179 passou10534pixels. Expectativa é gravada ANTES de ler a captura final180. Replay179 e180 partem ambos do estado original pré-rotina, total359frames na sessão; copiar path do replay para a ROM carregada não muda estado/inputs nem conteúdo esperado. A fonte oficial pinada confirma remapeamento para cart.rom atual no carregamento do estado, sem restaurar bytes de ROM normal; execução causal precisa conferir destino previsto e identidade carregada.

QA estende apenas o cenário canônico semantic-gate-journey para sonda preparada e modelo condicional; editor/IPC/ponte/persistência/publicador de produção intactos. Controles nativos: ROM errada, região adulterada, domínio3 e no-op recusados; patch adulterado comparado por aplicador independente; resultado antigo rotulado valores-anteriores. Controle de resposta atrasada de outro contexto continua testado na suíte do componente, distinto deste controle E2E de resultado antigo. Câmera/coordenadas/animação/paleta medidos não viram alegação de previsão da física. Nenhuma cópia comercial foi executada até este freeze. Restauração depende de jornada reversa própria; não pressuposta.

Comando exato, serial, preflight e display próprio: `rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/run-native-journey.py data/rex_profiles/commercial_recovery_20261016/m3-forward-journey.json data/rex_profiles/commercial_recovery_20261016/m3-forward-freeze.json m3-native-forward-001`. Orçamento600s, um job pesado. AST Python, sintaxe dos dois módulosJS e check:tree passaram. Nova instrumentação QA ainda requer certificado final; não alterar SHA de produto para acomodar oráculo.

## M3 — ida/volta comerciais medidas, complemento de sequência pendente

No app22dc259a…5347, ida110/110 e volta110/110 passaram no cenário canônico. Cópia cb471c95…ad97a difere só em1B6F8, IPS independente exato; reversão restaura SHA c7da53a1…81ebb. Persistência, fechar/reabrir, republicação, original/original, no-op, ROM/região errada, domínio3, patch divergente e resultado antigo passaram. Original10534pixels, editada8067pixels e2008posições condicionais que rejeitam width1: RGB0, core/canvas exato, destino12224 e SAT independente conferem. Referência não usa captura modificada; controles de geometria/estado são explicitamente medidos. Falha001 de envelope de recusa preservada, adendo002 corrigiu apenas QA. Nenhuma alegação de trajetória completa/hardware.

M3 ainda receberá complemento explícito de prévia comercial ANTES da edição na mesma sessão e controle de stream Enigma adulterado. As corridas110/110 ficam preservadas; sem mudança de oráculo/tolerância. Depois, nova certificação da instrumentação QA e checkpoint protegido. M4/M5 pendentes; missão em andamento, Experimental.


M3 sequência003 FAIL124/126: prévia comercial/bytes/pixels/persistência/publicação passaram, remoção+desfazer não. Screenshot mostra header copy_grid atrás da toolbar fixa após remontar workspace; alvo nativo top+8 não foi conferido. Emulador pausado permaneceu carregado; interferência de captura de teclado é hipótese, não diagnóstico provado. Adendo seguinte usará Stop visível+Enquadrar e guardará hit-test do card antes de Delete. Não relaxar controles estruturais. Resultado e fontes003 preservados neste checkpoint.

## M3 — sequência canônica completa medida

No app22dc259a…5347, prévia comercial antes da edição → Stop → nodes/edição MOVE.B↔MOVE.W → Salvar → encerrar/reabrir → cópia/IPS → episódio preparado → comparação → reversão passaram. Cópia cb471c95…ad97a, um byte1B6F8, IPS independente exato; retorno restaura ROM SHA c7da53a1…81ebb e RGBA13723a0e…ae5f1. Originais intactos; stream Enigma adulterado, região adulterada, ROM errada, domínio3/no-op, patch divergente, resultado antigo, cor errada e largura antiga recusados. Resposta atrasada de outro contexto é controle da suíte do componente, separado do controle E2E de resultado antigo. 10534pixels originais/8067editados,2008posições condicionais discriminantes, RGB0 e core/canvas exatos. Trajetória/câmera/coordenadas/animação/paleta são entradas observadas; sem alegar física/cena inteira prevista. Expectativa não recebe captura modificada.

Falha003124/126 preservada: header sob toolbar; Stop+Enquadrar+hit-test real antes de Delete passaram sem relaxar guardas. Corridas anteriores110/110 preservadas como etapa anterior. Certificação da árvore QA final pendente, depois proteger fechamentoM3; M4/M5 pendentes. Experimental; sem push/release/promoção. Processos das jornadas encerrados, zero vivos.

Reprodução final: freezes m3-forward-freeze-v4.json / m3-reverse-freeze-v3.json e specs correspondentes, com saída privada inédita por execução. Ver run-native-journey.py; wrapper verifica pins/preflight, cria Xvfb isolado e encerra somente processos próprios. A reversa usa a cópia da ida004, mesmo SHA congelado. Metadata/controles em m3-*-complete-sequence-qualified.json; RAM/imagens/replays/ROMs derivados privados. Gate de resposta atrasada: ProfileGraphBridgePanel.test.tsx, teste copy-grid que descarta resposta antiga; certificado frontend o executa. Não chamar controle de rótulo E2E de simulação de resposta atrasada.

## M4 — reconstrução e estado congelados, antes da execução editada externa

`m4-freeze-v2.json` fixa região30bytes1B6E8..1B706, IR CopyGrid existente (sem bytes de proveniência), MOVEQ/LEA/MOVE.B↔W/DBRA e reconstrução por encode. O teste BYOR ignorado existente será executado explicitamente junto de quatro testes autorais/negativos da classe; saída original-rebuilt deve ter SHA da ROM inteira original, modified-rebuilt deve coincidir com cópia publicada pela UI. Sem nova alteração de produção/classe/dependência.

Contadores reais recuperados: D1 externo, D2 interno, condição low16 após decremento !=FFFF; D0 preservado. Modelo inicial congelado em m4-freeze.json atribuía D0/D1 incorretamente; análise original001 coincidia nos valores porque D0/D1/D2 eramFFFF na saída. Essa análise e fonte ficam preservadas, sem qualificar os papéis. Adendo v2 e quatro vetores com D0=12345678 distinguem os papéis, N/Z/V/C/X e ponteiros com gap final. Análise original002 passou4096 leituras/escritas, snapshot8128 e A0/A1,D0/D1/D2,A7,stack-top,SR; é análise pós-observação de registroM2 existente, não holdout. Demais registradores, stack interior, interrupções e efeitos externos não comparados.

O observerv3 já qualificado permanece byte-idêntico e cobre FF1020..FF5FFF. `run-edited-commercial-v2.py` compõe o runner congelado, redirecionando explicitamente UMA entrada de ROM hardcoded à cópia pinada, conservando execução/instrumento/validador/orçamento. Raw report herdado fica intacto, inclusive textos de escopo original que NÃO descrevem a cópia; adapter-result identifica a execução modificada real e os substitui explicitamente. Nenhuma execução editada MAME até este freeze. Verificador semântico é separado, com seis controles de identidade/operador/fluxo/destino/estado/CCR.

Nodes já contêm source/destination, incrementos, contadores DBRA/FFFF, origem, mappings, limites/desconhecidos e fluxo composto entre entrada/cópia/saída. `m4-ui-journey.json` congela abertura nativa dos detalhes e repetição da edição de opcode pela mesma ponte. Não habilita edição de topologia nem afirma CFG arbitrário/flags medidos pelo app. Estado/CCR é comparação QA externa declarada; o backend estático não recebe badge de consumo automaticamente. Referências comerciais M3 são regressão reutilizada nesta etapa.

Primeiro comando pesado após terminar certifyM3: consultar m4-freeze-v2.json, passar preflight e executar semantic_reconstruction_test.command (caminho BYOR com espaços corretamente citado). Depois observar commercial-m4-width2-001, verificar estado e executar jornada M4 de detalhes; sempre serialmente. Certificação M3 ainda em andamento quando este adendo foi preparado.

## Fechamento M3 e retomada M4

M3 PASS128/128 ida+128/128volta no SHA22dc259a…5347, com prévia anterior à edição, persistência/fechar/reabrir/cópia/IPS/execução/comparação/reversão exata. Certify020824Z terminou READY:1047frontend/3SKIP,1036Rust/93IGNORE, sete gates exit0. Escopo e mapa requisito→teste→limite em m3-bounded-acceptance.json; referência condicional medida explicitamente, não previsão de física/cena inteira. Falhas001 e003, etapas110/110 e históricoM2/v1/BYOR/som permanecem visíveis.

M4 congelado antes da execução externa editada em m4-freeze-v2.json: usar IR CopyGrid existente, reconstrução sem bytes salvos, condição DBRA e estado delimitado. Contadores reais D1/D2, D0 preservado; hipótese inicial D0/D1 errada é preservada e substituída após sentinelas distintas. Original002 passou4096leituras/escritas, memória e registradores observados/CCR, quatro vetores sintéticos do verificador; não é holdout nem qualificação CPU autoral. Próximo: cinco testes de reconstrução/recusas incluindo BYOR ignorado, depois MAME editado com observerv3 idêntico e jornada de detalhes dos nodes; um job pesado por vez. M5 pendente. Sem alteração adicional de produção; Experimental, sem push.

M4 testes de reconstrução/recusas:5PASS/0FAIL/0IGNORE, incluindo BYOR explicitamente executado. Original-rebuilt SHA c7da53a1…81ebb; modified-rebuilt e publicação SHA cb471c95…ad97a, IPS b48421f3…5969f9, iguais aos da UI. Comercial MAME editado001 observou entrada/saída/cópia no mesmo observerv3 byte-idêntico,8,443s,89.498.968bytes, traceSHA bcf11b25…267454. Raw result herdado preserva textos de escopo original inapropriados; adapter-result.json identifica explicitamente a ROM modificada e substitui esses textos. Ainda não aprova comparação de estado.

Join pós-observação dos registros de expectativa M3:15sprites da cópia projetados têm origem nos4096bytes Enigma primários (offsets7..529); nenhum vem da cauda incidental. Assim8067pixels retidos e2008posições condicionais discriminantes pertencem à cadeia primária. Sem novo critério visual nem leitura de captura modificada; não é holdout. Metadados em m3-edited-primary-resource-origin-join.json. Manual primário M68000PM/NXP pinado por SHA em m4-isa-primary-reference.json, páginas impressas4-90/91,4-110,4-116,4-134 corroboram condições/CCR; não modificam expectativas.

## Fechamento M4 — comportamento composto recuperado e comparado

IR CopyGrid existente regenerou30bytes sem cache de origem: original-rebuilt igual à ROM inteira c7da53a1…81ebb; edited-rebuilt igual à cópia UI cb471c95…ad97a. Cinco testes Rust PASS/0IGNORE, incluindo BYOR normalmente ignorado, com recusas de operador/fluxo/mapa/alias. MAME editado no observerv3 byte-idêntico observou4096MOVE.W/8192bytes; destino4a51997c…6e8e4, A0FF6000/A1FF4020, D1/D2FFFF e D0 preservado; SR2300 previsto/observado (original2304). Seis negativos de trace recusados. Hipótese inicial de papéis D0/D1 preservada, corrigida antes do trace editado e discriminada por quatro vetores de sentinela/CCR.

Jornada nativa M4 passou135/135, incluindo sete checks dos detalhes de nodes: operações/contadores DBRA/FFFF, estado/pointers, origem e desconhecidos, com edição de opcode e efeito comercial pela ponte canônica. Sem novo código de produção/classe/core. M3 permanece128/128ida+volta; último certifyREADY1047frontend/1036Rust em fontes de produção idênticas. Estados externos não viram badge estático do app. Demais registradores/stack/IRQs/ciclos/áudio não comparados; referência visual condicional explicitamente medida, não física prevista. Mapa em m4-bounded-acceptance.json. Próximo: proteger checkpoint e congelar seleção/expectativas M5 para implementação diferente, sem contar Kosinski compartilhado. Experimental; missão em andamento, sem push.

## Checkpoint 2026-10-18 UTC — M5 candidato genérico congelado; validação final pendente

M0–M4 mantêm os aceites delimitados e falhas históricos. M5 encontrou cópias contíguas MOVE.B/W/L + DBRA único com LEA absolute-short/long/PC-relative e MOVEQ/MOVE.W, diferentes do loop aninhado primário. Primeiro alvo Golden Axe: chamada real observada,432bytes, D/A completos e SR previstos, seis negativos recusados; uma leitura ROM não-transferência explicitamente separada em adendo após falha original preservada. Batman/MUSHA não atingiram regiões no episódio congelado; ToyStory atingiu duas vezes mas verificador ainda recusa leituras de código sobrepostas à janela de fonte. Não são PASS de estado nem bloqueios funcionais dos jogos.

Extensão genérica do mesmo CopyGrid/ponte/publicador, sem despacho por título/hash, atribuída ao primeiro alvo Golden Axe; perfil genérico revisão2, domínio discreto1,2,4 para cópia contígua e contrato anterior1,2 para grade. Sete testes Rust PASS/0IGNORE incluem quatro regiões comerciais, reconstrução tipada original/editada e publicação; aplicador IPS independente exato nas quatro. Quarenta testes frontend da ponte PASS. Primeira tentativa de publicação falhou ENOSPC no TMPDIR da sessão (/run/user/1000 cheio); repetição usa scratch privado em disco, sem apagar arquivos alheios. Não contar sete testes como jornada UI nem como três transferências zero-código.

Freeze de produção e custos sem testes em m5-generic-adaptation-freeze.json; quatro ROMs reservadas até esse freeze. Próximo: sondar reservados sem alterar produção, congelar correspondência GX original/efeito de memória para Golden Axe, construir app final e executar UI/ida+volta afetadas e host:certify. M5 e missão permanecem em andamento; Experimental, sem push. ROMs/dumps/capturas apenas scratch privado.


## M5 — quatro transferências estáticas reservadas, efeito editado externo qualificado

Após freeze do motor5e7516e, Gargoyles/ShinobiIII/CastleIllusion/Strider passaram consecutivamente no backend sem código Rust/TS nem perfil genérico novo: reconstrução tipada original/editada, publicação e IPS independente exatos. Leitura dos payloads começou apenas após freeze genérico; antes só identidade. Isso mede transferência estática/publicação em regiões declaradas: os quatro episódios1200quadros não observaram chamadas e NÃO contam como quatro consumos comerciais nem falhas funcionais. Métrica/limites em m5-reserved-transfer-qualified.json; nenhuma alegação de corpus globalmente inédito.

GoldenAxe editado (.L→.W) observado em MAME:108iterações/216bytes, restante216bytes preservado, A0/A1+216, D0FFFF e SR2708 previstos/observados; seis negativos recusados. V4 generalizado confundiu primeira palavra da fonte (exit+2) com leitura de código: falha preservada. Adendo usa verificadorv2 já congelado, que distingue MOVE-PC de DBRA-PC e só exclui uma leitura final pinned depois de todas transferências. Reanálise pós-observação, sem nova captura/tolerância. Original432bytes/MAME e GXframe6 têm SHA5163dca0…7dada. Expectativa width2 d7a2a748…d7991 vem da ROM original e destino antes, não de captura editada.

Sondagem GX001 iniciou erroneamente após preflight75: preservada/rejeitada por protocolo de recursos. Sondagem002 passou após preflight0, mesmo modelo/episódio; gerou replay do estado original antes do trecho. Scratch temporário privado evita TMPDIR da sessão cheio sem eliminar arquivos alheios. UI canônica receberá adaptador QA genérico de cópia contígua pela mesma ponte/replay/core/read-only memory IPC, sem segundo pipeline de produto. Build final em andamento; M5 nativo, regressões finais e certify pendentes. Missão em andamento, Experimental.


## M5 — falha nativa001 e correção genérica de identificação de plataforma

App277a14f3…a8269b construiu com êxito, mas UI001 falhou em pre-edit.loaded_paused após nodes/detalhes. GoldenAxe usa console name antigo SEGA+12espaços; extração preservou bytes mas nome original.gen virou original.bin. Publicador também produz.bin. Detector atual aceita.bin apenas com SEGA MEGA DRIVE/SEGA GENESIS; standaloneGX/MAME não têm essa restrição. Falha/log/binárioSHA/commit preservados em m5-native-first-failure.json; critérios de ROM/cópia/memória não mudam.

Adendo anterior à nova medição: aceitar genericamente console-name exato16bytes SEGA+12espaços, com teste autoral positivo, nome desconhecido de trailingX e cabeçalho truncado recusados. Sem regra por jogo, alteração de ROM, core ou dependência. Custo extra de plataforma atribuído ao primeiro GoldenAxe, além do motor REX. Métrica reservada permanece recuperação/publicação estática, medida com REX congelado; não equivale a quatro jornadas nativas/consumos. Novo binário e novos freezes serão necessários; regressões preparadas para277a ainda não executadas serão substituídas por adendo de SHA antes de medir.


## Retomada 2026-10-19 — apresentação em resolução nativa

Reconciliação: integração03ddc59d e pesquisaee8c581f limpas; missão existente df688146, mesma branch isolada derivada da integração. Dois JSON não rastreados preexistentes (`m5-adaptation-cost.json`, `protection-mission-011.json`) preservados byte a byte. Bundle011 SHA conferido e `git bundle verify` exit0; nenhum checkout de outra frente alterado. Novo host:diagnose READY, fingerprint60249508…6e2.

A tentativa nativa002 já existente é FAIL em `pre-edit.current_canvas_equals_core`: replay original pinado256×192 contra canvas fixo320×224. Ela havia passado identidade/replay/memória, sem aprovar a jornada. Adendo `m5-canvas-dimensions-addendum.json` registra falha/log/hash e correção genérica antes de nova medição. Viewport passa a pintar a resolução do payload aceito; layout/escala/rótulo acompanham o frame. Guardas ROM/época/ordem permanecem. Teste autoral de transição256×192→320×224 e margem antiga precede rebuild e jornada003. Sem dependência nova/core diferente/expectativa de bytes ou pixels alterada. M5 permanece pendente até jornada/reversão/regressões/gates.


## M5 — transferência nativa e reversão no binário final

Build canônico fonte18f9ab59 exit0; SHA final66cb3d71ea4f5df2efd37b031fe0c4c76b822b11d55d55ca240024638c7c12e5. Freeze1351b0b anterior à jornada003; regressões v3 congeladas no mesmo commit. GoldenAxe003 PASS140/140, volta PASS138/138: prévia original, região declarada2A98..2AA8, operação MOVE.L→MOVE.W, persistência/fechar/reabrir, cópia/IPS independente, execução/repetição e reversão ao SHA75613dde…5df4b. Único byte2AA2; 162 bytes discriminantes no span432 do destino. Referência width2 original-derived d7a2a748…d7991 confere; cauda216bytes preservada. Full canvas nativo256×192 e core exatos. Vídeo inalterado nesse episódio; efeito transferido é de memória, sem oráculo visual editado ou alegação de jogabilidade.

A segunda implementação é demonstrada por inicializadores de ponteiros e contador, MOVE.L e DBRA único contíguo, em contraste com os dois DBRA e strides do alvo primário; não decorre apenas de título/hash/cabeçalho. MAME observou original/editada em sessões distintas da prova GX/UI. Não é reuso do Kosinski compartilhado. Custo de adaptação genérico do primeiro alvo e plataforma em m5-adaptation-cost-final.json; registro preexistente não rastreado permanece intacto. Quatro reservados continuam somente reconstrução/publicação estática zero-código, sem chamadas observadas.

Falhas nativas001/002 e todos os adendos/oráculos são preservados. Teste autoral de mudança de resolução e oito testes de IPC/identidade passaram9/9 antes do build; helper de reprodução só clona caminhos de saída com pins/critério intactos. Certificação final e regressões do binário ainda em execução; nenhum aceite geral pressuposto.


## Reprodução final com os artefatos locais pinados

Checkout da própria missão: `/home/misael/Projects/REX-COMMERCIAL-RECOVERY-2026-10-16`, branch `codex/rex-commercial-recovery-20261016`. Não usar o checkout de setembro nem o cartão. O app final está em `src-tauri/target-test/debug/retro-dev-studio`, SHA66cb3d71ea4f5df2efd37b031fe0c4c76b822b11d55d55ca240024638c7c12e5. Core e ROMs são entradas externas por hash, conforme cada freeze; nenhum provisionamento de corpus. O helper abaixo valida TODOS os pins e recusa IDs/saídas já existentes, criando somente cópias de spec/freeze em scratch privado. Ele imprime o comando nativo completo, para executar a seguir. Trocar o ID se já usado; não editar critérios nem tolerância.

```sh
rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/prepare-native-reproduction.py data/rex_profiles/commercial_recovery_20261016/m5-ui-golden-axe-journey-v3.json data/rex_profiles/commercial_recovery_20261016/m5-ui-golden-axe-freeze-v3.json m3-native-REPLAY-golden-001
```

Esperado da ida:140/140; cópia5725630a…09f18 e IPSec10c284…76bf5, um byte2AA2; memória432bytes com162posições discriminantes; framebuffer core/canvas igual256×192. Para volta, usar o par `m5-ui-golden-axe-reverse-journey.json`/`m5-ui-golden-axe-reverse-freeze.json` e ID inédito:138/138 e ROM original75613dde…5df4b. O par de volta aponta para uma cópia UI já pinada por SHA; pode ser a cópia byte-idêntica recém-gerada, com alteração de caminho documentada antes da execução.

Regressões finais usam pares `m5-final-{commercial,author}-{forward,reverse}-journey-v3.json` e `…-freeze-v3.json`, cada um com ID novo no mesmo helper. Esperados: comercial135/135ida,128/128volta; autoral88/88 em cada direção, mesma referência v2,162bytes/3309posições de pixels e zero tolerância RGBA. O resumo de execução e hashes de relatórios/cópias/patches ficará em `m5-final-native-qualified.json`; não somar controles repetidos como cobertura independente.

Para reauditar gates, depois de verificar que não há build/E2E ativo:

```sh
rtk proxy env TMPDIR=/home/misael/rds-scratch/commercial_recovery_20261016/m5-test-tmp CARGO_BUILD_JOBS=1 python3 scripts/rex_profiles/commercial_recovery_20261016/preflight.py --certify
rtk proxy env CARGO_TARGET_DIR=/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/cargo-target CARGO_BUILD_JOBS=1 cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
rtk proxy cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Clippy deve usar o CARGO_TARGET_DIR nativo declarado no manifesto do build se não estiver no ambiente. Certify agrega tree/lint/tsc/frontend/Rust/Clippy-lib/upstream oficiais; logs e relatório são preservados por execução. O preflight recusa abaixo3GiB, swap crescente ou outro job pesado, antes de iniciar. V1FAIL86/89, BYOR1/2 sem cadeia demonstrada, falhas de instrumento/protocolo e somOPEN permanecem no histórico. Não é validação humana de usabilidade.


## Mapa final requisito → implementação → teste → resultado → limite

| Marco / requisito | Implementação integrada ou instrumento | Verificação e resultado | Limite preservado |
|---|---|---|---|
| M0: inventário e preservação | Inventário histórico acima, auditor/reconciliação, refs e bundles incrementais | Proteção011/012 verificadas;16links de evidência M2/M3/M4 intactos; zero ausências no conjunto auditado legado | Auditoria não é prova funcional; oito mismatches brutos são quatro fontes avançadas citadas duas vezes |
| M1: alvo identificado e protocolo congelado | ROM Sonic c7da53a1…81ebb; recurso Enigma65432, bufferFF4000, cópia1B6E8..1B706, consumidor layout/SAT/VDP | m1-freeze anterior à coleta; endereços e episódio preparado separados | Região declarada/entrada assistida; não descoberta automática nem entrada natural |
| M2: consumo observado | Observers externos MAME qualificados, taps de memória/VDP/DMA/IRQ, correspondência GX própria | Chamador/args reais,4096bytes Enigma e cópia,17descritores/16sprites,715writes,67SAT+67paletas DMA; witness8482pixels RGB0 | Sessões MAME/GX distintas, sem tracePC comercial no core do app; Nemesis sem entrada/chamador traçados |
| M3: editar cadeia pela UI | Mesmo núcleo/IPC/ponte/publicador/persistência; replay e canvas nativos | No app final:135ida/128volta; IPS independente/diff único1B6F8/reversão original;10534/8067pixels condicionais e2008posições discriminantes | Referência usa coordenadas/câmera/animação/paleta medidas; não prevê física/cena inteira |
| M4: condição/estado/efeito | CopyGrid IR tipada; MOVE+postincrement+DBRA, nodes com condições/estado/origem/desconhecidos | Reconstrução30bytes derivada sem cache; operador/fluxo adulterados recusados; execução externa original/editada e detalhes dos nodes no app final | Família fechada; topologia arbitrária não compilável; subset de estado/CCR/efeitos delimitado em m4-bounded-acceptance |
| M5: outra implementação | Extensão genérica contígua, inicializadores de ponteiros/contador e DBRA único; perfil revisão2 | GoldenAxe140ida/138volta, ROM/IPS/memória previstos; MAMEoriginal432bytes/edited216bytes+cauda216; quatro reservados reconstrução/publicação/IPS zero-código | Segunda rotina diferente, não demonstra engine completa; reservados sem chamadas observadas; sem oráculo visual editado paraGoldenAxe |
| Preservar baseline autoral | Mesmo runner/cena SGDK e oráculo v2 independente |88/88ida+88/88volta final;162bytes/3309pixels exatos | V1FAIL86/89 não muda; prova autoral separada da comercial |
| Gates e maturidade | Certificação canônica + fmt/defaultClippy complementares | Em execução nesta seção; resultado final será registrado abaixo e no MemoryBank | Experimental; nenhuma promoção/release/push, somOPEN permanece separado |

Custos de produção do primeiro alvo M5, excluindo módulos de teste:418linhas adicionadas/22removidas em sete fontes, incluindo apresentação genérica em resolução nativa e identificação de cabeçalho; quatro fontes REX seguem exatamente o freeze anterior aos reservados. Perfil/configuração, instrumentação e testes são listados separadamente em `m5-adaptation-cost-final.json`. Nenhum despacho por título/hash, dependência de produção ou console novo. Quatro reservados foram interpretados após freeze nesta missão; possível inspeção histórica externa desconhecida, portanto sem alegação de corpus globalmente inédito.


## Fechamento M0–M5 — 2026-10-19 UTC

M0–M5 demonstrados somente nos domínios dos aceites versionados. Certificação final `certify-20261019T012630Z` READY, exit0: tree/lint/tsc/frontend1049PASS+3SKIP/Clippy-lib/Rust1038PASS+94IGNORE/upstream SGDK/PVSnesLib oficiais, sete gates exit0. DefaultClippy-Dwarnings e fmt exit0 em `m5-final-complementary-qualified.json`. Build final66cb3d71…c12e5 e seis jornadas novos foram verificados separadamente. Os resumos emitidos antes da certificação conservam o campo pending histórico; `m5-bounded-acceptance.json` e `FINAL-MANIFEST.json` registram o fechamento posterior, sem converter falhas/ausências em aprovação. Nenhum teste ignorado ou skip é contado como PASS.

Aceites M2/M3/M4 históricos continuam byte-idênticos; novos relatórios finalnative revalidam as jornadas afetadas. Traces privados originais/edited rechecados por SHA em `final-private-trace-audit.json` (integridade, não reexecução). A origem da prova M2/estado M4/externalM5 é herdada e reinspecionada nesta retomada; as seis jornadas, build66cb, nove testes focados e certificação final são novos. Maturidade Experimental; sem bloqueio restante dentro dos domínios aceitos. Desconhecidos e somOPEN permanecem fora deles; sem declaração universal ou equivalência integral do jogo.

Checkpoint nativo7a03e81c protegido por ref `refs/checkpoints/rex-commercial-20261016/m5-native-final`, bundle012 verificado SHAe4db5b13594b9d678b1adb29141dbf5d151af6b759b14f67c3b71b8b8b27baf9; requer integração03ddc59d. O commit que contém este fechamento será protegido por ref `refs/checkpoints/rex-commercial-20261016/mission-final` e `/home/misael/rds-scratch/commercial_recovery_20261016/mission-final-013.bundle`; hash/resultado em `mission-final-protection.json` no mesmo scratch, sem corpus/build no bundle. Manifesto dos arquivos finais e comandos: `data/rex_profiles/commercial_recovery_20261016/FINAL-MANIFEST.json`.

Todos os processos das seis jornadas terminaram; logs nativos registram0vivos. Certify/build/Clippy/fmt são síncronos e terminados. Nenhum processo alheio encerrado, nenhum arquivo limpo, nenhum push/merge remoto/release. Worktree final conserva os dois JSON não rastreados preexistentes byte a byte; cópias pequenas verificadas em scratch `preexisting-drafts-backup-20261019/`. O diretório `reproduce-m3-native-reproduction-prepared-001` contém somente spec/freeze preparado, não executado. ROMs/cópias/IPS/capturas e dumps comerciais ficam no scratch/validação privados; não versionados. Integração03ddc59d e pesquisaee8c581f permanecem separadas.


## Auditoria de conclusão e índice consolidado — 2026-10-19 UTC

O pedido reapresentado é a mesma missão M0–M5. Antes de marcar o objetivo concluído,42grupos de requisitos foram confrontados com implementação, protocolos, resultados brutos e artefatos atuais; referências e limites em `data/rex_profiles/commercial_recovery_20261016/COMPLETION-AUDIT.json`. A classificação foi auditoria de evidência/documentação, sem nova funcionalidade. Integração03ddc59d e pesquisaee8c581f continuam limpas; fonte/binário do produto e expectativas congeladas não mudaram desde o fechamentoeb2ee726. Novo host:diagnose READY60249508; certificado final anterior continua aplicável à produção idêntica, com seus logs preservados.

A auditoria002 conferiu287entradas do manifesto,12aplicações IPS independentes,22capturas PNG/RGBA/core, todos os pixels comerciais previstos nas capturas selecionadas, regeneração byte-idêntica dos JSON de expectativa sem imagem modificada, memória dos episódios e368295eventos em quatro traces. Esses totais incluem repetição de controles e são **reanálise dos mesmos artefatos**, não novos testes de emulação, novo holdout ou cobertura independente. Também conferiu reconstruções tipadas, protocolo M5 antes da adaptação, fontes REX/profile congelados, gates por hash e bundle013 por SHA+git bundle verify.

Primeira tentativa do novo auditor001 foi FAIL_AUDITOR_ASSUMPTION: supôs que o controle de largura anterior sempre se chamaria `copia.old_width_conditional_visual_refused`; na reversão ele pertence às capturas width2 anteriores à edição. Fonte e falha preservadas em scratch `completion-audit-20261019-001/`. A correção exige esse controle na fase width2 correspondente; não muda nenhuma referência, tolerância, resultado do produto ou oráculo. Auditoria002 passou e permanece identificada por SHA.

O índice derivado `data/rex_profiles/commercial_recovery_20261016/completion-experiment-index.json` reúne304registros localizados: protocolos/adendos, resultados/aceites e manifestos de execuções privadas. Cada entrada conserva caminho e SHA da fonte, ID de execução quando registrado, comando, orçamento, hipótese e resultado onde presentes. Configuração não vira execução; registros duplicados/derivados não são contagem de experimentos independentes. Campos nulos não são inventados: o detalhe continua no protocolo, produtor ou registro vinculado. O diário e o MemoryBank mantêm a autoridade de estado.

| Marco | Protocolos e entradas do índice | Resultados e limites de fechamento |
|---|---|---|
| M0 | m0-audit, protection, diagnóstico/reconciliação | Inventário histórico e integridade; documentos/código avançados explicitamente reconciliados |
| M1 | m1-freeze, hipóteses/endereço/episódio/orçamento | Recurso comercial pinado, cena preparada; não descoberta automática |
| M2 | qualify009/v2/v3, fase autoral, commercial001/v2/v3, replayGX | Entrada/args/buffer/layout/SAT/DMA/pixels observados; sessões externas distintas; falhas preservadas |
| M3 | referências originais/condicionais, freezesforward/reverse, jornadas e sequência | UI/cópia/IPS/persistência/reversão; referência condicionada a controles medidos |
| M4 | freeze-v2, m4-semantic-tests, estado original/edited, detalhes dos nodes | Reconstrução tipada/condição/estado/efeito; sem compilador geral de topologia |
| M5 | busca/qualificação autoral, pilot, adaptação genérica, reservados, GX/edited, UI/gatesfinal | Outra implementação com efeito de memória; quatro transferências estáticas zero-código; falhas header/canvas e oráculos intactos |
| Conclusão | completion-audit001FAIL/002PASS e adendo atual | Reanálise de artefatos e navegação consolidada; produção e critérios inalterados |

Para reproduzir apenas essa auditoria (nenhum emulador/build é iniciado), usar saída privada inédita:

```sh
rtk proxy python3 scripts/rex_profiles/commercial_recovery_20261016/audit-completion.py /home/misael/rds-scratch/commercial_recovery_20261016/completion-audit-REPLAY-001
```

O auditor recusa sobrescrita. Depois deste adendo, apenas os três documentos canônicos explicitamente listados podem aparecer como DOCUMENT_ADVANCED: seus hashes anteriores são validados em eb2ee726. Fontes/expectativas/buffers/relatórios/ROMs devem conferir exatamente; FINAL-MANIFEST.json não é reescrito retrospectivamente. Tree/diff-check e sintaxe do auditor complementam esta rodada documental; os gates pesados finais e as seis jornadas são reutilizados mediante prova de zero diferença em produção/dependências. O checkpoint deste adendo será preservado por `refs/checkpoints/rex-commercial-20261016/completion-audit-final`, bundle014 e registro `completion-audit-protection.json` em scratch; corpus e builds excluídos.
