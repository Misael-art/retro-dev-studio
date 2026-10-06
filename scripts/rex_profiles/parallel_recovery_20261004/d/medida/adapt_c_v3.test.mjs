/**
 * Controis do escore de C v3 e da retificación: miden a D, non a C. Cada invariante
 * ten un caso que o infrinxe; as mutacións viven no scratch e nunca tocan o gabarito pinado.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { presente, garantir } from "./ferramentas.mjs";
import { adaptarC3, avaliarCx5, DIR_V3, RESP } from "./adapt_c_v3.mjs";
import { retificarV2 } from "../frentes/author_c_v3.mjs";

const HAI = presente("C_novo2") && fs.existsSync(path.join(RESP, "dC-ho5-respostas.json"));
const TMP = path.join(process.env.HOME, "rds-scratch/d-c-v3-controis");
const TRUTH = path.join(DIR_V3, "dC-cx5-truth-v3.json");
const IMG = path.join(DIR_V3, "dC-cx5-v3.bin");
const ESQ = "rex-cfg-sitio/v2";

function mutar(nome, fn) {
  garantir(TMP);
  const t = JSON.parse(fs.readFileSync(TRUTH, "utf8"));
  fn(t);
  const p = path.join(TMP, `${nome}.json`);
  fs.writeFileSync(p, JSON.stringify(t));
  return p;
}
const av = (truthPath) => avaliarCx5({ chave: "C_novo2", conjunto: "controlo", truthPath, imgPath: IMG, esquemaSitio: ESQ });
const fila = (r, id) => r.linhas.find((l) => l.fila === id);

describe("retificación de KC1v-movea-l-imm-a1 (pura)", () => {
  it("a expectativa v3 é decodificar 6 B `movea` e a v2 queda como control histórico", () => {
    const t = retificarV2();
    const f = t.kc1.find((x) => x.id === "KC1v-movea-l-imm-a1");
    expect(f.espera_decodificacion).toBe(true);
    expect(f.esperado).toEqual({ tam: 6, stems: ["movea"] });
    expect(f.retificacion.expectativa_v2.fronteira).toBe(true);
    expect(f.retificacion.expectativa_v2.tipo).toBe("opcode-fora-do-subconjunto");
  });
  it("a verdade pinada en c-v3 coincide coa retificación regenerada", () => {
    const pin = JSON.parse(fs.readFileSync(path.join(DIR_V3, "dC-cx1-truth-v2.json"), "utf8"));
    expect(pin.kc1.find((x) => x.id === "KC1v-movea-l-imm-a1").espera_decodificacion).toBe(true);
  });
});

describe.skipIf(!HAI)("escore cx5 sobre a ferramenta real — cada invariante ten que poder fallar", () => {
  it("base: 13 filas, todas PASS e todas con gabarito/contrato v3-C", () => {
    const r = av(TRUTH);
    expect(r.linhas.length).toBe(13);
    expect(r.linhas.every((l) => l.veredito === "PASS" && l.contrato === "EXTENSOES-D v3-C")).toBe(true);
  }, 120_000);
  const casos = [
    ["V3-TR-8", "tam distinto", (t) => { t.filas.find((f) => f.id === "V3-TR-8").esperado.tam = 4; }],
    ["V3-TR-8", "fronteira distinta", (t) => { t.filas.find((f) => f.id === "V3-TR-8").esperado.fronteira = "opcode-fora-do-subconjunto"; }],
    ["V3-MV-1", "mnemónico distinto", (t) => { t.filas.find((f) => f.id === "V3-MV-1").esperado.stems = ["nop"]; }],
    ["V3-MV-0", "tam distinto", (t) => { t.filas.find((f) => f.id === "V3-MV-0").esperado.tam = 6; }],
    ["V3-AW-0", "alvo zero-estendido (o erro histórico)", (t) => { t.filas.find((f) => f.id === "V3-AW-0").esperado.alvo = 0x8000; }],
    ["V3-AW-2", "status distinto", (t) => { t.filas.find((f) => f.id === "V3-AW-2").esperado.status = "fora-da-regiao"; }],
    ["V3-CV-0", "barramento distinto", (t) => { t.filas.find((f) => f.id === "V3-CV-0").esperado.endereco_de_barramento = 0xffff8000; }],
    ["V3-CV-0", "offset non nulo onde é nulo", (t) => { t.filas.find((f) => f.id === "V3-CV-0").esperado.offset_de_objeto = 0x8000; }],
    ["V3-CV-2", "offset distinto", (t) => { t.filas.find((f) => f.id === "V3-CV-2").esperado.offset_de_objeto = 0x41; }],
    ["V3-CV-1", "promovible esperado «sim»", (t) => { t.filas.find((f) => f.id === "V3-CV-1").esperado.promovivel_vinculo_estrutural = "sim"; }],
  ];
  for (const [id, que, mut] of casos) {
    it(`${id}: ${que} ⇒ FAIL`, () => {
      const r = av(mutar(`${id}-${que}`.replace(/\W/g, "_"), mut));
      expect(fila(r, id).veredito).toBe("FAIL");
      expect(fila(r, id).divergencias.length).toBeGreaterThan(0);
    }, 120_000);
  }
  it("imaxe alterada nega (R1)", () => {
    garantir(TMP);
    const img = Buffer.from(fs.readFileSync(IMG));
    img[0] ^= 1;
    const p = path.join(TMP, "cx5-virada.bin");
    fs.writeFileSync(p, img);
    expect(() => avaliarCx5({ chave: "C_novo2", conjunto: "controlo", truthPath: TRUTH, imgPath: p, esquemaSitio: ESQ })).toThrow(/difire do pin/);
  });
  it("holdout: resposta reservada alterada nega contra o SHA pinado", () => {
    const d = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-c-v3-ho-"));
    try {
      const f = path.join(d, "dC-ho5-respostas.json");
      fs.writeFileSync(f, fs.readFileSync(path.join(RESP, "dC-ho5-respostas.json"), "utf8").replace('"tam": 2', '"tam": 4'));
      expect(() => adaptarC3({ chave: "C_novo2", conjunto: "holdout", respostasDir: d })).toThrow(/SHA pinado/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
  it("holdout: resposta ausente nega", () => {
    expect(() => adaptarC3({ chave: "C_novo2", conjunto: "holdout", respostasDir: path.join(TMP, "non-existe") })).toThrow(/ausente/);
  });
});
