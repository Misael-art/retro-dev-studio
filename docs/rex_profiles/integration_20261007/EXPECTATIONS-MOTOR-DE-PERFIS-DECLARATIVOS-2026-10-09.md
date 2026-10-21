# EXPECTATIONS — motor de perfis declarativos (conclusão de F0 + F1) — 2026-10-09

Congelado ANTES de alterar comportamento. Base real: HEAD `95138430` (não `cbe2ee74`: outra sessão já fechou uma F0 e uma F1 mais estreitas; ver "Reconciliação"). Mudanças de protocolo só por adendo datado; falha é reportada como falha. Nada aqui declara decompilação universal nem usabilidade humana.

## Reconciliação com o trabalho encontrado
`cbe2ee74..95138430` (6 commits, árvore limpa) entregou: auditoria por arquivo, `rex_evidence`, `rex_profile_spec` (v1), `rex_edit`, `rex_publish`, `rex_profile_engine` (localização + plano de campos), o pulo localizado por dado, e um segundo perfil **apenas como fixture de teste**. Esse trabalho é preservado e reutilizado. O que ele deixou fora e esta missão exige (declarado no próprio `FECHO-F1`: "`graph_json`, `review_graph`, `plan_edit`/`JumpParams` e a ponte TS continuam adaptadores do pulo"):
1. Regras do perfil ainda em Rust/TS: grafo (`graph_json`), notas, nomes de campos (`JumpParams`, `campos`, `match campo`), campos de objeto (`status_off`…), textos de limite, lista `CAMPOS` e `JUMP_PROFILE_ID` na ponte TS, textos dos dois painéis.
2. Contrato v1 sem: versão do perfil, capturas tipadas (largura/sinal/endianess), distinção endereço efetivo × barramento × offset de arquivo, regra explícita de empate, projeção para nodes, procedência, vínculo com ROM, limites de trabalho, afirmações de evidência com referência e escopo.
3. Segundo perfil nunca passou pelo produto (IPC, publicação, grafo, salvar/reabrir).
4. Carga/seleção de perfil: um único `include_str!` com id fixo.

## Papéis (auditoria por símbolo)
Entrada `data/rex_profiles/integration_20261009/auditoria-papeis/papeis.json`; saída gerada com citações `arquivo:linha` em `…/auditoria-papeis/base-95138430/` (script `scripts/rex_profiles/integration_20261009/audit-roles.py`; símbolo citado inexistente = erro). Classes: motor, perfil, caso, instrumento, adaptador (+ misto com símbolos por papel). A auditoria F0 por arquivo (`auditoria/`) permanece como está.

Reuso registrado (nenhuma implementação concorrente será iniciada):
- **`crates/rex-gameplay`**: `m68k.rs` (decode/encode/`step`, subconjunto FECHADO de 12 instruções) e `region.rs::delimit` — este é o **único mecanismo de CFG** do repositório (percorre os dois lados de cada desvio a partir de entrada e saídas declaradas; acoplado a `Insn`). `lift.rs`, `graph.rs`, `patch.rs` são do perfil `counter_threshold_state_gate.v1` (outra classe; pipeline de patch próprio, **não** ampliado aqui). Não usados pelo motor desta missão; base da investigação proposta no fecho.
- **Ponte Ghidra** (`ghidra_bridge.rs`): `analyzeHeadless` com postscript versionado, exporta fronteiras de função e mede precisão/recall contra symbol table. Instrumento; exige Ghidra autorizado no host; não usado pelo motor.
- **Patches/publicação**: `rex_edit` (único gerador/aplicador) e `rex_publish::publish_pair` (único publicador) são reutilizados; nenhum outro pipeline é criado.

## Invariantes do produto (o que NÃO pode mudar) × contagens históricas
Invariantes (qualquer violação = FAIL, independentemente de contagem):
- I1. A ROM original nunca é alterada; a saída é cópia nova + IPS publicados juntos ou nada; nunca sobrescreve; tamanho preservado.
- I2. Valores vêm da ROM relida pelo núcleo, nunca de metadado do cliente; grafo com topologia/origem/campo alterados não é aplicado.
- I3. Identidade obrigatória (SHA-256 da ROM); ROM trocada entre localizar e gerar não deixa arquivo.
- I4. Resposta assíncrona de outro contexto (ROM/instância/perfil) nunca aparece; de valores anteriores é rotulada.
- I5. IPS reaplicado por aplicador independente reproduz a cópia byte a byte.
- I6. Para as mesmas ROMs-base e os mesmos valores, **as 8 cópias e os 8 IPS do pulo têm SHA-256 idênticos** aos de `manifesto-copias.json` (rodada `jump-canvas-2026-10-09T06-14-28-062Z`).
- I7. Um grafo de pulo salvo antes desta missão continua reabrindo com valores, instância, identidade, plano e estrutura canônica (assinatura estrutural inalterada).
- I8. Desconhecido permanece desconhecido: sem instância, sem campo, sem pareamento → recusa/ausência explícita.

Contagens históricas (referência, **não** resultado desta execução; uma contagem diferente só é aceitável com explicação verificação a verificação): `nodegraph-authoring` 13/13; `jump-canvas-journey` 87/87; `jump-profile-journey` 24/24; `sonic-layouts-journey` 85/85; `sonic-consumers-inspection` 24/24; `jump-gameplay` allPass (19 verificações); `cargo test --lib` 971/0 (89 ignorados); vitest 1018/0 (6 skip).

## Critérios de saída
| ID | Critério | Como se mede |
|---|---|---|
| M1 | **Contrato v2** (`rex-profile-spec/v2`) em `data/rex_profiles/specs/`: identidade + versão; arquitetura; padrões com capturas tipadas (largura, sinal, endianess, papel); restrições entre capturas; pareamento com regra explícita de empate; campos e domínios; projeção para nodes existentes; procedência e vínculo com ROM; limites de tamanho e trabalho; afirmações de evidência com referência e escopo. Distingue offset de arquivo, endereço de barramento e deslocamento de endereço efetivo. | testes de aceitação e de **cada** recusa: versão desconhecida, referência inválida, duplicidade (padrão, captura tipada, relação, campo, nó), overflow (domínio × largura/sinal), estrutura acima dos limites, chave desconhecida |
| M2 | O perfil não executa script: todo texto dinâmico é lista de partes tipadas com conjunto fechado de formatos; nenhuma string é interpretada. | inspeção do esquema + teste de recusa de parte desconhecida |
| M3 | **Carga e seleção sem condicional por jogo/ID**: perfis embutidos enumerados do diretório de dados na compilação; perfis autorais lidos de uma pasta em tempo de execução; seleção = todos os perfis carregados tentam a ROM. | `grep` de ids de perfil e termos de jogo nos módulos do motor = 0; teste de carga de pasta |
| M4 | **Motor genérico** cobre: localização/validação, plano de edição, identidade/procedência, projeção e revisão do grafo, aplicação e publicação, anti-obsoleto. `rex_edit`/`rex_publish` reutilizados (um só publicador, um só aplicador). | testes do motor por fixture; auditoria por papel refeita |
| M5 | **Pulo migrado**: o caminho do produto (UI → IPC → motor) não contém regra do pulo em Rust/TS. O grafo gerado pelo motor a partir do dado é **igual** ao do código antigo (valor JSON, descontadas apenas as chaves novas de vínculo) e tem a **mesma assinatura estrutural**; localização igual à referência. Adaptadores de compatibilidade listados, com motivo. | oráculos `#[cfg(test)]` (código antigo) × motor, sintético e ROMs reais (BYOR, `#[ignore]` rodado manualmente) |
| M6 | Toda parte não declarativa aparece como **lacuna identificada** (motivo + impacto no aceite). | seção própria no fecho |
| M7 | **Congelamento**: lista de arquivos + SHA-256 do motor (Rust e TS de produto) gravada em commit ANTES do segundo perfil. | manifesto versionado; `sha256sum -c` depois do segundo perfil |
| M8 | **Segundo perfil autoral, só dado**, variando padrões, capturas, posições dos campos (largura/sinal diferentes de imm16 com sinal) e restrições; demonstra, pelo núcleo do produto e pela interface: localização, valores originais, projeção editável, alteração, cópia + patch, reaplicação independente, preservação fora do escopo, salvar/reabrir. Commit **sem** `.rs`/`.ts`/`.tsx`; hashes do motor inalterados; **mesmo binário** antes e depois (perfil carregado da pasta). A amostra **não é cega**: eu escrevi o perfil e a ROM sintética. | `git show --stat`, manifesto, jornada |
| M9 | **Negativos discriminantes** (cada um falha pelo motivo certo, com código próprio): perfil malformado; captura ou campo duplicado; múltiplos candidatos ambíguos; pareamento incompatível; limites numéricos e overflow; ROM trocada; grafo adulterado; versão/hash do perfil incompatível na reabertura; resposta assíncrona antiga; falha de publicação sem alteração da original. | testes Rust/vitest nomeados + mapa no fecho |
| M10 | **Assinatura ≠ consumidor executado**: toda saída do motor declara `consumo_observado = não` e separa verificação estática, efeito medido (com ROMs e valores do escopo) e desconhecido. Efeito medido em outra ROM não é apresentado como medido nesta. | teste de DTO + texto da UI |
| M11 | **CX**: a interface diz qual perfil reconheceu, o que foi verificado estaticamente, que efeitos foram medidos, o que segue desconhecido, que edições são suportadas e que gerar cópia não recompila o grafo; detalhes técnicos recolhíveis; ação principal em linguagem simples. | vitest dos painéis + jornada |
| M12 | **Matriz no binário final** (HEAD limpo): as 6 jornadas da lista de contagens + jornada do segundo perfil; I1–I8. | relatórios + `SHA256SUMS` |
| M13 | **Gates** do `AGENTS.md`: `check:tree`, `lint`, `tsc --noEmit`, `npm test`, `cargo clippy -- -D warnings`, `cargo test --lib`, `cargo fmt --check`, `host:certify`. | saída registrada; executados × herdados × ausentes em colunas separadas |

## Classe suportada (declarada antes)
Uma relação `pair` (âncora ↔ alvo), no máximo uma `subsumes` entre âncoras e `follow` a partir do alvo; campos inteiros de 1, 2 ou 4 bytes, com ou sem sinal, big ou little-endian, editados no lugar; projeção só para os tipos de node já existentes (`event_update`, `input_pressed`, `condition_compare`, `var_set`). Fora disso o motor **recusa**. O perfil `counter_threshold_state_gate.v1` (outra classe) **não** é migrado.

## Não será feito / não será afirmado
Push, merge, release, promoção, dependência nova, PR #110, emulador 68000, vida/anéis, outro jogo, outro pipeline de patches, alteração de "Decisões Arquiteturais Consolidadas". Nenhum efeito em gameplay é afirmado para o segundo perfil (é sintético: teto L2). Usabilidade humana não é declarada (sem participante).

Alegação final permitida, se e só se M1–M13 valerem: "Motor de perfis declarativos demonstrado na classe e nos conjuntos descritos, com o fluxo anterior preservado."
