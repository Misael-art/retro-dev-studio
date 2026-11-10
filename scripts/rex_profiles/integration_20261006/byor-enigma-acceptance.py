#!/usr/bin/env python3
"""Aceite BYOR (real) do decode Enigma: produto x oraculo externo pinado, BYTE A BYTE.

NAO e teste ordinario do CI: precisa da ROM do operador. ROM ausente => veredito
AUSENTE e exit 3 (nunca PASS). Nada derivado da ROM entra no repo: os binarios das
saidas ficam em --work (fora do Git); o relatorio guarda so SHA-256 e contas.

O oraculo externo (enigma_research.py, SHA pinado) e RESEARCH ONLY: e executado, jamais
copiado. O produto e o exemplo `decode_stream` do crate crates/rex-enigma.
"""
import argparse, hashlib, importlib.util, json, os, subprocess, sys, time

ROM_SHA = "c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb"
ORACULO_SHA = "a9ed92f96fbdd7e0828e7612e83eff24c65aee52fd5a82efee53581dc1a7f8b2"
STREAMS = [  # offset, bytes_lidos, padding, armazenado
    (0x65432, 634, 0, 634), (0x656AC, 1042, 0, 1042), (0x65ABE, 860, 0, 860),
    (0x65E1A, 1242, 0, 1242), (0x662F4, 1233, 1, 1234), (0x667C6, 784, 0, 784),
]


def sha(b): return hashlib.sha256(b).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rom", default=os.environ.get("REX_SONIC_ROM", ""))
    ap.add_argument("--oraculo", required=True, help="caminho do enigma_research.py")
    ap.add_argument("--crate", default="crates/rex-enigma")
    ap.add_argument("--work", required=True, help="diretorio FORA do Git para as saidas")
    ap.add_argument("--out", required=True, help="relatorio JSON (so hashes)")
    a = ap.parse_args()
    rel = {"schema": "rex-enigma-byor/v1", "tempo_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if not a.rom or not os.path.isfile(a.rom):
        rel.update(veredito="AUSENTE", motivo="ROM BYOR ausente: nada foi decodificado")
        json.dump(rel, open(a.out, "w"), indent=1)
        print("AUSENTE (nao e PASS)"); return 3
    rom = open(a.rom, "rb").read()
    if sha(rom) != ROM_SHA:
        rel.update(veredito="INCOMPATIVEL", motivo="ROM nao e a pinada", rom_sha256=sha(rom))
        json.dump(rel, open(a.out, "w"), indent=1)
        print("INCOMPATIVEL"); return 4
    orc_bytes = open(a.oraculo, "rb").read()
    if sha(orc_bytes) != ORACULO_SHA:
        print("oraculo com SHA diferente do pin"); return 5
    spec = importlib.util.spec_from_file_location("enigma_research", a.oraculo)
    orc = importlib.util.module_from_spec(spec); spec.loader.exec_module(orc)
    os.makedirs(a.work, exist_ok=True)
    subprocess.run(["cargo", "build", "--release", "--locked", "--example", "decode_stream",
                    "--manifest-path", os.path.join(a.crate, "Cargo.toml")], check=True)
    exe = os.path.join(a.crate, "target", "release", "examples", "decode_stream")
    casos, ok_all = [], True
    for i, (off, lidos, pad, arm) in enumerate(STREAMS):
        saida = os.path.join(a.work, f"layout{i}.bin")
        r = subprocess.run([exe, a.rom, hex(off), saida], capture_output=True, text=True)
        kv = dict(l.split("=", 1) for l in r.stdout.split())
        produto = open(saida, "rb").read() if r.returncode == 0 else b""
        # oraculo externo: decode do mesmo stream, bytes completos
        res = orc.decode(rom[off:off + 8192])
        ref, consumo_ref = bytes(res[0]), int(res[1])
        c = {
            "indice": i, "offset": hex(off),
            "bytes_iguais": produto == ref and len(produto) == 4096,
            "produto_sha256": sha(produto), "oraculo_sha256": sha(ref),
            "saida_bytes": len(produto),
            "bytes_lidos": int(kv.get("bytes_lidos", -1)),
            "padding_alinhamento": int(kv.get("padding_alinhamento", -1)),
            "bytes_armazenados": int(kv.get("bytes_armazenados", -1)),
            "consumo_confere_congelado": (int(kv.get("bytes_lidos", -1)), int(kv.get("padding_alinhamento", -1)),
                                          int(kv.get("bytes_armazenados", -1))) == (lidos, pad, arm),
            "consumo_oraculo": consumo_ref,
        }
        c["consumo_igual_ao_oraculo"] = c["bytes_lidos"] == consumo_ref
        c["ok"] = c["bytes_iguais"] and c["consumo_confere_congelado"] and c["consumo_igual_ao_oraculo"]
        ok_all &= c["ok"]
        casos.append(c)
    rel.update(rom_sha256=ROM_SHA, oraculo_sha256=ORACULO_SHA, casos=casos,
               veredito="PASS" if ok_all else "FAIL",
               nota="decode calculado nesta execucao; oraculo externo e RESEARCH ONLY, nao incorporado; "
                    "nada de runtime do jogo foi observado")
    json.dump(rel, open(a.out, "w"), indent=1)
    print(rel["veredito"]); return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
