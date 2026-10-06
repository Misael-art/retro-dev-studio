# EXPECTACIONES CONXELADAS — paso 7 (letra A): consumo de `rex-cfg/v2` de C (2026-10-06)

Conxelado ANTES de construír calquera binario de C e antes de medir. Non se
reescriben §1–§7 de `RESPOSTA-D-A.md` nin a serie §8.1–§8.10: isto é serie
nova datada. Base do paso 7 (misión 3): «Consuma o resultado corrigido de C
cando exista. Inicio de instrución e alcance local non proban, sozinhos, o
argumento pasado á rotina.»

## 0. Obxecto consumido (SHA exacto)

- Source publicado de C: `5f97368942e3255e08e8f0dbe6e6ab6be8ab09e1`
  (`origin/codex/rex-parallel-c-cfg`, PR #108 OPEN, sen merge). Serie
  lineal desde `8ea5821`: `2a0dd298` (retificación datada), `5b459311`,
  `4d58544d`, `e54db1f8` (delta v1→v2 + `REVISAO-C-DE-A-ETAPA3.md`),
  `5f973689` (entrega: MOVEA inmediato, TRAP #15, política de enderezos v2).
  `f033b3b8` (abs.W con extensión de sinal + export v2) e `e828e721`
  (MOVEA/DBcc) son tamén ancestors. Verificado con
  `git merge-base --is-ancestor` desde a base de obxectos de A (fetch só,
  lectura).
- Extracción á metade do paso 6: `git archive` desa SHA (prefixos
  `scripts/rex_profiles/parallel_recovery_20261004/c` e `crates/rex-gameplay`)
  en `/home/misael/rds-scratch/rexcfg-5f97368`, compilación propia en
  `cfg-target-5f97368`. O pino é o **source SHA**, non o hash do binario
  (rexistrase o hash medido despois).

## 1. Predicións (rotas = FALLO con serie bruta, nunca reescrita)

- **V0** `rex-cfg` compila desde `5f973689` sen tocar A nin C (worktree de A
  só-leitura para C). Ródase `--help`/uso sen erro.
- **V1** Cruzamento da serie histórica §6.1 (`xe-a-evidencia-v11`, 10 cadeas
  cos pins do arnés v1) sobre o binario v2: **10/10 `OK-cadea`**, negativo de
  identidade `rc=2`, `fallos=0`.
- **V2** Cruzamento da serie declarada §8.6 (`xe-a-evidencia-m3c`: 9
  `par-declarado` + phelios-varredura, pins §8.6): **10/10 `OK-cadea`**,
  `fallos=0`. Predición derivada: sitios de carga/chamada idénticos aos da
  serie §6.1 (mesma parella histórica), logo os veredictos deben coincidir
  cos de V1 salvo onde a xanela derivada difira — calquera diverxencia
  explícase por bytes, non se relaxa.
- **V3 (digest conxelado v1 → predición v2)** os veredictos por enderezo
  (`sitios` no artefacto) deben ser **byte-identicos en digest** á serie v1
  §6.2, porque ningunha das 10 xanelas contén `(xxx).W` co bit15=1:
  | cadea | n | digest sha256 da serie de veredictos (v1, §6.2) |
  |---|---|---|
  | phelios-varredura | 5 | `15c2fff2bd05182646dee7f9463105b6d271d8e6ff9a66acc7963620b02aec9d` |
  | sonic-1364 | 7 | `9129ddd14d330d69a39e0c217a3dc6c60572fec0726abaefda4124e17bec9e3b` |
  | sonic-3082 | 7 | `8c85d3adb3f93f666cbab8bc561ad6dcb2592903430ffe7f762a739c46fde0bc` |
  | sonic-51BC | 7 | `b19e3cefdc791ef05fe00b746fa05080a79a4d0186824773b407666f5ff31d76` |
  | sor-087FC | 7 | `3d9c3d50b890125321ab25252b1d2b1f297bf142fd4195ff55ca98f51c68cf29` |
  | sor-08842 | 7 | `3e343a4a7e80e07a6da9d0c0cd9f494a2b9f26ff3977140d39c4200678ef8b13` |
  | sor-10636 | 7 | `03a0f82021dcc9245255d20cf883fff74d385a153c1b19e316719b213d753923` |
  | sor-10852 | 7 | `d24bba28a96759dadc5188473b01f8d7aa9726a92472b5ed00b5d4691a40ad65` |
  | sor-119B4 | 7 | `57907a09fd3b0a19ed834e90b177fdfe6f0071e60550d09a126d5d817496d34e` |
  | sor-16D2 | 7 | `91e3045830616e5f607c9e3a4cc3eacaace83aedec5bd4ee226deb4b25e0f830` |

  (valores copiados do instrumento, non á man: xerados por
  `python3` sobre `xe-a-rexcfg-cruzamento-final/*.rexcfg.json`, campo
  `sitios`, serie `endereco:veredito` unida por `;`)
- **V4 (R-3.3 asumida)** «verde» = non regresión: a semántica nova
  (extensión de sinal en `(xxx).W`) non é exercida por estas 10 xanelas
  (ningunha co bit15=1). Quen a proban: en C, N1/N2 `fx12_absW` + censo de
  máscaras; en A, controls K/§2 co instrumento pinado. Non se clama nada
  máis.
- **V5 campo `esquema`→`schema`**: o verificador `verificar-sitios.py` de A
  non le ese campo (consume `veredito`, `cobertura.vaos`, `raizes`,
  `fronteiras`), polo que **non se toca** — presérvase a identidade byte a
  byte que C rexistrou en `REVISAO-C-DE-A-ETAPA3.md` §4/§5. O seu docstring
  aínda di `rex-cfg/v1`: rexístrase como texto vello (§8 datado), non se
  reescribe.
- **V6 etiqueta `DBcc`** (`REVISAO-C-DE-A-ETAPA3.md` §1 punto 5,
  diverxente-da-referencia só de rótulo): a cabeceira de `src/instr.rs` di
  «`DBcc` `50..5F C0..DF`» cando a máscara real casa `Scc` **e** `DBcc`
  (`b1 & 0xC0 == 0xC0` → `C0..FF`). Corrixese **só o comentario**;
  comportamento idéntico (a recusa xa cubría os dous). O blob `instr.rs`
  cambia de sha (pino vello `72096ce7…` queda histórico en C, extraído con
  `git show bd40e92:`); rexístrase o sha novo. Suite completa verde antes e
  despois.
- **V7 cita de páxina** (`REVISAO-C-DE-A-ETAPA3.md` §1 punto 1): §2 de
  `RESPOSTA-D-A.md` cita «p. 2-17»; a páxina impresa do PRM é **2-18**
  (páxina do pdf 59). §1–§7 conxelados **non se reescriben**: corríxese en
  adenda datada §8.

## 2. Series conservadas

- v1 §6.2: log `0f38a530067f15673685b8a4c4e756a1a4fd2a1693521a79c514a39fb056cf58`,
  artefactos en `xe-a-rexcfg-cruzamento-final/`, arnés
  `cruzar-rexcfg-A.sh` (non se toca; a copia v2 chama-se
  `cruzar-rexcfg-v2-A.sh`).
- §8.1–§8.10 (misión 3): non se reescriben. Resultados v2 fan serie nova
  datada (§8.11+).
