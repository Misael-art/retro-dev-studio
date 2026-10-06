/**
 * Adaptador v2 da frente C (`rex-cfg`) — executa a ferramenta REAL en `8ea5821`
 * sobre as fixtures `dC-*-v2` e pontúa co contrato EXTENSOES-D v2.
 *
 * Tres diferenzas structurais respecto de `adapt_c.mjs` (v1), cada unha
 * consecuencia dun defecto *medido* ou *documentado* na rolda 2 e non dun capricho:
 *
 * 1. **Renumeração de citaacións (§12.11 a).** As `citacao_C` dos gabaritos pinned
 *    están numeradas en `275f2af`; a medición é en `8ea5821`, onde `§3/§4/§6`
 *    desprazan +79 liñas. Cada fila publica o número derivado **e comprábao**: o
 *    texto citado ten que aparecer nas liñas orixinais de `275f2af` *e* nas derivadas
 *    de `8ea5821`. Se ancore no vello e non no novo, o adaptador **falla** (o mapa
 *    sería un erro de D). `citacao_estado` publica o ditame: `verificada` (ancora
 *    nos dous SHA), `resumida` (D abreviou con elipse: non é comprobábel) ou
 *    `sen-texto-citabel` (hai números de liña, pero ningún entrecomillado ancore).
 *    Os dous últimos son límites visibles, non un PASS.
 * 2. **R13 — normalización explícita de vocabulario.** `indirect-opaco` →
 *    `indirect-opaque` e `fora-da-rexión` → `fora-da-regiao` só aquí, cunha táboa
 *    publicada; a evidencia v1 non se reescribe.
 * 3. **§12.11 b — escopo de interfaces.** O denominador (42) exerce `analyze`.
 *    `consultar` e `medir` non teñen filas conxeladas: publícanse como controles
 *    `pontua: false` (o primeiro enfróntase aos 10 `esperado_veredito` xa pinsados;
 *    do segundo rexístrase que existe e con que esquemas) e a súa capacidade queda
 *    `descoñecido` na matriz.
 *
 * Nada aquí calcula un valor esperado: as expectativas vêm dos catro gabaritos
 * `dC-*-truth-v2.json` e do `pin-c-v2.json`, xerados e commiteados antes.
 *
 * Uso:
 *   node scripts/…/d/medida/adapt_c_v2.mjs
 *   node scripts/…/d/medida/adapt_c_v2.mjs --chave C_novo --conjunto holdout
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  FERRAMENTAS,
  FIXTURES,
  PIN,
  RAIZ,
  SCRATCH_V2,
  addr,
  bytesDoCommit,
  executar,
  garantir,
  gravarBin,
  gravarEvidencia,
  linha,
  lerEnd,
  sha256,
  sha256Arquivo,
  shaFerramenta,
  presente,
  verificarProcedencia,
} from "./ferramentas.mjs";

const VERBO = "rex-cfg";
const DIR_C = path.join(FIXTURES, "c");
const OUT_C = path.join(SCRATCH_V2, "c");
const NOME_PIN = "pin-c-v2.json";
const GABARITO = "isa-oraculo-v2";
const CONTRATO = "EXTENSOES-D v2";
const ESQUEMA_ANALYZE = "rex-cfg/v1";
const ESQUEMA_SITIO = "rex-cfg-sitio/v1";
const ESQUEMA_MEDIR = "rex-cfg-med/v1";
const FIXTURES_C = ["dC-cx1", "dC-cx2", "dC-cx3", "dC-cx4"];
const CAMINO_CONTRATO = "docs/rex_profiles/parallel_recovery_20261004/c/CONTRACT.md";
export const GABARITO_ISA = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/gabarito/isa-oraculo-v2.json");
const CAMINO_EXTENSOES = "docs/rex_profiles/parallel_recovery_20261004/d/EXTENSOES-D.md";

/** §12.11 c) — precedencia comprobada, non narrada. Unha medición de C feita nunha
 *  árbore de D onde o adendo que a habilita aínda non está commiteado é inválida por
 *  construción, así que o adaptador **nega** en vez de publicala. Lese o documento do
 *  HEAD da propia árbore de D (`RAIZ`), non do checkout canónico. `commitDeD` é o
 *  punto de inxección do control negativo: sen el non se podería provar que a porta
 *  nega, porque o HEAD real sempre contén a sección. */
export function verificarPrecedencia(commitDeD = null) {
  const head = commitDeD ?? execFileSync("git", ["-C", RAIZ, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const doc = bytesDoCommit(head, CAMINO_EXTENSOES).toString("utf8");
  for (const marca of ["## 12.11", "### c) Precedencia"]) {
    if (!doc.includes(marca)) {
      throw new Error(
        `§12.11 c) incumprida: «${marca}» non está no commit de D ${head}; ` +
          `non se publica evidencia cuxo contrato aínda non está commiteado`,
      );
    }
  }
  return { secao: "§12.11", commit_de_D: head, contido_no_commit: true };
}

/** R11: que di o instrumento sobre *eses* bytes. `sen-fila` é un limite visible
 *  (o oráculo non os cubriu), non un silencio: a fila pontúa e publícase o estado. */
export function cargarOraculo(p = GABARITO_ISA) {
  const g = JSON.parse(fs.readFileSync(p, "utf8"));
  const refeito = sha256(Buffer.from(JSON.stringify(g.filas), "utf8"));
  if (g.version !== GABARITO) throw new Error(`oráculo de ISA con versión allea: ${g.version}`);
  if (refeito !== g.filas_sha256) throw new Error(`oráculo de ISA alterado: filas_sha256 ${g.filas_sha256} ≠ refeito ${refeito}`);
  return new Map((g.filas ?? []).filter((f) => f.bytes_hex).map((f) => [f.bytes_hex.toLowerCase(), f]));
}

const RECUSA_INSTRUMENTO = /\.short\b|out of bounds/i;

/**
 * Que di o instrumento sobre *eses* bytes, e con que fonte.
 *
 * `gabarito` — `isa-oraculo-v2` ten fila para eses bytes concretos: é a fonte
 *   con maior autoridade e a que R11 nomea.
 * `sondeo-pinado` — o gabarito non os cubriu, pero a propia fila do gabarito
 *   trae `sondeo` coa saída crúa do mesmo instrumento (mesmo `objdump`, mesma
 *   bandeira `-m68000`) e ese arquivo está hash-pinado en `pin-c-v2.json`. Úsase
 *   porque sen el 19 das 21 filas de `KC1v` quedarían sen ditame, e unha porta
 *   que só se activa onde houbo cobertura é arbitraria.
 * `ningunha` — ningunha das dúas: publícase `sen-fila-no-oraculo`, que é un
 *   límite visible, non un silencio.
 */
export function ditame(porBytes, bytesHex, sondeo = null) {
  const alvo = String(bytesHex ?? "").toLowerCase();
  const f = porBytes.get(alvo);
  if (!f) {
    const s = sondeo?.instrumento ?? sondeo ?? {};
    const dsm = String(s.desmontaxe ?? "");
    if (!dsm) return { estado: "sen-fila-no-oraculo", orixe: "ningunha", bytes: String(bytesHex ?? "").toUpperCase() };
    return {
      estado: RECUSA_INSTRUMENTO.test(dsm) ? "recusa-do-desmontador" : "valida-polo-instrumento",
      orixe: "sondeo-pinado",
      tam: s.lonxitude ?? sondeo?.lonxitude ?? null,
      desmontaxe: dsm.split("\n")[0].trim(),
      mnemonico: s.mnemonico ?? null,
    };
  }
  if (f.rc_montador !== 0) return { estado: "recusado-polo-montador", orixe: "gabarito", id: f.id, erro: f.erro_montador };
  return {
    estado: RECUSA_INSTRUMENTO.test(f.desmontaxe ?? "") ? "recusa-do-desmontador" : "valida-polo-instrumento",
    orixe: "gabarito",
    id: f.id,
    tam: f.tam,
    desmontaxe: String(f.desmontaxe ?? "").split("\n")[0].trim(),
  };
}

/**
 * R11 aplicada onde lle corresponde. A regra di que unha expectativa de D que
 * contradiga o **ISA** é defecto de D; pero unha fila de `C` pode esperar
 * fronteira sen que o ISA a exixa, porque §3 de C é unha **lista fechada**:
 *
 * - `fronteira-acordada` — D afirma que o ISA *non* codifica eses bytes. É o
 *   dominio de R11: se o instrumento si os decodifica, a expectativa é mentira
 *   sobre o ISA e a fila retírase contra D (`KC3v-linha-f` e `KC3v-move-b-para-an`).
 * - `fora-do-subconjunto-de-C` — D afirma que a lista de C non admite a forma
 *   (`203A0020`: MOVE.L con fonte PC-relativo, ISA válido e o instrumento
 *   decodifícao). Un contrato de subconxunto pechado **debe** recusar formas
 *   válidas; se o instrumento puidese anular esa expectativa, non havería forma
 *   de auditar §3. Aquí o instrumento corrobora, non refuta.
 * - `coherencia-contrato-codigo` — §12.10 (j): a expectativa mide se o código de
 *   C honra a súa propia frase de §3. Non é unha afirmación sobre o ISA, así que
 *   R11 non a toca e a fila pontúa (precisamente por iso se re-etiquetou o eixe).
 * - `alegado-por-C` — a ferramenta promete soportar, logo ten de decodificar co
 *   `tam` ditado polo instrumento: alí o gabarito si é a vara, e xa o era en v1.
 */
export const PORTA_R11 = "fronteira-acordada";
export function portaR11(row, oraculo) {
  if (row?.dominio !== PORTA_R11) return { naPorta: false, contradice: false };
  const esperaFronteira = row.espera_decodificacion !== true && row.esperado?.fronteira !== false;
  return { naPorta: true, contradice: esperaFronteira && oraculo.estado === "valida-polo-instrumento" };
}

const lerp = (v) => (typeof v === "string" ? lerEnd(v) : v);

/** R13: única fonte da normalización; vive no adaptador, non na evidencia v1. */
export const TABELA_VOCABULARIO = Object.freeze({
  "indirect-opaco": "indirect-opaque",
  "fora-da-rexión": "fora-da-regiao",
  "fora-da-rexion": "fora-da-regiao",
});
export function vocab(v) {
  return typeof v === "string" ? TABELA_VOCABULARIO[v] ?? v : v;
}

/** §12.11 a: un único hunk de 79 liñas inserido despois da antiga liña 72. */
export const UMBRAL_RENUMERACION = 73;
export const DESPRAZO = 79;
export const mapearLiña = (n, d = DESPRAZO) => (n >= UMBRAL_RENUMERACION ? n + d : n);

/** Reescribe unha citaación co número derivado do SHA medido. */
export function derivarCitacao(cit, d = DESPRAZO) {
  if (typeof cit !== "string") return null;
  return cit.replace(/liñas?\s+(\d+)(\s*[-–]\s*(\d+))?/giu, (todo, a, _sep, b) =>
    b === undefined ? `liña ${mapearLiña(+a, d)}` : `liñas ${mapearLiña(+a, d)}-${mapearLiña(+b, d)}`,
  );
}

const RE_CITA = /liñas?\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*[::]?\s*(?:[^«»]{0,24}?)«([^»]{6,})»/giu;
const norm = (s) => s.replace(/[\s`*]+/g, "").replace(/[«»]/g, "");
const franxa = (liñas, a, b) => norm(liñas.slice(Math.max(0, a - 2), b + 1).join(""));

/**
 * Comprobación de procedencia da citaación, nos dous sentidos: o texto ten que
 * ancorar nas liñas orixinais de `275f2af` **e** nas derivadas de `8ea5821`.
 * `verificada` ⇒ polos menos un par ancorea nos dos; `resumida` ⇒ D abreviou a
 * citaación (elipse `…`) e non é comprobábel, publícase como limite; se ancora
 * no vello e non no novo, o mapa do §12.11 é falso e isto **lanza**.
 */
export function verificarCitacao(cit, vello, novo, d = DESPRAZO) {
  const pares = [...(cit ?? "").replaceAll(/[\r\n]+/g, " ").matchAll(RE_CITA)].map((m) => ({
    a: +m[1],
    b: m[2] ? +m[2] : +m[1],
    texto: m[3],
  }));
  if (pares.length === 0) return { estado: "sen-texto-citabel", pares: 0, comprobados: 0 };
  let ok = 0;
  for (const p of pares) {
    const q = norm(p.texto);
    const noVello = franxa(vello, p.a, p.b).includes(q);
    const noNovo = franxa(novo, mapearLiña(p.a, d), mapearLiña(p.b, d)).includes(q);
    if (noVello && !noNovo) {
      throw new Error(
        `§12.11 falso: «${p.texto.slice(0, 60)}…» ancorea en 275f2af:${p.a}-${p.b} pero non en 8ea5821:${mapearLiña(p.a, d)}-${mapearLiña(p.b, d)}`,
      );
    }
    if (noVello && noNovo) ok += 1;
  }
  return {
    estado: ok > 0 ? "verificada" : "resumida",
    pares: pares.length,
    comprobados: ok,
  };
}

/** Índices de lectura do export `rex-cfg/v1` (nunca de D). */
function indice(exp) {
  const ins = new Map();
  const blocosPorEntrada = new Map();
  for (const b of exp?.blocos ?? []) {
    blocosPorEntrada.set(b.entrada, b);
    for (const i of b.instrucoes ?? []) if (!ins.has(i.endereco)) ins.set(i.endereco, i);
  }
  const porOrigem = new Map();
  for (const a of exp?.arestas ?? []) {
    if (!porOrigem.has(a.origem)) porOrigem.set(a.origem, []);
    porOrigem.get(a.origem).push(a);
  }
  const fronteiras = new Map((exp?.fronteiras ?? []).map((f) => [f.endereco, f]));
  const chamadas = new Map((exp?.chamadas ?? []).map((c) => [c.sitio, c]));
  const sitios = new Map((exp?.sitios ?? []).map((s) => [s.endereco, s]));
  const blocoQueContem = (end) =>
    (exp?.blocos ?? []).find((b) => (b.instrucoes ?? []).some((i) => end >= i.endereco && end < i.endereco + i.tam)) ?? null;
  return { ins, porOrigem, fronteiras, chamadas, sitios, blocosPorEntrada, blocoQueContem };
}

const div = (campo, esperado, medido) => ({ campo, esperado, medido: medido === undefined ? null : medido });

export function adaptarC2({ chave = "C_novo", conjunto = "medicao", dirVerdade = null, gabaritoIsa = GABARITO_ISA, desprazo = DESPRAZO } = {}) {
  if (!presente(chave)) return { ausente: true, linhas: [], descricao: null };
  const f = FERRAMENTAS[chave];
  const bin = f.bin;
  const sha = f.sha;
  // O holdout v2 aínda non está construído (tarefa #20): mentres non haxa
  // entradas públicas con respostas conxeladas, `--conjunto holdout` nega en
  // vez de inventar un caminho. Unha medición con expectativas adiviñadas non
  // sería unha medición.
  if (conjunto !== "medicao")
    throw new Error(`conjunto «${conjunto}» sen gabarito conxelado: o holdout v2 de C non está construído`);
  const dirFix = DIR_C;
  // `dirVerdade` é o ponto de inxección dos controis negativos: una copia mutada
  // nunha fila *nunca* toca a árbore (os pins de `pin-c-v2.json` seguirían
  // comprobando os arquivos reais). Sen isto, nada probaría que o escore non é vacuo.
  const verdade = (fix) => {
    const nome = `${fix}-truth-v2.json`;
    if (dirVerdade && fs.existsSync(path.join(dirVerdade, nome))) return path.join(dirVerdade, nome);
    return path.join(dirFix, nome);
  };
  const imagem = (fix) => path.join(dirFix, `${fix}-v2.bin`);
  const pin = JSON.parse(fs.readFileSync(path.join(DIR_C, NOME_PIN), "utf8"));
  const contr = {
    vello: bytesDoCommit(PIN.C, CAMINO_CONTRATO).toString("utf8").split("\n"),
    novo: bytesDoCommit(sha, CAMINO_CONTRATO).toString("utf8").split("\n"),
  };
  const stats = {
    citacion: { verificadas: 0, resumidas: 0, sen_texto_citabel: 0, pares: 0, comprobados: 0 },
    // R11 conta só as filas do dominio que graduúa; a cobertura do instrumento
    // publícase separada para que se vexa onde a porta ten vara e onde non.
    r11: { filas_na_porta: 0, contradicitas: 0, conformes: 0 },
    instrumento: { gabarito: 0, "sondeo-pinado": 0, ningunha: 0 },
  };
  const porBytes = cargarOraculo(gabaritoIsa);

  garantir(OUT_C);
  const linhas = [];
  const brutos = [];

  const argsAnalyze = (fix, { raizes, sitios, binArquivo, out }) => {
    const t = JSON.parse(fs.readFileSync(verdade(fix), "utf8"));
    const reg = t.regioes[0];
    const args = [
      "analyze",
      "--bin",
      binArquivo ?? path.relative(RAIZ, imagem(fix)),
      "--origin",
      addr(t.origin ?? 0),
      "--region",
      `${addr(reg.inicio)}:${addr(reg.fim)}`,
      "--region-prov",
      "regiao-autoral-D",
    ];
    for (const r of raizes ?? t.raizes) {
      args.push(
        "--root",
        addr(r.endereco),
        "--root-prov",
        r.proveniencia,
        "--root-evidence",
        String(r.evidencia ?? "sonda").replace(/\s+/g, "-"),
      );
    }
    for (const s of sitios ?? t.sitios ?? []) args.push("--site", addr(s.endereco));
    args.push("--max-insn", "4096", "--out", out);
    return { args, t };
  };

  const analizar = (fix, nome, extra = {}) => {
    const out = path.join(OUT_C, `${conjunto}-${nome}.json`);
    if (fs.existsSync(out)) fs.rmSync(out);
    const { args, t } = argsAnalyze(fix, { ...extra, out });
    const r = executar(bin, args, { cwd: RAIZ, timeout: 120_000 });
    const exp = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
    return { ...r, exp, out, args, t, fix, nome };
  };

  const comandoDe = (r) => `${VERBO} ${r.args.join(" ")}`;

  /** R15 + §12.11: cada fila leva gabarito, contrato, e a súa citaación
   *  renumerada coa comprobación feita sobre o commit pinned. */
  function marcar(base, cit) {
    const out = { ...base, gabarito: GABARITO, contrato: CONTRATO, vocabulario: ESQUEMA_ANALYZE };
    if (cit === undefined || cit === null) return out;
    const ver = verificarCitacao(cit, contr.vello, contr.novo, desprazo);
    stats.citacion[ver.estado === "verificada" ? "verificadas" : ver.estado === "resumida" ? "resumidas" : "sen_texto_citabel"] += 1;
    stats.citacion.pares += ver.pares;
    stats.citacion.comprobados += ver.comprobados;
    out.citacao_C = cit;
    out.citacao_medida = derivarCitacao(cit);
    out.citacao_verificada = ver.estado === "verificada";
    out.citacao_estado = ver.estado;
    return out;
  }

  const rodadas = {};
  for (const fix of FIXTURES_C) rodadas[fix] = analizar(fix, `${fix}-base`);
  const IDX = Object.fromEntries(Object.entries(rodadas).map(([k, r]) => [k, indice(r.exp)]));
  const base = (r) => ({
    frente: "C",
    sha_frente: sha,
    comando: comandoDe(r),
    rc: r.rc,
    bruto: (r.stdout || "").trim().slice(0, 400),
  });

  if (pin) {
    for (const [nome, esperado] of Object.entries(pin.arquivos)) {
      const p = path.join(DIR_C, nome);
      if (!fs.existsSync(p)) throw new Error(`pin ${NOME_PIN}: falta ${nome}`);
      if (sha256Arquivo(p) !== esperado.sha256) throw new Error(`pin ${NOME_PIN}: ${nome} diverxe do hash versionado`);
    }
  }

  // ---- Audit da proba anexa (identidade) — control non puntuado -------------
  for (const fix of FIXTURES_C) {
    const r = rodadas[fix];
    const recomposto = sha256Arquivo(imagem(fix));
    const declarado = r.exp?.objeto?.sha256 ?? null;
    linhas.push(
      linha(
        marcar({
          ...base(r),
          fila: `CONTROLE-IDENTIDADE-${fix.slice(3).toUpperCase()}`,
          capacidade: "audit",
          eixo: "identidade",
          categoria: "aplicavel",
          veredito: declarado === recomposto ? "CONTROLADO" : "INCOHERENTE",
          pontua: false,
          esperados: { objeto_sha256: recomposto },
          medidos: { objeto_sha256: declarado, tamanho: r.exp?.objeto?.tamanho ?? null },
          divergencias: declarado === recomposto ? [] : [div("objeto_sha256", recomposto, declarado)],
          motivo: "a proba auditase recompondo o digest do --bin lido, non consultando o hash por existir",
        }),
      ),
    );
  }

  // ----------------------------------------------------------- KC1v (21) ----
  {
    const t1 = rodadas["dC-cx1"].t;
    const r1 = rodadas["dC-cx1"];
    const i1 = IDX["dC-cx1"];
    for (const row of t1.kc1) {
      const esp = row.esperado;
      const end = lerp(row.endereco);
      const ins = i1.ins.get(end);
      const front = i1.fronteiras.get(end);
      const eixe = row.dominio === "coherencia-contrato-codigo" ? "coherencia-contrato-código" : "instrución";
      const medidos = ins
        ? { tam: ins.tam, mnem: ins.mnem, classe: ins.classe }
        : front
          ? { fronteira: vocab(front.tipo), opcode: front.opcode, motivo: front.motivo }
          : { nada: "nem instrução nem fronteira no endereço" };
      const divs = [];
      const oraculo = ditame(porBytes, row.bytes, row.sondeo);
      stats.instrumento[oraculo.orixe] += 1;
      const { naPorta, contradice } = portaR11(row, oraculo);
      if (naPorta) {
        stats.r11.filas_na_porta += 1;
        stats.r11[contradice ? "contradicitas" : "conformes"] += 1;
      }
      const r11_invalida = contradice;
      let categoria, veredito, motivo;
      if (row.espera_decodificacion === true) {
        if (!ins) {
          categoria = "falha";
          veredito = "FAIL";
          divs.push(div("instrucao", esp.tam, front ? `fronteira ${vocab(front.tipo)}` : "ausente"));
          motivo = "non hai instrución no endereço ditado polo instrumento";
        } else {
          const mnem = String(ins.mnem ?? "").toLowerCase();
          const stemOk = esp.stems.some((s) => mnem.includes(s));
          if (ins.tam !== esp.tam) divs.push(div("tam", esp.tam, ins.tam));
          if (!stemOk) divs.push(div("mnem", esp.stems.join("|"), ins.mnem));
          categoria = divs.length ? "falha" : "aplicavel";
          veredito = divs.length ? "FAIL" : "PASS";
          motivo = `instrumento: ${row.sondeo?.instrumento?.mnemonico ?? ""} → palabra ${row.bytes}`;
        }
      } else {
        const recusou = !ins && front && vocab(front.tipo) === vocab(esp.tipo) && front.opcode != null;
        categoria = recusou ? "nao-suportado" : "falha";
        veredito = recusou ? "PASS" : "FAIL";
        // R11: se o instrumento di que ESAS bytes son unha instrución válida, a
        // expectativa de fronteira é un defecto de D e non pode contarse nin a
        // favor nin en contra da fronte (prohibido: manter a expectativa e contar
        // o desvío contra ela). Véxase a porta simétrica arriba.
        if (!recusou) {
          divs.push(
            div(
              "fronteira",
              `${esp.tipo} en ${addr(end)}`,
              ins ? `decodificado como ${ins.mnem} (tam ${ins.tam})` : front ? `fronteira ${vocab(front.tipo)} sen opcode` : "sen rexisto",
            ),
          );
        }
        motivo = recusou
          ? `recusa limpa con opcode; lonxitude ditada polo instrumento: ${esp.tam_instrumento} B`
          : row.nota ?? "C aceptou unha forma fóra da súa lista fechada §3 sen declarala soportada";
      }
      const rex = {
        ...base(r1),
        fila: row.id,
        capacidade: "KC1v",
        eixo: eixe,
        rc_esperado: 0,
        esperados: { ...esp, dominio: row.dominio },
        medidos,
        divergencias: divs,
        categoria,
        veredito,
        dominio: row.dominio,
        bytes: row.bytes,
        sondeo: row.sondeo?.instrumento ?? null,
        oraculo_isa: oraculo,
        motivo,
      };
      // R0 + R11: a medición non se reescribe. Retírase do denominador e rexístrase
      // contra D (defecto de autoría de D), conservando o que a fronte devolveu.
      if (r11_invalida) {
        Object.assign(rex, {
          frente: "D",
          fila: `${row.id}-VOID`,
          pontua: false,
          categoria: "nao-aplicavel",
          veredito: "VOID",
          desvio:
            `R11: a expectativa de fronteira contradice o ditame do instrumento (fonte ` +
            `${oraculo.orixe}: ${oraculo.id ? `\`${oraculo.id}\` de isa-oraculo-v2` : "sondeo da propia fila"} ` +
            `— \`${oraculo.desmontaxe}\`${oraculo.tam ? `, ${oraculo.tam} B` : ""}), así que é defecto ` +
            `de autoría de D e non pode contarse nin a favor nin en contra da fronte`,
        });
      }
      linhas.push(linha(marcar(rex, row.citacao_C)));
    }
  }

  // ----------------------------------------------------------- KC2v (6) -----
  {
    const t2 = rodadas["dC-cx2"].t;
    const r2 = rodadas["dC-cx2"];
    const i2 = IDX["dC-cx2"];
    for (const row of t2.kc2.filter((x) => x.esperado?.executa_em === undefined)) {
      const esp = row.esperado;
      const end = lerp(row.endereco);
      const ins = i2.ins.get(end);
      const arestas = i2.porOrigem.get(end) ?? [];
      const medidos = { arestas: arestas.map((a) => `${a.tipo}->${a.alvo === null ? "null" : addr(a.alvo)}:${a.status}`), mnem: ins?.mnem ?? null };
      const divs = [];
      if (esp.tam !== undefined && (ins?.tam ?? null) !== esp.tam) divs.push(div("tam", esp.tam, ins?.tam ?? null));
      if (esp.alvo !== undefined) {
        const alvo = lerp(esp.alvo);
        const cand = esp.tipo
          ? arestas.find((a) => a.tipo === vocab(esp.tipo) && a.status === (esp.status ? vocab(esp.status) : a.status))
          : arestas.find((a) => a.alvo === alvo && a.tipo !== "queda");
        medidos.alvo = cand?.alvo ?? null;
        medidos.tipo = cand?.tipo ?? null;
        medidos.status = cand?.status ?? null;
        if (!cand || cand.alvo !== alvo)
          divs.push(div("alvo", alvo, arestas.length ? arestas.map((a) => `${a.tipo}->${addr(a.alvo)}`).join(",") : "sem aresta"));
        if (esp.status !== undefined && cand && cand.status !== vocab(esp.status)) divs.push(div("status", vocab(esp.status), cand.status));
        if (esp.tipo !== undefined && cand && cand.tipo !== vocab(esp.tipo)) divs.push(div("tipo", vocab(esp.tipo), cand.tipo));
      }
      if (esp.sucessor_queda !== undefined) {
        const q = arestas.find((a) => a.tipo === "queda");
        medidos.sucessor_queda = q?.alvo ?? null;
        if (!q || q.alvo !== lerp(esp.sucessor_queda)) divs.push(div("sucessor_queda", esp.sucessor_queda, q?.alvo ?? null));
      }
      if (esp.origem !== undefined && !arestas.some((a) => a.origem === lerp(esp.origem)))
        divs.push(div("origem", esp.origem, "ningunha aresta nese origem"));
      linhas.push(
        linha(
          marcar(
            {
              ...base(r2),
              fila: row.id,
              capacidade: "KC2v",
              eixo: "operando/fluxo",
              rc_esperado: 0,
              esperados: esp,
              medidos,
              divergencias: divs,
              categoria: divs.length ? "falha" : "aplicavel",
              veredito: divs.length ? "FAIL" : "PASS",
              discriminante: row.discriminante ?? null,
              bytes: row.bytes ?? null,
              motivo: row.discriminante ?? esp.nota ?? "",
            },
            row.citacao_C,
          ),
        ),
      );
    }
    // `KC2v-indexado` conxela `executa_em` sobre a imaxe de cx4 (pin §12.10).
    const filaIdx = t2.kc2.find((x) => x.esperado?.executa_em);
    if (filaIdx) {
      const t4 = rodadas["dC-cx4"].t;
      const r4 = rodadas["dC-cx4"];
      const i4 = IDX["dC-cx4"];
      const row = t4.kc2_indexado;
      if (row.id !== filaIdx.id) throw new Error(`KC2v-indexado: id discordante entre gabaritos (${row.id} ≠ ${filaIdx.id})`);
      const ins = i4.ins.get(lerp(row.endereco));
      const mnem = String(ins?.mnem ?? "").toLowerCase();
      const divs = [];
      if (!ins) divs.push(div("instrucao", row.esperado.tam, null));
      else {
        if (ins.tam !== row.esperado.tam) divs.push(div("tam", row.esperado.tam, ins.tam));
        if (!/a1@\([^)]*%d2/.test(mnem)) divs.push(div("origem", row.esperado.origem, ins.mnem));
        if (!/%d0\s*$/.test(mnem)) divs.push(div("destino", row.esperado.destino, ins.mnem));
      }
      linhas.push(
        linha(
          marcar(
            {
              ...base(r4),
              fila: row.id,
              capacidade: "KC2v",
              eixo: "operando/fluxo",
              rc_esperado: 0,
              esperados: { ...row.esperado, executa_em: filaIdx.esperado.executa_em },
              medidos: { tam: ins?.tam ?? null, mnem: ins?.mnem ?? null },
              divergencias: divs,
              categoria: divs.length ? "falha" : "aplicavel",
              veredito: divs.length ? "FAIL" : "PASS",
              bytes: row.bytes,
              motivo: row.nota,
            },
            row.citacao_C,
          ),
        ),
      );
    }
  }

  // ----------------------------------------------------------- KC3v (2) -----
  {
    const t3 = rodadas["dC-cx3"].t;
    const r3 = rodadas["dC-cx3"];
    const i3 = IDX["dC-cx3"];
    for (const row of t3.kc3) {
      const esp = row.esperado;
      const end = lerp(esp.endereco);
      const front = i3.fronteiras.get(end);
      const ins = i3.ins.get(end);
      const ades = lerp(esp.nada_decodificado_ades);
      const control = row.control_de_discriminacion;
      const vereditoControl = i3.sitios.get(lerp(control?.endereco))?.veredito ?? null;
      const medidos = {
        fronteira: front ? { endereco: front.endereco, tipo: vocab(front.tipo), opcode: front.opcode } : null,
        instrucao_no_sitio: ins ? { tam: ins.tam, mnem: ins.mnem } : null,
        nada_decodificado_ades: ades,
        decodificado_ades: i3.ins.has(ades),
        control_veredito: vocab(vereditoControl),
      };
      const divs = [];
      // R11 na súa porta: estas dúas filas afirman que o ISA non codifica a palabra.
      const oraculo = ditame(porBytes, row.opcode, row.sondeo);
      stats.instrumento[oraculo.orixe] += 1;
      const { naPorta, contradice } = portaR11(row, oraculo);
      if (naPorta) {
        stats.r11.filas_na_porta += 1;
        stats.r11[contradice ? "contradicitas" : "conformes"] += 1;
      }
      if (!front) divs.push(div("fronteira", esp.tipo, ins ? `decodificado como ${ins.mnem}` : "ausente"));
      else {
        if (vocab(front.tipo) !== vocab(esp.tipo)) divs.push(div("tipo", vocab(esp.tipo), vocab(front.tipo)));
        const opEsperado = parseInt(row.opcode, 16);
        if (front.opcode == null) divs.push(div("opcode", row.opcode, null));
        else if (front.opcode !== opEsperado)
          divs.push(div("opcode", `${row.opcode} (${opEsperado})`, `0x${(front.opcode >>> 0).toString(16).toUpperCase()} (${front.opcode})`));
      }
      if (medidos.decodificado_ades) divs.push(div("nada_decodificado_ades", "ningunha instrución", `decodificada en ${addr(ades)}`));
      if (control && medidos.control_veredito !== vocab(control.esperado_veredito))
        divs.push(div("control_de_discriminacion", vocab(control.esperado_veredito), medidos.control_veredito ?? null));
      linhas.push(
        linha(
          marcar(
            {
              ...base(r3),
              fila: row.id,
              capacidade: "KC3v",
              eixo: "fronteira",
              rc_esperado: 0,
              esperados: { ...esp, control: control ? { endereco: control.endereco, veredito: control.esperado_veredito } : null },
              medidos,
              divergencias: divs,
              categoria: divs.length ? "falha" : "nao-suportado",
              veredito: divs.length ? "FAIL" : "PASS",
              opcode_esperado: row.opcode,
              dominio: row.dominio,
              oraculo_isa: oraculo,
              motivo: row.nota,
            },
            row.citacao_C,
          ),
        ),
      );
      if (contradice) {
        linhas[linhas.length - 1] = linha({
          ...linhas[linhas.length - 1],
          frente: "D",
          fila: `${row.id}-VOID`,
          pontua: false,
          categoria: "nao-aplicavel",
          veredito: "VOID",
          desvio:
            `R11: a expectativa de que \`${row.opcode}\` sexa inválida no ISA contradice o ditame do ` +
            `instrumento (fonte ${oraculo.orixe}: ${oraculo.id ? `\`${oraculo.id}\` de isa-oraculo-v2` : "sondeo da propia fila"} ` +
            `— \`${oraculo.desmontaxe}\`), así que é defecto de autoría de D`,
        });
      }
    }
    // §12.10 i: a fila `61ff` retirada do denominador rexístrase contra D (foi un
    // erro de autoría de D, non unha recusa da fronte), co vocabulario VOID de
    // `holdouts.mjs` para que `pontuar.mjs` a conte onde conta as outras.
    for (const v of t3.filas_retiradas ?? []) {
      linhas.push(
        linha({
          frente: "D",
          sha_frente: sha,
          fila: `${v.id}-VOID`,
          capacidade: "KC3v",
          eixo: "autoria-da-fila",
          comando: `gabarito ${path.relative(RAIZ, verdade("dC-cx3"))}`,
          rc: null,
          categoria: "nao-aplicavel",
          veredito: "VOID",
          pontua: false,
          esperados: { fila_valida_no_dominio_de_C: true },
          medidos: { opcode: v.opcode, admitida_por_D: false },
          divergencias: [],
          motivo: v.motivo,
          gabarito: GABARITO,
          contrato: CONTRATO,
        }),
      );
    }
    // Control positivo da mesma imaxe: a proba non é vacúa porque si hai un `rts`
    // decodificábel (raíz propia). Non pontúa: falta no denominador conxelado.
    const cp = t3.controle_positivo;
    const ins = i3.ins.get(lerp(cp.endereco));
    const mnem = String(ins?.mnem ?? "").toLowerCase();
    const ok = !!ins && ins.tam === cp.esperado.tam && cp.esperado.stems.some((s) => mnem.includes(s));
    linhas.push(
      linha(
        marcar(
          {
            ...base(r3),
            fila: "CONTROLE-POSITIVO-CX3",
            capacidade: "audit",
            eixo: "non-vacuidade",
            rc_esperado: 0,
            categoria: "aplicavel",
            veredito: ok ? "CONTROLADO" : "INCOHERENTE",
            pontua: false,
            esperados: cp.esperado,
            medidos: { tam: ins?.tam ?? null, mnem: ins?.mnem ?? null },
            divergencias: ok ? [] : [div("controle_positivo", cp.esperado, ins?.mnem ?? null)],
            motivo: `sonda ${JSON.stringify(cp.sondeo?.desmontaxe ?? "")}: a imaxe é decodificábel noutro sitio, así que as dúas frontiras non son un «nada decodifica`
            ,
          },
          null,
        ),
      ),
    );
  }

  // ----------------------------------------------------------- KC4v (4) -----
  {
    const t4 = rodadas["dC-cx4"].t;
    const r4 = rodadas["dC-cx4"];
    const i4 = IDX["dC-cx4"];
    const reg4 = t4.regioes[0];
    for (const row of t4.kc4) {
      const esp = Object.fromEntries(Object.entries(row.esperado).map(([k, v]) => [k, vocab(v)]));
      const end = lerp(row.endereco);
      const cham = i4.chamadas.get(end);
      const arestas = i4.porOrigem.get(end) ?? [];
      const front = i4.fronteiras.get(end);
      const medidos = {
        origem: cham?.sitio ?? arestas[0]?.origem ?? null,
        alvo: cham ? cham.alvo : arestas.find((a) => a.alvo !== null)?.alvo ?? null,
        status: vocab(cham?.status ?? null),
        arestas: arestas.map((a) => `${a.tipo}->${a.alvo === null ? "null" : addr(a.alvo)}:${vocab(a.status)}`),
        fronteira: vocab(front?.tipo ?? null),
        opcode_fronteira: front?.opcode ?? null,
      };
      const divs = [];
      if (esp.origem !== undefined && medidos.origem !== lerp(esp.origem)) divs.push(div("origem", esp.origem, medidos.origem));
      if (esp.alvo !== undefined && medidos.alvo !== (esp.alvo === null ? null : lerp(esp.alvo)))
        divs.push(div("alvo", esp.alvo, medidos.alvo));
      if (esp.status !== undefined && medidos.status !== esp.status) divs.push(div("status", esp.status, medidos.status));
      if (esp.fronteira !== undefined && medidos.fronteira !== esp.fronteira) divs.push(div("fronteira", esp.fronteira, medidos.fronteira));
      if (esp.decodificado_fora !== undefined) {
        const fora = [...i4.ins.keys()].filter((e) => e < reg4.inicio || e >= reg4.fim).length;
        medidos.decodificado_fora = fora;
        if (fora !== esp.decodificado_fora) divs.push(div("decodificado_fora", esp.decodificado_fora, fora));
      }
      if (esp.derivado !== undefined) {
        const alvoL = lerp(esp.alvo);
        const orixL = lerp(esp.origem);
        const raizDerivada = (r4.exp?.raizes ?? []).find((x) => x.endereco === alvoL && (x.proveniencia ?? x.grau) === esp.derivado) ?? null;
        const bloco = i4.blocosPorEntrada.get(alvoL);
        const por = (bloco?.["alcanado-por"] ?? []).map((p) => String(p).toLowerCase());
        medidos.derivado = { raiz: raizDerivada?.proveniencia ?? null, bloco_alcanado_por: por };
        const hex = (x) => `0x${x.toString(16)}`;
        const apuntan = por.some((x) => /^0x[0-9a-f]+$/i.test(x) && parseInt(x, 16) === orixL) || por.includes(hex(orixL));
        if (!raizDerivada && !apuntan)
          divs.push(div("derivado", `${esp.derivado} — raíz derivada ou bloco alcanado pola orixe`, JSON.stringify(medidos.derivado)));
      }
      linhas.push(
        linha(
          marcar(
            {
              ...base(r4),
              fila: row.id,
              capacidade: "KC4v",
              eixo: "chamada",
              rc_esperado: 0,
              esperados: esp,
              medidos,
              divergencias: divs,
              categoria: divs.length ? "falha" : esp.fronteira !== undefined ? "nao-suportado" : "aplicavel",
              veredito: divs.length ? "FAIL" : "PASS",
              bytes: row.bytes,
              statico: row.statico ?? null,
              motivo: esp.derivado
                ? "equivalencia de vocabulario §1: C codifica `dentro-de-fluxo` como bloco `alcanado-por [origem]`"
                : esp.fronteira
                  ? `fronteira opaca graduada como recusa limpa, co vocabulario real de C (R13: ${JSON.stringify(TABELA_VOCABULARIO)})`
                  : "",
            },
            row.citacao_C,
          ),
        ),
      );
    }
  }

  // ----------------------------------------------------------- KC5v (5) -----
  {
    const t2 = rodadas["dC-cx2"].t;
    const r2 = rodadas["dC-cx2"];
    const i2 = IDX["dC-cx2"];
    for (const row of t2.kc5) {
      const esp = row.esperado;
      const medidos = {};
      const divs = [];
      if (row.id === "KC5v-diamante") {
        const succ = i2.blocoQueContem(lerp(row.endereco))?.sucessores ?? [];
        medidos.ramos = succ.length;
        medidos.tipos = succ.map((s) => vocab(s.tipo));
        if (succ.length !== esp.ramos) divs.push(div("ramos", esp.ramos, succ.length));
        if ([...esp.tipos].sort().join(",") !== medidos.tipos.sort().join(",")) divs.push(div("tipos", esp.tipos, medidos.tipos));
      } else if (row.id === "KC5v-queda-pos-condicional") {
        const a = (i2.porOrigem.get(lerp(esp.origem)) ?? []).find((x) => x.tipo === vocab(esp.tipo) && x.alvo === lerp(esp.alvo));
        medidos.aresta = a ? { origem: a.origem, alvo: a.alvo, tipo: vocab(a.tipo) } : null;
        if (!a) divs.push(div("aresta", esp, (i2.porOrigem.get(lerp(esp.origem)) ?? []).map((x) => `${x.tipo}->${x.alvo}`)));
      } else if (row.id === "KC5v-rts-nao-continua") {
        const b = i2.blocosPorEntrada.get(lerp(row.endereco));
        medidos.sucessores = (b?.sucessores ?? []).length;
        medidos.saida = vocab(b?.saida ?? null);
        medidos.tipos_de_aresta = (i2.porOrigem.get(lerp(row.endereco)) ?? []).map((a) => vocab(a.tipo));
        if (medidos.sucessores !== esp.sucessores) divs.push(div("sucessores", esp.sucessores, medidos.sucessores));
        if (!medidos.tipos_de_aresta.includes(vocab(esp.tipo))) divs.push(div("tipo", vocab(esp.tipo), medidos.tipos_de_aresta));
      } else if (row.id === "KC5v-cobertura") {
        const c = r2.exp?.cobertura ?? {};
        medidos.bytes_decodificados = c["bytes-decodificados"] ?? null;
        medidos.bytes_regiao = c["bytes-regiao"] ?? null;
        medidos.fracao_reportada = c.fracao ?? null;
        if (medidos.bytes_decodificados !== esp.bytes_decodificados)
          divs.push(div("bytes_decodificados", esp.bytes_decodificados, medidos.bytes_decodificados));
        if (medidos.bytes_regiao !== esp.bytes_regiao) divs.push(div("bytes_regiao", esp.bytes_regiao, medidos.bytes_regiao));
      } else if (row.id === "KC5v-vereditos") {
        medidos.miolo = vocab(i2.sitios.get(lerp(esp.miolo))?.veredito ?? null);
        medidos.nao_alcancado = vocab(i2.sitios.get(lerp(esp.nao_alcancado))?.veredito ?? null);
        if (medidos.miolo !== "miolo-de-instrucao") divs.push(div("miolo", "miolo-de-instrucao", medidos.miolo));
        if (medidos.nao_alcancado !== "dentro-regiao-nao-alcancado")
          divs.push(div("nao_alcancado", "dentro-regiao-nao-alcancado", medidos.nao_alcancado));
      } else {
        linhas.push(
          linha(
            marcar(
              {
                ...base(r2),
                fila: row.id,
                capacidade: "KC5v",
                eixo: "CFG",
                categoria: "desconhecido",
                veredito: "INCONCLUSIVE",
                motivo: `fila KC5v non coñecida polo adaptador: ${row.id}`,
              },
              row.citacao_C,
            ),
          ),
        );
        continue;
      }
      linhas.push(
        linha(
          marcar(
            {
              ...base(r2),
              fila: row.id,
              capacidade: "KC5v",
              eixo: "CFG",
              rc_esperado: 0,
              esperados: esp,
              medidos,
              divergencias: divs,
              categoria: divs.length ? "falha" : "aplicavel",
              veredito: divs.length ? "FAIL" : "PASS",
              nota: row.nota ?? null,
              motivo: row.motivo ?? "",
            },
            row.citacao_C,
          ),
        ),
      );
    }
  }

  // ------------------------------------------------------------ TCv (4) -----
  {
    const t4 = rodadas["dC-cx4"].t;
    const r4 = rodadas["dC-cx4"];
    for (const receita of t4.tc) {
      const acao = receita.acao;
      if (acao.tipo === "cli") {
        const argsInvalidos = r4.args.map((x) => (x === "candidato" ? acao.valor : x));
        const outTC = path.join(OUT_C, `${conjunto}-${receita.id}.json`);
        if (fs.existsSync(outTC)) fs.rmSync(outTC);
        const iOut = argsInvalidos.indexOf("--out");
        if (iOut >= 0) argsInvalidos[iOut + 1] = outTC;
        const r = executar(bin, argsInvalidos, { cwd: RAIZ, timeout: 60_000 });
        const gravou = fs.existsSync(outTC);
        const esc =
          r.rc === receita.esperado_rc && !gravou
            ? { veredito: "PASS", categoria: "nao-suportado", desvio: null }
            : r.rc === 0
              ? { veredito: "FAIL", categoria: "falha", desvio: `rc 0: aceptou «${acao.valor}» e gravou export` }
              : {
                  veredito: "FAIL",
                  categoria: "desconhecido",
                  desvio: `rc ${r.rc} fóra do conxunto ${JSON.stringify([receita.esperado_rc])}${gravou ? "; ademais gravou export" : ""}`,
                };
        linhas.push(
          linha(
            marcar(
              {
                frente: "C",
                sha_frente: sha,
                fila: receita.id,
                capacidade: "TCv",
                eixo: "confiança",
                comando: `${VERBO} ${argsInvalidos.join(" ")}`,
                rc: r.rc,
                rc_esperado: receita.esperado_rc,
                categoria: esc.categoria,
                veredito: esc.veredito,
                desvio: esc.desvio,
                esperados: { rc: receita.esperado_rc, analise_executada: false },
                medidos: { rc: r.rc, stderr: (r.stderr || "").trim().slice(0, 200), export_gravado: gravou },
                divergencias:
                  esc.veredito === "PASS" ? [] : [{ campo: "rc|export", esperado: `rc ${receita.esperado_rc} sen export`, medido: `${r.rc} / gravou=${gravou}` }],
                motivo: receita.motivo,
                bruto: (r.stderr || r.stdout || "").trim().slice(0, 300),
              },
              null,
            ),
          ),
        );
        continue;
      }
      if (acao.tipo === "site") {
        const r = analizar("dC-cx4", receita.id, { sitios: [...t4.sitios, { endereco: acao.endereco }] });
        brutos.push({ nome: receita.id, rc: r.rc, resumo: ((r.stdout || "") + (r.stderr || "")).trim().slice(0, 300), comando: comandoDe(r) });
        const idx = indice(r.exp);
        const medido = idx.sitios.get(lerp(acao.endereco));
        const veredito = vocab(medido?.veredito ?? null);
        const esperadoV = vocab(receita.esperado.veredito);
        const divs = veredito === esperadoV ? [] : [div("veredito", esperadoV, veredito)];
        linhas.push(
          linha(
            marcar(
              {
                ...base(r),
                fila: receita.id,
                capacidade: "TCv",
                eixo: "sítio",
                rc_esperado: 0,
                esperados: receita.esperado,
                medidos: { veredito, bloco: medido?.bloco ?? null },
                divergencias: divs,
                categoria: divs.length ? "falha" : "aplicavel",
                veredito: divs.length ? "FAIL" : "PASS",
                motivo: receita.motivo,
              },
              null,
            ),
          ),
        );
        continue;
      }
      if (acao.tipo === "xor-byte-imagem") {
        const esp = receita.esperado;
        const raizExtra = esp.variante_illada?.raiz_extra;
        const raizes = raizExtra ? [...t4.raizes, raizExtra] : t4.raizes;
        const sitios = raizExtra ? [...t4.sitios, { endereco: raizExtra.endereco }] : t4.sitios;
        const baseRun = analizar("dC-cx4", "TC-4-base-illada", { raizes, sitios });
        const ib = indice(baseRun.exp);
        const img = Buffer.from(fs.readFileSync(imagem("dC-cx4")));
        const bytesAntes = img.subarray(acao.offset_na_arquivo, acao.offset_na_arquivo + 2).toString("hex").toUpperCase();
        img[acao.offset_na_arquivo] ^= acao.valor;
        const gravado = gravarBin(OUT_C, `${conjunto}-dC-cx4-tamper.bin`, img);
        const tamRun = analizar("dC-cx4", "TC-4-mutada-illada", { raizes, sitios, binArquivo: path.join(OUT_C, `${conjunto}-dC-cx4-tamper.bin`) });
        const it = indice(tamRun.exp);
        brutos.push({ nome: "TC-4-mutada", rc: tamRun.rc, resumo: (tamRun.stdout || "").trim().slice(0, 300), comando: comandoDe(tamRun) });
        const front = it.fronteiras.get(lerp(esp.endereco_mutado));
        const divs = [];
        if (bytesAntes !== esp.bytes_antes)
          divs.push(div("bytes_antes", esp.bytes_antes, bytesAntes));
        if (!front || vocab(front.tipo) !== "opcode-fora-do-subconjunto")
          divs.push(div("fronteira", `opcode-fora-do-subconjunto em ${addr(esp.endereco_mutado)}`, front ? vocab(front.tipo) : "ausente"));
        if (front && front.opcode !== parseInt(esp.bytes_depois, 16))
          divs.push(div("opcode", `${esp.bytes_depois} (${parseInt(esp.bytes_depois, 16)})`, `0x${(front.opcode ?? -1 >>> 0).toString(16).toUpperCase()} (${front.opcode ?? null})`));
        if (it.ins.has(lerp(esp.endereco_mutado)))
          divs.push(div("instrucao_mutada", "ausente", it.ins.get(lerp(esp.endereco_mutado)).mnem));
        const antes = baseRun.exp?.cobertura?.["bytes-decodificados"] ?? null;
        const depois = tamRun.exp?.cobertura?.["bytes-decodificados"] ?? null;
        const delta = antes !== null && depois !== null ? antes - depois : null;
        if (delta !== esp.delta_cobertura_bytes) divs.push(div("delta_cobertura", esp.delta_cobertura_bytes, delta));
        const idxRow = rodadas["dC-cx4"].t.kc2_indexado;
        const intacta = it.ins.get(lerp(idxRow.endereco));
        if (!intacta || intacta.tam !== idxRow.esperado.tam)
          divs.push(div("downstream", `tam ${idxRow.esperado.tam} em ${addr(idxRow.endereco)}`, intacta?.tam ?? null));
        const invariantes = (esp.invariantes ?? []).length;
        linhas.push(
          linha(
            marcar(
              {
                ...base(tamRun),
                fila: receita.id,
                capacidade: "TCv",
                eixo: "saída",
                rc_esperado: 0,
                mutacion: `xor-byte offset ${acao.offset_na_arquivo} valor ${acao.valor} sobre dC-cx4-v2.bin`,
                esperados: { ...esp, invariantes },
                medidos: {
                  fronteira: front ? { endereco: front.endereco, tipo: vocab(front.tipo), opcode: front.opcode } : null,
                  cobertura_antes: antes,
                  cobertura_depois: depois,
                  delta_cobertura: delta,
                  downstream: intacta ? { endereco: intacta.endereco, tam: intacta.tam, mnem: intacta.mnem } : null,
                  bytes_recompostos: gravado.sha256,
                  invariantes_comprobadas: divs.length === 0 ? invariantes : invariantes - divs.length,
                },
                divergencias: divs,
                categoria: divs.length ? "falha" : "aplicavel",
                veredito: divs.length ? "FAIL" : "PASS",
                motivo: receita.motivo,
              },
              null,
            ),
          ),
        );
        const conf = analizar("dC-cx4", "TC-4-mutada-base", { binArquivo: path.join(OUT_C, `${conjunto}-dC-cx4-tamper.bin`) });
        linhas.push(
          linha(
            marcar(
              {
                ...base(conf),
                fila: "TC-4-control",
                capacidade: "TCv-controle",
                eixo: "saída",
                categoria: "aplicavel",
                veredito: "CONTROLADO",
                pontua: false,
                esperados: { nota: "con as raíces orixinais a mutación corta o único camiño que proba 0x2002.." },
                medidos: {
                  cobertura_base_illada: antes,
                  cobertura_depois: conf.exp?.cobertura?.["bytes-decodificados"] ?? null,
                  instruions_base_illada: ib.ins.size,
                },
                motivo: "control observado: sen raíz extra a receita mide alcançabilidade, non lonxitude (§12.9)",
              },
              null,
            ),
          ),
        );
        continue;
      }
      linhas.push(
        linha(
          marcar(
            {
              frente: "C",
              sha_frente: sha,
              fila: receita.id,
              capacidade: "TCv",
              categoria: "desconhecido",
              veredito: "INCONCLUSIVE",
              motivo: `acção ${acao.tipo} non implementada polo adaptador`,
            },
            null,
          ),
        ),
      );
    }
  }

  // ---- Coherencia aritmética dos exports (control non puntuado) -------------
  for (const fix of FIXTURES_C) {
    const r = rodadas[fix];
    const t = r.t;
    const claimed = r.exp?.cobertura?.["bytes-decodificados"] ?? null;
    const esp = t.cobertura_esperada_bytes;
    const suma = (r.exp?.blocos ?? []).flatMap((b) => b.instrucoes ?? []).reduce((a, i) => a + i.tam, 0);
    const fronteiras = (r.exp?.fronteiras ?? []).length;
    const alleo = claimed !== null ? claimed - suma : null;
    // A coherencia aritmética só di algo se se pode ler *que* sumou. Publicamos a
    // lista de instrucións decodificadas e os enderezos das fronteiras: así a
    // decomposición do total é comprobábel na evidencia, non na narrativa (§12.12 d).
    const decodificadas = (r.exp?.blocos ?? [])
      .flatMap((b) => b.instrucoes ?? [])
      .map((i) => ({ endereco: i.endereco, tam: i.tam, mnem: i.mnem ?? null }))
      .sort((a, b) => a.endereco - b.endereco);
    const fronteirasEnd = (r.exp?.fronteiras ?? []).map((f) => f.endereco).sort((x, y) => x - y);
    const primaria = typeof esp === "number" ? esp : esp?.primaria ?? null;
    const variante = typeof esp === "object" ? Object.entries(esp).find(([k]) => k.startsWith("variante"))?.[0] ?? null : null;
    const varianteValor = variante ? esp[variante] : null;
    const coincide = (n) => n !== null && claimed === n;
    linhas.push(
      linha(
        marcar(
          {
            ...base(r),
            fila: `CONTROLE-COHERENCIA-${fix.slice(3).toUpperCase()}`,
            capacidade: "audit",
            eixo: "prova anexa",
            categoria: "aplicavel",
            veredito: coincide(primaria) || coincide(varianteValor) ? "CONTROLADO" : "INCOHERENTE",
            pontua: false,
            esperados: { primaria, ...(variante ? { [variante]: varianteValor } : {}) },
            medidos: {
              bytes_decodificados_reportados: claimed,
              suma_dos_comprimientos_decodificados: suma,
              fronteiras,
              bytes_alleos_as_instruccion: alleo,
              instruions_decodificadas: decodificadas,
              fronteiras_enderezos: fronteirasEnd,
            },
            divergencias:
              coincide(primaria) || coincide(varianteValor)
                ? []
                : [div("bytes-decodificados", `${primaria}${variante ? ` ou ${variante}=${varianteValor}` : ""}`, claimed)],
            motivo:
              alleo === 0
                ? `a cobertura é exactamente Σ das instrucións decodificadas (${suma} B) e ningunha fronteira suma bytes: se o valor difire de `+
                  `${primaria}, o motivo é unha instrución decodificada de máis, non a variante de fronteiras — léa na fila correspondente`
                : typeof esp === "object" && esp.nota
                  ? esp.nota
                  : "a fracción non se gradúa: D recompoñ Σ dos comprimentos ditados polo instrumento",
          },
          null,
        ),
      ),
    );
  }

  // ---- §12.11 b: `consultar` sobre os vereditos xa conxelados (non puntúa) --
  for (const fix of FIXTURES_C) {
    const t = rodadas[fix].t;
    for (const s of t.sitios ?? []) {
      const out = path.join(OUT_C, `${conjunto}-consultar-${fix}-${s.endereco.toString(16)}.json`);
      if (fs.existsSync(out)) fs.rmSync(out);
      const reg = t.regioes[0];
      const args = ["consultar", "--bin", path.relative(RAIZ, imagem(fix)), "--origin", addr(t.origin ?? 0),
        "--region", `${addr(reg.inicio)}:${addr(reg.fim)}`];
      for (const r of t.raizes) args.push("--root", addr(r.endereco), "--root-prov", r.proveniencia);
      args.push("--site", addr(s.endereco), "--out", out);
      const r = executar(bin, args, { cwd: RAIZ, timeout: 60_000 });
      const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
      const medido = vocab(j?.veredito ?? null);
      const esperadoV = vocab(s.esperado_veredito);
      const chaveOk = j?.schema === ESQUEMA_SITIO;
      const divs = [];
      if (r.rc !== 0) divs.push(div("rc", 0, r.rc));
      if (!chaveOk) divs.push(div("schema", ESQUEMA_SITIO, j?.schema ?? null));
      if (medido !== esperadoV) divs.push(div("veredito", esperadoV, medido));
      linhas.push(
        linha(
          marcar(
            {
              frente: "C",
              sha_frente: sha,
              fila: `CONTROLE-CONSULTAR-${fix.slice(3).toUpperCase()}-${addr(s.endereco)}`,
              capacidade: "interface-consultar",
              eixo: "sítio",
              comando: `${VERBO} ${args.join(" ")}`,
              rc: r.rc,
              rc_esperado: 0,
              categoria: "desconhecido",
              veredito: divs.length === 0 ? "CONTROLADO" : "INCOHERENTE",
              pontua: false,
              esperados: { veredito: esperadoV, schema: ESQUEMA_SITIO },
              medidos: { veredito: medido, schema: j?.schema ?? null, chaves: j ? Object.keys(j).length : null, consumidor: j?.["consumidor-validado"] ?? null, promotivel: j?.["promovivel-vinculo-estrutural"] ?? null },
              divergencias: divs,
              motivo: "§12.11 b: mesma expectativa conxelada, outra interface. Acordo non promove a capacidade; desacordo é achado publicable.",
              bruto: (r.stdout || r.stderr || "").trim().slice(0, 220),
            },
            s.citacao,
          ),
        ),
      );
    }
  }

  // ---- §12.11 b: `medir` rexistrado como capacidade sen graduar -------------
  {
    const fix = "dC-cx2";
    const t = rodadas[fix].t;
    const reg = t.regioes[0];
    const out = path.join(OUT_C, `${conjunto}-medir-${fix}.json`);
    if (fs.existsSync(out)) fs.rmSync(out);
    const args = ["medir", "--bin", path.relative(RAIZ, imagem(fix)), "--origin", addr(t.origin ?? 0),
      "--region", `${addr(reg.inicio)}:${addr(reg.fim)}`, "--root", addr(t.raizes[0].endereco),
      "--root-prov", t.raizes[0].proveniencia, "--out", out];
    const r = executar(bin, args, { cwd: RAIZ, timeout: 60_000 });
    const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
    linhas.push(
      linha(
        marcar(
          {
            frente: "C",
            sha_frente: sha,
            fila: "CONTROLE-MEDIR-CX2",
            capacidade: "interface-medir",
            eixo: "interface nova",
            comando: `${VERBO} ${args.join(" ")}`,
            rc: r.rc,
            rc_esperado: null,
            categoria: "desconhecido",
            veredito: "INCONCLUSIVE",
            pontua: false,
            esperados: { nota: "o gabarito v2 non conxelou filas para `medir` (§12.11 b): nada que comparar" },
            medidos: {
              schema: j?.schema ?? null,
              chaves: j ? Object.keys(j).length : null,
              comprimento_status: j?.["comprimento-status"] ?? null,
              operandos_status: j?.["operandos-status"] ?? null,
              saida_sha256: j ? sha256(Buffer.from(JSON.stringify(j))) : null,
            },
            divergencias: [],
            motivo: "capacidade presente en 8ea5821 e non exercitada polo denominador: publícase como `descoñecido`, non como heredada de `analyze` (R18)",
            bruto: (r.stdout || r.stderr || "").trim().slice(0, 220),
          },
          null,
        ),
      ),
    );
  }

  const manifesto = {
    ferramenta: { bin, verbo: VERBO, sha256: shaFerramenta(chave) },
    sha_frente: sha,
    procedencia: verificarProcedencia(chave),
    conjunto,
    gabarito: GABARITO,
    contrato: CONTRATO,
    esquema_analyze: ESQUEMA_ANALYZE,
    esquemas_novos: { consultar: ESQUEMA_SITIO, medir: ESQUEMA_MEDIR, estado: "non puntuados (§12.11 b)" },
    denominador: pin?.denominador ?? null,
    // R0: o denominador conxelado non se reescribe — publícase a contabilidade.
    denominador_observado: (() => {
      const reais = linhas.filter((l) => l.pontua !== false);
      const por = {};
      for (const l of reais) por[l.capacidade] = (por[l.capacidade] ?? 0) + 1;
      return {
        conxelado: pin?.denominador?.total ?? pin?.denominador ?? null,
        puntuables: reais.length,
        por_capacidade: por,
        voids_contra_D: linhas.filter((l) => l.veredito === "VOID").map((l) => l.fila),
      };
    })(),
    // O `filas_sha256` do oráculo é *auto*-referente: detesta corrupción accidental,
    // non falsificación (quen muda as filas pode recalcular o dixesto). O que pecha
    // o oco é que o dixesto do arquivo se publique aquí, e este arquivo commítese:
    // falsificar o gabarito obrigaría a mudar a evidencia commiteada de D.
    gabarito_isa: {
      arquivo: path.relative(RAIZ, GABARITO_ISA),
      sha256_arquivo: sha256Arquivo(GABARITO_ISA),
      filas_indexadas: porBytes.size,
      filas_no_arquivo: JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8")).filas.length,
      filas_sha256: JSON.parse(fs.readFileSync(GABARITO_ISA, "utf8")).filas_sha256,
    },
    porta_R11: {
      ...stats.r11,
      dominio_graduado: PORTA_R11,
      cobertura_por_orixe: stats.instrumento,
      gabarito: path.relative(RAIZ, GABARITO_ISA),
    },
    // §12.11 c): o SHA rexistrado é a árbore de D coa que se mediu; a evidencia
    // commitease despois, polo que queda como commit fillo deste.
    precedencia: verificarPrecedencia(),
    vocabulario_normalizado: TABELA_VOCABULARIO,
    renumeracion_citacoes: {
      umbral: UMBRAL_RENUMERACION,
      desprazo: DESPRAZO,
      vello_sha: PIN.C,
      novo_sha: sha,
      ...stats.citacion,
    },
    fixtures: FIXTURES_C.map((fix) => ({
      arquivo: path.relative(RAIZ, imagem(fix)),
      sha256: sha256Arquivo(imagem(fix)),
      verdade: path.relative(RAIZ, verdade(fix)),
    })),
    truth: {
      arquivo: conjunto === "holdout" ? "respostas reservadas fóra da árbore" : path.relative(RAIZ, verdade("dC-cx1")),
      pin: pin ? { arquivo: NOME_PIN, sha256: sha256Arquivo(path.join(DIR_C, NOME_PIN)) } : null,
    },
  };
  return { ausente: false, linhas, manifesto, brutos, stats };
}


if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = (nome) => (process.argv.includes(nome) ? process.argv[process.argv.indexOf(nome) + 1] : null);
  const conjunto = argv("--conjunto") ?? "medicao";
  const chave = argv("--chave") ?? "C_novo";
  const r = adaptarC2({ chave, conjunto });
  if (r.ausente) {
    console.log(`[C v2] ferramenta ${chave} ausente: ${FERRAMENTAS[chave].bin} — rexistrar bloqueio.`);
    process.exitCode = 3;
  } else {
    const nome = conjunto === "holdout" ? "C-holdout-v2.jsonl" : `C-${r.manifesto.sha_frente.slice(0, 7)}-v2.jsonl`;
    const desc = gravarEvidencia(nome, r.linhas, r.manifesto);
    const por = {};
    for (const l of r.linhas) por[l.veredito] = (por[l.veredito] ?? 0) + 1;
    console.log(`[C v2] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…) ${JSON.stringify(por)}`);
    const p = r.manifesto.procedencia;
    console.log(`[C v2] procedencia ${p.frente}@${p.sha.slice(0, 7)}: ${p.ok ? "OK" : "DIVERXENTE"} (${p.arquivos} ficheiros, ${p.divergentes.length} diverxentes, ${p.faltantes.length} faltantes)`);
    console.log(`[C v2] citas: ${JSON.stringify(r.manifesto.renumeracion_citacoes)}`);
    for (const l of r.linhas) {
      if (l.veredito === "FAIL" || l.veredito === "INCOHERENTE" || l.veredito === "INCONCLUSIVE") {
        console.log(`  ${l.fila.padEnd(34)} ${l.veredito.padEnd(12)} rc=${l.rc} ${l.desvio ?? l.motivo ?? ""}`.slice(0, 240));
      }
    }
  }
}
