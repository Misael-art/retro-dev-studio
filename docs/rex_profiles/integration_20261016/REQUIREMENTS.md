# Comparação curada — mapa de aceitação

Escopo único: perfil m68k.counter_threshold_state_gate.v1; rom_region_entry / rom_counter_compare / rom_state_write / rom_region_exit existentes. Não incorpora copy-grid/bit-transform nem muda crates, registry, publicador ou decodificação.

| Requisito | Implementação | Teste / prova | Estado atual | Limite |
|---|---|---|---|---|
| Identidade/forma da ROM autoral | builder pinado selecionado do laboratório + fixture hex autoral | SHA 8246bb88…f6f218, 2593 bytes | reproduzido | fonte conhecida, sem descoberta |
| Backend rederiva a comparação | SemanticEngine + rex-gameplay sem mudanças | lab_comparison_backend_rederives_and_reviews_curated_package | passou | entrada 0x240/saída 0x25E declaradas |
| Pacote curado não contorna revisão | mesma canonical_signature e ipc_edit | mesmo teste compara assinatura e publica edição | passou | somente limiar direto sem bias nesta prova |
| Recusas por ROM/perfil/mapping/operador/topologia/domínio | ipc_edit/review existentes | lab_comparison_discriminating_refusals_leave_no_publication | passou | faixa do grafo recusada como graph-diverges, formulário out-of-range |
| Destino ocupado/transação | rex_publish existente | teste novo repete publicação e confere ambos arquivos; testes Faulty existentes | passou | original e par existente preservados |
| Resposta de outro pedido/sessão | ProfileGraphBridgePanel | teste vermelho→verde de request_id; contextos/instâncias existentes | passou | resposta não vira observação atual só por casar ROM |
| Região/nodes/origem/assinatura na GUI | RexProfileLogicPanel + ProfileGraphBridgePanel | semantic-gate-journey | GUI 003 63/63 | automação não é estudo com humanos |
| Edição/salvar/fechar/reabrir | editor/persistência existentes | mesmo cenário, janela destruída e projeto do disco | GUI 003 63/63 | cópia via publicador, não compilador genérico de topologia |
| Diff exato/cópia/IPS | publicador existente + aplicador JS independente de teste | cenário exige diff [0x247], tamanho e original iguais | backend e GUI passaram | checksum base inválido é preservado; nenhum extra permitido |
| Execução causal | mesmo core Genesis Plus GX do produto | ledger de sete estados, contador/estado finais, SHA carregado/core | GUI + core passaram | inputs por caso declarados pelo caller autoral; flags/registradores/stack/vídeo/áudio não comparados |
| Regressões e gates | suites do destino, build canônico e regressão semântica | logs e relatórios desta missão | certify READY; frontend 1041/3 skips, Rust 1032/92 ignored; GUI anterior 55/55 | nodegraph-authoring áudio permanece preexistente instável |

A fonte e o pacote foram selecionados de ee8c581f; FREEZE.json registra SHA de cada arquivo e critérios antes da medição. Resultados herdados do laboratório não são resultados da GUI. Proposta seguinte só após esta fatia: discutir integração de operações tipadas de memória/transformação com lowering e contratos; nenhum node novo nesta rodada.

## Fechamento e distinção das evidências

Nova: revisão no backend real (2 testes específicos), 63/63 da GUI com save nativo e sete estados observados no Genesis Plus GX do produto, IPS independente, regressão anterior 55/55 e 60 casos, certificação READY exit 0. Herdada: hipótese e pacote autoral, runtime BlastEm da pesquisa, evidências do perfil para outro alvo. Ausente/não alegada: trace/callers do jogo comercial, flags/registradores/stack, vídeo/áudio, hardware físico, outras plataformas e participante humano. Falhas preservadas: teste vermelho da resposta obsoleta, asserção inicial com código de erro incorreto, TypeScript Array.at no helper, GUI 002 com localizador do botão Salvar. Falha externa preexistente: nodegraph-authoring som de vitória instável, continua aberta.

O layout herdado da projeção se sobrepunha; o usuário pode aplicar Organizar tudo, como fez o roteiro, sem mudança semântica. A captura reaberta mostra aviso de rascunho local diferente, embora os dados salvos/procedência sejam iguais: não se reivindica UX sem fricção nem estudo com participante.

## Segunda classe — copy-grid

O escopo e os resultados da comparação acima permanecem históricos. A missão
seguinte integra uma classe de memória/controle com edição apenas da largura;
seu mapa requisito→implementação→teste→resultado→limite está em
[COPY-GRID-RESULTS.md](COPY-GRID-RESULTS.md), com contrato congelado e negativos
próprios. Não amplia a comparação para recompilação genérica de grafos.
