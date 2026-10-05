/**
 * Probas do oráculo de ISA 68000 (frente D, rolda 3).
 *
 * O que se audita aquí é o *gabarito versionado*, non a implementación de A/B/C.
 * Cada aserción existe para impedir un modo concreto de virar verde sen merecelo:
 *   1. que o gabarito se edite a man despois de xerado (control por `filas_sha256`),
 *   2. que se acepte como ditame dun instrumento cuxa identidade non está pinada,
 *   3. que unha fila «valida» non teña bytes reais (placeholder),
 *   4. que os feitos decisorios da retificación se perdan cando alguén re-xere.
 *
 * Non son probas que repitan o decodificador de D: o ditame vén de `m68k-elf-as`
 * / `m68k-elf-objdump` e aquí comprébanse mnemónicos e bytes concretos do instrumento.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { FERRAMENTAS, RAIZ } from "./ferramentas.mjs";

const GABARITO = path.join(
  RAIZ,
  "data/rex_profiles/parallel_recovery_20261004/d/gabarito/isa-oraculo-v2.json",
);
const sha = (b) => createHash("sha256").update(b).digest("hex");

const gab = JSON.parse(fs.readFileSync(GABARITO, "utf8"));
const fila = (id) => {
  const f = gab.filas.find((x) => x.id === id);
  expect(f, `sonda ausente no gabarito: ${id}`).toBeTruthy();
  return f;
};
const primeiraLiña = (id) => (fila(id).desmontaxe ?? "").split("\n")[0] ?? "";
/** Columna do mnemónico da primeira instrución desmontada. */
const mnemonico = (id) => primeiraLiña(id).split("\t").slice(-1)[0].trim();
const desmontaxe = (id) => fila(id).desmontaxe ?? "";

const HAY_FERRAMENTA =
  fs.existsSync(gab.instrumento.montador) && fs.existsSync(gab.instrumento.desmontador);
/** A árbore de A vive na copia *scratch* pinada: se non está, a liñaxe non se alega. */
const PIN_INSTRUMENTO_A = path.join(
  FERRAMENTAS.A_corrixido.arvore,
  FERRAMENTAS.A_corrixido.rel,
  "fixtures/INSTRUMENTO.sha256",
);

describe("oráculo ISA — identidade do instrumento", () => {
  it("o gabarito declara Binutils 2.41 coa bandeira -m68000", () => {
    expect(gab.esquema).toBe("rex-parallel-d/oraculo-isa/1");
    expect(gab.version).toBe("isa-oraculo-v2");
    expect(gab.instrumento.version).toMatch(/GNU assembler \(GNU Binutils\) 2\.41/);
    expect(gab.instrumento.bandeira).toEqual(["-m68000"]);
  });

  it.skipIf(!HAY_FERRAMENTA)(
    "os SHA-256 pinados baten co binario que hai no host",
    () => {
      expect(gab.instrumento.sha256["m68k-elf-as"]).toBe(
        "618740559477258165eb1a344e07acd592afc1438061825469d5bd56fa2c87c7",
      );
      expect(gab.instrumento.sha256["m68k-elf-objdump"]).toBe(
        "e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f",
      );
      expect(sha(fs.readFileSync(gab.instrumento.montador))).toBe(
        gab.instrumento.sha256["m68k-elf-as"],
      );
      expect(sha(fs.readFileSync(gab.instrumento.desmontador))).toBe(
        gab.instrumento.sha256["m68k-elf-objdump"],
      );
    },
  );

  it.skipIf(!fs.existsSync(PIN_INSTRUMENTO_A))(
    "liñaxe compartida con A: A cita o mesmo montador (limitación, non proba de independencia)",
    () => {
      const texto = fs.readFileSync(PIN_INSTRUMENTO_A, "utf8");
      expect(texto).toContain(gab.instrumento.sha256["m68k-elf-as"]);
      expect(texto).toContain("m68k-elf-as");
    },
  );
});

describe("oráculo ISA — integridade do gabarito versionado", () => {
  it("`filas_sha256` bate coa recomposición do array: editar unha fila canta", () => {
    expect(sha(Buffer.from(JSON.stringify(gab.filas), "utf8"))).toBe(gab.filas_sha256);
  });

  it("46 sondas: 42 montan con bytes reais, 4 recusadas sen bytes", () => {
    expect(gab.filas.length).toBe(46);
    const montan = gab.filas.filter((f) => f.rc_montador === 0);
    expect(montan.length).toBe(42);
    for (const f of montan) {
      expect(f.bytes_hex, `${f.id}: fila «valida» sen bytes (placeholder)`).toMatch(/^[0-9a-f]+$/);
      expect(f.bytes_hex.length % 2, f.id).toBe(0);
      expect(f.tam, f.id).toBe(f.bytes_hex.length / 2);
      expect(f.desmontaxe, `${f.id}: sen desmontaxe`).toBeTruthy();
    }
    for (const f of gab.filas.filter((x) => x.rc_montador !== 0)) {
      expect(f.bytes_hex ?? "", f.id).toBe("");
      expect(f.erro_montador, `${f.id}: recusa sen motivo`).toBeTruthy();
    }
  });

  it("as únicas sondas con bytes repetidos son os dous pares intencionados", () => {
    const grupos = {};
    for (const f of gab.filas.filter((x) => x.bytes_hex)) (grupos[f.bytes_hex] ||= []).push(f.id);
    const duplicados = Object.values(grupos).filter((v) => v.length > 1).map((v) => v.sort());
    expect(duplicados).toEqual([
      ["bruto-lea-8400-w", "lea-abs-w-alto"],
      ["bsr-plain", "bsr-w"],
    ]);
  });

  it("o gabarito non leva marcas de tempo (é re-xerábel en CI)", () => {
    expect(Object.keys(gab).sort()).toEqual([
      "esquema",
      "filas",
      "filas_sha256",
      "instrumento",
      "version",
      "xerado_por",
    ]);
    expect(JSON.stringify(gab)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("oráculo ISA — feitos decisorios da retificación (rolda 3)", () => {
  it("absolute short EXTÉNDESE POR SIGNO: 43f8 8400 → 0xffff8400", () => {
    expect(fila("bruto-lea-8400-w").bytes_hex).toBe("43f88400");
    expect(desmontaxe("bruto-lea-8400-w")).toContain("ffff8400");
    expect(fila("bruto-lea-8400-w").efectivo_dito_polo_desmontador).toBe("ffff8400");
    // e non só en `lea`: tamén en jsr/jmp/movea
    for (const id of ["jsr-abs-w-alto", "jmp-abs-w-alto", "movea-w-mem-w", "movea-l-mem-w"]) {
      expect(desmontaxe(id), id).toContain("ffff8400");
    }
  });

  it("o límite está no bit 15: 7fff cero-extende, 8000 esténdese a ffff8000", () => {
    expect(mnemonico("abs-w-limite-7fff")).toBe("lea 7fff <inicio+0x7fff>,%a1");
    expect(fila("abs-w-limite-7fff").efectivo_dito_polo_desmontador).toBe("0x7fff");
    expect(mnemonico("abs-w-limite-8000")).toBe("lea ffff8000 <inicio+0xffff8000>,%a1");
    expect(fila("abs-w-limite-8000").efectivo_dito_polo_desmontador).toBe("ffff8000");
  });

  it("`4efa` é `jmp (d16,%pc)`, NON `jsr.w` (que é `4eb8`)", () => {
    expect(fila("jmp-pc-d16").bytes_hex).toBe("4efa0100");
    expect(mnemonico("jmp-pc-d16")).toContain("jmp %pc@");
    expect(fila("jsr-abs-w-baixo").bytes_hex).toBe("4eb81234");
    expect(mnemonico("jsr-abs-w-baixo")).toMatch(/^jsr /);
    // `bruto-4efa-d16pc` é exactamente a codificación que D puxo na sonda KA1-jsr.w de v1
    expect(fila("bruto-4efa-d16pc").bytes_hex).toBe("4efa1f00");
    expect(desmontaxe("bruto-4efa-d16pc")).toContain("jmp %pc@");
    expect(desmontaxe("bruto-4efa-d16pc")).not.toContain("jsr");
  });

  it("4efc / 4efd NON teñen mnemónico en 68000: o desmontador devolve `.short`", () => {
    const shorts = gab.filas.filter((f) => desmontaxe(f.id).includes(".short"));
    expect(shorts.map((f) => f.id).sort()).toEqual(["bruto-4efc", "bruto-4efd"]);
    expect(mnemonico("bruto-4efc")).toBe(".short 0x4efc");
    expect(mnemonico("bruto-4efd")).toBe(".short 0x4efd");
    // as dúas son as palabras que AGRAMA v1 chamaba `jmp.l` e `jmp.w`
    expect(fila("bruto-4efd").bytes_hex).toBe("4efd00001f00");
    expect(fila("bruto-4efc").bytes_hex).toBe("4efc1f00");
  });

  it("`bsr.l` e `movec` son de 68020: a recusa dun perfil 68000 é xusta (requisito 7)", () => {
    for (const id of ["bsr-l", "movec-cacr"]) {
      const f = fila(id);
      expect(f.rc_montador, id).not.toBe(0);
      expect(f.erro_montador, id).toMatch(/invalid instruction for this architecture/);
      expect(f.classe_instrumento, id).toBe("recusada-68020");
    }
    // e a lectura bruta do seu código (`61ff`) só existe como `bsrl` de 68020
    expect(mnemonico("bruto-61ff-bsrl")).toMatch(/^bsrl /);
  });

  it("MOVEA.W e MOVEA.L son MC68000 válidos (requisito 4)", () => {
    const esperados = {
      "movea-w-inm": "327c1234",
      "movea-l-inm": "227c00001234",
      "movea-w-dn": "3240",
      "movea-l-dn": "2240",
      "movea-w-an": "3248",
      "movea-l-an": "2248",
    };
    for (const [id, bytes] of Object.entries(esperados)) {
      expect(fila(id).bytes_hex, id).toBe(bytes);
      expect(fila(id).rc_montador, id).toBe(0);
      expect(mnemonico(id), id).toMatch(/^movea[wl] /);
    }
    // `movea.w` dun absoluto curto tamén extende por signo
    expect(fila("movea-w-mem-w").bytes_hex).toBe("32788400");
    expect(desmontaxe("movea-w-mem-w")).toContain("ffff8400");
  });

  it("desprazamentos relativos contan desde a palabra de extensión (sitio + 2)", () => {
    expect(fila("bsr-s").bytes_hex).toBe("61024e71");
    expect(mnemonico("bsr-s")).toBe("bsrs 4 <alvo>");
    expect(fila("bsr-w").bytes_hex).toBe("610000044e71");
    expect(mnemonico("bsr-w")).toBe("bsrw 6 <alvo>");
    expect(fila("lea-pc-d16-pos").bytes_hex).toBe("43fa0100");
    expect(mnemonico("lea-pc-d16-pos")).toContain("102 <inicio");
    // d16 negativo: 0x43fa 0xff00 desde 0 → -254, efectivo 0xffffff02
    expect(fila("lea-pc-d16-neg").bytes_hex).toBe("43faff00");
    expect(mnemonico("lea-pc-d16-neg")).toContain("ffffff02");
  });

  it("`1031 2000` é unha instrución MC68000 lexíble: recusalo é opción de subconxunto, non de seguranza", () => {
    expect(fila("bruto-1031-move-w-idx").bytes_hex).toBe("10312000");
    expect(mnemonico("bruto-1031-move-w-idx")).toBe("moveb %a1@(0,%d2:w),%d0");
  });

  it("`jmp2abs`/`jmp2abs.l` non existen en GAS: non son mnemónicos do ISA", () => {
    for (const id of ["jmp2abs-texto", "jmp2abs-l-texto"]) {
      expect(fila(id).rc_montador, id).not.toBe(0);
      expect(fila(id).erro_montador, id).toMatch(/Unknown operator/);
    }
  });
});

describe("oráculo ISA — reprodución", () => {
  it.skipIf(!HAY_FERRAMENTA)(
    "re-xerar desde cero produce o mesmo `filas_sha256`",
    async () => {
      const { executarOraculo } = await import("./oraculo_isa.mjs");
      const dir = fs.mkdtempSync(path.join(process.env.HOME, "rds-scratch/d-oraculo-repro-"));
      try {
        const { gabarito } = executarOraculo({ saida: dir });
        expect(gabarito.filas_sha256, "a autoría do oráculo deixou de ser determinista").toBe(
          gab.filas_sha256,
        );
        expect(gabarito.filas.length).toBe(gab.filas.length);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
