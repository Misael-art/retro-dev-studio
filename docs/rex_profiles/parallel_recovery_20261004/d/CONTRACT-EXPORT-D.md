# CONTRACT-EXPORT-D — formato `rds-d-export/1`

**Status:** contrato v1 do que qualquer frente (A/B/C ou futuras) deve exportar
para ser medido pela barra D. O runner (`scripts/.../d/runner.mjs`) é
`fail-closed`: nada ausente vira PASS nem contagem zero favorável.

## 1. Envelope JSON

```jsonc
{
  "export_format": "rds-d-export/1",           // obrigatorio; senao => INCONCLUSIVE global
  "producer": {
    "front": "a|b|c|d",                        // quem produziu
    "tool": "nome-da-ferramenta",
    "version": "ou SHA do commit/binario",
    "artifact_sha256": "sha256 do binario/commit pinado"   // medicao sempre por SHA
  },
  "fixture": { "set": "dev-1|ho-1", "sha256": "..." },     // SHA do fixture analisado
  "evidence": [ { "sha256": "...", "kind": "round_trip|external_instrument|..." } ],
  "regions": [ { /* item por regiao detectada, ver §2 */ } ],
  "notes": "opcional"
}
```

Se `fixture.sha256` não bater com o ground truth (ou o export inteiro faltar),
o resultado é **INCONCLUSIVE global com motivo** (regra R4) — nunca "0 erros".

## 2. Item de região

```jsonc
{
  "byte_addr": 36,                // offset de byte no fixture (identidade da regiao)
  "class": "stream|geom|table|pixels",
  "codec": "dsb1-lz|dsb1-rle|dsb1-store|kosinski|tiles4bpp-planar|pixels4bpp|branch-table",
  "consumers": [ { "id": "C-…", "addr_mode": "word|byte", "declared_target": 36 } ],
  "output":   { "byte_len": 480, "sha256": "…" } | null,
  "geometry": { "width": 16, "height": 16, "bpp": 4, "layout": "planar" } | null,
  "flow":     { "edges": [ { "from_byte_addr": 980, "to_byte_addr": 1020 } ] } | null,
  "confidence": "candidate|static_ref|structural|observed|recovered|proved",
  "proof":    { "kind": "…", "artifact_sha256": "…" } | null,
  "status":   "ok" | "unknown",
  "unknown_reason": "texto (obrigatorio quando status=unknown)"
}
```

Níveis de confiança (a escada da missão — um nível não implica o seguinte):
`candidate` (existe) → `static_ref` (referência estática) → `structural`
(vínculo estrutural consumidor→alvo) → `observed` (consumo observado) →
`recovered` (semântica recuperada) → `proved` (reconstrução equivalente com
prova anexada). Só `proved` **com prova indexada** conta no numerador de D7.

## 3. Campos ausentes vs. vazios

- **Campo da dimensão ausente em todos os itens** (ex.: nada traz `consumers`)
  ⇒ a dimensão fica `INCONCLUSIVE` com `ausentes = denominador` (R1).
- **Lista vazia** (`consumers: []`) é uma reivindicação: se o ground truth
  tem consumidores, vira `FAIL` com `ausentes ≥ 1`.
- **Export com `regions: []`** ⇒ `FAIL` com cobertura 0 em CADA dimensão
  (expectativa §7) — não-reivindicação não é verificação.
- O denominador vem sempre do ground truth, nunca do export (R2).

## 4. Regras de prova (R3–R7)

- `PASS` em dimensão exige `ausentes == 0`, `divergências == 0`,
  `falsos vínculos == 0`.
- `confidence: proved` sem `proof.artifact_sha256` presente em `evidence` e
  coerente com a saída/fixture ⇒ item rebaixado a `unknown_sem_prova`, contado
  em `unknowns`, **não** soma no numerador (R5).
- `status: unknown` é resposta honesta: registrada com endereço e motivo, mas
  não soma acerto (R6).
- Divergência de saída nunca é "quase": registra os dois hashes (R7).

## 5. Saída do runner

Uma linha por dimensão (`D1..D7, N1, N2`): `acerto/denominador`, ausentes,
divergências, falsos vínculos, unknowns, medidos, veredito. **Proibido**
publicar percentual único misturando codec, geometria e fluxo. O veredito
global segue a precedência `FAIL > violação de negativos > INCONCLUSIVE > PASS`.

## 6. Como medir

```
node scripts/rex_profiles/parallel_recovery_20261004/d/cli.mjs score \
  --truth data/rex_profiles/parallel_recovery_20261004/d/dev/ground-truth.json \
  --export <caminho-do-export> [--out-dir <dir>]
```

A evidência (`.md` + `.json` com SHA do próprio export) fica em
`data/.../d/medicoes/`. Medições de `ho-1` só após o unseal, com o gabarito
fora da árvore até lá.
