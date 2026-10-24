# Reavaliação da retomada — 2026-10-24

Esta é uma reconciliação documental e de código com inspeção de capturas históricas fornecidas, não uma nova sessão GUI, certificação ou estudo humano. Nenhuma fonte de produção foi alterada nesta avaliação.

## Base e correção do resumo anterior

- Remoto consultado: `recovery/studio-preformat-20261021` = `87b6b7fd5e3dacdd93eb30d5e25a9570d00ce769`.
- Worktree original: `REX-STUDIO-GRAFICO-2026-10-19`, HEAD `a8550af0e0bdd74c44478f94d301576b988747a1`; três handoffs não rastreados permanecem preservados. A pasta `/mnt/sdcard/Projects/RetroDevStudio` não é esse checkout Git.
- Auditoria atual: `studio-audit-20261020-01`, handoff checkpoint 16, coverage de 16 jornadas. Os hashes atuais de coverage, achados, handoff, backlog e sessão coincidem com o backup `project-data-v4`.
- O resumo de migração anterior ficou incompleto ao apresentar a auditoria como se não tivesse chegado a Build/ROM/emulação. LOT028 documenta edição, salvar/reabrir, Build & Run, verificação e exportação; LOT031 acrescenta execução da ROM e retorno ao editor. Isso não fecha as 16 jornadas nem estabelece causalidade do input por evento/frame. Corrigir os resumos por adendo datado, preservando os lotes.

## Capacidade e limite por frente

| Frente | Capacidade sustentada | Limite relevante à retomada |
|---|---|---|
| Host, SGDK/PVSnesLib, build e emulação | Pipeline e certificações históricos; J01/J08 possuem builds/executáveis/exportações observados | Ambiente reinstalado ainda precisa de diagnóstico/certificação; READY, artefato compilado, execução atual e teste de gameplay são estados distintos |
| Studio Gráfico | Cena, animação por ocorrência, caixas, texto, paletas, modelo/instância, inspeção e retorno têm provas técnicas delimitadas | Percurso exploratório permanece parcial, com navegação, densidade, mensagens e descoberta de ações a corrigir |
| MUGEN | Ken real possui fluxos técnicos anteriores; LOT025 comprova importar, editar, salvar/reabrir | Dois builds da configuração auditada falham em atlas de 177192960 px, acima da guarda de 67108864; causa deve ser isolada, não atribuída automaticamente ao hardware ou solucionada elevando o teto |
| Nodes e comportamento | Autoria/código/runtime e recuperação em classes delimitadas têm provas | LOT029 adicionou nós desconectados do fluxo original e não provou ataque; integrar edição, persistência, geração e efeito. Não converter uma prova pequena em conversão integral de CNS |
| REX gráfico/comercial | Edição/patch/reversão e episódios medidos em Sonic, Streets of Rage e Golden Axe sustentam capacidade além de um jogo | Perfis, regiões e episódios delimitados; LOT024 não observou efeito visual no recorte. Não é recuperação completa de jogo |
| A/B/C/D/F de pesquisa | Endereçamento, codecs, consumidores, CFG, instrumentos, holdouts e revisões são bases úteis; retificações melhoraram precisão | Compartilhar codec não identifica recurso, estrutura não prova consumo, amostras não provam universalidade; recuperar branches de pesquisa pelo bundle, sem merge automático |
| REA | Normalização/adaptação e reconstruções regionais demonstradas; pesquisa e ponte curada | REA pinado recusava raw M68000; backend compatível 68020 não equivale a qualificação exata 68000. Não há decompilação completa geral |
| Áudio | Há reprodução autoral testada e pesquisa estática de drivers | Extração/reconstrução de áudio comercial geral continua separada e não demonstrada |
| Outros importadores/plataformas | Há superfícies e matrizes no repositório | Não foram certificados novamente nesta revisão; não ampliam automaticamente a cobertura Mega Drive ou de outros destinos |
| UX e revisores A/B/C | Cobertura, imagens, pareceres e erratas preservados | Todos os 16 registros de cobertura continuam parciais; revisões do mesmo lote não são três execuções independentes ou testes humanos |

## Evidências que devem orientar a implementação

1. LOT028: ROM de 393216 bytes, SHA `ca0d321bdc17ed07da0956d14f37bbba3c8f439ca704d115165607b61e864b52`, build/export iguais; Review ainda mostra “ainda não executado”.
2. LOT025: atlas MUGEN bloqueado duas vezes. Investigar identidade dos insumos, escolhas de importação, normalização, dimensões/eixos, duplicação e empacotamento. Não descartar os sucessos anteriores nem mascarar este bloqueio.
3. LOT029/030: guards MUGEN impedem o percurso; parte deles antecede a edição observada. Não atribuir causa ao novo nó, paleta ou Java sem reprodução.
4. LOT031: deslocamento visual compatível com Right; ACK não prova consumo por frame e a soltura não está causalmente isolada.
5. LOT030/J14: UI dirty após Undo e disco anterior até Salvar não é, por si, corrupção; verificar o contrato e a clareza do estado. A mensagem stale do LOT006 continua um candidato separado.
6. REX LOT024: base preservada/cópia e BPS produzidos, sem efeito visual medido. Não rebaixar nem promover os episódios históricos independentes com base neste recorte.
7. A tabela antiga de requisitos tem limites superados por adendos. Ler a rodada 4 antes de declarar o antigo defeito PAL0 ou HUD como ainda existente.

## Base arquitetural já existente

`src/core/studioContext.ts` define tarefas, foco, ocorrência, evento, caixa, retorno e câmera, usando o `editorStore`. `editorStore.ts` já contém navegação contextual e histórico; existem também setters diretos que exigem inventário de uso antes de mudar contratos. `runtimeLink.ts` registra identidade da ROM, assets, ocorrências, caixas/eventos, epoch e quadro. `palettePlanStore.ts` e os serviços existentes devem ser reaproveitados.

Esses elementos são base de integração, não prova de que todas as rotas já os usam corretamente. Não criar outro megastore, pipeline de build ou editor paralelo.

## Direção

Executar uma frente sequencial de coesão do produto: reconciliar e reproduzir → fechar contexto/revisões/diagnóstico → entregar vertical autoral → corrigir e entregar vertical MUGEN real → simplificar apresentação e travessia de editores → regressões, vertical REX delimitada e observação humana. Fazer mudanças pequenas completas, sem uma reescrita geral ou outra rodada interminável de auditoria.

O prompt operacional está em `PROMPT_RETOMADA_COESAO_PRODUTO_2026-10-24.md`, neste mesmo diretório.
