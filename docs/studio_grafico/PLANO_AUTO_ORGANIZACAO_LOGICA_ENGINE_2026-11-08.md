# Plano — auto-organização da lógica na engine/editor

**Status: proposta para validação do operador, antes da implementação.** Pedido de 2026-11-08. Esta entrega contém avaliação, plano e mockups. Nenhuma capacidade abaixo foi implementada por esta tarefa, nenhum projeto de jogo foi reorganizado e nenhuma validação de runtime é inferida das imagens.

## 1. Objetivo e alcance

Acrescentar ao RetroDev Studio uma capacidade de autoria que identifique e organize visualmente a lógica de qualquer projeto compatível a partir dos modelos, nós e relações existentes. A engine/editor deve associar automaticamente **intenção, participantes, gatilho, condição, efeito e origem**. O template de plataforma e o herói são casos de teste e exemplos de exibição; não determinam o algoritmo.

A melhoria pertence ao editor/modelo de autoria do produto. Não requer um segundo motor de execução, um compilador novo ou regras especiais para Player, Nalu, uma ROM, nome de arquivo ou gênero de jogo. “Qualquer projeto compatível” não significa interpretação universal de código arbitrário: o reconhecimento é limitado pela semântica disponível, com desconhecidos explícitos.

Preservar a navegação global à esquerda, a navegação horizontal de contexto, acesso a todas as ferramentas, o grafo completo, parâmetros numéricos, conexões, condições, ramificações, trajetos e liberdade de composição. As vistas propostas são projeções dos mesmos dados. Não transformar o editor em uma lista de cartões que substitua a edição precisa.

Esta proposta complementa R2/R3 e a direção R5/R7 da [jornada de autoria](JORNADA_MEGA_DRIVE_2026-11-05.md). Sua execução futura deve entrar na frente sequencial vigente, respeitar a [retomada](../handoffs/PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md) e o [prompt integral existente](../handoffs/PROMPT_IMPLEMENTACAO_UX_CONTEXTUAL_R3_2026-11-05.md), após validação deste plano. Não iniciar esta implementação nesta rodada.

## 2. Avaliação da tela real e da base disponível

Referência visual: captura enviada pelo operador, com 37 nós e grupos cujo propósito é difícil de reconhecer no zoom apresentado. Quantidades são da captura, não uma medição nova de execução. A mesma miniatura de personagem aparece em lógicas com funções distintas; os fundos coloridos não explicam quem consulta ou modifica cada participante. A malha pontilhada domina a visão geral e os títulos ficam pequenos.

Na fonte pesquisada, já existem peças úteis:

| Fonte/owner | O que existe | Lacuna a tratar na engine/editor |
|---|---|---|
| `src/core/nodegraph/nodeCatalog.ts` e `nodeDefinitions.ts` | Catálogo único, categorias, ícones, nomes e definição dos nós | Descrever papéis semânticos dos parâmetros/portas de cada tipo suportado: alvo, leitura, escrita, recurso, gatilho e efeito. Não inferir o papel só pelo texto do nome. |
| `src/core/nodegraph/ruleSummary.ts` | Resumos Quando → Se → Fazer, IDs de nós e tratamento explícito de fluxos avançados | Reutilizar e ampliar a projeção para participantes, nomes amigáveis, relações entre regras e origem; não apresentar resumo parcial como completo. |
| `src/core/nodegraph/behaviorLibrary.ts` | Receitas, instâncias, papéis, parâmetros e assinaturas de nós gerados | Usar essas informações como origem declarada das associações, sem recriar receitas ao interpretar a imagem do grafo. |
| `src/core/nodegraph/nodeTypes.ts` | Grupo visual com id, label, nodeIds e collapsed; identidade de nós/arestas | Preservar identidade e metadados de autoria. Resolver separadamente relações derivadas, escopo e personalizações visuais. |
| `src/components/nodegraph/NodeGraphEditor.tsx` | Agrupar, nome sugerido, recolher, mover grupo, enquadrar e navegar para o alvo | O nome sugerido depende da seleção e de heurísticas simples; o cabeçalho reduz altura conforme o zoom. Criar identidade legível persistente e associação automática nos fluxos de construção. |
| `src/core/nodegraph/nodeLayout.ts` | Layout, ocupantes recolhidos, pins, conflitos e `graphSemanticSignature` | Estender a organização incremental por relações/grupos, preservando a defesa já existente de não alterar lógica. |
| `studioContext`, `editorStore`, contexto/origem da entidade e renderer da cena | Seleção, contexto, retorno e apresentação da cena | Ligar regra ↔ participantes sem outro sistema de seleção, outra cena ou carregamento sem limite de assets. |

Observação de fonte: a sugestão atual chega a reconhecer objetivo procurando `goal` no parâmetro e pulo pela presença de velocidade vertical negativa. Isso é útil como ponto de partida, mas não deve virar contrato genérico. Renomear um objeto ou combinar duas regras não pode mudar arbitrariamente a intenção reconhecida.

O workspace contém mudanças de outra frente em fontes de produto e em documentos compartilhados. Elas permanecem preservadas. A leitura começou em `1c5f404f`; durante a avaliação a continuidade avançou a `014e299fad9cc20d1cedef780b4f50be7f219418`. Revalidar o estado antes de qualquer implementação futura. Este plano não certifica essas mudanças.

## 3. Contrato da associação automática

### 3.1 Uma origem, uma projeção

Derivar a descrição do grafo/modelo canônico. A projeção pode ter cache por revisão, mas não é outro grafo de execução nem outra fonte de parâmetros. Usar os resolvers existentes para projeto, cena, grafo, instância/modelo e recurso; não deduzir escopo pela miniatura.

Cada regra/grupo apresenta, quando conhecido:

- **Título de intenção:** ação compreensível, com participante quando útil; título personalizado pelo autor tem precedência.
- **Definida em:** contexto/origem real da regra, distinto dos objetos afetados.
- **Quando / Se / Faz:** gatilho, condições e efeitos sustentados pelo modelo.
- **Afeta:** entidades, recursos, variáveis ou serviços modificados.
- **Consulta / depende de:** entidades, estados, colisão, variáveis e recursos lidos.
- **Origem:** declaração/receita, descrição derivada do grafo ou associação parcial/não confirmada.
- **Identidade navegável:** referências existentes de grafo/nós/grupo para localizar o conteúdo, sem trocar IDs por nomes visuais.

Um grupo pode pertencer à lógica de um personagem e afetar porta, câmera ou áudio. Miniaturas representam os participantes pertinentes, inclusive mais de um; não repetir sempre o sprite dono do arquivo. Áudio, câmera, variável e recurso sem imagem recebem representação do seu tipo e nome, sem inventar um sprite. Ausência de asset não impede identificar a regra.

### 3.2 Precedência de reconhecimento

1. **Origem declarada:** metadados válidos de receita, binding ou modelo de objeto, inclusive dados de trajeto quando esse for o owner. Nomes/participantes são derivados dessa origem conhecida.
2. **Descrição do grafo:** analisar tipos/portas/parâmetros conhecidos e os caminhos de execução/dados. Uma descrição é reconhecida por estrutura e semântica tipada, não por nomes de personagens ou do projeto.
3. **Parcial:** conservar as partes conhecidas e indicar lacunas, múltiplas entradas, participantes indefinidos e efeitos que não podem ser resumidos. Dar acesso ao grafo completo, sem forçar uma classificação.

Origem de uma associação e suporte de execução no alvo são informações distintas. Um trajeto declarado ou nó importado não recebe selo de efeito em runtime só por aparecer num cartão. Não introduzir percentuais fictícios de confiança ou usar animação visual do editor como telemetria do core.

### 3.3 Construção e uso repetido

| Situação | Comportamento planejado |
|---|---|
| Adicionar comportamento conhecido | Criar/atualizar identificação e grupo visual com os participantes e a origem da receita, na mesma ação de autoria. |
| Acrescentar/conectar nó manual | Recalcular a região afetada e atualizar a descrição. Associação incerta fica como sugestão/parcial; não mover nós deliberadamente posicionados por causa de uma hipótese. |
| Renomear objeto/recurso | Atualizar os nomes derivados por identidade. Preservar o título personalizado da regra. |
| Abrir projeto antigo | Oferecer projeção útil imediatamente, sem gravar a lógica ou migrar silenciosamente o projeto. A adoção de organização visual persistida é explícita e reversível. |
| Nó usado por várias regras | Mostrar referências/dependências compartilhadas. Não duplicar o nó ou a execução para que ele caiba em dois cartões. |
| Recolher, dar zoom ou filtrar | Alterar somente a apresentação. Não pausar a lógica, remover caminhos, trocar parâmetros ou reescrever a intenção. |
| Fixar posição ou personalizar título | Respeitar a autoria nas reorganizações seguintes. Uma opção explícita pode voltar ao nome/layout automático. |
| Remover participante ou trocar contexto | Invalidar a associação correspondente, conservar o dado desconhecido e descartar resultados atrasados de outra cena/revisão. |

## 4. Organização espacial e níveis de leitura

**Automático para conteúdo novo:** aproveitar a ação de criação/conexão/receita para posicionar novos blocos na região adequada, evitar sobreposições e estabelecer um título/associação. Reutilizar `layoutNodeGraph`, pins, caixas recolhidas e o histórico existentes.

**Estável para trabalho existente:** a engine não reorganiza tudo a cada tecla, frame, seleção ou rename. Conservar posições manuais/pins. Se um novo bloco não couber sem mexer no trabalho fixado, indicar o conflito e oferecer organizar a seleção/grupo. Organizar tudo continua uma ação explícita com Undo. Não sobrescrever grupos manuais com categorias inferidas.

**Vistas do mesmo grafo:**

- Visão geral/mapa de regras: intenção, participantes, gatilho/efeito e origem legíveis; busca e minimapa representam grupos com nomes.
- Visão intermediária: condições, ações principais, relações de dados e fronteiras entre grupos.
- Grafo completo/detalhe: todos os nós, campos, portas, ramificações, ciclos e conexões editáveis.

O zoom semântico adapta a densidade de informação; não é gravar `collapsed` ou apagar componentes ao afastar. Cabeçalhos mantêm legibilidade dentro do espaço disponível e a malha perde contraste. Em grafos grandes, priorizar seleção/foco/busca e usar agregação do minimapa; não prometer exibir centenas de títulos simultaneamente em 949×593. Preservar pan/zoom, retorno e acesso a todos os itens. Na implementação, o minimapa deve refletir limites geométricos e a área visível; uma lista navegável de grupos deve ser identificada como índice, sem simular um mapa espacial.

Cores e miniaturas são apoios; a relação textual e os participantes sustentam a compreensão. A vista detalhada mantém precisão. Se nó e Inspector exibirem o mesmo parâmetro, compartilhar o valor/modelo, indicar a superfície ativa de edição e evitar dois drafts concorrentes.

## 5. Navegação entre regra, cena e dados

- Clicar na regra enquadra seu conjunto de nós; abrir detalhe preserva a identidade selecionada.
- Ver participantes na cena destaca exatamente o que a regra consulta/afeta. Não pressupor que é sempre o herói. Escolher entre múltiplos alvos quando necessário.
- Selecionar um objeto na cena permite localizar regras que o modificam e regras que o consultam, com essas relações distintas.
- Busca por título, participante, efeito, recurso e identidade já suportada leva à ocorrência correta, incluindo grafos compartilhados. Não criar outra numeração instável nem misturar instâncias iguais pela aparência.
- A lista Participantes do mockup é um filtro contextual. Não substitui a hierarquia da cena nem a navegação global.
- Relações entre grupos distinguem fluxo de execução e dependência de dados. Uma linha de “lê variável” não se torna uma aresta executável nova.

O primeiro recorte deve funcionar no grafo/contexto selecionado. Visão agregada de outros grafos/cenas depende dos resolvers, escopo e orçamento de carregamento existentes; não carregar um projeto inteiro ou criar um índice global persistido para dar aparência de cobertura imediata.

## 6. Etapas propostas, após validação

| Etapa | Entrega na engine/editor | Critério para avançar |
|---|---|---|
| 0 — Contratos | Conferir catálogo, escopo, IDs, grupos manuais/gerados, política de título/posição, fixtures e linha de base. | Matriz tipo de nó → papéis → fonte → limite. Nome desconhecido permanece desconhecido; contrato de persistência visual compatível. |
| 1 — Associação genérica | Papéis semânticos no catálogo/owners existentes e projeção que amplia `ruleSummary`. | Mesmos padrões reconhecidos ao trocar nomes, assets, IDs e projeto; participantes/origem corretos; parciais explícitos. |
| 2 — Grupos e layout incremental | Associação ao construir, título automático, coexistência com grupos manuais, posicionamento de novos blocos e preservação de pins. | `graphSemanticSignature` preservada para operações visuais, sem perda de nós/arestas/ordem; Undo/Redo e save/reopen preservam autoria. |
| 3 — Apresentação legível | Cabeçalhos, níveis de leitura, grafo completo e minimapa de grupos no mesmo editor. | Identificar intenção/participantes na visão geral; editar parâmetros e fluxos no detalhe; nenhum recurso anterior perdido. |
| 4 — Ligações de contexto | Regra ↔ participantes na cena, busca e retorno; efeitos/consultas separados. | Alvo correto com instâncias/modelos compartilhados, contexto trocado e assets ausentes; nenhuma alteração autoral por filtro/navegação. |
| 5 — Validação cruzada | Regressões, uso repetido, Tauri nas resoluções previstas e evidência de conservação. | Critérios abaixo satisfeitos no incremento correspondente; limites restantes registrados. |

Não são seis frentes concorrentes. Integrar como sublotes da frente de coesão vigente, depois de aprovada a proposta, respeitando mudanças e fechos já em andamento. A aprovação visual orienta a implementação; não aprova contrato de dados ainda não testado nem concede merge/release/deploy.

## 7. Validação que distingue melhoria da engine de ajuste de template

O template atual entra como **um** caso. O aceite exige também:

1. Grafo com movimento de outro tipo de objeto, sem nomes Player/Hero/Nalu e sem usar imagem como chave semântica.
2. Regra de puzzle/interruptor com leitura e escrita em participantes diferentes; câmera e áudio com efeitos globais identificados.
3. Duas instâncias do mesmo recurso/modelo, regras compartilhadas e overrides, conservando escopo e contagens corretos.
4. Grafo manual com ramificações, ciclos, nós compartilhados e trecho sem semântica conhecida, sem resumo falso, clone de execução ou remoção de caminho.
5. Troca de nomes/IDs/ordem/asset com a mesma semântica e troca de semântica mantendo nomes parecidos, para demonstrar que não se está reconhecendo o template por texto.
6. Casos vazio, carregando, removido, origem externa e imagem ausente, com navegação por teclado e estado compreensível.

Casos sintéticos de unidades verificam a projeção; projetos autorais compatíveis e a jornada Tauri verificam uso real. Isso não autoriza anunciar suporte a um jogo/gênero/alvo inteiro.

Invariantes: organizar/navegar/zoom não muda a assinatura semântica; associação não confirmada não é apresentada como certeza; nomes personalizados e pins sobrevivem; nós compartilhados não se duplicam; resposta de outra revisão não é aplicada. A assinatura existente deve ser auditada quanto à cobertura dos metadados novos, e não substituída por uma comparação que ignore mudanças relevantes.

Medir análise por revisão, número de recálculos, tempo de interação/layout, memória e legibilidade, com conjuntos representativos de 37, 200 e 1000 nós. Esses tamanhos são cenários propostos, não benchmarks executados. Usar invalidação por revisão/participantes e carregamento limitado; não analisar o grafo a cada frame do emulador ou movimento de mouse. Registrar comparação com a linha de base e definir limites de desempenho a partir dessa medição, sem selo antecipado de 60 FPS.

No Tauri, validar 1366×768 e 949×593, tema/zoom apropriados, foco, teclado, nomes acessíveis, contraste real e movimento reduzido. Painéis contextuais podem recolher/encaixar, mantendo a navegação global e os acessos claros. Verificar ida/volta, edição repetida, Undo/Redo e reabertura. Para a parte puramente visual, comprovar conservação de nós/parâmetros/arestas. Se o incremento alcançar build/runtime, aplicar também Build→ROM→core e host:certify conforme AGENTS; não transferir prova de MD para outro alvo.

Avaliação humana proposta: localizar qual regra move um objeto, qual altera outro participante e qual depende de uma variável; entrar no nó correto e retornar. Comparar ações, hesitações e erros com a tela atual. Não há resultados humanos medidos nesta entrega.

## 8. Retenções antes da implementação

- Validar visualmente as duas vistas e a distinção entre mapa de regras e edição completa.
- Fechar escopo por origem/participantes, tratamento de nós compartilhados e coexistência de grupos manuais/derivados. Agrupamento visual atual tem uma participação exclusiva por nó; a projeção de regras pode referenciar o mesmo nó sem alterar esse contrato ou duplicá-lo.
- Confirmar quais novos metadados são derivados, quais são preferências de editor e quais precisam de serialização compatível; preservar projetos antigos sem reescrita automática.
- Definir comportamento em ambiguidade, branches/ciclos e código importado. Semântica não conhecida não pode ser inventada por nomes, cores ou proximidade.
- Não usar o mockup para atribuir execução a um nó ou tipo de objeto sem suporte no alvo. Telemetria de execução real, se futuramente exibida, precisa de prova separada.
- Resolver medições e limites no host antes de validar desempenho. Respeitar o protocolo de recursos, locks, bootstrap e a revisão atual do Memory Bank; nenhum build/teste pesado é necessário para aprovar esta proposta visual.

## 9. Mockups e limites desta entrega

Artefatos privados em `/home/misael/Shared/ProjectRuntime/RetroDevStudio/sessions/plano-auto-organizacao-logica-20261108/`:

- `01-mapa-regras-engine.png`: visão geral com participantes diversos e origens declarada/derivada/parcial.
- `02-grafo-completo-engine.png`: detalhe com nós, campos, portas, condições e relações; preserva a navegação global e as áreas relacionadas.
- `entrada-tela-real.png`, `prompts.json` e `manifesto.json`: referência fornecida, prompts imagegen e identidades dos arquivos.

As imagens são composições ilustrativas; conteúdos, contagens e valores são exemplos, não exportação reagrupada do projeto do operador. Os auxiliares Sem ação representam portas sem ligação, não operações novas. A intenção da vista detalhada é mostrar capacidade preservada, não certificar que todas as regras/parametrizações daquele exemplo foram compiladas. A miniatura do personagem é apenas um recurso visual ilustrativo e não uma condição do algoritmo.

Geração por imagegen embutido. As imagens selecionadas usam a arte original do mensageiro como ilustração e indicam proposta sem execução, sem selo de validação de runtime. Os originais da geração e prompts permanecem preservados. Nenhuma imagem sintética é evidência de Tauri, acessibilidade ou runtime. Cópias no mesmo filesystem, sem backup independente qualificado.

Diagnóstico fresco pelo launcher global: READY no recibo `sessions/2026-11-08T03-35-40-117Z-481326`. Não executados nesta etapa: build, suítes de produto, Tauri interativo ou provas de jogo, pois o pedido é avaliar e planejar antes de implementar. RAM disponível observada cerca de 3,5 GiB, sem atividade de swap na amostra final e PSI de I/O imediato zerado; nenhuma carga pesada foi adicionada. Orçamento de artefatos locais até 20 MiB, sem SDK/ROM/download grande.

## 10. Proposta de checkpoint para o Memory Bank

Os documentos compartilhados de estado já têm alterações de outra frente. Para preservá-las, esta tarefa propõe a integração posterior do seguinte checkpoint, sem modificar/stagear esses arquivos:

> 2026-11-08 — Auto-organização da lógica na engine/editor: operador pediu avaliação/plano e mockup antes da implementação. Plano em `studio_grafico/PLANO_AUTO_ORGANIZACAO_LOGICA_ENGINE_2026-11-08.md`, com associação genérica por semântica/origem/participantes, layout incremental e zoom legível, preservando o grafo completo e a navegação global. Dois mockups privados e prompts em `sessions/plano-auto-organizacao-logica-20261108/`. Proposta aguardando validação; nenhum produto/projeto de jogo alterado. Revalidar estado/owners e os contratos de grupos/escopo/persistência antes de implementar, dentro da frente sequencial vigente. Não anunciar reconhecimento universal nem capacidade de runtime por imagem.

Próximo passo desta tarefa: receber a validação/ajustes do operador sobre o plano e as duas vistas. A implementação permanece pendente dessa validação explícita, conforme o pedido.
