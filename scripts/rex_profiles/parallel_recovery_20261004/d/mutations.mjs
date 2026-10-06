/**
 * Controles de mutacao da barra D. Cada mutacao modela um erro compartilhado
 * plausivel e DEVE ser pega pelo runner. Um runner que passa em alguma delas
 * esta quebrado — isso e achado, nao detalhe.
 */
import { deriveIdealExport } from "./runner.mjs";

const clone = (o) => JSON.parse(JSON.stringify(o));

function findRegions(exp, truth, predicate) {
  return truth.regions
    .filter(predicate)
    .map((r) => ({ truth: r, item: exp.regions.find((x) => x.byte_addr === r.byte_addr) }))
    .filter((p) => p.item);
}

export const MUTATIONS = [
  {
    id: "M1",
    name: "mapper_wrong",
    descricao: "alvo em modo word interpretado como byte",
    esperado: ["D1", "D2", "D3", "D7"],
    apply(exp, truth) {
      const wordConsumers = truth.consumers.filter((c) => c.addr_mode === "word");
      for (const c of wordConsumers) {
        const item = exp.regions.find((x) => x.byte_addr === c.target_byte_addr);
        if (!item) continue;
        item.byte_addr = c.target_byte_addr >> 1;
        for (const cl of item.consumers) cl.declared_target = item.byte_addr;
      }
      return exp;
    },
  },
  {
    id: "M2",
    name: "branch_target_wrong",
    descricao: "um alvo verdadeiro substituido por um alvo falso plantado",
    esperado: ["D6", "N2"],
    apply(exp, truth) {
      const table = truth.regions.find((r) => r.class === "table");
      const item = exp.regions.find((x) => x.byte_addr === table.byte_addr);
      const fake = truth.negatives.false_flow_targets[0];
      item.flow.edges[0] = { from_byte_addr: fake.from_byte_addr, to_byte_addr: fake.to_byte_addr };
      return exp;
    },
  },
  {
    id: "M3",
    name: "consumer_removed",
    descricao: "um vinculo consumidor -> stream apagado",
    esperado: ["D2", "D7"],
    apply(exp, truth) {
      const target = truth.regions.find((r) => r.class === "stream" && r.referenced_by.length > 0);
      const item = exp.regions.find((x) => x.byte_addr === target.byte_addr);
      item.consumers = item.consumers.filter((c) => c.id !== target.referenced_by[0]);
      return exp;
    },
  },
  {
    id: "M4",
    name: "geometry_swapped",
    descricao: "(w,h) trocadas entre blocos de mesmo comprimento, bytes intactos",
    esperado: ["D4", "D5", "D7"],
    apply(exp, truth) {
      const geoms = findRegions(exp, truth, (r) => r.class === "geom");
      if (geoms.length < 2) throw new Error("M4 exige dois blocos de tile");
      const [a, b] = geoms;
      const g1 = { ...a.item.geometry };
      const o1 = { ...a.item.output };
      a.item.geometry = { ...b.item.geometry };
      a.item.output = { ...b.item.output };
      b.item.geometry = g1;
      b.item.output = o1;
      for (const e of exp.evidence) {
        if (e.sha256 === o1.sha256) e.sha256 = a.item.output.sha256;
      }
      return exp;
    },
  },
  {
    id: "M5",
    name: "unreferenced_stream_claimed",
    descricao: "decoy sem consumidor apresentado como consumido",
    esperado: ["N1"],
    apply(exp, truth) {
      const decoy = truth.negatives.unreferenced_streams[0];
      const item = exp.regions.find((x) => x.byte_addr === decoy.byte_addr);
      item.consumers = [{ id: "C-INVENTADO-9", addr_mode: "byte", declared_target: decoy.byte_addr }];
      item.confidence = "proved";
      item.proof = { kind: "round_trip", artifact_sha256: truth.fixture_sha256 };
      if (!exp.evidence.some((e) => e.sha256 === truth.fixture_sha256)) {
        exp.evidence.push({ sha256: truth.fixture_sha256, kind: "round_trip" });
      }
      return exp;
    },
  },
  {
    id: "M6",
    name: "confidence_promoted_without_proof",
    descricao: "confianca promovida sem prova anexada",
    esperado: ["D7"],
    apply(exp) {
      const item = exp.regions.find((x) => x.confidence === "proved");
      item.proof = null;
      return exp;
    },
  },
];

export function mutationCase(mutation, truth, producer) {
  const exp = mutation.apply(deriveIdealExport(truth, producer), truth);
  return { id: mutation.id, name: mutation.name, export: exp };
}

export function degenerateCases(truth, producer) {
  const base = deriveIdealExport(truth, producer);
  const empty = { ...clone(base), regions: [] };
  const noGeometry = clone(base);
  for (const r of noGeometry.regions) delete r.geometry;
  const noOutput = clone(base);
  for (const r of noOutput.regions) delete r.output;
  const wrongFixture = clone(base);
  wrongFixture.fixture = { set: base.fixture.set, sha256: "f".repeat(64) };
  const absentFields = clone(base);
  for (const r of absentFields.regions) {
    delete r.consumers;
    delete r.output;
    delete r.geometry;
    delete r.flow;
  }
  return [
    { id: "X1", name: "export_vazio", export: empty },
    { id: "X2", name: "sem_geometria", export: noGeometry },
    { id: "X3", name: "sem_saida", export: noOutput },
    { id: "X4", name: "fixture_hash_errado", export: wrongFixture },
    { id: "X5", name: "regioes_sem_campos", export: absentFields },
  ];
}
