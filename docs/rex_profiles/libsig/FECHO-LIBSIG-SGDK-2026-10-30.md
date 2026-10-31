# FECHO — Dicionário de assinaturas de biblioteca M68K (`rex-libsig/v1`) — 2026-10-30

**Status:** Experimental. Evidência L1 (forma estática) por função. Não é decompilação, não prova consumo, não promove suporte.
**Plano:** `docs/12_DECOMPILACAO_PAREADA_PLANO.md` item 0.4 (fingerprint normalizado tolerante a relocação), direção `docs/14` (motor × dado).

## 1. O que foi entregue
- Motor `src-tauri/src/tools/reverse/decomp/rex_libsig.rs` (sem nome de jogo):
  - `insn_len`: decodificador de tamanho 68000 que marca bytes dependentes de link (abs.W/L, d16(PC), d8(PC,Xn), imediato .L com cara de endereço, desvios para fora da função).
  - `normalize` / `is_code_like`: corpo normalizado; portão que recusa dados no `.text` (paletas, amostras zeradas decodificam como `ori.b #0,d0`).
  - `learn`: um nome vira **biblioteca** se o corpo normalizado coincide em ≥2 **projetos independentes**. Nenhuma lista de nomes embutida; código de jogo difere por projeto e cai fora sozinho.
  - `scan`: índice por âncora de 8 bytes + hash completo; `score_holdout`.
  - Runner BYOR `#[ignore]` `libsig_learn_holdout_and_scan` (env `RDS_LIBSIG_TRUTH`, `RDS_LIBSIG_OUT`, `RDS_LIBSIG_CORPUS`).
- Dado: `data/rex_profiles/libsig/sgdk-2.11.gcc13-lto.libsig.json` — 331 assinaturas, 28 nomes instáveis (corpos divergentes por LTO/inlining). Guarda só âncora normalizada (8 bytes) + hash truncado; nenhum corpo de código de terceiros.

## 2. Achado que muda o plano
`libmd.a` release do SGDK 2.11 é **bytecode LTO** (`.gnu.lto_*`, `.text` vazio): não serve de fonte de assinaturas. O dicionário é aprendido de **ROMs construídas + `symbol.txt`** (ground truth próprio do SGDKForge).

## 3. Ground truth e holdout (expectativa congelada antes: P ≥ 0,9 e R ≥ 0,9 por projeto)
9 projetos independentes / 11 builds (Celestial ×2 e TAIKETSU ×2 contam como um projeto cada; holdout exclui o rótulo inteiro — sem vazamento entre builds irmãos).

| Projeto (holdout) | esperado | corretos | errados | P | R |
|---|---|---|---|---|---|
| Celestial (a/b) | 256 / 282 | 251 / 270 | 17 / 20 | 0,937 / 0,931 | 0,977 / 0,954 |
| FORGE_REFERENCE | 249 | 241 | 21 | 0,920 | 0,964 |
| HAMOOPIG | 256 | 254 | 19 | 0,930 | 0,988 |
| KIRBY_FAN | 281 | 273 | 31 | 0,898 | 0,968 |
| Mugenesis_Demo | 267 | 263 | 18 | 0,936 | 0,981 |
| OpenBOR_Demo | 294 | 287 | 29 | 0,908 | 0,973 |
| REINA_CHAN_PORT | 295 | 289 | 27 | 0,915 | 0,976 |
| SMOKE_TEST | 273 | 266 | 19 | 0,933 | 0,971 |
| TAIKETSU (a/b) | 243 / 294 | 241 / 283 | 16 / 27 | 0,938 / 0,913 | 0,988 / 0,959 |

KIRBY_FAN ficou em P=0,898 (abaixo do congelado 0,9) — registrado, não ajustado. "Errados" incluem aliases de corpo idêntico e funções curtas; não foram reclassificados.
**Errata da 1ª medição (preservada):** sem `is_code_like`, P caiu a 0,016 (HAMOOPIG, 18.357 falsos) porque símbolos de dado no `.text` casavam em qualquer região zerada.

## 4. Corpus BYOR (40 ROMs MD de `~/emulation/roms/megadrive`, somente leitura; extração em scratch removida)
- **Família SGDK (12 ROMs)**: o núcleo asm do SGDK (`_INT`, `_EXTINT`, `memcpy_`, `memset_`, `memsetU16`, `KDebug_Alert`, `SYS_*`) casa — estável entre versões do SDK.
- **libgcc** (`__udivsi3`, `lmulu`, `ldivu`…) casa em 16 ROMs: prova gcc, **não** SGDK.
- Corpos C do SGDK **não** atravessam versões: as ROMs do corpus não são 2.11/gcc13 — precisa de dicionário por versão (medido, não suposto).
- Controle negativo: comerciais não-gcc (Mega Turrican, Ultracore, Sonic 3D DC, Jim Power, Mr. Nutz…) = 0 casamentos.
- Falsos positivos conhecidos: casamentos curtos isolados (ex.: 1 hit em Beggar Prince/Time Trax; `XGM2_unloadDriver`/`MDRuntimeProbe_*` em ROMs não-SGDK).

## 5. Métrica de generalidade (§6 do doc 14)
(a) 1 arquivo Rust novo, 0 citações de jogo; (b) 1 arquivo de dado (331 entradas); (c) L1 por função; (d) controle negativo sintético + 0 hits em não-gcc; recusa de dados no `.text`; (e) reuso de `fingerprint::sha256_hex`.

## 6. Próximo degrau
Recuperação de recursos SGDK por forma de estrutura (TileSet/Palette/TileMap/Image/SpriteDefinition) com descompressão validada (nenhum/aPLib/LZ4W já no motor), independente da versão do compilador; depois dicionários por versão SGDK a partir de builds próprios.
