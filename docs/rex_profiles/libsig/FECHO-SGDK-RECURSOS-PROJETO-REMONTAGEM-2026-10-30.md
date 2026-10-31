# FECHO — Recursos SGDK por forma, projeto recuperado e remontagem exata — 2026-10-30

**Status:** Experimental. Recursos: L2 (consistência estrutural). Remontagem: igualdade byte a byte da ROM (SHA-256) a partir do projeto. Nenhum item tem consumo observado em execução. Não é decompilação de lógica.

## 1. Entregue (motor, sem nome de jogo)
| Módulo | Função |
|---|---|
| `decomp/rex_sgdk_resources.rs` | Grafo de recursos por forma: `Image {Palette*, TileSet*, TileMap*}` só se as três arestas validam (cor 9-bit, decode exato com o codec declarado, índice de tile < numTile); `SpriteDefinition` por **layouts declarados** (`Sgdk1x`, `Sgdk2x`) com cadeia paleta→animações→quadros→TileSet→peças VDP (`Σ numTile` das peças = numTile do TileSet; `numTile = w×h` do código VDP); música **XGC** (tabela de amostras + encadeamento EXATO dos bytes de tamanho de quadro até `MLEN`). Composição de quadros e PNG indexado (rescomp-compatível). |
| `asset_extractor::encode_indexed_png` | PNG tipo 3 com PLTE (reusa chunk/CRC/deflate existentes; sem crate nova). |
| `decomp/rex_sgdk_project.rs` | ROM → `res/{img,spr,music}` + `res/recovered.res` (sintaxe SGDK 2.11) + `rex/manifest.json` (identidade, itens, faixas de bytes atribuídas, funções de biblioteca, limites) + `rex/graph.json`. |
| `decomp/rex_sgdk_rebuild.rs` | Plano de remontagem: tiles não comprimidos de Image/Sprite e paletas regenerados dos PNG; XGC do arquivo; resto em segmentos preservados. `rebuild()` remonta a ROM. |

Achados de formato registrados: SGDK 2.x usa o bit 7 de `AnimationFrame.numSprite` como flag; 1.x guarda peças como `{u8 numTile; s8 y; u8 size; s8 x}` com 4 variantes de flip (provado: variantes H/V espelham só x/y; Σ tiles = TileSet).

## 2. Medição contra ground truth (9 projetos SGDKForge, ROM + `symbol.txt` + `.res` + PNG originais)
- **Image:** precisão 100%, revocação 100% (todo IMAGE declarado e ligado foi recuperado; todo recuperado é símbolo nomeado).
- **Sprite:** precisão 100% (todos nomeados). Revocação vs ligados: Mugenesis 106/106, KIRBY 12/12, OpenBOR 5/5, Celestial 6/6 e 12/12, HAMOOPIG 131/133, TAIKETSU 73/91.
- **Pixels vs arte original:** 1.418 de 1.507 quadros idênticos pixel a pixel; HAMOOPIG/Mugenesis/TAIKETSU/Celestial/SMOKE 100%; KIRBY 99,28%, OpenBOR 98,26%, REINA 89,85% (causa não investigada — registrada, não ajustada).
- Erratas preservadas: sem varredura completa, sprites ligados mas não referenciados por código ficavam de fora; sem máscara do bit 7, KIRBY caía para 3/12.

## 3. Corpus BYOR (40 ROMs MD; somente leitura; nada versionado)
Recuperado em 13 ROMs da família SGDK; 0 em todos os não-SGDK (controle negativo). Música validada de forma independente: nº de XGC = nº de tags "Optimized with XGMTool" em Irmãos Aratu (12), Shaolin Carcará (12), Cursed Knight (13), Darius Extra (20), Foxy Land (9), Griel (27), Insane Pain (24), Old Towers (4), Zooming Secretary (7). **Gap:** Tanzer (14 tags, 0 XGC → provável XGM2).

## 4. Alvo de remontagem completa: Irmãos Aratu (Brazil) (Rev 1), SHA-256 `e262a115…b85732`
- Recuperado: 74 Images, 21 Sprites (275 quadros, ex.: os dois protagonistas com 11 animações), 12 músicas XGC, 54 funções de biblioteca (núcleo asm SGDK/libgcc).
- **77,4% dos bytes da ROM atribuídos** a itens validados (1.926.508 / 2.490.368).
- **Remontagem idêntica:** `rebuild(projeto)` == ROM original (mesmo SHA-256). Regenerados das fontes editáveis: 433.440 B de tiles de Image, 12.736 B de tiles de Sprite, 8.384 B de paletas, 747.906 B de música; o resto vem de segmentos preservados.
- **Prova de edição:** trocar 1 pixel de uma Image no PNG e remontar altera exatamente 1 byte, no offset previsto (`$1B4296`).
- Preservados com motivo (não adivinhados): 17 sprites com peças VDP sobrepostas; 13 itens com índices usados de mesma cor; streams comprimidos (até o reencode provar igualdade).
- Saída fora do repo: `~/.retrodev/decomp_work/rex_projects/irmaos_aratu_rev1/` (~21 MB, PNG sem compressão deflate).

## 5. O que NÃO está feito (22,6% da ROM)
~110 KB de código de jogo (lógica/decisões) sem conversão; ~255 KB de dados de fase/tabelas (textos de UI e créditos, tabelas de curva, mapas); ~120 KB de banco nomeado provavelmente PCM de efeitos; tabelas de peças de sprite ainda não atribuídas na cobertura.

## 6. Métrica de generalidade (§6 doc 14)
(a) 3 arquivos Rust novos + 1 função em `asset_extractor`; 0 citações de jogo; (b) formatos como layouts declarados (2) — próximo passo é movê-los para dado versionado; (c) L2 por recurso, igualdade de bytes na remontagem; (d) controles negativos: 27 ROMs não-SGDK com 0 recursos; recusas explícitas listadas no plano; (e) reuso sem mudança: `rex_resources` (scan/verify LZ4W/aPLib), `rex_codecs`, `rex_aplib`, `md_color_word_to_rgb`, `fingerprint::sha256_hex`.
