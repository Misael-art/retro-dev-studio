# EXPECTATIONS-INSP-2026-10-05 — congelado ANTES de qualquer implementação ou medição

Escopo: entrega visível da ordem do operador (passos 9–11) — inspeção
**somente-leitura** de consumidores e recursos na camada Sonic 1, provada
pela interface. Este arquivo é commitado SOZINHO (precedente `b837986`/
`7331c88`); qualquer desvio observado depois vira FAIL honesto ou
INCONCLUSIVE com a série bruta registrada — nunca reescrita deste texto.

Referências de verdade: `INVENTARIO-CONGELADO.md` e
`REVISAO-B-C-D-2026-10-05.md` desta mesma rodada; cadeia da frente B
(PR #105 @ `08024d9`) reexecutada pelo integrador na ROM pinada.

## 1. Contrato do comando de produto

Comando Tauri novo, read-only, sem escrita, sem lock de edição:

```
rex_inspection_sonic_consumers(session_id) -> ConsumersInfo
```

- Fonte dos bytes: a MESMA sessão BYOR dos comandos Sonic existentes
  (`get_stored_session` + `read_sonic_session_rom`); a cópia acumulada do
  usuário NÃO é modificada pelo ato de inspecionar.
- Domínio: módulo novo `src-tauri/src/tools/reverse/decomp/sonic_consumers.rs`
  (constantes, verificação, recusas). `inspection.rs` só faz a ponte de
  sessão; a UI só renderiza — nenhuma regra no TypeScript.
- DTO `consumers-info/v1` em snake_case, campos congelados aqui:

```
perfil_id, perfil_rotulo, idioma="pt-BR",
identidade: { rom_sha256, rom_tamanho, confere_com_pin: bool, pin_sha256 },
sitios: [{ endereco, papel, esperado_hex, obtido_hex, ok }],       # 37 itens
veredito_sitios: "todos-ok" | "divergentes" | "fora-da-rom",
cadeia: { tabela_hex, entradas: [{ hex_entrada, offset_stream, lido_hex, ok }],
         chamada_hex, destino_hex, destino_classe: "wram"|"outra",
         valor_offset_param: 0 },
recursos: [{ indice, offset_hex, span_bytes, span_sha256, span_ok,
             plain_sha256_referencia, plain_status: "medido-externo" }],  # 6 itens
interpretacao: { celula_bytes: 1, linhas: 64, colunas: 64, stride: 128,
                 base_ram_hex, nivel: "vinculo-estrutural-estatico" },
mapindex: { addr_hex, entradas: 78, registro_id01_hex, id01_ok,
            ponteiro_id01_hex, ponteiro_dentro_rom: bool },
recusa_falso_lider: { modelo: "nametable-64x32-palavras-vdp",
                      veredito: "REFUTADA",
                      motivos: [3 textos fixos, abaixo] },
desconhecidos: [textos fixos, abaixo],
limites_fonte: { prova_cadeia_sha256, decoder_externo_sha256,
                 origem: "frente-b PR#105 reexecutada pelo integrador 2026-10-05" }
```

- Texto do veredito se a ROM não conferir com os sítios: os sítios
  divergentes são listados **e a cadeia/recursos/interpretação são recusados
  com motivo** — nunca um "ok" parcial silencioso.

## 2. Os sete níveis visíveis (UI) e o que cada um PODE alegar

| Nível na UI (título em português simples) | Alegação máxima permitida | Grau |
|---|---|---|
| 1. Que arquivo é este | SHA-256 e tamanho da ROM carregada; se coincide com o arquivo usado na medição | fato observado na sessão |
| 2. Perfil aplicado | "leitura medida do Sonic 1 (EUA/Europa), fase especial — experimento" | Experimental, rotulado |
| 3. Onde o jogo usa isto | os 37 sítios verificados byte a byte NA ROM carregada, com o papel de cada um | vínculo estrutural (verificado ao vivo) |
| 4. Cadeia de referências | tabela `0x1B64C` relida ao vivo → 6 entradas → chamada `jsr $171E` → destino `$FF4000` em RAM interna | vínculo estrutural |
| 5. Recurso | integridade: SHA-256 do span de cada stream conferido AO VIVO na ROM; o conteúdo decodificado é referenciado pelo SHA medido pela ferramenta externa pinada | referência estática + integridade observada; **decode no produto NÃO alegado** (licença, §REVISAO B) |
| 6. Interpretação | grade 64×64 de IDs de 1 byte copiada para `$FF1020` com linha de 128 bytes; **prévia gráfica NÃO é exibida como imagem confirmada** | recuperada estaticamente; arte/paleta não provadas |
| 7. O que ainda não se sabe | lista fixa do §4 | desconhecido declarado |

Cada nível mostra "por quê" em uma frase e link/âncora para o nível
relacionado (navegação evidência ↔ recurso exigida pelo passo 9 da ordem).

## 3. Consumidor verdadeiro e falso líder (passo 10)

- **Consumidor verdadeiro (demonstração):** o bloco `0x1B6E8..0x1B702` é
  mostrado como "é aqui que o jogo usa o recurso", porque os bytes da cópia
  (`lea $FF1020`, `moveq #63`×2, `move.b (a0)+,(a1)+`, `dbf`, `lea 64(a1)`)
  conferem NA ROM carregada. Teste-trava: fixture autoral com esses bytes
  nos endereços → `veredito_sitios = todos-ok` e a UI os marca como
  consumidor; inverter `move.b`→`move.w` na fixture → divergência pontual
  e recusa da cadeia.
- **Falso líder (recusa demonstrada):** o modelo "2048 palavras VDP /
  nametable 64×32 com flip/paleta/prioridade" aparece na UI **rotulado como
  recusado**, com os 3 motivos fixos:
  1. `a copia usa byte por byte (move.b medido em 0x1B6F8); um par de bytes
     nao forma uma celula de 16 bits`;
  2. `o destino medido e $FF4000, que e RAM interna; a porta do video e
     $C00004 — nenhum acesso a ela nestes sítios`;
  3. `a cada linha o programa salta 64 bytes (lea 64(a1) em 0x1B6FE);
     o modelo antigo nao tem esse vao`.
  A recusa é regra de bytes do produto (nível 6 recusa geometria pedida
  `64×32`/stride `64` com `motivos`), **não** import do crate C.
- **Nomenclatura adotada da régua C/D** (sem dependência): rótulos
  "candidato / referência estática / vínculo estrutural / não provado" por
  nível; veredito de sítio isolado descrito como "instrução de bloco" vs
  "miolo de instrução" apenas em texto.

## 4. Desconhecidos fixos (nível 7, literal obrigatório)

1. "A imagem destas fases ainda não foi comprovada: saber onde o dado vai e
   o que ele significa não prova como o console desenha aquilo."
2. "Nenhum trecho do jogo foi executado nesta análise: tudo foi lido dos
   bytes do arquivo."
3. "As cores (paleta) e os desenhos (art) referenciados pela tabela de IDs
   não foram reconstruídos nem conferidos."
4. "A decodificação Enigma dentro do app não está ativa: a ferramenta usada
   na medição é externa e sua licença impede copiar para o produto nesta
   rodada."
5. "Isto vale para o Sonic 1 (EUA/Europa) medido; outras versões podem ser
   diferentes e serão recusadas se os bytes não conferirem."

## 5. Testes exigidos (TDD, RED primeiro; autorais fora a prova BYOR)

Rust (`cargo test --lib`), fixtures autorais esparsas com os bytes pinados
colocados nos endereços — nada de ROM comercial nos testes:

- T1 `todos_os_sitios_conferem_na_fixture_medida` — 37/37 ok, `todos-ok`.
- T2 `inverter_operando_da_copia_recusa_cadeia` — tamper em `0x1B6F8` →
  sítio divergente listado + cadeia/recursos recusados.
- T3 `rom_curta_recusa_por_fora_da_rom` — fixture menor que `0x1B738+78*6`
  → `fora-da-rom`, zero "ok" silencioso.
- T4 `tabela_de_streams_e_relida_da_rom` — entradas trocadas na fixture →
  `entradas[].ok=false` nos índices certos.
- T5 `integridade_do_span_e_conferida` — 1 byte fora do span altera
  `span_sha256`; dentro do span ok→ok.
- T6 `mapindex_id01_e_ponteiro_conferem` — registro `$01` esperado; byte
  alterado → `id01_ok=false` e recusa.
- T7 `falso_lider_e_refutado_pelos_bytes` — `recusa_falso_lider.motivos`
  são exatamente os 3 textos do §3; geometria `64×32` pedida → recusa.
- T8 `inspecionar_nao_escreve` — `describe` recebe `&[u8]` (sem `mut`);
  teste compara a cópia da sessão byte a byte antes/depois.
- T9 `valores_fixos_do_contrato` — `valor_offset_param=0`, célula 1 byte,
  stride 128, base `$FF1020`, veredito nunca promovido (campo `nivel` fixo).

Frontend (`npm test`): a UI renderiza os 7 títulos, os 5 desconhecidos, a
recusa do falso líder, e NÃO exibe prévia gráfica como confirmada; estado
de carregamento/recusa vindos do DTO, sem regras duplicadas em TS.

Prova BYOR (fora do CI, só SHA-256 no índice): cenário de harness
`sonic-consumers-inspection` na ROM pinada `c7da53a1…` —
37/37 ok, 6/6 `span_ok`, `id01_ok`, recusa visível; interação classificada
pela taxonomia do handoff §6 (nativa para abrir painel; sonda técnica
rotulada onde houver dispatch programático).

## 6. Regressão obrigatória (passo 10/11)

- Edição Sonic existente intacta: comandos `cadence/sequence/duration` e
  seus testes inalterados; `sonic-sequencia-journey` REEXECUTADA no binário
  final do tip (matriz §8 do handoff — UI de `InspectionPanel` foi tocada).
- Barra completa no destino: `check:tree`, `lint`, `tsc --noEmit`,
  `npm test`, `cargo clippy -- -D warnings` (nunca `--all-targets`),
  `cargo test --lib`, `cargo fmt --check`, `crates:gates`,
  `host:diagnose` + `host:certify`.
- Um job pesado por vez na janela reservada; evidência nova em
  `data/rex_profiles/integration_20261005/evidencia-insp/` com SHA por
  arquivo; evidência herdada re-hash conferida e rotulada.

## 7. Critério de sucesso e de recusa

- SUCESSO = T1–T9 + testes TS + jornada sequencia verde + cenário
  `sonic-consumers-inspection` verde no MESMO binário do tip, com gates rc=0
  e contagens reconciliadas (executados ≠ alegados).
- FAIL honesto = qualquer divergência entre este contrato e o observado
  (ex.: sítio que não confere na ROM pinada). Registra-se a série bruta,
  não se move limiar, não se reescreve este arquivo.
- O degrau de maturidade NÃO se promove automaticamente; o registro dirá
  "inspeção-somente-leitura-provada-por-interface" como fato medido e
  deixará a promoção ao operador.
