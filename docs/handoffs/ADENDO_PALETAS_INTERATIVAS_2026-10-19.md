# Adendo para gestão visual e dinâmica de paletas

Data: 2026-10-19. Requisito do operador para o próximo lote do Studio Gráfico Integrado. Complementa `PROMPT_STUDIO_GRAFICO_INTEGRADO_2026-10-19.md` e a correção da composição de cenário, personagem e HUD. É planejamento autorizado, não implementação ou certificação. Não altera expectativas, resultados ou manifestos das rodadas anteriores.

## Objetivo e contexto

Oferecer gestão de paletas por cena e por etapa/estado suportado, acessível no contexto de sprite, background, tilemap e texto. O usuário deve ver disponibilidade, compartilhamento, conflitos e usos, navegar até esses usos e efetuar mudanças reversíveis. O compilador precisa cumprir o mesmo plano mostrado pelo editor, eliminando sobrescritas silenciosas como a colisão PAL0 observada no checkpoint `e40f209b`.

Uma paleta do projeto é um recurso identificado e reutilizável. Um banco físico é um destino de armazenamento limitado na plataforma. Não confundir a quantidade de paletas da biblioteca com a quantidade que precisa estar residente simultaneamente. No Mega Drive, a operação normal usa quatro bancos de 16 cores; outras plataformas devem fornecer suas capacidades por adaptador.

Referência técnica primária para fundamentação, não para substituir o toolchain pinado: documentação oficial SGDK `https://stephane-d.github.io/SGDK/pal_8h.html` (bancos, cores, alterações e transições). Consultar também o SDK oficial efetivamente instalado. Não modificar `docs/04_HARDWARE_SPECS.md`.

## Interface no contexto

1. **Resumo por cena.** Exibir um controle compacto “Paletas — ocupação e conflitos” próximo às propriedades/camadas, expandindo para o painel completo. Cada paleta tem nome, faixa de cores, identidade, banco atribuído quando aplicável, quantidade de usos e estado. Não criar uma aplicação separada nem espalhar o gerenciamento em formulários independentes.
2. **Seleção do objeto.** O Inspector mostra a paleta atual, o escopo da alteração, as opções compatíveis e os usos compartilhados. Objetos podem ter mais de uma referência conforme seu formato. Não presumir que um personagem equivale a um único sprite físico ou paleta em todo formato.
3. **Estados explícitos.** Distinguir Livre; Em uso e compartilhável; Reservada; Em conflito; Programada para outra etapa. “Em uso” não torna automaticamente a opção indisponível: muitos recursos podem compartilhar as mesmas cores. A atribuição incompatível fica bloqueada com motivo e ações para resolver. Quando a compatibilidade depende de conversão de índices, a proposta precisa de prévia e aplicação explícita.
4. **Usos navegáveis.** Hover ou foco apresenta nomes, miniaturas, cena, entidade, animação/quadro e uso da fonte quando disponíveis. Clique fixa a lista e abre o elemento correspondente sem perder o contexto. Permitir o acesso por teclado; informação essencial não pode depender só de hover ou cor. Uma opção indisponível ainda deve permitir descobrir por que e onde resolver.
5. **Contexto temporal.** Separar Cena completa, Etapa selecionada e Estado/quadro observado na execução. Só anunciar reutilização temporal quando o plano provar que os usos não concorrem e o runtime implementar a troca. Não supor ausência de uso por estar fora da câmera ou oculto no editor. Contextos não analisados mantêm reservas conservadoras e uma explicação.

Exemplo ilustrativo, sem impor esses bancos ao compilador:

| Banco MD | Conteúdo | Estado | Ação contextual |
|---|---|---|---|
| 0 | Terreno e fundo | Compartilhada por 3 recursos | Mostrar usos / editar compartilhada |
| 1 | Personagem | Compartilhada por 2 instâncias | Abrir personagem / criar variante |
| 2 | Fonte do HUD | Reservada neste plano | Mostrar reserva / alterar atribuição |
| 3 | — | Livre no contexto atual | Atribuir |

## Ações e alcance das mudanças

- **Editar compartilhada:** mostrar todos os usos afetados, comparar antes/depois e aplicar em uma transação reversível. Respeitar efeitos de mudar uma entrada de cor usada por vários elementos. Uma alteração local não pode modificar silenciosamente o recurso compartilhado.
- **Criar variante local:** preservar a paleta original e alterar a referência do uso selecionado. Validar capacidade física: duplicar um recurso lógico não cria um banco novo no hardware.
- **Trocar paleta do objeto:** oferecer prévia imediata no contexto e atalho/seleção rápida. Preservar índices ou apresentar o remapeamento necessário. Fonte, transparência e cores reservadas precisam de regras do destino, não correções invisíveis.
- **Liberar banco:** navegar ao uso e reatribuir uma paleta compatível, desativar realmente aquele elemento/uso no contexto ou encerrar seu período de residência com recarga posterior definida. O banco só é livre quando nenhum outro uso concorrente depender dele. Ocultar no editor não libera recurso da ROM. Não oferecer “sem paleta” como se o hardware deixasse de interpretar os índices.
- **Redefinir reserva:** permitir quando o planejador conseguir realocar os usos dependentes, mostrando o impacto. Não permitir sobrescrita direta da fonte ou de outro recurso obrigatório.
- **Mover/renomear:** preservar identidade, referências e histórico conforme o caminho canônico. Não tratar renomeação como criação de outra paleta.

## Trocas, animações e efeitos

Criar um vínculo explícito entre evento/estado e paleta, reaproveitando NodeGraph, comportamentos e timeline existentes. Exemplos: dano, transformação, roupa, transição de ambiente e ciclo de cores. A interface deve distinguir “aplicar só a esta instância” de “alterar todos que usam este banco/paleta”.

Trocar a referência do objeto para outro banco residente e reescrever cores de um banco compartilhado têm alcances diferentes. Mostrar o grupo afetado. Quando a intenção for local e não houver recurso disponível, oferecer alternativas ou diagnóstico; não recolorir os demais silenciosamente.

A primeira entrega dinâmica precisa de uma troca de estado/evento que seja editável, reversível e comprovada na ROM, com o momento de atualização definido pelo backend. Transições/fades/ciclos adicionais entram conforme capacidades implementadas. Técnicas de raster/scanline e maior uso temporal não são presumidas nem implementadas genericamente por este adendo.

Alterar conteúdo no editor atualiza a prévia e invalida os derivados afetados. Mostrar quando a ROM precisa ser recompilada e qual versão está executando. Aplicação ao vivo só em caminho tecnicamente suportado e validado; metadados planejados não são observação de CRAM.

## Modelo e compilação

- Auditar e evoluir as estruturas existentes (`Scene.palettes`, referências de recursos, `palette_slot`, importadores, análise de hardware, emissores e vínculo de execução). Não criar um alocador concorrente ou escolhas locais incompatíveis entre módulos.
- Definir um plano versionado e determinístico por cena/contexto: recursos lógicos, referências e usos, cores/índices, vínculos físicos, reservas, períodos e comandos de troca. Um mesmo plano deve orientar prévia, validação, código gerado, diagnóstico e inspeção. Expor a origem e o nível de evidência de cada campo.
- Respeitar escolhas explícitas ou explicar por que são incompatíveis. Reutilizar bancos para recursos compatíveis; qualquer união/remapeamento de índices precisa ser verificado. Não quantizar, substituir ou reduzir cores silenciosamente.
- Detectar conflitos antes do build e explicar quais usos concorrem e quais ações podem resolver. Escassez de bancos não autoriza sobrescrever o último carregamento. Não bloquear apenas porque a biblioteca inteira tem muitas paletas.
- Separar definições agnósticas do adaptador MD. Não introduzir nomes PAL0..PAL3 no modelo genérico como regra universal. Preservar formatos anteriores e migrar com cópia recuperável e aviso quando necessário.
- Para conteúdo importado/REX, só expor mudanças cuja codificação, consumidores e reinserção estejam suportados; manter desconhecidos explícitos. Esta missão não habilita edição universal de paletas comerciais.

## Aceite de implementação

Execute um lote único e coeso: planejamento de paletas, controles contextuais e correção da composição. Preserve as correções de identidade e HUD já demonstradas. Siga os gates, barreiras do host, restrições de publicação e organização do prompt principal. Não adicionar dependência sem aprovação nem alterar maturidade.

Antes de medir, congele hipóteses e referências a partir dos assets/paletas originais e do modelo do core pinado. Guarde as falhas antigas. Não escolher cores, posição ou tolerância após observar a cópia para transformar uma divergência em aprovação.

Testes exigidos:

1. Compartilhamento compatível aceito; conflito de cores concorrentes recusado com usos e motivo; ausência de banco livre diagnosticada sem sobrescrita silenciosa.
2. Editar paleta compartilhada afeta exatamente os usos previstos; variante local preserva os demais; desfazer/restaurar recupera dados e ROM esperados.
3. Hover, foco e clique levam aos usos corretos. Opção incompatível explica a causa e permite navegar à resolução. A quantidade mostrada deve distinguir referências totais de usos simultâneos.
4. Liberar um uso não libera o banco se outro uso concorrente permanecer. Ocultar somente no editor não muda a alocação da ROM. Troca de etapa restaura a paleta necessária antes de reutilizar o recurso.
5. Troca por evento/estado no core altera apenas o alvo ou grupo declarado; não repete indevidamente; restaurar devolve as cores originais. A observação da memória gráfica, quando indisponível, é registrada como indisponível; não inventar leitura de CRAM.
6. Jornada pela UI no mesmo projeto: importar Ken real, adicionar o mapa pelo caminho canônico, atribuir/compartilhar paletas, criar HUD, configurar uma troca, salvar/encerrar/reabrir, compilar, caminhar, atacar, inspecionar, restaurar e exportar. Não escrever a cena no disco pelo harness para suprir ausência de função da UI.
7. Conferir simultaneamente as cores do personagem, do fundo e da fonte por referência independente e domínio definido; câmera/ancoragem e política de WINDOW continuam corretas. A faixa de HUD reservada precisa ser visível na composição, ou o backend deve implementar a apresentação alternativa escolhida.
8. Reexecutar os oráculos e jornadas afetados pelo delta, incluindo MUGEN real, cena/câmera, HUD, golpe/áudio e navegação quando modificados. Não apresentar resultados herdados como corridas novas.

O fechamento apresenta o plano de alocação, escolhas do usuário, resultados do editor e do runtime, hashes, mudanças desde o último teste, limites e roteiro humano atualizado. A validação humana continua separada até ocorrer participação real.
