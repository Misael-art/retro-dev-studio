# REVISÃO — decoder Enigma nativo de B (`enigma-rs`) — integrador, 2026-10-06

## 1. Proveniência e política de incorporação (o rótulo "clean-room" não basta)

- Origem: `codex/parallel-recovery-20261004-b` `3268ac7`→`da5472c` (E23–E28), commits integrados por `cherry-pick -x`.
- O texto da frente declara: decoder **mdcomp (LGPL-3.0, `enigma.cc`) excluído**; `enigma_research.py`
  (SHA `a9ed92f9…`) derivado do LGPL → **research only**; produto = especificação lida do desempacotador
  68k do s1disasm pinado (`064e3c68…`, arquivo `76fed2de…`).
- Verificação feita pelo integrador (não herdada): (a) `lib.rs` do pacote é **o mesmo arquivo** que B entregou,
  salvo `rustfmt` (`rustfmt` aplicado ao original reproduz byte a byte o pacote: `diff` vazio; SHA original
  `172ac9e3…`, pacote `ee7e0b11…`); (b) a lógica está em estrutura própria (leitor de bits, `fetch_inline`, comentários em
  português, identificadores próprios) e **não** reproduz a organização por templates do mdcomp; (c) o código
  Python de pesquisa e o mdcomp **não** foram copiados para `crates/`; (d) a medição contra ambos os oráculos
  externos é execução, não incorporação; (e) o commit que cria o decoder (`3268ac7` congela; `da5472c` implementa)
  tem ordem congelamento→código registrada.
- **Limite honesto:** não consegui provar ausência de derivação textual do mdcomp por ferramenta (não há o fonte
  do mdcomp na máquina); a evidência é estrutural + declaratória + ordem dos commits. O s1disasm é uma
  desmontagem de código comercial **sem licença explícita**; o formato é descrito funcionalmente. **Risco jurídico
  residual registrado; decisão final é do operador.** Nenhum decoder externo excluído foi copiado para "completar".

## 2. Revisão técnica do decoder

| Tema | Achado |
|---|---|
| Limite de saída | verificado **antes** de cada palavra (`emit`); exato em 4096/4094/0 (teste); erro entrega zero bytes |
| Limite de trabalho | `tokens > work_limit` → `WorkLimit`; exato em `tokens`/`tokens-1` (teste) |
| Cancelamento | `cancel()` por token (6ª consulta cancela no teste); runs internos ≤16 valores ⇒ latência limitada |
| Overflow | `value_offset`, incrementing, deltas ±1: `wrapping_*` mod 2^16 como o 68k; `(len+1)*2` e `cnt4+1` sem estouro de tipo |
| Erros | `truncated` (<6 bytes; EOF em token/flag/valor/sem terminador — todo prefixo próprio do consumo é `truncated`), `malformed-header`, `excessive-output`, `work-limit`, `cancelled`; sem `panic` (2000 streams ruidosos, 1 bit-flip em todos os bits de um stream) |
| Terminação | só `1|11|1111`; **literal máximo = 15 valores** (16 seria o terminador — achado do próprio codificador de teste, que errou até eu corrigir) |
| PCCVH | bitfield bits 4..0 = P,C,C,V,H → bits de palavra 15,14,13,12,11; ordem de leitura P primeiro; máscara `0x00..=0x1F` aceita, `>0x1F` recusada; `packet_length` 1..=11 |
| Divergência do console | o console ignora bits 5..7 da máscara e aceita `packet_length` fora de 1..=11; **o produto é mais estrito** (recusa) — extensão declarada `malformed-header` |
| Contabilidade | `bytes_lidos = 6 + ceil(bits/8)`; `padding_console`; `bytes_armazenados = lidos + padding`; `bytes_be()` = saída descomprimida — quatro grandezas distintas |
| Paridade do endereço | `padding_console` na biblioteca **supõe stream em endereço par**; o adaptador recalcula com a paridade real (`(offset+lidos)%2`, testado com offsets `0x100` e `0x101`) |

Controles de mutação (6 mutantes no `lib.rs`, todos mortos pelos testes; arquivo restaurado e conferido por SHA):
limite de saída `>`→`>=`; padding→0; delta −1→0; teto da máscara; teto de trabalho +1; arredondamento de `bytes_lidos`.

## 3. Pacote

`crates/rex-enigma` (local aprovado pelo projeto, `crates/README.md` / `docs/08_TREE_ARCHITECTURE.md`), registrado
em `crates/registry.json`, gates do pacote em `npm run crates:gates`. **Zero dependências**: a dependência de B em
`rex-kosinski` (só para SHA no CLI) **não** veio — CLI não foi empacotado; o SHA é do adaptador (`rom_library`).
Executado fora da worktree de B e fora da árvore (cópia isolada em diretório temporário): 8+12 testes verdes, `cargo tree`
sem filhos. Serialização/erros IPC: `sonic_layouts.rs` + `inspection.rs` (adaptador), não a biblioteca.

## 4. Aceite real (BYOR) — separado dos testes ordinários

`scripts/rex_profiles/integration_20261006/byor-enigma-acceptance.py`: ROM ausente ⇒ `AUSENTE`, exit 3 (nunca PASS; testado);
ROM não-pinada ⇒ `INCOMPATIVEL`. Com a ROM pinada `c7da53a1…`: 6/6 streams, **bytes completos** iguais ao oráculo externo pinado,
consumo igual (634/1042/860/1242/1233/784 lidos; padding 0,0,0,0,1,0; armazenado 634/1042/860/1242/1234/784), saída 4096 B cada,
SHA-256 da saída calculado nesta execução. Relatório só com hashes: `data/rex_profiles/integration_20261006/evidencia/byor-enigma-run1.json`.
Teste Rust equivalente `#[ignore]` (`byor_seis_layouts_reais_na_rom_pinada`) com `REX_SONIC_ROM`; ausente = não executado, nunca verde.
