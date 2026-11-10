# Validade do toque curto no `jump-gameplay-journey` — o que os dados brutos mostram

Gerado a partir de TODOS os relatórios de gameplay versionados (inclui execuções com binários anteriores a esta missão e à anterior). Não é uma reexecução: é leitura do que já foi medido.

Uma repetição de **toque** só é válida se o roteirista confirma que o input nativo foi consumido (`lastJoypadAck` do aperto e da soltura, na mesma sessão). Quando a 1ª tentativa não confirma, há UMA nova tentativa; se a segunda também não confirma, a repetição é inválida. Uma variante com menos repetições válidas que o mínimo fica inconclusiva e, pela regra congelada G6, o jogo inteiro não é aprovado.

| Relatório (UTC) | allPass | Sonic 1: toques · 1ª tentativa sem confirmação · inválidos | Delta: toques · 1ª tentativa sem confirmação · inválidos |
|---|---|---|---|
| `2026-10-08T09-32-16-014Z` | False | 18 · 4 · 0 | 24 · 0 · 24 |
| `2026-10-08T12-40-40-251Z` | False | 18 · 3 · 1 | 24 · 0 · 24 |
| `2026-10-08T13-20-58-681Z` | False | 18 · 5 · 2 | 24 · 8 · 3 |
| `2026-10-08T17-39-46-086Z` | False | 18 · 3 · 1 | 24 · 11 · 6 |
| `2026-10-09T02-25-27-195Z` | False | 18 · 7 · 2 | 24 · 7 · 4 |
| `2026-10-09T04-47-24-289Z` | True | 18 · 3 · 1 | 24 · 6 · 2 |
| `2026-10-09T06-14-58-506Z` | True | 18 · 6 · 1 | 24 · 6 · 0 |
| `2026-10-09T13-51-40-930Z` | True | 18 · 7 · 2 | 24 · 8 · 3 |
| `2026-10-09T19-59-11-489Z` | False | 18 · 3 · 1 | 24 · 9 · 4 |
| `2026-10-09T21-26-10-620Z` | True | 18 · 2 · 0 | 24 · 9 · 4 |
| `2026-10-10T00-05-41-931Z` | False | 18 · 3 · 2 | 24 · 14 · 9 |

**Leitura:** a falta de confirmação do input na 1ª tentativa do toque aparece em **todas** as execuções, aprovadas ou não, com qualquer binário — de 2 a 14 toques por jogo. As execuções aprovadas são as em que as segundas tentativas confirmaram o bastante em cada variante; as reprovadas por G6 são as em que duas faltas seguidas caíram na mesma variante. Os valores de ápice das repetições VÁLIDAS são os mesmos em todas (34/94 originais; +88 impulso; +47 corte).

**Causa, até onde foi isolada:** é uma propriedade da MEDIÇÃO do toque (confirmação do evento de tecla nativa sob Xvfb), não do que está sendo medido: as cópias usadas têm SHA-256 idêntico ao das rodadas aprovadas, e o código do emulador não foi alterado (`git diff d8b1e0cf HEAD -- src-tauri/src/emulator` vazio). **Não isolado:** por que a confirmação falta (duração do toque × amostragem do `lastJoypadAck` × taxa de quadros sob Xvfb são hipóteses, não medidas).

**O que isto NÃO autoriza:** tratar a execução `2026-10-10T00-05-41-931Z` como aprovada. Ela está em `falhas-preservadas/` como reprovada (14/19; Sonic 1 PASS; Delta inconclusivo em `original`, `a-both`, `b-imp`). Não houve repetição até passar e nenhum limiar foi alterado.

**Ressalva:** nesta execução o Delta teve 14 primeiras tentativas sem confirmação em 24 — o maior valor da série (antes: 6 a 11). Só com estes dados não dá para excluir que alguma condição desta sessão agrave a taxa (por exemplo, carga do host: a jornada rodou logo depois de quatro outras, em sequência). Fica como observação, não como explicação.
