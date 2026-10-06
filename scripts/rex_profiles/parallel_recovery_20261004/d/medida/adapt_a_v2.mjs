/**
 * Adaptador v2 da frente A (`rex-chain`) — executa a ferramenta REAL sobre as
 * fixtures `dA-*-v2` e pontúa co contrato vixente (EXTENSOES-D v2).
 *
 * Diferenzas respecto de `adapt_a.mjs` (v1), todas elas consecuencia dun
 * defecto *medido* na rolda 2 e non dun capricho:
 *   1. a ventá de emparellamento pásaa D por bandeira (`--ventanxa`, valor do
 *      gabarito) en vez de depender do defecto implícito da ferramenta;
 *   2. as recusas pontúan por **conxunto** de códigos aceptados e por **elo**
 *      (R12), non por igualdade exacta: `rc` pode ser correcto noutro eixo e
 *      iso non é un PASS (v1 mediu `TA-5` como falla de seguranza cando era
 *      recusa correcta nunha pregunta distinta);
 *   3. o `elo` lé do informe por elos que a propia fronte imprime
 *      (`esquema=PASS(ok) identidade=FAIL(…)`), non se deduce do código;
 *   4. cada fila leva `gabarito`/`contrato` e o manifesto rexistra o binario,
 *      para que `pontuar.mjs` recuse mesturar versións (R15).
 *
 * Nada aquí calcula un valor esperado: as expectativas vêm de
 * `dA-truth-v2.json` (`author_v2.mjs`, xerado antes de calquera execución).
 *
 * Uso:
 *   node scripts/…/d/medida/adapt_a_v2.mjs
 *   node scripts/…/d/medida/adapt_a_v2.mjs --conjunto holdout --chave A_corrixido
 */
import fs from "node:fs";
import path from "node:path";
import {
  FERRAMENTAS,
  FIXTURES,
  RAIZ,
  SCRATCH_V2,
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

const VERBO = "rex-chain";
const DIR_A = path.join(FIXTURES, "a");
export const NOME_IMG = "dA-img-v2.bin";
export const NOME_TRUTH = "dA-truth-v2.json";
export const NOME_PIN = "pin-v2.json";
export const GABARITO = "isa-oraculo-v2";
export const CONTRATO = "EXTENSOES-D v2";

function inverterHex(s) {
  const minuscula = /^[0-9a-f]+$/.test(s);
  const inv = Buffer.from(s, "hex").map((x) => x ^ 0xff);
  const hex = Buffer.from(inv).toString("hex");
  return minuscula ? hex : hex.toUpperCase();
}

const hexMais = (n, delta) => addr(lerEnd(n) + delta);

/**
 * Analisa o informe por elos de `revalidar`. Devolve `{codigo, elos, fallos}`
 * con `elos` na orde en que a fronte os imprime (`saída` ten acento; `destino`
 * pode vir como `SKIP`, que non é falla). Non hai adiviñanza: se o informe non
 * di `codigo=`, `codigo` é null e a fila non pode pontuar por elo.
 */
const RE_ELO = /([\p{Ll}0-9]+(?:-[\p{Ll}0-9]+)*)=(PASS|FAIL|SKIP)\(/gu;

export function lerInforme(texto) {
  const codigo = /codigo=(\d+)/.exec(texto ?? "")?.[1];
  const elos = [];
  let m;
  RE_ELO.lastIndex = 0;
  while ((m = RE_ELO.exec(texto ?? "")) !== null) elos.push({ nome: m[1], estado: m[2] });
  return {
    codigo: codigo === undefined ? null : Number(codigo),
    elos,
    fallos: elos.filter((e) => e.estado === "FAIL").map((e) => e.nome),
  };
}

/** Unha receita §6/§12.3 aplicada á cadea base (ou á copia da imaxe). */
function aplicarReceita(receita, cadeiaBase, imagemBase) {
  const acao = receita.acao;
  const cadeia = { ...cadeiaBase };
  let imagem = imagemBase;
  if (receita.alvo === "imagem") {
    const buf = Buffer.from(imagemBase);
    if (acao.tipo !== "xor-byte") throw new Error(`acção desconhecida: ${acao.tipo}`);
    buf[acao.offset] ^= acao.valor;
    imagem = buf;
    if (acao.reapin_imaxe) cadeia.imaxe_sha256 = sha256(buf);
  } else if (acao.tipo === "campo") {
    if (acao.valor !== undefined) cadeia[acao.campo] = acao.valor;
    else if (acao.campo === "fluxo_offset") cadeia[acao.campo] += acao.delta;
    else cadeia[acao.campo] = hexMais(cadeia[acao.campo], acao.delta ?? 0);
  } else if (acao.tipo === "campo-hex-inverter") {
    if (typeof cadeia[acao.campo] !== "string") {
      throw new Error(`campo ${acao.campo} ausente da cadea base: ${Object.keys(cadeia)}`);
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

/**
 * Escore R12, literal ao contrato: a **categoría** deriva do rc
 * (`rc ∈ conxunto ⇒ aplicavel`; `rc 0 ⇒ falha`; `rc ∉ conxunto ⇒ descoñecido`
 * con motivo) e o **veredito** deriva dos tres invariantes — rc ≠ 0, ningunha
 * saída promovida e motivo/elo pertencente ao conxunto. `categoria_aceitada`
 * permite que unha recusa xusta se publique como `nao-suportado` (KA1v-neg/fora)
 * e unha adulteración ben rexeitada como `aplicavel` (TAv), que é o vocabulario
 * que a propia fila declara no gabarito.
 */
export function pontuarR12({
  rc_aceitado,
  rc_medido,
  elo_aceitado,
  fallos,
  motivosOk = true,
  cadea_promovida = false,
  categoria_aceitada = "aplicavel",
}) {
  if (rc_medido === 0) {
    return { veredito: "FAIL", categoria: "falha", desvio: "rc 0: aceptou/promoviu unha forma que o gabarito declara non soportada" };
  }
  if (rc_medido === null || !rc_aceitado.includes(rc_medido)) {
    return {
      veredito: "FAIL",
      categoria: "desconhecido",
      desvio: `rc ${rc_medido} fóra do conxunto ${JSON.stringify(rc_aceitado)}; elos en falla ${JSON.stringify(fallos)}`,
    };
  }
  const desvios = [];
  if (cadea_promovida) desvios.push("promoveu unha saída pese a rc ≠ 0");
  if (elo_aceitado && !(fallos.length === 1 && fallos[0] === elo_aceitado)) {
    desvios.push(`elo illado agardado ${elo_aceitado}, medido ${JSON.stringify(fallos)}`);
  }
  if (!motivosOk) desvios.push("motivo fóra do conxunto publicado");
  if (desvios.length > 0) {
    return { veredito: "FAIL", categoria: "aplicavel", desvio: desvios.join("; ") };
  }
  return { veredito: "PASS", categoria: categoria_aceitada, desvio: null };
}

export function adaptarA2({
  chave = "A_corrixido",
  conjunto = "medicao",
  bin = FERRAMENTAS[chave].bin,
  sha = FERRAMENTAS[chave].sha,
  respostas = "H-A-respostas-v2.json",
  nomeImg = NOME_IMG,
  nomeTruth = NOME_TRUTH,
  /** Só para controls negativos de *este* ficheiro de tests: un camiño absoluto
   *  cara a unha copia alterada do gabarito. A evidencia publicada sempre usa o
   *  gabarito pinned; nada aquí reescribe `dA-truth-v2.json`. */
  arquivoVerdade = null,
} = {}) {
  if (!presente(chave)) {
    return { ausente: true, linhas: [], descricao: null };
  }
  const dirFix = conjunto === "holdout" ? path.join(FIXTURES, "holdout") : DIR_A;
  const caminhoImg = path.join(dirFix, nomeImg);
  const verdade = arquivoVerdade ?? (conjunto === "holdout"
    ? path.join(process.env.HOME, "rds-scratch/rex-heldout-d3", respostas)
    : path.join(dirFix, nomeTruth));
  const truth = JSON.parse(fs.readFileSync(verdade, "utf8"));
  const pin = conjunto === "holdout" ? null : JSON.parse(fs.readFileSync(path.join(DIR_A, NOME_PIN), "utf8"));

  const imagem = fs.readFileSync(caminhoImg);
  const imagemSha = sha256(imagem);
  if (imagemSha !== truth.imaxe.sha256) {
    throw new Error(`R1: imaxe ${caminhoImg} difere do pin do gabarito (${imagemSha})`);
  }
  if (pin && pin.arquivos[nomeImg].sha256 !== imagemSha) {
    throw new Error(`R1: imaxe difere do pin versionado ${NOME_PIN}`);
  }
  if (truth.gabarito !== GABARITO || truth.contrato !== CONTRATO) {
    throw new Error(`verdade v2 con gabarito/contrato estraños: ${truth.gabarito}/${truth.contrato}`);
  }
  const VENTANXA = truth.ventanxa;
  const romSize = `0x${truth.imaxe.rom_size.toString(16).toUpperCase()}`;
  const caminhoImgRel = path.relative(RAIZ, caminhoImg);
  const prefixo = `${conjunto === "holdout" ? "HA3-" : ""}${nomeImg.replace(/\.bin$/, "")}`;

  const argsConstruir = (extra) => [
    "construir-cadea", "--imaxe", caminhoImgRel, "--rom-size", romSize, ...extra,
    "--ventanxa", String(VENTANXA),
    "--rutina-lonxitude", String(truth.ka3v.esperado.rutina_lonxitude),
    "--limite-max-saida", "65536",
    "--limite-orzamento", "4000000",
  ];
  const argsRevalidar = (img, cadea) => ["revalidar", "--imaxe", img, "--cadea", cadea, "--ventanxa", String(VENTANXA)];
  const revalidar = (img, cadea) => executar(bin, argsRevalidar(img, cadea));
  const cmd = (args) => `${VERBO} ${args.join(" ")}`;
  const escribir = (nome, conteudo) => {
    garantir(SCRATCH_V2);
    const p = path.join(SCRATCH_V2, nome);
    fs.writeFileSync(p, typeof conteudo === "string" ? conteudo : Buffer.from(conteudo));
    return p;
  };

  const linhas = [];
  const bruto = {};
  const marcas = (o) => ({ ...o, gabarito: GABARITO, contrato: CONTRATO, ventanxa: VENTANXA });

  /** Cadeas base, unha por `base` declarada nas receitas. */
  const bases = new Map();
  function cadeaBase(nomeBase, cargaSitio) {
    if (bases.has(nomeBase)) return bases.get(nomeBase);
    const args = argsConstruir(["--carga-sitio", addr(cargaSitio)]);
    const r = executar(bin, args);
    const entrada = { rc: r.rc, cadeia: jsonDoStdout(r), args, stdout: `${r.stdout}${r.stderr ? `\n${r.stderr}` : ""}` };
    bases.set(nomeBase, entrada);
    return entrada;
  }
  const baseKa3 = () => cadeaBase("KA3v", truth.ka3v.carga_sitio);

  // ---- KA3v: cadea completa (base das receitas) ---------------------------
  {
    const entrada = baseKa3();
    const j = entrada.cadeia;
    bruto.ka3v = j;
    if (j) {
      const p = escribir(`${prefixo}-ka3v.json`, `${JSON.stringify(j)}\n`);
      const rv = revalidar(caminhoImgRel, p);
      const informe = lerInforme(rv.stdout);
      const esper = { ...truth.ka3v.esperado };
      delete esper.rc; // rc é o do proceso, non un campo da cadea
      const divs = divergencias(esper, j);
      const rcOk = entrada.rc === truth.ka3v.esperado.rc;
      const rvOk = rv.rc === truth.ka3v.revalidar_esperado_rc && informe.fallos.length === 0;
      linhas.push(
        linha(
          marcas({
            frente: "A",
            sha_frente: sha,
            fila: truth.ka3v.id,
            capacidade: "KA3v",
            eixo: "cadeia",
            comando: cmd(entrada.args),
            rc: entrada.rc,
            rc_esperado: truth.ka3v.esperado.rc,
            esperados: esper,
            medidos: Object.fromEntries(Object.keys(esper).map((k) => [k, j[k] ?? null])),
            divergencias: divs,
            categoria: "aplicavel",
            veredito: rcOk && divs.length === 0 && rvOk ? "PASS" : "FAIL",
            motivo: rvOk
              ? `revalidar rc ${rv.rc} sen elos en falla`
              : `revalidar rc ${rv.rc}${informe.fallos.length ? ` elos ${JSON.stringify(informe.fallos)}` : ""}`,
            revalidado: cmd(argsRevalidar(caminhoImgRel, p)),
            elos_medidos: informe.fallos,
            bruto: { construir: entrada.stdout.trim(), revalidar: rv.stdout.trim() },
          }),
        ),
      );
    } else {
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: truth.ka3v.id, capacidade: "KA3v", eixo: "cadeia",
            rc: entrada.rc, rc_esperado: truth.ka3v.esperado.rc, categoria: "falha", veredito: "FAIL",
            motivo: `construir-cadea non emitiu cadea no sitio ${addr(truth.ka3v.carga_sitio)}`,
            bruto: entrada.rc === 0 ? "rc 0 sen JSON no stdout" : `rc ${entrada.rc}`,
          }),
        ),
      );
    }
  }

  /** Unha fila do grupo KA1v pode ser unha forma aceptada *ou* unha recusa
   *  xusta: o que o decide é a propia fila (`esperado.recusa`), non o grupo en
   *  que vive — `KA1v-lea-w-alto` acepta a codificación e rexeita o *mapper*, e
   *  está dentro de `ka1v` porque o denominador de §12.3 a conta alí. Tratala
   *  como forma aceptada sería unha falla de D (R11), non de A. */
  function filaRecusa(sonda, eixo) {
    const args = argsConstruir(["--carga-sitio", addr(sonda.carga_sitio)]);
    const r = executar(bin, args);
    const j = jsonDoStdout(r);
    const texto = `${r.stdout}\n${r.stderr}`;
    const informe = lerInforme(texto);
    const rc_aceitado = sonda.esperado.rc_aceitado;
    const motivosOk = sonda.esperado.motivos_aceitados.some((m) => texto.includes(m));
    const emitiuCadea = j !== null;
    const esc = pontuarR12({
      rc_aceitado,
      rc_medido: r.rc,
      elo_aceitado: sonda.esperado.elo_aceitado ?? null,
      fallos: informe.fallos,
      motivosOk,
      cadea_promovida: emitiuCadea,
      categoria_aceitada: sonda.esperado.categoria ?? "nao-suportado",
    });
    const ok = esc.veredito === "PASS";
    linhas.push(
      linha(
        marcas({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: sonda.capacidade,
          eixo, comando: cmd(args), rc: r.rc,
          rc_esperado: `un dos ${JSON.stringify(rc_aceitado)}`,
          esperados: {
            rc: rc_aceitado, motivo: sonda.esperado.motivos_aceitados,
            cadea_promovida: sonda.esperado.cadea_promovida,
          },
          medidos: {
            rc: r.rc, elos_en_falla: informe.fallos, cadea: emitiuCadea ? "emitida" : "ningunha",
            motivo: sonda.esperado.motivos_aceitados.find((m) => texto.includes(m)) ?? null,
          },
          divergencias: ok
            ? []
            : [
                ...(rc_aceitado.includes(r.rc) ? [] : [{ campo: "rc", esperado: rc_aceitado, medido: r.rc }]),
                ...(motivosOk ? [] : [{ campo: "motivo", esperado: sonda.esperado.motivos_aceitados, medido: texto.trim().slice(0, 160) }]),
                ...(emitiuCadea ? [{ campo: "cadea", esperado: "ningunha", medido: "emitida" }] : []),
              ],
          categoria: esc.categoria,
          veredito: esc.veredito,
          motivo: sonda.nota_instrumento ?? sonda.nota ?? sonda.esperado.motivo,
          desvio: esc.desvio,
          bruto: texto.trim(),
        }),
      ),
    );
  }

  // ---- KA1v: formas aceptadas (ou recusas xustas), codificadas polo instrumento
  for (const sonda of truth.ka1v) {
    if (sonda.esperado.recusa === true) {
      filaRecusa(sonda, sonda.esperado.eixo ?? "recusa-mapper");
      continue;
    }
    const args = argsConstruir(["--carga-sitio", addr(sonda.carga_sitio)]);
    const r = executar(bin, args);
    const j = jsonDoStdout(r);
    const esper = sonda.esperado;
    const divs = j
      ? divergencias(esper, j)
      : Object.keys(esper).map((c) => ({ campo: c, esperado: esper[c], medido: null, motivo: "sen cadea" }));
    linhas.push(
      linha(
        marcas({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA1v", eixo: "instrucao",
          comando: cmd(args), rc: r.rc, rc_esperado: 0,
          esperados: esper, medidos: j ? Object.fromEntries(Object.keys(esper).map((k) => [k, j[k] ?? null])) : {},
          divergencias: divs, categoria: "aplicavel",
          veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
          motivo: j ? `forma ${sonda.forma}; EA ditada por objdump: ${sonda.sondeo.instrumento.ea}` : (r.stderr || r.stdout).trim(),
          sondeo: { bytes: sonda.sondeo.bytes, instrumento: sonda.sondeo.instrumento.mnemonico },
          bruto: j ? null : (r.stderr || r.stdout).trim(),
        }),
      ),
    );
  }

  // ---- KA1v-neg / KA1v-fora: recusas pontuadas por conxunto e motivo (R12) --
  for (const [grupo, eixo] of [["ka1v_neg", "limite-de-isa"], ["ka1v_fora", "fora-do-subconxunto"]]) {
    for (const sonda of truth[grupo]) filaRecusa(sonda, eixo);
  }

  // ---- KA2v: rexión do destino e invariante anti-clamp ---------------------
  for (const sonda of truth.ka2v) {
    const extra = ["--carga-sitio", addr(sonda.carga_sitio), "--destino-sitio", addr(sonda.destino_sitio)];
    const args = argsConstruir(extra);
    const r = executar(bin, args);
    const j = jsonDoStdout(r);
    const esper = {
      destino_rexion: sonda.esperado_rexion,
      destino_operando: sonda.destino_operando,
      destino_bytes: sonda.destino_bytes,
      destino_forma: sonda.destino_forma,
    };
    const divs = j
      ? divergencias(esper, j)
      : [{ campo: "destino_rexion", esperado: sonda.esperado_rexion, medido: null, motivo: "sen cadea" }];
    // O invariante anti-clamp non é «rc ≠ 0» nin «destino_operando ≠ bus»: é que
    // a cadea REXISTRE a diferenza efectivo↔bus nas súas `limitacions`
    // (RECTIFICACION-A §2, modelo de tres niveis). Cando o gabarito declara
    // `limitacion_esixida`, a cadea que non a publique é un clamp silencioso.
    const limitacions = Array.isArray(j?.limitacions) ? j.limitacions : [];
    const rexistrada = sonda.limitacion_esixida
      ? limitacions.some((l) => typeof l === "string" && l.startsWith(sonda.limitacion_esixida))
      : null;
    const clamp = j && sonda.limitacion_esixida ? !rexistrada : false;
    const clampInesperado = j && !sonda.limitacion_esixida && limitacions.some((l) => typeof l === "string" && l.startsWith("efectivo≠bus"));
    if (clamp || clampInesperado) {
      divs.push({
        campo: "limitacions",
        esperado: sonda.limitacion_esixida ? `contén «${sonda.limitacion_esixida}»` : "sen limitacion efectivo≠bus",
        medido: JSON.stringify(limitacions),
      });
    }
    linhas.push(
      linha(
        marcas({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA2v", eixo: "enderecamento",
          comando: cmd(args), rc: r.rc, rc_esperado: 0,
          esperados: { ...esper, clamp_silencioso: "prohibido" },
          medidos: j
            ? { destino_rexion: j.destino_rexion ?? null, destino_operando: j.destino_operando ?? null, destino_bytes: j.destino_bytes ?? null, destino_forma: j.destino_forma ?? null, limitacions }
            : {},
          divergencias: divs, categoria: "aplicavel",
          veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
          motivo: sonda.fonte_expectativa, limitacion_esixida: sonda.limitacion_esixida ?? null,
          clamp_silencioso_detectado: clamp,
          rexistrada_na_cadea: rexistrada,
          bruto: j ? null : (r.stderr || r.stdout).trim(),
        }),
      ),
    );
  }

  // ---- KA3v-g: gardas de confianza (rc por conxunto + motivo) --------------
  for (const sonda of truth.ka3v_g) {
    const entrada = baseKa3();
    if (!entrada.cadeia) {
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA3v-g", eixo: "confianca",
            categoria: "desconhecido", veredito: "INCONCLUSIVE",
            motivo: "KA3v non produciu cadea base; a guarda non puido ser exercitada",
          }),
        ),
      );
      continue;
    }
    const mut = { ...entrada.cadeia };
    if (sonda.mutacion === "campo_desconhecido") mut.campo_desconhecido = "injecao-de-teste";
    else if (sonda.mutacion.startsWith("confianza=")) mut.confianza = sonda.mutacion.split("=")[1];
    else throw new Error(`mutación de guarda non coñecida: ${sonda.mutacion}`);
    const p = escribir(`${prefixo}-${sonda.id}.json`, `${JSON.stringify(mut)}\n`);
    const r = revalidar(caminhoImgRel, p);
    const texto = `${r.stdout}\n${r.stderr}`;
    const motivosOk = sonda.motivos_aceitados.some((m) => texto.includes(m));
    const esc = pontuarR12({
      rc_aceitado: sonda.esperado_rc_conxunto,
      rc_medido: r.rc,
      elo_aceitado: null,
      fallos: lerInforme(texto).fallos,
      motivosOk,
    });
    linhas.push(
      linha(
        marcas({
          frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA3v-g", eixo: "confianca",
          comando: cmd(argsRevalidar(caminhoImgRel, p)),
          rc: r.rc, rc_esperado: `un dos ${JSON.stringify(sonda.esperado_rc_conxunto)}`,
          esperados: { mutacion: sonda.mutacion, rc: sonda.esperado_rc_conxunto, motivo: sonda.motivos_aceitados },
          medidos: { rc: r.rc, motivo: sonda.motivos_aceitados.find((m) => texto.includes(m)) ?? null },
          divergencias: esc.veredito === "PASS" ? [] : [{ campo: "rc+motivo", esperado: `${JSON.stringify(sonda.esperado_rc_conxunto)} c/un motivo de ${JSON.stringify(sonda.motivos_aceitados)}`, medido: `${r.rc} / ${texto.trim().slice(0, 120)}` }],
          categoria: esc.categoria,
          veredito: esc.veredito,
          desvio: esc.desvio,
          motivo: sonda.motivo,
          bruto: texto.trim(),
        }),
      ),
    );
  }

  // ---- KA4v: decodificación Kosinski dos tres fluxos -----------------------
  for (const sonda of truth.ka4v) {
    const args = argsConstruir(["--carga-sitio", addr(sonda.carga_sitio)]);
    const r = executar(bin, args);
    const j = jsonDoStdout(r);
    const rcEsp = sonda.esperado.rc;
    if (rcEsp === 0) {
      const esper = {
        saida_sha256: sonda.esperado.saida_sha256,
        saida_bytes: sonda.esperado.saida_bytes,
        bytes_consumidos: sonda.esperado.bytes_consumidos,
        carga_forma: sonda.esperado.carga_forma,
        carga_operando: sonda.esperado.carga_operando,
      };
      const divs = j ? divergencias(esper, j) : Object.keys(esper).map((c) => ({ campo: c, esperado: esper[c], medido: null }));
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA4v", eixo: "decode",
            comando: cmd(args), rc: r.rc, rc_esperado: 0, esperados: esper,
            medidos: j ? Object.fromEntries(Object.keys(esper).map((k) => [k, j[k] ?? null])) : {},
            divergencias: divs, categoria: "aplicavel",
            veredito: r.rc === 0 && divs.length === 0 ? "PASS" : "FAIL",
            fluxo: sonda.fluxo, bruto: j ? null : (r.stderr || r.stdout).trim(),
          }),
        ),
      );
    } else {
      const emitiuCadea = j !== null;
      const ok = r.rc === rcEsp && !emitiuCadea;
      const esperado = { rc: rcEsp, cadea: sonda.esperado.cadea ?? "ningunha", motivo: sonda.esperado.motivo };
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: sonda.id, capacidade: "KA4v", eixo: "decode",
            comando: cmd(args), rc: r.rc, rc_esperado: rcEsp,
            esperados: esperado,
            medidos: { rc: r.rc, cadea: emitiuCadea ? "emitida" : "ningunha" },
            divergencias: ok
              ? []
              : [
                  ...(r.rc === rcEsp ? [] : [{ campo: "rc", esperado: rcEsp, medido: r.rc }]),
                  ...(!emitiuCadea ? [] : [{ campo: "cadea", esperado: "ningunha", medido: "emitida" }]),
                ],
            categoria: ok ? "aplicavel" : "desconhecido", veredito: ok ? "PASS" : "FAIL",
            fluxo: sonda.fluxo, motivo: sonda.esperado.motivo,
            bruto: (r.stdout || r.stderr).trim(),
          }),
        ),
      );
    }
  }

  // ---- TAv: adulteracións con elo illado (R12) -----------------------------
  for (const receita of truth.tav) {
    const base = receita.base === "KA3v" ? baseKa3() : cadeaBase(receita.base, receita.acao.base_carga_sitio);
    if (!base.cadeia) {
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: receita.id, capacidade: "TAv", eixo: receita.eixo,
            categoria: "desconhecido", veredito: "INCONCLUSIVE",
            motivo: `a cadea base ${receita.base} non se construíu; a receita non puido ser executada`,
          }),
        ),
      );
      continue;
    }
    const { cadeia, imagem: imgMut } = aplicarReceita(receita, base.cadeia, imagem);
    const pImg = receita.alvo === "imagem" ? escribir(`${prefixo}-${receita.id}.bin`, imgMut) : caminhoImgRel;
    const pCad = escribir(`${prefixo}-${receita.id}.json`, `${JSON.stringify(cadeia)}\n`);
    const r = receita.alvo === "imagem" ? revalidar(pImg, pCad) : revalidar(caminhoImgRel, pCad);
    const informe = lerInforme(`${r.stdout}\n${r.stderr}`);
    const esc = pontuarR12({
      rc_aceitado: receita.esperado_rc_conxunto,
      rc_medido: r.rc,
      elo_aceitado: receita.elo_aceitado,
      fallos: informe.fallos,
    });
    linhas.push(
      linha(
        marcas({
          frente: "A", sha_frente: sha, fila: receita.id, capacidade: "TAv", eixo: receita.eixo,
          comando: cmd(argsRevalidar(receita.alvo === "imagem" ? pImg : caminhoImgRel, pCad)),
          mutacion: `${receita.acao.tipo} sobre ${receita.alvo}, base ${receita.base}`,
          rc: r.rc, rc_esperado: `un dos ${JSON.stringify(receita.esperado_rc_conxunto)}`,
          esperados: { rc: receita.esperado_rc_conxunto, elo: receita.elo_aceitado },
          medidos: { rc: r.rc, elos_en_falla: informe.fallos },
          divergencias:
            esc.veredito === "PASS"
              ? []
              : [{ campo: "rc|elo", esperado: `${JSON.stringify(receita.esperado_rc_conxunto)} c/elo illado ${receita.elo_aceitado}`, medido: `rc ${r.rc} elos ${JSON.stringify(informe.fallos)}` }],
          categoria: esc.categoria,
          veredito: esc.veredito, motivo: receita.motivo, desvio: esc.desvio,
          bruto: (r.stdout || r.stderr).trim(),
          artefactos: {
            imagem_sha256: sha256(imgMut),
            cadeia_sha256: sha256(Buffer.from(JSON.stringify(cadeia))),
            imaxe_orixinal_sha256: imagemSha,
          },
        }),
      ),
    );
    if (receita.id === "TA-2") {
      // Control non puntuado: a mesma mutación sen re-pin cae no elo identidade.
      const pCad = escribir(`${prefixo}-TA-2-sem-repin.json`, `${JSON.stringify(base.cadeia)}\n`);
      const r2 = revalidar(pImg, pCad);
      linhas.push(
        linha(
          marcas({
            frente: "A", sha_frente: sha, fila: "TA-2-control", capacidade: "TAv-controle",
            eixo: "identidade", comando: cmd(argsRevalidar(pImg, pCad)), rc: r2.rc, rc_esperado: null, esperados: {}, medidos: { rc: r2.rc },
            divergencias: [], categoria: "aplicavel", veredito: "CONTROLADO", pontua: false,
            motivo: "eixo identidade confunde a receita TA-2; queda como observación",
            bruto: (r2.stdout || r2.stderr).trim(),
          }),
        ),
      );
    }
  }

  const manifesto = {
    ferramenta: { bin, verbo: VERBO, sha256: shaFerramenta(chave) },
    sha_frente: sha,
    procedencia: verificarProcedencia(chave),
    conjunto,
    gabarito: GABARITO,
    contrato: CONTRATO,
    ventanxa: VENTANXA,
    denominador: truth.denominador,
    imagem: { arquivo: path.relative(RAIZ, caminhoImg), bytes: imagem.length, sha256: imagemSha },
    truth: {
      arquivo: path.relative(RAIZ, verdade),
      sha256: conjunto === "medicao" && !arquivoVerdade ? sha256Arquivo(path.join(dirFix, nomeTruth)) : "respostas reservadas fóra da árbore",
    },
    pin: pin ? { arquivo: NOME_PIN, sha256: sha256Arquivo(path.join(DIR_A, NOME_PIN)) } : null,
  };
  return { ausente: false, linhas, manifesto, bruto };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = (nome) =>
    process.argv.includes(nome) ? process.argv[process.argv.indexOf(nome) + 1] : null;
  const conjunto = argv("--conjunto") ?? "medicao";
  const chave = argv("--chave") ?? "A_corrixido";
  const r = adaptarA2({ chave, conjunto });
  if (r.ausente) {
    console.log(`[A v2] ferramenta ${chave} ausente: ${FERRAMENTAS[chave].bin} — non se mide, rexistrar bloqueio.`);
    process.exitCode = 3;
  } else {
    const nome = conjunto === "holdout" ? "A-holdout-v2.jsonl" : `A-${r.manifesto.sha_frente.slice(0, 7)}-v2.jsonl`;
    const desc = gravarEvidencia(nome, r.linhas, r.manifesto);
    const por = {};
    for (const l of r.linhas) por[l.veredito] = (por[l.veredito] ?? 0) + 1;
    console.log(`[A v2] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…) ${JSON.stringify(por)}`);
    const p = r.manifesto.procedencia;
    console.log(`[A v2] procedencia ${p.frente}@${p.sha.slice(0, 7)}: ${p.ok ? "OK" : "DIVERXENTE"} (${p.arquivos} ficheiros, ${p.divergentes.length} diverxentes, ${p.faltantes.length} faltantes)`);
    for (const l of r.linhas) {
      if (l.veredito !== "PASS") console.log(`  ${l.fila.padEnd(24)} ${l.veredito.padEnd(12)} rc=${l.rc} ${l.desvio ?? l.motivo ?? ""}`.slice(0, 220));
    }
  }
}
