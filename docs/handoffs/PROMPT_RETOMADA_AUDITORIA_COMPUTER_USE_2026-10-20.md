# Retomada obrigatória da auditoria — Computer Use e execução das jornadas

Complementa `PROMPT_AUDITORIA_INTEGRAL_JORNADA_2026-10-20.md`, sem reduzir seu escopo. Pedido do operador: executar a auditoria de verdade com ferramenta visual de interação. Não é uma nova missão de preparação e não autoriza alterar o produto.

## 1. Ponto de retomada e correção do status

Leia o prompt integral e os arquivos já existentes:

- Worktree: `/home/misael/Projects/REX-STUDIO-GRAFICO-2026-10-19`.
- Auditoria: `/home/misael/rds-scratch/studio-audit-20261020-01/`.
- Checkpoint: `SESSION.md` e `README.md` nessa pasta.
- Executável: `/home/misael/rds-scratch/studio-grafico-integrado-20261019/bin/retro-dev-studio-016`.
- SHA-256 esperado: `d37779583a4cf25dbc7a4dc22200c48d7bed900fcd65d1ee79e573aa37b782b8`.
- HEAD conhecido: `a8550af0e0bdd74c44478f94d301576b988747a1`.

Reconfira a árvore e preserve os handoffs não rastreados do operador. Não reinicie a cópia dos projetos, o inventário de hashes ou a documentação básica se estiverem íntegros.

Há **16 jornadas, J00 a J15**, no prompt integral. O relatório anterior que falava em 15 está incorreto. Até o checkpoint anterior, existe somente preparação e captura inicial de J00; nem J00 foi concluída. Duas capturas com o mesmo hash não provam que houve interação ou que um defeito foi confirmado.

O processo 3351405 era o app da auditoria, no Xvfb :99; revalide PID, executável e starttime antes de qualquer ação. Não conclua que um PID ainda pertence à missão só porque existe. Preserve capturas anteriores como tentativa inicial, sem promovê-las a jornada executada.

## 2. Ferramenta visual: uso comprovado antes de prosseguir

Use o conector **Computer Use**, quando disponível nesta sessão, para observar e operar o aplicativo desktop real. Descubra as ferramentas efetivamente expostas, leia seus contratos e não invente nomes ou argumentos.

Na sessão que preparou este adendo, estavam expostas:

- `mcp__computer_use__get_app_state`;
- `mcp__computer_use__list_windows`, `focused_window`, `activate_window`;
- `mcp__computer_use__screenshot`;
- `mcp__computer_use__click`, `type_text`, `press_key`, `scroll`, `drag`;
- `mcp__computer_use__perform_action`, `set_value`, `doctor`.

Podem aparecer com prefixos diferentes em outra ferramenta/orquestrador. Use os nomes realmente disponíveis.

O preflight executado nesta sessão chamou `get_app_state(pid=3351405, include_screenshot=false, verbose=true)` e `list_windows`. O diagnóstico reportou AT-SPI, KWin e backends de input; também reportou **No window matched pid 3351405**. A listagem KWin não apresentou janela RetroDev. A ferramenta está no desktop KDE/Wayland :0; a aplicação anterior está em outro display, Xvfb :99. A detecção de um frame AT-SPI isolado não comprova captura/input da janela correta. Nenhum clique ou digitação foi feito neste preflight.

O checkpoint anterior também dizia não haver WebDriver instalado. Nesta verificação, `/home/misael/.cargo/bin/tauri-driver` e `/usr/sbin/WebKitWebDriver` existem e são executáveis. Isso não comprova operação, mas impede repetir a alegação de ausência sem uma sondagem adequada. Não instale ferramentas ou bibliotecas antes de verificar os caminhos e recursos já disponíveis.

Não reutilize coordenadas desse Xvfb no desktop real. Não declare Computer Use funcionando para a aplicação somente porque o diagnóstico geral diz READY.

Faça a qualificação:

1. Comece cada turno com Computer Use chamando `get_app_state`, conforme o contrato do conector. Liste as janelas e identifique a aplicação por PID, executável, título e contexto, sem focar outra aplicação por engano.
2. Use uma sessão isolada que o conector consiga realmente controlar. Se ele só alcançar o desktop normal, abra uma instância própria do Studio com diretórios XDG isolados e projetos privados, identificada por PID. Interaja somente nessa janela; não abra ou edite outros aplicativos, arquivos ou projetos do operador. Não altere resolução, configuração global nem segurança. Se for impossível operar a janela com segurança, registre o bloqueio concreto.
3. Não repurpose `HOME`, `CODEX_HOME` ou variáveis reservadas para nomes de trabalho ou para contornar configuração. Leia o isolamento legado antes de relançar; preserve seu conteúdo e use opções/perfis próprios suportados. Não transfira permissões ou consentimentos de portal por meios ocultos.
4. Capture a janela-alvo pela ferramenta e inspecione a imagem. Confirme a correspondência da captura com PID, janela, escala e tamanho. Elementos da árvore devem vir de um estado fresco; se só houver um frame e nenhum controle, registre a limitação e use coordenadas verificadas na captura atual quando o conector suportar.
5. Faça uma interação inofensiva e observável: focar um campo da instância de auditoria e digitar um nome de projeto temporário, por exemplo. Reobserve a janela e confira que o texto chegou ao campo correto. Não clique em criar/sobrescrever sem revisar o destino privado.
6. Salve captura antes, chamada/ação e captura depois. Faça também uma navegação reversível por um controle real. Só então marque **ferramenta de interação qualificada**.

Capture/observe → decida uma ação → clique/digite/arraste → reobserve → registre. Use `list_windows`/`focused_window` antes de input direcionado quando exigido. Aviso de foco não confirmado significa que a entrada não foi comprovada. Se a captura estiver redimensionada, respeite dimensões de coordenadas e escala informadas pela ferramenta.

Computer Use não obriga o uso de um navegador. O objeto é um aplicativo Tauri. Browser/Playwright sobre uma cópia web não substitui o aplicativo desktop. Terminal continua permitido para arquivos, hashes, organização e diagnóstico, sem substituir a interação visual solicitada.

Não retorne a `xdotool`/screenshots de shell como ferramenta principal apenas por familiaridade. Uma alternativa de automação nativa só cabe após ausência ou bloqueio demonstrado do conector; registre a decisão e o que pode ser medido. Não declare auditoria com Computer Use se outra ferramenta foi usada. Consensos dos revisores não consertam uma captura da janela errada.

Se o conector não estiver disponível ao agente, declare isso com as ferramentas que de fato encontrou. Essa é uma pendência de capacidade da sessão; não fabrique chamadas ou resultados. Capacidades não testadas ou backends anunciados não substituem uma prova de clique e resposta na janela correta.

## 3. Primeiro bloco de trabalho real

Depois de qualificar a ferramenta, execute J00 e J01 sem pedir novo GO:

- Confirme por interação a hipótese de corte do wizard: foco dos campos, scroll, navegação por Tab, possibilidade de alcançar Nome/Pasta base e redimensionamento suportado. Capture antes/depois e distinga campo cortado, conteúdo rolável e erro da captura. Não classifique a hipótese inicial como defeito confirmado sem essa verificação.
- Crie um projeto privado pela UI, tente encontrar a próxima ação sem roteiro de cliques, salve, compile, rode e confira o resultado. Uma falha bloqueia aquele caminho; documente-a e continue outras tarefas possíveis.
- Registre os passos reais, primeira tentativa, ajuda necessária, esperas e recuperação. Não use chamadas a IPC/store ou edição do JSON para suprir um caminho que a interface não permite.
- Publique no pacote local a primeira galeria navegável e registros parciais verdadeiros. Um índice com duas jornadas documentadas é um artefato legítimo; não chame de concluídas as demais.

Em seguida continue J02–J15, conforme o escopo original: MUGEN real, golpe, animação, cena, paleta, texto/som, projeto pronto, nodes, teste/inspeção, REX comercial, patch, revisão/exportação, erros e superfícies adicionais. Não reduza a missão aos exemplos que já conhece ou às jornadas que o harness antigo já passa.

## 4. Persistência e continuidade sem interrupções artificiais

O usuário já autorizou a missão inteira. “São muitas jornadas”, “é preciso outra sessão” ou “posso seguir?” não são bloqueios técnicos. Não encerre voluntariamente o turno ao terminar a preparação ou uma jornada para solicitar autorização que já existe.

Trabalhe autonomamente por blocos e registre checkpoints enquanto continua. O checkpoint preserva o trabalho; não é motivo para parar. Dê atualizações concisas sobre descobertas, próxima tarefa e bloqueios reais. Prossiga até cobrir o escopo executável e as revisões, ou atingir uma limitação externa comprovada/limite real de execução. Não prometa execução infinita ou ausência de limites da plataforma.

Se uma jornada falhar, não repita até conseguir verde nem abandone as demais. Preserve a falha e investigue conforme o método A/B. Se o ambiente impedir uma etapa, registre ação tentada, mensagem, evidência e o que ainda é executável. Pedido de input só quando uma decisão ou autorização genuinamente ausente for indispensável.

Atualize `SESSION.md`, cobertura e índice ao fim de cada jornada. Não espere o fim da missão para registrar a continuidade canônica: proponha ou adicione checkpoint factual conforme as regras do projeto, com “auditoria em andamento”, tarefas realmente executadas e próxima ação. Isso não autoriza mudar maturidade nem criar uma fonte paralela de estado.

Se encerrar uma sessão ou ocorrer bloqueio real, feche somente processos criados pela sua sessão e identificados. Não deixe app/Xvfb órfãos sem registrar como retomar ou encerrar; não encerre o PID de uma sessão anterior sem comprovar identidade e propriedade.

## 5. Artefatos e revisão plural continuam obrigatórios

Execute as exigências do prompt integral, com progresso incremental:

- `events.jsonl` e screenshots aceitos por etapa;
- `achados.jsonl`, fichas e `cobertura.csv` com estados reais;
- `INDEX.html` com imagens visíveis e navegação;
- manifesto com hashes e ausências explícitas;
- parecer próprio, backlog e limites;
- pacote neutro e pareceres independentes.

Não precisa esperar todas as jornadas para solicitar revisão de um lote já congelado e suficientemente completo. Revisores podem analisar esse lote em paralelo, enquanto o executor captura o próximo, identificando versão/hash e escopo parcial. Eles não podem dirigir a mesma instância do app nem alterar a evidência alheia. Ao fim, reconcile cobertura e síntese geral.

Use os três prompts de revisor do documento integral, com contextos separados e sem as conclusões do executor antes do parecer inicial. Não simule revisores. Se a sessão não tiver delegação disponível, prepare pacote e prompts prontos e marque revisão pendente; não anuncie consenso.

A ordem operacional é: ferramenta qualificada → jornadas com evidência e galeria incremental → revisão independente por lotes congelados → confronto de pareceres → síntese e backlog. Registro e checkpoints acompanham toda a execução.

## 6. O que deve aparecer na próxima entrega

Relate **o que foi observado e experimentado na interface**, não apenas o que foi preparado no terminal. Inclua:

1. Ferramenta efetivamente usada e prova de captura/input no aplicativo correto.
2. Jornadas e passos executados, resultado e ligação para as imagens.
3. Achados concretos com consequências, confiança e recuperação; hipóteses separadas.
4. Galeria e registros que já possam ser abertos por outro agente.
5. Revisores realmente acionados, pacote analisado, limites e divergências.
6. Cobertura pendente e motivo comprovado; sem transformar falta de execução em “não aplicável”.

Não modifique o produto durante a auditoria. Não empurre commits, não publique dados, não altere expectativas históricas e não apresente observação por IA como validação humana.

## 7. Continuação após a passagem consolidada — lacunas verificadas em 2026-10-20

Esta seção atualiza o próximo passo depois dos checkpoints 8/9, sem invalidar ou reescrever os lotes congelados. Prevalece sobre instruções anteriores que mandavam começar novamente por qualificação de ferramenta e J00/J01. Preserve os resultados atuais e avance na cobertura funcional pendente.

### O que a revisão desta passagem confirmou

- As 16 linhas de `coverage.csv` continuam sem uma jornada ponta a ponta concluída. A galeria e os pareceres são evidência exploratória útil; não fecham a missão original.
- O pin de `review-lots/LOT-006-J03-J07-J12-J14-A-20261020T120751Z/MANIFEST.sha256` continua `828c724297c4cf922080f1b20cfd38f4b3a2ac454f1d34923f3e9f12941029bc`. A revisão conferiu 56 entradas desse manifesto, sem divergência. Isso demonstra integridade do pacote, não execução das etapas ausentes.
- As imagens J14-013, J06-006 e J13-001 foram inspecionadas. Sustentam o aviso de duração persistente, as opções Dano homônimas e o erro de Runtime Setup mostrado na sessão. Não sustentam, por si, a causa técnica nem efeito na ROM.
- As capturas revisadas usam o perfil **HACKER**, selecionado no topo. O parecer sobre poluição e descoberta precisa ser segmentado por modo. Não extrapole uma tela avançada para a experiência GUIADO/CRIADOR sem comparação.

### Entradas de QA existentes — corrigir o bloqueio de ausência

As entradas abaixo existem no host, são as mesmas já declaradas no manifesto `data/studio_grafico/final-manifest-r4.json` e tiveram seus hashes reconferidos nesta revisão. Não estão ausentes apenas por não terem sido copiadas para `inputs/` da auditoria.

MUGEN, pasta `/home/misael/.retrodev/mugen-real-2026-09-30/source/ken8/`:

| Arquivo | SHA-256 reconferido |
|---|---|
| `ken8.def` | `fdbe2fb2498be72078232ca68f2cc74fd8347aac2c8304c626d5f15dc68f5fc8` |
| `ken.sff` | `911e21b778af3e7a93cd69fe6132b8e87fb1cacddac757ada5842a8cb1c2172c` |
| `ken.air` | `b1f6c8d093dfd0849091035d7721a5748b59a476084bbc7ebf1ce2e1c6e7ed3a` |
| `ken1.act` | `89942f64862be6cb2bb0c094b2ab0ebb5cb411c06b7f1a6f9d69af64647687f2` |
| `ken.cmd` | `728e914f4de8d6de84af7c572af1e811c03ef142e1b168e49057bc0ba0416e16` |
| `ken.cns` | `0b4593b7fec0e555c41b21a032a95ea5efc540b61f201d2504a409cd4d692755` |
| `ken.snd` | `4f0cfdc8a9b3dc825bbbfac14853d1d31ffa8cd5f9c64b92e8575fb131980521` |

ROM local de QA: `/home/misael/.retrodev/rex_corpus_c/members/Sonic the Hedgehog (USA, Europe).bin`, SHA-256 `c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb`.

Reconfira os pinos, copie as entradas para um novo diretório privado de auditoria e registre a cadeia arquivo original → cópia → importação. Reutilize-as nos mesmos termos de QA local já autorizados no projeto; não as distribua nem versione. Hash/manifesto anterior estabelecem identidade e ligação ao corpus utilizado, não autoria ou licença. Preserve qualquer incerteza real de proveniência; não converta essa incerteza em declaração de arquivo inexistente. Se uma regra impedir especificamente o uso local, cite a regra e o elo ausente em vez de alegar que não há entrada fornecida.

### Runtime Setup: investigar o ambiente realmente usado pelo app

O processo auditado 3351405 estava com `HOME` e `XDG_CACHE_HOME` apontados para a árvore privada `tmp/`, e cwd na pasta do binário. O diagnóstico READY realizado no checkout normal não demonstra que o processo isolado descobriu as mesmas ferramentas.

Também foi verificado que:

- O cache oficial normal possui `active-host.json` e o JDK pinado.
- O cache privado da auditoria já possui outro `active-host.json` e `toolchains/jdk/bin/java`, executável, cujo arquivo release declara Temurin 21.0.11+10.
- O código existente consulta `RDS_HOST_CACHE`, `XDG_CACHE_HOME`, o ponteiro do host e o relatório de prontidão; `JAVA_HOME` também participa da descoberta.

Assim, **nem ausência de JDK nem causa no isolamento estão demonstradas**. Não recomende reinstalar Java apenas pelo caminho `/usr/sbin/java` mostrado na captura. Preserve logs completos, horários e relatórios. Qualifique qual Java, cache, relatório e configuração o processo usa, execute uma prova operacional delimitada com o JDK oficial existente e repita o fluxo por UI em uma instância nova de auditoria.

Use os mecanismos canônicos de configuração por processo para reaproveitar o host existente. Não repurpose HOME novamente, não mude Java global, não instale outro JDK, não copie o toolchain inteiro sem necessidade e não altere produção. Se usar um override canônico como `RDS_HOST_CACHE`, registre-o explicitamente e mantenha a passagem anterior como ambiente distinto. Um sucesso sob override não prova que o launcher normal resolve dependências.

Compare, em janela/perfil de auditoria, o comportamento das condições normais do launcher e o isolamento controlado. Se só uma condição falhar, mantenha o contraste como evidência. Se o launcher normal falhar, registre o bloqueio de produto/disponibilização com a devida confiança; não o esconda com variáveis do harness. Peça mudança de produto somente numa missão posterior, com o bloqueio agora reproduzível.

### Nova ordem de execução: terminar percursos, sem refazer a documentação inteira

1. **Pré-condições:** inventário das oito entradas acima, snapshots completos das novas cópias e diagnóstico operacional de Runtime Setup. Não é uma nova rodada de preparação de quatro horas: é a qualificação mínima para retomar tarefas bloqueadas.
2. **Vertical de criação:** concluir J01/J08 com uma alteração real e limitada, salvar → fechar → reabrir → build → ROM → execução pelo app → exportação. Observe o que quebra e como se recupera. Se houver bloqueio real, isole a causa até o limite da missão e apresente reprodução exata; não marque a cadeia aprovada.
3. **Vertical MUGEN:** repetir a descoberta em GUIADO ou CRIADOR, usar `ken8.def` e seus arquivos reais, importar → revisar → editar golpe/animação/caixa/som → testar → salvar/reabrir → exportar. Preserve a distinção entre comportamento importado e golpe autoral. Não substitua a importação pelo demo pronto.
4. **Vertical REX:** abrir a cópia da ROM pinada pelo caminho existente, compreender o escopo identificado, realizar uma edição suportada e produzir/testar cópia e patch sem alterar a base. Se um editor ou recurso não for suportado, documente o limite exato; não suponha decompilação universal nem use offsets via script para esconder uma lacuna da UI.
5. **Completar a matriz:** com as pré-condições qualificadas, retome as partes pendentes de J00 e J03–J15, evitando repetir passos já suficientemente documentados. Reconcile etapas compartilhadas entre jornadas e preserve resultados assistidos como assistidos.
6. **Revisar evidência nova:** congele lotes com snapshots pré/pós, lista de caminhos/hashes e condições de modo/ambiente. Envie-os aos revisores independentes sem suas conclusões e reconcilie as divergências. Os pareceres existentes permanecem válidos somente no escopo de seus lotes.

Computer Use já tem um bloqueio concreto registrado. Não gaste cada nova jornada repetindo a mesma qualificação sem mudança de condição. Se não houver solução suportada dentro do escopo, use a alternativa de interação real já declarada, com alvos e foco verificados. Antes de cada clique, confira captura e coordenadas da janela correta; erros de clique do executor não são falhas do produto. Se um WebDriver nativo já disponível reduzir esses erros, pode qualificá-lo sem usar stores/IPC para executar ações do usuário nem substituir o app por uma página web.

### Comparação de modos e integridade para os próximos lotes

- Use GUIADO/CRIADOR para o percurso inicial de criação; depois compare PRO/HACKER na mesma tarefa, seleção e tamanho de janela. Registre modo e opções avançadas em cada captura. Não presuma qual modo é o padrão sem observar um perfil limpo.
- Fotografe hierarquia, ações primárias, mensagens, áreas técnicas, contexto e retorno. Compare o que é necessário à tarefa com o que ocupa atenção sem ajudar. Preserve o acesso avançado nas propostas de simplificação.
- Cada nova jornada de edição precisa de snapshot completo anterior e posterior, com inventário dos caminhos, em diretório novo. Diferencie reserialização, mudança semântica, alteração esperada e diferença inexplicada. Não complete retrospectivamente a cadeia que faltou no LOT006 com um snapshot recriado.
- Os achados de aviso persistente e Dano homônimo devem ser reproduzidos em cópia nova e em contexto conhecido; não implemente seus fixes durante esta investigação. Uma paleta recusada por falta de capacidade pode estar correta, ainda que a explicação ou seleção sejam ruins.
- Continue produzindo galeria e checkpoints enquanto trabalha. A entrega final precisa priorizar resultados das tarefas e evidência que arbitre os bloqueios, e não quantidade de cartões ou unanimidade entre revisores sobre as mesmas imagens.
