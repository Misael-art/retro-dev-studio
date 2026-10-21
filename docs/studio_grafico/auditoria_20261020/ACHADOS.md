# Achados da auditoria

Status: reconciliado com os pareceres independentes A/B/C do LOT006. Os itens abaixo são evidências de uma passagem automatizada exploratória e não representam avaliação humana. Severidades indicam impacto observado na tarefa e não atribuem causa raiz ao produto.

## Candidatos

| ID | Jornada | Leitura atual | Confiança | Evidência |
|---|---|---|---|---|
| F-J14-01 | J14 | A mensagem de erro de duração permaneceu depois da correção para 5 e da troca de ocorrência; sair e reabrir limpou o aviso, mas a seleção voltou a action_0/ocorrência 1. | Um teste exploratório; os três revisores convergiram. P2 para impacto no fluxo; repetir. | LOT006-J14-035–040 |
| F-J06-01 | J06 | O seletor mostrou duas opções chamadas Dano; a aplicação foi recusada por índice [15] ausente e banco cheio. JSON tem IDs dano/dano_2 com o mesmo nome. | Os três revisores convergiram. P2 para ambiguidade/bloqueio observado; sem runtime. | LOT006-J06-006, 008 |
| F-J04-01 | J04 | Editar modelo — 2 usos não produziu transição visível nas tentativas registradas. | A/B classificam o bloqueio na tarefa como P2; C confirma o estado e mantém a causa aberta. Não prova editor ausente. | LOT006-J04-007, 008 |
| F-J12-01 | J12 | Reverse Workspace e Asset Extractor ficaram selecionados sem transição observável nos estados testados. | A/B classificam o bloqueio na tarefa como P2; C ressalta falta de entrada elegível. | LOT006-J12-011, 012 |
| F-J03-01 | J03 | Mensagem verde ainda cita alteração da ocorrência 1 quando a ocorrência 4 está selecionada. | R-B observou; risco visual P3 para reproduzir. | LOT006-J03-028, 033 |
| F-J07-01 | J07 | AU aparece como cabeçalho e pode ser confundido com rota; nenhum workspace de áudio foi aberto. | A/B apontam descoberta candidata P3; nenhuma inexistência de editor foi confirmada. | LOT006-J07-014, rail zoom |
| F-VIS-01 | J03–J14 | Painéis estreitos e mensagens longas podem reduzir leitura rápida em 1280×800. | R-B apontou risco visual P3; uma resolução/passagem. | LOT006-J05-018, J12-009, J13-001, J14-002 |

## Bloqueios, sem atribuição ao produto

- E-J13-01: Runtime Setup exibiu falha de preparação de dependência oficial, referência a /usr/sbin/java e saída 10 do orquestrador. Não houve reparo ou build que estabeleça causa.
- E-J11-01: não havia entrada BYOR com origem imutável e SHA-256. Nenhuma ROM comercial foi aberta.
- E-LINEAGE-01: hash-base da cena e hash pré-abertura J03 divergem; snapshots citados pelo log não estão no LOT006. A contagem de 81 arquivos foi estruturalmente reconciliada no estado atual (79 no projeto + 2 índices), mas o inventário congelado não enumera caminhos.

## Observações que não são defeitos confirmados

- J10: Play não mostrou transição; Rodar no Emulador foi seguido por Debug/Runtime Setup, mas a causa da mudança não foi determinada. O estado continuou sem ROM e idle.
- J05: a criação acidental de Texto 2 foi erro de coordenada do executor, desfeito com Ctrl+Z e salvo na cópia privada; não é achado de produto.
- J05-018: a suspeita inicial do revisor C foi retirada por erratum após segunda leitura. A captura mostra seis entidades e Inspector Ken Masters; não usar a interpretação inicial de sete/Texto 2/ROUND 1.
- J03: Add Sound abriu seletor nativo; foi cancelado sem importar áudio. Duração/caixa de ataque foram alteradas na cópia, sem validação de runtime.
- J14: o save reserializou scenes/main.json. Como o conteúdo pré-probe não foi preservado como arquivo, não se pode afirmar identidade binária pré/pós; os valores de duração inspecionados permaneceram válidos.

## Referências

- Evidência congelada e revisável: [LOT006](review-lots/LOT-006-J03-J07-J12-J14-A-20261020T120751Z/package.md)
- Índice visual local: [galeria](gallery/index.html)
- Rastreamento completo por jornada: [coverage.csv](coverage.csv)
- Pareceres e convergências: [REVISOES_INDEPENDENTES.md](REVISOES_INDEPENDENTES.md)
- Correção de cadeia e errata: [ERRATA_CADEIA_LOT006.md](ERRATA_CADEIA_LOT006.md)

## Atualização LOT012/LOT013 — candidatos adicionais, causa em aberto

| ID | Jornada | Observação verificável | Leitura atual | Evidência e limite |
|---|---|---|---|---|
| F-J01-02 | J01 | O snapshot do grafo salvo contém input ligado ao movimento, mas o mapa do Build aponta para o hash do grafo anterior e o C gerado não tem ramo de controle. | Gap de integração candidato; alto impacto na tarefa observado por R-C; causa não isolada. | LOT012, reviewer-C-integrity.md C1, project-after-key-mapping e mapa de origem. |
| F-J02-02 | J02 | A importação integral MUGEN ficou em “Verificando”; Cancel não recuperou o assistente. | Bloqueio do fluxo Experimental observado; A/C divergem em severidade; rotina/arquivo causador desconhecidos. Importar ken.cmd 76 comandos é contraexemplo de rota parcial, não importação integral. | LOT012 J02-001/002; capturas 155/158/159/365. |
| F-J08-02 | J08 | ROM hash cf0c6631… repetiu ADDRESS ERROR em dois builds sem edição. Um build posterior em snapshot/hash distinto (08888b…; LOT013) carregou sem esse erro. | Erro reprodutível naquele hash/cópia, não generalizado; causa aberta. | LOT012 J08-002/003; LOT013 J03-013; ambos os hashes e cópias preservados. |
| F-J13-02 | J13 | UI resumiu 7/7 instaladas nas duas condições; readiness foi READY com Node 24.18/npm 11 e DRIFTED com Node 26.8/npm 12 no override; JDK Temurin 21 e SGDK 2.11 estavam presentes. | Divergência de escopo/legibilidade candidata (A/C); B encontrou colisão visual inequívoca. Não alegar Java ausente nem causa no produto. | LOT012 J13-001/002, relatórios pareados e capturas 240/249. |
| F-J03-02 | J03 | Attack [1,4], duração [6,1] e hitbox 10×8 persistiram na cena; Build gerou ROM, mas Game Workspace não mostrou ataque/movimento inequívoco. runtime-link mostra `occurrence_boxes={}`; main.c chama `SPR_setAnim(...,0)`. | Gap de integração candidato; A/C confirmam artefatos e limite; causa do comportamento não estabelecida. | LOT013 events 7–14; artifacts/build-observation.json; project-work/build e snapshots. |
| F-VIS-02 | J03 | Cartões de sequência ficaram fora da área útil até expandir Timeline e colapsar Comandos. | Risco visual candidato confirmado por R-B; resolução única, sem inferência de paridade. | LOT013 048–057, 073–078; reviewer-B-visual.md. |

### Bloqueios e limites sem atribuição ao produto

- LOT013: o processo inicial encerrou inesperadamente sem coredump durante resize de timeline; uma observação, causa desconhecida.
- O seletor GTK de pastas mediu 1203×902 contra tela 1280×800; resize expôs botões e permitiu selecionar a cópia. Contexto específico; sem atribuição causal ao produto.
- Apply durante execução antiga não deixou confirmação visível. Depois de Stop, a cena salva continha os novos campos; não é possível atribuir o resultado ao clique isolado.
- Build exibiu alerta VRAM 0KB com 1 sprite no status. Não há teste causal com o erro anterior.
- LOT012 J13: eventos e timestamps dos screenshots normal/override entram em conflito; os estados individuais são suportados, a ordem permanece não reconciliada.
- Computer Use segue não qualificado: todas as interações novas usaram xdotool/ImageMagick, não Computer Use nem participação humana.


### Leitura dos revisores LOT013

A/C corroboram a persistência dos campos de Attack e o build/carregamento, mas não demonstram golpe em jogo. B confirma o custo de resize/scroll e a diferença visual da trilha GUIADO nesta cena; não há base para concluir paridade dos modos. C adiciona limites de proveniência do lote (binário, timestamps, log bruto e assinatura do pin ausentes). Esses itens limitam a auditoria da aquisição e cronologia, sem apontar divergência material entre os hashes e snapshots verificados.


## LOT031 — J08 input e retorno do playtest

| ID | Observação verificável | Leitura e confiança | Evidência e limite |
|---|---|---|---|
| O-J08-INPUT-01 | Enquanto pausado, `input ACK` aumentou de 0 para centenas sem alteração do contador de frames; após `Step 1 frame`, não houve deslocamento visual discernível. Durante a execução com Right, uma captura mostra o Player perto da borda direita; Stop retorna à Cena e o Player reaparece na posição editada. | O deslocamento é visualmente compatível com o hold de Right; não demonstra causalidade por evento/frame, a unidade do ACK ou o instante de keyup. Não é defeito confirmado. | LOT031 screenshots 26–31 e DOMs; snapshots do projeto têm os mesmos 26 caminhos/hash pré e pós. Revisões A/B/C e limites em `ERRATA_LOT031_RECONCILIACAO_REVISOES.md`. |

As quatro capturas de modo usam a mesma cena/seleção em 1280×800. GUIADO mostra trilha de cinco etapas; CRIADOR/PRO/HACKER mostram “Cena ativa” e mais trilhos técnicos, com texto lateral estreito. O recorte não sustenta conclusões sobre facilidade humana, paridade total ou acessibilidade. O lote não fez Build novo; usa a ROM já construída e exportada no LOT028.
