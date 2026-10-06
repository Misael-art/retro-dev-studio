#!/usr/bin/env python3
"""ETAPA 3 §6 (E6-1): tabela de delta v1 -> v2 das amostras da ROM BYOR.

Uso:  python3 -I delta-v1-v2.py <rex-cfg-v2> <rom> <dir-saida> <dir-evidencia-v1> <saida-md> <saida-json>

Entrada v1: os redigidos VERSIONADOS (nao regenerados: sao o historico). Os
comandos sao lidos do campo `comando` de cada redigido, de modo que a v2 roda
exatamente a mesma pergunta. Saida: uma linha por sitio e por aresta com
`alvo` em v1 e v2 e UMA classe do dominio fechado de E6-1:

  invariante | alvo-corrigido | aresta-passa-fora-da-regiao | veredito-mudou |
  motivo-removedo

Nada aqui escreve na pasta de evidencia v1. Nao ha medicao de cobertura como
argumento (E6-2): a coluna de cobertura e apenas registrada.
"""
import hashlib, json, os, re, shlex, subprocess, sys

BIN, ROM, OUT, EV1, SAIDA_MD, SAIDA_JSON = sys.argv[1:7]
CLASSES = ("invariante", "alvo-corrigido", "aresta-passa-fora-da-regiao",
           "veredito-mudou", "motivo-removedo")
os.makedirs(OUT, exist_ok=True)


def argv_de(comando):
    # `<ROM>` e `<saida>` sao marcadores; --root-evidence nao influencia o grafo.
    toks = shlex.split(comando)
    out, i = [], 0
    while i < len(toks):
        if toks[i] == "--root-evidence":
            i += 2
            continue
        out.append(toks[i])
        i += 1
    return out


def rodar(nome, comando):
    toks = argv_de(comando)
    assert toks[:2] == ["rex-cfg", "analyze"], toks[:2]
    args = [BIN, "analyze", "--bin", ROM]
    k = 2
    while k < len(toks):
        if toks[k] == "--bin":
            k += 2
            continue
        if toks[k] == "--out":
            k += 2
            continue
        args.append(toks[k])
        k += 1
    saida = os.path.join(OUT, nome + ".json")
    args += ["--out", saida]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FALHA {nome}: {r.stderr}")
    return json.load(open(saida)), saida


def insn_map(j2):
    return {i["endereco"]: (i["tam"], i["classe"]) for b in j2["blocos"] for i in b["instrucoes"]}


def classe_aresta(v1, v2):
    """Classe de UMA aresta. v1/v2: dict da aresta ou None."""
    if v1 is None or v2 is None:
        return None
    if v1["alvo"] != v2["alvo"]:
        return "alvo-corrigido"
    if v1["status"] != v2["status"]:
        return ("aresta-passa-fora-da-regiao" if v2["status"] == "fora-da-regiao"
                else "veredito-mudou")
    return "invariante"


linhas, resumo = [], {}
total_cls = {c: 0 for c in CLASSES}
for nome in ("r1", "r2", "r3", "s1", "s2"):
    v1 = json.load(open(os.path.join(EV1, nome + ".redigido.json")))
    v2, caminho2 = rodar(nome, v1["comando"])
    # comprimento de cada instrucao (E6-4)
    i1 = {i["endereco"]: (i["tam"], i["classe"]) for i in v1["instrucoes"]}
    i2 = insn_map(v2)
    mesmos = i1 == i2
    resumo[nome] = {"instrucoes-v1": len(i1), "instrucoes-v2": len(i2),
                    "instrucoes-identicas": mesmos,
                    "cobertura-v1": v1["cobertura"]["bytes-decodificados"],
                    "cobertura-v2": v2["cobertura"]["bytes-decodificados"],
                    "sha256-v2-completo": hashlib.sha256(open(caminho2, "rb").read()).hexdigest()}
    # arestas indexadas por (origem, tipo, ordem)
    def idx(arestas):
        d, cont = {}, {}
        for a in arestas:
            k = (a["origem"], a["tipo"])
            n = cont.get(k, 0)
            cont[k] = n + 1
            d[(k, n)] = a
        return d
    a1, a2 = idx(v1["arestas"]), idx(v2["arestas"])
    for k in sorted(set(a1) | set(a2), key=lambda t: (t[0][0], t[0][1], t[1])):
        x, y = a1.get(k), a2.get(k)
        cls = classe_aresta(x, y)
        if cls is None:
            # aresta existe so de um lado: so pode ser consequencia de uma
            # instrucao que a v2 le diferente; nao e classe do dominio -> FALHA
            sys.exit(f"FALHA {nome}: aresta {k} so em {'v1' if y is None else 'v2'}: {x or y}")
        total_cls[cls] += 1
        linhas.append({"amostra": nome, "sitio": f"{k[0][0]:#x}", "tipo": k[0][1],
                       "v1-alvo": None if x["alvo"] is None else f"{x['alvo']:#x}",
                       "v2-alvo": None if y["alvo"] is None else f"{y['alvo']:#x}",
                       "v1-veredito": x["status"], "v2-veredito": y["status"],
                       "classe": cls})
    def endereco_de(s):
        return s["endereco"] if "endereco" in s else int(s["sitio"], 16)
    s1 = {endereco_de(s): s for s in v1["sitios"]}
    if "sitio" in next(iter(v1["sitios"])):
        # v1 desta amostra veio de `consultar` por sitio: v2 repete a pergunta
        # com o mesmo comando e compara os campos que existiam em v1.
        reg = v1["regiao"]
        ini, fim = reg["inicio"], reg["fim"]
        raiz = v1["raizes"][0]["endereco"]
        prov = v1["raizes"][0]["proveniencia"]
        s2 = {}
        for e in s1:
            sp = os.path.join(OUT, f"{nome}-sitio-{e:x}.json")
            r = subprocess.run([BIN, "consultar", "--bin", ROM, "--region", f"{ini:#x}:{fim:#x}",
                                "--root", f"{raiz:#x}", "--root-prov", prov,
                                "--site", f"{e:#x}", "--out", sp], capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f"FALHA {nome} consultar {e:#x}: {r.stderr}")
            s2[e] = json.load(open(sp))
    else:
        s2 = {s["endereco"]: s for s in v2["sitios"]}
    for e in sorted(set(s1) | set(s2)):
        x, y = s1.get(e), s2.get(e)
        if x is None or y is None:
            sys.exit(f"FALHA {nome}: sitio {e:#x} so de um lado")
        a1 = x.get("alvo")
        a2 = y.get("alvo")
        h = lambda v: int(v, 16) if isinstance(v, str) else v
        if x["veredito"] != y["veredito"] or x.get("consumidor-validado") != y.get("consumidor-validado", x.get("consumidor-validado")) \
                or x.get("promovivel-vinculo-estrutural") != y.get("promovivel-vinculo-estrutural", x.get("promovivel-vinculo-estrutural")):
            cls = "veredito-mudou"
        elif "alvo" in x and h(a1) != h(a2):
            cls = "alvo-corrigido"
        elif set(x.get("motivos", [])) - set(y.get("motivos", [])):
            cls = "motivo-removedo"
        else:
            cls = "invariante"
        total_cls[cls] += 1
        linhas.append({"amostra": nome, "sitio": f"{e:#x}", "tipo": "sitio",
                       "v1-alvo": None if a1 is None else f"{h(a1):#x}",
                       "v2-alvo": None if a2 is None else f"{h(a2):#x}",
                       "v1-veredito": x["veredito"], "v2-veredito": y["veredito"],
                       "classe": cls})

assert all(l["classe"] in CLASSES for l in linhas)
json.dump({"classes": total_cls, "amostras": resumo, "linhas": linhas},
          open(SAIDA_JSON, "w"), indent=1, sort_keys=True)
with open(SAIDA_MD, "w") as fh:
    fh.write("| amostra | sitio | tipo | v1-alvo | v2-alvo | v1-veredito | v2-veredito | classe |\n")
    fh.write("|---|---|---|---|---|---|---|---|\n")
    for l in linhas:
        fh.write("| " + " | ".join(str(l[c] if l[c] is not None else "-") for c in
                 ("amostra", "sitio", "tipo", "v1-alvo", "v2-alvo", "v1-veredito",
                  "v2-veredito", "classe")) + " |\n")
print(json.dumps({"classes": total_cls, "amostras": resumo}, indent=1, sort_keys=True))
