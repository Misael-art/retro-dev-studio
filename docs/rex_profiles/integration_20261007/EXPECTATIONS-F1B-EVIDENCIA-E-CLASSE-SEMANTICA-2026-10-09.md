# EXPECTATIONS — confiança das evidências e F1b (classe semântica contador→comparação→estado no motor compartilhado) — 2026-10-09 (noite)

Congelado ANTES de implementar. Base: HEAD `d8b1e0cf` (árvore limpa, host `READY`). Mudanças de protocolo só por adendo datado; falha é reportada como falha; uma repetição aprovada não explica uma execução reprovada. Nada aqui declara universalidade nem usabilidade humana. Não abre vida/anéis, outro jogo nem recuperação geral.

## 1. Auditoria do caminho existente (bytes → decode → região/CFG → regra → grafo → reconstrução)
Fonte: `crates/rex-gameplay` (`CONTRACT.md`) e `src-tauri/src/tools/reverse/decomp/rex_gameplay.rs`.
| Etapa | Onde | Deriva da ROM | Recebe DECLARADO |
|---|---|---|---|
| decode | `m68k::decode` | instrução, tamanho e operandos de cada palavra, num subconjunto FECHADO de 12 formas; o resto é recusa | nada |
| região/CFG | `region::delimit` | blocos alcançados seguindo os dois lados de cada desvio | **entrada e saídas** (do chamador). Não há descoberta de rotina |
| candidatos | `scan_guarded_candidates` | ocorrências da forma `BTST #n,Dk ; BEQ` que delimitam e elevam com a saída da própria guarda | nada; mas só encontra a forma COM guarda → é "candidato estrutural", não uso em jogo |
| regra | `lift::lift` | guarda, soma do contador, operador, limiar (`K + bias`), dois resultados, chamada externa (alvo e argumentos) | nada |
| grafo | `graph::build_graph` | nós, parâmetros e `source_mappings` (offset, bytes, mnemônico) | rótulos de endereço (`Hints`): só apresentação |
| reabrir | `graph::open_graph` | remonta as instruções mapeadas, re-delimita, re-eleva e exige igualdade (menos rótulo, posição e limiar) | o grafo salvo |
| reconstrução | `patch::patch_threshold` / `regenerate_from_graph` | bytes novos; os dois caminhos são comparados | SHA-256 esperado da base |
| publicação (hoje) | `rex_gameplay::rebuild_gameplay_rom` | — | caminho de saída; grava UM arquivo com `fs::write`, **sem IPS e fora de `rex_publish`** |
Entrada/saídas declaradas **não contam** como descoberta automática. A chamada `JSR` é opaca (alvo e argumentos registrados; corpo não recuperado).

## 2. Fronteira entre declaração, evidência histórica e observação (Etapa 2)
Quatro origens, nunca fundidas, no contrato, no DTO e na UI:
| Origem | O que é | Quem pode produzir |
|---|---|---|
| **declarada** | afirmação escrita pelo autor do perfil (`evidence.claims` do JSON) | qualquer perfil |
| **histórica curada** | registro, embutido na compilação, de uma medição passada: relatório (caminho + SHA-256), binário, ROM, instância, revisão/SHA do perfil sob a qual foi medida e para quais revisões foi transportada e por quê | só o repositório (`data/rex_profiles/evidence/`); nunca um perfil de pasta |
| **observada pelo aplicativo** | o que ESTA sessão do aplicativo fez e conferiu (reconhecimento estático; cópia relida; IPS reproduz a cópia) | só o aplicativo, com identificador da sessão |
| **desconhecido** | o resto, dito explicitamente | — |
Regras: (a) um perfil não ganha rótulo de efeito, consumo ou equivalência por declarar o nível; (b) referência e SHA de ROM num JSON não comprovam medição; (c) integridade de um registro não é veracidade do conteúdo — o rótulo de "curada" diz "registrada com procedência", não "verdadeira"; (d) um registro curado só se aplica a ROM + instância + SHA do perfil que ele lista; (e) observação de outra sessão não é observação atual; (f) nenhuma evidência é apagada: os relatos históricos do pulo viram registros curados rotulados **herdados** (medidos antes da migração para dado; transportados por equivalência de localização e de cópias).

Negativos, escritos e vistos REPROVAR antes da correção:
| N | Caso | Esperado depois |
|---|---|---|
| N1 | perfil de pasta alega L5 com referências e SHA da ROM corretos | origem `declarada`; nenhum rótulo de efeito verificado |
| N2 | afirmação de perfil embutido sem registro curado (referência inexistente) | `declarada`; e teste que exige registro para toda afirmação embutida |
| N3 | registro íntegro, mas de outra ROM ou de outra instância | "curada para outro alvo": não vale para este |
| N4 | registro de outra revisão/SHA do perfil | "curada para outra revisão": não vale para esta |
| N5 | observação com identificador de sessão anterior | não é apresentada como observação atual |

## 3. Integração da classe semântica (F1b)
Separação mantida: **perfil** = configuração e conhecimento declarado; **analisador** (`crates/rex-gameplay`, reutilizado sem virar linguagem dentro do JSON) = deriva operações dos bytes; **motor** = coordena e valida; **evidência** = registra o alcance.
- Novo esquema versionado `rex-semantic-profile/v1` para a classe; `rex-profile-spec/v2` **não muda** (os dois perfis v2 e seus hashes ficam idênticos). O registro despacha pelo ESQUEMA do arquivo e o motor pelo `analyzer.kind` (operação genérica por classe), nunca por nome de jogo ou id de perfil.
- Infraestrutura compartilhada usada pela classe: catálogo e identidade (id, revisão, SHA do arquivo), procedência, projeção/revisão do grafo (o grafo do analisador ganha o mesmo vínculo de ponte; a revisão re-deriva da ROM), persistência no grafo da entidade, anti-resposta-antiga (`contextIdentity`), plano de edição como `rex_edit::Patch` e publicação por `rex_publish::publish_pair` (cópia + IPS). O caminho próprio de escrita (`fs::write`) deixa de ser alcançável pelo produto.
- Seleção rotulada: `varredura estrutural` (candidato) ou `região declarada` (entrada/saídas informadas pelo usuário). Nenhuma das duas é chamada de descoberta de rotina.
- Chamadas externas continuam opacas; nenhuma é simulada como operação vazia.
- Custo de generalização registrado no fecho (linhas de motor novas para aceitar uma segunda classe).

## 4. Subconjunto semântico coberto (inalterado; é o do `CONTRACT.md`)
Guarda opcional por bit de registrador; soma opcional `C := C + q` (32 bits, wraparound); comparação **assinada de 32 bits** `C OP T` com `OP ∈ {>=, <, ==, !=}`; dois resultados `G := v`; chamada externa opaca opcional. Única edição: o limiar `T`, na faixa do `MOVEQ` original. Topologia, operador, endereços e passo **não** são editáveis; alterá-los no canvas não é compilado.

## 5. Matriz de comportamentos e recusas
| Comportamento | Esperado |
|---|---|
| perfil semântico válido carrega; malformado, esquema desconhecido, `analyzer.kind` desconhecido, id repetido | carrega / rejeitado com regra |
| ROM sem a forma | zero candidatos, sem erro |
| mais de um candidato | todos listados; nenhum escolhido |
| região declarada com opcode fora do subconjunto, laço, saída não alcançada | recusa com offset e motivo |
| limiar na faixa | cópia + IPS publicados juntos; original intacta; tamanho igual; só o imediato (e o checksum do cabeçalho, se a base o tinha válido) muda |
| limiar fora da faixa, igual ao atual, não inteiro | `out-of-range` / `no-change` / problema de valor |
| grafo com operador, endereço, conexão, mapping ou identidade adulterados | `graph-diverges` |
| ROM trocada; perfil de outro SHA; pasta de perfis ausente | `identity_mismatch` / `profile-mismatch` / `profile-unknown` |
| falha de publicação | nada no destino; original intacta |
| resposta de outro contexto | descartada pela interface |

## 6. Compatibilidade
- C1. `m68k.platformer_jump.v1.json` e `m68k.authored_timer_gate.v1.json`: SHA-256 inalterados; continuam carregando e localizando igual.
- C2. Grafos de pulo salvos (4 arquivos anteriores à migração + formato atual) continuam reabrindo; as 8 cópias e 8 IPS do pulo continuam com SHA idêntico ao de referência.
- C3. Blocos `recovered_rule` já gravados em cenas (formato anterior desta classe) não são apagados nem reescritos; a interface os reconhece e oferece migração explícita (re-recuperar pela região gravada, com a identidade da ROM conferida). Migração testada.
- C4. Os testes existentes de `crates/rex-gameplay` e do adaptador passam sem mudar asserção.

## 7. Demonstração semântica (Etapa 4)
Caso existente: fixtures do crate (`goal_original_t6`, `two_passages`). **Variante autoral executável nova**: ROM Mega Drive mínima, escrita para este teste, cuja rotina usa OUTROS registradores, OUTROS endereços, ordem inversa dos operandos do `CMP` e operador diferente do caso existente; relocar os mesmos bytes não conta. A ROM se autoexercita: percorre uma tabela de estados de entrada (fronteiras do limiar, `0x7FFFFFFF`, `0x80000000`, `0xFFFFFFFF`, wraparound da soma, guarda ligada/desligada) e grava contador e estado resultantes na RAM. Amostra **não cega** (eu a escrevo).
- A recuperação recebe só os bytes (+ entrada/saídas ou varredura); não lê o gerador nem a tabela de respostas.
- **Referência independente**: o core Libretro executando a ROM (original e cópia editada). A previsão vem da regra recuperada. Comparam-se **apenas** as escritas de contador e de estado, por caso. Flags, registradores na saída, efeitos da chamada externa e demais memória **não** são comparados e nada se afirma sobre eles.
- Executar uma ROM autoral controlada **não** demonstra consumo da rotina em jogo comercial.
Critérios: D1 operador, limiar, passo, endereços e os dois resultados recuperados da ROM coincidem com o que o core mede em todos os casos; D2 após editar o limiar pela interface, a cópia executada no core produz o previsto para o NOVO limiar em todos os casos e a original continua produzindo o do limiar antigo; D3 salvar → encerrar → reabrir preserva regra, vínculo e plano.

## 8. Jornadas e regressões (binário final, HEAD limpo)
Nova: jornada da classe semântica pela interface real, incluindo canvas (seleção rotulada; operações recuperadas, declaradas e opacas visíveis; edição do limiar; cópia + IPS; reaplicação independente; original intacta; salvar/reiniciar/reabrir; executar a cópia no emulador e ler o resultado previsto na RAM, sonda técnica rotulada).
Regressões: `jump-profile-journey`, `jump-canvas-journey` (com a comparação de SHA das 8+8), `profile-authoring-journey`, `nodegraph-authoring`, `jump-gameplay-journey`; `sonic-layouts-journey` e `sonic-consumers-inspection` só se `inspection.rs`/painel de inspeção mudarem. Esperas limitadas por condição observável; sem repetir até passar; sem reduzir limiar. Contagens históricas (24, 87, 66, 13, 19) são referência, não resultado.
Gates: `check:tree`, `lint`, `tsc --noEmit`, `npm test`, `cargo clippy -- -D warnings`, `cargo test --lib`, `cargo fmt --check`, gates dos crates, `host:certify`.

## 9. Correções por adendo (registradas no fecho, sem reescrever o histórico)
- O commit `103ee686` foi descrito como "só de dados": ele também contém um **gerador Python auxiliar** (`make-authored-timer-profile.py`); não altera o motor.
- **Resíduo de pilha é pista, não comprovação temporal de chamada** (pode ser antigo; não ordena eventos). A investigação proposta não é implementada nesta missão.

Resultado permitido, se e só se os critérios valerem: "Infraestrutura compartilhada demonstrada para identificação por perfis e recuperação semântica delimitada de contador/comparação, com evidências classificadas por origem e fluxo anterior preservado."
