# rex-enigma

Decoder Enigma (variante *plain* do console Mega Drive) em Rust puro: sem
dependencias, sem `unsafe`, sem I/O, sem serializacao. O adaptador do backend
(`src-tauri/src/tools/reverse/decomp/rex_enigma.rs` quando existir; hoje
`sonic_layouts.rs`) cuida de JSON/IPC, SHA-256 e erros IPC.

Maturidade: `biblioteca-implementada` → `gates-proprios-aprovados`; nada
alem disso e alegado aqui (ver `crates/registry.json`).

## O que o decoder separa

| Campo (`Stats` / `EnigmaDecoded`) | Significado |
|---|---|
| `bytes_lidos` | bytes fisicamente consumidos: `6 + ceil(bits_lidos/8)` |
| `padding_console` | alinhamento par do `EniDec_Done` do console (0 ou 1, **supondo stream em endereco par**; quem conhece o endereco absoluto soma a paridade) |
| `bytes_armazenados` | `bytes_lidos + padding_console` (vao de armazenamento no console) |
| `words` / `bytes_be()` | saida descomprimida; independente do consumo |

## Cabecalho (6 bytes)

`[0]` packet_length 1..=11; `[1]` byte de mascara PCCVH, **bitfield** (bits 4..0 =
P, C, C, V, H), valores `0x00..=0x1F`; `[2..4]` incrementing value BE;
`[4..6]` common value BE. Contrato estrito do produto (mais estreito que o
console): packet_length fora de 1..=11 ou mascara > `0x1F` → `MalformedHeader`;
EOF no meio de cabecalho/token/flags/valor/sem terminador → `Truncated`.
Token literal maximo = 15 valores (`1|11|1111` e o terminador).

## Limites e cancelamento

`Limits { max_output_bytes, work_limit }` e verificado **antes** de cada
palavra emitida e a cada token; `cancel` e consultado uma vez por token. Todo
erro entrega zero bytes de saida. Aritmetica de valores mod 2^16 como o 68k.

## Proveniencia e politica de incorporacao

- Origem do codigo: frente B (`codex/parallel-recovery-20261004-b`, commit
  `da5472c4`), integrado por `cherry-pick -x`; `src/lib.rs` desta arvore difere
  do original **somente por `cargo fmt`** (verificado em
  `docs/rex_profiles/integration_20261006/REVISAO-ENIGMA-B.md`).
- Especificacao: comportamento do desempacotador 68k do console, lido de
  `_inc/Decompression/Enigma Decompression.asm` do s1disasm pinado
  (`064e3c68…`, SHA-256 do arquivo `76fed2de…`). **Nao** deriva do mdcomp
  (LGPL-3.0, `enigma.cc`) nem do `enigma_research.py`; ambos sao *oraculos
  externos* de comparacao (SHA-256 pinados), jamais copiados ou portados.
- Risco residual registrado, nao eliminado: o s1disasm e uma desmontagem de
  codigo comercial sem licenca explicita; o formato Enigma e descrito
  funcionalmente e a implementacao nao copia texto dele, mas a decisao juridica
  final e do operador.

## Testes

Todos usam fixtures **autorais**: vetores montados a mao (em `src/lib.rs`) e um
codificador de teste independente (`tests/contract.rs`). Nenhum teste ordinario
usa ROM comercial. A paridade com a ROM real e um gate BYOR separado
(`scripts/rex_profiles/integration_20261006/`), nunca contado como PASS quando
a ROM falta.

```sh
cargo fmt --manifest-path crates/rex-enigma/Cargo.toml -- --check
cargo clippy --manifest-path crates/rex-enigma/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path crates/rex-enigma/Cargo.toml --locked
```
