# Reprodução do aceite autoral v2 (Linux, combinação pinada)

Este procedimento usa o produto do checkpoint d394296c e o oráculo congelado em d8be191e. A v2 foi autorizada após a falha v1, com derivação no código do core e testes literais antes de nova jornada. Não é validação cega. Não editar/normalizar capturas, ampliar tolerância nem alterar o esperado durante uma corrida. A v1 e seu resultado 86/89 continuam reprovados. BYOR e pendência sonora permanecem com os limites já registrados.

## Identidades e fontes

App já existente `src-tauri/target-test/debug/retro-dev-studio`, SHA 74033134…1670e; core Genesis Plus GX SHA 07c10476…8310b1. Os hashes completos, funções/tabelas e configuração estão no [contrato](VISUAL-COPY-CONTRACT-V2.md) e em `data/rex_profiles/integration_20261016/visual-copy-v2/color-model.json`. Validar o app/core antes de qualquer carga. Nenhum rebuild do app/ROM é necessário para esta correção exclusiva do oráculo.

Os três arquivos fonte oficiais são da revisão 46a55214d0dab654e5a525ae0c54921ca9716872 e foram conservados fora do repo em `/home/misael/rds-scratch/rex-visual-copy-001/`, nomes `pinned-core-vdp_render.c`, `pinned-libretro-libretro.c`, `pinned-Makefile.libretro`. Para reconstruir esse diretório de entrada, baixar os três paths da mesma revisão imutável via URL raw oficial, sem compilar ou alterar o core; conferir os hashes do modelo. Os arquivos de terceiro não são incorporados ao produto.

## Referência independente antes da jornada

A seguir, use diretório de replay novo; os geradores/relatórios recusam saída existente. O verificador não executa o core nem lê capturas: valida hashes das fontes/binário/ROM, pedido compilado de RGB565, três paletas codificadas e 31 vetores literais. O gerador v2 reutiliza o compositor espacial e referência RAM v1 intactos, projetando apenas os rótulos de cor por palavras CRAM explícitas.

```sh
rtk proxy python3 scripts/rex_profiles/integration_20261016/visual_copy/verify_color_v2.py /home/misael/rds-scratch/rex-visual-copy-001 /home/misael/rds-scratch/visual-copy-v2-REPLAY-vectors.json
rtk proxy python3 scripts/rex_profiles/integration_20261016/visual_copy/oracle_v2.py /home/misael/rds-scratch/visual-copy-v2-REPLAY-oracle
rtk proxy node scripts/rex_profiles/integration_20261016/visual_copy/verify-visual-comparator-v2.mjs /home/misael/rds-scratch/visual-copy-v2-REPLAY-comparator.json
```

Conferir 31/31 vetores, 9/9 negativos de conversão, 11/11 negativos imagem/buffer e 13/13 do comparador. O manifesto regenerado deve ser byte a byte igual ao congelado, incluindo os hashes das expectativas. Os scope.bin devem continuar iguais à v1; 162 offsets de RAM e 3309 índices de pixels devem coincidir exatamente. O teste do comparador lê as expectativas congeladas no repo, não resultados de emulação. A política absoluta v2 é zero tolerância RGBA; causalidade e demais critérios são preservados.

## Jornadas afetadas no binário reutilizado

```sh
rtk proxy env RDS_SEMANTIC_JOURNEY_SPEC=/home/misael/Projects/REX-INTEGRATION-2026-10-05/data/rex_profiles/integration_20261016/visual-copy-v2/forward-journey.json TMPDIR=/home/misael/rds-scratch/rex-copy-grid-20261016/tmp python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb /home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb --xvfb-sha256 5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351 --rom /home/misael/rds-scratch/rex-visual-copy-001/build2/project/out/rom.bin --app src-tauri/target-test/debug/retro-dev-studio --work /home/misael/rds-scratch/visual-copy-v2-REPLAY-forward/work --log /home/misael/rds-scratch/visual-copy-v2-REPLAY-forward/run.log --scenario semantic-gate-journey
```

Depois de a ida terminar, repetir com `reverse-journey.json` e work/log novos. A spec de volta contém o caminho da cópia publicada anteriormente; esses bytes têm o mesmo hash da cópia recém-gerada na ida. Se o path privado não estiver disponível, clonar a spec para scratch e ajustar somente `rom` para a cópia da ida, conservando SHA e todos os critérios. Nunca usar filename como identidade. Para outra localização de fontes/ROMs, mudar somente os paths e validar os mesmos hashes; não alterar limites, dados, modelo ou expectativas.

Esperado em ambas: 88/88; zero pixels divergentes nas três cargas; hashes core/canvas/oráculo iguais; scope completo de 484 bytes; diferença 162 bytes e 3309 posições; no-op sem publicação; reversão ao SHA fbc72b25…0435. Guardar o prefixo `copy-grid-<timestamp>` dos relatórios e os arquivos de captura em `src-tauri/target-test/validation/`. O runner é o mesmo caminho de UI/edição/persistência/publicação da v1; não há outro patcher. Xvfb é próprio e autenticado, sem alteração do display do usuário. Se houver falha, preservar tudo e parar; não ajustar a v2 automaticamente.

## Gates, preservação e reprodução histórica

Executar um trabalho pesado por vez. `npm run host:certify` renova tree/lint/tsc/frontend/Clippy lib/Rust/upstream com as dependências oficiais; complementar Clippy padrão e fmt. Preservar imediatamente o relatório de certificação e o log bruto, antes de qualquer diagnose/E2E seguinte. O produto permanece sem mudanças em `src/`/`src-tauri/`; regressões anteriores 178/178 no mesmo binário são reaproveitadas com o padrão v1 do comparador preservado.

Revalidar todos os hashes de `evidence/visual-copy-v2/FROZEN-INPUTS-SHA256.json` depois das corridas e o inventário de preservação v1. Os arquivos v1 em `visual-copy/`, `evidence/visual-copy/`, seus quatro documentos históricos e `visual_copy/oracle.py` devem continuar byte a byte idênticos. A reprodução v1 pelo mesmo helper sem flag v2 continua usando tolerância7 e deve continuar reprovando suas três imagens absolutas; não reclassificar 86/89 como PASS. As 30 amostras dos dois episódios BYOR, relatórios de bloqueio e pendência sonora OPEN são evidências ainda aplicáveis; não os rerodar para fabricar alcance comercial.

Ao fechar: novo checkpoint no Memory Bank e Current Wave, status local autoral com Experimental mantido, hashes e logs brutos/revisão registrados, checkouts limpos, sem push/merge/release/promoção.
