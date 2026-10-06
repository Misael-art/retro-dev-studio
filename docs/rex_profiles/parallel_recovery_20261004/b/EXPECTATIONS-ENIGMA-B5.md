# EXPECTATIONS-ENIGMA-B5 — `value_offset` conforme o console (rodada B5)

Congelado **antes** de qualquer correção do decoder. Base do defeito: `da5472c` (B) e
`crates/rex-enigma/src/lib.rs` em `origin/codex/rex-integrator-sonic-103104@43bb42f6` (a lógica de
`fetch_inline` é idêntica; só `rustfmt` difere).

## 1. Defeito reproduzido

Stream inline com flag de prioridade, `pl=4`, máscara `0x10`, flag=1, raw=`0101`:
`value_offset=0000` → `8005`; `value_offset=8000` → **`0005`** (esperado `8005`).
Causa: `raw + offset + flags` (soma de tudo, com wrap). O console faz
`d3 = base; d3 |= 8000 (se P); d3 += 4000 (se C1); d3 += 2000 (se C0); d3 |= 1000 (se V); d3 |= 0800 (se H);
valor = (raw & máscara_pl) + d3`.

## 2. Ordem exata das operações (asm pinado, `EniDec_FetchInlineValue`)

| passo | asm | operação sobre d3 |
|---|---|---|
| inicial | `move.w a3,d3` | `d3 = base` |
| P (máscara 0x10) | `ori.w #$8000,d3` | **OR** |
| C1 (0x08) | `addi.w #$4000,d3` | **ADD** (carry pode entrar no bit 15) |
| C0 (0x04) | `addi.w #$2000,d3` | **ADD** (carry pode entrar em C1/P) |
| V (0x02) | `ori.w #$1000,d3` | **OR** |
| H (0x01) | `ori.w #$0800,d3` | **OR** |
| final | `add.w d3,d1` | `valor = (raw & máscara) + d3` (mod 2^16) |

Ordem de leitura dos bits de flag no stream: P, C1, C0, V, H, depois `packet_length` bits do raw.
Incremental e comum: `hdr + base` (`adda.w`), mod 2^16; **não recebem flags**; o incremental persiste
entre tokens. Corridas inline: o valor (já com base e flags) é repetido / `+1` / `−1` mod 2^16.
**Não** se troca soma por OR indiscriminadamente: P, V e H são OR; C1 e C0 são ADD.

## 3. Domínio aceito (declarado)

- `value_offset`: todo `u16` (0000..FFFF). Com a correção é **provado** nos casos de §4; se algum item abaixo
  não fosse provado, a API seria restrita com erro estruturado (§7 da missão). Nenhum ficou sem prova.
- `packet_length` ∈ 1..=11 e máscara ≤ 0x1F: inalterados; fora disso `MalformedHeader` (divergência
  deliberada do console, que ignora bits 5..7 da máscara e estende com sinal o `packet_length`).

## 4. Casos congelados (valores calculados à mão do asm; testes em `tests/value_offset_asm.rs`)

| caminho | máscara / flags | offset | esperado |
|---|---|---|---|
| inline P | 0x10, flag=1, raw 5 | 0000 / 8000 / C001 / 7FFF | 8005 / **8005** / C006 / 0004 |
| inline P | flag=0, raw 5 | 0000 / 8000 / C001 / FFFF | 0005 / 8005 / C006 / 0004 |
| inline C1 (ADD) | 0x08, flag=1 | 0000 / 4000 / 8000 / C001 | 4005 / 8005 / C005 / 0006 |
| inline C0 (ADD) | 0x04, flag=1 | 0000 / 2000 / E000 | 2005 / 4005 / 0005 |
| inline V (OR) | 0x02, flag=1 | 0000 / 1000 | 1005 / 1005 |
| inline H (OR) | 0x01, flag=1 | 0000 / 0800 | 0805 / 0805 |
| inline todas | 0x1F, 11111 | 0000 / 8000 / C001 | F805 / F805 / 3806 |
| inline P,C0,H | 0x1F, 10101 | C001 | E806 |
| inline C1,V | 0x0A, 11 | 8000 | D005 |
| inline pl=11 | raw 7FF | 0000 / 8001 | 07FF / 8800 |
| incremental | hdr 0010, cnt 3 + cnt 1 | 8000 / 0000 | 8010..8013 / 0010..0013 |
| incremental wrap | hdr FFFE | 0003 | 0001 0002 0003 |
| comum | hdr 0007, cnt 2 | 0000 / C001 / 8000 | 0007 / C008 / 8007 |
| comum wrap | hdr FFFF | 0001 | 0000 0000 |
| comum com P no stream | hdr 0001 | 8000 | 8001 (sem flags) |
| inline +1 / −1 / repete / multi | ver teste | 0000 / 8000 / C001 | ver teste |

Limite exato de saída: stream de N palavras aceita com `max_output_bytes = 2N` e `2N+2`, recusa
(`ExcessiveOutput`) com `2N−1` e `2N−2`, em incremental, comum, inline repetido e inline modo 3.

## 5. Mutantes que a suíte tem de matar

`value_offset` não somado na palavra comum; limite de saída `>` → `>=` (ou `+1` omitido); palavra de flags somada
em vez de OR para P/V/H; OR no lugar de ADD para C1/C0; offset ignorado no incremental; ordem das flags trocada.

## 6. Independência (o que estes valores NÃO são)

Os valores saem de **uma** leitura do asm (a mesma fonte do decoder clean-room). Não há emulador 68000 independente
nesta máquina, então isto **não é** dupla evidência independente: é derivação manual de uma fonte por um caminho
diferente do código. Um oráculo de execução (68000 real/emulado) continuaria `desconhecido`.
