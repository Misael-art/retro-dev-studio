# Integração da comparação — checkpoint de fechamento

Entrega local baseada em 3aee1128; commits ebfc256e (freeze/curadoria), 628a422e (backend/ponte) e 8b6c70af (jornada), mais o commit que contém este fechamento. Origem correta ee8c581f07494c22100c688f09f02db0caacd56b (errata de transcrição registrada sem reescrever freeze). Nenhuma alteração posterior da pesquisa foi descartada; origem permaneceu limpa. Sem push, merge, release ou promoção.

**Recuperação, edição e execução delimitadas de uma comparação M68000 comprovadas pela jornada canônica, no domínio declarado.** GUI 003: 63/63, save visível, janela destruída e projeto reaberto do disco. Regressão da jornada anterior com guarda/call opaco: 55/55 e 60 casos. Backend real: assinatura/nove mappings iguais ao pacote e publicação mudando somente 0x247; negativos não alteram base nem deixam par parcial. Request_id de outro pedido antes aceito agora é descartado; perfil da resposta também conferido. Só nodes existentes e limiar compilável.

Certificação READY exit 0: tree/lint/tsc, frontend 1041 pass/3 skipped, Clippy --lib -D warnings, Rust 1032 pass/92 ignored, upstream/Ghidra/SGDK/SNES operacionais. Fmt e diff check passed. Build debug passou. A primeira suíte frontend fora do ambiente oficial teve 1038/6 skips; não é o mesmo conjunto de provas habilitadas. A suíte focada de perfis teve 67/1 ignored. Os totais se sobrepõem; não são porcentagem de ROM recuperada.

Binário medido f913ed903f64bbd8a86e2f269d9e872f8b596344eb48723fab1b415aa6c8f46b, fonte de produto em 628a422e. Commits posteriores só teste/harness/documentação. Core do produto Genesis Plus GX 07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1. Original e cópia efetivamente carregados e memória comparada estão no relatório gui-003. Inputs por caso declarados, ledger de estados observado, contador/estado finais medidos; flags/registradores/stack/vídeo/áudio não comparados. Nenhuma chamada no jogo comercial provada.

Pendência sonora preexistente do nodegraph-authoring continua aberta; não foi investigada nem apagada por uma repetição verde. Aviso herdado de #[test] duplicado permanece. Histórico e falhas em INITIAL-REFUSALS.json e GUI-PROTOCOL-ADDENDUM.json. O host-readiness canônico é substituído a cada diagnose; o log de certificação completo continua em scratch com SHA no resumo; upstream foi preservado antes da regressão.

Mapa e reprodução: REQUIREMENTS.md e REPRODUCE.md. Pacote/evidências e checksums em data/rex_profiles/integration_20261016/. Original, corpus e processos alheios preservados. Próxima proposta (não implementada): inspeção somente leitura de copy-grid com contrato de memória/proveniência; execução depende de lowering e testes próprios. Não há blocker externo para esta fatia autorizada. Trabalho posterior pode partir do commit de fechamento; nenhuma tarefa pesada própria precisa continuar.

## Nova missão — cópia de grade integrada (Experimental)

A proposta de inspeção copy-grid foi executada em uma missão separada,
com contrato congelado antes da implementação e lowering delimitado da
largura. GUI 60/60, backend/BYOR/IPS/referência de memória e regressões
63/63 + 55/55 passaram no binário final; certify READY. Detalhes, controle
reverso e checkpoint: COPY-GRID-RESULTS.md; reprodução: COPY-GRID-REPRODUCE.md.
Esta atualização não reescreve as medições históricas da comparação acima.
Pendência sonora preexistente preservada; chamada pelo jogo e tela não provadas.
