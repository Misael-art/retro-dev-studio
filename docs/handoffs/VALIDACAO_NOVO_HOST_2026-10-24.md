# Validação da preparação de host — 2026-10-24

Escopo: documentação de continuidade, launchers de sessão, reparos limitados nos bootstraps/limite de jobs e manutenção das dependências de desenvolvimento. Nenhuma fonte rastreada de `src/`, `src-tauri/` ou `crates/` foi alterada. Não é implementação das correções de UX; elas são a próxima missão descrita no handoff.

## Ambiente e identidade

Base pública `95d5ef237e9cbef321b13162f8b7f6823d094203`; branch `codex/new-host-cohesion-20261024`. Validação feita em checkout próprio com mudanças desta entrega presentes, indicado como dirty nos recibos; não no worktree original do Studio. Host existente Linux x64 BigLinux, Node24.18.0/npm11.16.0 ativados pelo launcher, Rust1.97.0, lock digest `dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377`. O Node/npm global era26.8.1/12.0.2; não foi substituído.

Logs privados em `RetroDevStudio-work/sessions/` e experimento isolado em `RetroDevStudio-work/experiments/bootstrap-checksum-20261024/`. O resumo curado e os hashes da fonte exercitada estão em `data/development_host_20261024/validation.json`. Estes caminhos são relativos ao HOME do host de validação, não destinos obrigatórios no novo host.

## Provas e limites

| Verificação | Resultado e alcance |
|---|---|
| `new-host.sh --plan` / Node plan | Plano sem provisionamento; caso sem Node coberto por subprocesso com PATH limitado |
| `new-host.sh --check` | PASS real neste host; não é certificação ou jornada GUI |
| `npm ci` pelo launcher | PASS com Node/npm fixados, lock preservado; não depende do npm12 global |
| Testes dirigidos de host/launchers | 57/57 na primeira execução; 58/58 no delta final, incluindo 19 casos do launcher e a distinção certificação/manutenção |
| Suite frontend após manutenção | 1164 PASS / 3 SKIP na suíte final; primeira certificação teve1163 antes do caso extra do launcher; 128 arquivos PASS / 1 SKIP; Vitest4.1.12 |
| Bash syntax e PowerShell parser | PASS; plano PowerShell sem Node executado em Linux sem criar diretórios. Não comprova instalação no Windows |
| Download com hash errado | Controle em função original vs corrigida: ambos recusam rc12; antes o arquivo inválido entrava no cache, agora não é promovido. Nenhum download/artefato não verificado foi executado |
| Fonte/limites de build | `RDS_BUILD_JOBS` validado e propagado à instalação por fonte; um coordenador por vez; falta de espaço interrompe sem apagar dados |
| Certificação completa | READY real, sete gates rc0: árvore, lint, tipos, frontend, clippy canônico, testes Rust e upstream |
| Rust / SDKs | 1066 PASS / 102 IGNORE; smokes oficiais SGDK/PVSnesLib Success=true; fmt e gates dos cinco crates rc0 |
| Auditorias | npm zero vulnerabilidades; cargo-audit rc0 com 12 warnings permitidos, sem exceção nova |
| Reentrada do nível zero | `new-host.sh --install --offline` PASS neste host já provisionado, sem sudo; não é prova de instalação limpa |
| Lock ocupado | Processo de controle vivo: segundo coordenador recusou rc10 e preservou os bytes do lock; fixture própria removida pelo seu dono |
| Bundle frontend | `npm run build` PASS em Vite6.4.5; aviso de chunk >500KB mantido, sem afrouxar limite |
| Instalação em OS recém-formatado | NÃO EXECUTADA nesta preparação; deve ser feita no destino |
| Jornada gráfica e estudo humano novos | NÃO EXECUTADOS; usabilidade continua não validada |

O teste de falta de espaço usa sondagem controlada; não encheu o disco do operador. O teste de download defeituoso substitui apenas a função de transferência em diretório próprio; não altera o bootstrap instalado nem depende de rede. O teste sem Node não desinstala Node do host.

Após a primeira certificação, refinamentos limitados às guardas de caminho/recibo e ao contrato de manutenção foram rechecados na suíte dirigida e no bundle frontend. A fonte Rust e os SDKs não mudaram. O resumo curado distingue as execuções; não somar testes de corridas repetidas como cobertura nova. A suíte frontend final tem seu próprio resultado registrado no resumo.

## Dependências e falhas preservadas

A primeira tentativa `npm ci --offline` com o npm global falhou `ENOTCACHED` e mostrou drift Node26/npm12. Não foi contada como instalação bem-sucedida. O launcher seguinte ativou os pins e `npm ci` passou; o audit então registrou seis pacotes afetados, incluindo duas severidades altas.

Foram atualizadas somente dependências existentes compatíveis: Vite6.4.3→6.4.5, família Vitest4.1.11→4.1.12 e override Undici7.29.1→7.30.1. Lock regenerado com integridades do registry oficial; sem `audit fix`, nova exceção ou troca de major. `npm ci` no lock atualizado retornou zero vulnerabilidades. Fontes primárias: [advisory Undici](https://github.com/advisories/GHSA-xjj6-f33q-929c), [advisory launch-editor/Vite](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [advisory Vitest](https://github.com/advisories/GHSA-qxg6-89mg-rqv8). Audit é fotografia datada, não garantia permanente.

Uma regeneração intencional do lock foi inicialmente feita por `--run`; o primeiro coordenador detectou `lockfile_changed` e deixou recibo FAIL. A alteração autorizada foi conferida e finalizada. Esse caso revelou uma distinção necessária: o contrato final exige lock estável em instalação/certificação/build, mas registra o delta em comandos de desenvolvimento intencionais sem mascarar seu rc. Um teste discriminante cobre os dois caminhos; o FAIL histórico permanece preservado. O launcher não é um atualizador automático de dependências.

## Limites de aceite

Um certificado READY é resultado do host/árvore realmente exercitados. Não o reaproveitar para o OS reinstalado, outra branch ou outro binário. O wrapper não baixa ROM/MUGEN, não restaura credenciais e não verifica que o destino do backup privado sobreviverá à formatação. Não houve merge, release, promoção de maturidade ou nova alegação de recuperação universal.

CI deve ser conferido pelo SHA publicado da PR. Uma consulta pendente não é PASS e não exige um ciclo infinito de commits documentais para cada consulta.
