# Missão de auditoria integral — criar, importar, editar, testar e recuperar jogos

Prompt para o agente executor. Data: 2026-10-20. Este arquivo define trabalho futuro; não contém resultados de uma auditoria já realizada.

## 1. Objetivo e limite da missão

Percorra o RetroDev Studio real como alguém tentando criar e modificar jogos. Mapeie detalhadamente descoberta, estética, clareza, fluidez, coerência, acessibilidade, integridade dos projetos e efeito das edições na ROM. Registre pontos fortes, falhas e oportunidades, com imagens e passos reproduzíveis, e obtenha pareceres independentes de outros agentes.

O operador relata interface rudimentar e poluída, ações difíceis de descobrir, navegação quebrada e edições que podem quebrar o jogo. Trate esse relato como hipótese e contexto, não como conclusão obrigatória. Não transforme gates técnicos verdes em prova de boa experiência; também não invente defeitos para confirmar a reclamação.

Esta missão é de investigação e documentação. Não redesenhe, não corrija o produto durante a observação, não crie novas funcionalidades, não altere limites do compilador e não ajuste o app para facilitar seu próprio percurso. Propostas de correção virão em backlog verificável para uma missão posterior.

Uma IA não é um participante humano. Chame o resultado de **auditoria exploratória de jornada por IA com inspeção visual e funcional**. Não preencha a tabela de participantes humanos, não invente falas, sentimentos, satisfação, aprendizado ou resultados de usabilidade humana. Se houver sessão com uma pessoa, mantenha consentimento, protocolo e resultados separados.

## 2. Reconciliação, autorização e contexto de partida

Worktree conhecido: `/home/misael/Projects/REX-STUDIO-GRAFICO-2026-10-19`.

Branch conhecida: `codex/rex-studio-grafico-20261019`.

Checkpoint documental conhecido: `a8550af0`; produção conhecida: `ae0d66cd`. Confirme os SHAs completos e diferenças atuais. Não resete uma árvore que avançou, não troque de branch sem necessidade e não descarte arquivos não rastreados.

Aplicativo disponibilizado para teste:

- Atalho: `/home/misael/Área de trabalho/retrodev-studio-grafico-experimental.desktop`.
- Executável: `/home/misael/rds-scratch/studio-grafico-integrado-20261019/bin/retro-dev-studio-016`.
- SHA-256 esperado desse executável: `d37779583a4cf25dbc7a4dc22200c48d7bed900fcd65d1ee79e573aa37b782b8`.
- Demonstração editável: `/home/misael/Documents/RetroDevProjects/Demo_Studio_Grafico_Paletas/project.rds`.
- Referências visuais históricas: `/home/misael/rds-scratch/studio-grafico-integrado-20261019/references/`.

Esses pinos são ponto de partida, não uma alegação de que nenhuma mudança ocorreu. Audite a versão que o operador abre. Se o atalho, o executável e o código apontarem para versões diferentes, registre a divergência antes de decidir qual representa o objeto da auditoria. Não faça build silencioso para substituir a versão do usuário.

O fluxo anterior demonstrou fatias técnicas de MUGEN real, personagem/timeline, golpes autorais, som, HUD, cena, paletas, NodeGraph, inspeção e edição delimitada REX. Não demonstrou experiência humana satisfatória nem decompilação universal. Limites conhecidos incluem operações avançadas de paletas, texto legado, imagens acima de 16 cores, WINDOW/HUD, facing e cobertura por origem. Verifique o estado atual, sem copiar essas limitações como se fossem observações novas.

Leia `/home/misael/.codex/RTK.md` e prefixe os comandos com `rtk`. Leia `AGENTS.md` e suas fontes obrigatórias: Memory Bank, roadmap, árvore, diretivas, modo de agente e arquitetura REX quando aplicável. Siga os contratos de host, stack e compliance. Antes de executar um diagnóstico que regrave relatórios, preserve os relatórios históricos usados por manifestos existentes.

Use também os documentos de missão, mapa de requisitos, roteiro humano e handoffs do Studio como referência operacional. Os rótulos PASS anteriores são hipóteses de capacidade, não roteiro de cliques para a primeira passagem nem evidência nova.

Você está autorizado a criar projetos de auditoria, cópias privadas de entradas e documentos/imagens desta missão, executar o aplicativo, compilar jogos de teste pelos caminhos existentes e solicitar revisões independentes. Não está autorizado a alterar fonte de produção, dependências, configurações globais, resolução do operador, corpus original, atalho certificado, push, merge, release ou maturidade.

## 3. Organização sem poluição

Antes de capturar, descubra diretórios e convenções já existentes. Use a arquitetura canônica. Proposta de organização, ajustável se a árvore exigir:

```text
docs/studio_grafico/auditoria_20261020/
  README.md                         # entrada, escopo, versão e limites
  PLANO_E_COBERTURA.md               # inventário e destinos de cada tarefa
  JORNADAS.md                        # passos reais e links para evidência
  ACHADOS.md                         # fichas completas por ID
  PARECER_DO_AUDITOR.md              # avaliação do executor, com limites
  DIVERGENCIAS_E_SINTESE.md           # comparação dos pareceres
  BACKLOG_PROPOSTO.md                # problemas, dependências e aceites futuros
  HANDOFF.md                         # estado, pendências e reprodução

data/studio_grafico/auditoria_20261020/
  cobertura.csv
  achados.jsonl
  manifest.json
  revisoes/                         # pareceres sanitizados por revisor

/home/misael/rds-scratch/studio-audit-20261020-<id>/
  SESSION.md
  inputs/                           # cópias privadas, com origem e hashes
  projects/                         # projetos criados ou copiados para a auditoria
  evidence/<J-ID>/<passagem>/<tentativa>/
    events.jsonl
    screens/001-inicio.png
    screens/002-estado-seguinte.png
    captures/                       # vídeos/áudio quando necessários
    artifacts/                      # ROM/patch/log/estado privado
  reviewers/<revisor-id>/
  INDEX.html                        # galeria navegável local e legível
```

Não mantenha três registros manuais concorrentes: `achados.jsonl` deve ser a fonte estruturada; tabelas e índices devem ser derivados ou reconciliados com ele. Use IDs estáveis para tarefas, passos, achados, projetos, capturas e revisores. Cada achado pode apontar para vários percursos; não o replique para inflar a contagem.

Imagens contendo arte comercial, fontes MUGEN, ROMs, áudio e derivados ficam privados fora do Git. Versione somente documentos sanitizados, ferramentas mínimas de auditoria e metadados permitidos, por hash e identificador. A galeria privada deve mostrar as capturas reais e funcionar localmente, sem CDN ou serviço externo. Não publique ou envie imagens/corpus a terceiros.

Crie README e SESSION logo no começo. Registre checkpoints ao fechar cada jornada e antes de parar: o que foi feito, último passo, projeto, build, hipótese, arquivos e próximo comando. Não apague tentativas fracassadas; retenha evidência relevante, não toneladas de duplicatas sem índice. Limpe somente temporários seus que não sustentem achados, após registrá-los. Não encerre processos alheios pelo nome.

## 4. Método de observação: descoberta primeiro, investigação depois

Execute duas passagens por tarefa, mantendo-as identificadas:

**A — Descoberta pela interface.** Conheça apenas o objetivo e as entradas. Não leia o script de E2E, código ou sequência de seletores para descobrir onde clicar. Observe rótulos, ícones, menus e feedback. Antes de cada ação, registre qual controle parece corresponder à intenção e por quê. Não escreva uma justificativa retrospectiva depois de descobrir o caminho correto.

**B — Investigação informada.** Depois do primeiro impasse ou conclusão, consulte ajuda, documentação e, se necessário, fonte/testes. Identifique capacidades escondidas, rotas alternativas, causa técnica possível e diferença entre o que a UI promete e o que o produto suporta. Ajuda externa não apaga a dificuldade observada em A.

Não afirme que a IA se tornou novamente iniciante em tarefas seguintes: o aprendizado e o conhecimento prévio precisam constar no limite do método. Revisores independentes ajudam a reduzir esse viés, mas não substituem participantes humanos.

Use um orçamento inicial explícito de descoberta, por exemplo cinco minutos por subtarefa, sem tratá-lo como benchmark humano. Ao esgotar, marque `nao_descoberto_sem_ajuda`, capture o impasse e passe a B. Ajustes do orçamento devem ser registrados antes das próximas tarefas, não para reclassificar um resultado anterior.

Registre o tempo de interação separado de espera por importação, build, frames e host lento. Conte voltas, mudanças de workspace, ajuda consultada e correções do próprio executor sem converter esses números em produtividade humana ou frequência de defeito na população.

Uma falha do caminho principal bloqueia aquele caminho, não toda a auditoria. Documente-a e use uma cópia já preparada para investigar etapas posteriores, marcando-as como **entrada preparada / continuidade assistida**. Isso não transforma a jornada anterior em sucesso nem fecha a lacuna da UI.

## 5. Ferramentas, capturas e limites das provas

Audite o aplicativo Tauri real, no executável congelado. Use automação de interface nativa, WebDriver ou controle de desktop suportado para observar e interagir. Acesse o caminho real e os diálogos; não substitua o app por uma página localhost que imite sua aparência.

Prefira sessão de QA isolada com perfil/configuração separados. Preserve projetos e preferências do operador. Não injete cliques no desktop ocupado pelo usuário; use janela/sessão própria ou registre o bloqueio de acesso. Para fidelidade visual, registre display, escala, zoom, tema e tamanho da janela. Cubra 1280×800 e uma janela maior suportada; mudanças de resolução ficam dentro da sessão isolada. Examine o comportamento em uma janela reduzida e com ampliação quando tecnicamente suportado, sem alterar o sistema do operador.

Observe a tela e o estado fresco antes de agir. Clique nos controles visíveis, digite e arraste pelas rotas reais. Leitura de DOM para observar é permitida. Chamadas diretas a stores, IPC ou APIs para criar entidades, preencher estado ou pular diálogos não contam como autoria pela UI. Identifique qualquer instrumentação de QA habilitada e o que ela pode mudar. Não deixe uma ponte de automação ativa no launcher normal.

Capture início, decisões importantes, estados intermediários, todas as falhas, resultado e recuperação. Microações devem constar no diário; não é necessário produzir imagens idênticas para cada tecla. Cada passo significativo precisa de captura válida ou bloqueio nomeado.

Salve e abra cada captura antes de aceitá-la. Preserve screenshot bruto com a janela/contexto suficiente, versão, tarefa, passo, horário, dimensão e hash. Se mostrar janela errada, carregamento indevido ou corte acidental, rejeite e recapture; isso é diferente de capturar intencionalmente um defeito de carregamento ou layout.

Nunca gere ou retoque uma imagem para servir de evidência. Anotações e recortes são derivados identificados, com o bruto preservado; use marcações HTML sobre a imagem na galeria, sem substituir a captura original. A estética deve ser avaliada na imagem real, não em uma montagem imaginada.

Para perda de dados, comportamento, áudio, desempenho ou efeito na ROM, screenshots não bastam. Acrescente arquivos antes/depois, hashes, sequência de input, trace, observação do core ou gravação de áudio quando aplicável. Não trate evento de som no log como prova de áudio audível. Separe observação em RAM, framebuffer, canvas e som físico. Não faça diagnóstico causal de backend apenas pela aparência da tela.

Evidência principal precisa ser capturada nesta auditoria. Capturas e testes antigos servem de contexto e comparação, com rótulo histórico, sem virar execução nova. Não tome arte geométrica por prova de extração de personagem real. Identifique fonte, prévia, normalização e saída compilada do sprite usado.

## 6. Inventário: “tudo que existe” com denominador auditável

Mapeie menus, ferramentas, workspaces, editores, importadores, templates, atalhos, inspetores, fluxos de projeto, diagnóstico, execução e exportação realmente presentes no binário. Use primeiro a UI; após A, confronte com catálogo/código/documentação para encontrar superfícies que ficaram escondidas.

Para cada capacidade registre: caminho de entrada visível, objetivo, usuário pretendido, origem do conteúdo, plataforma suportada, projeto de prova, dependências, tarefa associada, resultado e limite. Estados de cobertura:

- `executado_sem_ajuda`, `executado_com_ajuda`, `continuidade_assistida`;
- `bloqueado_pelo_produto`, `bloqueado_pelo_ambiente`, `nao_descoberto_sem_ajuda`;
- `nao_executado`, `desabilitado`, `nao_implementado`, `fora_do_escopo_declarado`.

Não descreva planejamento do roadmap como funcionalidade existente. Um botão desabilitado exige examinar como comunica o motivo. Uma capacidade de biblioteca sem interface deve ser registrada como tal, sem simular que o usuário a utilizou.

Cubra todos os tipos de superfície encontrados com pelo menos uma tarefa ou impedimento explícito. Isso não exige todas as combinações de parâmetros nem todos os jogos do corpus. Meça cobertura de inventário separadamente do sucesso das jornadas; não transforme uma porcentagem de menus visitados em maturidade do produto.

## 7. Jornadas obrigatórias e incrementos de investigação

Use projetos distintos de auditoria, com checkpoints. Preserve um projeto cumulativo para revelar problemas de composição entre editores e projetos separados para isolar cada quebra. Não continue uma sessão corrompida como se fosse uma base válida.

| ID | Intenção dada ao executor | Cobertura mínima e resultado a procurar |
|---|---|---|
| J00 | Abrir o Studio e entender por onde começar | Launcher, primeira execução em perfil isolado, reabertura, idioma, exemplos, escolhas, avisos Experimental, dependências, ações primárias e estados vazios. |
| J01 | Criar um pequeno jogo a partir do que o Studio oferece | Escolher destino/template, nome/local, cena, personagem/objeto, comportamento simples, salvar, compilar, jogar e exportar. Registrar onde o app exige conceitos técnicos antes de explicá-los. |
| J02 | Importar um personagem MUGEN real para criar um jogo | Escolher fonte, análise, perdas/compatibilidade, opções, prévia reconhecível, importação, cena criada, relatório reabrível e primeiro build. Distinguir conversão original e comportamento autoral. |
| J03 | Criar ou adaptar um golpe | Encontrar animação, editar sequência e uma ocorrência repetida, duração, caixas corpo/ataque, evento de som, alvo, dano, retorno/condições suportadas. Testar com teclado e distinguir animação, colisão e dano reais. Não escolher apenas o botão já conhecido pelo auditor. |
| J04 | Animar e desenhar sem perder o contexto | Editor de imagem/personagem, pivô, zoom, onion skin e ferramentas disponíveis; seleção por quadro/ocorrência; copiar/reordenar/duplicar; editar quando dois quadros usam a mesma imagem; voltar à cena, desfazer, salvar/reabrir e comparar efeito. |
| J05 | Montar uma fase com cenário e colisão | Importar imagem/tileset pela UI, adicionar camadas, pintar/apagar tiles e colisão, posicionar instâncias, câmera, seleção, ordenação, visibilidade, limites e teste do cenário com o personagem. |
| J06 | Gerenciar paletas e fazer uma troca no jogo | Descobrir painel, cores/usos/reservas, usos navegáveis, compartilhar, variante local, edição de alcance, liberar um uso, conflito e bancos esgotados; troca por evento. Verificar o que a UI realmente permite e diagnostica. Operação inexistente é lacuna, não tarefa realizada por JSON. |
| J07 | Criar interface, texto e áudio contextual | HUD ligado ao estado, layout, legibilidade, câmera e faixa WINDOW, importar/pré-ouvir/sincronizar som, revisar falta de recurso, som durante execução. Diálogo, música ou outros editores entram se existirem; ausência deve ser delimitada. |
| J08 | Abrir um projeto pronto e criar em cima dele | Copiar o demo/template, entender hierarquia/modelos, duplicar personagem/objeto, distinguir local×compartilhado, editar modelo, renomear/mover/referenciar ativos, substituir imagem, desfazer/reverter e reabrir. Testar o risco de editar a evidência/projeto original por engano. |
| J09 | Construir comportamento no NodeGraph | Criar e ligar regra suportada, localizar propriedades, navegar entre canvas e inspector, organizar grafo, editar um valor, diagnosticar ligação inválida, entender chamadas opacas quando presentes, compilar e verificar o efeito no jogo. |
| J10 | Testar, inspecionar e voltar diretamente ao editor | Build & Run, input/foco, pausa/passo, câmera, BG/sprite/texto/colisões/áudio, elementos sobrepostos, clique→origem, ocorrência exata, Voltar, versão desatualizada, mudança temporária e aplicação explícita ao projeto. |
| J11 | Abrir uma ROM comercial e descobrir o que pode ser feito | BYOR em cópia privada, importação/identidade, inspeção, recursos detectados, sprite/fundo/paleta/sons/lógica conforme disponibilidade. Explicação de desconhecidos, consumidor/evidência e limites de perfil; nenhuma promessa de descompilação completa. |
| J12 | Editar uma recuperação suportada e testar a cópia | Escolher perfil real suportado, abrir nodes/asset, editar dentro do domínio, entender procedência e alcance, gerar cópia/patch, comparar e executar, preservar base, restaurar, salvar/reabrir. Use Sonic e outro título já suportado quando acessíveis pelo produto; não atribua generalidade por nome ou codec apenas. |
| J13 | Revisar e entregar o jogo | Lista de problemas, severidade, navegar à propriedade, erro×aviso, capacidade do destino, exportação da versão atual, identidade da ROM executada/exportada e reabertura do material salvo. |
| J14 | Recuperar-se de erros de edição normais | Cancelar importação, campo vazio/inválido, recurso ausente em cópia, colisão de paletas, referência alterada, edição fora de escopo, sair com alteração não salva, desfazer/refazer, erro de build e resultado antigo. Verificar se perde trabalho, contexto, histórico ou deixa jogar versão diferente sem clareza. |
| J15 | Usar as demais superfícies reais encontradas | Biblioteca/gerenciadores, ferramentas de imagem/efeito, console e diagnósticos, configurações, importação SGDK/outros formatos e outros destinos presentes. Para cada uma, tarefa simples e verificação, ou bloqueio justificado. Não requer inventar novos editores. |

Para um segundo destino como SNES, examine o que o produto oferece e como apresenta as diferenças, somente se o host e entradas já forem suportados. Não provisione uma plataforma nova nem prometa paridade. Serviços que precisem de conta, custo ou credencial ficam bloqueados com motivo; não use segredos encontrados no sistema.

MUGEN e REX precisam de rotas de descoberta reais, além de exemplos preparados. Se a tarefa só puder começar com offsets, script externo ou estado previamente preparado, isso deve aparecer como custo da jornada. Não esconda intervenção técnica atrás do rótulo “importar/decompilar”.

## 8. Perguntas a responder em toda tela e transição

Anote detalhes concretos, inclusive pequenos defeitos repetidos, sem limitar a auditoria à lista abaixo:

- **Descoberta:** consigo entender a próxima ação pelo rótulo e posição? Preciso adivinhar ícone, duplo clique, botão direito ou procurar um menu fora do contexto?
- **Hierarquia:** existe ação primária clara? Painéis competem, texto técnico domina, parâmetros avançados aparecem antes do básico, controles de teste e edição se confundem?
- **Visual:** tipografia/tamanho, contraste, densidade, alinhamento, espaçamento, ícones, estados de hover/foco/seleção, truncamento, scroll, consistência de cores e duplicação de informações. “Rudimentar” precisa virar observação localizada e impacto, não gosto pessoal.
- **Contexto:** qual projeto/cena/entidade/animação/quadro/instância/modelo estou alterando? O alcance está visível antes da ação? Voltar preserva seleção, zoom e posição?
- **Manipulação:** alças, campos, seleção, arrastar, precisão, atalhos, unidades e prévia ajudam? O teclado vai para o campo ou indevidamente ao jogo? Há mudança de valor silenciosa?
- **Feedback:** carregamento, progresso, cancelamento, sucesso, erro, compilação necessária e build em execução são reconhecíveis? Um aviso explica consequência e próximo passo?
- **Integridade:** um gesto comum destrói dados ou altera outros usos? É possível prever, desfazer, restaurar ou rejeitar sem gravar? O app diferencia gravação, prévia e ROM?
- **Coerência:** a mesma intenção tem nomes, local e comportamento diferentes entre editores? Há fluxo duplicado ou propriedade que parece editável e não afeta o jogo?
- **Acessibilidade:** navegação por teclado, ordem de foco, rótulos, tamanho de alvo, informação apenas por cor/hover e zoom. Não declarar conformidade completa sem teste específico.
- **Jogabilidade:** a alteração continua compilável e jogável? Input, animação, dano, colisão, texto, cenário, paleta e áudio correspondem à intenção visível? Uma limitação do destino foi explicada antes da edição?

Teste separadamente ações normais e sondas deliberadamente inválidas. Registre intenção, valor anterior e novo, alcance esperado e efeito obtido. Para quebra do jogo, distinga erro impedido antes do build, build que falha com diagnóstico, ROM que falha, efeito errado, perda de dados e erro do instrumento.

## 9. Registro estruturado por passo e por achado

No diário de eventos, registre: sessão, tarefa, passagem A/B, tentativa, projeto/checkpoint, build/hash, passo anterior, objetivo, ação pela UI, rótulo/posição, ajuda usada, resultado, tempo de interação/espera, evidências e próximo estado. Registre a primeira tentativa mesmo que ela dê errado.

Cada achado precisa destes campos, com `nao_medido` ou `nao_aplicavel` quando necessário:

```json
{
  "id": "UX-0001",
  "titulo": "Descrição concreta do problema ou oportunidade",
  "tipo": "defeito|friccao|visual|acessibilidade|integridade|documentacao|oportunidade",
  "tarefas": ["J03"],
  "passagem": "A",
  "passos": ["J03-S007"],
  "projeto_id": "P03",
  "build_sha256": "...",
  "origem": "autoral|mugen|rom_comercial|template",
  "intencao": "O que se pretendia fazer",
  "observacao": "O que de fato aconteceu, sem atribuir causa não demonstrada",
  "expectativa_e_fundamento": "O que a própria UI ou requisito leva a esperar",
  "reproducao": ["Passo visível e dado de entrada suficiente"],
  "evidencias": ["EV-J03-007"],
  "efeito_no_usuario_ou_projeto": "Consequência observável",
  "escopo_afetado": "Uma ocorrência, todos os usos, cena, build etc.",
  "severidade": "P0|P1|P2|P3",
  "confianca": "observado|reproduzido|hipotese",
  "repeticao_observada": "1/1; não estima frequência da população",
  "recuperacao": "Como recuperou ou por que não recuperou",
  "hipotese_tecnica": "Separada do fato; pode ser desconhecida",
  "alternativas": ["Solução possível e tradeoff; não implementação"],
  "aceite_futuro": "Como verificar que uma correção resolveu a tarefa",
  "relacionados": [],
  "status": "aberto|contestado|necessita_evidencia|nao_reproduzido|superado"
}
```

Severidade por consequência, não por tamanho do patch: P0 para perda/corrupção grave, alteração da base ou risco crítico; P1 impede tarefa central ou produz resultado materialmente errado; P2 causa retrabalho/ambiguidade/fricção relevante com recuperação; P3 é refinamento localizado. Separe severidade, confiança, recorrência observada e esforço estimado. Um problema visual pode ser P1 se impedir a tarefa.

Não classifique uma oportunidade nova como defeito de funcionalidade prometida sem fonte. Não reduza a severidade de um problema apenas porque existe um caminho escondido que um desenvolvedor conhece. Registre também capacidades que funcionam bem, para proteger esses comportamentos em futuro redesenho.

## 10. Pareceres independentes: protocolo obrigatório

Monte um pacote neutro, imutável e hash-pinado com objetivos, versão, entradas, passos reais, capturas aceitas, gravações e observações brutas. Não inclua nele o parecer do coordenador, severidades propostas, soluções preferidas nem conclusões dos outros revisores. Não peça aos revisores para confirmar a avaliação de ninguém.

Solicite pelo menos **dois pareceres independentes**, preferencialmente três com lentes distintas. Se houver ferramenta de subagentes, você pode delegá-los com contexto inicial separado, somente o pacote neutro e a missão do revisor. Caso contrário, entregue os prompts e os pacotes prontos para agentes em sessões separadas, marcando a revisão como pendente. Não simule três autores usando a mesma sequência de raciocínio e não anuncie consenso sem revisões reais.

Revisores podem trabalhar em paralelo sobre o pacote congelado. Ninguém modifica produto, projetos originais ou evidência alheia. Replays, quando necessários, usam cópias e sessão próprias, em agenda serial para não disputar app/core/host. Cada um escreve em sua pasta; só o coordenador consolida.

Cada revisor deve: inspecionar as imagens, identificar o que conseguiu ou não avaliar, produzir observações próprias antes de ler achados alheios, citar IDs de evidência, apontar contraexemplos e classificar severidade/confiança. Screenshot não demonstra automaticamente áudio, perda de dados ou efeito causal.

Use estes três prompts de revisão, preenchendo pacote e pinos:

> **Revisor A — descoberta e fluxo.** Você recebe um pacote neutro de tarefas do RetroDev Studio. Sem ler o parecer do executor ou outros revisores, examine objetivos, passos, imagens e registros. Avalie se um criador consegue descobrir, completar e recuperar as tarefas; continuidade entre cena, personagem, ações, teste e entrega; escopo local/compartilhado e carga de conceitos técnicos. Produza achados próprios com evidência, forças preserváveis, limites, confiança e severidade. Não implemente, não confirme uma tese recebida e não alegue validação humana. Entregue revisão assinada por ID e SHA do pacote.

> **Revisor B — visual e acessibilidade.** Inspecione o mesmo pacote sem conclusões alheias. Avalie hierarquia, densidade, tipografia, legibilidade, espaçamento, consistência, alvos, estados, foco e dependência de cor/hover. Separe gosto pessoal, risco visual e bloqueio observado. Cite tela/região e consequência na tarefa; explicite o que exigiria teste de teclado/leitor de tela. Não desenhe uma nova interface nesta revisão nem gere imagens como se fossem evidência. Entregue parecer próprio e SHA do pacote.

> **Revisor C — confiança, integridade e criação de jogos.** Examine sem conclusões alheias o caminho intenção→edição→persistência→build→execução→exportação. Avalie modos de quebrar o projeto, alterações compartilhadas, desfazer/reverter, compatibilidade, paletas, referências, limites MUGEN e REX, e coerência do artefato exportado. Diferencie falha do produto, limitação declarada, intervenção do teste e hipótese sem prova. Não use código como substituto de jornada. Entregue achados e contraexemplos com evidência, confiança, severidade e SHA do pacote.

Depois dos pareceres fechados, forneça o registro de achados do coordenador para uma segunda rodada de confronto. Cada revisor pode concordar, discordar ou pedir evidência; a opinião original continua preservada. Concordância não apaga os limites comuns da captura.

Na síntese, registre ponto a ponto: autores, evidência comum, onde discordam sobre fato, severidade ou solução, qual teste pode arbitrar e o que continua aberto. Não tire média numérica de opiniões para resolver uma divergência factual. Preserve parecer minoritário fundamentado; uma interpretação do coordenador não é decisão final do operador.

## 11. Entregáveis e forma de apresentação

Entregue um conjunto que outro agente e o operador consigam explorar sem conversar com você:

1. **Resumo executivo:** o que hoje é viável criar, as principais quebras de jornada, o que é risco real versus suspeita, pontos fortes e limites da avaliação por IA.
2. **Mapa completo de cobertura:** toda superfície inventariada tem tarefa, resultado, evidência ou impedimento; totais com denominadores explícitos e sem contar arquivos ausentes como corridas.
3. **Jornadas numeradas:** objetivo, entrada, passos realmente feitos, imagens em ordem, saúde de cada etapa, ajuda, falhas e recuperação. As imagens precisam estar visíveis no relatório/galeria, não apenas citadas numa pasta.
4. **Registro completo de achados:** fichas legíveis e fonte JSONL validada; relações entre problemas repetidos e IDs estáveis.
5. **Galeria HTML local:** índice por jornada, captura original ampliável, anotações separadas, achados associados e filtros simples por tipo/severidade/estado, sem dependência nova ou serviço externo. Confira links, imagens e acentos abrindo o resultado.
6. **Parecer do executor e revisões independentes:** preservados, assinados por ID, escopo e pacote; síntese de concordâncias/divergências e solicitações de evidência.
7. **Backlog proposto:** causa observada, objetivo do usuário, prioridade sustentada, dependências, alternativa de solução, riscos de regressão e critério de aceite futuro. Separe correção de perda de dados, reorganização de fluxo, apresentação visual e capacidade nova. Não proponha refazer o app inteiro por padrão.
8. **Continuidade:** HANDOFF, registro de sessões, manifesto com hashes e esquema, índice de entradas privadas, comandos, limitações e próxima ação. Ausências e falhas ficam explícitas.

O backlog deve propor fatias completas de tarefa, como “importar personagem e criar/testar um golpe sem sair do contexto”, e não somente uma lista de botões a retocar. Compare caminhos de simplificação e mudança mínima; preserve funcionalidades que já funcionam. Quando recomendar ocultar conteúdo avançado, explique como o usuário experiente ainda o acessa.

## 12. Critérios de término e disciplina

A auditoria está pronta para avaliação quando: inventário reconciliado; jornadas obrigatórias com resultado ou bloqueio; todas as afirmações relevantes com evidência inspecionada; achados deduplicados e reproduzíveis; galeria navegável; integridade dos projetos-base conferida; revisões independentes executadas ou claramente pendentes com pacotes prontos; divergências preservadas; limites explícitos e handoff reproduzível.

Não há meta de quantidade de achados. Não pare ao encontrar os primeiros problemas, nem insista indefinidamente na mesma tela. Continue as partes independentes quando houver um bloqueio e mantenha cobertura honesta. Atualize o operador com descobertas e próximos passos, não apenas contagem de ferramentas.

Use as verificações apropriadas aos artefatos criados: estrutura da árvore, esquema de JSON/JSONL/CSV, hashes, referências de evidência, links e renderização da galeria. Não execute uma bateria inteira de build/testes do produto para substituir esta auditoria e não use o certificado anterior como avaliação de UX. Se uma ferramenta de auditoria exigir mudança de fonte de produção, registre o bloqueio e escolha um caminho de observação existente; não altere o produto nesta missão.

Ao encerrar, proponha ou registre um checkpoint factual no Memory Bank conforme as regras do projeto, sem alterar decisões arquiteturais ou maturidade. Preserve o handoff não rastreado de retomada e outros arquivos do operador. Sem push, merge ou publicação externa.

Relatório final curto no chat: versão auditada, cobertura efetiva, principais riscos, lacunas, quantas revisões de fato ocorreram, divergências relevantes e links absolutos para a galeria, achados e pacote. Não declare “jornada humana validada” e não conclua que uma ROM comercial pode virar outro jogo inteiro a partir de perfis delimitados.
