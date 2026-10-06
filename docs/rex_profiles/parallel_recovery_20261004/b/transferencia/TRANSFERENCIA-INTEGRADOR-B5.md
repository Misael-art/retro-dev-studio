# Transferência ao integrador — correção de `value_offset` em `rex-enigma` (B5)

Alvo: `crates/rex-enigma` em `origin/codex/rex-integrator-sonic-103104@43bb42f6` (a lógica de `fetch_inline` é a de
`841f69ad`; esse arquivo não mudou entre os dois). **Nada foi editado no pacote compartilhado**: o patch é entrega
da frente B.

## O que mudou
- `src/lib.rs::fetch_inline`: `d3 = value_offset; P → OR 8000; C1 → ADD 4000; C0 → ADD 2000; V → OR 1000; H → OR 0800;
  valor = raw + d3` (mod 2^16), na ordem de leitura P,C1,C0,V,H — exatamente `EniDec_FetchInlineValue` do s1disasm pinado.
  Antes: `raw + offset + flags` (soma de tudo), que dava `0005` com offset 8000 e flag P (esperado `8005`).
- `tests/value_offset_asm.rs` (10 testes): expectativas congeladas em `EXPECTATIONS-ENIGMA-B5.md` **antes** da correção
  (commit `77222ae9`, 4 testes vermelhos reproduzindo o defeito), offsets 0000/8000/C001/7FFF/FFFF e vizinhos,
  caminhos incremental, comum e inline (modos 0/+1/−1/multi) separados, colisões offset×flags, limite exato de saída.
- Domínio: `value_offset` = qualquer `u16` (provado); `packet_length` 1..=11 e máscara ≤ 0x1F inalterados,
  fora disso `MalformedHeader`. Nenhuma restrição nova de API foi necessária.

## Como aplicar
`git apply docs/rex_profiles/parallel_recovery_20261004/b/transferencia/rex-enigma-value-offset-b5.patch` na raiz do
integrador (verificado com `git apply --check` sobre `43bb42f6`; o patch já vem formatado com `rustfmt`). Com ele:
`cargo test` (8 + 12 + 10 verdes), `cargo clippy --all-targets -- -D warnings` limpo.

## Evidência
- Mutantes (11): `common sem base`, `incr sem base`, `limite >=`, `limite sem +1`, P/V/H como soma, C1/C0 como OR,
  ordem das flags invertida, `inline sem base` — **todos mortos** (`mutantes-enigma-b5.py`; os dois que sobreviveram na
  revisão, offset na palavra comum e limite exato, estão entre eles).
- Paridade e negativos reexecutados no crate da frente B: `medir-produto-enigma-b4.py` → e23 6/6, e24 10/10, e25 7/7,
  e26 9/9; evidência `enigma-produto-b4.json` sem alteração (offset 0).
- Exposição real: `sonic_layouts.rs` usa `value_offset: 0`; o defeito só era alcançável por API com offset ≠ 0.

## O que NÃO se afirma
Os valores esperados são derivação manual de **uma** fonte (o asm pinado), a mesma que o decoder implementa: não são
duas linhas independentes de entendimento. Não há emulador 68000 aqui; oráculo de execução permanece `desconhecido`.
