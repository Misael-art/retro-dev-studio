/**
 * Controis do escore de B v2: miden a D, non a B. Cada invariante do escore ten un
 * caso que o infrinxe; sen eles, 25/25 PASS non diría nada.
 * `arquivoVerdade` aponta a unha copia mutada no scratch: o gabarito pinado nunca se toca.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BYOR, FERRAMENTAS, SCRATCH_V2, garantir, presente } from "./ferramentas.mjs";
import { adaptarB2 } from "./adapt_b_v2.mjs";

const HAI = presente("B_da5472c") && fs.existsSync(BYOR.rom) && fs.existsSync(FERRAMENTAS.B_da5472c.enigma);
const RAIZ_T = path.join(process.env.HOME, "rds-scratch/d-b-v2-controis");
const VERDADE = path.join(process.cwd(), "data/rex_profiles/parallel_recovery_20261004/d/frentes/b/dB-truth-v2.json");

function mutar(nome, fn) {
  garantir(RAIZ_T);
  const t = JSON.parse(fs.readFileSync(VERDADE, "utf8"));
  fn(t);
  const p = path.join(RAIZ_T, `${nome}.json`);
  fs.writeFileSync(p, JSON.stringify(t));
  return p;
}
const fila = (r, id) => r.linhas.find((l) => l.fila === id);

describe.skipIf(!HAI)("escore B v2 sobre a ferramenta real — cada invariante ten que poder fallar", () => {
  it("base: 25 filas puntuables, todas con gabarito e contrato v2-B, e ningunha de equivalencia", () => {
    const r = adaptarB2();
    const pont = r.linhas.filter((l) => l.pontua !== false);
    expect(pont.length).toBe(25);
    expect(pont.every((l) => l.gabarito === "isa-oraculo-v2" && l.contrato === "EXTENSOES-D v2-B")).toBe(true);
    expect(r.linhas.some((l) => ["consumo-observado", "equivalencia"].includes(l.extras?.nivel) && l.pontua !== false)).toBe(false);
    expect(fila(r, "KBE-equivalencia").veredito).toBe("INCONCLUSIVE");
    expect(fila(r, "KBE-slot-5").veredito).toBe("INCONCLUSIVE");
  }, 120_000);

  it("pin: un gabarito alterado sen o ponto de inxección nega", () => {
    const d = path.join(RAIZ_T, "dir-alterado");
    garantir(d);
    const t = JSON.parse(fs.readFileSync(VERDADE, "utf8"));
    t.tabela_ponteiros.ponteiros[0] += 2;
    fs.writeFileSync(path.join(d, "dB-truth-v2.json"), JSON.stringify(t));
    expect(() => adaptarB2({ dirVerdade: d })).toThrow(/diverxe do hash/);
  });

  it("ROM adulterada: non se mide (R0)", () => {
    garantir(RAIZ_T);
    const rom = Buffer.from(fs.readFileSync(BYOR.rom));
    rom[0x469b] ^= 1;
    const p = path.join(RAIZ_T, "rom-virada.bin");
    fs.writeFileSync(p, rom);
    expect(() => adaptarB2({ romPath: p })).toThrow(/ROM BYOR/);
  });

  const casos = [
    ["KB1v-copia-byte", "bytes esperados distintos", (t) => { t.sitios.find((s) => s.id === "kb1-copia-byte").esperado_bytes = "12d9"; }],
    ["KB2v-tabela", "ponteiro esperado distinto", (t) => { t.tabela_ponteiros.ponteiros[2] += 2; }],
    ["KBC-pal-special", "SHA esperado distinto", (t) => { t.kbc.pal_special.sha256 = "0".repeat(64); }],
    ["KBC-pal-index", "entrada esperada distinta", (t) => { t.kbc.pal_index.entradas[3].ponteiro += 8; }],
    ["KBC-ss-tabela", "SHA da táboa distinto", (t) => { t.kbc.ss_wall_tabela.sha256 = "f".repeat(64); }],
    ["KBC-hipotese", "hipótese esperada distinta", (t) => { t.kbc.hipotese.escolhida_por_B = "H_A"; }],
    ["KBC-blink", "campo .w esperado distinto", (t) => { t.kbc.hipotese.campos_lidos_por_D.ani0_time = "0xFEC2"; }],
    ["KBE-slot-0", "tamaño de slot distinto", (t) => { t.kbe.slots[0].esperado_bytes_armazenados += 2; }],
    ["KBE-trunc-menos-un", "código aceitado distinto", (t) => { t.kbe.truncamentos[2].codigos_aceitados = [3]; }],
  ];
  for (const [id, que, mut] of casos) {
    it(`${id}: ${que} ⇒ FAIL`, () => {
      const r = adaptarB2({ arquivoVerdade: mutar(id.replace(/\W/g, "_"), mut) });
      expect(fila(r, id).veredito).toBe("FAIL");
      expect(fila(r, id).divergencias.length).toBeGreaterThan(0);
    }, 120_000);
  }
});
