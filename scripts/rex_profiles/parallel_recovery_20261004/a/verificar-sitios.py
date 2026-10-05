#!/usr/bin/env python3
"""Verificador do cruzamento paso 6 (letra A) — consume `rex-cfg/v1` como
ferramenta externa.

Cadea de A (JSONL `rex-kosinski-chain/v1`) → ventá [carga, fim da chamada]
→ `rex-cfg analyze` coas raíces e sitios derivados da cadea → comparación
coas predicións conxeladas en
`docs/rex_profiles/parallel_recovery_20261004/a/EXPECTATIONS-CRUZAMENTO-REXCFG-A.md`
§3/§4. Nada do decoder de C se copia nin se reimplementa aqui: só se le o
export.

Saída: unha liña `OK`/`FALLO` por aserción; rc=0 se todas cumpren, rc=1 se
algunha falla, rc=2 se a identidade do obxecto non bate (gate previo, §5).
"""
import hashlib
import json
import subprocess
import sys

BLOCO = "instrucao-de-bloco"
MIOLO = "miolo-de-instrucao"
FORA = "fora-da-regiao"


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 16), b""):
            h.update(b)
    return h.hexdigest()


def hexaddr(s):
    return int(s, 16) if isinstance(s, str) else s


def main(argv):
    cfg, jsonl, binimaxe, out = _args(argv)
    nome = jsonl.split("/")[-1].replace(".jsonl", "")
    fallos = 0

    def ass(nome_a, ok, detalle):
        nonlocal fallos
        if ok:
            print(f"OK   {nome} {nome_a}: {detalle}")
        else:
            print(f"FALLO {nome} {nome_a}: {detalle}")
            fallos += 1

    cadea = json.load(open(jsonl, encoding="utf-8"))
    # identidade do obxecto ANTES de consultar a ferramenta (§5)
    medido = sha(binimaxe)
    if medido != cadea["imaxe_sha256"]:
        print(
            f"ABORT-IDENTIDADE {nome}: obxecto {medido[:12]}… != cadea "
            f"{cadea['imaxe_sha256'][:12]}… (rexistrado sen analizar)"
        )
        return 2

    carga = hexaddr(cadea["carga_sitio"])
    chamada = hexaddr(cadea["chamada_sitio"])
    lon_ch = len(cadea["chamada_bytes"]) // 2
    lon_ca = len(cadea["carga_bytes"]) // 2
    dest = (
        None
        if cadea.get("destino_sitio") is None
        else (
            hexaddr(cadea["destino_sitio"]),
            len(cadea["destino_bytes"]) // 2,
        )
    )
    ini, fim = carga, chamada + lon_ch
    # contigüidade derivada da cadea (§2): se falla, a ventá non e validable
    if dest:
        ass(
            "contiguo",
            dest[0] == carga + lon_ca and chamada == dest[0] + dest[1],
            f"carga+{lon_ca}={carga + lon_ca:#07x} destino={dest[0]:#07x} "
            f"destino+{dest[1]}={dest[0] + dest[1]:#07x} chamada={chamada:#07x}",
        )
    else:
        ass("contiguo", chamada == carga + lon_ca, f"carga+{lon_ca} == chamada")

    sitios = [(carga, BLOCO), (carga + 2, MIOLO)]
    if dest:
        sitios += [(dest[0], BLOCO), (dest[0] + 2, MIOLO)]
    sitios += [(chamada, BLOCO), (chamada + 2, MIOLO)]
    rutina = hexaddr(cadea["rutina_sitio"])
    assert not (ini <= rutina < fim), "rutina dentro da ventá: non esperado"
    sitios.append((rutina, FORA))

    evid = f"rex-kosinski-chain/v1:{sha(jsonl)}"
    cmd = [
        cfg,
        "analyze",
        "--bin",
        binimaxe,
        "--region",
        f"0x{ini:06X}:0x{fim:06X}",
        "--root",
        f"0x{carga:06X}",
        "--root-prov",
        "referencia-estatica",
        "--root-evidence",
        evid,
        "--out",
        out,
    ]
    for end, _ in sitios:
        cmd += ["--site", f"0x{end:06X}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FALLO {nome} rex-cfg rc={r.returncode}: {r.stderr.strip()[:200]}")
        return 1
    exp = json.load(open(out, encoding="utf-8"))
    verd = {s["endereco"]: s["veredito"] for s in exp["sitios"]}
    for end, esperado in sitios:
        obtido = verd.get(end)
        ass(
            f"sitio {end:#07x}",
            obtido == esperado,
            f"esperado {esperado}, obtido {obtido}",
        )
    # §4 estruturais
    vaos = exp["cobertura"]["vaos"]
    ass("vaos-baleiros", vaos == [], f"vaos={vaos}")
    raiz = exp["raizes"][0] if exp["raizes"] else {}
    ass(
        "raiz",
        raiz.get("endereco") == carga
        and raiz.get("proveniencia") == "referencia-estatica"
        and raiz.get("evidencia") == evid,
        f"{raiz.get('endereco'):#07x} prov={raiz.get('proveniencia')} "
        f"evidencia={'si' if raiz.get('evidencia') == evid else raiz.get('evidencia')}",
    )
    fr = exp["fronteiras"]
    ass(
        "fronteira-unica",
        len(fr) == 1
        and fr[0]["endereco"] == chamada
        and fr[0]["tipo"] == "limite-de-regiao",
        f"fronteiras={[{k: f[k] for k in ('endereco', 'tipo')} for f in fr]}",
    )
    print(f"TOTAL {nome}: fallos={fallos}")
    return 0 if fallos == 0 else 1


def _args(argv):
    d = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            d[argv[i]] = argv[i + 1]
            i += 2
        else:
            i += 1
    return (
        d["--rex-cfg"],
        d["--jsonl"],
        d["--bin"],
        d.get("--out", "/tmp/cruzar-export.json"),
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
