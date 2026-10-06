# Matriz D v2 — capacidade × SHA × versión de gabarito

Xerada por `scripts/…/d/medida/matriz_v2.mjs` a partir de `data/…/d/medidas/*.jsonl` (cada evidencia auditada contra o seu manifesto). **Non editar a man.**

## Límites que a matriz non esconde

- A matriz mide **capacidades declaradas** coas expectativas do gabarito indicado; non mide «universalidade» e non hai ningunha cifra agregada. `VOID` = defecto de autoría de D retirado do denominador; `descoñecido` = sen medición posíbel.
- Ningunha liña chega a `consumo-observado` (non se executa ROM) nin a `equivalencia`: o nivel máximo publicado é `vinculo-estrutural`.
- A (A bd40e92): o holdout cobre xeometría, datos e enderezos novos; a gramática de A é pechada, así que **non xeneraliza a formas non declaradas**.
- C (8ea5821): a disxunción do holdout é de palabras e sitios, non de clases de instrución; un FAIL de `coherencia-contrato-código` é unha diverxencia prosa↔código, non un fallo de seguranza.
- B (da5472c): sen decoder Enigma independente, `KBE` non mide equivalencia de saída; `KBE-slot-5` e `KBE-equivalencia` quedan `descoñecido` (INCONCLUSIVE, non VOID: VOID reservase a defectos de autoría de D). O CRAM está só ao nivel `vinculo-estrutural` (E22 de B).
- A (A 6ae4f02): o contrato de emparellamento mudou por decisión versionada de A (xanela recta, limpa e única; o resto por `--chamada-sitio`); a medición v3 declara o par e a v2 sen declarar queda como control. `detectar` e as cadeas reais non se cobren.
- C (C 5f97368): a expectativa v2 de `KC1v-movea-l-imm-a1` está retificada (R-3). O FAIL de `HO-KC1v-movea-w-imm-a3` na regresión do holdout v2 é a mesma expectativa superada e aparece marcado. O holdout v2 reexecutado NON é holdout deste SHA.
- As filas do gabarito v1 conservan os seus vereditos históricos; a súa interpretación («A regrediu») está retificada en §12.16 e non se usa como gabarito do perfil corrixido.

## Medicións vixentes (gabarito v2)

| fronte | SHA | capacidade | conxunto | gabarito | nivel | pontuábeis | PASS | FAIL | desconh. | VOID | non puntuadas | evidencia |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | `bd40e92` | KA3v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA1v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA1v-neg | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA1v-fora | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA2v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA3v-g | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA4v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | TAv | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | TAv-controle | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-bd40e92-v2.jsonl` (`9db2a611b7…`) |
| A | `bd40e92` | KA3v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA1v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA1v-neg | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA1v-fora | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA2v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA3v-g | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | KA4v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | TAv | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| A | `bd40e92` | TAv-controle | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-holdout-v2.jsonl` (`48553809e9…`) |
| C | `8ea5821` | audit | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 9 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | KC1v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 21 | 20 | 1 | 0 | 0 | 0 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | KC2v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 6 | 6 | 0 | 0 | 0 | 0 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | KC3v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 1 | 1 | 0 | 1 | 1 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | KC4v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | KC5v | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 5 | 5 | 0 | 0 | 0 | 0 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | TCv | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | TCv-controle | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | interface-consultar | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 10 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | interface-medir | medición | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-8ea5821-v2.jsonl` (`900d55c58f…`) |
| C | `8ea5821` | audit | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 9 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | KC1v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 18 | 17 | 1 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | KC2v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | KC3v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 2 | 2 | 0 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | KC4v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 3 | 1 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | KC5v | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 5 | 5 | 0 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | TCv | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | TCv-controle | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | interface-consultar | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 10 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| C | `8ea5821` | interface-medir | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-holdout-v2.jsonl` (`6b297acf1c…`) |
| A | `6ae4f02` | KA3v | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA1v | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA1v-neg | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA1v-fora | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA2v | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA3v-g | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA4v | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | TAv | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | TAv-controle | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | SEGv-auto | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 6 | 6 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | SEGv-declarado | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | SEGv-neg | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 1 | 1 | 0 | 0 | 0 | 0 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | audit | medición v3 (par declarado + segmentos) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-6ae4f02-v3.jsonl` (`2187c7d990…`) |
| A | `6ae4f02` | KA3v | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA1v | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA1v-neg | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA1v-fora | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA2v | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA3v-g | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | KA4v | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | TAv | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 10 | 10 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | TAv-controle | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | SEGv-auto | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 6 | 6 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | SEGv-declarado | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 3 | 3 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| A | `6ae4f02` | SEGv-neg | holdout v3 compatible (novo; parcialmente visto, §12.17 e) | isa-oraculo-v2 / EXTENSOES-D v3-A | vinculo-estrutural | 1 | 1 | 0 | 0 | 0 | 0 | `A-6ae4f02-holdout-v3.jsonl` (`96c2790721…`) |
| C | `5f97368` | audit | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 0 | 0 | 0 | 0 | 0 | 9 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC1v | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 25 | 25 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC2v | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 6 | 6 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC3v | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 2 | 2 | 0 | 0 | 1 | 1 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC4v | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 10 | 10 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC5v | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 5 | 5 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | TCv | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | TCv-controle | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | interface-consultar | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 0 | 0 | 0 | 0 | 0 | 10 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | interface-medir | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | CVv | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 3 | 3 | 0 | 0 | 0 | 0 | `C-5f97368-v3.jsonl` (`3dadf70d6b…`) |
| C | `5f97368` | KC4v | holdout v3 compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 6 | 6 | 0 | 0 | 0 | 0 | `C-5f97368-holdout-v3.jsonl` (`22151637e3…`) |
| C | `5f97368` | KC1v | holdout v3 compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 4 | 4 | 0 | 0 | 0 | 0 | `C-5f97368-holdout-v3.jsonl` (`22151637e3…`) |
| C | `5f97368` | CVv | holdout v3 compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v3-C | referencia-estatica | 3 | 3 | 0 | 0 | 0 | 0 | `C-5f97368-holdout-v3.jsonl` (`22151637e3…`) |
| C | `5f97368` | audit | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 0 | 0 | 0 | 0 | 0 | 9 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | KC1v | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 18 | 17 | 1 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | KC2v | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | KC3v | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 2 | 2 | 0 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | KC4v | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | KC5v | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 5 | 5 | 0 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | TCv | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 4 | 4 | 0 | 0 | 0 | 0 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | TCv-controle | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | interface-consultar | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 0 | 0 | 0 | 0 | 0 | 10 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| C | `5f97368` | interface-medir | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | — | 0 | 0 | 0 | 0 | 0 | 1 | `C-5f97368-regresion-holdout-v2.jsonl` (`152182ba9f…`) |
| B | `da5472c` | KB2v | medición (gabarito novo por capacidade) | isa-oraculo-v2 / EXTENSOES-D v2-B | vinculo-estrutural | 2 | 2 | 0 | 0 | 0 | 0 | `B-da5472c-v2.jsonl` (`4d890aedab…`) |
| B | `da5472c` | KB1v | medición (gabarito novo por capacidade) | isa-oraculo-v2 / EXTENSOES-D v2-B | vinculo-estrutural | 5 | 5 | 0 | 0 | 0 | 0 | `B-da5472c-v2.jsonl` (`4d890aedab…`) |
| B | `da5472c` | KBC | medición (gabarito novo por capacidade) | isa-oraculo-v2 / EXTENSOES-D v2-B | vinculo-estrutural | 7 | 7 | 0 | 0 | 0 | 0 | `B-da5472c-v2.jsonl` (`4d890aedab…`) |
| B | `da5472c` | audit | medición (gabarito novo por capacidade) | isa-oraculo-v2 / EXTENSOES-D v2-B | — | 0 | 0 | 0 | 0 | 0 | 4 | `B-da5472c-v2.jsonl` (`4d890aedab…`) |
| B | `da5472c` | KBE | medición (gabarito novo por capacidade) | isa-oraculo-v2 / EXTENSOES-D v2-B | referencia-estatica | 11 | 11 | 0 | 0 | 0 | 2 | `B-da5472c-v2.jsonl` (`4d890aedab…`) |

## B en `da5472c` co gabarito v1 (reexecutado, **non cobre CRAM nin decoder nativo**)

| fronte | SHA | capacidade | conxunto | gabarito | nivel | pontuábeis | PASS | FAIL | desconh. | VOID | non puntuadas | evidencia |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | `da5472c` | KB1 | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | KB2 | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | KB3 | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | KB4 | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | NB | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | audit | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 3 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |
| B | `da5472c` | TC | medición (gabarito v1 reexecutado) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 1 | `B-da5472c.jsonl` (`0b0f4aa0a2…`) |

## Control histórico (gabarito v1, non é gabarito do perfil corrixido)

| fronte | SHA | capacidade | conxunto | gabarito | nivel | pontuábeis | PASS | FAIL | desconh. | VOID | non puntuadas | evidencia |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | `cbb6895` | KA3 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | KA1 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 9 | 9 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | KA1-b | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | KA2 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | KA3-g | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | KA4 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 3 | 3 | 0 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | TA | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 8 | 7 | 1 | 0 | 0 | 0 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `cbb6895` | TA-controle | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-cbb6895.jsonl` (`d05ce278a4…`) |
| A | `bd40e92` | KA3 | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 1 | 1 | 0 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | KA1 | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 9 | 4 | 5 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | KA1-b | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | KA2 | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | KA3-g | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | KA4 | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 3 | 2 | 1 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | TA | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 8 | 6 | 2 | 0 | 0 | 0 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| A | `bd40e92` | TA-controle | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 1 | `A-bd40e92.jsonl` (`c2004f89e9…`) |
| B | `396e0b8` | KB1 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | KB2 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | KB3 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | KB4 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | NB | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | audit | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 3 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `396e0b8` | TC | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 1 | `B-396e0b8.jsonl` (`c506f0ffeb…`) |
| B | `cffe17f` | KB1 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | KB2 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | KB3 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 0 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | KB4 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | NB | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 2 | 2 | 0 | 0 | 0 | 0 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | audit | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 3 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| B | `cffe17f` | TC | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 1 | `B-cffe17f.jsonl` (`d47f10e456…`) |
| C | `275f2af` | audit | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 0 | 0 | 0 | 0 | 0 | 5 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | KC1 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 20 | 19 | 1 | 0 | 0 | 0 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | KC2 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 6 | 6 | 0 | 0 | 0 | 0 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | KC3 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 3 | 2 | 1 | 0 | 0 | 0 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | KC4 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 3 | 1 | 0 | 0 | 0 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | KC5 | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 5 | 5 | 0 | 0 | 0 | 0 | `C-275f2af.jsonl` (`7e5969d099…`) |
| C | `275f2af` | TC | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | — | 4 | 4 | 0 | 0 | 0 | 1 | `C-275f2af.jsonl` (`7e5969d099…`) |

## Perdas (FAIL) vixentes

| fronte | SHA | conxunto | gabarito | capacidade | fila | razón |
|---|---|---|---|---|---|---|
| C | `8ea5821` | medición | isa-oraculo-v2 / EXTENSOES-D v2 | KC1v | `KC1v-movea-l-imm-a1` | **SUPERADA:** expectativa v2 superada por R-3 de C + instrumento (§12.17 c); en 5f97368 a fila retificada dá PASS. §12.10 h conxelou a expectativa de fronteira (a lista de §3 non admite inmediato en MOVEA). §12.10 j re-etiqueta o eixe: se a ferramenta dec |
| C | `8ea5821` | medición | isa-oraculo-v2 / EXTENSOES-D v2 | KC3v | `KC3v-move-b-para-an` | **SEGUIMENTO:** en `5f97368` a mesma fila dá PASS (medición v3). restaura en v2 a clase «combinação inválida detectábel» que §12.6 tivo que retirar (`327c` é MOVEA.W lexítima, non hai codificación propia). |
| C | `8ea5821` | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | KC1v | `HO-KC1v-movea-w-imm-a3` | **SUPERADA:** mesma expectativa v2 superada (§12.17 c); non se re-gradúa a evidencia, publícase como superada. §3 di «`#imm` só em MOVE», así que a prosa restringe o inmediato tamén a MOVEA.L; o instrumento codifica e decodifica `367C1234` como `movea |
| C | `8ea5821` | holdout compatible (novo) | isa-oraculo-v2 / EXTENSOES-D v2 | KC4v | `HO-KC4-trap-15` | **SEGUIMENTO:** defecto real de C (máscara de TRAP de 3 bits) corrixido en `5b45931`; en `5f97368` a mesma fila dá PASS na regresión e `V3-TR-8`/`HO-TR-9`/`HO-TR-15` pasan (§12.17 b). fronteira opaca graduada como recusa limpa, co vocabulario real de C (R13: {"indirect-opaco":"indirect-opaque","fora-da-rexión":"fora-da-reg |
| C | `5f97368` | regresión: holdout v2 gastado (NON é holdout deste SHA) | EXTENSOES-D v2 (holdout gastado de 8ea5821; reexecución, non holdout deste SHA) | KC1v | `HO-KC1v-movea-w-imm-a3` | **SUPERADA:** mesma expectativa v2 superada (§12.17 c); non se re-gradúa a evidencia, publícase como superada. §3 di «`#imm` só em MOVE», así que a prosa restringe o inmediato tamén a MOVEA.L; o instrumento codifica e decodifica `367C1234` como `movea |

## VOID vixentes (defecto de autoría de D, retirados do denominador)

| fronte | SHA | conxunto | gabarito | capacidade | fila | razón |
|---|---|---|---|---|---|---|
| D | `8ea5821` | medición | isa-oraculo-v2 / EXTENSOES-D v2 | KC3v | `KC3-bsr-l-68020-VOID` | §12.10 i: BSR.S está DENTRO da lista de §3 (liñas 88-90) e a lectura do byte depende da táboa de símbolos do desmontador (`bsrs` nun bloque, |
| D | `5f97368` | medición v3 (expectativa retificada + cx5) | isa-oraculo-v2 / EXTENSOES-D v3-C | KC3v | `KC3-bsr-l-68020-VOID` | §12.10 i: BSR.S está DENTRO da lista de §3 (liñas 88-90) e a lectura do byte depende da táboa de símbolos do desmontador (`bsrs` nun bloque, |

## Controis non puntuados con resultado incoherente/inconclusivo (vixentes)

| fronte | SHA | conxunto | fila | veredito | razón |
|---|---|---|---|---|---|
| C | `8ea5821` | medición | `CONTROLE-CONSULTAR-CX3-0x000012` | INCOHERENTE | §12.11 b: mesma expectativa conxelada, outra interface. Acordo non promove a capacidade; desacordo é achado publicable. |
| C | `8ea5821` | medición | `CONTROLE-MEDIR-CX2` | INCONCLUSIVE | capacidade presente en 8ea5821 e non exercitada polo denominador: publícase como `descoñecido`, non como heredada de `analyze` (R18) |
| C | `8ea5821` | holdout compatible (novo) | `CONTROLE-COHERENCIA-CX4` | INCOHERENTE | a cobertura é exactamente Σ das instrucións decodificadas (22 B) e ningunha fronteira suma bytes: se o valor difire de 20, o motivo é unha i |
| C | `8ea5821` | holdout compatible (novo) | `CONTROLE-MEDIR-CX2` | INCONCLUSIVE | capacidade presente en 8ea5821 e non exercitada polo denominador: publícase como `descoñecido`, non como heredada de `analyze` (R18) |
| C | `5f97368` | medición v3 (expectativa retificada + cx5) | `CONTROLE-MEDIR-CX2` | INCONCLUSIVE | capacidade presente en 8ea5821 e non exercitada polo denominador: publícase como `descoñecido`, non como heredada de `analyze` (R18) |
| C | `5f97368` | regresión: holdout v2 gastado (NON é holdout deste SHA) | `CONTROLE-MEDIR-CX2` | INCONCLUSIVE | capacidade presente en 8ea5821 e non exercitada polo denominador: publícase como `descoñecido`, non como heredada de `analyze` (R18) |
| B | `da5472c` | medición (gabarito novo por capacidade) | `KBE-slot-5` | INCONCLUSIVE | non hai un oitavo ponteiro independente que delimite o fin do sexto slot: o tamaño non se adiviña |
| B | `da5472c` | medición (gabarito novo por capacidade) | `KBE-equivalencia` | INCONCLUSIVE | non hai decoder independente: `enigma_research.py` é da familia B (espello, R10) e o decoder externo foi excluído por política |

## Perdas e VOID históricos (gabarito v1; ver §12.16 para a interpretación)

| fronte | SHA | conxunto | gabarito | capacidade | fila | razón |
|---|---|---|---|---|---|---|
| A | `cbb6895` | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | TA | `TA-5` | operando .L alterado no registro, imagem inalterada |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA1 | `KA1-2` | ERRO(4): fluxo: enderezo 0xFF8400 en rexión work-ram sen backing ROM |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA1 | `KA1-bsr.l` |  |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA1 | `KA1-jsr.w` |  |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA1 | `KA1-jmp.l` |  |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA1 | `KA1-jmp.w` |  |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | KA4 | `KA4-2` |  |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | TA | `TA-3` | chamada real declarada nun sitio lexítimo fóra da ventá tras a carga: só a xeometría pode rexeitala. Erata pré-medição de D: a receita origi |
| A | `bd40e92` | medición histórica (gabarito v1 sobre o SHA novo) | v1 (táboa ISA antiga / bytes a man; control histórico) | TA | `TA-5` | operando .L alterado no registro, imagem inalterada |
| C | `275f2af` | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | KC1 | `KC1-movea.l #imm32,A1` | C aceptou unha forma fóra da súa lista fechada §3 sen declarala soportada; o eixo desta fila é a fronteira, non o comprimento |
| C | `275f2af` | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | KC3 | `KC3-move-w-imm-an` | combinação destino An em MOVE.W é inválida no ISA |
| C | `275f2af` | medición histórica | v1 (táboa ISA antiga / bytes a man; control histórico) | KC4 | `KC4-jmp-ind-an` |  |

