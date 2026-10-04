/**
 * Runner da barra D: consome um export no contrato `rds-d-export/1`, compara
 * contra o ground truth autoral e imprime uma linha por dimensao. Nunca produz
 * percentual unico. Nunca trata dado ausente como PASS.
 */
import { sha256 } from "./lib_bench.mjs";

export const EXPORT_FORMAT = "rds-d-export/1";

export const DIMS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "N1", "N2"];

export const DIM_LABEL = {
  D1: "identidade de codec por regiao",
  D2: "vinculo consumidor -> alvo",
  D3: "saida descomprimida (SHA + comprimento)",
  D4: "geometria declarada (w, h, bpp, layout)",
  D5: "composicao do plano linear (SHA)",
  D6: "alvos de fluxo referenciados",
  D7: "cadeias completas (todas as etapas do item)",
  N1: "decoys sem consumidor absorvidos",
  N2: "falsos alvos de fluxo absorvidos",
};

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const streamRegions = (t) => t.regions.filter((r) => r.class === "stream");
const referencedStreams = (t) => t.regions.filter((r) => r.class === "stream" && r.referenced_by.length > 0);
const geomRegions = (t) => t.regions.filter((r) => r.class === "geom");
const tableRegions = (t) => t.regions.filter((r) => r.class === "table");
const primaryRegions = (t) => [...referencedStreams(t), ...geomRegions(t), ...tableRegions(t)];

/** Export de referencia: a verdade autoral re-expressa no formato de export. */
export function deriveIdealExport(truth, producer = {}) {
  const evidence = [];
  const regions = truth.regions.map((r) => {
    const consumers = truth.consumers
      .filter((c) => c.target_byte_addr === r.byte_addr)
      .map((c) => ({ id: c.id, addr_mode: c.addr_mode, declared_target: c.target_byte_addr }));
    const item = {
      byte_addr: r.byte_addr,
      class: r.class,
      codec: r.codec,
      consumers,
      output: r.output ? { byte_len: r.output.byte_len, sha256: r.output.sha256 } : null,
      geometry: r.geometry ? { ...r.geometry } : null,
      flow: r.flow_targets.length
        ? {
            edges: r.flow_targets.map((t) => ({
              from_byte_addr: t.from_byte_addr,
              to_byte_addr: t.to_byte_addr,
            })),
          }
        : null,
      confidence: consumers.length || r.class === "table" ? "proved" : "candidate",
      proof: null,
      status: "ok",
    };
    if (item.confidence === "proved") {
      const artifact = r.output ? r.output.sha256 : truth.fixture_sha256;
      item.proof = {
        kind: r.codec === "kosinski" ? "external_instrument" : "round_trip",
        artifact_sha256: artifact,
      };
      if (!evidence.some((e) => e.sha256 === artifact)) evidence.push({ sha256: artifact, kind: item.proof.kind });
    }
    return item;
  });
  return {
    export_format: EXPORT_FORMAT,
    producer: {
      front: producer.front ?? "d",
      tool: producer.tool ?? "bench-author(referencia)",
      version: producer.version ?? "1",
      artifact_sha256: producer.artifact_sha256 ?? sha256(Buffer.from("referencia", "utf8")),
    },
    fixture: { set: truth.set, sha256: truth.fixture_sha256 },
    evidence,
    regions,
    notes: "export de referencia derivado da autoria; nao e evidencia de ferramenta avaliada",
  };
}

function denominators(truth) {
  return {
    D1: streamRegions(truth).length,
    D2: referencedStreams(truth).length,
    D3: referencedStreams(truth).length,
    D4: geomRegions(truth).length,
    D5: geomRegions(truth).length,
    D6: tableRegions(truth).reduce((a, r) => a + r.flow_targets.length, 0),
    D7: primaryRegions(truth).length,
    N1: truth.negatives.unreferenced_streams.length,
    N2: truth.negatives.false_flow_targets.length,
  };
}

function blank(den, reason = "ausente") {
  return {
    denominator: den,
    correct: 0,
    not_found: den,
    divergences: 0,
    false_links: 0,
    unknowns: 0,
    measured: 0,
    coverage: 0,
    verdict: "INCONCLUSIVE",
    reason,
    details: [],
  };
}

/** Início de dimensão medida: ausencias sao contadas item a item, nunca pre-cargadas. */
function fresh(den) {
  return { ...blank(den, ""), not_found: 0 };
}

function finish(d) {
  d.coverage = d.denominator - d.not_found;
  if (d.denominator === 0) {
    d.verdict = "INCONCLUSIVE";
    d.reason = "denominador zero: nada para medir";
    return d;
  }
  if (d.coverage === 0) {
    d.verdict = "FAIL";
    d.reason = "cobertura zero: nenhuma verificacao anexada";
    return d;
  }
  if (d.not_found > 0 || d.divergences > 0 || d.unknowns > 0) {
    d.verdict = "FAIL";
    d.reason = "item ausente, divergente ou sem prova";
    return d;
  }
  d.verdict = "PASS";
  d.reason = "todas as verificacoes concordaram com a verdade autoral";
  return d;
}

/**
 * `proved` sem prova anexada, ou com prova fora do indice de evidencia do
 * export, e rebaixado (regra R5). Nunca conta no numerador.
 */
function effectiveConfidence(item, exp, truthRegion) {
  if (item.status === "unknown") return "unknown";
  if (item.confidence !== "proved") return typeof item.confidence === "string" ? item.confidence : "unknown";
  const proof = item.proof;
  if (!isObj(proof) || typeof proof.artifact_sha256 !== "string") return "unknown_sem_prova";
  const indexed = (exp.evidence ?? []).some((e) => isObj(e) && e.sha256 === proof.artifact_sha256);
  if (!indexed) return "unknown_sem_prova";
  const matchesSelf =
    proof.artifact_sha256 === exp.fixture?.sha256 ||
    (truthRegion?.output ? proof.artifact_sha256 === truthRegion.output.sha256 : true);
  return matchesSelf ? "proved" : "unknown_sem_prova";
}

function inconclusiveAll(truth, reason, extra) {
  const dims = {};
  for (const d of DIMS) dims[d] = blank(0, reason);
  return { status: "INCONCLUSIVE", reason, set: truth?.set ?? null, dimensions: dims, ...extra };
}

export function scoreExport(truth, exp, opts = {}) {
  const header = {
    generated_at: opts.generated_at ?? new Date().toISOString(),
    set: truth.set,
    truth_fixture_sha256: truth.fixture_sha256,
    export_fixture_sha256: isObj(exp?.fixture) ? exp.fixture.sha256 : null,
    producer: isObj(exp?.producer) ? exp.producer : null,
    pinned: opts.pinned ?? null,
  };
  if (!isObj(exp) || exp.export_format !== EXPORT_FORMAT) {
    return inconclusiveAll(truth, `export sem formato ${EXPORT_FORMAT}`, header);
  }
  if (exp.fixture.sha256 !== truth.fixture_sha256) {
    return inconclusiveAll(truth, "SHA-256 do fixture no export nao corresponde ao ground truth", header);
  }
  if (!Array.isArray(exp.regions)) {
    return inconclusiveAll(truth, "export sem lista `regions`", header);
  }
  if (exp.regions.length === 0) {
    // expectativa congelada §7: export vazio e FAIL com cobertura zero em
    // CADA dimensao — ausencia de reivindicacao nao e verificacao anexada
    const dims = {};
    for (const d of DIMS) {
      const den = denominators(truth)[d];
      dims[d] = { ...blank(den), verdict: "FAIL", reason: "export sem regioes: cobertura zero" };
    }
    return {
      status: "FAIL",
      reason: "export nao apresenta nenhuma regiao: nenhuma verificacao anexada",
      dimensions: dims,
      ...header,
    };
  }

  const byAddr = new Map();
  for (const r of exp.regions) if (r && Number.isInteger(r.byte_addr)) byAddr.set(r.byte_addr, r);
  const edges = exp.regions.flatMap((r) => (isObj(r?.flow) && Array.isArray(r.flow.edges) ? r.flow.edges : []));
  const edgeKey = (e) => `${e.from_byte_addr}->${e.to_byte_addr}`;
  const edgeSet = new Set(edges.filter((e) => isObj(e)).map(edgeKey));
  const hasAny = (field, test) => exp.regions.some((r) => r && test(r[field]));
  const exported = {
    consumers: hasAny("consumers", Array.isArray),
    output: hasAny("output", isObj),
    geometry: hasAny("geometry", isObj),
    flow: hasAny("flow", (v) => isObj(v) && Array.isArray(v.edges)),
  };

  const dims = {};

  // D1 — identidade de codec em toda regiao stream-shaped (referenciada ou nao)
  dims.D1 = fresh(streamRegions(truth).length);
  for (const r of streamRegions(truth)) {
    const item = byAddr.get(r.byte_addr);
    if (!item) {
      dims.D1.not_found += 1;
      continue;
    }
    dims.D1.measured += 1;
    if (item.class !== r.class || item.codec !== r.codec) {
      dims.D1.divergences += 1;
      dims.D1.details.push({ region: r.id, esperado: `${r.class}/${r.codec}`, obtido: `${item.class}/${item.codec}` });
    } else {
      dims.D1.correct += 1;
    }
  }

  // D2 — vinculo consumidor -> regiao
  dims.D2 = fresh(referencedStreams(truth).length);
  if (!exported.consumers) {
    dims.D2.reason = "dimensao nao exportada: nenhum item traz `consumers`";
    dims.D2.locked = true;
    dims.D2.not_found = dims.D2.denominator;
  } else {
    for (const r of referencedStreams(truth)) {
      const item = byAddr.get(r.byte_addr);
      if (!item) {
        dims.D2.not_found += 1;
        continue;
      }
      dims.D2.measured += 1;
      const claimed = Array.isArray(item.consumers) ? item.consumers.filter(isObj) : [];
      const got = claimed.filter((c) => r.referenced_by.includes(c.id)).map((c) => c.id);
      dims.D2.false_links += claimed.filter((c) => !r.referenced_by.includes(c.id)).length;
      const badTarget = claimed.some((c) => c.declared_target !== undefined && c.declared_target !== r.byte_addr);
      if (got.length !== r.referenced_by.length) {
        dims.D2.not_found += 1;
        dims.D2.details.push({ region: r.id, vinculos_ausentes: r.referenced_by.filter((i) => !got.includes(i)) });
      } else if (badTarget) {
        dims.D2.divergences += 1;
        dims.D2.details.push({ region: r.id, problema: "declared_target nao resolve para a regiao" });
      } else {
        dims.D2.correct += 1;
      }
    }
  }

  // D3 — saida descomprimida das streams referenciadas
  dims.D3 = fresh(referencedStreams(truth).length);
  if (!exported.output) {
    dims.D3.reason = "dimensao nao exportada: nenhum item traz `output`";
    dims.D3.locked = true;
    dims.D3.not_found = dims.D3.denominator;
  } else {
    for (const r of referencedStreams(truth)) {
      const item = byAddr.get(r.byte_addr);
      if (!item || !isObj(item.output)) {
        dims.D3.not_found += 1;
        continue;
      }
      dims.D3.measured += 1;
      if (item.output.sha256 !== r.output.sha256 || item.output.byte_len !== r.output.byte_len) {
        dims.D3.divergences += 1;
        dims.D3.details.push({
          region: r.id,
          sha_esperado: r.output.sha256,
          sha_obtido: item.output.sha256,
          len_esperado: r.output.byte_len,
          len_obtido: item.output.byte_len,
        });
      } else {
        dims.D3.correct += 1;
      }
    }
  }

  // D4/D5 — geometria e composicao dos blocos de tile
  dims.D4 = fresh(geomRegions(truth).length);
  dims.D5 = fresh(geomRegions(truth).length);
  if (!exported.geometry) {
    dims.D4.reason = "dimensao nao exportada: nenhum item traz `geometry`";
    dims.D4.locked = true;
    dims.D4.not_found = dims.D4.denominator;
  }
  if (!exported.output) {
    dims.D5.reason = "dimensao nao exportada: nenhum item traz `output`";
    dims.D5.locked = true;
    dims.D5.not_found = dims.D5.denominator;
  }
  if (!dims.D4.locked || !dims.D5.locked) {
    for (const r of geomRegions(truth)) {
      const item = byAddr.get(r.byte_addr);
      if (!item) continue;
      if (!dims.D4.locked) {
        dims.D4.measured += 1;
        const g = isObj(item.geometry) ? item.geometry : null;
        if (!g) {
          dims.D4.not_found += 1;
        } else if (
          g.width !== r.geometry.width ||
          g.height !== r.geometry.height ||
          g.bpp !== r.geometry.bpp ||
          g.layout !== r.geometry.layout
        ) {
          dims.D4.divergences += 1;
          dims.D4.details.push({
            region: r.id,
            esperada: r.geometry,
            obtida: { width: g.width, height: g.height, bpp: g.bpp, layout: g.layout },
          });
        } else {
          dims.D4.correct += 1;
        }
      }
      if (!dims.D5.locked) {
        dims.D5.measured += 1;
        if (!isObj(item.output)) {
          dims.D5.not_found += 1;
        } else if (item.output.sha256 !== r.output.sha256) {
          dims.D5.divergences += 1;
          dims.D5.details.push({ region: r.id, sha_esperado: r.output.sha256, sha_obtido: item.output.sha256 });
        } else {
          dims.D5.correct += 1;
        }
      }
    }
  }

  // D6 — alvos de fluxo das tabelas
  const trueTargets = tableRegions(truth).flatMap((r) => r.flow_targets);
  dims.D6 = fresh(trueTargets.length);
  if (!exported.flow) {
    dims.D6.reason = "dimensao nao exportada: nenhum item traz `flow.edges`";
    dims.D6.locked = true;
    dims.D6.not_found = dims.D6.denominator;
  } else {
    for (const t of trueTargets) {
      dims.D6.measured += 1;
      if (edgeSet.has(edgeKey(t))) dims.D6.correct += 1;
      else dims.D6.not_found += 1;
    }
    dims.D6.divergences = edges.filter(
      (e) => isObj(e) && !trueTargets.some((t) => t.from_byte_addr === e.from_byte_addr),
    ).length;
  }

  // N1/N2 — negativos: medidos quando o export os menciona; absorver = falla
  const decoys = truth.negatives.unreferenced_streams;
  dims.N1 = fresh(decoys.length);
  for (const d of decoys) {
    const item = byAddr.get(d.byte_addr);
    if (!item) continue;
    dims.N1.measured += 1;
    const claimed = Array.isArray(item.consumers) ? item.consumers.filter(isObj) : [];
    if (claimed.length > 0) {
      dims.N1.false_links += 1;
      dims.N1.details.push({ region: d.id, consumidores_atribuidos: claimed.map((c) => c.id ?? null) });
    }
  }
  dims.N1.negative = true;
  dims.N1.correct = dims.N1.measured - dims.N1.false_links;
  dims.N1.coverage = dims.N1.measured;
  dims.N1.verdict =
    dims.N1.measured === 0 ? "INCONCLUSIVE" : dims.N1.false_links === 0 ? "PASS" : "FAIL";
  dims.N1.reason =
    dims.N1.measured === 0
      ? "nenhuma regiao decoy presente no export: ausencia, nao acerto"
      : dims.N1.false_links === 0
        ? "nenhum decoy foi consumido"
        : `${dims.N1.false_links} decoy(s) apresentado(s) como consumido(s)`;

  const falses = truth.negatives.false_flow_targets;
  dims.N2 = fresh(falses.length);
  for (const f of falses) {
    dims.N2.measured += 1;
    if (edgeSet.has(edgeKey(f))) {
      dims.N2.false_links += 1;
      dims.N2.details.push(f);
    }
  }
  if (!exported.flow) dims.N2.not_found = dims.N2.denominator;
  dims.N2.negative = true;
  dims.N2.correct = dims.N2.measured - dims.N2.false_links;
  dims.N2.coverage = exported.flow ? dims.N2.measured : 0;
  dims.N2.verdict = !exported.flow
    ? "INCONCLUSIVE"
    : dims.N2.false_links === 0
      ? "PASS"
      : "FAIL";
  dims.N2.reason = !exported.flow
    ? "fluxo nao exportado: nada medido"
    : dims.N2.false_links === 0
      ? "nenhum alvo falso foi reportado como real"
      : `${dims.N2.false_links} alvo(s) falso(s) reportado(s) como real(s)`;

  // D7 — cadeias completas
  dims.D7 = fresh(primaryRegions(truth).length);
  for (const r of primaryRegions(truth)) {
    const item = byAddr.get(r.byte_addr);
    if (!item) {
      dims.D7.not_found += 1;
      continue;
    }
    dims.D7.measured += 1;
    const conf = effectiveConfidence(item, exp, r);
    if (conf !== "proved") {
      dims.D7.unknowns += 1;
      dims.D7.details.push({ region: r.id, confianca_efetiva: conf, motivo: item.unknown_reason ?? null });
      continue;
    }
    const fails = [];
    if (r.class === "stream") {
      if (item.codec !== r.codec) fails.push("identidade");
      const ids = (item.consumers ?? []).map((c) => c?.id);
      if (!r.referenced_by.every((id) => ids.includes(id))) fails.push("vinculo");
      if (!isObj(item.output) || item.output.sha256 !== r.output.sha256) fails.push("saida");
    } else if (r.class === "geom") {
      const g = item.geometry;
      if (!isObj(g) || g.width !== r.geometry.width || g.height !== r.geometry.height) fails.push("geometria");
      if (!isObj(item.output) || item.output.sha256 !== r.output.sha256) fails.push("composicao");
    } else if (r.class === "table") {
      if (r.flow_targets.some((t) => !edgeSet.has(edgeKey(t)))) fails.push("fluxo");
    }
    if (fails.length) {
      dims.D7.divergences += 1;
      dims.D7.details.push({ region: r.id, etapas_falhas: fails });
    } else {
      dims.D7.correct += 1;
    }
  }

  for (const k of ["D1", "D2", "D3", "D4", "D5", "D6", "D7"]) if (!dims[k].locked) finish(dims[k]);

  const positives = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];
  const anyFail = positives.some((d) => dims[d].verdict === "FAIL");
  const anyInconclusive = positives.some((d) => dims[d].verdict === "INCONCLUSIVE");
  const negativesBad = ["N1", "N2"].some((d) => dims[d].verdict === "FAIL");
  return {
    status: anyFail || negativesBad ? "FAIL" : anyInconclusive ? "INCONCLUSIVE" : "PASS",
    reason: anyFail
      ? "ao menos uma dimensao divergiu da verdade autoral"
      : negativesBad
        ? "item negativo absorvido como real"
        : anyInconclusive
          ? "export incompleto em ao menos uma dimensao"
          : "todas as dimensoes concordaram",
    dimensions: dims,
    ...header,
  };
}

export function renderMarkdown(result) {
  const lines = [
    `# Barra D — conjunto ${result.set}`,
    "",
    `- veredito: **${result.status}** (${result.reason})`,
    `- fixture do ground truth: \`${result.truth_fixture_sha256}\``,
    `- fixture declarado no export: \`${result.export_fixture_sha256 ?? "ausente"}\``,
    `- produtor: ${
      result.producer
        ? `${result.producer.front}/${result.producer.tool}#${result.producer.version}`
        : "desconhecido"
    }`,
    "",
    "| dimensao | acerto/denominador | ausentes | divergencias | falsos vinculos | unknowns | medidos | veredito |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const d of DIMS) {
    const x = result.dimensions[d];
    lines.push(
      `| ${d} ${DIM_LABEL[d]} | ${x.correct}/${x.denominator}${x.negative ? " (negativo)" : ""} | ${x.not_found} | ${x.divergences} | ${x.false_links} | ${x.unknowns} | ${x.measured} | ${x.verdict} |`,
    );
  }
  lines.push(
    "",
    "Sem percentual unico: cada dimensao tem denominador proprio e as razoes nao sao medias entre si.",
  );
  const detailDims = DIMS.filter((d) => result.dimensions[d].details?.length);
  if (detailDims.length) {
    lines.push("", "## Divergencias");
    for (const d of detailDims) {
      for (const det of result.dimensions[d].details) lines.push(`- ${d}: ${JSON.stringify(det)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
