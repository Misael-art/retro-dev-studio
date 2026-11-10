# Revisões independentes — LOT006

Pacote revisado: LOT-006-J03-J07-J12-J14-A-20261020T120751Z  
Pin externo de MANIFEST.sha256: 828c724297c4cf922080f1b20cfd38f4b3a2ac454f1d34923f3e9f12941029bc

As três revisões foram solicitadas em separado e usaram o mesmo lote congelado. Cada parecer verificou o pin do manifesto. A verificação local também passou para todas as linhas do manifesto. O pacote contém 40 arquivos PNG e 40 linhas de observação. R-B descreve seu escopo visual como 39 capturas; a diferença é de contagem de escopo, não de integridade dos arquivos.

## R-A-006 — fluxo e continuidade

- Não encontrou P0.
- Atribuiu P1 ao bloqueio de build/entrega nesta sessão, com confiança baixa sobre causa raiz; explicitou que pode ser estado do host e não prova defeito do produto.
- Atribuiu P2 aos bloqueios visíveis de J04 e J12, à mensagem stale em J14 e ao fluxo de paleta J06.
- Atribuiu P3 como hipótese de descoberta ao áudio: AU parece grupo, o clique não navegou, e Add Sound só abriu um seletor cancelado.
- Registrou retornos seguros em Cancelar, Ctrl+Z, Ir para Cena e correção de duração. Alertou que nenhum teste de ROM, áudio, combate, colisão, exportação ou participação humana foi demonstrado.

Arquivo integral: reviewers/reviewer-A/review-lot-006.md.

## R-B-006 — inspeção visual

- Não encontrou severidade P0/P1.
- Atribuiu P2 às telas sem transição visível de J04/J12, ao estado stale de J14 e aos rótulos Dano duplicados.
- Atribuiu P3 a resumos que continuam mostrando o valor antigo enquanto a edição está pendente, a mensagem de J03 que ainda cita ocorrência 1 quando outra ocorrência está selecionada, à ambiguidade do cabeçalho AU e à leitura/truncamento de texto em painéis estreitos.
- Não tratou a rejeição da paleta como defeito do alocador; a causa pode ser o estado de capacidade da cópia.
- Registrou limites de teclado, leitor de tela e ausência de interação Computer Use.

Arquivo integral: reviewers/reviewer-B/review-lot-006.md.

## R-C-006 — integridade e cadeia

- Confirmou pin, manifesto e hashes das capturas; relatou 40 observações/40 capturas.
- Apontou lacunas de proveniência no índice de 78 entradas, inventário agregado de 81 arquivos e hash da cena inicial J03.
- Apontou que os snapshots pré/pós J03 referidos nos eventos não estão incluídos no lote congelado e que os deltas relatados não podem ser recalculados somente a partir dele.
- Atribuiu P1 ao bloqueio do caminho Build → execução → exportação nesta sessão, sem atribuir causa raiz ao produto.
- Confirmou os candidatos J14/J06 e a limitação de J04/J12 por ausência de entrada elegível.
- RC-006-01, que alegava contradição na captura J05-018, foi retirado no erratum após reabrir a imagem: contador mostra seis entidades, Inspector mostra Ken Masters e não há rótulo ROUND 1 visível.

Arquivos integrais: reviewers/reviewer-C/review-lot-006.md e reviewers/reviewer-C/erratum-lot-006-j05.md.

## Síntese cruzada

Convergência alta sobre o estado observado, sem equivaler a três execuções independentes:

- J14: aviso de duração 0 continua após restaurar 5 e trocar ocorrência; reabrir limpa o aviso e reseta a seleção. R-A, R-B e R-C atribuem P2 ao impacto no fluxo.
- J06: duas opções chamadas Dano, aplicação recusada por índice 15 ausente/bancos ocupados. R-A, R-B e R-C atribuem P2 ao bloqueio/ambiguidade observados. Nenhum valida troca em runtime.
- J04 e J12: tentativas de ação não resultam em transição visível. R-A/R-B dão P2 ao bloqueio na tarefa; R-C ressalta pré-condições e entrada ausente. Não há confirmação de defeito causal.
- J13: caminho de build/entrega ficou bloqueado nesta sessão. R-A/R-C usam P1 para gravidade do fluxo; isso não estabelece se a causa é host, dependência ou produto. Esta auditoria classifica como bloqueio ambiental observado.
- J05: a suspeita de integridade do cartão 010 foi retirada por erratum e não deve virar achado.

## Divergências e limites

- A severidade P1 de build é severidade do resultado da tarefa, não um achado de causa raiz confirmado.
- O índice do lote não permite reproduzir os deltas pré/pós J03, pois seus snapshots citados não foram incluídos. Os arquivos ainda existem na evidência privada do executor, fora do pin revisado.
- O contador 81 refere-se ao inventário agregado da pasta inputs; o índice de 78 linhas se refere ao projeto demo. A análise complementar do estado atual reconciliou estruturalmente a contagem como 79 arquivos no projeto mais dois arquivos de índice no diretório inputs, mas o inventário congelado não lista caminhos. Isso não resolve a diferença de hash da cena antes de J03.
- Nenhum parecer é avaliação humana, teste de acessibilidade ou comprovação de Computer Use.

## Errata após a leitura independente

R-C revisou a captura J05-018 depois que a divergência foi questionada. O parecer inicial alegou sete entidades, Texto 2 selecionado e ROUND 1; o revisor retirou RC-006-01 integralmente. A errata permanece fora do lote congelado e está preservada em reviewers/reviewer-C/erratum-lot-006-j05.md.

## LOT012 — revisões independentes

**Pacote:** LOT-012-J01-J08-CREATION-VERTICAL-20261020T173600Z  
**Pin SHA-256:** `00184ce77dbd72f2a044614de9d4df9395851eec917e58ab78931f8460c7ea75`  
**Integridade:** A/B/C verificaram 1.456/1.456 itens.

- **A — fluxo:** J01 não prova movimento; J08 repetiu ADDRESS ERROR no mesmo hash `cf0c6631…`; importador MUGEN integral ficou em “Verificando” e Cancel não recuperou a tela nessa passagem; o resumo 7/7 não diferenciou estado READY de DRIFTED. Severidades referem-se à tarefa/contexto, sem causa-raiz.
- **B — visual:** bloqueio inequívoco de leitura no resumo Runtime Setup, com textos colidindo e cartões cortados em 1280×800. Registrou riscos de texto truncado e contexto estreito; sem alegar conformidade WCAG.
- **C — integridade:** identificou grafo J01 salvo `906e2b…` diferente do grafo no mapa de build `574a86…`, que bate com o snapshot anterior à entrada; J08 repetiu o mesmo ROM; a importação MUGEN não concluiu; o estado Runtime Setup divergiu em Node/npm, mantendo JDK Temurin 21 e SGDK 2.11 presentes. Também apontou a ordem temporal inconsistente entre eventos e screenshots normal/override. Os bytes de REX/MUGEN BYOR continuam fora do lote.

**Convergência:** estados observados de J01/J02/J08/Runtime são sustentados por evidências, mas não há conclusão geral de causa. REX chegou a boot/título sem provar gameplay nem aplicação independente de IPS. O parecer C mantém limites explícitos; hashes declarados não substituem os arquivos privados ausentes.

## LOT013 — revisões independentes reconciliadas

**Pacote congelado:** LOT-013-J03-STRIKE-FOLLOWUP-20261020T180000Z  
**Pin SHA-256:** 5020394f4c5836d799d69e1ae87b9ef3e0297d2c4f48b6795c3db92fa40411b8  
**Escopo:** J03 Art Studio → Apply → Save → Build & Run; 96 capturas, 14 eventos, snapshots pré/pós de 57 arquivos.  
**Integridade:** A/B/C verificaram o pin; A e C reportam 274/274 entradas corretas. As referências às 96 capturas existem; C conferiu os snapshots e os hashes de cena, ROM, C e runtime-link.

### R-A — fluxo e recuperação

- Veredito parcial: sequência Attack [1,4], duração [6,1], hitbox attack 10×8, persistência ao reabrir Art Studio e ROM carregada são sustentados.
- O emulador não mostra movimento/golpe inequívoco; ACK 0→2→4 só prova o retorno do caminho de entrada observado.
- Registra a recuperação do seletor GTK por resize e navegação visível. Encerramento da primeira instância, Apply durante build e aviso VRAM permanecem sem causa isolada.
- Limites: sem participante humano, Computer Use não qualificado e binário declarado não incluído no pacote.

### R-B — inspeção visual

- Confirmou hierarquia reconhecível, porém densa, nas áreas atlas/timeline/preview/inspector. Em 1280×800, chooser inicial ultrapassava a área visível; resize expôs Cancelar/Abrir. Timeline, cartões e Inspector exigem ajuste/scroll para alguns controles.
- Na comparação do mesmo estado, GUIADO acrescenta uma trilha de cinco etapas; CRIADOR, PRO e HACKER mantêm composição parecida. A conclusão é local a esta tela/estado e não mede paridade funcional.
- Os campos de duração/hitbox são visíveis e o preview desenha contorno; confirmação de Apply é menos clara em captura posterior. Tooltip de build ocupa a área superior em algumas imagens.
- Limites: imagens estáticas não provam timing, sequência de foco, leitor de tela, contraste/WCAG, nem comportamento em outros tamanhos.

### R-C — integridade e proveniência

- Confirmou 274 linhas únicas e corretas no manifesto, pin correspondente, snapshots com 57 arquivos cada e delta em 14 caminhos. Cena pós tem frames/durações/hitbox reportados; ROM e fonte gerada correspondem aos hashes observados; runtime-link lista animações mas occurrence_boxes vazio.
- Eventos têm 14 registros e 99 referências válidas; 96 PNGs foram referenciados/indexados. Não encontrou contradição material.
- Limites adicionais: binário auditado não está incluído; eventos não têm timestamps, log bruto de input/foco/processo ou atestação da captura; pin externo não tem assinatura do emissor. A ordem de sequência é a declarada no pacote, não cronologia de relógio independente.

### Síntese independente

Os três pareceres convergem que a edição foi salva e que uma ROM foi produzida/carregada, mas o resultado da tarefa “golpe jogável” não foi demonstrado. A causa continua aberta: os artefatos mostram ausência de hitboxes de ocorrência no runtime-link e seleção inicial da animação 0, porém não isolam se a lacuna vem do gerador, do vínculo de input, do conteúdo do sprite ou de outra condição. O resize do chooser recuperou a navegação nesta instância; o encerramento da primeira instância e a ausência de confirmação do Apply durante build não foram reproduzidos com causa.

Os três pareceres são leituras independentes do mesmo lote e não três execuções independentes. Seus relatórios completos estão em reviewers/lot-013/ e permanecem fora do pacote congelado.


## LOT025–LOT031 — revisões mais recentes

Os relatórios completos permanecem em pastas separadas sob `reviewers/`; nenhum lote ou pacote neutro foi modificado durante a reconciliação.

| Lote | Pacote neutro | Estado dos pareceres | Síntese independente |
|---|---|---|---|
| LOT025 — J02 MUGEN | pin `46e39991ce52c141cc016ed7709d1b881d1cae69184f652d0f02807f04b76b8a` | A/B/C concluídos em `reviewers/lot-025/` | Importação, edição e persistência após reabertura sustentadas; Build bloqueou no atlas, sem ROM/emulação/exportação. C aponta 66/224 imagens não ligadas aos 158 eventos; B registra riscos visuais localizados; A trata o MENU sem dropdown pós-reabertura como indeterminado entre executor e produto. Os pareceres não cobrem a divergência de manifesto no lote integral. |
| LOT028 — J08 projeto existente | pin `3c040076331954a6402c8dd237aef7654b89552cf9b85cd8ba14e95a45ca0d10` | A/B/C concluídos em `reviewers/lot-028/` | Confirmam edição `dx 2→3`, salvar/reabrir, Build/Run, ROM/export byte-a-byte iguais e Stop. A tela Review posterior dizia “ainda não executado”; captura de deslocamento e ACK não isolam movimento. Runtime Setup está visível/READY nos dados, mas painel cortado no viewport. |
| LOT029 — J03/J09 grafo de ataque | pin `d5feea9eba92ab3316f54a8f381ea0eaa87b1080d547405a3627042bcfb2188a` | A/B/C concluídos em `reviewers/lot-029/` | Grafo recebeu Input Pressionado→Animar Sprite idle; Build falhou com guards MUGEN que já existiam antes. Sem ROM/ataque em runtime. GUIADO/CRIADOR/PRO/HACKER comparados numa cena; limites de snapshot e log preservados. |
| LOT030 — J06/J14 | pin `78d776a76fe6ee79cb9fbe1a01587ea554269dd9f38cafc6708406d8730dc310` | A/B/C concluídos em `reviewers/lot-030/` | J06: Dano persistiu após save/reopen, Build bloqueou e Play abriu seletor de ROM, cancelado. J14: zero foi rejeitado; undo/redo alternou 6/7; após último undo a UI em 6 estava dirty e o disco mantinha 7 até salvar. B descreve densidade e comparação dos quatro modos; C verificou 633 itens e sete manifests de 79 caminhos. |
| LOT031 — J08 input e playtest | pin `3795110fde36f45332ffbc54a7fb13a627966a21216154c8425e496c38afa725` | A/B/C concluídos em `reviewers/lot-031/` | ROM preexistente carregada; a UI confirma hash/tamanho/core; Stop retorna à Cena. Durante execução após hold de Right, o Player aparece deslocado à direita. A/C limitam a conclusão a compatibilidade visual/associação plausível, sem movimento causal por frame nem keyup preciso. Não houve Build novo. Ver `ERRATA_LOT031_RECONCILIACAO_REVISOES.md`. |

### LOT025 — hashes dos pareceres e limites

- Pareceres: A `80a630c94805c99a0df0394dea20718e19a083a79cae3e3ea60a0186d1170ba4`; B `c3b7135b93e3bd39eba988701dba71a317eee4e50c4a750582e5c137a8fe39b8`; C `66985e64bdb22ee031429ad05996f3dd46274b9efb3dc01e18408b2c3a642939`.
- Os três revisores verificaram somente o pacote neutro de 381 arquivos, cujo manifesto passou e cujo pin coincide com `neutral-package-v1.pin`. A verificação do lote integral posterior continua com uma exceção localizada em `logs/reopen-after-save.log`, fora do escopo dos pareceres; veja [ERRATA_LOT025_MANIFEST.md](ERRATA_LOT025_MANIFEST.md). Não editar nem repinar o lote congelado.
- A confirmou que os dados de duração, hitbox e som persistiram e que o Build termina no erro de atlas, sem ROM. A considera o MENU sem resposta após reabertura indeterminado, sem atribuir o resultado ao produto. B registrou densidade de wizard/editor, largura do painel Runtime Setup e áreas pretas que bloqueiam leitura em capturas, com causa não determinada. C confirmou os valores persistidos e o bloqueio por atlas; observou que 66 das 224 imagens não são referenciadas pelos 158 eventos, reduzindo a força da cronologia das edições. Nenhuma revisão demonstra emulação, exportação ou compatibilidade geral MUGEN, nem representa avaliação humana.

### LOT031 — integridade, divergências e limites reconciliados

- O manifesto do lote integral tem 59 entradas, pin `61428d55eed798446089e1e2cbcae05f7bf11d098213e36925d3aac7e3d1d0fa`; o manifesto neutro tem 34 entradas e pin externo `3795110fde36f45332ffbc54a7fb13a627966a21216154c8425e496c38afa725`. Ambos passaram `sha256sum -c`. O revisor C não recebeu o pin externo dentro do pacote cego; o pin foi confirmado fora do pacote pelo executor.
- A ação 7 do pacote neutro referencia uma imagem 27 que não foi incluída no subconjunto; o DOM 27 existe e a captura correspondente está no lote integral. Três capturas de carregamento/GUIADO são cópias idênticas; DOMs PRO/HACKER também são idênticos. O comparativo visual ainda tem screenshots 13–16 com os botões de modo destacados, mas DOM não confirma o modo selecionado.
- A formulação do executor em `RESULTS.md` que dizia ter resolvido a lacuna causal foi reduzida na errata externa: há deslocamento visual compatível com Right durante a execução, mas faltam posição por frame, estado da tecla e observação precisa após keyup. ACK não é contagem de frames. O resultado não é validação humana.
- SHA dos pareceres LOT031: A `4679b3456677269fd79ec444c20c2e0569fa81920ddfcfda90c1851de589c66c`; B `e73841240936f73bbdf1df4e2b359bfeed70c0bc31fe5cb82af1d1cc15001dd3`; C `2449a2fa38529f494b7e3c52a824024fdba2a4faf34d07b64fab4fb2c1427665`.
