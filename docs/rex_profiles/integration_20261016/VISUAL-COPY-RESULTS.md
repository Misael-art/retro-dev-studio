# Cópia recuperada → dados → apresentação autoral (Experimental)

## Estado de aceite

**Prova gráfica absoluta v1 REPROVADA; entrega integral bloqueada pelo contrato de cor.** A implementação e a jornada demonstram a cadeia e o efeito causal exato no cenário autoral, mas não passam a expectativa RGB congelada. A v1 não foi ajustada após a observação. A exceção para contrato v2 foi solicitada e permanece pendente enquanto não houver resposta explícita. [Diagnóstico e fontes oficiais](VISUAL-COPY-COLOR-DIAGNOSIS.md).

Base 2f078dc2, freeze b0f9f8d8, oráculo anterior ao build 8a0cd9d2; pesquisa ee8c581f preservada. A classe copy_grid já existia; esta rodada não a apresenta como novidade. Nenhuma classe, node, codec, publicador, dependência ou core novo. O único código de produto é diagnóstico/contexto da UI; toda infraestrutura de apresentação e oráculo é QA autoral externa ao runtime.

## Cadeia explícita

Artefatos assistidos por símbolos, não descoberta automática: ROM autoral de 393216 bytes SHA `fbc72b252ec31eb221362c305cd4c2c631fbce15394b729109a699f3c1d10435` contém recurso de 64 bytes em 0x17988..0x179C8, SHA `5b13535d16c6836d6c4541a1ed99a11c5ccc83ec32e1fc9e4aeda8c760ae34e7`. Sem compressão. Cada byte codifica tile 0..7 e paleta 0..1. C autoral carrega os bytes em FF0058..FF0098. O wrapper ABI autoral chama a região de 30 bytes 0x2204..0x2222, recuperada pelo analisador existente em source FF0058 → destination FF00A8. Quatro linhas×oito colunas, gap 16, width 1↔2. Destino completo FF00A8..FF0128, com guardas exteriores, fonte preservada e mapa.

O consumidor C lê sempre 112 bytes e transforma cada descritor em uma palavra TILE_ATTR_FULL: índice 16+(v&7), paleta (v>>3), flip/prioridade 0. Essas 112 palavras em FF0138..FF0218 são transferidas pelo SGDK oficial ao BG_A 16×7 em (5,5). Os descritores de bytes não são chamados de nametable. BG_B quadriculado permite observar transparência; tiles/paletas assimétricos distinguem ordem, stride e largura. [Manifesto completo de intervalos/dependências](../../../data/rex_profiles/integration_20261016/evidence/visual-copy/resource-routine-presentation-chain.json).

O linker SGDK usa símbolos E0FFxxxx. A fixture emite operandos CPU24 FFxxxx subtraindo o prefixo de link apenas nas duas LEA. Não se ampliou o contrato do analisador. A primeira tentativa, com símbolo fora do mapa aceito pelo fixture builder, está preservada em scratch. A ROM SGDK original tem checksum de cabeçalho 0FCB diferente da soma 8B51 do arquivo; o publicador existente conserva esse campo originalmente inválido (a política existente só o atualiza quando a base já o tem válido). Não houve acesso inválido para produzir diferença gráfica. A edição muda somente 0x2214, sem crescimento, relocação ou outro caminho de patch. Uma reconstrução independente em diretório novo repetiu exatamente o hash da ROM autoral; manifesto/log de replay preservados.

## Previsão, observação e controles

Referência Python independente do C/SGDK, calculada antes do build: source→destino por índices de bytes, palavras VDP pela codificação declarada e composição de pixels pelos tiles, paleta e transparência. Posição, ROI [40,40,168,96), tela 320×224 e tolerância 7 estavam congelados. Os arquivos e hashes anteriores à emulação permanecem em `data/rex_profiles/integration_20261016/visual-copy/`.

| Evidência | Resultado v1 | Limite |
|---|---|---|
| Scope completo de 484 bytes, width1 | SHA d3903c62…1513e, igual ao oráculo | Exclui timers/heap/stack SGDK fora do scope |
| Scope completo de 484 bytes, width2 | SHA 2e682f3d…7a88f, igual ao oráculo | Inclui 128 bytes de destino, 224 de mapa, fonte, quatro guardas e marcador |
| Diferença de memória | Exatamente 162 bytes nos offsets previstos | Não é preservação de toda WRAM |
| Diferença de pixels | Exatamente 3309 posições previstas | Conjunto causal correto não substitui cor absoluta |
| Imagem absoluta original/repetição | REPROVADA, 36560 pixels fora da tolerância | Intensidade 239 vs 255 esperado |
| Imagem absoluta cópia | REPROVADA, 37280 pixels fora da tolerância | Mesma causa de cor |
| Core→canvas | Igualdade byte a byte, dimensões 320×224 | Mesma pausa/carga; não é referência independente |
| Original/original | Buffer e framebuffer idênticos | Mesma ROM recarregada e marcador +60 frames novos |
| No-op nativo | Plano vazio, publicação bloqueada; execução da ROM intacta repetida | Não inventa arquivo de saída para edição vazia |
| Volta 2→1 nativa | Retorna SHA fbc72b25…0435, RAM/pixels base | Imagem absoluta continua reprovada |
| Negativos anteriores ao core | 9/9 rejeitados | Outra largura, stride, transposição, linhas, paleta, transparência, pixel, guarda e buffer |
| Negativos sobre observação | Rejeita previsão/imagem da outra largura | Não aceita captura obsoleta como resultado da proposta |

A GUI percorreu recuperar→abrir nodes→conferir endereços→editar largura→Salvar nativo→destruir sessão→reabrir do disco→gerar novamente→executar original/cópia. Produtos coincidem após reabertura. Cópia width2 SHA `7a33ddfa058c9d3e2e0e399450bb6ae8a1a4b03a6fbd79b504f0ba70b324d0b4`; IPS SHA `54f249c6a574c37702f889e92e6f6df939104713bd474bdbd4c7c7e7bd6ef6ae`. ROM e core efetivamente carregados foram conferidos pelo observador do produto; core pinado 07c10476…8310b1. Binário app SHA `74033134f47510c1ef37d8e6025a8bc6986436d4060ae3e96b1ba9bcc3d1670e`. Forward v1 inicial: 79/82; reverso v1: 79/82. Corrida forward final: **86/89**, com verificação do manifesto/hash dos arquivos do oráculo, input neutro explícito e identidade de ROM na captura do framebuffer. Relatórios preservam as três reprovações em cada direção.

## BYOR delimitada

Revalidação estática executada novamente, sem escrever na pesquisa: 37 pontos de código conferem na imagem c7da53a1…ebb; tabela 0x1B64C parâmetro 0 seleciona stream 0x65432; codec existente Enigma consome 634 e produz 4096 bytes SHA 322a1483…44d0; A1=FF4000, D0.word 0 em chamada0x1B6D2→0x171E. Limpeza posterior preserva FF4000 e há fallthrough para0x1B6E8..0x1B706. Projeção 64×64 width1, stride 128, span 8128 continua estática. O código seguinte reusa FF4008 para outra estrutura; não há consumidor VDP demonstrado.

Episódio real com UI pausada desde a carga, backend/input/frame APIs já existentes: neutro 180, Start 1, neutro 180, direita 120, neutro 60. Três cargas: original, repetição original e cópia publicada anteriormente pelo produto. Cada uma tem cinco amostras com ACK, consumo de input, hashes de ROM/core, WRAM fonte 8192/destino 12224 e framebuffer. Original/original é reproduzível. Nenhuma das cinco fases distingue os framebuffers original/cópia; nenhuma amostra de fonte iguala o recurso estático de 4096. A API de trace responde available=false; PC/chamador/args permanecem desconhecidos. Isso não prova que a rotina nunca execute. **Comercial BLOCKED_RESOURCE_TO_PRESENTATION_PROOF, não concluído.** Capturas e bytes comerciais ficam apenas em scratch privado; o Git contém metadados/hashes.

Segunda tentativa congelada em 50363df3: neutro 600/Start 10/neutro 240/direita 1200/neutro 60, três cargas, 15 novas amostras, 2110 frames por carga. A inspeção privada mostrou uma cena de gameplay ao final. Original/repetição são idênticos; original/cópia continuam sem diferença nas cinco fases e nenhuma amostra iguala o recurso estático. ACK/geração, consulta de input nos frames exatos, core e ROM carregados conferem. A prova comercial continua bloqueada: chegar a uma cena de gameplay não prova alcance desse recurso. Ambas as tentativas são preservadas separadamente.

## CX e regressões

Regiões totalmente recuperadas, com identidade ROM/perfil e entrada/saída, recebem diagnóstico descritivo; o editor não sugere adicionar evento autoral. Grafos autorais ou mistos continuam sujeitos a missing_entry; portas e assinatura estrutural continuam validadas; a definição de entrada executável/simulação local não mudou. O painel separa original, proposta, cópia publicada e ausência de medição de execução pelo painel. Não se fabrica mapeamento PC→node nem se atribui apresentação autoral ao código recuperado. Não houve participante humano.

No mesmo binário: regressão copy-grid 60/60, comparação holdout 63/63, chamada opaca 55/55 (60 entradas). Gates e host:certify **READY**: tree/lint/tsc, frontend **1045 passed/3 skipped**, Rust **1036 passed/93 ignored**, Clippy lib e padrão com -D warnings, fmt e upstream SGDK/PVSnesLib oficiais passaram. Certificação preservada em host-certify-readiness.json antes de o diagnóstico do E2E sobrescrever o arquivo canônico. Pendência sonora nodegraph-authoring permanece **OPEN**, com histórico anterior preservado, sem investigação nesta rodada.

## Requisito → implementação → teste → resultado → limite

| Requisito | Implementação | Teste/evidência | Resultado | Limite |
|---|---|---|---|---|
| Congelar antes de implementar | Contrato b0f9f8d8, assets e oráculo 8a0cd9d2 | Hashes e cronologia Git | Feito | Erro de cor v1 explícito |
| Recurso→rotina→apresentação | Fixture SGDK autoral; região de 30 bytes; consumidor fixo | chain.json, build.json, GUI | RAM e efeito causal exatos | C/VDP auxiliares não recuperados |
| Previsão independente | oracle.py, índices e composição declarativa | width1/2.scope,rgba,png,oracle.json | RAM e conjunto de pixels conferem | Imagem absoluta v1 reprovada |
| Jornada canônica | Mesmo runner semantic-gate-journey, spec de dado | Relatórios forward/reverse e screenshots | Persistência/cópia/IPS/reversão conferem | Sem novo pipeline; UI não observa PC |
| Identidade e exterior | emulator_observe + Scope e quatro guardas | ROM/core hashes, buffers completos | Conferem | Memória externa ao scope não invariável |
| Comparadores discriminantes | Oráculo/strict RAM/pixel comparator |9 negativos + rejeição largura antiga | Rejeitam dados errados | Não corrige cor observada |
| Corpus real | Script estático existente e episódio limitado | byor-static/episode-result.json | Estático passa; episódio bloqueado | Sem PC, seleção ou consumidor comprovado |
| CX | Classificador de região + texto de evidência | 2 testes novos, 75 focados, GUI | Aviso autoral removido no contexto correto | Sem usabilidade humana |
| Regressões/certificação | Gates e jornadas existentes | Índice regressões/certificação | Regressões 178/178 e certify READY | Som preexistente OPEN |
| Fechamento | Relatório, reprodução, Memory Bank e inventário | Checkpoint local | Pendente aceite gráfico | Sem push/merge/release/promoção |

Logs brutos, tentativas reprovadas e hashes ficam em scratch com cópias normalizadas para revisão. Uma aprovação de gates não transforma o teste gráfico reprovado em PASS. Não se usa a alegação de entrega integral autorizada enquanto faltar esse aceite.
