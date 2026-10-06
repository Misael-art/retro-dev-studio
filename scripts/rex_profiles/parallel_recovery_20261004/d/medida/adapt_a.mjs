/**
 * Adaptador da frente A (`rex-chain`) — executa a ferramenta REAL sobre as
 * fixtures autorais de D e registra o rc/estrutura brutos por linha do
 * denominador congelado (EXTENSOES-D §3, TA=8 do §6).
 *
 * Nada aqui calcula um valor esperado: as expectativas vêm de `dA-truth-v1.json`
 * (produzido por `author_frentes.mjs` antes de qualquer execução da frente).
 * O adaptador só passa ao escore o que a ferramenta emitiu (R9) e exige rc
 * exacto nas receitas de adulteração (R8).
 *
 * Uso:
 *   node scripts/.../d/medida/adapt_a.mjs                      # conjunto de medição
 *   node scripts/.../d/medida/adapt_a.mjs --conjunto holdout   # H-A (respostas reservadas)
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
  gravarEvidencia,
  jsonDoStdout,
  linha,
  lerEnd,
  divergencias,
  sha256,
  sha256Arquivo,
  shaFerramenta,
  presente,
  verificarProcedencia,
} from "./ferramentas.mjs";

const VERBOS = { A: "rex-chain" };

/** Adultera o *conteúdo* dun campo hex conservando a *forma* del (maiúsculas
 *  dos bytes/enderezos, minúsculas do hash de 64). Se a forma cambia, A devolve
 *  rc 2 «fora de forma» no eloo esquema e a receita mede o validador, non o eixo
 *  que afirma (observado na primeira execución de TA-7, 2026-10-04). */
function inverterHex(s) {
  const minuscula = /^[0-9a-f]+$/.test(s);
  const b = Buffer.from(s, "hex");
  const inv = Buffer.from(b.map((x) => x ^ 0xff));
  return minuscula ? inv.toString("hex") : inv.toString("hex").toUpperCase();
}

function hexDeEnderezoMais(n, delta) {
  return addr(lerEnd(n) + delta);
}

/** Aplica uma receita §6 à cadeia emitida pela própria ferramenta (ou à cópia
 *  da imagem). Devolve `{cadeia, imagem}` efectivamente usados. */
function aplicarReceita(receita, cadeiaBase, imagemBase) {
  const acao = receita.acao;
  let cadeia = { ...cadeiaBase };
  let imagem = imagemBase;
  if (receita.alvo === "imagem") {
    const buf = Buffer.from(imagemBase);
    if (acao.tipo !== "xor-byte") throw new Error(`acção desconhecida: ${acao.tipo}`);
    buf[acao.offset] ^= acao.valor;
    imagem = buf;
    if (acao.reapin_imaxe) cadeia.imaxe_sha256 = sha256(buf);
  } else if (acao.tipo === "campo") {
    const campo = acao.campo;
    if (campo === "fluxo_offset") cadeia[campo] = cadeia[campo] + acao.delta;
    else cadeia[campo] = hexDeEnderezoMais(cadeia[campo], acao.delta ?? acao.delta_sitio ?? 0);
  } else if (acao.tipo === "campo-hex-inverter") {
    if (typeof cadeia[acao.campo] !== "string") {
      throw new Error(`campo ${acao.campo} ausente da cadeia base: ${JSON.stringify(Object.keys(cadeia))}`);
    }
    cadeia[acao.campo] = inverterHex(cadeia[acao.campo]);
  } else if (acao.tipo === "chamada-fora-da-ventana") {
    cadeia.chamada_sitio = addr(acao.sitio);
    cadeia.chamada_bytes = acao.bytes.toUpperCase();
    cadeia.chamada_alvo = addr(acao.alvo);
  } else {
    throw new Error(`acção desconhecida: ${acao.tipo}`);
  }
  return { cadeia, imagem };
}

function escreverScratch(nome, conteudo) {
  garantir(SCRATCH);
  const p = path.join(SCRATCH, nome);
  fs.writeFileSync(p, typeof conteudo === "string" ? conteudo : Buffer.from(conteudo));
  return p;
}

export function adaptarA({
  chave = "A",
  conjunto = "medicao",
  bin = FERRAMENTAS[chave].bin,
  sha = FERRAMENTAS[chave].sha,
  nomeImg = null,
  respostas = "H-A-respostas.json",
} = {}) {
  if (!presente(chave)) {
    return { ausente: true, linhas: [], descricao: null };
  }
  const dirFix = conjunto === "holdout" ? path.join(FIXTURES, "holdout") : path.join(FIXTURES, "a");
  nomeImg = conjunto === "holdout" ? nomeImg ?? "dA-img-ho1.bin" : "dA-img-v1.bin";
  const caminhoImg = path.join(dirFix, nomeImg);
  const truth =
    conjunto === "holdout"
      ? JSON.parse(fs.readFileSync(path.join(process.env.HOME, "rds-scratch/rex-heldout-d2", respostas), "utf8"))
      : JSON.parse(fs.readFileSync(path.join(dirFix, "dA-truth-v1.json"), "utf8"));

  const imagem = fs.readFileSync(caminhoImg);
  const imagemSha = sha256(imagem);
  if (imagemSha !== truth.imagem.sha256) {
    throw new Error(`R1: imagem ${caminhoImg} difere do pin do gabarito (${imagemSha})`);
  }
  const romSize = `0x${truth.imagem.rom_size.toString(16).toUpperCase()}`;
  const prefixo = `${conjunto === "holdout" ? "HA-" : ""}${nomeImg.replace(/\.bin$/, "")}`;
  const caminhoImgRel = path.relative(RAIZ, caminhoImg);

  const construir = (extra) =>
    executar(bin, [
      "construir-cadea", "--imaxe", caminhoImgRel, "--rom-size", romSize, ...extra,
      "--rutina-lonxitude", String(truth.ka3.esperado.rutina_lonxitude),
      "--limite-max-saida", "65536",
      "--limite-orzamento", "4000000",
    ]);
  const linhaCmd = (args) => `${VERBOS.A} ${args.join(" ")}`;
  const linhas = [];
  const bruto = {};

  // ---- KA3: cadeia completa + revalidar (a base das receitas TA) ----------
  const argsKa3 = ["--carga-sitio", addr(truth.ka3.carga_sitio)];
  const rKa3 = construir(argsKa3);
  const cadeiaKa3 = jsonDoStdout(rKa3);
  let cadeiaBase = cadeiaKa3;
  if (cadeiaKa3) {
    const p = escreverScratch(`${prefixo}-ka3.json`, JSON.stringify(cadeiaKa3) + "\n");
    const rv = executar(bin, ["revalidar", "--imaxe", caminhoImgRel, "--cadea", p]);
    bruto.ka3_revalidar = rv.stdout.trim();
    const esper = { ...truth.ka3.esperado };
    delete esper.rc;
    const divs = divergencias(esper, cadeiaKa3);
    const rcOk = rKa3.rc === truth.ka3.esperado.rc && rv.rc === truth.ka3.revalidar_esperado_rc;
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: truth.ka3.id,
        capacidade: "KA3",
        eixo: "cadeia",
        comando: linhaCmd([...argsKa3]),
        rc: rKa3.rc,
        rc_esperado: truth.ka3.esperado.rc,
        esperados: esper,
        medidos: Object.fromEntries(Object.keys(esper).map((k) => [k, cadeiaKa3[k] ?? null])),
        divergencias: divs,
        categoria: "aplicavel",
        veredito: rcOk && divs.length === 0 && rv.rc === 0 ? "PASS" : "FAIL",
        motivo: rv.rc === 0 ? "revalidar rc 0" : `revalidar rc ${rv.rc}: ${rv.stdout.trim()}`,
        bruto: { construir: rKa3.stdout.trim(), revalidar: rv.stdout.trim() },
      }),
    );
  } else {
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: truth.ka3.id,
        capacidade: "KA3",
        eixo: "cadeia",
        comando: linhaCmd(argsKa3),
        rc: rKa3.rc,
        rc_esperado: truth.ka3.esperado.rc,
        categoria: "falha",
        veredito: "FAIL",
        motivo: `construir-cadea non emitiu cadena: ${(rKa3.stderr || rKa3.stdout).trim()}`,
      }),
    );
  }

  // ---- KA1: as 9 formas da gramática congelada ----------------------------
  for (const sonda of truth.ka1) {
    const args = ["--carga-sitio", addr(sonda.carga_sitio)];
    const r = construir(args);
    const j = jsonDoStdout(r);
    const medidos = {};
    for (const k of Object.keys(sonda.esperado)) medidos[k] = j ? (j[k] ?? null) : null;
    const divs = j ? divergencias(sonda.esperado, j) : Object.keys(sonda.esperado).map((c) => ({ campo: c, esperado: sonda.esperado[c], medido: null, motivo: "sen cadena" }));
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: sonda.id,
        capacidade: "KA1",
        eixo: "instrucao",
        comando: linhaCmd(args),
        rc: r.rc,
        rc_esperado: 0,
        esperados: sonda.esperado,
        medidos,
        divergencias: divs,
        categoria: "aplicavel",
        veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
        motivo: j ? "" : (r.stderr || r.stdout).trim(),
        bruto: j ? null : (r.stderr || r.stdout).trim(),
      }),
    );
  }

  // ---- KA1-b: sondas fora da gramática alegada (recusa limpa) --------------
  for (const sonda of truth.ka1b) {
    const args = ["--carga-sitio", addr(sonda.sitio)];
    const r = construir(args);
    const j = jsonDoStdout(r);
    const recusa = r.rc !== 0 && j === null;
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: sonda.id,
        capacidade: "KA1-b",
        eixo: "limite-de-isa",
        comando: linhaCmd(args),
        rc: r.rc,
        rc_esperado: "distinto de 0",
        esperados: { resultado: "recusa_sem_cadeia" },
        medidos: { resultado: j ? "cadena_emitida" : "recusa" },
        divergencias: recusa ? [] : [{ campo: "resultado", esperado: "recusa_sem_cadeia", medido: j ? "cadena_emitida" : "rc-0-sen-cadena" }],
        categoria: "nao-suportado",
        veredito: recusa ? "PASS" : "FAIL",
        motivo: sonda.nota_isa,
        bruto: { stderr: (r.stderr || r.stdout).trim(), bytes_no_sitio: imagem.subarray(sonda.sitio, sonda.sitio + 6).toString("hex").toUpperCase(), esperado_nas_bytes: sonda.bytes.toUpperCase() },
      }),
    );
  }

  // ---- KA2: classificação de região do destino ----------------------------
  for (const sonda of truth.ka2) {
    const args = [
      "--carga-sitio", addr(truth.ka3.carga_sitio),
      "--destino-sitio", addr(sonda.destino_sitio),
    ];
    const r = construir(args);
    const j = jsonDoStdout(r);
    const esper = { destino_rexion: sonda.esperado_rexion };
    const divs = j ? divergencias(esper, j) : [{ campo: "destino_rexion", esperado: sonda.esperado_rexion, medido: null, motivo: "sen cadena" }];
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: sonda.id,
        capacidade: "KA2",
        eixo: "enderecamento",
        comando: linhaCmd(args),
        rc: r.rc,
        rc_esperado: 0,
        esperados: esper,
        medidos: j ? { destino_rexion: j.destino_rexion ?? null, destino_operando: j.destino_operando ?? null, destino_forma: j.destino_forma ?? null } : {},
        divergencias: divs,
        categoria: "aplicavel",
        veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
        motivo: sonda.fonte_expectativa,
        bruto: j ? null : (r.stderr || r.stdout).trim(),
      }),
    );
  }

  // ---- KA3-g: guardas de confiança ----------------------------------------
  const guardas = [];
  if (cadeiaBase) {
    const gA = { ...cadeiaBase, campo_desconhecido: "injecao-de-teste" };
    const gB = { ...cadeiaBase, confianza: "observado-en-runtime" };
    guardas.push(["KA3-g-a", gA], ["KA3-g-b", gB]);
  }
  for (const [id, mut] of guardas) {
    const p = escreverScratch(`${prefixo}-${id}.json`, JSON.stringify(mut) + "\n");
    const r = executar(bin, ["revalidar", "--imaxe", caminhoImgRel, "--cadea", p]);
    const sonda = truth.ka3g.find((s) => s.id === id);
    linhas.push(
      linha({
        frente: "A",
        sha_frente: sha,
        fila: id,
        capacidade: "KA3-g",
        eixo: "confianca",
        comando: `${VERBOS.A} revalidar --imaxe ${caminhoImgRel} --cadea <${id}>`,
        rc: r.rc,
        rc_esperado: sonda ? sonda.esperado_rc : 2,
        esperados: { mutacion: sonda ? sonda.mutacion : id },
        medidos: { rc: r.rc },
        divergencias: r.rc === (sonda ? sonda.esperado_rc : 2) ? [] : [{ campo: "rc", esperado: sonda ? sonda.esperado_rc : 2, medido: r.rc }],
        categoria: "aplicavel",
        veredito: r.rc === (sonda ? sonda.esperado_rc : 2) ? "PASS" : "FAIL",
        bruto: (r.stdout || r.stderr).trim(),
      }),
    );
  }
  if (!cadeiaBase) {
    for (const s of truth.ka3g) {
      linhas.push(
        linha({
          frente: "A", sha_frente: sha, fila: s.id, capacidade: "KA3-g", eixo: "confianca",
          categoria: "desconhecido", veredito: "INCONCLUSIVE",
          motivo: "KA3 non produciu cadeia base; a guarda non puido ser exercitada",
        }),
      );
    }
  }

  // ---- KA4: decode Kosinski (típica, curta, truncada) ---------------------
  for (const sonda of truth.ka4) {
    const args = ["--carga-sitio", addr(sonda.carga_sitio)];
    const r = construir(args);
    const j = jsonDoStdout(r);
    const rcEsp = sonda.esperado.rc;
    if (rcEsp === 0) {
      const esper = { saida_sha256: sonda.esperado.saida_sha256, saida_bytes: sonda.esperado.saida_bytes, bytes_consumidos: sonda.esperado.bytes_consumidos };
      const divs = j ? divergencias(esper, j) : Object.keys(esper).map((c) => ({ campo: c, esperado: esper[c], medido: null }));
      linhas.push(
        linha({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA4", eixo: "decode",
          comando: linhaCmd(args), rc: r.rc, rc_esperado: 0, esperados: esper,
          medidos: j ? Object.fromEntries(Object.keys(esper).map((k) => [k, j[k] ?? null])) : {},
          divergencias: divs, categoria: "aplicavel",
          veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
          fluxo: sonda.fluxo, bruto: j ? null : (r.stderr || r.stdout).trim(),
        }),
      );
    } else {
      const ok = r.rc === rcEsp;
      linhas.push(
        linha({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA4", eixo: "decode",
          comando: linhaCmd(args), rc: r.rc, rc_esperado: rcEsp,
          esperados: { rc: rcEsp, motivo: sonda.esperado.motivo },
          medidos: { rc: r.rc, cadena: j ? "emitida" : "nenhuma" },
          divergencias: ok ? [] : [{ campo: "rc", esperado: rcEsp, medido: r.rc }],
          categoria: "aplicavel", veredito: ok ? "PASS" : "FAIL",
          fluxo: sonda.fluxo, bruto: (r.stdout || r.stderr).trim(),
        }),
      );
    }
  }

  // ---- TA: controles de adulteração (rc exacto, R8) -----------------------
  if (cadeiaBase) {
    for (const receita of truth.ta) {
      const { cadeia, imagem: imgMut } = aplicarReceita(receita, cadeiaBase, imagem);
      const nomeImg = `${prefixo}-${receita.id}.bin`.replace(/\//g, "-");
      const pImg = escreverScratch(nomeImg, imgMut);
      const pCad = escreverScratch(`${prefixo}-${receita.id}.json`.replace(/\//g, "-"), JSON.stringify(cadeia) + "\n");
      const r = executar(bin, ["revalidar", "--imaxe", pImg, "--cadea", pCad]);
      const ok = r.rc === receita.esperado_rc;
      const elo = /codigo=(\d+)/.exec(r.stdout);
      linhas.push(
        linha({
          frente: "A", sha_frente: sha, fila: receita.id, capacidade: "TA", eixo: receita.eixo,
          comando: `${VERBOS.A} revalidar (mutación ${receita.acao.tipo} sobre ${receita.alvo})`,
          rc: r.rc, rc_esperado: receita.esperado_rc,
          esperados: { rc: receita.esperado_rc },
          medidos: { rc: r.rc, elo: elo ? elo[1] : null },
          divergencias: ok ? [] : [{ campo: "rc", esperado: receita.esperado_rc, medido: r.rc }],
          categoria: "aplicavel", veredito: ok ? "PASS" : "FAIL",
          motivo: receita.motivo,
          bruto: r.stdout.trim() || r.stderr.trim(),
          artefactos: { imagem_sha256: sha256(imgMut), cadeia_sha256: sha256(Buffer.from(JSON.stringify(cadeia))) },
        }),
      );
      if (receita.id === "TA-2") {
        // control observado (non pontúa): a mesma mutación sen re-pin cae no elo
        // identidade — rexistrado para que a elección da receita sea auditável.
        const r2 = executar(bin, ["revalidar", "--imaxe", pImg, "--cadea", escreverScratch(`${prefixo}-TA-2-sem-repin.json`, JSON.stringify(cadeiaBase) + "\n")]);
        linhas.push(
          linha({
            frente: "A", sha_frente: sha, fila: "TA-2-control", capacidade: "TA-controle", eixo: "identidade",
            comando: `${VERBOS.A} revalidar (TA-2 sen re-pin)`, rc: r2.rc, rc_esperado: 3,
            esperados: { rc: 3 }, medidos: { rc: r2.rc },
            divergencias: [], categoria: "aplicavel", veredito: "CONTROLADO", pontua: false,
            motivo: "eixo identidade confunde a receita TA-2; queda como observación",
            bruto: r2.stdout.trim() || r2.stderr.trim(),
          }),
        );
      }
    }
  } else {
    for (const receita of truth.ta) {
      linhas.push(
        linha({
          frente: "A", sha_frente: sha, fila: receita.id, capacidade: "TA", eixo: receita.eixo,
          categoria: "desconhecido", veredito: "INCONCLUSIVE",
          motivo: "KA3 non produciu cadeia base; a receita non puido ser executada",
        }),
      );
    }
  }

  const manifesto = {
    ferramenta: { bin, sha256: shaFerramenta(chave), verbo: VERBOS.A },
    sha_frente: sha,
    procedencia: verificarProcedencia(chave),
    conjunto,
    imagem: { arquivo: path.relative(RAIZ, caminhoImg), bytes: imagem.length, sha256: imagemSha },
    truth_sha256: conjunto === "medicao" ? sha256Arquivo(path.join(dirFix, "dA-truth-v1.json")) : "respostas reservadas fóra da árbore",
  };
  return { ausente: false, linhas, manifesto, bruto };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = (nome) =>
    process.argv.includes(nome) ? process.argv[process.argv.indexOf(nome) + 1] : null;
  const conjunto = argv("--conjunto") ?? "medicao";
  const chave = argv("--chave") ?? "A";
  const r = adaptarA({ chave, conjunto });
  if (r.manifesto) {
    const nome = r.manifesto.conjunto === "holdout" ? "A-holdout.jsonl" : `A-${r.manifesto.sha_frente.slice(0, 7)}.jsonl`;
    const desc = gravarEvidencia(nome, r.linhas, r.manifesto);
    console.log(`[A] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…)`);
    const p = r.manifesto.procedencia;
    console.log(`[A] procedencia ${p.frente}@${p.sha.slice(0, 7)}: ${p.ok ? "OK" : "DIVERXENTE"} (${p.arquivos} ficheiros, ${p.divergentes.length} diverxentes, ${p.faltantes.length} faltantes)`);
    for (const l of r.linhas) {
      console.log(`  ${l.fila.padEnd(14)} ${String(l.veredito).padEnd(11)} rc=${l.rc} esp=${l.rc_esperado} ${l.divergencias.length ? `div=${JSON.stringify(l.divergencias[0])}` : ""}`);
    }
  } else {
    console.log(`[A] FERRAMENTA AUSENTE en ${FERRAMENTAS[chave].bin} — medição non executada (linhas = desconhecido, nunca 0)`);
    process.exitCode = 3;
  }
}
