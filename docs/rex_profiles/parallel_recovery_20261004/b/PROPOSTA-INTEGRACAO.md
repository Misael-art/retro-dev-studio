# PROPOSTA MINIMA DE INTEGRACAO (para o integrador — nao aplicada por esta frente)

Esta frente NAO alterou produto, crates compartilhados, registry.json,
harness, Current Wave nem Memory Bank. Proponho, com localizacao e teste:

## P-1 — Perfil Enigma: `value_offset=0` como `consumer-proven` no Sonic 1

- Onde: perfil Enigma do produto (mesmo local usado pela frente B antiga na
  sugestao §5.3 do RELATORIO-INTEGRACION-B).
- O que: a cadeia medida (`0x1B6C4`→`jsr $171E`, destino WRAM `$FF4000`,
  `move.w #0,d0` no sitio) suporta `value_offset=0` com origem
  `consumer-proven` **para o parametro** — apenas isso. NAO suporta
  rotulo de nametable/VDP para a saida.
- Teste que trava: `test-contrato-b.py::test_cadeia_completa` +
  `verificar-cadeia.py cadeia --modo verificado` (recusa se qualquer sitio
  divergir).
- Risco: baixo (metadado de perfil); beneficio: tira o Enigma do Sonic 1
  de "parametro escolhido pela aparencia".

## P-2 — Dado estrutural reutilizavel: grade de IDs, nao words

- Se a camada composta do produto consumir `sonic1-mapa-*.json` da frente
  antiga, deve tratá-los como SUPERSEDADOS (ver ADENDA): a celula e 1 byte
  (ID 0x00–0x4E na amostra), grade 64x64, campo por celula = nenhum
  (flip/paleta/prioridade nao se aplicam).
- Onde: adaptador/camada que le esses JSONs; teste: uma leitura que falhe
  se o rotulo `nametable-64x32` for aceito sem consumidor VDP provado.

## P-3 — Entrada de ledger/Memory Bank (proposta, texto pronto)

> 2026-10-04 — parallel_recovery_20261004/b: P1 do PR #97 fechado.
> $FF4000 = WRAM; 6 plains Enigma (hashes preservados) = layouts 64x64 de
> IDs de 1 byte projetados em $FF1020 stride 128; elo ID→SS_MapIndex
> (0x1B738, ID$01→0x2C564/$0142) por bytes; arte/mapping/CRAM/observacao
> seguem not-evidenced. Base cb56657 (local move para 8b85589, nao
> seguida). Experimental; sem merge por esta frente.

## Fora do escopo desta frente

Promocao de maturidade, merge do PR, observacao em emulacao, decodificador
de mappings e carga de CRAM — cada um exige sua propria prova de consumo.
