/**
 * Adaptador da frente B (`contrato_sonic.py` + `verificar-cadeia.py`) — executa as
 * ferramentas REAIS nos dois SHA do inventário datado (cffe17f e 396e0b8) e grava
 * uma linha por fila do denominador congelado em `EXTENSOES-D §4`
 * (KB1=4, KB2=2, KB3=4, KB4=2, NB=2 → 14 por SHA).
 *
 * Disciplina:
 *  - §4 KB3/KB4 prescrevem o *import* do módulo real de B e a chamada das suas
 *    funções com a entrada autoral de D; `drivers_b.py` só invoca e serializa o
 *    que B devolveu (valor ou `codigo` da sua `RecusaErro`). Nada preenche um
 *    resultado a partir do gabarito (R9).
 *  - Oráculo (R10): o descodificador Enigma pinado é espelho da família B, não
 *    segundo oráculo; KB1/KB2 graduam bytes da ROM BYOR lidos por D depois de
 *    verificado o SHA, e a `verificar_sitios` real de B é reexecutada sobre a
 *    expectativa de D (R8).
 *  - ROM ausente ou SHA divergente ⇒ linhas `desconhecido` com motivo,
 *    denominador preservado (§4).
 *  - O `--out` de B é confinado à árvore dele; o adaptador copia a evidência para
 *    o scratch de D e apaga o ficheiro que escreveu nessa árvore.
 *
 * Uso:
 *   node scripts/.../d/medida/adapt_b.mjs [--sha B|B_velho]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BYOR,
  FERRAMENTAS,
  FIXTURES,
  RAIZ,
  SCRATCH,
  addr,
  executar,
  garantir,
  gravarEvidencia,
  linha,
  sha256,
  sha256Arquivo,
  shaFerramenta,
  presente,
  verificarProcedencia,
} from "./ferramentas.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DRIVER = path.join(AQUI, "drivers_b.py");
const DIR_FIX = path.join(FIXTURES, "b");
const PYTHON = "python3";

/** Receita congelada → parâmetros da chamada real (nunca o contrário). */
function parsearAcao(texto) {
  const m = /^(\w+)\((.*)\)$/.exec(texto.trim());
  if (!m) return null;
  const fn = m[1];
  const kwargs = {};
  for (const kv of m[2].split(",").map((x) => x.trim())) {
    const p = /^(\w+)=(\d+)$/.exec(kv);
    if (p) kwargs[p[1]] = Number(p[2]);
  }
  return { fn, kwargs };
}

/** `esperado_bytes` pode ser escalar ou lista (fila de contadores). */
const listas = (v) => (Array.isArray(v) ? v : [v]);

export function adaptarB(chave)
  {
  const f = FERRAMENTAS[chave];
  const shaFrente = f.sha;
  const tag = shaFrente.slice(0, 7);
  const OUT = garantir(path.join(SCRATCH, `b-${tag}`));
  const linhas = [];
  const brutos = [];

  const base = (extra) => ({
    frente: "B",
    sha_frente: shaFrente,
    ...extra,
  });

  // ---------------------------------------------------------- entrada autoral
  const t = JSON.parse(fs.readFileSync(path.join(DIR_FIX, "dB-truth-v1.json"), "utf8"));
  const grid = path.join(DIR_FIX, "dB-grid-v1.bin");

  // ------------------------------------------------------------- ROM BYOR
  const temRom = fs.existsSync(BYOR.rom);
  const rom = temRom ? fs.readFileSync(BYOR.rom) : null;
  const shaRom = temRom ? sha256(rom) : null;
  const romOk = temRom && shaRom === BYOR.rom_sha256 && rom.length === BYOR.rom_size;

  // Cópia adulterada: 1 byte virado dentro do sítio KB1 da chamada (0x1B6D2).
  const romFlipPath = path.join(OUT, "rom-1-byte-virado.bin");
  if (romOk) {
    const mut = Buffer.from(rom);
    mut[0x1b6d2] ^= 0x01;
    fs.writeFileSync(romFlipPath, mut);
  }

  // ------------------------------------------------------- driver (funções reais)
  const accoes = [
    { id: "config", tipo: "alegacao_sitio", endereco: 0x1b64c },
  ];
  for (const row of [...t.kb1, ...t.kb2]) {
    if (row.esperado_words !== undefined) continue;
    for (const [i, end] of listas(row.endereco).entries()) {
      accoes.push({ id: `${row.id}-aleg-${i}`, tipo: "alegacao_sitio", endereco: end });
    }
  }
  accoes.push({
    id: "verif-kb12",
    tipo: "verificar_sitios",
    sitios: [...t.kb1, ...t.kb2]
      .filter((r) => r.esperado_bytes !== undefined)
      .flatMap((r) => listas(r.endereco).map((end, i) => ({ endereco: end, hexbytes: listas(r.esperado_bytes)[i] }))),
  });
  accoes.push({
    id: "verif-flip",
    tipo: "verificar_sitios",
    rom: romOk ? romFlipPath : BYOR.rom,
    sitios: t.kb1
      .flatMap((r) => listas(r.endereco).map((end, i) => ({ endereco: end, hexbytes: listas(r.esperado_bytes)[i] }))),
  });
  for (const row of t.kb3) {
    const a = parsearAcao(row.acao);
    if (!a) continue;
    accoes.push({
      id: row.id,
      tipo: a.fn === "layout_de_plain" ? "layout" : "projetar",
      plain: grid,
      ...a.kwargs,
    });
  }
  for (const row of t.kb4) {
    accoes.push(
      /padding/.test(row.acao)
        ? { id: row.id, tipo: "padding_sujo", plain: grid, linha: 0, valor: 0x01 }
        : { id: row.id, tipo: "roundtrip", plain: grid },
    );
  }

  const payloadPath = path.join(OUT, "payload-funcoes.json");
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({ arvore: f.arvore, rom: BYOR.rom, acoes: accoes }, null, 2),
  );
  const drv = executar(PYTHON, [DRIVER, payloadPath], { cwd: RAIZ, timeout: 300_000 });
  const drvJson = drv.rc === 0 ? JSON.parse(drv.stdout) : null;
  const comandoDriver = ["python3", DRIVER, path.relative(RAIZ, payloadPath)].join(" ");
  brutos.push({
    nome: `driver-funcoes-${tag}`,
    rc: drv.rc,
    resumo: ((drv.stdout || "") + (drv.stderr || "")).trim().slice(0, 300),
    comando: comandoDriver,
  });

  const AC = drvJson?.acoes ?? {};
  const CFG = drvJson?.config ?? null;

  const semDependencia = (fila, capacidade, eixo, esperado, motivo) => {
    linhas.push(
      linha({
        ...base({ fila, capacidade, eixo, comando: comandoDriver, rc: drv.rc }),
        categoria: "desconhecido",
        veredito: "INCONCLUSIVE",
        esperados: esperado,
        medidos: { rom_presente: temRom, rom_sha_ok: romOk, driver_rc: drv.rc },
        motivo,
      }),
    );
  };

  // ------------------------------------------------------------------ KB1 (4)
  for (const row of t.kb1) {
    if (!romOk) {
      semDependencia(row.id, "KB1", "consumidor", { bytes: row.esperado_bytes },
        `ROM BYOR ${romOk ? "ok" : "ausente ou SHA divergente"} — a sonda byte a byte do dominio KB1 non se executou; denominador preservado (§4)`);
      continue;
    }
    const ends = listas(row.endereco);
    const expBytes = listas(row.esperado_bytes);
    const divs = [];
    const medidos = { enderecos: ends.map(addr), rom_lido: [], alegacao_b: [], verificador_b: [] };
    ends.forEach((e, i) => {
      // D recorta a ROM co comprimento da expectativa conxelada.
      const observado = rom.subarray(e, e + expBytes[i].length / 2).toString("hex");
      medidos.rom_lido.push(observado);
      if (observado !== expBytes[i]) divs.push({ campo: `bytes@${addr(e)}`, esperado: expBytes[i], medido: observado });
      const aleg = AC[`${row.id}-aleg-${i}`]?.alegacao_B ?? [];
      medidos.alegacao_b.push(aleg.length ? aleg[0][1] : null);
      medidos.verificador_b.push((AC["verif-kb12"]?.divergentes ?? []).some((d) => d.offset === `0x${e.toString(16)}`) ? "diverxencia" : "conforme");
    });
    // O verificador real de B ten de concordar co que a ROM di (R8: reexecución).
    for (const [i, e] of ends.entries()) {
      if (medidos.verificador_b[i] === "diverxencia")
        divs.push({ campo: `verificador_b@${addr(e)}`, esperado: "conforme", medido: `B diverxe aínda que a ROM confirma ${medidos.rom_lido[i]}` });
    }
    linhas.push(
      linha({
        ...base({ fila: row.id, capacidade: "KB1", eixo: "consumidor", comando: comandoDriver, rc: drv.rc }),
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: { bytes: row.esperado_bytes, fonte: row.fonte },
        medidos,
        divergencias: divs,
        oraculo: "bytes da ROM BYOR pinada lidos por D (non o doc de B); verificar_sitios real de B reexecutado",
        motivo: divs.length ? "" : "sonda de D + verificador real de B concordan contra a ROM",
      }),
    );
  }

  // ------------------------------------------------------------------ KB2 (2)
  for (const row of t.kb2) {
    if (!romOk) {
      semDependencia(row.id, "KB2", "parámetro", { bytes: row.esperado_bytes ?? row.esperado_words },
        "ROM BYOR ausente ou SHA divergente — parámetros do dominio KB2 non medidos");
      continue;
    }
    const divs = [];
    let medidos;
    if (row.esperado_words !== undefined) {
      const words = [];
      for (let i = 0; i < row.entradas; i += 1) {
        const off = row.endereco + i * 4;
        words.push(rom.readUInt32BE(off));
      }
      medidos = { words_rom: words, streams_de_b: CFG?.streams ?? null };
      words.forEach((w, i) => {
        if (w !== row.esperado_words[i]) divs.push({ campo: `palabra_${i}`, esperado: row.esperado_words[i], medido: w });
      });
      const bStreams = (CFG?.streams ?? []).map((s) => parseInt(s, 16));
      if (bStreams.join(",") !== words.join(","))
        divs.push({ campo: "streams_do_contrato", esperado: words, medido: bStreams });
    } else {
      const e = row.endereco;
      const observado = rom.subarray(e, e + row.esperado_bytes.length / 2).toString("hex");
      medidos = { rom_lido: observado, alegacao_b: AC[`${row.id}-aleg-0`]?.alegacao_B?.[0]?.[1] ?? null };
      if (observado !== row.esperado_bytes)
        divs.push({ campo: "bytes", esperado: row.esperado_bytes, medido: observado });
    }
    linhas.push(
      linha({
        ...base({ fila: row.id, capacidade: "KB2", eixo: "parámetro", comando: comandoDriver, rc: drv.rc }),
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: { bytes: row.esperado_bytes ?? null, words: row.esperado_words ?? null },
        medidos,
        divergencias: divs,
        oraculo: row.esperado_words !== undefined ? "6 palabras longas big-endian lidas por D na ROM pinada" : row.fonte,
        motivo: divs.length ? "" : "igualdade exacta contra a ROM; alegación de B (config do módulo real) coincide",
      }),
    );
  }

  // ------------------------------------------------------------------ KB3 (4)
  for (const row of t.kb3) {
    const r = AC[row.id];
    if (!r) {
      semDependencia(row.id, "KB3", "grade", { esperado: row.esperado ?? row.esperado_codigo },
        `driver non devolveu a acción ${row.id} (rc ${drv.rc})`);
      continue;
    }
    const divs = [];
    const medidos = {
      recusado: r.recusado,
      codigo: r.codigo ?? null,
      valor: r.recusado ? null : r.valor,
      excecao: r.excecao ?? null,
    };
    if (row.esperado === "aceito") {
      if (r.recusado) divs.push({ campo: "aceite", esperado: "aceito", medido: `recusa ${r.codigo}` });
      else if (r.valor?.linhas !== 64 || r.valor?.colunas !== 64)
        divs.push({ campo: "forma", esperado: "64x64", medido: `${r.valor?.linhas}x${r.valor?.colunas}` });
    } else {
      if (!r.recusado) divs.push({ campo: "recusa", esperado: row.esperado_codigo, medido: "aceitou — sonda frouxa" });
      else if (r.codigo !== row.esperado_codigo)
        divs.push({ campo: "codigo", esperado: row.esperado_codigo, medido: r.codigo });
    }
    linhas.push(
      linha({
        ...base({ fila: row.id, capacidade: "KB3", eixo: "grade", comando: comandoDriver, rc: drv.rc }),
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: { acao: row.acao, esperado: row.esperado ?? row.esperado_codigo },
        medidos,
        divergencias: divs,
        motivo: divs.length ? "" : "função real de B executada sobre a grade autoral de D",
      }),
    );
  }

  // ------------------------------------------------------------------ KB4 (2)
  for (const row of t.kb4) {
    const r = AC[row.id];
    if (!r) {
      semDependencia(row.id, "KB4", "projeção", { esperado: row.esperado ?? row.esperado_codigo },
        `driver non devolveu a acción ${row.id} (rc ${drv.rc})`);
      continue;
    }
    const divs = [];
    let medidos;
    if (r.projecao_sha256 !== undefined) {
      medidos = {
        projecao_sha256: r.projecao_sha256,
        projecao_esperada_sha256: t.projecao.sha256,
        tamanho_buffer: r.projecao_tam,
        inverso_identico: r.identico_ao_plain,
        celulas: r.celulas_discriminantes,
      };
      if (r.projecao_sha256 !== t.projecao.sha256)
        divs.push({ campo: "projecao_sha256", esperado: t.projecao.sha256, medido: r.projecao_sha256 });
      if (!r.identico_ao_plain) divs.push({ campo: "round_trip", esperado: true, medido: false });
      // A aritmética $FF1020 + r*128 + c ten de aparecer nas 4 células discriminantes.
      for (const cel of t.celulas_discriminantes) {
        const chave = `r${cel.r}c${cel.c}`;
        if (r.celulas_discriminantes?.[chave] !== cel.valor)
          divs.push({ campo: `celula_${chave}`, esperado: cel.valor, medido: r.celulas_discriminantes?.[chave] });
      }
      if (/^0+$/.test(r.celulas_discriminantes?.padding_r0 ?? "x") === false)
        divs.push({ campo: "padding_linha0", esperado: "todo 0", medido: "padding non cero" });
    } else {
      medidos = { recusado: r.recusado, codigo: r.codigo ?? null, mensagem: r.mensagem, buffer_sha256: r.buffer_sha256 };
      if (!r.recusado) divs.push({ campo: "recusa", esperado: row.esperado_codigo, medido: "inverso aceptou padding sujo" });
      else if (r.codigo !== row.esperado_codigo)
        divs.push({ campo: "codigo", esperado: row.esperado_codigo, medido: r.codigo });
    }
    linhas.push(
      linha({
        ...base({ fila: row.id, capacidade: "KB4", eixo: "projeção", comando: comandoDriver, rc: drv.rc }),
        categoria: divs.length ? "falha" : "aplicavel",
        veredito: divs.length ? "FAIL" : "PASS",
        esperados: { acao: row.acao, esperado: row.esperado ?? row.esperado_codigo },
        medidos,
        divergencias: divs,
        motivo: divs.length ? "" : "proxección/inversa real de B contra a fixture asimétrica de D (SHA e 4 células)",
      }),
    );
  }

  // ------------------------------------------------------------------- NB (2)
  const executarCadeia = (nome, modo, romPath) => {
    const dentro = path.join(f.arvore, `out-d-${tag}-${nome}.json`);
    if (fs.existsSync(dentro)) fs.rmSync(dentro);
    const args = [f.cli, "cadeia", "--rom", romPath, "--decoder", BYOR.decoder, "--out", dentro, "--modo", modo];
    const r = executar(PYTHON, args, { cwd: RAIZ, timeout: 600_000 });
    let copia = null;
    if (fs.existsSync(dentro)) {
      copia = path.join(OUT, `${nome}.json`);
      fs.copyFileSync(dentro, copia);
      fs.rmSync(dentro); // a árbore materializada de B queda limpa
    }
    const doc = copia ? JSON.parse(fs.readFileSync(copia, "utf8")) : null;
    brutos.push({ nome: `${nome}-${tag}`, rc: r.rc, resumo: ((r.stdout || "") + (r.stderr || "")).trim().slice(0, 300), comando: args.join(" ") });
    return { ...r, doc, exportLido: copia, args };
  };

  if (!romOk) {
    for (const row of t.nb) {
      semDependencia(row.id, "NB", "negativo", { esperado: row.esperado }, "ROM BYOR ausente ou SHA divergente — CLI de B non executado");
    }
  } else {
    const row1 = t.nb.find((r) => r.id === "NB-1");
    const r1 = executarCadeia("NB-1", "hipotetico", BYOR.rom);
    const veredito1 = r1.doc?.veredito ?? null;
    const divs1 = [];
    if (r1.rc !== 0) divs1.push({ campo: "rc", esperado: 0, medido: r1.rc });
    if (!veredito1 || !/HIPOTETICO/.test(veredito1)) divs1.push({ campo: "rotulo", esperado: "HIPOTETICO", medido: veredito1 });
    if (veredito1 && /PROMOVIDO/.test(veredito1)) divs1.push({ campo: "promocao", esperado: "non promover", medido: veredito1 });
    if (r1.doc?.modo !== "hipotetico") divs1.push({ campo: "modo_no_export", esperado: "hipotetico", medido: r1.doc?.modo ?? null });
    linhas.push(
      linha({
        ...base({ fila: "NB-1", capacidade: "NB", eixo: "confiança", comando: r1.args.join(" "), rc: r1.rc }),
        categoria: divs1.length ? "falha" : "aplicavel",
        veredito: divs1.length ? "FAIL" : "PASS",
        esperados: { acao: row1?.acao, esperado: row1?.esperado },
        medidos: { veredito: veredito1, modo: r1.doc?.modo ?? null, stdout: (r1.stdout || "").trim().slice(0, 200) },
        divergencias: divs1,
        motivo: divs1.length ? "" : "rótulo HIPOTETICO no export real; nenhuma promoción",
      }),
    );

    const row2 = t.nb.find((r) => r.id === "NB-2");
    const r2 = executarCadeia("NB-2", "verificado", romFlipPath);
    const shaFlip = sha256Arquivo(romFlipPath);
    const divs2 = [];
    const recusou = (r2.stderr || "").includes("rom-errada");
    if (r2.rc === 0) divs2.push({ campo: "rc", esperado: "!= 0", medido: 0 });
    if (!recusou) divs2.push({ campo: "recusa", esperado: "rom-errada", medido: (r2.stderr || r2.stdout || "").trim().slice(0, 160) });
    if (r2.exportLido) divs2.push({ campo: "evidencia_escrita", esperado: false, medido: true });
    if (shaFlip === BYOR.rom_sha256) divs2.push({ campo: "auditoria_da_proba", esperado: "SHA do --bin ≠ pin", medido: shaFlip });
    linhas.push(
      linha({
        ...base({ fila: "NB-2", capacidade: "NB", eixo: "identidade", comando: r2.args.join(" "), rc: r2.rc }),
        categoria: divs2.length ? "falha" : "aplicavel",
        veredito: divs2.length ? "FAIL" : "PASS",
        esperados: { acao: row2?.acao, esperado: row2?.esperado, rc_esperado: "recusa antes de promover" },
        medidos: {
          rc: r2.rc,
          stderr: (r2.stderr || "").trim().slice(0, 200),
          evidencia_escrita: Boolean(r2.exportLido),
          sha_bin_lido_por_d: shaFlip,
          pin_de_b: BYOR.rom_sha256,
        },
        divergencias: divs2,
        proba_auditada: `D recompoñe o SHA do --bin adulterado (${shaFlip.slice(0, 12)}…) e el; a recusa de B corresponde ao feito, non só ao texto`,
        motivo: divs2.length ? "" : "recusa rom-errada observada por reexecución, con auditoría da proba anexa",
      }),
    );

    // ---------------------------- controles non puntuados (requisito 9 e R10)
    const pins = r1.doc?.pins ?? {};
    linhas.push(
      linha({
        ...base({ fila: "CONTROLE-IDENTIDADE-B", capacidade: "audit", eixo: "identidade", comando: r1.args.join(" "), rc: r1.rc }),
        categoria: "aplicavel",
        veredito: pins.rom_sha256 === shaRom && pins.decoder_sha256 === BYOR.decoder_sha256 ? "CONTROLADO" : "INCOHERENTE",
        pontua: false,
        esperados: { rom_sha256: shaRom, decoder_sha256: BYOR.decoder_sha256 },
        medidos: { rom_no_export: pins.rom_sha256 ?? null, decoder_no_export: pins.decoder_sha256 ?? null, rom_size_no_export: pins.rom_size ?? null },
        motivo: "a proba anexa de B é auditada recompoñendo D o digest da ROM e do descodificador que realmente se pasaron",
      }),
      linha({
        ...base({ fila: "CONTROLE-SONDA-VIVA-B", capacidade: "audit", eixo: "sítio", comando: comandoDriver, rc: drv.rc }),
        categoria: "aplicavel",
        veredito: (AC["verif-flip"]?.divergentes ?? []).length > 0 ? "CONTROLADO" : "INCOHERENTE",
        pontua: false,
        esperados: { nota: "co a ROM adulterada, o verificador real de B ten de diverxir" },
        medidos: {
          diverxencias: (AC["verif-flip"]?.divergentes ?? []).map((d) => `${d.offset}:${d.papel}`),
          rom_sha_lido: AC["verif-flip"]?.rom_sha256_lido ?? null,
        },
        motivo: "control que demonstra que as filas KB1 non son vacuas: a mesma sonda cega ante a mutación sería unha sona morta",
      }),
      linha({
        ...base({ fila: "CONTROLE-ESPELLO-B", capacidade: "audit", eixo: "oráculo", comando: comandoDriver, rc: drv.rc }),
        categoria: "nao-aplicavel",
        veredito: "CONTROLADO",
        pontua: false,
        esperados: { nota: "R10: descodificador pinado = familia B, non segundo oráculo" },
        medidos: {
          decoder_sha: BYOR.decoder_sha256,
          pin_nomodulo: CFG?.decoder_sha256 ?? null,
          concordancia: CFG?.decoder_sha256 === BYOR.decoder_sha256,
        },
        motivo: "ningunha fila de B conta a concordancia autor+espello como validación; o oráculo é a ROM",
      }),
      linha({
        ...base({ fila: "CONTROLE-JSON-TAMPER-B", capacidade: "TC", eixo: "confiança", comando: null, rc: null }),
        categoria: "nao-aplicavel",
        veredito: "NÃO APLICÁVEL",
        pontua: false,
        esperados: { receita: "§6: 1 byte virado no JSON de evidência ⇒ non promove" },
        medidos: { superficies_reais: ["cadeia", "negativos", "fixture", ...(chave === "B" ? ["controles"] : [])] },
        motivo:
          "a ferramenta real non consume evidencia JSON como entrada (o `--out` só escribe); a receita de §6 non é alcanzable. " +
          "O eixo de identidade medírase en NB-2 coa ROM adulterada, que é a entrada que B si valida.",
      }),
    );
  }

  const manifesto = {
    frente: "B",
    sha_frente: shaFrente,
    chave: tag,
    ferramenta: { cli: f.cli, contrato: f.contrato, sha256_cli: shaFerramenta(chave), sha256_contrato: sha256Arquivo(f.contrato) },
    procedencia: verificarProcedencia(chave),
    rom: { caminho: BYOR.rom, presente: temRom, sha256_lido_por_d: shaRom, pin: BYOR.rom_sha256, ok: romOk },
    fixtures: ["dB-grid-v1.bin", "dB-projecao-v1.bin", "dB-truth-v1.json"].map((n) => ({
      arquivo: path.relative(RAIZ, path.join(DIR_FIX, n)),
      sha256: sha256Arquivo(path.join(DIR_FIX, n)),
    })),
    denominador: t.denominador,
  };
  return { linhas, manifesto, brutos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const alvo = process.argv.includes("--sha") ? process.argv[process.argv.indexOf("--sha") + 1] : null;
  const chaves = alvo ? [alvo] : ["B", "B_velho"];
  for (const chave of chaves) {
    if (!presente(chave)) {
      console.log(`[B] FERRAMENTA AUSENTE en ${FERRAMENTAS[chave].cli} — medição non executada`);
      process.exitCode = 3;
      continue;
    }
    const r = adaptarB(chave);
    const desc = gravarEvidencia(`B-${r.manifesto.sha_frente.slice(0, 7)}.jsonl`, r.linhas, r.manifesto);
    garantir(path.join(SCRATCH, `b-${r.manifesto.chave}`));
    fs.writeFileSync(path.join(SCRATCH, `b-${r.manifesto.chave}`, "brutos.json"), JSON.stringify(r.brutos, null, 2) + "\n");
    console.log(`[B ${r.manifesto.chave}] ${desc.linhas} linhas → ${desc.arquivo} (sha ${desc.sha256.slice(0, 12)}…)`);
    for (const l of r.linhas) {
      if (l.pontua) console.log(`  ${l.fila.padEnd(22)} ${String(l.veredito).padEnd(5)} ${l.categoria.padEnd(14)} ${l.divergencias.length ? JSON.stringify(l.divergencias[0]).slice(0, 150) : ""}`);
    }
    console.log(`  (controles non puntuados: ${r.linhas.filter((l) => !l.pontua).length}; filas do denominador: ${r.linhas.filter((l) => l.pontua).length})`);
  }
}
