/**
 * Infraestrutura comum dos adaptadores das frentes A/B/C (barra D).
 *
 * Estes helpers só fazem três coisas: localizar a ferramenta real, executá-la e
 * registar o que ela devolveu. Nenhum valor esperado é lido daqui — as
 * expectativas vêm dos gabaritos autorais gerados por `author_frentes.mjs`
 * antes de qualquer execução (R9).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "../../../../.."); // raiz da worktree D
export const DATA = path.join(RAIZ, "data/rex_profiles/parallel_recovery_20261004/d");
export const FIXTURES = path.join(DATA, "frentes");
export const MEDIDAS = path.join(DATA, "medidas");
export const SCRATCH = path.join(process.env.HOME, "rds-scratch/rex-eval-d2");
export const CANON = path.join(
  process.env.HOME,
  "Projects/RetroDevStudio-CANONICAL-2026-09-21",
);

/** SHA pinados das entregas (inventário datado; nenhum deles é reescrito). */
export const PIN = Object.freeze({
  A: "cbb6895567fe1f1e391c5b3b8dabf21580b78f6b",
  /** SHA publicado por A *despois* da medición do inventario: é a corrección do
   *  subconxunto 68000 (`1344f4c`) e do elo vinculación-chamada-rutina (`4aa6ba9`).
   *  Mídese coas mesmas expectativas conxeladas de §3 — non se reescriben. */
  A_corrixido: "bd40e92269eb60b0df9b8ed0ddff561a0d19a4b3",
  B_velho: "cffe17fabcae6d5ce1dd23258f6883efef0b94c6",
  B_novo: "396e0b81e3813e9f7ffcd5ce04c6e7fd447be353",
  C: "275f2af0b81944709169ab360a67786e56ec4a13",
  base: "cb56657a142df40d2acd09a3e03e54247f066dea",
});

const ARVORE = "/home/misael/rds-scratch/d-frentes-20261004";

/** BYOR em modo leitura: ROM e descodificador pinados por SHA, nunca versionados
 *  por D. `desconhecido` com motivo se estiverem ausentes (EXTENSOES-D §4). */
export const BYOR = Object.freeze({
  rom: "/home/misael/RDS-REX-CORPUS-E/.staging/Sonic the Hedgehog (USA, Europe).bin",
  rom_sha256: "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb",
  rom_size: 531577,
  decoder: "/home/misael/RDS-REX-CORPUS-B/scripts/rex_corpus_b/enigma_research.py",
  decoder_sha256: "a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2",
});

/** Ferramentas reais (cópia da árvore da frente, verificada contra o pin por
 *  `procedencia.mjs`). `presente()` é a única porta de entrada da medição. */
export const FERRAMENTAS = Object.freeze({
  A: {
    frente: "A",
    sha: PIN.A,
    arvore: path.join(ARVORE, "a"),
    bin: path.join(
      ARVORE,
      "a/scripts/rex_profiles/parallel_recovery_20261004/a/target/release/rex-chain",
    ),
    rel: "scripts/rex_profiles/parallel_recovery_20261004/a",
  },
  /** Mesma fronte no SHA publicado despois da medición (corrección do subconxunto
   *  68000 + elo da vinculación). Árbore propia: a de `cbb6895` non se toca. */
  A_corrixido: {
    frente: "A",
    sha: PIN.A_corrixido,
    arvore: path.join(ARVORE, "a-bd40e92"),
    bin: path.join(
      ARVORE,
      "a-bd40e92/scripts/rex_profiles/parallel_recovery_20261004/a/target/release/rex-chain",
    ),
    rel: "scripts/rex_profiles/parallel_recovery_20261004/a",
  },
  B: {
    frente: "B",
    sha: PIN.B_novo,
    arvore: path.join(ARVORE, "b"),
    cli: path.join(
      ARVORE,
      "b/scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py",
    ),
    contrato: path.join(
      ARVORE,
      "b/scripts/rex_profiles/parallel_recovery_20261004/b/contrato_sonic.py",
    ),
    rel: "scripts/rex_profiles/parallel_recovery_20261004/b",
  },
  /** Mesma frente no SHA anterior do inventario datado (cffe17f): o contrato esta
   *  identico por hash; so `verificar-cadeia.py` difere (non trae `controles`). */
  B_velho: {
    frente: "B",
    sha: PIN.B_velho,
    arvore: path.join(ARVORE, "b-cffe17f"),
    cli: path.join(
      ARVORE,
      "b-cffe17f/scripts/rex_profiles/parallel_recovery_20261004/b/verificar-cadeia.py",
    ),
    contrato: path.join(
      ARVORE,
      "b-cffe17f/scripts/rex_profiles/parallel_recovery_20261004/b/contrato_sonic.py",
    ),
    rel: "scripts/rex_profiles/parallel_recovery_20261004/b",
  },
  C: {
    frente: "C",
    sha: PIN.C,
    arvore: path.join(ARVORE, "c"),
    bin: path.join(
      ARVORE,
      "c/scripts/rex_profiles/parallel_recovery_20261004/c/target/release/rex-cfg",
    ),
    rel: "scripts/rex_profiles/parallel_recovery_20261004/c",
  },
});

export function presente(id) {
  const f = FERRAMENTAS[id];
  const alvo = f.bin ?? f.cli;
  return fs.existsSync(alvo);
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Arquivo(p) {
  return sha256(fs.readFileSync(p));
}

export function shaFerramenta(id) {
  const f = FERRAMENTAS[id];
  const alvo = f.bin ?? f.cli;
  return fs.existsSync(alvo) ? sha256Arquivo(alvo) : null;
}

/** `0x` + 6 hex maiúsculas — o formato que `rex-chain` aceita. */
export function addr(n) {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(6, "0")}`;
}

/** `"0x008000"` → 32768; aceita número (já normalizado) e devolve null sen parsing. */
export function lerEnd(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = /^0x([0-9A-Fa-f]+)$/.exec(v.trim());
  return m ? parseInt(m[1], 16) : null;
}

export function executar(bin, args, opts = {}) {
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    cwd: opts.cwd ?? RAIZ,
    timeout: opts.timeout ?? 120_000,
  });
  if (r.error && !Number.isInteger(r.status)) {
    return { rc: null, stdout: "", stderr: String(r.error.message), args, bin };
  }
  return {
    rc: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    args,
    bin,
  };
}

/** JSON do stdout (a frente A imprime a cadeia no stdout; erros vão em stderr). */
export function jsonDoStdout(r) {
  const t = r.stdout.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function garantir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function gravarBin(dir, nome, buf) {
  garantir(dir);
  const p = path.join(dir, nome);
  fs.writeFileSync(p, buf);
  return { caminho: path.relative(RAIZ, p), bytes: buf.length, sha256: sha256(buf) };
}

/** Escreve o JSONL de evidência e devolve o descritor (caminho + SHA + contagem). */
export function gravarEvidencia(nome, linhas, extra = {}) {
  garantir(MEDIDAS);
  const corpo = linhas.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const p = path.join(MEDIDAS, nome);
  fs.writeFileSync(p, corpo);
  const manifesto = {
    esquema: "rex-parallel-d/evidencia/1",
    gerado_em: new Date().toISOString().slice(0, 10),
    arquivo: path.relative(RAIZ, p),
    linhas: linhas.length,
    sha256: sha256(Buffer.from(corpo)),
    ...extra,
  };
  fs.writeFileSync(
    path.join(MEDIDAS, nome.replace(/\.jsonl$/, "-manifest.json")),
    JSON.stringify(manifesto, null, 2) + "\n",
  );
  return manifesto;
}

/** Comparação campo a campo entre expectativa congelada e valor medido. */
export function divergencias(esperado, medido) {
  const out = [];
  for (const [k, v] of Object.entries(esperado)) {
    const m = medido[k];
    const mv = typeof m === "string" && /^0x/.test(m) ? lerEnd(m) : m;
    const ev = typeof v === "number" ? v : v;
    if (mv !== ev) out.push({ campo: k, esperado: v, medido: m ?? null });
  }
  return out;
}

export function git(...args) {
  return execFileSync("git", ["-C", CANON, ...args], { encoding: "utf8" }).trim();
}

export const CATEGORIAS = [
  "aplicavel",
  "nao-aplicavel",
  "nao-suportado",
  "desconhecido",
  "falha",
];

export function linha(o) {
  if (!CATEGORIAS.includes(o.categoria)) {
    throw new Error(`categoria fora do vocabulário §1: ${o.categoria}`);
  }
  return {
    frente: o.frente,
    sha_frente: o.sha_frente,
    fila: o.fila,
    capacidade: o.capacidade,
    eixo: o.eixo ?? "",
    comando: o.comando ?? null,
    rc: o.rc ?? null,
    rc_esperado: o.rc_esperado ?? null,
    esperados: o.esperados ?? {},
    medidos: o.medidos ?? {},
    divergencias: o.divergencias ?? [],
    categoria: o.categoria,
    veredito: o.veredito,
    motivo: o.motivo ?? "",
    bruto: o.bruto ?? null,
    pontua: o.pontua ?? true,
    extras: Object.fromEntries(
      Object.entries(o).filter(([k]) =>
        !["frente", "sha_frente", "fila", "capacidade", "eixo", "comando", "rc",
          "rc_esperado", "esperados", "medidos", "divergencias", "categoria",
          "veredito", "motivo", "bruto", "pontua"].includes(k),
      ),
    ),
  };
}

/** Conteúdo exacto de um ficheiro no commit pinado, em bytes (sem normalização
 *  de linha nem decodificação UTF-8). */
export function bytesDoCommit(sha, caminho) {
  return execFileSync("git", ["-C", CANON, "show", `${sha}:${caminho}`], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "buffer",
  });
}

export function arquivosDoCommit(sha, prefixo) {
  return execFileSync("git", ["-C", CANON, "ls-tree", "-r", "--name-only", sha, "--", prefixo], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

/** Procedência auditável: compara byte a byte a árvore da ferramenta em scratch
 *  com o commit pinado. Devolve a contagem comparada e a lista de divergências;
 *  `ok` só é verdadeiro quando não falta nem diverge nenhum ficheiro. */
export function verificarProcedencia(id) {
  const f = FERRAMENTAS[id];
  const nomes = arquivosDoCommit(f.sha, f.rel);
  const divergentes = [];
  const faltantes = [];
  for (const n of nomes) {
    const local = path.join(f.arvore, n);
    if (!fs.existsSync(local)) {
      faltantes.push(path.relative(f.rel, n));
      continue;
    }
    const a = sha256(bytesDoCommit(f.sha, n));
    const b = sha256Arquivo(local);
    if (a !== b) divergentes.push({ arquivo: path.relative(f.rel, n), commit: a.slice(0, 12), scratch: b.slice(0, 12) });
  }
  return {
    frente: id,
    sha: f.sha,
    arquivos: nomes.length,
    divergentes,
    faltantes,
    ok: divergentes.length === 0 && faltantes.length === 0,
  };
}
