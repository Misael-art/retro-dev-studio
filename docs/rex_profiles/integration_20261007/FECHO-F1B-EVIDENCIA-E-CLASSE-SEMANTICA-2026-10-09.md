# FECHO — confiança das evidências e F1b (classe contador→comparação→estado no motor compartilhado) — 2026-10-09

Experimental. Sem push, merge, release, promoção ou dependência nova; PR #110 não integrada. Expectativas congeladas antes em `EXPECTATIONS-F1B-EVIDENCIA-E-CLASSE-SEMANTICA-2026-10-09.md` (commit `7e0fe350`, não alteradas). Nada aqui declara universalidade, descoberta de rotinas nem usabilidade humana (nenhum participante foi testado).

## Pins
| Item | Valor |
|---|---|
| Base | `d8b1e0cf` (árvore limpa, host `READY`) |
| Commits | `7e0fe350` expectativas · `fcf9a462` negativos N1–N5 **vermelhos** · `92b48deb` evidências por origem · `4cfffe13` F1b (classe semântica no motor compartilhado) · `f018c762` jornada + editor do canvas genérico |
| Binário (`build:portable`, árvore limpa) | `acc492251d2f8c048ff87b381420082aab966cbf6f86db5126ab357951d2fa40`, de `f018c762` |
| Perfis v2 (inalterados) | pulo `293321058e7e…43e9`; `authored_timer_gate` `f031368b9d8d…9c9c` |
| Perfil semântico (`m68k.counter_threshold_state_gate.v1.json`, esquema `rex-semantic-profile/v1`) | `8e8648022d99f1730d1c3fc4a0f6268449bbefe99013a3f07fcebc72889168bd` |
| ROM autoral executável da classe (versionada; não é jogo) | `df1b57b1b3f4d07637e3c4f41ca3fca2f89cc66861d6fd170036a38ee6cab500` |
| ROMs BYOR (fora do Git) | Sonic 1 `c7da53a1…81ebb`; Sonic Delta `8fd88902…ffd6` |
Evidência: `data/rex_profiles/integration_20261009/evidencia-f1b/` (`sha256sum -c SHA256SUMS`).

## Etapa 2 — confiança das evidências
**O defeito:** o DTO e a UI apresentavam como "efeito medido" o que era só o conteúdo do JSON do perfil; um perfil de pasta que escrevesse `L5` com referências e o SHA certo da ROM aparecia como medido.

**A correção** (`rex_evidence_origin.rs`, `data/rex_profiles/evidence/curated.json`, DTO, UI): quatro origens que não se fundem.
| Origem | O que sustenta | Rótulo na interface |
|---|---|---|
| declarada | o JSON do perfil | "Declarado pelo autor do perfil (não verificado)" |
| histórica curada | registro embutido na compilação: relatório (caminho + SHA-256), binário, commit, ROM, instância, SHA do perfil sob o qual foi medido e para quais arquivos de perfil vale | "Evidência histórica curada (registro do repositório; o aplicativo não mediu isto)" |
| observada pelo aplicativo | o que ESTA sessão fez e conferiu, com o identificador da sessão | "Observado pelo aplicativo nesta sessão" (reconhecimento estático, operações derivadas, cópia relida, IPS reproduz a cópia) |
| desconhecido | — | "Continua desconhecido" |
Regras implementadas: perfil de pasta **nunca** herda curadoria, mesmo com o mesmo id e a mesma ROM; registro só vale para ROM + instância + arquivo de perfil que ele lista; "curada" quer dizer "registrada com procedência", não "verdadeira" (integridade ≠ veracidade); observação de outra sessão não é observação atual; efeito, consumo e equivalência **nunca** aparecem como observação por declaração.
**Nada foi apagado.** Os relatos do pulo viraram 8 registros: 4 **herdados** (medidos em `67b720da`, quando o perfil era código; transportados por equivalência de localização e de cópias) e 4 medidos em `ece9823b` com o perfil em dado. A prova real de 2026-09-28 da classe semântica virou 1 registro herdado (medido em processo, sem binário de aplicativo, em ROM autoral).

Negativos, escritos e vistos reprovar **antes** da correção (`fcf9a462`; saída em `vermelho-negativos-evidencia.txt`, 5/5 FAILED), verdes depois:
| N | Caso | Teste | Resultado |
|---|---|---|---|
| N1 | perfil externo alega causalidade | `perfil_externo_alegando_causalidade_e_so_declaracao`; vitest "N1" | `declared` / `not_curated` |
| N2 | referência inexistente | `sem_registro_ou_vindo_de_pasta…`; `afirmacoes_dos_perfis_embutidos_tem_registro_curado_integro` (confere que cada relatório citado existe e tem o SHA registrado) | `declared`; embutidos todos com registro íntegro |
| N3 | registro íntegro de outra ROM/instância | `registro_curado_vale_so_para…`; `registro_curado_de_outra_rom_nao_vale…`; BYOR: no Delta, `0x16914` = `this_instance`, `0x1732A`/`0x1A170` = `other_target` | "não vale para esta" |
| N4 | registro de outra revisão do perfil | idem; vitest "N4" | `other_revision` |
| N5 | observação de sessão anterior | `observacao_de_outra_sessao_nao_e_observacao_atual`; vitest "N5" | não é mostrada como atual |

## Etapa 3 — F1b: o que foi integrado
- **Esquema novo, versionado:** `rex-semantic-profile/v1`. `rex-profile-spec/v2` não mudou (hashes dos dois perfis v2 idênticos). O registro escolhe a classe pelo **esquema do arquivo**; o motor, pelo `analyzer.kind`. Nenhum despacho por id ou nome de jogo.
- **Papéis:** o perfil (dado) traz identidade, procedência, vínculo, limites, modos de seleção aceitos, rótulo da edição e afirmações do autor — **não** descreve instruções (analisador desconhecido, "script" ou lista de instruções no JSON são recusados). O **analisador** é `crates/rex-gameplay`, reutilizado **sem alteração** (decode, região/CFG, elevação, grafo, reconstrução pelos dois caminhos). O **motor** coordena e valida.
- **Infraestrutura compartilhada agora usada pela classe:** catálogo e identidade (`rex_profile_catalog`), localização (`rex_profile_locate`, com `declared_regions`), projeção para o grafo compartilhado com vínculo de ponte, revisão que **re-deriva da ROM**, persistência no grafo da entidade, anti-resposta-antiga, plano como `rex_edit::Patch`, publicação por `rex_publish::publish_pair` (cópia + IPS).
- **Caminho próprio retirado do produto:** comandos `rex_gameplay_*` removidos; `rex_gameplay.rs` compila só em teste (regressão + prova no core); `RexGameplayRulePanel` removido. A escrita por `fs::write` de um arquivo só não é mais alcançável.
- **Seleção rotulada:** "candidato por varredura estrutural" ou "região declarada pelo usuário". A entrada declarada **molda** o que se recupera (declarar a entrada depois da guarda devolve a regra sem guarda) — por isso nunca é chamada de descoberta.
- **Opaco continua opaco:** a chamada externa aparece como operação `OPACA: registrada, não recuperada`; marcá-la como compreendida ou removê-la no grafo é recusa.

## Etapa 4 — demonstração semântica
**Caso existente** (fixtures do crate): `goal_original_t6` → 1 candidato por varredura (`>=`, limiar 6, guarda D0 bit 3); `two_passages` → regra 1 por varredura, regra 2 (sem guarda) só por região declarada (limiar 60).
**Variante autoral executável nova** (`make-authored-counter-gate.py`): ROM Mega Drive mínima escrita à mão — guarda em **D3 bit 5**, contador em **D4**, limiar em **D6**, estado em **D7**, endereços `0xFF9010`/`0xFF9024`, passo **3**, `CMP` na ordem inversa (`contador − K`), operador recuperado **`<`** (o caso existente é `>=`), chamada externa a um stub. Não é relocação dos mesmos bytes (teste `variante_autoral_difere_do_caso_existente…`). **Amostra não cega:** eu escrevi a ROM.
O grafo é derivado da ROM: o roteiro (`journey.json`) só traz a ROM, a região a declarar, o limiar a pedir e a tabela de **entradas**; não há resposta esperada em arquivo algum.
**Referência independente = o core Libretro executando a ROM.** A ROM percorre 60 estados (fronteiras dos dois limiares, `0x7FFFFFFF`, `0x80000000`, `0xFFFFFFFF`, wraparound da soma, guarda ligada/desligada/todos os outros bits) e grava contador e estado na RAM.
| Onde | Original (limiar 40) | Cópia editada (limiar 100) |
|---|---|---|
| Em processo (`rex_gate_variante_autoral_no_core_original_e_copia_editada`, `--ignored`) | 60 casos, **0** divergências | **0** divergências; **5** casos mudam; só o estado muda |
| Pela interface (`semantic-gate-journey`, binário final, emulador do produto, RAM por `emulator_read_memory`) | 60 casos, **0** divergências | **0** divergências; **5** casos mudam; a cópia **não** satisfaz a previsão do limiar antigo |
Signedness: `0x7FFFFFFF + 3` vira negativo e satisfaz `< 40` (comparação assinada) — conferido contra o core. **Comparado:** só contador e estado gravados. **Não comparado e não afirmado:** flags, registradores na saída, efeitos e número de chamadas externas, demais memória. **Não demonstrado:** consumo da rotina em jogo comercial (é uma ROM autoral controlada).

## Etapa 5 — interface e jornadas (binário `acc49225…`)
A interface mostra, por instância: como foi escolhida; operações recuperadas dos bytes (com faixas de bytes, qual é editável, qual é opaca); o que é declarado; evidência por origem; edição suportada e o que não é compilado; diferença proposta (`40 → 100`); origem do resultado.
| Jornada | Executado | Referência histórica |
|---|---|---|
| `semantic-gate-journey` (nova) | **50/50**, 1ª execução | não existia |
| `jump-profile-journey` | **24/24**, 1ª execução (roteiro inalterado) | 24 |
| `jump-canvas-journey` | **87/87**, 1ª execução; 8 cópias e 8 IPS com SHA idêntico ao de referência | 87 |
| `profile-authoring-journey` | **66/66**, 1ª execução | 66 |
| `nodegraph-authoring` | **13/13**, 1ª execução | 13 |
| `jump-gameplay-journey` | ver "Adendo de execução" | allPass, 19 |
| `sonic-layouts-journey`, `sonic-consumers-inspection` | **não reexecutadas** (declarado antes): `inspection.rs` e o painel de inspeção não mudaram | 85 / 24 |

## Compatibilidade
| | Resultado |
|---|---|
| C1 perfis v2 | hashes inalterados; mesmos testes |
| C2 grafos de pulo salvos | os 4 anteriores à migração reabrem nas ROMs reais (BYOR); 8+8 SHA idênticos |
| C3 blocos `recovered_rule` gravados | não são apagados nem reescritos; o painel os mostra como "formato anterior" e preenche a região gravada para re-recuperar; ROM diferente é dita (`ReverseWorkspace.test.tsx`) |
| C4 testes do crate e do adaptador | sem mudança de asserção |

## Mapa requisito → implementação → teste → resultado → limite
| Requisito | Implementação | Teste | Resultado | Limite |
|---|---|---|---|---|
| Evidência por origem | `rex_evidence_origin`, `curated.json`, DTO `claims`/`observations`, UI | N1–N5 (Rust + vitest), BYOR | PASS | a curadoria é do repositório; não há medição feita pelo aplicativo além de reconhecimento e conferência de cópia |
| Catálogo e identidade da classe | `rex_profile_registry` (por esquema), `ProfileInfo.class` | `classe_semantica_aparece_no_mesmo_catalogo…` | PASS | um analisador |
| Projeção e revisão | `SemanticEngine::graph_json` / `review` + `review_against` comum | `projecao_compartilhada_tem_vinculo…` (14 adulterações), conformidade Rust↔editor | PASS | só o limiar é aplicado |
| Plano e publicação | `SemanticEngine::plan` → `Patch` → `publish_pair` | `editar_o_limiar_usa_a_mesma_publicacao…`, `recusas_da_classe_semantica…` | PASS | faixa do `MOVEQ` original; sem crescimento |
| Persistência e reabertura | grafo da entidade; `campo_param` | jornada (salvar → reiniciar → reabrir → mesma cópia) | PASS | — |
| Anti-obsoleto | `contextIdentity` (perfil + hash) | vitest | PASS | — |
| Recuperação semântica contra referência | core Libretro | teste em processo + jornada | PASS (0 divergências em 60 + 60 casos) | conjunto declarado de estados; só contador e estado |

## Custo de generalização (aceitar uma segunda CLASSE)
- Motor novo: `rex_profile_semantic.rs` 723 linhas de produção (esquema + coordenação do analisador + projeção + revisão + plano). Ajustes no que já existia: `rex_profile_ipc` (plano por classe + publicação única; visões de instância), `rex_profile_registry` (+55), `rex_profile_graph` (núcleo de revisão comum, +68/−12), `rex_profile_spec` (cabeçalho comum extraído). Analisador (`crates/rex-gameplay`): **0 linhas alteradas**.
- Evidências: `rex_evidence_origin.rs` 229 linhas de produção.
- Frontend: +587 / −1.357 (o painel próprio da classe, 790 linhas, saiu; o painel genérico ganhou seleção, operações, região declarada).
- Leitura honesta: uma classe nova **custou código de motor** (não é "só dado"), como o doc 14 §3.1 previa ("classes novas podem exigir um tipo de operação novo no motor, mas nunca código por jogo"). Um segundo perfil da MESMA classe semântica seria só dado; isso **não foi demonstrado** nesta missão.

## Correções por adendo (o histórico não foi reescrito)
1. **`103ee686` não é "só dados".** O fecho anterior o descreveu como commit só de dado; ele contém também um **gerador Python auxiliar** (`scripts/rex_profiles/integration_20261009/make-authored-timer-profile.py`, 262 linhas). Não altera o motor nem o produto (nenhum `.rs`/`.ts`/`.tsx`), mas a descrição correta é "dados + gerador auxiliar".
2. **Resíduo de pilha é pista, não comprovação temporal de chamada.** A `PROPOSTA-INVESTIGACAO-INSTRUMENTACAO-DO-CORE-2026-10-09.md` falava em "eixo de consumo fraco" no critério A. Um endereço de retorno na região morta da pilha pode ser antigo e não ordena eventos: no máximo sugere que uma chamada ocorreu em algum momento. Não é observação de consumo. A investigação **não** foi implementada.

## Lacunas e limites
- Uma classe semântica, um analisador, subconjunto fechado de 12 instruções; só o limiar é editável. Segundo perfil da classe semântica: não demonstrado.
- A região é declarada ou vem de uma varredura que só conhece a forma com guarda; não há descoberta de rotina.
- A variante executável é autoral e não cega; a prova de efeito em jogo da classe continua sendo a de 2026-09-28 em ROM autoral (herdada, curada).
- A migração dos blocos `recovered_rule` é manual (um clique que preenche a região); não há conversão automática do bloco em grafo.
- Lacunas L1–L9 do fecho anterior continuam (inclusive `LEGACY_INSTANCE_PARAM` e os `data-testid` com prefixo `jump-`).
- `sha256`/`json` próprios do crate continuam duplicados (o analisador foi reutilizado sem alteração de propósito).

## Reprodução
```
npm run host:diagnose
cd src-tauri && cargo test --lib rex_ && cargo clippy -- -D warnings && cargo fmt -- --check
cargo test --lib rex_gate_variante_autoral -- --ignored --nocapture --test-threads=1          # core Libretro como referência
RDS_INSPECTION_ROM=<Sonic 1> RDS_JUMP_DELTA_ROM=<Delta> cargo test --lib -- --ignored equivalencia registros_curados
cd .. && npm test
python3 -I scripts/rex_profiles/integration_20261009/make-authored-counter-gate.py            # regenera a ROM autoral e o roteiro
python3 -I scripts/rex_profiles/integration_20261009/mutation-check.py --out <saida.json>
npm run build:portable
RDS_SEMANTIC_JOURNEY_SPEC=$PWD/data/rex_profiles/authoring/counter_gate/journey.json \
  python3 scripts/qa/run-sonic-desktop-isolated.py --xvfb <Xvfb> --xvfb-sha256 <sha> --rom <Sonic 1> \
  --app src-tauri/target-test/release/retro-dev-studio --work <dir> --log <log> --scenario semantic-gate-journey
```

## Adendo de execução (depois da primeira redação)
- **`jump-gameplay-journey` — REPROVADA nesta execução** (`jump-gameplay-2026-10-10T00-05-41-931Z`, binário `acc49225…`, cópias com SHA idêntico ao de referência): `allPass=false`, **14/19**. Sonic 1: G1–G4 e G6 PASS (+88 impulso/segurar, +47 corte/toque). Delta: G6 reprovou por repetições de toque inválidas nas variantes `original`, `a-both` e `b-imp` ("consumo do input nao confirmado"); pela regra congelada, G2–G5 do jogo não são aprovados, embora os valores das repetições válidas sejam os históricos. **Não repeti a jornada** (uma repetição aprovada não explicaria esta) e nenhum limiar foi alterado. Relatório em `falhas-preservadas/`.
  - **Causa, até onde foi isolada** (`gameplay-validade-do-toque.md`, leitura dos 11 relatórios versionados): a falta de confirmação do input na 1ª tentativa do toque ocorre em **todas** as execuções, aprovadas ou não, com qualquer binário (2 a 14 toques por jogo); aprova quando as segundas tentativas confirmam o bastante em cada variante. É propriedade da medição do toque, não do REX: cópias byte-idênticas e emulador sem alteração. **Não isolado:** o porquê da falta de confirmação; e esta execução teve o maior valor da série no Delta (14/24), o que não sei explicar.
  - **Consequência:** nesta missão o efeito em jogo do pulo **não** foi redemonstrado de forma limpa. O que sustenta "fluxo anterior preservado" para o pulo é: 24/24, 87/87, as 8 cópias e 8 IPS com SHA idêntico ao de referência, e o Sonic 1 aprovado nesta mesma execução.
- **Mutação** (`mutacao.json`, 23 proteções desligadas uma a uma, em `f018c762`): **22 mortos, 1 sobrevivente** — "escopo declarado de outra instância apresentado como desta", no caminho da classe semântica. Era lacuna de teste real. Fechada com `classe_semantica_escopo_declarado_exige_rom_e_instancia` (só teste, `#[cfg(test)]`; produto e binário inalterados); aplicado de novo, o mutante agora reprova exatamente nesse teste. A rodada completa de 23 não foi refeita depois disso.
- **Gates** (`gates-f018c762.txt`): `check:tree`, `lint`, `tsc --noEmit` rc=0; `npm test` 1026 / 0 / 6 ignorados; `cargo fmt --check` e `cargo clippy -- -D warnings` rc=0; `cargo test --lib` 1026 / 0 / 92 ignorados; core como referência (`--ignored`) 1/1; BYOR `equivalencia` 2/2 e `registros_curados` 1/1; testes do crate `rex-gameplay` 16/16. Depois do teste do mutante: `cargo test --lib rex_` verde, clippy e fmt rc=0.
- **`host:certify`**: rc=0, `READY`, fingerprint `60249508…f6e2`.
- **Contagem de testes do frontend:** 1033 → 1026. Saíram os 19 testes do `RexGameplayRulePanel` removido e 2 do workspace que o exercitavam; entraram os da classe semântica, das origens de evidência e da migração.
- **Ausente:** `security:audit`/`cargo audit` (dependências inalteradas), `clippy --all-targets`, CI remoto (sem push), `sonic-layouts-journey`/`sonic-consumers-inspection` (inspeção intocada), participante humano.

## Resultado
Infraestrutura compartilhada demonstrada para identificação por perfis e recuperação semântica delimitada de contador/comparação, com evidências classificadas por origem e fluxo anterior preservado.

Ressalvas que acompanham a frase: (1) a jornada de gameplay do pulo **reprovou** nesta execução por validade da medição do toque no Delta e não foi repetida — a preservação do pulo está sustentada por identidade de bytes das cópias e pelas demais jornadas, não por nova medição de efeito no Delta; (2) a variante executável da classe semântica é autoral e não cega, e executar uma ROM autoral não demonstra consumo em jogo comercial; (3) a região é declarada ou proposta por varredura da forma com guarda — não há descoberta de rotina; (4) usabilidade humana não foi testada.
