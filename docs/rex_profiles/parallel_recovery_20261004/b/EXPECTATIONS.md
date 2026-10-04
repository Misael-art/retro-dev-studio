# EXPECTATIONS — frente b, parallel_recovery_20261004

Congelado ANTES de implementar/medir (regra do host: desvio = FAIL/INCONCLUSIVE
com serie bruta, nunca reescrita posterior). Este arquivo e commitado sozinho.

Base fixada: `codex/rex-sonic-sequencia` @ `cb56657a142df40d2acd09a3e03e54247f066dea`
(local == origin em 2026-10-04, sem drift). Frente B antiga inspecionada em
`420e632b03ec16504a4643a7d18aad74a0d9e282` (PR #97) — reconfirmada como HEAD
atual dela; a correcao do P1 NAO existe la. Esta frente NAO escreve la.

## E1 — identidade do alvo
- ROM BYOR: `/home/misael/emulation/roms/genesis/Sonic the Hedgehog (USA, Europe).bin`
- SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`, 531577 bytes
  (reconfirmado por sha256sum nesta sessao; coincide com review-pr97.json).

## E2 — cadeia do consumidor (bytes da ROM, offsets exatos)
Medidos diretamente dos bytes (dump desta sessao); cada item deve ser reproduzido
pela CLI em modo verificado:
- Tabela em `0x1b64c`: 6 longs = `0x65432, 0x656ac, 0x65abe, 0x65e1a, 0x662f4, 0x667c6`.
- `0x1b6c4`: `20 7b 00 86` — `movea.l (132,PC,D0.w),A0`; alvo = `PC+2+(-126)+D0` c/ D0=indice*4
  (a palavra `00 86` tem disp8=0x86=134-256=-122 relativo a `0x1b6c6` → base `0x1b64c`).
- `0x1b6c8`: `43 f9 00 ff 40 00` — `lea $FF4000,A1`. **$FF4000 esta na faixa
  $FF0000-$FFFFFF (RAM de trabalho), NAO e a porta de dados VDP ($C00004/$C0A004).**
- `0x1b6ce`: `30 3c 00 00` — `move.w #$0,D0` (value_offset = 0 no sitio de chamada).
- `0x1b6d2`: `4e b9 00 00 17 1e` — `jsr $171E` (unico jsr absoluto a $171E na ROM).
- `0x1b6d8`: `43 f9 00 ff 00 00` + `30 3c 0f ff` + `42 99` + `51 c8 ff fc` —
  limpa 4096 longs desde `$FF0000` (buffer de layout com padding).
- `0x1b6e8`: `lea $FF1020,A1`; `0x1b6ee`: `lea $FF4000,A0`;
  `0x1b6f4`: `72 3f` d1=63; `0x1b6f6`: `74 3f` d2=63;
  `0x1b6f8`: `12 d8` — **`move.b (A0)+,D1` (operando de 8 bits)**;
  `0x1b6fa`: `51 ca ff fc` (64 bytes por linha); `0x1b6fe`: `43 e9 00 40`
  (salto +64 = padding); `0x1b702`: `51 c9 ff f2` (64 linhas).
  Projeção: `RAM[$FF1020 + r*128 + c] = plain[r*64 + c]`.
- `0x1b706`: `lea $FF4008,A1`; `0x1b70c`: `lea $1B738,A0`; `0x1b712`: `72 4d` d1=77
  (78 entradas); corpo `22 d8 / 32 fc 00 00 / 13 68 ff fc ff / 32 d8 / 51 c9 ff f0`
  expande registros de 6 bytes em slots de 8 bytes em `$FF4008`
  (slot do ID k = `$FF4000 + 8*k`, k=1..78; slot 0 implicito em branco).
- `0x1b726`: `lea $FF4400,A1` + clear 64 longs; `0x1b736`: `rts`.
- Guarda anterior: `0x1b694`-area com `cmpi.w #$1000` e `bhi/ble` limita indice;
  fluxo confirmado pela varredura da frente antiga (tabela 0x1b64c, xn=0..20).

## E3 — semantica do decodificador (referencia estatica pinada)
- `s1disasm @ 064e3c68eb19cc85b8801b087f9d95f9b3e82cea` (checkout local em
  `/home/misael/.cache/rex-corpus-d/s1disasm`, HEAD == pin, remoto github.com/sonicretro/s1disasm):
  `EniDec` recebe `d0 = starting art tile` somado aos valores; `a1` = endereco de
  destino em RAM; saida em words big-endian empacotados byte a byte em `(a1)+`.
- `SS_LoadData` no mesmo pino: descompacta layout Enigma em buffer temporario,
  limpa buffer final, copia 64 linhas de 64 bytes com padding de 64 (stride 128),
  e carrega `SS_MapIndex` → `v_ss_spritesettings`. Os bytes da ROM (E2) batem com
  o texto do pino; o nome no disassembly NAO substitui a prova por bytes.

## E4 — paridade dos seis streams (preservar, nao reinterprestar)
Decode Enigma (variante plain, value_offset=0) de cada stream da tabela:
- saida 4096 bytes; consumidos `634, 1042, 860, 1242, 1233, 784`;
- SHA-256 exatos de review-pr97.json:
  `322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0`,
  `4b5ac5ea3391a5146e935474137df1ae74bb3926354bb63a321e03020f12733d`,
  `3643e681d5260a6d51a3e0cd4558ded3b189663d62258dbee189f2167d6c3954`,
  `04b5a97a675e9f84790932fc94c801aafd0c34a05ad450437da3a01feac5e9c7`,
  `5841c3fbaf8a648593914121ea0af13f2339c29754b59167a4b21178dfceacd8`,
  `78a2093e623f11fc227fe10390cd9f3d4afc234a838ba70bd2641b5637128c94`.
Qualquer divergencia = FAIL (a paridade e o contrato antigo de codec; so a
interpretacao muda).

## E5 — layout (contrato corrigido)
- Os 4096 bytes = grade 64x64 de IDs de bloco de 1 byte: `id[r][c] = plain[r*64+c]`.
- ID `$00` = bloco em branco; IDs validos ate `$4E` (guarda de faixa vista no
  loop de desenho do pino; provada por bytes aqui apenas como estrutura).
- NENHUM bit destes bytes tem flip/paleta/prioridade provados; a visao
  "2048 palavras VDP / nametable 64x32" deve ser REPROVADA por teste
  discriminante (a copia real e byte-a-byte com stride 128; operandos 8 bits).

## E6 — projeção e inverso
- `projetar(plain)` → buffer 8192 bytes com `out[r*128+c]=plain[r*64+c]` e
  padding zerado (`out[r*128+64..127]=0`).
- Inverso: posicao `p` no buffer projetado pertence ao layout sse `p%128 < 64`;
  extrai `plain[p//128*64 + p%128]`. Round-trip projetar→inverso == identidade
  sobre o domínio; o inverso de celulas de padding e recusa, nao zero silencioso.

## E7 — elo ID→definicao (proximo elo substantivo)
- `SS_MapIndex` em `0x1B738`: 78 registros x 6 bytes = 468 bytes
  (fim `0x1B90C`); formato por E2 (long `(frame<<24)|ponteiro`, word `paleta|vram`).
- Esperado: TODOS os 78 ponteiros baixos-24 dentro do dominio da ROM; o registro
  do ID `$01` = `00 02 c5 64 01 42` → ponteiro `0x2c564`, word `$0142`
  (= `ArtTile_SS_Wall` do pino; campo paleta 0 ⇒ Pal1 no macro do pino).
- Limite declarado: provar ateh `ID → slot(8B) → definicao(6B) → ponteiro de
  mappings em ROM`. Decodificar mappings, carga de arte (Kosinski/Nemesis) e
  CRAM/paleta NAO fazem parte desta entrega; visual = diagnostico de IDs
  rotulado como tal; composicao grafica proibida sem esses elos.

## E8 — negativos que devem recusar (recusa observada, com motivo)
1. ROM errada (SHA diverge do pin) → recusa antes de qualquer saida promovida.
2. Sítio alterado (qualquer byte de E2 mutado) → recusa da cadeia verificada.
3. Destino alterado (`$FF4000`→porta VDP real `$C00004`, ou `$FF1020`→outro) → recusa.
4. Stream nao pertencente a tabela (offset fora dos 6 longs) → recusa de vínculo.
5. Geometria errada (64x32 / stride 64 / stride ≠ 128) → recusa.
6. Consumidor ausente (sem evidencia de cadeia) → saida marcada nao-promovida;
   em `--modo verificado`, erro de saída.
- Decode duplo = determinismo, NUNCA alegado como identidade.
- Fixture assimetrica autoral (primeira/ultima celula, fronteiras de linha) DEVE
  reprovar a interpretacao antiga de pares como palavras VDP.

## E9 — Pulseman
- 196/196 permanecem descritos como "streams compativeis com o decoder/referencia";
  nenhuma frase "recursos graficos usados pelo jogo" ate consumidores provados.

## E10 — niveis de alegao desta entrega
- candidato: nada promovido a partir de aparencia;
- referencia estatica: pino s1disasm + review-pr97 (conferidos por bytes);
- vinculo estrutural: E2/E7 pelos bytes da ROM;
- consumo observado: NAo alegado (nenhuma execucao de emulador nesta frente);
- semantica recuperada: layout 64x64 de IDs + projecao stride 128 (E5/E6);
- reconstrucao equivalente: NAO alegada (sem arte/mapping/paleta provados).

## E11 — gates minimos desta frente
- `python3` stdlib apenas; CLI com `--modo verificado` nao-promove sem evidencia;
- testes discriminantes roxos contra implementacao antiga (mutante) e verdes na nova;
- `npm run check:tree` na worktree; nada fora de `scripts|docs|data/rex_profiles/parallel_recovery_20261004/b/`;
- nenhum byte comercial versionado; PNGs so de diagnostico FORA do git, registrados por SHA.
