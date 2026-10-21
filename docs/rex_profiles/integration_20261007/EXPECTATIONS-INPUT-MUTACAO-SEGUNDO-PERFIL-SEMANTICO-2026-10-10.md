# EXPECTATIONS — observação de input, regressão de gameplay, mutação completa e segundo perfil semântico — 2026-10-10

Congelado ANTES de corrigir. Base: HEAD `81b03f6d` (árvore limpa, host `READY`). Mudança de protocolo só por adendo datado; falha é falha; uma repetição aprovada não explica uma reprovada. Nada aqui declara universalidade nem usabilidade humana. Fora de escopo: trace de PC, novas classes, ampliar a ISA, vida/anéis, outro jogo, outro emulador, outro pipeline de patches, dependência nova.

## 0. O que é preservado como está
- `jump-gameplay-journey` de `2026-10-10T00-05-41-931Z`: **REPROVADA, 14/19** (binário `acc49225…`). Não é reclassificada.
- Mutação de `f018c762`: **22/23**, com um sobrevivente; o teste posterior matou esse mutante isolado, mas **não houve nova bateria completa**. O relatório antigo fica em `evidencia-f1b/mutacao.json`; o novo será publicado à parte.

## 1. Retificação por adendo (do fecho da F1b)
O fecho anterior e o `gameplay-validade-do-toque.md` afirmaram: "é da medição, não do REX" / "propriedade da medição do toque". **Essa atribuição não estava demonstrada.** O que os dados mostravam era só que a falta de confirmação ocorre com qualquer binário. A causa responsável **não estava isolada**: podia estar no observador do roteirista, no caminho de input do produto (UI → store → IPC → backend → core) ou em ambos. Fica valendo esta retificação; os dois textos não são reescritos.

## 2. Modelo de cinco etapas (o que cada sinal prova e o que NÃO prova)
| # | Etapa | Sinal | Não prova |
|---|---|---|---|
| 1 | evento nativo recebido pela UI | o handler de teclado formou uma intenção | que algo foi enviado |
| 2 | solicitação enviada | registro com sessão + sequência, antes do IPC | que o backend recebeu |
| 3 | aceita ou recusada pelo backend | resposta `ok` (aplicada ao estado de joypad na época certa) ou recusa/erro | **que o core leu esse estado** |
| 4 | estado consultado pelo core | o core, ao rodar um quadro, leu o joypad enquanto aquela transição era a vigente | que o jogo reagiu |
| 5 | efeito observado no jogo | RAM/quadro mudam como previsto | — |
**ACK de envio (etapa 3) não é prova de consumo (etapa 4).** O `lastJoypadAck` de hoje é etapa 3 e ainda por cima só guarda UMA confirmação.

## 3. Hipóteses a confirmar ou refutar por teste determinístico (promises/barreiras controladas, sem sleep)
- H1 **perda de OBSERVAÇÃO por descarte de ACK:** se a soltura é solicitada antes de o ACK do aperto chegar, o ACK do aperto é descartado (sequência já não é a corrente) e `lastJoypadAck` nunca mostra o aperto, embora o backend o tenha aceitado.
- H2 **perda de OBSERVAÇÃO por amostragem:** um observador que lê um único `lastJoypadAck` em intervalos perde o estado "aperto confirmado" quando a soltura é confirmada entre duas leituras.
- H3 **perda REAL de input entre dois quadros:** aperto e soltura aplicados ao backend sem que nenhum quadro emulado rode entre eles nunca são lidos pelo core; o jogo não vê o toque.
- H4 espera por mutex: a aplicação do input espera o quadro em curso terminar (mesmo mutex); isso atrasa o ACK e alimenta H1.
- H5 perda de foco, H6 época/sessão, H7 taxa de quadros e atraso do observador: medir quantas das faltas caem em cada uma; se não houver ocorrência, dizer "não observado", não "descartado".
Critério: H1 e H3 têm de ser demonstradas **separadamente**, cada uma com um teste que reprova antes e passa depois.

## 4. Correção permitida e contrato
- **Observação limitada por sessão, sequência e quadro**: registro limitado (anel) das transições, cada uma com sessão, sequência, desfecho do backend (aceita/recusada/erro), geração no backend, quadro em que foi aplicada e quadro em que o core a leu pela primeira vez (ou "nunca lida: substituída antes de qualquer quadro").
- **Preservado:** `lastJoypadAck` continua sendo só a confirmação da solicitação CORRENTE; um ACK antigo nunca substitui o estado atual; ACKs de outra sessão/época continuam descartados.
- **Proibido sem demonstrar a necessidade e definir contrato antes:** latch, fila ou prolongamento de tecla no produto. Se H3 se confirmar, o comportamento do produto para toques menores que um quadro é registrado como LIMITE; mudar isso exige adendo próprio.
- Sem aumentar sleeps, sem repetir até passar, sem reduzir limiar.

## 5. Protocolo da jornada (pode mudar por adendo ANTES de reexecutar)
Hoje: toque = tecla nativa por 60 ms; segura = 5000 ms; validade = `lastJoypadAck` amostrado. Se o estímulo passar de milissegundos para quadros emulados, o adendo tem de: preservar a execução antiga; manter os critérios causais G1–G7 e os limiares; declarar o novo estímulo; continuar com teclado NATIVO; **não** injetar input no core.
Validade exigida de cada repetição: aperto e soltura aceitos pelo backend na sessão correta **e** aperto lido pelo core (etapa 4), com efeito medido; controles `original`/`original2` e `noop` preservados. Toda tentativa e toda transição são registradas; tentativa inválida não é descartada em silêncio.

## 6. Critérios de saída
| ID | Critério |
|---|---|
| I1 | H1 e H3 demonstradas separadamente por teste determinístico (vermelho antes, verde depois); H2, H4–H7 com resultado declarado |
| I2 | DTO/observação distingue aceitação (etapa 3) de consumo (etapa 4), limitada por sessão, sequência e quadro; proteções contra resultado obsoleto intactas (testes existentes sem mudar asserção) |
| I3 | `jump-gameplay-journey` em Sonic 1 e Delta no binário final: **duas execuções completas consecutivas** aprovadas, sem alterar código nem critério entre elas. Isso é repetibilidade limitada, não ausência universal de falha. Se reprovar: seguir no diagnóstico e **não** declarar fechamento integral |
| M1 | 23 mutantes sobre a árvore final: baseline verde antes; 23 aplicados; cada um reprova por falha DISCRIMINANTE (teste nomeado); erro de compilação, timeout ou falha de infraestrutura **não** conta como morto; restauração comprovada (`git diff` vazio); baseline verde depois. Relatório novo, separado do antigo |
| S1 | manifesto de arquivos + SHA-256 do motor congelado em commit ANTES do segundo perfil semântico |
| S2 | segundo perfil AUTORAL da mesma classe (`rex-semantic-profile/v1`, mesmo analisador), carregado pela carga genérica (pasta), com variante executável que mude registradores, endereços, guarda ou orientação da comparação em relação às duas ROMs já usadas; mudar só nome/id não vale. Commit sem Rust/TypeScript de produção; instrumentos auxiliares (gerador, roteiro) declarados à parte; mesmo binário |
| S3 | pela interface real: carregar perfil e ROM; recuperar a região; revisar operações; editar o limiar no canvas; salvar, encerrar, reabrir; gerar cópia e patch; executar original e cópia; comparar com referência independente (core). Original preservada; exterior da região autorizada conferido. Amostra não cega. Só contador e estado são comparados; chamada opaca, registradores e flags ficam fora da alegação |
| R1 | regressões no binário final: `jump-profile-journey`, `jump-canvas-journey` (8+8 SHA), `profile-authoring-journey`, `semantic-gate-journey`, `nodegraph-authoring`; `sonic-layouts`/`sonic-consumers` só se a inspeção mudar. Como o caminho de input do emulador muda, entra também a jornada de teclado nativo do editor (`nodegraph-authoring` já joga por teclado) |
| G1 | gates: `check:tree`, `lint`, `tsc --noEmit`, `npm test`, `cargo clippy -- -D warnings`, `cargo test --lib`, `cargo fmt --check`, `host:certify` |

Resultado permitido, se e só se os critérios valerem: "Duas configurações da classe semântica demonstradas no motor compartilhado, com observação de input discriminante, regressões revalidadas e limites explícitos."
