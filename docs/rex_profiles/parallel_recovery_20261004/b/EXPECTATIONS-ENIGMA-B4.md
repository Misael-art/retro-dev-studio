# EXPECTATIONS-ENIGMA-B4 — contrato de decoder + expectativas congeladas (rodada B4)

Data: 2026-10-05. Frente b, `codex/parallel-recovery-20261004-b`, base recebida `08024d9`.
Este documento é congelado **antes** de qualquer linha de Rust do produto e **antes**
de qualquer medição do produto. Desvio posterior = FAIL/INCONCLUSIVE com série bruta
registrada; expectativa não se reescreve depois de medir (regra da rodada, freeze
`74fb2e2`).

## 0. Proveniência e política (conferido antes de criar código — requisito 1)

- **Nenhum decoder Enigma existe no produto**: `src-tauri/src` e `crates/`
  (rex-addressing, rex-gameplay, rex-kosinski, rex-mugen) não contêm Enigma.
  `docs/rex_profiles/ROUND_STATE.md`: linha Enigma = `blocked` em todas as colunas.
- **Decoder externo excluído por política**: mdcomp (Flamewing, `src/lib/enigma.cc`,
  commit `72c6df405a75d322c5b3722da46c3abb864d3793`, LGPL-3.0-or-later). A
  incorporação foi excluída nesta rodada; nada é portado dele.
- **Reconstrução de pesquisa** `enigma_research.py` (SHA `a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2`)
  declara-se RESEARCH ONLY, derivada juridicamente do LGPL: **não entra no produto
  e não é portada**. É usada aqui apenas como referência externa pinada para
  gerar números congelados (sonda §3) e como dados de fixture do corpus-B.
- **Fonte do produto = clean-room a partir do desempacotador real do console**:
  `_inc/Decompression/Enigma Decompression.asm` do s1disasm pinado
  (`064e3c68eb19cc85b8801b087f9d95f9b3e82cea`), SHA-256 do arquivo
  `76fed2de986b3e79e1f2bd517b06cc9eb64cff0a1679b77268c9a31bfee4136e`.
  Nenhum byte de código mdcomp ou do Python de pesquisa é copiado; a
  implementação Rust deriva da semântica das instruções 68k abaixo.

### Formato, conforme o asm do console (especificação usada)

Cabeçalho (6 bytes): `[0]` packet_length — nº de bits do valor inline (domínio do
produto **1..11**; o console estende com sinal, ver §4 retificações); `[1]` byte de
máscara PCCVH — **bitfield** bits 4..0 = P,C,C,V,H (não é enum de modo; todos os
valores 0x00..0x1F definidos, bits 5..7 ignorados pelo console — o produto recusa
byte > 0x1F, §hardening); `[2:4]` incrementing value BE u16; `[4:6]` common value
BE u16. Nos dois primeiros campos o console soma o art tile base (d0) no carregamento.

Tokens MSB-first (janela de 16 bits, recarga byte a byte):
- `0|s|cccc` (6 bits): s=0 → corrida do incrementing (a2; +1 por palavra, persiste);
  s=1 → corrida do common (a4). cccc+1 palavras.
- `1|mm|cccc` (7 bits): mm=00/01/10 → valor inline lido **uma vez** (bits de flags
  primeiro), repetido cccc+1 com delta 0/+1/−1 mod 2^16; mm=11 → se cccc=0x0F,
  **terminador**; senão cccc+1 valores inline **cada um com flags novas**.
- Inline: para cada bit j da máscara (P→bit15, C→14/13, V→12, H→11), se o bit do
  byte-máscara estiver setado, **lê 1 bit do stream**; se 1, OR do bit de flags.
  Depois lê packet_length bits, máscara `EniDec_Masks`, soma o base (addi/ori do asm).
- Contagem de bytes no console: ponteiro avança byte a byte conforme recargas e o
  prefetch de palavra do FetchInlineValue; no terminador, `EniDec_Done` recua 1
  (2 se d6==16) e **alinha a0 a endereço par** — daí o padding de armazenamento.

Parâmetro `value_offset` (= d0/art tile da chamada): nos recursos reais o sítio
pinado chama com `move.w #$0,D0` imediatamente antes do `jsr $171E`
(evidência B2/`export-avaliacao-d.json`) → paridade sempre com offset 0.

## 1. Contrato do decoder (Rust puro — requisito 2)

Colocação: `scripts/rex_profiles/parallel_recovery_20261004/b/enigma-rs/`
(crate próprio da frente, precedente `scripts/rex_corpus_a`; **não** toca `crates/`,
registry, IPC, UI nem manifests comuns — esses são do integrador). Pacote
`rex-enigma` (lib + bin `rex-enigma`), edition 2021, `license = "UNLICENSED"`,
`publish = false`. Único-dependência permitida: `rex-kosinski` por path, apenas
para `edit::sha256_hex` no CLI (precedente rex-corpus: "mesma convenção, não se
escreve uma segunda implementação"). Biblioteca sem Tauri, sem `unsafe`, sem I/O
(no crate lib).

```rust
pub struct Limits { pub max_output_bytes: usize, pub work_limit: u64 } // tokens
pub struct DecodeOptions {
    pub value_offset: u16,                       // semântica do console: soma no
                                                 // carregamento (incr/common) e no
                                                 // fetch inline; default 0
    pub limits: Limits,                          // default 8 MiB / 4_000_000 tokens
    pub cancel: Option<&dyn Fn() -> bool>,       // cooperativo, por token
}
pub struct Stats {
    pub bits_lidos: u64,        // bits após o cabeçalho consumidos pelo parsing
    pub bytes_lidos: usize,     // 6 + ceil(bits_lidos/8)  — fisicamente lidos
    pub padding_console: usize, // bytes de alinhamento par do EniDec_Done
    pub bytes_armazenados: usize, // bytes_lidos + padding_console (par)
    pub tokens: u64, pub valores_inline: u64, pub terminador: bool,
}
pub struct EnigmaDecoded { pub words: Vec<u16>, pub stats: Stats }
impl EnigmaDecoded { pub fn bytes_be(&self) -> Vec<u8>; } // serialização p/ SHA

pub enum EnigmaError {          // códigos CONTRACTS.md §4 + extensão declarada
    Truncated,        // <6B de header; EOF em token/flags/valor; sem terminador
    MalformedHeader,  // packet_length ∉ 1..11; máscara > 0x1F
    ExcessiveOutput,  // próxima palavra excederia max_output_bytes
    WorkLimit,        // tokens > work_limit
    Cancelled,        // cancel() verdadeiro em fronteira de token
}
pub fn decode(stream: &[u8], opts: &DecodeOptions) -> Result<EnigmaDecoded, EnigmaError>;
```

Invariantes do contrato:
1. Erro ⇒ **nenhuma** saída é emitida ao chamador (Result Err; nada parcial).
2. `bytes_lidos` obrigatório e exato (CONTRACTS.md §4); nada além de
   `bytes_lidos` é contado como consumo.
3. Limites **durante** a decodificação: cada escrita verifica
   `max_output_bytes` antes de alocar/escrever; `work_limit` por token; leitura
   sempre indexada dentro de `stream` (Truncated). Aritmética é mod 2^16 com
   `wrapping` explícito — sem panic, sem overflow (semântica do console; por isso
   não existe código de erro `overflow` neste decoder: wrap é comportamento
   definido, não condição de erro).
4. Nenhum panic para nenhuma entrada: todo índice explícito, todo laço limitado.
5. Cancelamento só em fronteira de token (determinístico).

Camadas (requisito 9 — preservadas, não fundidas): este crate entrega **só**
`decoder Enigma → palavras`. Perfil Sonic (grade 64×64 de IDs) e projeção
WRAM base `0xFF1020` stride 128 permanecem provados nos scripts Python da frente
(B2) e **não** são reimplementados nem afirmados pelo crate; o JSON do CLI traz
`"camada": "decoder-bytes"`.

## 2. Contabilidade de bytes (requisito 6)

Três grandezas distintas, sempre reportadas separadamente:
- **bytes_lidos** (físicos): `6 + ceil(bits_lidos/8)` — o mínimo que cobre todos os
  bits efetivamente consumidos, encerrando no terminador.
- **padding_console**: alinhamento par do `EniDec_Done` (0 ou 1 para sítio inicial
  par, = `bytes_lidos % 2`).
- **bytes_armazenados** = lidos + padding = o vão que o recurso ocupa no
  armazenamento sequencial do ROM (slots contíguos, B2).
- Bytes **além** de bytes_armazenados (resto de ficheiro/slot) não são consumo.

## 3. Expectativas congeladas (números da sonda de referência externa)

Fonte dos números: `scripts/.../b/sonda-oraculo-enigma-b4.py` executada em
2026-10-05 contra o decoder pinado `a9ed92f9…` + ROM `c7da53a1…` + fixtures
corpus-B; evidência integral em
`data/rex_profiles/parallel_recovery_20261004/b/evidencia/enigma-oraculo-b4.json`
(commitada junto deste documento). A sonda **mede a referência externa**, não o
produto.

### E23 — paridade nos seis recursos reais (ROM, value_offset 0)

| # | offset | bytes_lidos | padding | bytes_armazenados (slot B2) | output_size | output_sha256 |
|---|--------|-------------|---------|------------------------------|-------------|----------------|
|0|0x65432|634|0|634|4096|`322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0`|
|1|0x656ac|1042|0|1042|4096|`4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d`|
|2|0x65abe|860|0|860|4096|`3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954`|
|3|0x65e1a|1242|0|1242|4096|`04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7`|
|4|0x662f4|1233|**1**|**1234** (= 0x667c6−0x662f4)|4096|`5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8`|
|5|0x667c6|784|0|— (último da tabela)|4096|`78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94`|

O decoder Rust (produto) deve, para cada linha: `bytes_be().sha256 == output_sha256`,
`bytes_lidos` exato da tabela, `padding_console` e `bytes_armazenados` da tabela,
`stats.terminador == true`, decode duplo byte-idêntico. A linha 4 é o caso
discriminante lidos≠armazenados (impar → padding 1 = slot B2 1234).

### E24 — paridade nos dez pares plain do corpus-B (referência externa pinada)

SHA-256 regravados nesta rodada (ver sonda). Para cada par:
`decode(.eni)` → `bytes_be == .bin` exatamente; `bytes_lidos` = span da tabela;
resto do ficheiro (eni − lidos) NÃO é consumo.

| par | eni_sha256 (16 iniciais) | eni bytes | bytes_lidos esperado | saida_size | bin_sha256 (16) |
|---|---|---|---|---|---|
|alternating_runs|`5fa3a1a3907a599f`|84|84|1200|`5c09e3d725db5fe8`|
|big_deltas|`e80e1fd4bf4f4176`|92|91|96|`1423a6c33549d2d4`|
|const_500|`881c31796ed37c0c`|18|18|400|`4e1371f5996ecb79`|
|empty|`d62c86ef95843a95`|8|7|0|`e3b0c44298fc1c14`|
|noise_1k|`92206a23c1a21ae1`|1058|1058|1024|`4d844a923dbdf00c`|
|planes_4k|`fd4271f94bb9185b`|4222|4222|4096|`f2dce5732f5ce79f`|
|ramp_signed|`84018e0bb7c3c167`|18|17|400|`59af57fd68c81550`|
|single_word|`0b73d0c8920cdcf8`|8|8|2|`3a103a4e5729ad68`|
|threshold_edge|`b0fa37e1a6136e29`|10|10|64|`58e8f2a1f78f0a59`|
|zeros_64|`e9f16194f331d4b1`|12|11|128|`38723a2e5e8a17aa`|

SHAs integrais em `enigma-oraculo-b4.json`. O par `empty` distingue
**saída zero válida** (stream mínima com terminador) de **stream ausente** (E25-e05).

### E25 — negativos do corpus (códigos do PRODUTO; sem herdar tolerâncias)

| caso | expected do produto | nota |
|---|---|---|
| e01 `e01_odd_bytes_tail.bin` (5 B) | `Truncated` | < 6 B de header; recusa total, nunca descarte silencioso |
| e02 `e02_truncated_last_byte.eni` | `Truncated` | EOF a meio de token; o oráculo mdcomp aceitou 4098 B — o produto não |
| e03 `e03_len_inflated.eni` | **aceite**, byte-idêntico a planes_4k pleno, `bytes_lidos=4222` | ver §4: [4:6] é o common value, não declaração de comprimento |
| e04 `e04_mode_02.eni` | **aceite**, saída idêntica a const_500 pleno | ver §4 retificação |
| e05 `e05_empty_stream.eni` (0 B) | `Truncated` | |
| e06 `e06_garbage_ff_255b.eni` | `MalformedHeader` | packet_length 0xFF ∉ 1..11 (recusado no byte [0], sem ler o resto) |
| e07 `e07_planes_4k.eni` com `max_output_bytes=1024` | `ExcessiveOutput` | aborta antes de emitir a 513ª palavra; zero saída ao chamador |

### E26 — hardening discriminante contra o oráculo (entradas reservadas)

Craft a partir do header de planes_4k.eni: `packet_length ∈ {0, 12, 128, 255}` ⇒
`MalformedHeader` (o console produziria lixo limitado; o produto recusa —
endurecimento documentado, única divergência comportamental permitida e marcada).
Máscara `0x20`/`0xFF` ⇒ `MalformedHeader` (console ignora os bits 5..7; o produto
recusa). `work_limit=8` em planes_4k ⇒ `WorkLimit`. `cancel` sempre-verdadeiro ⇒
`Cancelled` no 1º token. Header com 5 bytes de qualquer stream real ⇒ `Truncated`.

### E27 — invariante de contabilidade

Para toda entrada aceite: `bytes_armazenados == bytes_lidos + padding_console`,
`padding_console == bytes_lidos % 2` (início par), `bytes_armazenados % 2 == 0`.
Em ROM, `bytes_armazenados` ≤ slot (diff de offsets da tabela B2).

### E28 — não-panic exaustivo (negativos próprios, determinísticos)

Cortes de `planes_4k.eni` a cada 16 bytes (k = 1..4221 passo 16, 264 cortes) + as
mesmas 6 streams SS cortadas ao meio + zero-fill 256 B + 0xFF-fill 256 B + 128
entradas pseudoaleatórias LCG (semente 20261005, comprimentos ≤ 512): todas devem
terminar em `Ok` ou `Err` dos códigos do contrato — **jamais panic, jamais laço
sem limite** (work_limit 4_000_000, max_out 8 MiB nos testes).

### E29 — superfície e camadas

Crate não exporta grid 64×64 nem projeção WRAM; CLI reporta `"camada":
"decoder-bytes"`; nenhum ficheiro fora de
`scripts/rex_profiles/parallel_recovery_20261004/b/` e
`data/rex_profiles/parallel_recovery_20261004/b/` e
`docs/rex_profiles/parallel_recovery_20261004/b/` muda; `crates/` intocado
(git status vazio lá).

### E30 — gates

`cargo test` no crate verde; CLI reproduz cada linha E23 com `--json` (sha +
consumo idênticos); scripts de gates da frente reexecutados
(`test-contrato-b.py`, `verificar-cadeia.py`, `exportar-camadas-b2.py`) sem
alteração de comportamento; `npm run check:tree`.

## 4. Retificação versionada (datada 2026-10-05) — e04/e03 do negative-spec

O `negative-spec.json` do corpus-B rotulou como "defeito do oráculo" a aceitação do
e04 com saída idêntica (rc=0, mesmo SHA). Contra a fonte do formato (asm pinado
`76fed2de…`), **byte[1] não é enum de modo**: é bitfield PCCVH em que todos os
valores 0..0x1F são definidos; bits só são lidos do stream por tokens inline, e a
sonda mediu que `const_500.eni` **não contém tokens inline/delta** (apenas
common/incr runs + terminador). Logo, máscara 0x09 → 0x02 **não muda nada** e a
saída idêntica é comportamento correto do console, não tolerância insegura. O
produto (E25) aceita e04; exigir rejeição seria inventar requisito fora do
formato. Mantém-se a rejeição apenas para byte[1] > 0x1F (bits indefinidos).
Analogamente, e03: bytes [4:6] são o common value — não existe "declaração de
comprimento" no formato plain; a sonda re-asserte saída byte-idêntica ao pleno.
O JSON histórico do corpus-B (fora desta worktree) não é editado; esta retificação
vive aqui, versionada, e o resultado antigo permanece preservado na evidência.

## 5. Disciplina de medição

- Implementar Rust **somente após** este commit; nenhum número deste documento é
  recalculável depois de medir o produto.
- Desvio por linha = FAIL com série bruta (bytes do produto vs congelados),
  jamais reescrita da expectativa; promoção de nível (referência estática →
  vínculo estrutural → equivalência) só com a evidência daquela linha.
- "Paridade demonstrada" aqui = decode(produto, stream real) == saída pinada da
  referência externa + consumo exato; NÃO afirma consumo observado em runtime
  (teto inalterado pela B3).
