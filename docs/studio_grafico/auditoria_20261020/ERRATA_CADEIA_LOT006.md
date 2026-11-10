# Errata de cadeia — LOT006

Esta errata fica fora do lote congelado e não altera seu manifesto.

## J05-018

R-C-006 inicialmente descreveu a captura como sete entidades, Texto 2 selecionado e ROUND 1. No erratum de segunda leitura, o revisor retirou RC-006-01: a imagem mostra seis entidades, Ken Masters no Inspector e nenhum rótulo ROUND 1 visível. A leitura corrigida concorda com LOT006-J05-010 e J05-A-002-result. Preservar o parecer inicial e a errata; usar somente a conclusão corrigida.

## Contagem do inventário

O inventário congelado relata 81 arquivos sob inputs/, enquanto hashes_demo_copia.txt tem 78 linhas de hashes para o projeto demo. Uma enumeração complementar do estado atual encontrou 79 arquivos dentro de inputs/demo_paletas_copia e dois arquivos de índice fora desse diretório (hashes_demo_copia.txt e hashes_demo_original.txt). O projeto atual tem 78 caminhos cobertos pelo índice-base e uma cena adicional, scenes/auditcontinuationj08.json. Essa leitura explica estruturalmente a contagem total atual 81, mas o inventário congelado não registra a lista de caminhos e por isso não permite reconstituir o corte histórico só pelo lote.

## Hash de scenes/main.json

O índice-base registra 2e77b21eab243331b25d226d83a1bed28f9821455982f5f6040784576166c342. J03-SETUP-001 registra 1453ee6bb491a09da2cce958dd8fd756f0cd25525ee8a57a4e1befe33da8cda6 para a cópia antes de abrir. Os eventos indicam uma passagem J08 anterior, mas não fornecem diff/snapshot inicial que atribua essa diferença. Não atribuir a mudança a J03 nem ao produto. Os arquivos privados pré-J03 e pós-J03 existem fora do LOT006 em evidence/J03/A/resume-001/artifacts/; eles não estavam no pacote revisto, portanto os revisores não puderam recalcular os deltas.

## Estado final J14

O checkpoint registra hash final ff2af91e62b836d9611555dfabc1e3a6b21c0867cd62452294b486f4af9a8627 para scenes/main.json, e o snapshot after-j14-scenes-main.json corresponde a esse hash. Como o conteúdo pré-probe não foi incluído como snapshot no momento, não há prova de igualdade byte a byte antes/depois; somente os valores de duração conferidos permanecem válidos.
