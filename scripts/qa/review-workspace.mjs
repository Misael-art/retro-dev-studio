// Revisão local do Tauri. Receitas e referências ficam no projeto, capturas no runtime.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, open, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const sessions = path.resolve(process.env.RDS_WORK_ROOT || path.join(homedir(), "RetroDevStudio-work"), "sessions");
const plan = path.join(repo, "docs/studio_grafico/PLANO_AUTO_ORGANIZACAO_LOGICA_ENGINE_2026-11-08.md");
const manifest = path.join(repo, "data/studio_grafico/mockups-workspace-20261124.sha256");
const references = path.join(sessions, "mockups-workspace-20261124");
const [input, ...extra] = process.argv.slice(2);
if (!input || extra.length) throw new Error("Uso: node scripts/qa/review-workspace.mjs --referencias | caminho/rodada.json");

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest("hex");
}

function required(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Campo obrigatório: ${field}`);
  return value.trim();
}

async function readNativeReport(reportPath, baseDirectory, commit) {
  const receipt = path.resolve(baseDirectory, reportPath);
  const native = JSON.parse(await readFile(receipt, "utf8"));
  const binarySha256 = native.testedApplication?.sha256 || native.executableSha256 || native.app_sha256;
  if (!/^[0-9a-f]{64}$/.test(binarySha256)) throw new Error("O recibo do Tauri precisa identificar o executável por SHA-256.");
  if ([native.repository?.commit, native.source].some(source => source && source !== commit)) throw new Error("A revisão diverge do recibo do Tauri.");
  const recorded = [...(native.artifacts || []).map(entry => entry.path), ...(native.steps || []).map(step => step.screenshot),
    ...Object.values(native.items || {}).map(item => item.file)];
  const artifactPaths = new Set(recorded.filter(name => typeof name === "string").flatMap(name => [
    path.resolve(path.dirname(receipt), name), path.join(path.dirname(receipt), path.win32.basename(name)),
  ]));
  return { artifactPaths, identity: { binarySha256, nativeReport: receipt, nativeReportSha256: await sha256(receipt) } };
}

// A janela pode ter escala e bordas nativas. Registre o raster separadamente da área lógica.
async function pngSize(file) {
  const handle = await open(file, "r");
  const header = Buffer.alloc(24);
  try {
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== 24 || header.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        header.toString("ascii", 12, 16) !== "IHDR") throw new Error(`Captura PNG inválida: ${file}`);
    const size = [header.readUInt32BE(16), header.readUInt32BE(20)];
    if (size.includes(0)) throw new Error(`Captura sem área: ${file}`);
    return size;
  } finally {
    await handle.close();
  }
}

const criteria = new Map(Array.from((await readFile(plan, "utf8")).matchAll(
  /^\| `(\d{2}-[a-z-]+\.png)` \| ([^|]+) \|$/gm), match => [match[1], match[2]]));
const images = Array.from((await readFile(manifest, "utf8")).matchAll(
  /^([0-9a-f]{64}) {2}(\d{2}-[a-z-]+\.png)$/gm), match => ({ name: match[2], sha256: match[1] }));
if (images.length !== 12 || criteria.size !== 12 || images.some((image, index) =>
  !image.name.startsWith(String(index + 1).padStart(2, "0") + "-") || !criteria.has(image.name))) {
  throw new Error("O plano e o manifesto precisam identificar as mesmas 12 telas em ordem.");
}
for (const image of images) {
  image.path = path.join(references, image.name);
  if (await sha256(image.path) !== image.sha256) throw new Error(`Referência divergente: ${image.name}`);
}

const report = { candidate: null, screens: [] };
const captures = new Map();
const previous = new Map();
if (input !== "--referencias") {
  const file = path.resolve(input);
  const run = JSON.parse(await readFile(file, "utf8"));
  const baseline = run.purpose === "baseline";
  const validViewport = Array.isArray(run.viewport) && run.viewport.length === 2 && run.viewport.every(n => Number.isSafeInteger(n) && n > 0);
  const validScale = Number.isFinite(run.scalePercent) && run.scalePercent > 0;
  if (!/^[0-9a-f]{40}$/.test(run.commit) || !(validViewport || (baseline && run.viewport === null)) ||
      !(validScale || (baseline && run.scalePercent === null))) {
    throw new Error("Informe o SHA completo do candidato, viewport [largura, altura] e scalePercent.");
  }
  report.candidate = { purpose: baseline ? "baseline" : "candidate", commit: run.commit,
    system: required(run.system, "system"), viewport: run.viewport, scalePercent: run.scalePercent };
  let artifactPaths;
  if (run.nativeReport) {
    const native = await readNativeReport(run.nativeReport, path.dirname(file), run.commit);
    artifactPaths = native.artifactPaths;
    Object.assign(report.candidate, native.identity);
  }
  if (run.binary || !run.nativeReport) {
    const binary = path.resolve(path.dirname(file), required(run.binary, "binary"));
    const digest = await sha256(binary);
    if (artifactPaths && digest !== report.candidate.binarySha256) throw new Error("O executável diverge do recibo do Tauri.");
    Object.assign(report.candidate, { binary, binarySha256: digest });
  }
  if (run.previousReport) {
    const receipt = path.resolve(path.dirname(file), run.previousReport);
    const previousReport = JSON.parse(await readFile(receipt, "utf8"));
    if (!/^[0-9a-f]{40}$/.test(previousReport.candidate?.commit)) throw new Error("Registro anterior sem revisão.");
    for (const { reference, capture } of previousReport.screens) {
      if (!capture || !images.some(image => image.name === reference.name && image.sha256 === reference.sha256)
          || previous.has(reference.name) || await sha256(capture.path) !== capture.sha256) {
        throw new Error("Registro anterior incompleto ou divergente: " + reference.name);
      }
      previous.set(reference.name, capture);
    }
    if (previous.size !== images.length) throw new Error("Faltam telas no registro anterior.");
    report.previous = { receipt, commit: previousReport.candidate.commit, sha256: await sha256(receipt) };
  }
  if (!Array.isArray(run.screens) || !run.screens.length) throw new Error("A rodada precisa de uma captura.");
  for (const row of run.screens) {
    if (!criteria.has(row.name) || captures.has(row.name)) throw new Error(`Tela desconhecida ou repetida: ${row.name}`);
    const capture = path.resolve(path.dirname(file), required(row.capture, "capture"));
    let provenance;
    let recordedPaths = artifactPaths;
    if (row.nativeReport) {
      const commit = row.commit ?? run.commit;
      if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Revisão inválida na captura: " + row.name);
      const system = required(row.system ?? run.system, "system");
      const native = await readNativeReport(row.nativeReport, path.dirname(file), commit);
      recordedPaths = native.artifactPaths;
      provenance = { commit, system, ...native.identity };
    }
    if (recordedPaths && !recordedPaths.has(capture)) throw new Error(`Captura ausente no recibo do Tauri: ${capture}`);
    const size = await pngSize(capture);
    const digest = await sha256(capture);
    if (images.some(image => image.sha256 === digest)) throw new Error(`A captura é um dos mockups: ${row.name}`);
    if (previous.has(row.name) && (size[0] !== 1920 || size[1] !== 1080 || run.scalePercent !== 100 || run.viewport?.join("x") !== "1920x1080")) {
      throw new Error("A comparação exige captura nova em Full HD e escala 1×: " + row.name);
    }
    const groups = (row.groups ?? []).map(group => {
      const boxes = {};
      for (const key of ["mockup", "previous", "current"]) {
        const box = group[key];
        if (box == null) continue;
        if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)
            || box.some(n => n < 0 || n > 100) || box[2] === 0 || box[3] === 0
            || box[0] + box[2] > 100.01 || box[1] + box[3] > 100.01) throw new Error("Grupo fora da imagem: " + row.name);
        boxes[key] = box;
      }
      return { name: required(group.name, "group.name"), ...boxes };
    });
    const related = [];
    for (const item of row.related ?? []) {
      const filePath = path.resolve(path.dirname(file), required(item.path, "related.path"));
      related.push({ path: filePath, label: required(item.label, "related.label"), size: await pngSize(filePath), sha256: await sha256(filePath) });
    }
    captures.set(row.name, { path: capture, sha256: digest, size, gesture: required(row.gesture, "gesture"),
      observation: required(row.observation, "observation"), project: row.project, selection: row.selection, problem: row.problem, change: row.change,
      command: row.command, provenance, groups, related });

  }
}
for (const reference of images) report.screens.push({ reference, criterion: criteria.get(reference.name),
  previous: previous.get(reference.name), capture: captures.get(reference.name) || null });

await mkdir(sessions, { recursive: true });
const out = await mkdtemp(path.join(sessions, "conferencia-workspace-"));
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function localUrl(file) {
  const relative = path.relative(out, file);
  return path.isAbsolute(relative) ? pathToFileURL(file).href : relative.split(path.sep).map(encodeURIComponent).join("/");
}
function picture(file, label, groups = [], view) {
  const url = localUrl(file);
  const marks = groups.map((group, i) => {
    if (!group[view]) return "";
    const [x, y, w, h] = group[view];
    return `<span class="mark" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><b>${i + 1}</b></span>`;
  }).join("");
  return `<figure><figcaption>${escape(label)}</figcaption><a href="${escape(url)}"><img loading="lazy" src="${escape(url)}" alt="${escape(label)}">${marks}</a></figure>`;
}
const cards = report.screens.map(({ reference, criterion, capture, previous: old }) => {
  const groups = capture?.groups;
  return `<section id="${escape(reference.name.slice(0, -4))}"><h2>${escape(reference.name)}</h2>
<p>${escape(criterion)}</p><div class="pair">${picture(reference.path, "Mockup", groups, "mockup")}
${old ? picture(old.path, "Tauri anterior · " + report.previous.commit.slice(0, 7), groups, "previous") : ""}
${capture ? picture(capture.path, `Tauri · ${capture.size.join(" × ")} px`, groups, "current") : "<p class='pending'>Captura do Tauri pendente</p>"}</div>
${capture?.related?.length ? "<p>" + capture.related.map(item => `<a href="${escape(localUrl(item.path))}">${escape(item.label)}</a>`).join(" · ") + "</p>" : ""}
${groups?.length ? "<ol>" + groups.map(group => "<li>" + escape(group.name) + "</li>").join("") + "</ol>" : ""}
${capture ? `<p>${[capture.project, capture.selection].filter(Boolean).map(escape).join(" · ")}</p><p><b>Gesto</b> ${escape(capture.gesture)}</p><p><b>Observação</b> ${escape(capture.observation)}</p>` : ""}
${capture?.command ? `<p><b>Comando</b> <code>${escape(capture.command)}</code></p>` : ""}
${capture?.provenance ? `<p>${escape(capture.provenance.system)} · <code>${escape(capture.provenance.commit)}</code> · <a href="${escape(localUrl(capture.provenance.nativeReport))}">Recibo do executável e da captura</a></p>` : ""}</section>`;
});
const candidate = report.candidate;
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conferência do workspace · RetroDev Studio</title><style>
:root{color-scheme:dark;font:16px/1.5 system-ui;background:#101720;color:#e2edf5}body{max-width:1500px;margin:auto;padding:24px}
h1,h2{line-height:1.2}section{padding:12px 0 24px;border-top:1px solid #435363}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:12px}
figure a{position:relative;display:block}figure img{display:block}.mark{pointer-events:none;position:absolute;box-sizing:border-box;border:2px solid #39e4ce;box-shadow:0 0 0 1px #102638}.mark b{position:absolute;top:0;left:0;background:#102638;color:white;font:700 12px system-ui;padding:1px 5px;border-radius:2px}body:has(#marks:not(:checked)) .mark{display:none}figure{margin:0;min-width:0}figcaption,b{color:#91ddcf}img{width:100%;height:auto}a{color:#91ddcf}.pending{align-self:center;text-align:center}
table{width:100%;border-collapse:collapse}caption{font-weight:700;text-align:left;padding:.6em 0}th,td{text-align:left;vertical-align:top;padding:.5em;border-bottom:1px solid #435363}code{overflow-wrap:anywhere}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<h1>Conferência do workspace</h1><p>${captures.size} de 12 telas com captura.</p>
${report.previous ? `<table><caption>Matriz das lacunas</caption><thead><tr><th>Tela</th><th>Problema observado</th><th>Alteração</th><th>Tarefa executada</th><th>Resultado</th></tr></thead><tbody>${report.screens.filter(s=>s.capture).map(({reference,capture}) =>
  `<tr><th><a href="#${escape(reference.name.slice(0,-4))}">${escape(reference.name.slice(0,-4))}</a></th><td>${escape(capture.problem ?? "")}</td><td>${escape(capture.change ?? "")}</td><td>${escape(capture.gesture)}</td><td>${escape(capture.observation)}</td></tr>`).join("")}</tbody></table>` : ""}
${candidate ? `<p>${candidate.purpose === "baseline" ? "Linha de base" : "Candidato"} · ${escape(candidate.system)} · ${candidate.viewport?.join(" × ") || "área lógica sem registro"} · ${candidate.scalePercent ? candidate.scalePercent + "%" : "escala sem registro"} · <code>${candidate.commit}</code></p>` : ""}
${previous.size ? '<label><input type="checkbox" checked id="marks"> Mostrar grupos numerados</label>' : ""}
<p><a href="registro.json">Registro de referências, medições e hashes</a></p>${cards.join("\n")}</html>`;
await writeFile(path.join(out, "registro.json"), JSON.stringify(report, null, 2) + "\n");
await writeFile(path.join(out, "index.html"), html);
console.log(path.join(out, "index.html"));
