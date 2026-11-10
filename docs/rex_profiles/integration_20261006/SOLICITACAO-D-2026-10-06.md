# Solicitação de comparação dirigida à frente D (não é veto, não é bloqueio)

O integrador **não** usa resultados antigos de D como veto automático dos SHAs novos de A/C. Casos
relevantes para esta entrega, a medir contra os SHAs atuais:

1. **Enigma / B**: as 6 plains de 4096 B (`export-avaliacao-d.json` de B) contra a saída que o produto
   calcula agora (hashes em `data/rex_profiles/integration_20261006/evidencia/byor-enigma-run*.json`).
2. **A `71e70554`** e **C `5f973689`**: apenas se D quiser recontar seu holdout v3 contra os tips atuais
   (D mediu A `6ae4f02` e C `5f97368`, ver `f6d03b93`). Nenhum dos dois entra no runtime nesta rodada.

Resposta de D, se vier, entra como evidência adicional; ausência de resposta não bloqueia a entrega.
