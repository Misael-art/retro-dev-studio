# Fechamento do aceite autoral v2 — cópia recuperada e apresentação

**Aceite da cena autoral v2 aprovado localmente**, nas condições do [contrato v2](VISUAL-COPY-CONTRACT-V2.md): **88/88 na ida 1→2 e 88/88 na volta 2→1**, igualdade exata RGBA entre previsão independente, observador do core e canvas. A superfície REX continua Experimental. Operação recuperada ligada a dados e apresentação visual, com edição causal demonstrada nos cenários declarados.

A v2 é uma correção metodológica autorizada **depois da falha v1**, não validação cega. A v1 permanece **86/89 REPROVADA**, com suas três reprovações de imagem absoluta, arquivos, fonte do oráculo, capturas, logs e hashes preservados. O fechamento v2 não aprova retrospectivamente esse resultado. **BYOR continua sem vínculo gráfico demonstrado**; as duas tentativas e seu bloqueio são reaproveitados sem nova alegação comercial. Não há prova de PC/chamador nem equivalência completa de jogo. Pendência sonora preexistente nodegraph-authoring permanece OPEN.

## O que mudou e como foi fundamentado

Só mudou a projeção de cor do oráculo de QA e a escolha explícita desse contrato pelo comparador externo. Nenhum arquivo de `src/` ou `src-tauri/` mudou nesta rodada. Não se recompilou a ROM nem o aplicativo. Binário reutilizado SHA `74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e`; core Genesis Plus GX v1.7.4 46a5521, SHA `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1`.

A fonte oficial da revisão 46a55214d0dab654e5a525ae0c54921ca9716872 define `palette_init`/`pixel_lut[1]`, `color_update_m5` em modo normal e `MAKE_PIXEL` RGB565. `config_default`, o Makefile e o pedido de formato 2 existente no binário delimitam os flags/configuração. O [adendo](VISUAL-COPY-CONTRACT-V2.md) registra funções, tabelas, hashes, endereços da auditoria do binário e equações. Não se escolheu 239 como um fator observado de correção.

Palavras CRAM literais são verificadas contra as três tabelas da ROM pinada. Elas alimentam a conversão do core para RGB565; o adaptador Rust existente expande RGB565 para RGBA. A UI copia esse RGBA em ImageData/putImageData. São três representações distintas. A prova compara os pixels digitais do canvas, não cores físicas do monitor. O contrato vale só para o hash/configuração pinados, modo 5 normal sem filtros/shadow/highlight; não se generaliza a outros cores ou hardware real.

O freeze `d8be191e552eb43015d74f61e35271b9e8cb3fcd` foi criado às 23:09:14 UTC, antes do relatório forward 23:09:39 UTC. Inclui modelo, 31 vetores literais, gerador, expectativas, specs, testes e hashes de 22 arquivos. Nenhum desses arquivos foi ajustado durante as corridas. O gerador v1 intacto continua responsável por geometria e índices; a v2 associa rótulos lógicos a palavras CRAM e aplica as equações. Não lê capturas.

## Testes anteriores à jornada

| Prova | Resultado | O que discrimina |
|---|---|---|
| 31 vetores literais CRAM→RGB565→RGBA|31/31|Preto, canais isolados em níveis 1..7, intermediários, máximo e misturas assimétricas|
|Negativos de conversão|9/9|255 linear antigo, canais trocados, curva verde RGB555, constante 239 em intermediários, alpha e codificação inválidos|
|Negativos de imagem/buffer|11/11|Largura/stride/ordem/linhas/paleta/transparência, guarda, imagem antiga e alteração de um nível/canal|
|Comparador real da jornada|13/13|Rejeita v1, outra largura, dimensão errada, delta 1 em cada canal/alpha, tolerância v2 ampliada e identidade incorreta; mantém delta 7/8 da v1|
|Paletas codificadas na ROM|3/3 tabelas de 32 bytes|A expectativa parte das palavras autorais pinadas, não do framebuffer|

Os vetores testam a referência independente derivada da fonte; não são uma calibração dinâmica de todos os níveis contra o hardware. Expectativas,31 vetores e resultados anteriores à jornada estão em `data/rex_profiles/integration_20261016/visual-copy-v2/` e `evidence/visual-copy-v2/`.

## Jornada afetada reexecutada

Mesmo runner nativo `semantic-gate-journey`: recuperar região declarada→nodes→conferir fonte/destino→no-op e editar largura→salvar→encerrar→reabrir do disco→gerar cópia/IPS→executar original/repetição/cópia. Cada carga confere identidade ROM/core, VISU, pelo menos 60 frames novos, pausa, scope e framebuffer/canvas. A volta usa os mesmos bytes da cópia gerada na ida (hash idêntico, arquivo já pinado), e restaura a ROM base.

| Critério | Ida1→2 | Volta2→1 |
|---|---|---|
|Checks nativos|88/88|88/88|
|Imagens absolutas original/repetição/cópia|0 pixels divergentes, tolerância0|0 pixels divergentes, tolerância0|
|Core-RGBA↔canvas|Igualdade byte a byte nas três cargas|Igualdade byte a byte nas três cargas|
|Scope completo de 484 bytes e guardas|Exatamente os dois vetores pinados|Exatamente os dois vetores pinados|
|Mudança RAM| 162 bytes, offsets v1 idênticos| 162 bytes, mesmos offsets na reversão|
|Mudança visual| 3309 posições, conjunto v1 idêntico| 3309 posições, conjunto inverso idêntico|
|Original/original e no-op|Buffer/frame iguais; plano vazio não publica|Buffer/frame iguais; plano vazio não publica|
|Persistência/publicação|Cópia/IPS idênticos após reabrir|Cópia/IPS idênticos após reabrir|
|Identidade|Base fbc72b25…0435→cópia 7a33ddfa…24d0b4|Cópia 7a33ddfa…24d0b4→base fbc72b25…0435|

A tela inteira 320×224 continua sendo comparada, incluindo ROI [40,40,168,96) e exterior. Não houve crop, deslocamento, normalização ou tolerância ampla. O critério do conjunto causal permanece o mesmo da v1; a imagem absoluta agora exige zero tolerância RGBA. A matriz `criterion-continuity-forward.json` confere que os 88 nomes de checks permanecem iguais à jornada final v1, excluindo apenas o check de tentativa BYOR reutilizado. **Somente os três resultados correspondentes ao componente corrigido passaram de reprovação v1 a aprovação na nova corrida v2.** Não houve remoção de critério que reprovava.

A [cadeia recurso→rotina→apresentação](../../../data/rex_profiles/integration_20261016/evidence/visual-copy/resource-routine-presentation-chain.json) da v1 continua aplicável e não foi alterada: recurso→fonte→região recuperada→destino→conversão autoral para palavras VDP→SGDK→core→canvas. O novo modelo acrescenta a derivação explícita CRAM→RGB565→RGBA, sem atribuir autoria da apresentação ao trecho recuperado.

## Hashes e limites preservados

| Artefato | SHA-256 |
|---|---|
|ROM base/resultado reverso|fbc72b252ec31eb221362c305cd4c2c631fbce15394b729109a699f3c1d10435|
|Cópia width2|7a33ddfa058c9d3e2e0e399450bb6ae8a1a4b03a6fbd79b504f0ba70b324d0b4|
|IPS ida|54f249c6a574c37702f889e92e6f6df939104713bd474bdbd4c7c7e7bd6ef6ae|
|IPS volta|49268066fb3aa583a1860a4737c7f73da575f162d1f1971e15361d0fcb54f63f|
|RGBA width1 previsto/core/canvas|8f518c7468b89fe1e6bf91b9142e2a2446df13978e7f331910e7bd6ffacd6cb6|
|RGBA width2 previsto/core/canvas|f98f7a01bd6c73e724f15d5d4fd4a3d25a70c4fcd74e6fde3895af8b96741864|
|Scope width1|d3903c62d0996b0925ae4b88338a3e6a4fbec7cf23db618ed575d6029391513e|
|Scope width2|2e682f3d26fab1b3a0c8d5d2d0fd010b0a09a4bf69df3ecb35d3e8cb5dc7a88f|

Região 0x2204..0x2222 e diff único 0x2214, tamanho 393216, paletas, fonte e consumidor autoral intactos. O consumidor converte descritores de IDs em palavras VDP via SGDK; sua autoria e condições preparadas não são código recuperado. Preservação de memória continua limitada ao scope e guardas, excluindo estado variável do SGDK externo. BYOR permanece bloqueada; PC/chamador/args comerciais continuam desconhecidos. Não houve participante humano.

## Requisito→implementação→teste→resultado→limite

| Requisito | Implementação | Evidência | Resultado | Limite |
|---|---|---|---|---|
|Fundamentar no core pinado|Funções/tabela/MAKE_PIXEL e configuração, auditoria estática do binário|color-model e color-vectors-result|Identidades e 31 vetores conferem|Revisão indicada pelo rótulo; sem rebuild bit a bit do core|
|Separar paleta/framebuffer/UI|Palavras CRAM→RGB565→adaptador RGBA→putImageData|Contrato, paletas ROM e seis capturas|Igualdade digital exata|Sem generalização de DAC/monitor|
|Corrigir só componente errado|v1 compositor intacto, projeção de cor v2|FROZEN-INPUTS e continuidade dos checks| 162 bytes/3309 pontos preservados|Metodologia posterior à falha, autorizada|
|Negativos antes da jornada|Vetores literais e comparador real|31+9+11+13 casos discriminados|Todos passaram antes do freeze/jornada|Não usa captura como esperado|
|Freeze sem recalibração|Commit d8be191e anterior às corridas|Inventário anterior/posterior|Sem alterações de inputs|Nova divergência exigiria diagnóstico, não ajuste automático|
|Reutilizar produto/evidências|Mesmo app/core/ROM; regressões v1 aplicáveis|SHA e diff src/ vazio|Sem rebuild ou mudança de produto|Novas jornadas são apenas autorais|
|Preservar v1 e BYOR|Arquivos históricos e testes protegidos|Audit v1 e links aos relatórios|86/89 segue FAIL; BYOR BLOCKED|Sem promoção retrospectiva ou comercial|
|Fechamento e gates|Certificação da rodada e Memory Bank|Relatórios e reprodução abaixo|READY — gates canônicos verdes|Som preexistente OPEN; Experimental mantido|

As regressões v1 copy-grid 60/60, comparação 63/63 e chamada opaca 55/55 são reaproveitadas no mesmo binário; o padrão do comparador v1 foi testado sem alterar seus critérios. Certificação final: **READY**, com tree/lint/tsc, **1045 frontend passed/3 skipped**, **1036 Rust passed/93 ignored**, Clippy lib/padrão -D warnings, fmt e upstream SGDK/PVSnesLib oficiais. Relatório completo e log bruto/revisão preservados; a auditoria após os gates reconfirma os22 inputs congelados v2 e70 arquivos protegidos v1 intactos. Sem push, merge, release, promoção, dependência, classe, node ou core novo.
