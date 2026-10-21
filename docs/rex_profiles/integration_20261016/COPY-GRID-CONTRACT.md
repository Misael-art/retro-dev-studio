# Contrato congelado — copy-grid v1 (Experimental)

Congelado antes da implementação/medição no destino em 2026-10-16.
Produto 89189485; pesquisa ee8c581f. Ambos limpos no início. Responsável:
integrador desta missão; pesquisa e demais worktrees somente leitura.
Host diagnose READY, fingerprint 60249508aff61897cdd43160d4716b2344d69282507a36c5a457c0028143f6e2.

## Auditoria da origem

Fontes: semantic-corpus-copy-loop.mjs e seu teste; Addenda 037–039/043.
037 foi retificado por 038 ANTES da execução: intervalo completo
[0x1B6E8,0x1B706), 30 bytes. 039 compara região em caller sintético;
043 relaciona estaticamente codec→buffer→cópia. Nenhum prova chamada pelo
jogo, seleção de recurso em execução, nametable, imagem ou áudio.

O analisador de pesquisa valida relações de oito instruções, mas não recusa
alias dos dois contadores, alias dos ponteiros, A7 no MOVE.B (incrementa 2),
endereços fora do mapa, desalinhamento, sobreposição origem/destino ou fim
fora da WRAM. O encoder aceita largura 4 sem prova diferencial correspondente.
Esses casos serão recusados no subconjunto de produção, sem mudar a pesquisa.

## Semântica aceita e lowering

Oito instruções, nesta ordem: LEA abs.l→destino; LEA abs.l→origem;
MOVEQ→contador linhas; MOVEQ→contador colunas; MOVE.(B/W) (origem)+→(destino)+;
DBRA colunas→MOVE; LEA gap(destino)→destino; DBRA linhas→MOVEQ colunas.
Registradores e endereços derivados dos operandos, nunca do jogo/hash.
Ponteiros distintos A0..A6; contadores distintos D0..D7. MOVEQ é sign-extended;
aceitos apenas imediatos 0..127: DBRA decremente low word e pare em FFFF,
portanto linhas/colunas = imediato+1 (1..128). DBRA displacement signed16,
base PC = endereço da instrução+2; os alvos têm de ser exatamente os acima.

Espaços separados: offsets de arquivo (região dentro da ROM linear <4 MiB)
e endereços CPU24 da WRAM canônica [FF0000,1000000), sem espelhos/VDP/IO.
Largura w∈{1,2}; incremento origem/destino por célula=w; origem contígua;
gap signed16 não negativo (0..32767); stride destino=colunas*w+gap;
bytes copiados=linhas*colunas*w; span destino=(linhas−1)*stride+colunas*w.
A LEA final também avança: destino final=destino+linhas*stride.
Aritmética checked, janelas e ponteiros finais no mapa ou one-past-end;
word exige origem/destino/stride pares. Rejeitar sobreposição dos envelopes
de leitura/escrita, inclusive alias por registrador; não alegar memmove.
Nada de inferência de callers, intenção do recurso ou vivacidade na saída.

Única edição: bytes_per_cell 1↔2. Revalidar TODAS as relações e janelas para
a largura proposta; se largura alternativa inválida, recusar região neste
perfil editável. Reencodar as oito instruções de campos tipados, sem usar
bytes de procedência; comparar ao patch do campo de tamanho. Apenas byte
alto do MOVE pode mudar; checksum MD somente se a base já era válida.
Reusar rexProfileEdit/revisão/publicador/IPS/persistência, sem pipeline novo.

Canvas compacto: entrada→rom_copy_grid→saída. Efeito memória e loops no
mesmo nó; origem/destino, espaços, dimensões, largura, incrementos, gap,
stride, spans, oito mappings binários, partes não compreendidas explícitos.
Edição da largura não afirma recompilação da topologia ou grafo inteiro.

## Expectativas executáveis, fixadas antes de medir

Primeiro fixture autoral: região 0x400..0x41E, A2/A3, D1/D2;
4 linhas×8 colunas, origem FF5000, destino FF7000, gap 16.
Caller zera WRAM (exceto stack reservado), preenche 8192 bytes em FF4000
com (i*37+11) mod256; chama região e grava sentinel 434F5059 em FF3FE0.
Largura 1: 32 bytes, stride24, span80; largura2:64 bytes,stride32,span112.
Compare janela FF1020..FF3FE0 e toda WRAM relevante fora dela; excluir
somente stack FFEE00..FFFEFF e sentinel separadamente verificado.
Original=reconstrução, editada=reconstrução editada; diferença prevista e
zero escrita não autorizada. Referência independente não lê o grafo.

Depois BYOR pin c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb,
se disponível: 64×64, origem FF4000,destino FF1020,gap64;
w1:4096 bytes,stride128,span8128; w2:8192,stride192,span12224.
Sentinel FF3FE0; primeiro diff relativo64. Harness ≠ chamada pelo jogo ≠ tela.

UI final: abrir/declarar/recuperar/revisar/editar/salvar/encerrar/reabrir/
cópia+IPS/executar original e cópia no core pinado do produto. Base intacta,
diff autorizado, aplicação IPS independente, identidade/procedência persistida.
Negativos: truncamento, alvos, contadores, aliases/desconexão, mapa,
overflow/span/stride, domínio inválido, ROM/perfil trocados, grafo adulterado,
saída ocupada, resposta antiga. Recusa sem publicação parcial.
Regressão comparação e jornada anterior, gates e host:certify aplicáveis.
Pendência sonora nodegraph-authoring permanece aberta. Sem push/merge/release/
promoção/dependência externa nova. Falhas e adendos preservados, sem reescrever
estas expectativas para aceitar medições.
