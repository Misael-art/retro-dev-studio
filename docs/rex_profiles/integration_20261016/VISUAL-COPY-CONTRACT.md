# Contrato congelado — cópia e apresentação autoral

Base produto 2f078dc2e95de18d284c7e2ecd749f4833512cc3; pesquisa ee8c581f07494c22100c688f09f02db0caacd56b. Este contrato antecede implementação, build e emulação desta cena. A classe copy_grid e sua edição 1↔2 já existem; não são entrega nova.

## Dados, cadeia e apresentação

`data/rex_profiles/integration_20261016/visual-copy/assets.json` congela os 64 descritores e oito tiles 8×8 (nibbles 0..3), duas paletas de cores primárias/complementares extremas e geometria. Descritor = tile nos bits 0..2, paleta no bit 3. Sem compressão; não há codec novo. Bytes ROM → carregamento C byte a byte → buffer fonte → oito instruções recuperadas → destino → conversão explícita em palavras TILE_ATTR_FULL → VDP_setTileMapDataRect do SGDK oficial → VDP/core → canvas. A grade de bytes não é nametable VDP. A apresentação, inicialização, wrapper ABI e marcador são autoria de teste, não código recuperado.

Uma estrutura global contígua alinhada em WRAM: guard0[16]=A5; source[64]=recurso; guard1[16]=5A; destination[128]=0; guard2[16]=C3; map[112] u16; guard3[16]=3C; done u32=56495355. Tamanho 484, offsets 0,16,80,96,224,240,464,480. Endereço final resolvido pelos símbolos do linker antes da execução e registrado no manifesto; sem fixar RAM ocupada pelo SGDK. Comparar os 484 bytes, inclusive fonte, destino completo, mapa e guardas. Timers, heap e stack do SGDK fora dessa estrutura não são invariantes; não alegar preservação de toda WRAM. A estrutura é a memória causal e as quatro guardas são o exterior relevante.

Rotina: A3=source, A2=destination, D1=3, D2=7, MOVE.B/W (A3)+,(A2)+, DBRA D2, LEA 16(A2), DBRA D1. Declaração precisa por símbolos entry/end, exatamente 30 bytes. Wrapper salva/restaura D2/A2/A3 fora da região. Width1 lê32 bytes, escreve32, stride24, span80, avanço96; width2 lê64, escreve64, stride32, span112, avanço128. Ambos válidos, alinhados e sem sobreposição.

Consumidor fixo lê destination[0..112), converte cada descritor para tile SGDK TILE_USER_INDEX+(id&7), paleta id>>3; não consulta opcode/largura. Publica 16×7 células no BG_A em (5,5). Tile0 transparente e buracos de tiles1..7 revelam BG_B quadriculado preto/branco de células8×8 em toda tela320×224. Duas tiles adicionais só para BG_B. Prioridade/flip/scroll zero. SGDK faz a escrita VDP; nenhuma implementação particular de renderer no app.

## Oráculo e episódio

Antes do build e de qualquer core, referência Python independente usa índices de bytes para os dois destinos e composição de pixels declarativos para as imagens RGBA320×224; não executa C/SGDK nem usa framebuffer como esperado. Gravar hash dos vetores, mapa, imagens e diff antes de executar. Preview PNG é artefato do oráculo. Comparar tela inteira e ROI [40,40,168,96). Dentro e fora da ROI a classe espacial e cor devem coincidir. Por diferenças de DAC/pixel format, tolerância congelada de 7 por canal RGB; alpha255 e dimensões exatas, sem deslocamento/crop/normalização aprendida de captura. Preto0 e branco/primárias255 são esperados.

Episódio autoral: novo carregamento/reset de cada ROM, nenhum botão de jogo pressionado, aguardar marcador VISU; esperar pelo menos60 frames novos após marcador; pausar; colher observação direta e canvas da mesma pausa. Conferir hash realmente carregado, core pinado e frames. Original/original repetido e no-op (voltar largura original no canvas, plano vazio/sem publicação) devem manter buffers e pixels. Jornada nativa recuperar→nodes→editar→salvar→destruir sessão→reabrir→gerar→executar. Controle reverso usando a cópia gerada como entrada deve restaurar bytes originais (checksum SGDK incluso quando válido) e pixels originais.

Negativos independentes e anteriores à emulação: largura oposta, stride errado, ordem transposta, linhas invertidas, paleta trocada, transparência removida, byte de guarda alterado, pixel alterado, identidade de ROM errada. Todos devem reprovar pelo comparador correspondente; imagem de outra largura/captura antiga não pode satisfazer o resultado proposto. Aceite causal: diffs de buffers e pixels observados iguais aos previstos, com pixels diferentes em quantidade >0, original/original e reversão iguais; core e canvas iguais byte a byte. Não aceitar apenas hashes diferentes ou qualquer diferença de pixels.

## BYOR e limites

Reavaliar cadeia estática registrada no Addendum043 sem versionar bytes comerciais. Tentar episódio limitado: reset neutro180 frames, Start por1 frame, neutro180, direita120, neutro60 (ou registrar incapacidade observável da API existente). Capturar RAM fonte/destino e FB nas fases disponíveis das duas ROMs. Usar somente observadores existentes; sem PC/chamador/args inventados. Ausência de correspondência/prova causal dá bloqueio comercial reproduzido, não PASS comercial. Não usar esse episódio para alterar o esperado autoral. Não afirmar equivalência completa de jogo nem execução exata sem sonda disponível.

## Produto e regressões

Classificar região recuperada como descrição de ROM, sem convite a adicionar evento autoral. Grafos autorais/mistos continuam sujeitos a missing_entry, validação de portas e execução autoral inalterada. UI distingue valores originais recuperados, proposta, resultado publicado e ausência de observação de execução automática. Nenhuma alegação de teste com humanos. Regressões copy-grid, holdout semântico e gates canônicos; host:certify final. Pendência sonora nodegraph-authoring preexistente continua OPEN. Sem push/merge/release/promoção/dependência/core novo.
