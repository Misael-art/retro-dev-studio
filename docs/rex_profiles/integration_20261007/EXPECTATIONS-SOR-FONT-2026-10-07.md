# EXPECTATIONS — Streets of Rage (World, PtBr): edição gráfica da fonte (congelado ANTES de executar o efeito)

Congelado em 2026-10-07, commit de código `e16047d6` (a prova de efeito só roda depois deste arquivo estar commitado).
Nada aqui foi ajustado depois de ver o resultado; mudanças posteriores entram em ADENDO datado.

## Recurso e edição

- ROM base: `Streets of Rage (World).gen` (membro do zip "Translated PtBr", CRC-32 `88e4ef3c`), SHA-256
  `304f56ba2560a7cd6b93dd092cb0d17e4cd783b9086cf4bf069d6fdd2cb3961d`, 524288 bytes. É uma tradução, não a ROM original.
- Recurso: stream Kosinski base em `0x389A0` (514 bytes → 1568 bytes = 49 tiles 4bpp), fonte itálica. Perfil `streets_of_rage_world_ptbr/font_kosinski/v1`.
- Consumidor medido: texto de introdução ("ESTA CIDADE ERA UM LUGAR PACIFICO E FELIZ…") e "PRESS START BUTTON" do jogo.
  Mapa observado (6 ROMs com código binário por tile, decodificação por célula 8×8): A=1, C=3, D=4, E=5, F=6, G=7, I=9, L=12, M=13,
  N=14, O=15, P=16, Q=17, R=18, S=19, T=20, U=21, Z=26 (B,H,J,K,V,W,X,Y: inferidos, não observados); pontos = 41/42.
- **Edição (pela UI):** tile 1 (letra A), linha 7, colunas 0–7 := índice 1 (8 pixels; um "sublinhado" na cor de preenchimento da própria letra).
  Antes da edição esses 8 pixels valem 0 (transparente) — verificado no plain decodificado.

## Efeito esperado (previsto antes de rodar)

Bytes/índices (nível 1):
- O plain da cópia = plain da base com EXATAMENTE 8 nibbles alterados (tile 1, linha 7, col 0..7: 0 → 1); nenhum outro nibble difere.
- Stream da cópia ≤ 514 bytes (espaço do slot original); bytes da cópia que diferem da base ⊂ `[0x389A0, 0x389A0+514) ∪ {0x18E, 0x18F}`
  (o jogo valida o checksum do cabeçalho no boot — medido: ROM com checksum errado = tela vermelha total).
- O BPS canônico (base → cópia) reaplicado à base reproduz a cópia byte a byte; os 4 streams vizinhos pinados decodificam igual.

Execução (nível 2, core Genesis Plus GX v1.7.4 `46a5521`, `.so` SHA-256 `07c104765dcfe1f588d637c0fda1ab3987f86b94835d43b6506b0236948310b1`):
- Sem nenhum input, quadros 0…899, o decoder do próprio jogo deixa em `$FF0000` (quadros 203–204 na base) exatamente o plain
  (base: original; cópia: editado).
- Tile 1 na VRAM da cópia = tile editado; os demais tiles da fonte na VRAM = originais.

Tela (nível 3 — composição/cores), cenário "texto de introdução, sem input", capturas nos quadros 440, 444, …, 896:
- Quadros < 588: base e cópia IDÊNTICOS (o texto ainda não apareceu).
- Quadros ≥ 588: base e cópia diferem SOMENTE na linha 7 de pixels das células 8×8 que contêm a letra A do texto; em cada célula-A, os pixels
  (col 0..7) da linha 7 passam a ter a cor que a letra usa para o índice 1 (cor do pixel (linha 0, col 4) da mesma célula na base); nenhum
  outro pixel do quadro muda. No quadro 896 há 13 células-A (3+2+1+3+4) ⇒ exatamente ≤ 104 pixels mudados (menos se algum já estiver
  coberto por outro desenho; o oráculo calcula o conjunto previsto, não a contagem).

## Oráculos (independentes do renderer e do gerador do produto)

- Decoder Kosinski em Python próprio (`kos()` no script de prova), sem o crate nem o encoder do produto.
- Core libretro por `ctypes` (`scripts/rex_profiles/integration_20261007/lr.py`), não a ponte IPC do app.
- Células-A detectadas por DOIS caminhos que precisam concordar: (a) máscara de luminância da letra do tile 1 casada com a base;
  (b) código binário por tile (6 ROMs) já medido. Divergência = FAIL.
- Ordem: bytes/índices primeiro; só depois composição e cores.

## Controles negativos (devem falhar/recusar/ficar iguais)

1. original × original: duas execuções da base produzem os mesmos quadros (determinismo do core).
2. no-op: ROM da transação com pixels já vigentes = bytes da base; nenhuma cópia nova.
3. identidade errada: ROM com SHA diferente (Sonic) → `sor_profile_unsupported`, nada escrito.
4. stream adulterado: 1 byte do stream da cópia invertido → `validate_copy` recusa na reabertura e o jogo NÃO produz o plain esperado.
5. consumidor adulterado: `lea` em `$87FC` alterado → `verify_profile` recusa (SHA/identidade).
6. edição fora do recurso: tile 49, linha 8, índice 16 → recusadas, nada escrito.
7. referência fora do domínio: pixel/tile inexistente no mapa de letras não é rotulado como letra.
8. falta de espaço: ruído em todos os 49 tiles → `needs_space`, nenhum arquivo parcial na pasta de cópias.
9. patch divergente: BPS aplicado a outra base (Sonic) → recusado (CRC de origem).
10. resposta antiga da sessão: resposta de edição que chega depois de a sessão mudar é descartada (teste de frontend).

## Jornada nativa (UI do app, WebDriver)

abrir (campo de ROM) → identificar → painel "Streets of Rage · fonte" → escolher letra A → índice 1 → 8 cliques nos pixels da linha 7 →
"Aplicar à cópia" → exportar BPS → aplicar à base → "Executar Cópia" (720 quadros, sem input, IPC do app) → observar framebuffer →
"Salvar sessão" → destruir a janela/sessão → reiniciar o app → reabrir a sessão → conferir: cópia ativa, tile 1 alterado, SHA da base e da cópia,
prévia da cópia com o sublinhado. Sondas diretas ao core (ctypes) são rotuladas como sondas, não como interação do usuário.
Nenhuma alteração de RAM é usada como input.

## Critério de sucesso

Todos os itens de bytes + execução + tela acima verdadeiros no binário e ROMs pinados; todos os controles negativos conforme descrito;
jornada nativa completa com a reabertura restaurando cópia, identidade e prévia. Qualquer divergência é FAIL registrado, não ajustado.

## Limites já declarados (não serão apresentados como provados)

Paleta real das telas não lida (prévia em cinza); letras B,H,J,K,V,W,X,Y e dígitos não rotulados por observação; sem relocação;
escopo de dependentes = 4 streams vizinhos medidos + diff exato fora do slot, não o jogo inteiro; ROM é tradução PtBr; uma única ROM/slot.

## ADENDO 2026-10-07 (depois da 1ª execução do oráculo; nada acima foi apagado)

A 1ª execução reprovou 5 checks. Cada causa, classificada:

1. **Defeito do PRODUTO (pré-existente, corrigido)**: `tools/patch_studio.rs` gravava varints BPS como LEB128 simples, sem o ajuste
   `value -= 1` da especificação (byuu). O BPS exportado só era aceito pelo próprio produto (o leitor independente recusou "tamanho da origem";
   Flips/beat recusariam). Afeta todo BPS gerado antes desta correção (Sonic inclusive). Corrigido `encode_varint`/`decode_varint` com vetores
   canônicos (0→`80`, 127→`FF`, 128→`00 80`, 16511→`7F FF`, 16512→`00 00 80`) e `apply_bps` passou a conferir o CRC32 do alvo.
   BPS gerados pela versão anterior não são mais aceitos (recusa por CRC/tamanho); não há conversão.
2. **Erro do ORÁCULO (janela de RAM)**: com input neutro o decoder do jogo roda nos quadros 305–306, não 203–204 (que valiam com Start
   pressionado no quadro 120). O oráculo passou a registrar o hash de RAM de TODOS os quadros. O check "cópia == base nos mesmos quadros"
   deixou de ser vacuoso (exige ≥1 quadro encontrado).
3. **Erro do ORÁCULO (VRAM)**: estado serializado procurado em vários quadros (260…500); a fonte entra na VRAM por volta do quadro 340.
4. **Erro do ORÁCULO (detector de células-A, 2 calibrações)**: (a) o texto ROLA verticalmente (linhas em y=146+16n só no quadro 896; no 720 estão em
   y=190/206): o detector passou a varrer janelas 8×8 em todo y (grade x=72+8k); (b) pixels de contorno/sombra (luminância ≤183) em posições
   transparentes do tile quebravam o casamento: o preenchimento (238) passou a ser o único critério de "brilhante" (>220). As calibrações foram
   medidas SOMENTE em quadros da BASE; o check continua sendo igualdade exata entre o conjunto de pixels que MUDOU na cópia e o conjunto previsto
   a partir da base. Conferência cruzada humana (transcrição do texto) no quadro 896 sem falhas.
5. A previsão numérica do quadro 896 (13 células-A, 104 pixels) foi confirmada desde a 1ª execução (104 pixels alterados).

Controles adicionais incluídos: BPS aplicado a base divergente é recusado; stream adulterado (1 byte) não produz o plain esperado no decoder.
