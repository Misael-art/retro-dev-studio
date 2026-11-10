# Adendo congelado v2 — conversão de cor do oráculo visual

## Autorização e caráter metodológico

A v2 foi elaborada **depois de observar a falha da v1** e com autorização explícita do operador nesta tarefa: corrigir fundamentadamente o componente errado do oráculo, preservar integralmente a v1 e repetir as provas afetadas. É correção metodológica, **não validação cega**. O resultado v1 de86/89 continua reprovado pelas três comparações de imagem absoluta. Os contratos, arquivos esperados, gerador v1, capturas, relatórios, logs e hashes v1 não serão reescritos. A preservação anterior à jornada está auditada em `v1-preservation-before-journey.json`.

Este adendo, as palavras CRAM, vetores literais, gerador, expectativas e specs v2 são congelados em commit **antes de qualquer jornada v2**. Se surgir outra divergência, preservar e diagnosticar; não recalibrar automaticamente de novo. Uma reprodução histórica da v1 deve continuar reprovando o mesmo critério. BYOR continua sem vínculo gráfico demonstrado e não integra o aceite autoral v2.

## Identidades e configuração abrangidas

Reutilizar o aplicativo original SHA `74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e`, sem recompilar ou alterar `src/` ou `src-tauri/`. Reutilizar a fixture ROM SHA `fbc72b252ec31eb221362c305cd4c2c631fbce15394b729109a699f3c1d10435`, a classe/profile/publicador e os assets da v1. Alteram-se somente o componente de cor do oráculo e a seleção explícita desse contrato no comparador externo de QA.

Core: Genesis Plus GX `v1.7.4 46a5521`, Linux x64, binário SHA `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1`. Revisão oficial indicada pelo rótulo do binário: `46a55214d0dab654e5a525ae0c54921ca9716872`; não foi feita reconstrução bit a bit do core. A identificação por hash do binário, a configuração do frontend existente e a auditoria do pedido RGB565 compilado delimitam esta combinação.

| Fonte pinada | Função/tabela relevante | SHA-256 |
|---|---|---|
| [core/vdp_render.c](https://github.com/libretro/Genesis-Plus-GX/blob/46a55214d0dab654e5a525ae0c54921ca9716872/core/vdp_render.c#L479) | MAKE_PIXEL, ramo USE_16BPP_RENDERING; palette_init→pixel_lut[1]; color_update_m5, ramo normal | 3627f311789c6cd774db903db716394e12148aa671d4b2001ab8c844077ac761 |
| [libretro/libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/46a55214d0dab654e5a525ae0c54921ca9716872/libretro/libretro.c#L974) | config_default; retro_load_game negocia pixel format2 | 4622426e697f692c89ff0d049f3bfcbc2a58e44fc2d393bbdd8302f65fc9b15c |
| [Makefile.libretro](https://github.com/libretro/Genesis-Plus-GX/blob/46a55214d0dab654e5a525ae0c54921ca9716872/Makefile.libretro#L827) | FRONTEND_SUPPORTS_RGB565=1, USE_16BPP_RENDERING | 5afc8aff237647dc6f8fbf7a2c9f7064c55b009667e85e446fa57bcd744b550e |

No binário pinado, `retro_load_game` prepara o argumento2 em0x5133B9, o comando de ambiente10 em0x5133C1 e chama o callback em0x5133CE. A auditoria estática antecede a jornada e não infere o formato pelo valor239. O callback Rust existente `retro_environment_callback` aceita esse formato e retorna false para variáveis de core, conservando `config_default`: ntsc=0, lcd=0, overscan=0, render=0. Não há filtro NTSC/ghosting configurado pelo frontend.

A cena autoral usa o modo5 normal: SGDK pinado inicializa reg0=04 e reg12=81 (sem shadow/highlight/interlace); a fixture define320×224 e não ativa esses efeitos. Isso é condição de autoria e fonte estática, não uma captura direta dos registradores VDP. Não generalizar este contrato a outro core, hash, modo/configuração, DAC real de hardware ou monitor físico.

## Três representações distintas

1. **Paleta codificada:** palavras CRAM u16 em ROM, bits R em1..3, G em5..7, B em9..11. As três paletas literais em `color-model.json` foram comparadas byte a byte com os32 bytes de cada tabela na ROM pinada. O JSON de assets v1 contém rótulos RGB lógicos de autoria; esses rótulos não são mais confundidos com intensidades do framebuffer. Nenhuma paleta ou ROM foi modificada.
2. **Framebuffer do core e RGBA observado:** para cada componente CRAM `n` em0..7, `palette_init` seleciona nível normal `c=2n` da tabela pixel_lut[1]. MAKE_PIXEL gera campos RGB565: `R5=2c+floor(c/8)`, `G6=4c+floor(c/4)`, `B5=2c+floor(c/8)`. A palavra de pixel é `(R5×2048)+(G6×32)+B5`. O adaptador já existente `framebuffer_to_rgba`/`expand_5`/`expand_6` replica bits: `R8=(R5×8)+floor(R5/4)`, `G8=(G6×4)+floor(G6/16)`, `B8=(B5×8)+floor(B5/4)`, alpha255. A sonda emulator_observe retorna esse RGBA convertido, não bytes RGB565 crus.
3. **Apresentação no aplicativo:** ViewportPanel.renderFrame copia o RGBA para ImageData e usa putImageData, sem nova transformação de cor do oráculo. A jornada exige igualdade byte a byte core-RGBA↔canvas. Essa comparação cobre os pixels digitais da UI, não gestão de cor do sistema/monitor.

Valores literais quando os três canais CRAM têm o mesmo nível:

| n | Palavra CRAM | RGB565 | RGBA previsto |
|---|---|---|---|
|0|0000|0000|0,0,0,255|
|1|0222|2104|33,32,33,255|
|2|0444|4228|66,69,66,255|
|3|0666|632C|99,101,99,255|
|4|0888|8C51|140,138,140,255|
|5|0AAA|AD55|173,170,173,255|
|6|0CCC|CE79|206,207,206,255|
|7|0EEE|EF7D|239,239,239,255|

Os31 vetores literais incluem preto, cada canal isolado em todos os níveis1..7, cinzas e misturas assimétricas. Os nove negativos de conversão rejeitam255 linear no máximo, troca R/B ou R/G, curva verdeRGB555, constante239 em intermediários, alpha errado e palavras CRAM inválidas. O valor observado239 não é um parâmetro do conversor: o código só usa a codificação CRAM e as equações acima.

## Componente corrigido e critérios preservados

`oracle_v2.py` reutiliza o gerador v1 intacto para cópia, geometria e composição espacial. Cada rótulo lógico de cor é vinculado à palavra CRAM literal correspondente e então passa pela conversão fundamentada; não há leitura de framebuffer nem substituição global de255 por239. Só os arquivos de imagem v2 mudam. Os dois buffers scope têm os hashes v1 exatos; os162 offsets de RAM e3309 índices de pixels diferentes coincidem, na mesma ordem, com o manifesto v1.

Critérios inalterados: fonte64 bytes; scope484; destinos width1/2; guardas/exterior; palavras VDP; dimensões320×224; posição e ROI [40,40,168,96); original/original e no-op; persistência/salvar/encerrar/reabrir; ROM realmente carregada e core pinado; cópia/IPS, tamanho e diff autorizado; topologia recusada; reversão2→1; conjunto causal exato. O comparador do conjunto causal permanece com o mesmo limiar7 da v1. A comparação **absoluta** v2 fica mais estrita: **zero tolerância RGBA**, sem deslocamento, crop, normalização ou escala aprendida de capturas. O padrão v1 continua7, verificado por negativos delta7/delta8.

Antes da jornada:31 vetores, nove negativos da conversão, onze negativos das imagens/buffers e treze testes do comparador usado pela jornada devem passar. Incluem rejeição da imagem v1 antiga, outra largura, um único nível errado em cada canal, dimensão errada e tentativa de ampliar tolerância v2 para7. Manifesto e todos os arquivos esperados são validados por SHA antes da carga.

## Reexecução congelada

Executar o mesmo `semantic-gate-journey` nativo, com as specs forward/reverse em `data/rex_profiles/integration_20261016/visual-copy-v2/`, binário e ROMs já pinados, displays e diretórios de evidência novos. Cada carga aguarda VISU e ao menos60 frames novos, pausa e captura core/canvas e scope completo. Nenhum parâmetro do oráculo muda durante as corridas. Cópia width2 deve continuar SHA7a33ddfa…24d0b4 e IPS54f249c6…ef6ae; volta deve produzir a ROM base exata. A jornada BYOR não será repetida: suas duas tentativas e seu bloqueio do checkpointd394296c seguem aplicáveis e serão referenciados separadamente. Gates/certificação do produto pinado são reaproveitáveis; a certificação do host será renovada para esta rodada de QA.

O freeze inclui hashes das fontes locais de conversão/adapter/UI e das expectativas; resultado v2 só será registrado após as novas corridas. Não se declara recuperação de apresentação comercial, execução exata por PC ou equivalência completa de jogo. Pendência sonora preexistente segue OPEN.
