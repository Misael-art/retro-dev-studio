# ADENDO-1 ao EXPECTATIONS-INSP-2026-10-05 (datado: 2026-10-05)

Este adendo RETIFICA A INTERPRETAÇÃO de um conflito interno do arquivo
congelado `EXPECTATIONS-INSP-2026-10-05.md`. O texto congelado não foi
alterado; esta é a correção autorizada por data, conforme a regra da própria
rodada ("desvio observado vira FAIL honesto ou retificação por adendo
datado, nunca reescrita").

## Conflito observado

- §1 (contrato do comando): "se a ROM não conferir com os sítios, os sítios
  divergentes são listados **e a cadeia/recursos/interpretação são recusados
  com motivo** — nunca um 'ok' parcial silencioso."
- §5, teste T4 (`tabela_de_streams_e_relida_da_rom`): "entradas trocadas na
  fixture → `entradas[].ok=false` nos índices certos."

As duas frases não podem valer literalmente ao mesmo tempo: as 6 entradas da
tabela `0x1B64C` são exatamente os bytes dos sítios de papel `tabela`
(`0x1B64C..0x1B664`). Trocar uma entrada **sempre** divergiria um sítio, e o
§1 manda recusar a cadeia inteira — nunca entregar um DTO com
`entradas[].ok=false`.

## Decisão implementada (prevalência do §1)

- §1 prevalece: qualquer divergência nas 6 entradas da tabela produz recusa
  total (`consumers_sitios_divergentes: <n>/37 sitios divergem; cadeia,
  recursos e interpretacao recusados: [...]`) com os endereços das entradas
  trocados listados no detalhe (ex.: `0x1b654`, `0x1b658`).
- O campo `entradas[].ok` do DTO continua congelado: quando o DTO é
  produzido, todas as entradas conferem (`ok=true` por construção); o campo
  existe para a UI não inferir nada. Nenhum caminho do produto emite
  `entradas[].ok=false` com cadeia aprovada.
- T4 foi implementado como: "trocar duas entradas da tabela na fixture →
  recusa da cadeia com os índices trocados citados no motivo", verificando a
  mesma informação (§5 pedia "nos índices certos"; a recusa carrega os
  endereços divergentes).

## Evidência

- Teste Rust `t4_tabela_de_streams_e_relida_da_rom` em
  `src-tauri/src/tools/reverse/decomp/sonic_consumers.rs` ( GREEN da rodada,
  2026-10-05).
