/**
 * Controis do escore de A v3 (segmentos): miden a D, non a A.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { presente, garantir } from "./ferramentas.mjs";
import { avaliarSegmentos, adaptarA3 } from "./adapt_a_v3.mjs";

const RAIZ_D = path.join(process.cwd(), "data/rex_profiles/parallel_recovery_20261004/d/frentes");
const TRUTH = path.join(RAIZ_D, "a/dA-seg-v3-truth.json");
const IMG = path.join(RAIZ_D, "a/dA-seg-v3.bin");
const RESP = path.join(process.env.HOME, "rds-scratch/rex-heldout-d3");
const HAI = presente("A_6ae4f02");
const TMP = path.join(process.env.HOME, "rds-scratch/d-a-v3-controis");

function mutar(nome, fn) {
  garantir(TMP);
  const t = JSON.parse(fs.readFileSync(TRUTH, "utf8"));
  fn(t);
  const p = path.join(TMP, `${nome}.json`);
  fs.writeFileSync(p, JSON.stringify(t));
  return p;
}
const av = (truthPath) => avaliarSegmentos({ chave: "A_6ae4f02", conjunto: "controlo", truthPath, imgPath: IMG });
const fila = (r, id) => r.linhas.find((l) => l.fila === id);

describe.skipIf(!HAI)("escore de segmentos v3 — cada invariante ten que poder fallar", () => {
  it("base: 10 filas PASS, 6 auto + 3 declarado + 1 negativo", () => {
    const r = av(TRUTH);
    expect(r.linhas.length).toBe(10);
    expect(r.linhas.every((l) => l.veredito === "PASS")).toBe(true);
    expect(r.linhas.filter((l) => l.capacidade === "SEGv-auto").length).toBe(6);
  }, 120_000);
  const casos = [
    ["SEG-limpo", "confianza esperada distinta", (t) => { t.casos[0].esperado.auto.confianza = "referencia-estatica"; }],
    ["SEG-limpo", "par-declarado non debería aparecer en auto (vira exixido)", (t) => { t.casos[0].esperado.auto.nao_contem = ["emparellamento-ventana-heuristico"]; }],
    ["SEG-bra", "rótulo de rotura distinto", (t) => { t.casos[1].esperado.auto.contem = ["segmento-roto:roto-rts"]; }],
    ["SEG-rts", "esperar promoción onde A non debe", (t) => { t.casos[2].esperado.auto = { rc: 0, confianza: "vinculo-estrutural", chamada: true }; }],
    ["SEG-dous", "esperar un candidato", (t) => { t.casos[4].esperado.auto.contem = ["ventana-ambigua:1-candidatos"]; }],
    ["SEG-nop", "esperar promoción automática entre nop (o contrato v2 antigo)", (t) => { t.casos[5].esperado.auto = { rc: 0, confianza: "vinculo-estrutural", chamada: true }; }],
    ["SEG-limpo", "sitio de chamada esperado distinto", (t) => { t.casos[0].chamada_sitio += 2; }],
    ["SEG-limpo", "hash de saída esperado distinto", (t) => { t.fluxo.plain_sha256 = "0".repeat(64); }],
    ["SEG-declarado-non-chamada", "negativo cun sitio que SI é chamada", (t) => { t.negativo.chamada_declarada = t.casos[5].chamada_sitio; }],
  ];
  for (const [id, que, mut] of casos) {
    it(`${id}: ${que} ⇒ FAIL`, () => {
      const r = av(mutar(`${id}-${que}`.replace(/\W/g, "_"), mut));
      expect(r.linhas.some((l) => l.veredito === "FAIL")).toBe(true);
      void fila;
    }, 120_000);
  }
  it("imaxe alterada nega (R1)", () => {
    garantir(TMP);
    const img = Buffer.from(fs.readFileSync(IMG));
    img[0x201] ^= 1;
    const p = path.join(TMP, "seg-virada.bin");
    fs.writeFileSync(p, img);
    expect(() => avaliarSegmentos({ chave: "A_6ae4f02", conjunto: "controlo", truthPath: TRUTH, imgPath: p })).toThrow(/difire do pin/);
  });
  it("holdout: resposta reservada alterada nega contra o SHA pinado", () => {
    const d = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-a-v3-ho-"));
    try {
      const f = path.join(d, "dA-seg-ho-v3-respostas.json");
      fs.writeFileSync(f, fs.readFileSync(path.join(RESP, "dA-seg-ho-v3-respostas.json"), "utf8").replace('"rc": 0', '"rc": 1'));
      expect(() => adaptarA3({ chave: "A_6ae4f02", conjunto: "holdout", respostasDir: d })).toThrow(/SHA pinado/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});
