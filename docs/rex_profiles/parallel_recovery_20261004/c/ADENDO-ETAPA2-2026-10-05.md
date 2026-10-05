# ADENDO datado — auditoria dos JSONs redigidos (obrigação 9), 2026-10-05

Adendo **append-only** a `EXPECTATIONS-ETAPA2.md`. Este arquivo **não reescreve**
§8 nem §4: o documento congelado fica como foi assinado. Cada colisão entre a
**letra** de §8 e o que a medição mostrou é registrada aqui com campo, valor e
comando, e a redação proposta para o próximo congelamento fica neste arquivo.
Nenhum limiar contratural foi alterado para acomodar resultado; as duas
expectativas que se mostraram demasiado largas (§4 R7 e a literalidade de §8 E2)
estão retificadas **por texto datado**, não por edição do congelado.

Commit da auditoria: `d4cb673` (frente C, `codex/rex-parallel-c-cfg`, base
recebida `275f2af`, base histórica `cb56657a`).

---

## 1. O que foi auditado, com que teste (forma exigida por §8 E6)

`scripts/rex_profiles/parallel_recovery_20261004/c/tests/auditoria_evidencia.rs`
— **19 testes**, todos sobre os arquivos versionados de
`data/rex_profiles/parallel_recovery_20261004/c/evidence/`:

| critério | testes |
|---|---|
| cobertura do escopo | `a_auditoria_cobre_todos_os_arquivos_da_pasta` (a pasta tem de conter exatamente os 6 redigidos + 2 manifestos; arquivo novo sem entrada no teste falha) |
| E2 | `e2_nenhum_dump_de_bytes_comerciais_em_nenhum_arquivo`, `e2_a_regra_repele_um_corpo_de_rom_e_aceita_um_digest`, `e2_distribuicao_real_de_blobs_aceitos`, `e2_chave_que_contem_bytes_so_porta_inteiro`, `e2_os_outros_quatro_nomes_proibidos_nao_aparecem_como_chave` |
| E1 | `e1_todo_redigido_declara_a_origem_do_objeto_e_o_comando`, `e1_raizes_declaram_proveniencia_e_grau_e_nunca_promovem`, `e1_regiao_e_janela_declaram_o_que_foi_delimitado` |
| E3 | `e3_o_comando_registrado_nao_contem_caminho_local`, `e3_o_comando_de_medicoes_identifica_o_objeto_por_sha`, `e3_inventario_pinado_de_campos_que_portam_caminho_do_operador`, `e3_o_que_nao_foi_versionado_tem_digest_e_motivo` |
| E5 | `e5_as_evidencias_novas_declaram_o_instrumento_no_json`, `e5_as_evidencias_novas_declaram_o_veredito_do_comparador`, `e5_o_limite_de_runtime_e_declarado_dentro_de_cada_evidencia`, `e5_manifesto_amarra_cada_redigido_ao_instrumento_e_ao_veredito`, `e5_o_manifesto_de_fixtures_conferir_byte_a_byte`, `e5_os_pins_da_amostra_estao_no_manifesto_e_no_redigido` |

Duas camadas, e a distinção é o ponto do teste:

* **regra dura** — vale também para um redigido que ainda não existe;
* **inventário histórico pinado por igualdade exata** — as colisões medidas na
  letra de §8, nos arquivos da ETAPA 1 que §8 E4 manda preservar. Igualdade
  exata, e não `<=`: uma violação **nova** no lugar de uma registrada falha, e
  uma registrada que **desaparece** (reescrita silenciosa do histórico) também
  falha.

Auto-discriminação (o teste que impede a auditoria vazia):
`e2_a_regra_repele_um_corpo_de_rom_e_aceita_um_digest` alimenta o scanner com um
corpo de 320 hex contíguos e um SHA-256 legítimo, e exige que **só** o corpo
seja reprovado (`runs = 2`, ruins `= [320]`). Sem esse teste, um scanner quebrado
daria "0 violações" para qualquer arquivo.

Resultado: `cargo test --test auditoria_evidencia` → **19 passed**; crate
inteiro → **122 passed (13 suites)**; `cargo clippy --all-targets -- -D warnings`
→ sem issues; `cargo fmt -- --check` → limpo.

O RED observado antes do GREEN (5 falhas, todas verdadeiras): `instrumento`
ausente nos três redigidos novos; `veredito-do-comparador` ausente nos três;
`MANIFEST-ETAPA2.md` sem nomear o instrumento; o contador de não-vacuidade que
eu tinha inventado (20) contra a medição (18); e o digest obsoleto de
`fx11assimetrica.s` (§6 abaixo).

## 2. As quatro colisões letra-versus-intenção de §8 (com números)

**(a) §8 E2 veda as chaves `bytes`/`dump`/`hex`/`disassembly`/`opcode-stream` —
mas `bytes` é substring de contadores legítimos.**
Letra pura proibiria `cobertura.bytes-regiao`, `pino-do-corpo.bytes` etc.
Medição: **18** chaves contendo `bytes` nos seis redigidos, **todas inteiras**
(`2` por herdada + `6` por amostra nova; o censo porta `0`). Exemplos:
`bytes-decodificados=160` (r1), `alcance-bytes-regiao=128` (s1/s2),
`bytes=128` (pin do corpo). Regra dura adotada: *chave que contém `bytes` só
porta inteiro*; os outros **quatro** nomes proibidos não aparecem como chave em
nenhum arquivo (0 ocorrências). O piso `>= 18` é guarda de não-vacuidade, **não**
limiar contratural, e a mensagem do teste diz isso.

**(b) §8 E2 aceita "string hexadecimal de comprimento 40 ou 64" — mas o
`comando` do `medir` embute um digest dentro de uma string mais longa.**
`rex-cfg medir` registra `--bin sha256=<64 hex>` no meio do comando; a letra
proibiria o comando inteiro. Regra dura adotada: **a do *run* contíguo** — todo
run de `[0-9a-f]` com ≥ 12 caracteres mede 40 ou 64, sobre o texto inteiro
(chaves incluídas), porque é assim que um dump de ROM apareceria. Distribuição
medida nos 8 arquivos versionados: `{40: 5, 64: 118}` — 5 SHA-1 de commit e 118
SHA-256 repartidos em 73 no `MANIFEST-ETAPA2.md`, 21 no `MANIFEST.md` e 24 nos
seis redigidos (por arquivo: censo 2, r1/r2/r3 2 cada, s1/s2 8 cada).
Comprimentos fora de {40, 64} = **0**.

**(c) §8 E1 pede `raizes` + `regiao` em "todo arquivo redigido" — mas o censo é
por sítio.**
`censo-iscas.redigido.json` não tem `raizes` nem `regiao` no topo: cada linha
declara `sitio`, `veredito`, `consumidor-validado`,
`promovivel-vinculo-estrutural`, `motivos` e `limites`, e a janela mora em `regra`
("janela alinhada de 128 bytes contendo o endereco"). Medição: **16** × `sitio`,
**16** × `veredito`. O teste trata o censo à parte e exige as 16 linhas; as cinco
evidências por região (r1/r2/r3/s1/s2) têm de trazer `raizes` com
`proveniencia`/`grau` e `regiao.inicio < regiao.fim`.

**(d) §8 E3 veda "o caminho local do `--bin`" no output — e §8 E1 exige `objeto`
com "caminho declarado".**
Os dois convivem só com escopo explícito. Regra dura: os campos que **reproduzem**
(`comando`, `comando-de-medicoes`) não contêm `/home/`, `~` nem `.bin` em nenhum
dos seis redigidos (0 ofensores), e o `medir` identifica o objeto por
`--bin sha256=c7da53a1…` (provado por `e3_o_comando_de_medicoes_identifica_o_objeto_por_sha`).
Inventário histórico pinado: **6** campos com caminho do operador, exatamente 2
por herdada — `caminho_declarado` (a ROM BYOR) e `caminho_local` (o output em
`~/rds-scratch/xe-c-evidencia/`) em `r1`, `r2` e `r3`. Nenhum redigido novo da
ETAPA 2 acrescenta caminho: `objeto.caminho_declarado` das novas é `<ROM>` e o
do instrumento é a frase "binutils pinado no cache do host; caminho local nao
versionado".

**Redação proposta (para o próximo congelamento, não para este):** E2 deve dizer
"*nenhum run contíguo de ≥ 12 hex com comprimento fora de {40, 64}; chave cujo
nome contenha `bytes` só porta inteiro*"; E1 deve escopar `raizes`/`regiao` às
evidências por região e exigir `sitio`/`veredito`/`regra` nas evidências por
sítio; E3 deve valer sobre "os campos de reprodução" e o manifesto pode carregar
caminho do operador desde que o JSON não carregue.

## 3. Isenções históricas da ETAPA 1 (preservadas por §8 E4, inventariadas)

§8 E4 manda preservar o que já foi publicado em `275f2af`; a auditoria então
registra o que as herdadas **não** têm, em vez de reescrevê-las:

| campo exigido por §8 | ausente em |
|---|---|
| `base-da-ferramenta` (E1) | `r1`, `r2`, `r3` |
| `instrumento` (E5) | `r1`, `r2`, `r3` |
| `veredito-do-comparador` (E5) | `r1`, `r2`, `r3` |
| a frase de limite `nao equivale` (E5/obrigação 8) | `r1`, `r2`, `r3` |
| caminho do operador no JSON (E3) | `r1`, `r2`, `r3` (2 campos cada) |

As três herdadas continuam **byte a byte** as publicadas: `r1 = d97cde0a…`,
`r2 = 524dd707…`, `r3 = c47f0f10…` — iguais em `0a5d917` e em `d4cb673`
(`git show 0a5d917:… | sha256sum` conferido). Cada ausência acima é uma
**igualdade exata** num teste; se alguém "melhorar" um redigido da ETAPA 1, a
auditoria falha e exige retificação datada.

O `MANIFEST.md` da ETAPA 1 ganhou o bloco do instrumento, a série bruta e a nota
datada ("Bloco acrescentado em 2026-10-05 pela auditoria da ETAPA 2, sem
reescrever os tres redigidos publicados na ETAPA 1") — extensão do gerador de
manifesto, não dos redigidos.

## 4. Remédio da E5 (o que passou a existir, e por onde)

A E5 pedia "cada evidência referencia o fixture/instrumento usados e o veredito
do comparador". Antes, o leitor que só tinha o JSON não sabia qual binutils
decidiu comprimento nem com que veredito. Depois:

* `instrumento` nos três redigidos novos:
  `nome = m68k-elf-objdump`, `versao = GNU objdump (GNU Binutils) 2.41`,
  `sha256 = e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f`,
  `flags = -b binary -m m68k -D`, `papel = "… paridade com objdump nao equivale a
  observacao em runtime (obrigacao 8)"`;
* `veredito-do-comparador` nos três: `criterios = [R1..R7]`,
  `divergencias-criticas = 0`, `marcas-emitidas = 48`,
  `serie-bruta = "MANIFEST-ETAPA2.md, secao \"serie bruta do comparador\" (versionada)"`;
* a **série bruta verbatim** (52 linhas) dentro dos dois manifestos versionados,
  além de `serie-bruta.txt` no diretório de trabalho fora do índice;
* o ponteiro pendurado do censo ("ver serie bruta acima", que não existia no
  JSON) foi apontado para a seção nominal do manifesto.

Reconciliação do `marcas-emitidas = 48` (para quem audita artefato, não
narração): o bloco versionado tem 52 linhas = 33 de `OK` + 16 de censo + 1 de
cabeçalho `--- censo …` + 1 de `nota:` + 1 de `FIM:`. O contador é tirado no
momento em que os JSONs são escritos, antes dos 4 marcadores finais
(`OK s1: evidencia…`, `OK s2: …`, `OK censo versionado: …`, `FIM:`); 52 − 4 = 48.
Ou seja: **48 marcas de comparação**, sem a contabilidade posterior.

Hashes dos redigidos novos mudaram em relação a `0a5d917` **porque dois campos
foram acrescentados dentro deles**, não porque a medição mudou:

| arquivo | em `0a5d917` | em `d4cb673` |
|---|---|---|
| `s1.redigido.json` | `0b09bf70c53dfafa…b666ee` | `110e5cda4f22be65…657ad3` |
| `s2.redigido.json` | `3dbf1de9a0a9c8fc…c2b4be` | `bb6db8baaa9d644d…c0a06a` |
| `censo-iscas.redigido.json` | `2a11fbdba1e8779d…154503` | `6c446c292824c7e5…8954ef` |

Verificado com `grep -rn "0b09bf70\|3dbf1de9\|2a11fbdb" docs/ scripts/ data/` →
**nenhuma citação**; nenhum documento versionado aponta para os hashes antigos,
então não há ponteiro a retificar. Os digests novos estão amarrados nas tabelas
dos manifestos (o teste `e5_manifesto_amarra_…` exige que a linha do manifesto
bata com o arquivo).

## 5. §4 R7 — a letra é demasiado larga para o eixo que ela pretendia fechar

R7 congelada: *"o censo de iscas do Apêndice B não entra como medição; ele só
dimensiona o negativo: a ferramenta é chamada nesses endereços e deve responder
`consumidor-validado: "nao"`"*.

Leitura literal dos 16 endereços do Apêndice B (série bruta versionada):

| eixo | medição |
|---|---|
| `consumidor-validado` | **sim = 12**, não = 4 |
| `promovivel-vinculo-estrutural` | **não = 16** (16/16) |
| registro do instrumento no endereço | 7 linhas com alvo **igual** ao do instrumento; 9 sem linha do instrumento (`instrumento=-`), das quais 5 ainda dão consumidor `sim` e 4 dão `nao` |
| violações sob a regra de promoção | **0** |

Ou seja: a letra de R7 daria **FAIL** em 12 dos 16 sítios por um motivo que não
é o defeito que ela visava. Os 12 são as iscas cuja codificação é *de fato* uma
forma de transferência reconhecida no endereço (`61 nn` = `bsr.s`, `4E B8` =
`jmp.abs.L`, `4E F8` = `jmp.l`, `4028A` com hipótese P-absW): a ferramenta
declara o consumidor **estrutural** e, onde o binutils tem linha no mesmo
endereço (7 casos), o alvo coincide com o do instrumento. O que as iscas não
obtêm — e é o negativo pedido pela obrigação 6 — é a **promoção**: raiz
`candidato` nunca autoriza vínculo (V2/CONTRACT §0.1), e o motivo exportado em
cada uma das 12 linhas é `proveniencia-nao-autoriza-vinculo:candidato` (uma
delas, `0x4028A`, acumula `interpretacao-pendente:abs-w-bit15`). Os quatro
consumidor `nao` e seus motivos medidos: `0x31DCC` dentro de `0x31DCA` →
`miolo-de-instrucao` (o negativo de interior); `0x3AB02` e `0x4F850`, padrão
`2A 7C` → `classe-condicional:movea` (não é consumidor); `0x66A40`, padrão
`4E FA` → `alvo-nao-comprovado`.

O censo já declara isso dentro do próprio JSON (`aspiracao-congelada` cita R7 e
`medido` explica o desvio), então a evidência não contradiz a expectativa por
silêncio. **Proposta de redação para o próximo congelamento:** R7 deve fixar
`promovivel-vinculo-estrutural = "nao"` em 16/16 e `veredito ∈ {instrucao-de-bloco,
miolo-de-instrucao}` conforme o padrão de bytes, e não `consumidor-validado =
"nao"` — que é o predicado errado para uma isca que é uma transferência real.
R7 também já diz que o censo "não entra como medição", e foi tratado como
dimensionamento do negativo: nenhum número de cobertura desta frente vem dele.

## 6. Pin obsoleto em `fixtures/MANIFEST.sha256` (achado pela auditoria)

A linha 13 fixava `fixtures/fx11assimetrica.s` com

* manifestado: `a99c7927f7e0a46ab17736728e7e7820982c8535905d148225b95363bb399797`
* real (e hoje verificado por teste): `94dbee7aad11888ea0263f26d99039cae639100620bd9cd2afce63539657590e`

O digest nunca bateu com o `.s` comitado — o pin está obsoleto desde `618b302`
(quando a fixture foi editada depois de gerar o manifesto). Não há citação ao
digest antigo em nenhum doc (`grep -rn "a99c7927" docs/ scripts/ data/` → 0). Os
pins do `.bin` (`83d3b991…`, 300 bytes) e do `-objdump.txt` (`a8884b7b…`) já
batiam; só a fonte `.s` estava errada, e era justamente a fonte que um leitor
precisa recompartir para reproduzir o binário. Corrigido e agora guardado por
`e5_o_manifesto_de_fixtures_conferir_byte_a_byte` (as **37** linhas do manifesto
são recomputadas uma a uma).

Pegadinha registrada (é o motivo pelo qual a remontagem "óbvia" não reproduz o
arquivo): `m68k-elf-as` sozinho deixa a realocação de `jsr longe_b:l` por
resolver — o byte 19 sai `00000000` em vez de `00000128` e o `.bin` diverge. A
receita correta está em `tools/make-fixtures.sh`:
`as → ld -Ttext 0 -e fx11 --build-id=none → objcopy -O binary -j .text`, e o
modo `--check` regenera em diretório temporário e exige igualdade:

```
$ bash tools/make-fixtures.sh --check
OK: 13 corpus reproduziveis a partir das fontes .s (objdump + bytes identicos)
```

## 7. E3 foi verificada por reexecução, não só por asserção

O comando registrado em cada redigido foi reexecutado no HEAD `d4cb673` e o tree
ficou **limpo** — prova de que a identidade por SHA funciona e que nada no
bundle depende de relógio:

```
$ CARGO_TARGET_DIR=$HOME/rds-scratch/xe-c-target bash executar-evidencia-C.sh
FIM: divergencias criticas = 0        rc da comparacao=0  falhas acumuladas=0
$ CARGO_TARGET_DIR=$HOME/rds-scratch/xe-c-target bash executar-amostras-reservadas-C.sh
FIM: divergencias criticas = 0        rc do comparador = 0
$ git status --porcelain              (vazio: os 8 arquivos versionados saem identicos)
```

## 8. Proposta de política ao integrador (sem alterar docs comuns)

Nada fora de `scripts|docs|data/rex_profiles/parallel_recovery_20261004/c/` foi
tocado; `docs/06_AI_MEMORY_BANK.md`, `ROUND_STATE` e manifestos comuns permanecem
reservados. Proposta, para o integrador decidir:

1. **Adotar a regra de E2 como teste de CI da frente C**, na forma durável do
   §2(b): *nenhum run contíguo de ≥ 12 hex com comprimento fora de {40, 64};
   chave com `bytes` só porta inteiro*. O teste já existe
   (`tests/auditoria_evidencia.rs`) e falha se um redigido futuro violar a
   política — é a forma que §8 E6 já previa.
2. **Dumps futuros da ROM BYOR fora do índice.** O único caso conhecido de
   bytes literais comerciais versionados é o Anexo A de `EXPECTATIONS-ETAPA1.md`
   (histórico `fbb8a3d`, ~160 bytes pinados antes do congelamento como
   tabela-ouro). A proposta é **preservar o histórico** (não reescrever) e mover
   dumps novos para o relatório local do operador; a correção do histórico fica
   sendo decisão do integrador, não desta frente.
3. **Identidade por digest, caminho só no manifesto.** JSON versionado referencia
   objeto e ferramenta por SHA-256 (`c7da53a1…` ROM, `e3a404cc…` objdump 2.41);
   `MANIFEST*.md` podem citar caminho do operador, porque são o registro de
   execução. Isso resolve a colisão (d) sem proibir reexecução local.
4. **Retificações datadas são o mecanismo, não a edição do congelado.** Os itens
   §2 (E1/E2/E3) e §5 (R7) são texto novo para o próximo ciclo de expectativas;
   nenhum limiar deste ciclo foi movido.
5. **Fixtures autorais continuam sendo o caminho de reprodução sem ROM**: o
   manifesto de fixtures é verificado byte a byte a cada execução da auditoria,
   e as 13 corpus recompilam idênticas com o toolchain pinado.

## 9. Limites do que foi feito aqui

* A auditoria é **estática**: nada neste adendo é observação em runtime; a
  obrigação 8 continua fechada por declaração dentro de cada evidência
  (`sem execucao`, `nao equivale`), não por esta auditoria.
* Escopo do scanner: os **8** arquivos versionados de
  `data/rex_profiles/parallel_recovery_20261004/c/evidence/`. Ele não prova
  ausência de bytes comerciais em outros territórios do repositório (o Anexo A de
  ETAPA 1, §8 E4, é o contraexemplo conhecido e está declarado).
* Não escrevi pipeline de CI nem toquei em docs comuns: item 1 é proposta.
* A auditoria de §8 **não** prova que as seis expectativas duras de §2 estejam
  todas presas por teste: **B1** (a ilha de dados inteira dentro de
  `cobertura.vaos`, sem truncamento por bounding box) não tem teste próprio com
  esse nome — o que fecha o caso são `b2_isca_em_dado_nao_alcancado_e_nega_com_veredito`
  (veredito + `consumidor-validado: "nao"` + `alvo` ausente em 4 sítios da ilha)
  e a coluna `alcance-vaos` do `medir`. A exigência de **B4** também é verificada
  *dentro* dos testes de B2/B3/B6, sem função chamada `b4_…`. Registro aqui
  porque a regra da frente é separar "executado" de "declarado".
* Gates da aplicação (`npm run host:diagnose`/`host:certify`, `lint`,
  `tsc --noEmit`, `npm test`) **não foram executados** nesta entrega: a mudança é
  confinada a `scripts|docs|data/…/c/` e não toca app, IPC, UI nem registro.
  `npm run check:tree` sim, por ser gate de território — resultado no informe.
