#!/usr/bin/env python3
"""Fixa TODAS as codificacoes dos SITIOS do contrato contra o toolchain m68k.

Para cada sitio:
  * dados (tabela/marca): diretiva .ascii/.long remontada e comparada byte a byte;
  * instrucao simples: snippet `.org offsetreal + mnemonico` -> objcopy -> bytes;
  * ramificacao (dbf): bloco contiguo do alvo ate o dbf, com LABEL (o gas nao
    aceita endereco absoluto como alvo de dbf na 68000);
  * (d8,PC,Xi): o gas nao dobra endereco absoluto em disp8 para pc indexado,
    entao o pino usa o disp literal -122 e a prova do vinculo 0x1B6C6-122 =
    0x1B64C fica registrada como aritmetica no JSON.

Tambem roda a passada inversa (bytes -> m68k-elf-objdump -d) e grava o
mnemonico que o DESMONTADOR do toolchain produz — evidencia de que a leitura
humana nao e livre.

Nao le a ROM: os bytes pinados vem de SITIOS (contrato_sonic.py), ja
conferidos byte a byte contra a ROM pelo CLI verificar-cadeia.py. Assim o
JSON de pin ISA e reproduzivel sem corpus.

Uso:
  python3 scripts/rex_profiles/parallel_recovery_20261004/b/montar-isa.py \
      --out data/rex_profiles/parallel_recovery_20261004/b/evidencia/isa-forms-b.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import contrato_sonic as CS  # noqa: E402

TOOLCHAIN = pathlib.Path(
    "/home/misael/.cache/retrodevstudio/"
    "6b5d81135a1161447e4cbb49401f1137dd7d93974eee82d3153f5e87e7afd779/"
    "toolchains/m68k-elf/bin")
AS = TOOLCHAIN / "m68k-elf-as"
OBJDUMP = TOOLCHAIN / "m68k-elf-objdump"
OBJCOPY = TOOLCHAIN / "m68k-elf-objcopy"
AS_SHA = "20342db5ac551cbb7a17a86f78ee5d58bb90ab2e3fc6f0231298f0f1ebc5af0d"
OBJDUMP_SHA = "f7d636421bffcf2254cf2024794fbaefd25c9e36086f18ec250fa72cab6e8113"

# sítios de dados: hexbytes -> diretiva
def directive(offset, hexbytes):
    if offset == 0x1B646:
        return f'.ascii "KLMN"', "dados"
    valor = int(hexbytes, 16)
    return f".long 0x{valor:x}", "dados"


# snippets: (nome, .org inicial, linhas, [offsets verificados no bloco])
def build_snippets():
    snips = []
    for offset, hexbytes, desc, papel in CS.SITIOS:
        if papel == "tabela" or offset == 0x1B646:
            d, _ = directive(offset, hexbytes)
            snips.append((f"dados-{offset:x}", offset, [d], [offset]))
        elif offset == 0x1B6B6:
            snips.append(("lsl", offset, ["lsl.w #2,%d0"], [offset]))
        elif offset == 0x1B6C4:
            snips.append(("pc-indexado", offset,
                          ["movea.l (-122,%pc,%d0.w),%a0"], [offset]))
        elif offset == 0x1B6C8:
            snips.append(("lea-ff4000", offset, ["lea (0xff4000).l,%a1"], [offset]))
        elif offset == 0x1B6CE:
            snips.append(("movew-0", offset, ["move.w #0,%d0"], [offset]))
        elif offset == 0x1B6D2:
            snips.append(("jsr-enidec", offset, ["jsr (0x171e).l"], [offset]))
        elif offset == 0x1B6D8:
            snips.append(("lea-ff0000", offset, ["lea (0xff0000).l,%a1"], [offset]))
        elif offset == 0x1B6DE:
            snips.append(("movew-0fff", offset, ["move.w #0xfff,%d0"], [offset]))
        elif offset == 0x1B6E2:
            snips.append(("bloco-limpar", 0x1B6E2,
                          ["LB1:", "clr.l (%a1)+", "dbf %d0,LB1"], [0x1B6E2, 0x1B6E4]))
        elif offset == 0x1B6E4:
            pass  # coberto pelo bloco
        elif offset == 0x1B6E8:
            snips.append(("lea-ff1020", offset, ["lea (0xff1020).l,%a1"], [offset]))
        elif offset == 0x1B6EE:
            snips.append(("lea-ff4000-a0", offset, ["lea (0xff4000).l,%a0"], [offset]))
        elif offset == 0x1B6F4:
            snips.append(("bloco-copia-linhas", 0x1B6F4,
                          ["moveq #63,%d1",
                           "LA:", "moveq #63,%d2",
                           "LB:", "move.b (%a0)+,(%a1)+",
                           "dbf %d2,LB",
                           "lea 64(%a1),%a1",
                           "dbf %d1,LA"],
                          [0x1B6F4, 0x1B6F6, 0x1B6F8, 0x1B6FA, 0x1B6FE, 0x1B702]))
        elif offset in (0x1B6F6, 0x1B6F8, 0x1B6FA, 0x1B6FE, 0x1B702):
            pass  # cobertos pelo bloco
        elif offset == 0x1B706:
            snips.append(("lea-ff4008", offset, ["lea (0xff4008).l,%a1"], [offset]))
        elif offset == 0x1B70C:
            snips.append(("lea-ssmapindex", offset, ["lea (0x1b738).l,%a0"], [offset]))
        elif offset == 0x1B712:
            snips.append(("moveq-78", offset, ["moveq #77,%d1"], [offset]))
        elif offset == 0x1B714:
            snips.append(("bloco-expandir", 0x1B714,
                          ["LC:", "move.l (%a0)+,(%a1)+",
                           "move.w #0,(%a1)+",
                           "move.b -4(%a0),-1(%a1)",
                           "move.w (%a0)+,(%a1)+",
                           "dbf %d1,LC"],
                          [0x1B714, 0x1B716, 0x1B71A, 0x1B720, 0x1B722]))
        elif offset in (0x1B716, 0x1B71A, 0x1B720, 0x1B722):
            pass
        elif offset == 0x1B726:
            snips.append(("lea-ff4400", offset, ["lea (0xff4400).l,%a1"], [offset]))
        elif offset == 0x1B72C:
            snips.append(("movew-3f", offset, ["move.w #63,%d1"], [offset]))
        elif offset == 0x1B730:
            snips.append(("bloco-fila", 0x1B730,
                          ["LD:", "clr.l (%a1)+", "dbf %d1,LD"], [0x1B730, 0x1B732]))
        elif offset == 0x1B732:
            pass
        elif offset == 0x1B736:
            snips.append(("rts", offset, ["rts"], [offset]))
        else:
            raise SystemExit(f"[montar-isa] sitio sem forma catalogada: {offset:#x}")
    return snips


PIN = {off: bytes.fromhex(hb) for off, hb, _d, _p in CS.SITIOS}


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def assemble(dirpath, nome, org, linhas):
    s = dirpath / f"{nome}.s"
    o = dirpath / f"{nome}.o"
    binf = dirpath / f"{nome}.bin"
    s.write_text(".text\n" + f".org 0x{org:x}\n" + "\n".join(linhas) + "\n")
    run([str(AS), "-m68000", "-o", str(o), str(s)])
    run([str(OBJCOPY), "-O", "binary", "-j", ".text", str(o), str(binf)])
    return binf.read_bytes()


def objdump_mnemonic(dirpath, nome, hexbytes, org):
    """Passada inversa: bytes pinados -> mnemonico do desmontador do toolchain."""
    s = dirpath / f"inv-{nome}.s"
    o = dirpath / f"inv-{nome}.o"
    s.write_text(".text\n" + f".org 0x{org:x}\n.byte " +
                 ",".join(f"0x{b:02x}" for b in hexbytes) + "\n")
    run([str(AS), "-m68000", "-o", str(o), str(s)])
    r = run([str(OBJDUMP), "-d", "--start-address", f"0x{org:x}",
             "--stop-address", f"0x{org + len(hexbytes)}", str(o)])
    for linha in r.stdout.splitlines():
        partes = linha.split("\t")
        if len(partes) >= 3 and partes[0].strip().startswith(f"{org:x}:"):
            return partes[-1].strip()
    raise SystemExit(f"[montar-isa] objdump nao devolveu linha em {org:#x}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    root = pathlib.Path(__file__).resolve().parents[4]
    out_path = pathlib.Path(a.out).resolve()
    if not out_path.is_relative_to(root):
        raise SystemExit(f"[caminho] --out fora da arvore: {a.out}")

    for f, sha, nome in ((AS, AS_SHA, "as"), (OBJDUMP, OBJDUMP_SHA, "objdump"),
                         (OBJCOPY, None, "objcopy")):
        if not f.exists():
            raise SystemExit(f"[toolchain] ausente: {f}")
        if sha and hashlib.sha256(f.read_bytes()).hexdigest() != sha:
            raise SystemExit(f"[toolchain] SHA divergente do pin para {nome}")

    versoes = {}
    for nome, f in (("as", AS), ("objdump", OBJDUMP)):
        versoes[nome] = run([str(f), "--version"]).stdout.splitlines()[0]

    registros = []
    falhas = []
    with tempfile.TemporaryDirectory(prefix="rex-b-isa-") as tmp:
        d = pathlib.Path(tmp)
        for nome, org, linhas, offsets in build_snippets():
            blob = assemble(d, nome, org, linhas)
            for off in offsets:
                pin = PIN[off]
                obtido = blob[off:off + len(pin)]
                dados = nome.startswith("dados-")
                mnem = ("dado (nao e instrucao)" if dados else
                        objdump_mnemonic(d, nome if off == org else f"{nome}-{off:x}",
                                         pin, off))
                ok = obtido == pin
                registros.append({
                    "offset": hex(off), "bytes_pinados": pin.hex(),
                    "tipo": "dados" if dados else "instrucao",
                    "linhas_gas": [l for l in linhas if not l.endswith(":")],
                    "mnemonico_objdump": mnem,
                    "reassemblado": obtido.hex(), "confere": ok,
                    "bloco": nome,
                })
                if not ok:
                    falhas.append(hex(off))

    doc = {
        "schema_version": "rex-parallel-b/isa-forms/1",
        "gerado_por": "scripts/rex_profiles/parallel_recovery_20261004/b/montar-isa.py",
        "proposito": ("fixa contra o toolchain m68k-elf cada codificacao pinada "
                      "em contrato_sonic.SITIOS; nao le a ROM (os bytes ROM-vs-pin "
                      "sao conferidos pelo CLI verificar-cadeia.py em modo verificado)"),
        "toolchain": {"diretorio": str(TOOLCHAIN),
                      "as_sha256": AS_SHA, "as_versao": versoes["as"],
                      "objdump_sha256": OBJDUMP_SHA, "objdump_versao": versoes["objdump"],
                      "cpu": "m68000"},
        "notas": [
            "dbf: alvo fixado por LABEL em bloco contiguo (o gas nao aceita endereco "
            "absoluto como alvo de dbf); a base do deslocamento na 68000 e a palavra "
            "de extensao (opcode+2) — os alvos remontados coincidem com os medidos.",
            "movea.l (-122,PC,D0.w): o pinISA usa disp literal; o vinculo com a tabela "
            f"e aritmetico: 0x{0x1B6C4 + 2:x} - 122 = 0x{0x1B6C6 - 122:x} == TABELA "
            f"0x{CS.TABELA:x}.",
            "0x1B71A: a instrucao move.b -4(a0),-1(a1) tem 6 bytes (1368 fffc ffff); "
            "o pino cobre ate 0x1B720 (proxima instrucao).",
            "mnemonico_objdump e saida do DESMONTADOR do toolchain sobre os proprios "
            "bytes pinados — leitura independente da anotation humana.",
        ],
        "sitios": registros,
        "total": len(registros),
        "veredito": "ISA-PIN-COMPLETO" if not falhas else f"ISA-PIN-FALHOU: {falhas}",
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(f"[isa] {len(registros)} sitios; falhas: {falhas or 'nenhuma'}")
    print("evidencia:", out_path)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
