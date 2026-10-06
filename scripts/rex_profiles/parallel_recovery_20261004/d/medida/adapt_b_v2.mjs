/**
 * Adaptador v2 da frente B por **capacidade** (barra D, rolda 3, requisito 9).
 *
 * Executa as ferramentas REAIS de B en `da5472c` (verificador de sitios, medidor
 * CRAM `medir-cram-b3.py` e CLI do decoder nativo `rex-enigma`) contra
 * `dB-truth-v2.json`, conxelado en §12.15 antes de calquera execución.
 *
 * Disciplina:
 *  - Nada aquí calcula un valor esperado: sae do gabarito (opcodes polo instrumento,
 *    ROM lida por D, ponteiros da táboa lidos por D).
 *  - O que se gradúa en KBC é a **exportación de B** contra a lectura de D; unha
 *    fila non pasa por que B concorde consigo mesmo.
 *  - `KBE` non mide equivalencia de saída. Ningunha fila declara `consumo-observado`
 *    nin `equivalencia`.
 *  - O que non ten fronteira independente (`KBE-slot-5`, equivalencia) publícase
 *    `descoñecido`, non se adiviña.
 *
 * Uso: node scripts/…/d/medida/adapt_b_v2.mjs [--chave B_da5472c]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BYOR, FERRAMENTAS, RAIZ, SCRATCH_V2, executar, garantir, gravarEvidencia, linha, sha256,
  sha256Arquivo, shaFerramenta, presente, verificarProcedencia,
} from "./ferramentas.mjs";
import { xerador } from "../lib_bench.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DRIVER = path.join(AQUI, "drivers_b.py");
const DIR_B = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d/frentes/b");
const GABARITO = "isa-oraculo-v2";
const CONTRATO = "EXTENSOES-D v2-B";
const HEX = (n) => `0x${n.toString(16)}`;
const hexNum = (s) => (typeof s === "string" ? parseInt(s, 16) : s);
const div = (campo, esperado, medido) => ({ campo, esperado, medido: medido === undefined ? null : medido });

export function adaptarB2({ chave = "B_da5472c", dirVerdade = DIR_B, romPath = BYOR.rom, arquivoVerdade = null } = {}) {
  if (!presente(chave)) return { ausente: true, linhas: [] };
  const f = FERRAMENTAS[chave];
  const tag = f.sha.slice(0, 7);
  const OUT = garantir(path.join(SCRATCH_V2, `b-${tag}`));
  // `arquivoVerdade` é só o ponto de inxección dos controis negativos de *este*
  // ficheiro de tests: unha copia mutada nunca substitúe o gabarito pinado.
  const truthPath = arquivoVerdade ?? path.join(dirVerdade, "dB-truth-v2.json");
  const pin = JSON.parse(fs.readFileSync(path.join(DIR_B, "pin-b-v2.json"), "utf8"));
  if (!arquivoVerdade && sha256Arquivo(truthPath) !== pin.arquivos["dB-truth-v2.json"].sha256)
    throw new Error("pin pin-b-v2.json: dB-truth-v2.json diverxe do hash versionado");
  const t = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const rom = fs.readFileSync(romPath);
  const romOk = sha256(rom) === BYOR.rom_sha256 && rom.length === BYOR.rom_size;
  if (!romOk) throw new Error("ROM BYOR ausente ou diverxente do pin: non se mide (R0)");

  const linhas = [];
  const base = (extra) => ({ frente: "B", sha_frente: f.sha, gabarito: GABARITO, contrato: CONTRATO, ...extra });
  const sitio = (id) => t.sitios.find((s) => s.id === id);
  const romEm = (s) => rom.subarray(s.sitio, s.sitio + s.lonxitude).toString("hex");

  // ---------------------------------------------------- driver: verificador de B
  const sitiosKb = t.sitios.filter((s) => s.capacidade === "KB1v" || s.capacidade === "KB2v");
  const payload = path.join(OUT, "payload-v2.json");
  fs.writeFileSync(payload, JSON.stringify({
    arvore: f.arvore, rom: romPath,
    acoes: [
      { id: "config", tipo: "alegacao_sitio", endereco: 0x1b64c },
      { id: "verif-kb", tipo: "verificar_sitios", sitios: sitiosKb.map((s) => ({ endereco: s.sitio, hexbytes: s.esperado_bytes })) },
    ],
  }, null, 2));
  const drv = executar("python3", [DRIVER, payload], { cwd: RAIZ, timeout: 300_000 });
  const drvJson = drv.rc === 0 ? JSON.parse(drv.stdout) : null;
  const cmdDriver = `python3 ${path.relative(RAIZ, DRIVER)} ${path.relative(RAIZ, payload)}`;
  const divB = new Set((drvJson?.acoes?.["verif-kb"]?.divergentes ?? []).map((d) => d.offset));

  // ------------------------------------------------------------ KB1v / KB2v ---
  for (const s of sitiosKb) {
    const lido = romEm(s);
    const divs = [];
    if (lido !== s.esperado_bytes) divs.push(div(`bytes@${HEX(s.sitio)}`, s.esperado_bytes, lido));
    if (divB.has(HEX(s.sitio))) divs.push(div(`verificador_b@${HEX(s.sitio)}`, "conforme", "diverxencia"));
    if (drv.rc !== 0) divs.push(div("driver", "rc 0", drv.rc));
    linhas.push(linha(base({
      fila: s.id.replace(/^kb(\d)-/, "KB$1v-"), capacidade: s.capacidade, eixo: "sitio", nivel: s.nivel,
      comando: cmdDriver, rc: drv.rc, categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      esperados: { bytes: s.esperado_bytes, mnemonico: s.instrumento.mnemonico },
      medidos: { rom_lido: lido, verificador_b: divB.has(HEX(s.sitio)) ? "diverxencia" : "conforme" },
      divergencias: divs,
      motivo: "bytes codificados polo instrumento == bytes da ROM lidos por D; `verificar_sitios` real de B concorda",
    })));
  }
  {
    const cfg = drvJson?.config;
    const lidos = t.tabela_ponteiros.ponteiros;
    const aleg = (cfg?.streams ?? []).map(hexNum);
    const divs = [];
    lidos.forEach((p, i) => {
      if (rom.readUInt32BE(t.tabela_ponteiros.endereco + 4 * i) !== p) divs.push(div(`rom[${i}]`, p, rom.readUInt32BE(t.tabela_ponteiros.endereco + 4 * i)));
      if (aleg[i] !== p) divs.push(div(`alegacao_b[${i}]`, p, aleg[i] ?? null));
    });
    linhas.push(linha(base({
      fila: "KB2v-tabela", capacidade: "KB2v", eixo: "parametro", nivel: "vinculo-estrutural", comando: cmdDriver, rc: drv.rc,
      categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      esperados: { ponteiros: lidos.map(HEX) }, medidos: { alegacao_b: aleg.map(HEX) }, divergencias: divs,
      motivo: "seis ponteiros BE lidos por D da ROM == alegación do módulo real de B",
    })));
  }

  // ------------------------------------------------------------------ KBC ------
  // O `--out` de B só aceita caminhos sob `data/` da árbore dele (confinamento): a
  // execución escribe aí, D copia a exportación para o seu scratch e apaga o ficheiro
  // que deixou na árbore de B.
  const DENTRO_B = path.join(f.arvore, "data/d-eval-tmp");
  const correrCram = (rom_, destino) => {
    garantir(DENTRO_B);
    const tmp = path.join(DENTRO_B, path.basename(destino));
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
    if (fs.existsSync(destino)) fs.rmSync(destino);
    const r = executar("python3", [f.cram, "--rom", rom_, "--out", tmp], { cwd: f.arvore, timeout: 300_000 });
    const gravou = fs.existsSync(tmp);
    if (gravou) { fs.copyFileSync(tmp, destino); fs.rmSync(tmp); }
    return { ...r, gravou };
  };
  const cramOut = path.join(OUT, "cram.json");
  const cram = correrCram(romPath, cramOut);
  const E = fs.existsSync(cramOut) ? JSON.parse(fs.readFileSync(cramOut, "utf8")) : null;
  const cmdCram = `python3 ${["medir-cram-b3.py", "--rom", "<BYOR>", "--out", "<scratch>/cram.json"].join(" ")}`;
  const kbc = (fila, eixo, avaliar, motivo) => {
    const divs = [];
    let medidos = {};
    if (!E) divs.push(div("export", "gravado", `rc ${cram.rc}`));
    else {
      try {
        medidos = avaliar(divs) ?? {};
      } catch (e) {
        divs.push(div("campo", "presente no export de B", String(e.message)));
      }
    }
    linhas.push(linha(base({
      fila, capacidade: "KBC", eixo, nivel: "vinculo-estrutural", comando: cmdCram, rc: cram.rc, rc_esperado: 0,
      categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      medidos, divergencias: divs, motivo,
    })));
  };
  const exige = (o, k) => {
    if (o?.[k] === undefined) throw new Error(`falta ${k}`);
    return o[k];
  };
  kbc("KBC-callsite", "chamada", (divs) => {
    const cs = exige(exige(E.pins, "e21"), "callsites_moveq10_bsrw");
    const m = sitio("cram-callsite-moveq"), b = sitio("cram-callsite-bsr");
    if (romEm(m) !== m.esperado_bytes) divs.push(div("rom@0x469a", m.esperado_bytes, romEm(m)));
    if (romEm(b) !== b.esperado_bytes) divs.push(div("rom@0x469c", b.esperado_bytes, romEm(b)));
    if (cs.length !== 1 || hexNum(cs[0].endereco) !== m.sitio || hexNum(cs[0].alvo_bsr) !== b.instrumento.ea)
      divs.push(div("callsites_b", `[{0x469a→0x20fc}]`, JSON.stringify(cs)));
    return { export_b: cs, rom: [romEm(m), romEm(b)] };
  }, "call site `moveq #10` + `bsr.w` → PalLoad_Fade: bytes do instrumento == ROM e == exportación de B");
  kbc("KBC-pal-index", "tabela", (divs) => {
    const e = exige(exige(E.pins, "e21"), "entradas_20");
    t.kbc.pal_index.entradas.forEach((d, i) => {
      const b = e[i];
      if (!b || hexNum(b.ponteiro) !== d.ponteiro || hexNum(b.ramaddr) !== d.ramaddr || hexNum(b.contagem) !== d.contagem)
        divs.push(div(`entrada[${i}]`, { ponteiro: HEX(d.ponteiro), ramaddr: HEX(d.ramaddr), contagem: HEX(d.contagem) }, b ?? null));
    });
    if (e.length !== 20) divs.push(div("n_entradas", 20, e.length));
    return { entradas_b: e.length };
  }, "as 20 entradas de Pal_Index lidas por D == as da exportación de B");
  kbc("KBC-pal-special", "hash", (divs) => {
    const h = exige(exige(exige(E.pins, "e21"), "checks"), "pal_special_128b_sha");
    if (h !== t.kbc.pal_special.sha256) divs.push(div("pal_special_sha256", t.kbc.pal_special.sha256, h));
    return { sha256_b: h };
  }, "SHA-256 de 128 B no ponteiro da entrada 10, calculado por D == o de B");
  kbc("KBC-ss-tabela", "hash", (divs) => {
    const h = exige(exige(E.pins, "e19_blink"), "tabela_sha256");
    if (h !== t.kbc.ss_wall_tabela.sha256) divs.push(div("ss_wall_tabela_sha256", t.kbc.ss_wall_tabela.sha256, h));
    return { sha256_b: h };
  }, "SHA-256 da táboa de 128 B en 0x1B43A, calculado por D == o de B");
  kbc("KBC-blink", "sitio", (divs) => {
    const p = exige(E.pins, "e19_blink");
    const s = sitio("cram-blink-subq");
    if (romEm(s) !== s.esperado_bytes) divs.push(div("rom@0x1b33a", s.esperado_bytes, romEm(s)));
    if (hexNum(p.desmontado?.[0]?.endereco) !== s.sitio) divs.push(div("desmontado[0].endereco", HEX(s.sitio), p.desmontado?.[0]?.endereco ?? null));
    if (hexNum(p.campos_w?.ani0_time) !== hexNum(t.kbc.hipotese.campos_lidos_por_D.ani0_time))
      divs.push(div("campos_w.ani0_time", t.kbc.hipotese.campos_lidos_por_D.ani0_time, p.campos_w?.ani0_time ?? null));
    return { rom: romEm(s), campo_b: p.campos_w?.ani0_time ?? null };
  }, "blink `subq.b #1,(0xFEC0).w`: bytes do instrumento == ROM e o campo .w de B == o que a ROM contén");
  kbc("KBC-palcycle", "sitio", (divs) => {
    const p = exige(E.pins, "e20_palcycle_ss");
    const s = sitio("cram-palcycle-tst");
    if (romEm(s) !== s.esperado_bytes) divs.push(div("rom@0x4962", s.esperado_bytes, romEm(s)));
    if (hexNum(p.desmontado?.[0]?.endereco) !== s.sitio) divs.push(div("desmontado[0].endereco", HEX(s.sitio), p.desmontado?.[0]?.endereco ?? null));
    if (hexNum(p.campos_w?.f_pause) !== hexNum(t.kbc.hipotese.campos_lidos_por_D.f_pause))
      divs.push(div("campos_w.f_pause", t.kbc.hipotese.campos_lidos_por_D.f_pause, p.campos_w?.f_pause ?? null));
    return { rom: romEm(s), campo_b: p.campos_w?.f_pause ?? null };
  }, "`tst.w (0xF63A).w` do PalCycle_SS: bytes do instrumento == ROM e o campo .w de B == o que a ROM contén");
  kbc("KBC-hipotese", "hipotese", (divs) => {
    const e = exige(E, "e18r");
    if (e.hipotese_escolhida !== t.kbc.hipotese.escolhida_por_B) divs.push(div("hipotese_escolhida", t.kbc.hipotese.escolhida_por_B, e.hipotese_escolhida));
    const mm = e.H_B_mismatches;
    const nMm = Array.isArray(mm) ? mm.length : Object.keys(mm ?? { x: 1 }).length;
    if (nMm !== 0) divs.push(div("H_B_mismatches", 0, nMm));
    for (const [k, v] of Object.entries(e.invariantes ?? {})) if (v !== true) divs.push(div(`invariante.${k}`, true, v));
    return { escolhida: e.hipotese_escolhida, mismatches: nMm };
  }, "H_B escollida sen mismatch e coa ROM; as invariantes declaradas por B ficaron verdadeiras");

  // Controis de KBC (non puntúan).
  {
    const outB = path.join(OUT, "cram-2.json");
    if (fs.existsSync(outB)) fs.rmSync(outB);
    const r2 = correrCram(romPath, outB);
    const norm = (p) => {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      delete j.gerado_em;
      return JSON.stringify(j);
    };
    const igual = E && fs.existsSync(outB) && norm(cramOut) === norm(outB);
    linhas.push(linha(base({
      fila: "CONTROLE-KBC-REPRODUCAO", capacidade: "audit", eixo: "reprodución", comando: cmdCram, rc: r2.rc,
      categoria: "aplicavel", veredito: igual ? "CONTROLADO" : "INCOHERENTE", pontua: false,
      esperados: { exportacion_igual_sen_gerado_em: true }, medidos: { igual },
      divergencias: igual ? [] : [div("exportacion", "igual", "diferente")], motivo: "dúas execucións da mesma ferramenta dan a mesma exportación",
    })));
    const rom2 = path.join(OUT, "rom-1-byte-virado.bin");
    const mut = Buffer.from(rom);
    mut[0x469b] ^= 0x01;
    fs.writeFileSync(rom2, mut);
    const outM = path.join(OUT, "cram-rom-virada.json");
    if (fs.existsSync(outM)) fs.rmSync(outM);
    const rm = correrCram(rom2, outM);
    const recusou = rm.rc !== 0 && !rm.gravou && /sha|pin|diverg|rom/i.test(`${rm.stderr}${rm.stdout}`);
    linhas.push(linha(base({
      fila: "CONTROLE-KBC-ROM-ADULTERADA", capacidade: "audit", eixo: "identidade", comando: cmdCram, rc: rm.rc,
      categoria: recusou ? "nao-suportado" : "falha", veredito: recusou ? "CONTROLADO" : "INCOHERENTE", pontua: false,
      esperados: { rc_distinto_de_0: true, exportacion_gravada: false },
      medidos: { rc: rm.rc, exportacion_gravada: rm.gravou, mensaxe: `${rm.stderr}${rm.stdout}`.trim().slice(0, 200) },
      divergencias: recusou ? [] : [div("recusa", "rc≠0 sen export", `rc ${rm.rc}`)],
      motivo: "LIMITE: a recusa é pola porta de SHA da ROM; non proba que o sitio alegado se lea (publicado, non escondido)",
    })));
    fs.rmSync(rom2);
  }

  // ------------------------------------------------------------------ KBE ------
  const ENIGMA = f.enigma;
  const ptr = t.tabela_ponteiros.ponteiros;
  const slotBytes = (i) => rom.subarray(ptr[i], ptr[i] + (i < 5 ? ptr[i + 1] - ptr[i] : 0));
  const decodificarArquivo = (nome, buf, extra = []) => {
    const fi = path.join(OUT, `${nome}.eni`);
    const fj = path.join(OUT, `${nome}.json`);
    fs.writeFileSync(fi, buf);
    if (fs.existsSync(fj)) fs.rmSync(fj);
    const r = executar(ENIGMA, ["decode-file", fi, "--json", fj, ...extra], { cwd: RAIZ, timeout: 60_000 });
    const j = fs.existsSync(fj) ? JSON.parse(fs.readFileSync(fj, "utf8")) : null;
    return { r, j, cmd: `rex-enigma decode-file ${nome}.eni --json ${nome}.json ${extra.join(" ")}`.trim() };
  };
  const nativoRom = [];
  for (let i = 0; i < 6; i += 1) {
    const fj = path.join(OUT, `slot-${i}.json`);
    if (fs.existsSync(fj)) fs.rmSync(fj);
    const r = executar(ENIGMA, ["decode-rom", romPath, HEX(ptr[i]), "--json", fj], { cwd: RAIZ, timeout: 60_000 });
    nativoRom.push({ r, j: fs.existsSync(fj) ? JSON.parse(fs.readFileSync(fj, "utf8")) : null, cmd: `rex-enigma decode-rom <BYOR> ${HEX(ptr[i])} --json slot-${i}.json` });
  }
  for (const s of t.kbe.slots) {
    const i = Number(s.id.split("-").pop());
    const { r, j, cmd } = nativoRom[i];
    const divs = [];
    if (r.rc !== 0 || j?.veredito !== "OK") divs.push(div("veredito", "OK com rc 0", `rc ${r.rc} ${j?.veredito ?? "sen json"} ${j?.erro ?? ""}`.trim()));
    else {
      if (j.bytes_armazenados !== s.esperado_bytes_armazenados) divs.push(div("bytes_armazenados", s.esperado_bytes_armazenados, j.bytes_armazenados));
      if (j.bytes_lidos > j.bytes_armazenados) divs.push(div("bytes_lidos<=armazenados", `≤ ${j.bytes_armazenados}`, j.bytes_lidos));
      if (j.padding_console !== j.bytes_armazenados - j.bytes_lidos) divs.push(div("padding", j.bytes_armazenados - j.bytes_lidos, j.padding_console));
      if (j.bytes_armazenados % 2 !== 0) divs.push(div("armazenados_par", "par", j.bytes_armazenados));
      if (!(j.output_size > 0 && j.output_size % 2 === 0)) divs.push(div("output_size", "par e > 0", j.output_size));
      if (j.terminador !== true) divs.push(div("terminador", true, j.terminador));
      if (j.determinismo_decode_duplo !== true) divs.push(div("determinismo", true, j.determinismo_decode_duplo));
    }
    linhas.push(linha(base({
      fila: s.id, capacidade: "KBE", eixo: "consumo-estatico", nivel: "referencia-estatica", comando: cmd, rc: r.rc, rc_esperado: 0,
      categoria: divs.length ? "falha" : "aplicavel", veredito: divs.length ? "FAIL" : "PASS",
      esperados: { bytes_armazenados: s.esperado_bytes_armazenados, offset: HEX(s.offset) },
      medidos: j ? { bytes_lidos: j.bytes_lidos, padding_console: j.padding_console, bytes_armazenados: j.bytes_armazenados, output_size: j.output_size, output_sha256: j.output_sha256 } : {},
      divergencias: divs,
      motivo: "tamaño do slot polos ponteiros da ROM (lidos por D) + invariantes; NON é equivalencia de saída",
    })));
  }
  const stream0 = slotBytes(0);
  for (const tr of t.kbe.truncamentos) {
    const corte = tr.corte_bytes ?? (tr.corte === "armazenado-1" ? stream0.length - 1 : Math.floor(stream0.length / 2));
    const { r, j, cmd } = decodificarArquivo(tr.id, stream0.subarray(0, corte));
    const ok = r.rc !== null && tr.codigos_aceitados.includes(r.rc) && j?.veredito === "ERRO";
    linhas.push(linha(base({
      fila: tr.id, capacidade: "KBE", eixo: "recusa", nivel: "referencia-estatica", comando: cmd, rc: r.rc,
      categoria: ok ? "nao-suportado" : r.rc === 0 ? "falha" : "desconhecido", veredito: ok ? "PASS" : "FAIL",
      esperados: { corte_bytes: corte, rc_aceitado: tr.codigos_aceitados, saida: "ERRO sem output" },
      medidos: { rc: r.rc, veredito: j?.veredito ?? null, erro: j?.erro ?? null, output_sha256: j?.output_sha256 ?? null },
      divergencias: ok ? [] : [div("rc|veredito", `rc ∈ ${JSON.stringify(tr.codigos_aceitados)} e ERRO`, `${r.rc} ${j?.veredito ?? ""}`)],
      motivo: "stream sen terminador completo ten de recusarse con código estruturado e sen saída",
    })));
  }
  {
    const s = t.kbe.sensibilidade;
    const original = Buffer.from(stream0);
    const mutado = Buffer.from(stream0);
    mutado[s.byte_rel] ^= 1 << s.bit;
    const a = decodificarArquivo("KBE-sens-orixinal", original);
    const b = decodificarArquivo("KBE-sens-mutado", mutado);
    const ok = a.j?.veredito === "OK" && (b.r.rc !== 0 || b.j?.output_sha256 !== a.j.output_sha256);
    linhas.push(linha(base({
      fila: "KBE-sensibilidade", capacidade: "KBE", eixo: "mutacion", nivel: "referencia-estatica", comando: b.cmd, rc: b.r.rc,
      categoria: ok ? "aplicavel" : "falha", veredito: ok ? "PASS" : "FAIL",
      esperados: { byte: s.byte_rel, bit: s.bit, resultado: "saída distinta ou recusa" },
      medidos: { rc: b.r.rc, sha_orixinal: a.j?.output_sha256 ?? null, sha_mutado: b.j?.output_sha256 ?? null, veredito_mutado: b.j?.veredito ?? null },
      divergencias: ok ? [] : [div("sensibilidade", "saída distinta ou recusa", "decoder cego á mutación")],
      motivo: s.motivo,
    })));
  }
  {
    const aceit = t.kbe.mutacoes_sen_panic.codigos_aceitados;
    const fora = [];
    const hist = {};
    t.kbe.mutacoes_sen_panic.entradas.forEach((m, k) => {
      const buf = Buffer.from(slotBytes(m.stream));
      const idx = Math.min(buf.length - 1, Math.floor(m.byte_rel * (buf.length - 1)));
      buf[idx] ^= 1 << m.bit;
      const { r } = decodificarArquivo(`mut-${k}`, buf);
      hist[String(r.rc)] = (hist[String(r.rc)] ?? 0) + 1;
      if (r.rc === null || !aceit.includes(r.rc)) fora.push({ k, stream: m.stream, byte: idx, bit: m.bit, rc: r.rc });
    });
    linhas.push(linha(base({
      fila: "KBE-sen-panic", capacidade: "KBE", eixo: "robustez", nivel: "referencia-estatica",
      comando: "rex-enigma decode-file mut-<k>.eni (48 entradas)", rc: null, rc_esperado: null,
      categoria: fora.length ? "falha" : "aplicavel", veredito: fora.length ? "FAIL" : "PASS",
      esperados: { n: t.kbe.mutacoes_sen_panic.entradas.length, rc_aceitado: aceit },
      medidos: { histograma_rc: hist, fora_do_conxunto: fora },
      divergencias: fora.map((x) => div(`mut-${x.k}`, `rc ∈ ${JSON.stringify(aceit)}`, x.rc)),
      motivo: t.kbe.mutacoes_sen_panic.motivo,
    })));
  }
  // Filas `descoñecido` (non puntúan): publícanse, non se agochan.
  linhas.push(linha(base({
    fila: "KBE-slot-5", capacidade: "KBE", eixo: "consumo-estatico", nivel: "referencia-estatica", categoria: "desconhecido", veredito: "INCONCLUSIVE", pontua: false,
    esperados: { estado: "descoñecido" },
    medidos: nativoRom[5].j ? { bytes_armazenados_observado: nativoRom[5].j.bytes_armazenados, veredito: nativoRom[5].j.veredito, sen_fronteira_independente: true } : {},
    motivo: t.kbe.sexto_slot.motivo,
  })));
  linhas.push(linha(base({
    fila: "KBE-equivalencia", capacidade: "KBE", eixo: "equivalencia", nivel: "equivalencia", categoria: "desconhecido", veredito: "VOID", pontua: false,
    esperados: { estado: "descoñecido" }, motivo: t.kbe.equivalencia.motivo,
  })));
  // Control: concordancia co decoder de pesquisa da familia B (espello, R10; non é proba).
  {
    const comp = [];
    for (let i = 0; i < 6; i += 1) {
      const buf = rom.subarray(ptr[i], ptr[i] + (i < 5 ? ptr[i + 1] - ptr[i] : 4096));
      const fi = path.join(OUT, `espello-${i}.eni`);
      fs.writeFileSync(fi, buf);
      const r = executar("python3", [BYOR.decoder, "decode", "--in", fi], { cwd: RAIZ, timeout: 60_000 });
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* publicado como null */ }
      comp.push({ slot: i, espello_sha: j?.output_sha256 ?? null, nativo_sha: nativoRom[i].j?.output_sha256 ?? null, igual: !!j && j.output_sha256 === nativoRom[i].j?.output_sha256 });
    }
    linhas.push(linha(base({
      fila: "CONTROLE-KBE-ESPELLO", capacidade: "audit", eixo: "espello", categoria: "nao-aplicavel", veredito: "CONTROLADO", pontua: false,
      comando: "python3 enigma_research.py decode --in espello-<i>.eni", esperados: { nota: "observación; non é equivalencia (R10)" },
      medidos: { comparacion: comp, concordan: comp.filter((c) => c.igual).length, total: comp.length },
      motivo: "o decoder de pesquisa é da familia B (derivado de lectura LGPL, RESEARCH ONLY): a súa concordancia non valida o decoder nativo",
    })));
  }
  linhas.push(linha(base({
    fila: "CONTROLE-IDENTIDADE-B2", capacidade: "audit", eixo: "identidade", categoria: "aplicavel", veredito: "CONTROLADO", pontua: false,
    medidos: {
      rom_sha256: sha256(rom), enigma_sha256: sha256Arquivo(f.enigma), cram_sha256: sha256Arquivo(f.cram),
      decoder_pesquisa_sha256: sha256Arquivo(BYOR.decoder), decoder_pesquisa_pin: BYOR.decoder_sha256,
    },
    motivo: "identidade das ferramentas e ROM usadas na medición",
  })));

  const manifesto = {
    frente: "B", sha_frente: f.sha, chave: tag, gabarito: GABARITO, contrato: CONTRATO,
    ferramenta: { cram: f.cram, enigma: f.enigma, enigma_sha256: sha256Arquivo(f.enigma), cram_sha256: sha256Arquivo(f.cram) },
    procedencia: verificarProcedencia(chave),
    rom: { sha256: sha256(rom), pin: BYOR.rom_sha256, ok: romOk },
    truth: { arquivo: path.relative(RAIZ, truthPath), sha256: sha256Arquivo(truthPath) },
    pin: { arquivo: "pin-b-v2.json", sha256: sha256Arquivo(path.join(DIR_B, "pin-b-v2.json")) },
    denominador: t.denominador,
  };
  return { ausente: false, linhas, manifesto };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--chave");
  const chave = i >= 0 ? process.argv[i + 1] : "B_da5472c";
  const r = adaptarB2({ chave });
  if (r.ausente) {
    console.log(`[B v2] ferramenta ${chave} ausente — rexistrar bloqueio.`);
    process.exitCode = 3;
  } else {
    const desc = gravarEvidencia(`B-${r.manifesto.sha_frente.slice(0, 7)}-v2.jsonl`, r.linhas, r.manifesto);
    const por = {};
    for (const l of r.linhas) por[`${l.pontua === false ? "(nao-pontua) " : ""}${l.veredito}`] = (por[`${l.pontua === false ? "(nao-pontua) " : ""}${l.veredito}`] ?? 0) + 1;
    console.log(`[B v2] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…) ${JSON.stringify(por)}`);
    for (const l of r.linhas) if (l.veredito !== "PASS") console.log(`  ${l.fila.padEnd(30)} ${l.veredito.padEnd(12)} rc=${l.rc} ${JSON.stringify(l.divergencias).slice(0, 200)}`);
  }
}
