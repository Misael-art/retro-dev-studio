/**
 * Adaptador da frente C (`rex-cfg analyze`) — executa a ferramenta REAL sobre as
 * fixtures autorais de D (4 binários montados byte a byte a partir da tabela ISA,
 * sem intervir nos docs nem no código de C) e grava uma linha por fila do
 * denominador congelado em `EXTENSOES-D §5` (KC1=20, KC2=6, KC3=3, KC4=4,
 * KC5=5, TC=4 → 42).
 *
 * Disciplina:
 *  - R9: nada aqui preenche um valor a partir do gabarito; só se lê o export
 *    produzido pela ferramenta e compara-se com a expectativa congelada.
 *  - R8: as filas de adulteração (TC) exigem rc/estrutura exactos por
 *    **reexecução**.
 *  - §1/§5: sondas fora da lista fechada §3 de C graduam a *recusa limpa com
 *    registo* (categoria `não suportado`); decodificá-las é `falha`.
 *  - Ferramenta ausente ⇒ todas as filas `desconhecido` com motivo, nunca 0.
 *
 * Uso:
 *   node scripts/.../d/medida/adapt_c.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  FERRAMENTAS,
  FIXTURES,
  RAIZ,
  SCRATCH,
  addr,
  executar,
  garantir,
  gravarBin,
  gravarEvidencia,
  linha,
  lerEnd,
  sha256Arquivo,
  shaFerramenta,
  presente,
  verificarProcedencia,
} from "./ferramentas.mjs";

const DIR_C = path.join(FIXTURES, "c");
const OUT_C = path.join(SCRATCH, "c");
const lerp = (v) => (typeof v === "string" ? lerEnd(v) : v);
const truthC = (fix) => JSON.parse(fs.readFileSync(path.join(DIR_C, `${fix}-truth.json`), "utf8"));

/** Invoca `rex-cfg analyze` sobre a fixture `fix` e devolve o export lido do
 *  `--out` (o stdout é só um resumo de uma linha). */
function analizar({ fix, nome, raizes, sitios, binArquivo }) {
  garantir(OUT_C);
  const t = truthC(fix);
  const out = path.join(OUT_C, `${nome}.json`);
  if (fs.existsSync(out)) fs.rmSync(out);
  const bin = binArquivo ?? path.join(DIR_C, `${fix}.bin`);
  const reg = t.regioes[0];
  const args = [
    "analyze",
    "--bin",
    bin,
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
  const r = executar(FERRAMENTAS.C.bin, args, { cwd: path.dirname(bin), timeout: 120_000 });
  const exp = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  return { ...r, exp, out, args, bin };
}

/** Índices de leitura do export (nunca de D). */
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
  const fronteiras = new Map();
  for (const f of exp?.fronteiras ?? []) fronteiras.set(f.endereco, f);
  const chamadas = new Map();
  for (const c of exp?.chamadas ?? []) chamadas.set(c.sitio, c);
  const sitios = new Map();
  for (const s of exp?.sitios ?? []) sitios.set(s.endereco, s);
  const blocoDe = (end) => (exp?.blocos ?? []).find((b) => (b.instrucoes ?? []).some((i) => i.endereco === end)) ?? null;
  const blocoQueContem = (end) =>
    (exp?.blocos ?? []).find((b) => (b.instrucoes ?? []).some((i) => end >= i.endereco && end < i.endereco + i.tam)) ?? null;
  return { ins, porOrigem, fronteiras, chamadas, sitios, blocosPorEntrada, blocoDe, blocoQueContem };
}

/** Vocabulario `status` documentado por C na súa CONTRACT §4. */
const STATUS_V = new Set(["resolvido", "fora-da-regiao", "indireto-opaco", "armadilha"]);
const comandoDe = (r) => ["rex-cfg", ...r.args].join(" ");
const div = (campo, esperado, medido) => ({ campo, esperado, medido: medido === undefined ? null : medido });

export function adaptarC() {
  if (!presente("C")) return { ausente: true, linhas: [] };
  const sha = FERRAMENTAS.C.sha;
  const linhas = [];
  const brutos = [];
  const rodadas = {};
  for (const fix of ["dC-cx1", "dC-cx2", "dC-cx3", "dC-cx4"]) rodadas[fix] = analizar({ fix, nome: `${fix}-base` });
  const IDX = Object.fromEntries(Object.entries(rodadas).map(([k, r]) => [k, indice(r.exp)]));
  const base = (r) => ({
    frente: "C",
    sha_frente: sha,
    comando: comandoDe(r),
    rc: r.rc,
    bruto: (r.stdout || "").trim().slice(0, 400),
  });
  const registrarBruto = (nome, r) =>
    brutos.push({ nome, rc: r.rc, resumo: ((r.stdout || "") + (r.stderr || "")).trim().slice(0, 300), comando: comandoDe(r) });

  // --- Audit da prova anexa (requisito 9): `objeto.sha256` do export vs digest
  // recomposto por D do ficheiro efectivamente lido. Control não pontuado.
  for (const [fix, r] of Object.entries(rodadas)) {
    const recomposto = sha256Arquivo(r.bin);
    const declarado = r.exp?.objeto?.sha256 ?? null;
    linhas.push(
      linha({
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
    );
  }

  // ------------------------------------------------------------------ KC1 (20)
  const t1 = truthC("dC-cx1");
  const r1 = rodadas["dC-cx1"];
  const i1 = IDX["dC-cx1"];
  for (const row of t1.kc1) {
    const ins = i1.ins.get(lerp(row.endereco));
    const front = i1.fronteiras.get(lerp(row.endereco));
    const fora = row.dominio === "fora-do-subconjunto-de-C";
    const medidos = ins
      ? { tam: ins.tam, mnem: ins.mnem, classe: ins.classe }
      : front
        ? { fronteira: front.tipo, opcode: front.opcode, motivo: front.motivo }
        : { nada: "nem instrução nem fronteira no endereço" };
    let categoria, veredito, divs = [], motivo;
    if (fora) {
      const recusou = !ins && front && front.tipo === "opcode-fora-do-subconjunto" && front.opcode != null;
      categoria = recusou ? "nao-suportado" : "falha";
      veredito = recusou ? "PASS" : "FAIL";
      if (!recusou) divs.push(div("comportamento", "fronteira opcode-fora-do-subconjunto", ins ? `decodificado como ${ins.mnem} (tam ${ins.tam})` : "sem registo"));
      motivo = recusou
        ? `fora da lista fechada §3; a recusa limpa con opcode é o ítem medido (${row.citacao_C})`
        : "C aceptou unha forma fóra da súa lista fechada §3 sen declarala soportada; o eixo desta fila é a fronteira, non o comprimento";
    } else if (!ins) {
      categoria = "falha";
      veredito = "FAIL";
      divs.push(div("instrucao", row.esperado_tam, front ? `fronteira ${front.tipo}` : "ausente"));
      motivo = "non hai instrución no endereço alegado: dividida, atravesada ou cortada antes";
    } else {
      const mnem = String(ins.mnem ?? "").toLowerCase();
      const stemOk = row.esperado_stems.some((s) => mnem.includes(s));
      if (ins.tam !== row.esperado_tam) divs.push(div("tam", row.esperado_tam, ins.tam));
      if (!stemOk) divs.push(div("mnem", row.esperado_stems.join("|"), ins.mnem));
      categoria = divs.length ? "falha" : "aplicavel";
      veredito = divs.length ? "FAIL" : "PASS";
      motivo = stemOk && ins.tam === row.esperado_tam ? "" : "desvio do gabarito autoral D";
    }
    linhas.push(
      linha({
        ...base(r1),
        fila: row.id,
        capacidade: "KC1",
        eixo: "instrução",
        categoria,
        veredito,
        esperados: { tam: row.esperado_tam, stems: row.esperado_stems.join("|") },
        medidos,
        divergencias: divs,
        dominio: row.dominio,
        bytes: row.bytes,
        citacao_C: row.citacao_C,
        motivo,
      }),
    );
  }

  // ------------------------------------------------------------------ KC2 (6)
  const t2 = truthC("dC-cx2");
  const t4 = truthC("dC-cx4");
  const r2 = rodadas["dC-cx2"];
  const i2 = IDX["dC-cx2"];
  for (const row of t2.kc2.filter((x) => x.id !== "KC2-indexado")) {
    const esp = row.esperado;
    const end = lerp(row.endereco);
    const ins = i2.ins.get(end);
    const arestas = i2.porOrigem.get(end) ?? [];
    const medidos = { arestas: arestas.map((a) => `${a.tipo}->${a.alvo}`), mnem: ins?.mnem ?? null };
    const divs = [];
    if (esp.tam !== undefined && (ins?.tam ?? null) !== esp.tam) divs.push(div("tam", esp.tam, ins?.tam ?? null));
    if (esp.alvo !== undefined) {
      const alvo = lerp(esp.alvo);
      const cand = esp.tipo_aresta
        ? arestas.find((a) => a.tipo === esp.tipo_aresta)
        : arestas.find((a) => a.alvo === alvo && a.tipo !== "queda");
      medidos.alvo = cand?.alvo ?? null;
      medidos.tipo_aresta = cand?.tipo ?? null;
      if (!cand || cand.alvo !== alvo)
        divs.push(div("alvo", alvo, arestas.length ? arestas.map((a) => `${a.tipo}->${addr(a.alvo)}`).join(",") : "sem aresta"));
    }
    if (esp.tipo_aresta !== undefined && medidos.tipo_aresta !== esp.tipo_aresta)
      divs.push(div("tipo_aresta", esp.tipo_aresta, medidos.tipo_aresta));
    if (esp.sucessor_queda !== undefined) {
      const q = arestas.find((a) => a.tipo === "queda");
      medidos.sucessor_queda = q?.alvo ?? null;
      if (!q || q.alvo !== lerp(esp.sucessor_queda)) divs.push(div("sucessor_queda", esp.sucessor_queda, q?.alvo ?? null));
    }
    linhas.push(
      linha({
        ...base(r2),
        fila: row.id,
        capacidade: "KC2",
        eixo: "operando/fluxo",
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: esp,
        medidos,
        divergencias: divs,
        discriminante: esp.discriminante ?? null,
        motivo: divs.length ? "" : `${esp.base ?? ""}${esp.nota ? ` — ${esp.nota}` : ""}`,
      }),
    );
  }
  {
    const row = t4.kc2_indexado;
    const r4 = rodadas["dC-cx4"];
    const i4 = IDX["dC-cx4"];
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
      linha({
        ...base(r4),
        fila: row.id,
        capacidade: "KC2",
        eixo: "operando/fluxo",
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: row.esperado,
        medidos: { tam: ins?.tam ?? null, mnem: ins?.mnem ?? null },
        divergencias: divs,
        bytes: row.bytes,
        motivo: row.nota,
      }),
    );
  }

  // ------------------------------------------------------------------ KC3 (3)
  const t3 = truthC("dC-cx3");
  const r3 = rodadas["dC-cx3"];
  const i3 = IDX["dC-cx3"];
  for (const row of t3.kc3) {
    const esp = row.esperado;
    const end = lerp(esp.endereco);
    const front = i3.fronteiras.get(end);
    const ins = i3.ins.get(end);
    const medidos = front
      ? { fronteira: front.tipo, endereco: front.endereco, opcode: front.opcode, motivo: front.motivo }
      : ins
        ? { sem_fronteira: true, decodificado: { tam: ins.tam, mnem: ins.mnem } }
        : { sem_fronteira: true, nada: true };
    const divs = [];
    if (!front)
      divs.push(div("fronteira", esp.tipo ?? "fronteira no endereço", ins ? `decodificado como ${ins.mnem} (tam ${ins.tam})` : "ausente"));
    else {
      if (esp.tipo && front.tipo !== esp.tipo) divs.push(div("tipo", esp.tipo, front.tipo));
      if (front.opcode == null) divs.push(div("opcode", row.opcode, null));
    }
    if (esp.bytes_para !== undefined) {
      const reclamadas = [...i3.ins.keys()].filter((e) => e > end && e < end + 0x10);
      if (reclamadas.length) divs.push(div("bytes_para", esp.bytes_para, `instruções reclamadas após a fronteira: ${reclamadas.map(addr)}`));
    }
    linhas.push(
      linha({
        ...base(r3),
        fila: row.id,
        capacidade: "KC3",
        eixo: "fronteira",
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: esp,
        medidos,
        divergencias: divs,
        opcode_esperado: row.opcode,
        motivo: esp.nota ?? "",
      }),
    );
  }

  // ------------------------------------------------------------------ KC4 (4)
  const r4 = rodadas["dC-cx4"];
  const i4 = IDX["dC-cx4"];
  const reg4 = t4.regioes[0];
  for (const row of t4.kc4) {
    const esp = row.esperado;
    const end = lerp(row.endereco);
    const cham = i4.chamadas.get(end);
    const arestas = i4.porOrigem.get(end) ?? [];
    const front = i4.fronteiras.get(end);
    const medidos = {
      origem: cham?.sitio ?? arestas[0]?.origem ?? null,
      alvo: cham ? cham.alvo : arestas.find((a) => a.alvo !== null)?.alvo ?? null,
      status: cham?.status ?? null,
      arestas: arestas.map((a) => `${a.tipo}->${a.alvo === null ? "null" : addr(a.alvo)}:${a.status}`),
      fronteira: front?.tipo ?? null,
      opcode_fronteira: front?.opcode ?? null,
      motivo_fronteira: front?.motivo ?? null,
    };
    const divs = [];
    if (esp.origem !== undefined && medidos.origem !== lerp(esp.origem)) divs.push(div("origem", esp.origem, medidos.origem));
    if (esp.alvo !== undefined && medidos.alvo !== (esp.alvo === null ? null : lerp(esp.alvo)))
      divs.push(div("alvo", esp.alvo, medidos.alvo));
    if (esp.status !== undefined && medidos.status !== esp.status) divs.push(div("status", esp.status, medidos.status));
    if (esp.tipo !== undefined) {
      // Corrección de lectura: o valor conxelado `fora-da-regiao` non é un `tipo`
      // de aresta en C, é un `status` (vocabulario §4). Lése no campo que C documenta.
      const campo = STATUS_V.has(esp.tipo) ? "status" : "tipo";
      if (!arestas.some((a) => a[campo] === esp.tipo))
        divs.push(div(campo, esp.tipo, arestas.map((a) => `${a.tipo}:${a.status}`).join(",") || "sem aresta"));
    }
    if (esp.fronteira !== undefined && medidos.fronteira !== esp.fronteira) divs.push(div("fronteira", esp.fronteira, medidos.fronteira));
    if (esp.decodificado_fora !== undefined) {
      const fora = [...i4.ins.keys()].filter((e) => e < reg4.inicio || e >= reg4.fim).length;
      medidos.decodificado_fora = fora;
      if (fora !== esp.decodificado_fora) divs.push(div("decodificado_fora", esp.decodificado_fora, fora));
    }
    if (esp.derivado !== undefined) {
      const alvoL = lerp(esp.alvo);
      const orixL = lerp(esp.origem);
      const raizDerivada =
        (r4.exp?.raizes ?? []).find((x) => x.endereco === alvoL && (x.proveniencia ?? x.grau) === esp.derivado) ?? null;
      const bloco = i4.blocosPorEntrada.get(alvoL);
      const por = (bloco?.["alcanado-por"] ?? []).map((p) => String(p).toLowerCase());
      medidos.derivado = { raiz: raizDerivada?.proveniencia ?? null, bloco_alcanado_por: por };
      const apuntan = por.includes(addr(orixL).toLowerCase()) || por.includes(`0x${orixL.toString(16)}`);
      if (!raizDerivada && !apuntan)
        divs.push(div("derivado", `${esp.derivado} — raíz derivada en C ou bloco alcanado pola orixe`, JSON.stringify(medidos.derivado)));
    }
    linhas.push(
      linha({
        ...base(r4),
        fila: row.id,
        capacidade: "KC4",
        eixo: "chamada",
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: esp,
        medidos,
        divergencias: divs,
        motivo: esp.derivado
          ? "equivalencia de vocabulario §1: C codifica `dentro-de-fluxo` como bloco `alcanado-por [origem]` (errata §5)"
          : "",
      }),
    );
  }

  // ------------------------------------------------------------------ KC5 (5)
  for (const row of t2.kc5) {
    const esp = row.esperado;
    const medidos = {};
    const divs = [];
    if (row.id === "KC5-diamante") {
      // Corrección de lectura: a instrución ramificada (0x2) pertence ao bloco de
      // entrada 0x0, polo que o diamante mídese no bloco que a contén.
      const succ = i2.blocoQueContem(lerp(row.endereco))?.sucessores ?? [];
      medidos.ramos = succ.length;
      medidos.tipos = succ.map((s) => s.tipo);
      if (succ.length !== esp.ramos) divs.push(div("ramos", esp.ramos, succ.length));
      if ([...esp.tipos].sort().join(",") !== [...succ.map((s) => s.tipo)].sort().join(","))
        divs.push(div("tipos", esp.tipos, succ.map((s) => s.tipo)));
    } else if (row.id === "KC5-queda-pos-condicional") {
      const a = (i2.porOrigem.get(lerp(esp.origem)) ?? []).find((x) => x.tipo === esp.tipo && x.alvo === lerp(esp.alvo));
      medidos.aresta = a ? { origem: a.origem, alvo: a.alvo, tipo: a.tipo } : null;
      if (!a) divs.push(div("aresta", esp, (i2.porOrigem.get(lerp(esp.origem)) ?? []).map((x) => `${x.tipo}->${x.alvo}`)));
    } else if (row.id === "KC5-rts-nao-continua") {
      const b = i2.blocosPorEntrada.get(lerp(row.endereco));
      medidos.sucessores = (b?.sucessores ?? []).length;
      medidos.saida = b?.saida ?? null;
      medidos.tipos_de_aresta = (i2.porOrigem.get(lerp(row.endereco)) ?? []).map((a) => a.tipo);
      if (medidos.sucessores !== esp.sucessores) divs.push(div("sucessores", esp.sucessores, medidos.sucessores));
      if (!medidos.tipos_de_aresta.includes(esp.tipo)) divs.push(div("tipo", esp.tipo, medidos.tipos_de_aresta));
      const seguinte = lerp(row.endereco) + 2;
      const blocoSeguinte = i2.blocoQueContem(seguinte);
      if (blocoSeguinte && blocoSeguinte.entrada === lerp(row.endereco))
        divs.push(div("continua_tras_rts", false, `instrución en ${addr(seguinte)} no mesmo bloco`));
    } else if (row.id === "KC5-cobertura") {
      const c = r2.exp?.cobertura ?? {};
      medidos.bytes_decodificados = c["bytes-decodificados"] ?? null;
      medidos.bytes_regiao = c["bytes-regiao"] ?? null;
      medidos.fracao_reportada = c.fracao ?? null;
      if (medidos.bytes_decodificados !== esp.bytes_decodificados) divs.push(div("bytes_decodificados", esp.bytes_decodificados, medidos.bytes_decodificados));
      if (medidos.bytes_regiao !== esp.bytes_regiao) divs.push(div("bytes_regiao", esp.bytes_regiao, medidos.bytes_regiao));
    } else if (row.id === "KC5-vereditos") {
      medidos.miolo = i2.sitios.get(lerp(esp.miolo))?.veredito ?? null;
      medidos.nao_alcancado = i2.sitios.get(lerp(esp.nao_alcancado))?.veredito ?? null;
      if (medidos.miolo !== "miolo-de-instrucao") divs.push(div("miolo", "miolo-de-instrucao", medidos.miolo));
      if (medidos.nao_alcancado !== "dentro-regiao-nao-alcancado") divs.push(div("nao_alcancado", "dentro-regiao-nao-alcancado", medidos.nao_alcancado));
    }
    linhas.push(
      linha({
        ...base(r2),
        fila: row.id,
        capacidade: "KC5",
        eixo: "CFG",
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: esp,
        medidos,
        divergencias: divs,
        nota: row.nota ?? null,
      }),
    );
  }

  // ------------------------------------------------------------------- TC (4)
  for (const receita of t4.tc) {
    const acao = receita.acao;
    if (acao.tipo === "cli") {
      const argsInvalidos = r4.args.map((x) => (x === "candidato" || x === "referencia-estatica" ? acao.valor : x));
      const outTC = path.join(OUT_C, `${receita.id}.json`);
      if (fs.existsSync(outTC)) fs.rmSync(outTC);
      const iOut = argsInvalidos.indexOf("--out");
      if (iOut >= 0) argsInvalidos[iOut + 1] = outTC;
      const r = executar(FERRAMENTAS.C.bin, argsInvalidos, { cwd: SCRATCH, timeout: 60_000 });
      const gravou = fs.existsSync(outTC);
      const divs = r.rc === receita.esperado_rc && !gravou ? [] : [div("rc", receita.esperado_rc, r.rc), ...(gravou ? [div("export_gravado", false, true)] : [])];
      linhas.push(
        linha({
          frente: "C",
          sha_frente: sha,
          fila: receita.id,
          capacidade: "TC",
          eixo: "confiança",
          comando: ["rex-cfg", ...argsInvalidos].join(" "),
          rc: r.rc,
          rc_esperado: receita.esperado_rc,
          categoria: divs.length ? "falha" : "aplicavel",
          veredito: divs.length ? "FAIL" : "PASS",
          esperados: { rc: receita.esperado_rc, analise_executada: false },
          medidos: { rc: r.rc, stderr: (r.stderr || "").trim().slice(0, 200), export_gravado: gravou },
          divergencias: divs,
          motivo: receita.motivo,
        }),
      );
      continue;
    }
    if (acao.tipo === "site") {
      const r = analizar({ fix: "dC-cx4", nome: receita.id, sitios: [...t4.sitios, { endereco: acao.endereco }] });
      registrarBruto(receita.id, r);
      const idx = indice(r.exp);
      const medido = idx.sitios.get(lerp(acao.endereco));
      const divs = medido?.veredito === receita.esperado.veredito ? [] : [div("veredito", receita.esperado.veredito, medido?.veredito ?? null)];
      linhas.push(
        linha({
          ...base(r),
          fila: receita.id,
          capacidade: "TC",
          eixo: "sítio",
          categoria: divs.length ? "falha" : "aplicavel",
          veredito: divs.length ? "FAIL" : "PASS",
          esperados: receita.esperado,
          medidos: { veredito: medido?.veredito ?? null, bloco: medido?.bloco ?? null },
          divergencias: divs,
          motivo: receita.motivo,
        }),
      );
      continue;
    }
    if (acao.tipo === "xor-byte-imagem") {
      // Variante illada (errata §6): raíz extra no primeiro calco aguas abaixo,
      // para que o Δcobertura sexa atribuíbel só á lonxitude da mutación.
      const raizes = [...t4.raizes, { endereco: t4.kc4[0].endereco, proveniencia: "candidato", evidencia: "variante illada" }];
      const sitios = [...t4.sitios, { endereco: t4.kc4[0].endereco }];
      const baseRun = analizar({ fix: "dC-cx4", nome: "TC-4-base-illada", raizes, sitios });
      const ib = indice(baseRun.exp);
      const img = Buffer.from(fs.readFileSync(path.join(DIR_C, "dC-cx4.bin")));
      img[acao.offset_na_arquivo] ^= acao.valor;
      const gravado = gravarBin(OUT_C, "dC-cx4-tamper.bin", img);
      const tamRun = analizar({ fix: "dC-cx4", nome: "TC-4-mutada-illada", raizes, sitios, binArquivo: path.join(OUT_C, "dC-cx4-tamper.bin") });
      const it = indice(tamRun.exp);
      registrarBruto("TC-4-mutada", tamRun);
      const esp = receita.esperado;
      const front = it.fronteiras.get(lerp(esp.endereco_mutado));
      const divs = [];
      if (!front || front.tipo !== "opcode-fora-do-subconjunto")
        divs.push(div("fronteira", `opcode-fora-do-subconjunto em ${addr(esp.endereco_mutado)}`, front ? front.tipo : "ausente"));
      if (front && (front.opcode ?? -1).toString(16).padStart(4, "0") !== esp.bytes_depois)
        divs.push(div("opcode", esp.bytes_depois, front?.opcode?.toString(16) ?? null));
      if (it.ins.has(lerp(esp.endereco_mutado)))
        divs.push(div("instrucao_mutada", "ausente", it.ins.get(lerp(esp.endereco_mutado)).mnem));
      const antes = baseRun.exp?.cobertura?.["bytes-decodificados"] ?? null;
      const depois = tamRun.exp?.cobertura?.["bytes-decodificados"] ?? null;
      const delta = antes !== null && depois !== null ? antes - depois : null;
      if (delta !== 2) divs.push(div("delta_cobertura", 2, delta));
      const idxRow = t4.kc2_indexado;
      const intacta = it.ins.get(lerp(idxRow.endereco));
      if (!intacta || intacta.tam !== idxRow.esperado.tam)
        divs.push(div("downstream", `tam ${idxRow.esperado.tam} em ${addr(idxRow.endereco)}`, intacta?.tam ?? null));
      linhas.push(
        linha({
          ...base(tamRun),
          fila: receita.id,
          capacidade: "TC",
          eixo: "saída",
          categoria: divs.length ? "falha" : "aplicavel",
          veredito: divs.length ? "FAIL" : "PASS",
          esperados: { ...esp, delta_cobertura: 2, variante: "illada (raíz extra en 0x2002)" },
          medidos: {
            fronteira: front ? { endereco: front.endereco, tipo: front.tipo, opcode: front.opcode } : null,
            cobertura_antes: antes,
            cobertura_depois: depois,
            delta_cobertura: delta,
            downstream: intacta ? { endereco: intacta.endereco, tam: intacta.tam, mnem: intacta.mnem } : null,
            bytes_recompostos: gravado.sha256,
          },
          divergencias: divs,
          motivo: receita.motivo,
        }),
      );
      const conf = analizar({ fix: "dC-cx4", nome: "TC-4-mutada-base", binArquivo: path.join(OUT_C, "dC-cx4-tamper.bin") });
      linhas.push(
        linha({
          ...base(conf),
          fila: "TC-4-control",
          capacidade: "TC",
          eixo: "saída",
          categoria: "aplicavel",
          veredito: "CONTROLADO",
          pontua: false,
          esperados: { nota: "con as raíces orixinais a mutación corta o único camiño que proba 0x2002.." },
          medidos: {
            cobertura_base_illada: antes,
            cobertura_depois: conf.exp?.cobertura?.["bytes-decodificados"] ?? null,
            diferenza_con_raizes_orixinais: (conf.exp?.cobertura?.["bytes-decodificados"] ?? null) === null ? null : ib.ins.size,
          },
          motivo: "control observado: sen raíz extra a receita mide alcançabilidade, non lonxitude (errata §6)",
        }),
      );
      continue;
    }
    linhas.push(
      linha({
        frente: "C",
        sha_frente: sha,
        fila: receita.id,
        capacidade: "TC",
        categoria: "desconhecido",
        veredito: "INCONCLUSIVE",
        motivo: `acção ${acao.tipo} non implementada polo adaptador`,
      }),
    );
  }

  // ---- Coherencia aritmética dos exports (proba auditada, non pontuada)
  for (const [fix, r] of Object.entries(rodadas)) {
    const t = truthC(fix);
    if (typeof t.cobertura_esperada_bytes !== "number") continue;
    const claimed = r.exp?.cobertura?.["bytes-decodificados"] ?? null;
    const diferenza = claimed === null ? null : t.cobertura_esperada_bytes - claimed;
    linhas.push(
      linha({
        ...base(r),
        fila: `CONTROLE-COHERENCIA-${fix.slice(3).toUpperCase()}`,
        capacidade: "audit",
        eixo: "prova anexa",
        categoria: "aplicavel",
        veredito: "CONTROLADO",
        pontua: false,
        esperados: { soma_autoral_de_comprimimentos: t.cobertura_esperada_bytes },
        medidos: { bytes_reclamados: claimed, diferenza },
        motivo:
          "a diferenza ten de explicarse polas instrucións que C recusa na fronteira e non por bytes inventados; " +
          "fronteiras non-de-región nesta rexión: " +
          JSON.stringify([...IDX[fix].fronteiras.values()].filter((f) => f.tipo !== "limite-de-regiao").map((f) => `${addr(f.endereco)}/${f.opcode?.toString(16)}`)),
      }),
    );
  }

  const manifesto = {
    ferramenta: { bin: FERRAMENTAS.C.bin, sha256: shaFerramenta("C"), verbo: "rex-cfg analyze" },
    sha_frente: sha,
    procedencia: verificarProcedencia("C"),
    fixtures: ["dC-cx1", "dC-cx2", "dC-cx3", "dC-cx4"].map((f) => ({
      arquivo: path.relative(RAIZ, path.join(DIR_C, `${f}.bin`)),
      sha256: sha256Arquivo(path.join(DIR_C, `${f}.bin`)),
      truth_sha256: sha256Arquivo(path.join(DIR_C, `${f}-truth.json`)),
    })),
    truth_sha256: "gabaritos autorais D conxelados antes da execución (EXTENSOES-D §5)",
  };
  return { ausente: false, linhas, manifesto, brutos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = adaptarC();
  if (!r.ausente) {
    garantir(OUT_C);
    fs.writeFileSync(path.join(OUT_C, "brutos.json"), JSON.stringify(r.brutos, null, 2) + "\n");
    const desc = gravarEvidencia(`C-${r.manifesto.sha_frente.slice(0, 7)}.jsonl`, r.linhas, r.manifesto);
    console.log(`[C] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…)`);
    for (const l of r.linhas) {
      if (l.pontua) console.log(`  ${l.fila.padEnd(24)} ${String(l.veredito).padEnd(5)} ${l.categoria.padEnd(14)} ${l.divergencias.length ? JSON.stringify(l.divergencias[0]).slice(0, 150) : ""}`);
    }
    const naoPontuadas = r.linhas.filter((l) => !l.pontua).length;
    console.log(`  (controles non pontuados: ${naoPontuadas}; filas do denominador: ${r.linhas.length - naoPontuadas})`);
  } else {
    console.log(`[C] FERRAMENTA AUSENTE en ${FERRAMENTAS.C.bin} — medição non executada`);
    process.exitCode = 3;
  }
}
