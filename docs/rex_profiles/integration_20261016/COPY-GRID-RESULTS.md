# Cópia de grade — integração delimitada (Experimental)

Base 89189485; pesquisa ee8c581f, preservada limpa. Contrato escrito antes da
implementação e medição, checkpoint 2eed076d. Produto, perfis, revisão,
persistência e publicação continuam no mesmo caminho. Sem novo crate,
registry, dependência externa, pipeline de patches, core ou implementação por
jogo. A ROM não escolhe semântica por hash; SHA serve à identidade da base.

Recuperação e edição delimitadas de uma operação de cópia, com procedência,
persistência e reconstrução verificadas nos cenários declarados.

## Evidência e limites

Nova classe `copy_grid` no esquema semântico existente; perfil em dado
`m68k.copy_grid.v1`. Núcleo Rust em `tools/reverse/decomp/rex_copy_grid.rs`:
valida relações dos oito operandos/loops, mapa CPU24, alinhamento, aliases e
spans. Reencoda campos tipados; não tem campo de bytes de procedência.
Bibliotecas existentes foram examinadas: o decoder fechado de rex-gameplay
não fornece LEA/DBRA desta forma; reutilizam-se seu checksum e toda a
infraestrutura de revisão/edição/publicação do aplicativo. Nenhum crate foi
criado nem Cargo/registry alterado.

Somente WRAM→WRAM em região declarada de 30 bytes. MOVEQ assinado 0..127,
DBRA low16 com count+1 iterações, deslocamento signed16 baseado no PC+2;
ponteiros distintos A0..A6 e contadores distintos. Gap não negativo; largura
byte/word. Recusa espelhos/IO, desalinhamento, sobreposição e janela/ponteiro
final fora do mapa. Aritmética checked e domínios limitados impedem overflow;
valores extremos recusados não representam contadores livremente editáveis.
Não se generaliza para MOVE.L, A7, memória sobreposta, gap negativo ou outra
forma de controle. Endereços/registros vêm dos bytes; não há hash ou nome de
jogo selecionando instruções.

O canvas usa entrada→cópia→saída. Memória e controle permanecem numa operação;
origem/destino, linhas/colunas, largura, incremento e stride ficam no cartão,
com oito mappings e detalhes binários. Só `bytes_per_cell` é editável. A ponte
mostra os valores base e a proposta de incremento/stride/span. Outros campos
e topologia são revalidados contra a ROM e não compilados. O validador geral
autoral ainda alerta “grafo sem evento de entrada”; não é uma proposta de
acrescentar evento à região recuperada nem prova de compilação do grafo.
Automação de interface não é estudo de usabilidade humana.

Fixture autoral 4×8: FF5000→FF7000, gap16, stride24→32, span80→112,
32→64 bytes copiados. Caller zera WRAM e preenche FF4000+8192 com
(i*37+11)%256; SP=FFFF00, SR=2700; sentinel 434F5059 em FF3FE0.
Oito execuções independentes (quatro autorais e quatro da região BYOR) em
BlastEm: original=reconstrução e editada=reconstrução editada, com oito
fronteiras Binutils por variante e referência de índices de bytes independente
do grafo. Cada grupo passou 21 checks. Comparação cobre toda WRAM exceto
[FFEE00,FFFF00) reservado à stack; sentinel conferido separadamente. A janela
FF1020..FF3FE0 também é registrada; no caso autoral o destino está em FF7000,
portanto sua causalidade é conferida no exterior dessa janela. Não se tomou
igualdade da janela vazia como prova da cópia.

BYOR SHA c7da53a1…c81ebb: região 1B6E8..1B706, 64×64, FF4000→FF1020,
gap64, stride128→192, span8128→12224, 4096→8192 bytes. Primeiro diff
relativo64; único byte da imagem alterado 1B6F8; seis streams/recursos e todo
restante preservados pelo diff integral. O teste de destino foi habilitado
explicitamente (1 passed), além do ignore da suíte ordinária.

**Isso é execução da região em harness sintético. Não foi observada chamada
pelo jogo original nem resultado gráfico em tela.** Addendum 043 fornece
cadeia estática codec→buffer→cópia, não PC/argumentos em jogo. A ausência do
observador verificado do core para esse episódio permanece; não foi criado
fork de core/trace para ampliá-la. Flags/registradores/stack excluída, vídeo e
áudio não foram comparados.

## Jornada e comparação causal no binário final

App SHA 51b338ced43399545e7df6388d270a632991050083d32659db8369e8c77acc02.
Genesis Plus GX SHA 07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1;
BlastEm SHA fdaa3d392ab071c52e8b01c7df4c5642aa00c048a737f4bd3abce66bebd855ba.
A GUI usou o core original do aplicativo, sem substituição. Identidades dos
bytes efetivamente carregados e do core foram conferidas a cada execução.
Hashes dos fontes usados estão em evidence/copy-grid/PRODUCT-SOURCE-SHA256.json.

GUI 004: **60/60**, abrir→declarar→recuperar→revisar→editar 1→2→salvar pelo
menu→destruir janela→reabrir projeto do disco→publicar cópia/IPS→executar.
Mappings, perfil/hash, ROM/hash, valor editado e assinatura persistiram.
Remover nó bloqueou publicação; desfazer restaurou o plano. Layout visual
não mudou a semântica. Cópias antes/depois da reabertura foram idênticas.
GUI 003 também passou 60/60; 004 apenas torna explícitos no relatório os
nomes do campo e de bytes medidos, substituindo labels herdados de limiar/casos.

WRAM original e cópia coincidiu byte a byte entre Genesis Plus GX e BlastEm,
inclusive nos 65536 bytes completos capturados. Dentro do escopo da referência,
72 bytes mudaram exatamente como previsto; nenhum exterior relevante divergiu.
Base 7930303a67df243f9452eb906b8931aa83d60c02ed090016dd1be1bea37e2f31;
cópia 3726adec97308332d58cd1adfeef1308fb4a6441189ee099434210221ea3947f;
IPS c0a6342c030118f7cabca863f1dd26c8705841edcb2e3800c26ef671bff994fb.
Diff único 0x410. Aplicador Python independente e aplicador do E2E reproduziram
a cópia; original intacta. Cópia BYOR cb471c95…1ad97a e IPS b48421f3…5969f9
permanecem privados; hashes completos no relatório do verificador independente.

Regressões no mesmo app: comparação curada **63/63**, domínio de sete entradas
com única diferença de estado em 5; jornada anterior com guarda/chamada opaca
**55/55**, 60 entradas. Nenhum skip foi transformado em PASS. **Pendência
sonora preexistente do nodegraph-authoring permanece aberta**, sem investigação
ou alegação de resolução nesta missão.

## Requisito → implementação → teste → resultado → limite

| Requisito | Implementação | Teste/prova | Resultado | Limite |
|---|---|---|---|---|
| Auditoria/freeze/origens separadas | COPY-GRID-CONTRACT + FREEZE | pins pesquisa/037–039/043, fonte vs caller/recurso/observação | congelado | fronteira declarada, não descoberta |
| Núcleo reutilizável | rex_copy_grid + SemanticEngine | typed_reconstruction_and_transfer_domain, A5/A6 D0/D7 e dimensões diferentes | passou | somente forma exata byte/word |
| DBRA/sign-extension/alias/mapa/overflow | decoder/validate/checked arith | discriminating_decoder_refusals | passou | rejeita domínios fora do contrato; não simula outras instruções |
| Canvas compacto e memória/controle | rom_copy_grid + catálogo/ponte | hidratação/conformidade, GUI 004 | 60/60 | não compila topologia |
| Edição única e persistência | review/plan existente + encoder tipado | backend_publication…, GUI menu/save/reopen | passou | somente bytes_per_cell; campos base somente leitura |
| Publicação e IPS | rexProfileEdit/rex_publish existentes | gráfico/formulário, replay IPS JS/Python, par existente preservado | passou | não expande/reloca imagem |
| Causalidade autoral | fixture .S + referência independente | quatro BlastEm, GUI original/cópia, WRAM/sentinel | 21 checks + GUI | caller sintético, stack/flags excluídos da referência |
| Região BYOR no destino | mesmo kernel/backend/publicador | pinned_byor… habilitado + quatro BlastEm | 1 test + 21 checks | sem chamada pelo jogo/tela |
| ROM/perfil/registro/grafo/domínio inválidos | IPC/revisão compartilhados | malformed_rom_never_publishes, discriminating_refusals | passou | base intacta, sem par parcial |
| Resposta antiga | ponte compartilhada | teste específico copy-grid request_id antigo | passou | nenhuma resposta antiga vira resultado atual |
| Regressão comparação/opaca | caminho canônico preservado | duas jornadas no binário final | 63/63 e 55/55, 7/60 entradas | flags/call opaco/áudio não provados |

Falhas e correções preservadas em evidence/copy-grid/FAILURES.json, com
reprodução e relatórios originais em scratch. Nenhuma expectativa de memória,
ROM/hash, fronteira ou diff foi alterada para aprovar a implementação.
Reprodução completa: COPY-GRID-REPRODUCE.md. Logs e SHA256SUMS acompanham
este fechamento. Certificação e controle reverso são registrados a seguir, sem substituir
as provas anteriores.

## Controle reverso, certificação e checkpoint

Controle 2→1 congelado antes da medição em COPY-GRID-REVERSE-FREEZE.json,
sem mudar o contrato original: GUI **60/60** no mesmo app, salvar/encerrar/
reabrir/publicar/executar. A cópia volta exatamente ao SHA autoral
7930303a67df243f9452eb906b8931aa83d60c02ed090016dd1be1bea37e2f31;
IPS reverso 5d06740453772894ed7fcd4c2c562717672f05126c40a6b20b4aa913bc49e1a0. Único diff 0x410;
verificador Python independente e ambas capturas completas de WRAM coincidem
com as referências byte/word do BlastEm, trocadas de direção. Não se afirma
que o domínio de outras instruções ou parâmetros foi ampliado.

Certify **READY**, exit 0: tree, lint, TypeScript, frontend **1043 passed /
3 skipped**, Clippy --lib -D warnings, Rust **1036 passed / 93 ignored**,
upstream SGDK/PVSnesLib e decomp tools operacionais. Também passou o Clippy
padrão sem restringir a --lib, fmt e diff check. Build canônico debug passou.
O ignore BYOR foi executado explicitamente em separado e passou; os demais
ignores continuam ausências de execução, não evidência positiva. O aviso
herdado de #[test] duplicado continua registrado, sem alteração nesta missão.
Host fingerprint 60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2;
lock dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377.
Logs completos e resumo em evidence/copy-grid/CERTIFICATION.json; snapshots
antes/depois da certificação preservados no scratch da missão. A pré-verificação
da GUI reversa executou diagnose depois e substituiu o host-readiness canônico;
esse snapshot posterior READY não é o relatório dos gates. A certificação é
sustentada pelo log integral, exit 0 e SHA em CERTIFICATION.json.

Métrica contra 89189485, incluindo testes e renomeação genérica do valor:
Rust +710/−21; TS/TSX +52/−1;
perfil 55 linhas. Zero nomes de jogo novos no núcleo/ponte,
zero dependências novas, zero mudança de Cargo/registry. O segundo conjunto
de registradores/endereço e o BYOR não exigiram linhas novas de motor.
Detalhe por arquivo em METRICS.json. Revisão estática = consistência L2;
causalidade/reconstrução medidas são apenas as afirmações do harness/fixture
acima, não L3 de chamada pelo jogo nem compilação do grafo inteiro.

Checkpoint canônico é o commit que contém este fechamento e os fontes com
SHA registrados em PRODUCT-SOURCE-SHA256.json; parte do freeze 2eed076d e da
base 89189485. Trabalho local consolidado sem push/merge/release/promoção.
Pesquisa e outros worktrees não foram alterados. Próxima expansão continua
condicionada a novo contrato e observação: não há prova de execução pelo jogo
ou resultado gráfico; pendência sonora preexistente permanece aberta.

Cópias versionadas dos logs têm apenas whitespace final/linhas vazias finais
normalizados para o gate diff-check. Logs originais de execução permanecem
intactos no scratch, com SHA bruto e SHA da cópia em LOG-PROVENANCE.json.
Não se removeu falha, diagnóstico ou asserção para obter aprovação.
