// Verificador INDEPENDENTE da prova de PERCURSO em runtime da reordenação do
// script id_Wait (PARTE 2 — pendência 3). NAO importa nenhum modulo de produto:
// le as series brutas ({frame,timer,art} por frame) gravadas pelo harness
// (src-tauri .../inspection.rs::sonic_sequence_runtime_oracle_...), reconstrói
// o percurso POR CONTA (segmentando pelas recargas do timer) e confere as
// expectativas congeladas ANTES da execucao em
// docs/rex_profiles/sonic_sequencia/EXPECTATIONS-SEQUENCIA.md secao 8.2.
//
// Uso:
//   node scripts/qa/sonic-sequence-route-oracle.mjs --oracle <dir> [--report <out.json>]
//   node scripts/qa/sonic-sequence-route-oracle.mjs --selfcheck   // prova os 5 negativos
//
// Recusas exigidas pela missao: troca de entradas identicas contada como
// positivo; sequencia errada; terminador alterado; serie antiga/trocada; e
// amostras insuficientes. O laço FE 02 e keyed por POSICAO: base mostra
// {orig16,orig17}; a copia deve mostrar exatamente as duas ULTIMAS entradas da
// PROPOSTA. Como a proposta e swap(0,17), essas duas ultimas mudam de valor.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// --- Fatos de byte congelados (despejo da ROM pinada, independente) ---------
const ROM_SHA256 = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb";
const ORIGINAL_FRAMES = [
  0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
  0x03, 0x02, 0x02, 0x02, 0x03, 0x04,
];
const FRAMES_ADDR = 0x13baf; // janela escrevivel da sequencia
const TERMINATOR_ADDR = 0x13bc1;
const TERMINATOR = [0xfe, 0x02];
const MIN_SEGMENTS = 40;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const eqArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const sorted = (a) => a.slice().sort((x, y) => x - y);
const mode = (a) => {
  const c = new Map();
  let best = a[0], n = 0;
  for (const x of a) { const v = (c.get(x) ?? 0) + 1; c.set(x, v); if (v > n) { n = v; best = x; } }
  return best;
};

// Reconstrucao INDEPENDENTE: recarga = timer sobe entre frames CONSECUTIVOS
// dentro de id_Wait (o consumidor recarrega a contagem e avanca uma entrada).
// A arte estavel entre recargas e a entrada tocada.
export function reconstructRoute(rows) {
  const arts = [];
  let bucket = [], prevT = null, prevFrame = null;
  for (const r of rows) {
    const consecutive = prevFrame === null || r.frame === prevFrame + 1;
    if (prevT !== null && consecutive && r.timer > prevT && bucket.length) {
      arts.push(mode(bucket));
      bucket = [];
    }
    bucket.push(r.art);
    prevT = r.timer;
    prevFrame = r.frame;
  }
  if (bucket.length) arts.push(mode(bucket));
  return arts;
}

function routeTailsLoop(route, loopPair) {
  const tail = route.slice(ORIGINAL_FRAMES.length);
  if (tail.length < 20) return false;
  return tail.every((v, i) => v === loopPair[i % 2]);
}

// Nucleo puro: avalia um par de series + manifesto. Usado tanto sobre os
// arquivos reais quanto sobre entradas sinteticas do --selfcheck.
export function assess({ base, copy, manifest }) {
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, pass: !!ok, detail: detail ?? null });

  // --- Proveniencia (recusa serie antiga / trocada) ------------------------
  check("manifesto: schema v2", manifest.schema === "rex-sonic-sequence-route-oracle-manifest/v2");
  check("manifesto: base e a ROM pinada", manifest.base_rom_sha256 === ROM_SHA256, manifest.base_rom_sha256);
  check("manifesto: copia difere da base (nao e a serie antiga)",
    manifest.reordered_copy_sha256 && manifest.reordered_copy_sha256 !== manifest.base_rom_sha256);
  const proposal = manifest.proposal ?? [];
  check("proposta: multiconjunto preservado (so a ordem muda)",
    eqArr(sorted(proposal), sorted(ORIGINAL_FRAMES)) && proposal.length === 18);
  // NEGATIVO-CHAVE: trocar duas entradas IDENTICAS deixa a proposta == original
  // e NAO conta como positivo de reordenacao que alcanga o core.
  check("proposta: troca entradas DISTINTAS (recusa troca identica)",
    !eqArr(proposal, ORIGINAL_FRAMES),
    "proposta == ordem original: reordenacao nao discriminate");

  check("serie base: source == base do manifesto", base.source_sha256 === manifest.base_rom_sha256, base.source_sha256);
  check("serie reorder: source == copia do manifesto", copy.source_sha256 === manifest.reordered_copy_sha256, copy.source_sha256);
  check("serie reorder: source NAO e a base (recusa serie antiga)",
    copy.source_sha256 !== manifest.base_rom_sha256 && copy.source_sha256 !== ROM_SHA256);
  check("epoch comum entre base e reorder (mesma corrida)",
    typeof base.epoch_ms === "number" && base.epoch_ms === copy.epoch_ms);

  // --- Reconstrucao independente do percurso ------------------------------
  const baseRoute = reconstructRoute(base.rows ?? []);
  const copyRoute = reconstructRoute(copy.rows ?? []);

  // Amostras insuficientes.
  check("base: >= " + MIN_SEGMENTS + " segmentos", baseRoute.length >= MIN_SEGMENTS, `seg=${baseRoute.length}`);
  check("reorder: >= " + MIN_SEGMENTS + " segmentos", copyRoute.length >= MIN_SEGMENTS, `seg=${copyRoute.length}`);

  // Percurso inicial: 18 primeiras entradas.
  check("base: percurso[0..18] == ordem original",
    eqArr(baseRoute.slice(0, 18), ORIGINAL_FRAMES), JSON.stringify(baseRoute.slice(0, 18)));
  check("reorder: percurso[0..18] == proposta (sequencia errada e recusada)",
    eqArr(copyRoute.slice(0, 18), proposal), JSON.stringify(copyRoute.slice(0, 18)));

  // Cabeca discriminante: se a proposta muda a entrada 0, a cabeca deve mudar.
  if (proposal[0] !== ORIGINAL_FRAMES[0]) {
    check("cabeca discriminante: base " + baseRoute[0] + " != reorder " + copyRoute[0],
      baseRoute[0] === ORIGINAL_FRAMES[0] && copyRoute[0] === proposal[0] && baseRoute[0] !== copyRoute[0],
      `base=${baseRoute[0]} copy=${copyRoute[0]}`);
  }

  // Terminador FE 02 (laço por POSICAO). Base alterna {o16,o17}; reorder
  // exatamente {p16,p17}. Negativo: terminador adulterado quebra a alternancia.
  check("base: laço FE 02 alterna {orig16,orig17} = {" + ORIGINAL_FRAMES[16] + "," + ORIGINAL_FRAMES[17] + "}",
    routeTailsLoop(baseRoute, [ORIGINAL_FRAMES[16], ORIGINAL_FRAMES[17]]));
  check("reorder: laço FE 02 alterna {prop16,prop17} = {" + proposal[16] + "," + proposal[17] + "}",
    routeTailsLoop(copyRoute, [proposal[16], proposal[17]]));

  // --- Opcional: bytes da copia no disco (se ainda existirem) -------------
  if (manifest.reordered_copy_path && existsSync(manifest.reordered_copy_path)) {
    try {
      const rom = readFileSync(manifest.reordered_copy_path);
      check("copia no disco: SHA bate", sha256(rom) === manifest.reordered_copy_sha256, sha256(rom));
      const bytes = [...rom.subarray(FRAMES_ADDR, FRAMES_ADDR + 18)];
      check("copia no disco: janela de 18 entradas == proposta", eqArr(bytes, proposal), JSON.stringify(bytes));
      check("copia no disco: terminador FE 02 integro",
        eqArr([...rom.subarray(TERMINATOR_ADDR, TERMINATOR_ADDR + 2)], TERMINATOR));
    } catch (e) {
      check("copia no disco legivel", false, String(e));
    }
  } else {
    check("copia no disco ausente (prova fica so pelas series)", true, manifest.reordered_copy_path ?? null);
  }

  const allPass = checks.every((c) => c.pass);
  return { checks, allPass, route: { base: baseRoute, reorder: copyRoute } };
}

// --- selfcheck: cada negativo deve derrubar allPass -------------------------
// Constroi rows cujas recargas reproduzem `entries` em ordem (3 frames/entrada,
// timer 23->22->21 em cada). Usado para o percurso positivo e os sinteticos.
function rowsFor(entries) {
  const rows = [];
  let frame = 1000;
  entries.forEach((art) => {
    for (const t of [23, 22, 21]) rows.push({ frame: frame++, timer: t, art });
  });
  return rows;
}
// percurso = script de 18 + laço FE 02 alternando as duas ultimas entradas.
function routeScript(script, loops = 30) {
  const out = script.slice();
  const pair = [script[16], script[17]];
  for (let i = 0; i < loops; i++) { out.push(pair[i % 2]); }
  return out;
}
const SWAP0_17 = (() => { const p = ORIGINAL_FRAMES.slice(); [p[0], p[17]] = [p[17], p[0]]; return p; })();

function selfcheck() {
  const goodBase = rowsFor(routeScript(ORIGINAL_FRAMES));
  const goodCopy = rowsFor(routeScript(SWAP0_17));
  const goodManifest = {
    schema: "rex-sonic-sequence-route-oracle-manifest/v2",
    base_rom_sha256: ROM_SHA256,
    reordered_copy_sha256: "aaaa",
    proposal: SWAP0_17,
    reordered_copy_path: null,
  };
  const goodBaseS = { rows: goodBase, source_sha256: ROM_SHA256, epoch_ms: 7 };
  const goodCopyS = { rows: goodCopy, source_sha256: "aaaa", epoch_ms: 7 };

  const results = [];
  const run = (name, mutate) => {
    const m = structuredClone(goodManifest);
    const b = structuredClone(goodBaseS);
    const c = structuredClone(goodCopyS);
    mutate({ m, b, c });
    const r = assess({ base: b, copy: c, manifest: m });
    results.push({ name, allPass: r.allPass, failed: r.checks.filter((x) => !x.pass).map((x) => x.name) });
  };

  // positivo de sanidade
  const sane = assess({ base: goodBaseS, copy: goodCopyS, manifest: goodManifest });
  results.push({ name: "SANIDADE (positivo)", allPass: sane.allPass, failed: sane.checks.filter((x) => !x.pass).map((x) => x.name) });

  run("NEGATIVO troca identica (swap(0,1) -> proposta==original)", ({ m }) => { m.proposal = ORIGINAL_FRAMES.slice(); });
  run("NEGATIVO sequencia errada (copy toca outra ordem)", ({ c }) => {
    c.rows = rowsFor(routeScript([].concat(ORIGINAL_FRAMES.slice(1), ORIGINAL_FRAMES[0])));
  });
  run("NEGATIVO terminador alterado (laço nao casa as duas ultimas)", ({ c }) => {
    const r = routeScript(SWAP0_17);
    r[20] = 0x02; // entrada estranha no meio do laço
    c.rows = rowsFor(r);
  });
  run("NEGATIVO serie antiga (copia == base)", ({ m, c }) => { m.reordered_copy_sha256 = ROM_SHA256; c.source_sha256 = ROM_SHA256; });
  run("NEGATIVO amostras insuficientes", ({ c }) => { c.rows = rowsFor(SWAP0_17.slice()); });

  const positives = results.filter((r) => r.name.startsWith("SANIDADE"));
  const negatives = results.filter((r) => r.name.startsWith("NEGATIVO"));
  const positivesOk = positives.every((r) => r.allPass);
  const negativesRejected = negatives.every((r) => !r.allPass);
  for (const r of results) {
    const want = r.name.startsWith("SANIDADE");
    console.log(`${r.allPass === want ? "OK  " : "FAIL"} ${r.name}${want ? "" : " :: recusado por: " + r.failed.join(" | ")}`);
  }
  const allPass = positivesOk && negativesRejected;
  console.log(`selfcheck: positivo=${positivesOk} todos_negativos_recusados=${negativesRejected} allPass=${allPass}`);
  process.exit(allPass ? 0 : 1);
}

// --- CLI --------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (args.includes("--selfcheck")) selfcheck();
else {
  const dir = flag("--oracle");
  if (args.includes("--help") || !dir) {
    console.error("uso: node sonic-sequence-route-oracle.mjs --oracle <dir> [--report <out.json>] | --selfcheck");
    process.exit(2);
  }
  const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
  const manifest = readJson(`${dir}/route-manifest.json`);
  const base = readJson(`${dir}/${manifest.series_files?.base ?? "series-base.json"}`);
  const copy = readJson(`${dir}/${manifest.series_files?.reordered ?? "series-reordered.json"}`);
  const result = assess({ base, copy, manifest });
  const report = {
    schema: "rex-sonic-sequence-route-verification/v2",
    allPass: result.allPass,
    checks: result.checks,
    route_len: { base: result.route.base.length, reorder: result.route.reorder.length },
  };
  if (flag("--report")) writeFileSync(flag("--report"), JSON.stringify(report, null, 2));
  for (const c of result.checks) console.log(`${c.pass ? "OK  " : "FAIL"} ${c.name}${c.detail != null ? " :: " + JSON.stringify(c.detail) : ""}`);
  console.log(`allPass=${result.allPass}`);
  process.exit(result.allPass ? 0 : 1);
}
