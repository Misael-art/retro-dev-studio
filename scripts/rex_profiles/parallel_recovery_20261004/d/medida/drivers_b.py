#!/usr/bin/env python3
"""Controlador Python dos adaptadores da frente B.

Importa o módulo REAL de `contrato_sonic.py` na árvore materializada do SHA que
se está a medir (EXTENSOES-D §4 KB3 prescribe o import) e executa sobre a
entrada autoral de D. Não reimplementa nenhuma verificação de B nem lê o
gabarito para preencher saídas (R9): aqui só se invoca a função de B e se
serializa o que ela devolveu (valor, forma, código de `RecusaErro`).

Lê o payload JSON em stdin e imprime o resultado em stdout.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import pathlib
import sys


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def carregar(arvore: str):
    p = pathlib.Path(arvore) / "scripts/rex_profiles/parallel_recovery_20261004/b/contrato_sonic.py"
    spec = importlib.util.spec_from_file_location(f"contrato_{p.parent.parent.parent.name}", p)
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m
    spec.loader.exec_module(m)
    return m, p


def resultado_recusa(fn):
    """Executa fn() e devolve o que B produziu: valor ou o código da recusa real."""
    try:
        v = fn()
        return {"recusado": False, "valor": v}
    except Exception as e:  # noqa: BLE001 — registra o que B realmente levantou
        tipo = type(e).__name__
        codigo = getattr(e, "codigo", None)
        return {"recusado": True, "excecao": tipo, "codigo": codigo, "mensagem": str(e)}


def resumir_layout(r):
    if isinstance(r, list):
        return {"linhas": len(r), "colunas": len(r[0]) if r else 0,
                "forma": "lista de linhas", "bytes_totais": sum(len(x) for x in r)}
    return {"tipo": type(r).__name__, "repr": repr(r)[:120]}


def main() -> int:
    if len(sys.argv) > 1:
        payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    else:
        payload = json.load(sys.stdin)
    CS, caminho_modulo = carregar(payload["arvore"])
    rom = pathlib.Path(payload["rom"]).read_bytes()
    saida = {
        "modulo": {"caminho": str(caminho_modulo), "sha256": sha(caminho_modulo.read_bytes()),
                   "schema": CS.SCHEMA},
        "config": {
            "rom_pin_sha256": CS.ROM_SHA256,
            "rom_size": CS.ROM_SIZE,
            "decoder_sha256": CS.DECODER_SHA256,
            "tabela": hex(CS.TABELA),
            "streams": [hex(s) for s in CS.STREAMS],
            "consumidos": list(CS.CONSUMIDOS),
            "geometria": {"linhas": CS.LINHAS, "colunas": CS.COLUNAS,
                          "stride": CS.STRIDE, "cell_bytes": CS.CELL_BYTES,
                          "base_layout": hex(CS.BASE_LAYOUT)},
            "total_sitios": len(CS.SITIOS),
        },
        "acoes": {},
    }

    for acao in payload["acoes"]:
        id_, tipo = acao["id"], acao["tipo"]

        if tipo == "alegacao_sitio":
            end = acao["endereco"]
            aleg = [list(s) for s in CS.SITIOS if s[0] == end]
            saida["acoes"][id_] = {"alegacao_B": aleg, "no_contrato": bool(aleg)}

        elif tipo == "verificar_sitios":
            sitios = [(s["endereco"], s["hexbytes"], "sonda autoral D", "d-sonda")
                      for s in acao["sitios"]]
            alvo = pathlib.Path(acao.get("rom", payload["rom"])).read_bytes()
            divs = CS.verificar_sitios(alvo, sitios=sitios)
            saida["acoes"][id_] = {
                "divergentes": divs,
                "verificado_por": "CS.verificar_sitios",
                "rom_sha256_lido": sha(alvo),
            }

        elif tipo == "layout":
            plain = pathlib.Path(acao["plain"]).read_bytes()
            kwargs = {k: v for k, v in acao.items() if k in ("linhas", "colunas", "stride", "conforme_consumidor")}
            r = resultado_recusa(lambda: CS.layout_de_plain(plain, **kwargs))
            if not r["recusado"]:
                r["valor"] = resumir_layout(r["valor"])
            saida["acoes"][id_] = r

        elif tipo == "projetar":
            plain = pathlib.Path(acao["plain"]).read_bytes()
            kwargs = {k: v for k, v in acao.items() if k in ("linhas", "colunas", "stride", "conforme_consumidor")}
            r = resultado_recusa(lambda: CS.projetar(plain, **kwargs))
            if not r["recusado"]:
                buf = r["valor"]
                r["valor"] = {"tam": len(buf), "sha256": sha(buf)}
            saida["acoes"][id_] = r

        elif tipo == "roundtrip":
            plain = pathlib.Path(acao["plain"]).read_bytes()
            proj = CS.projetar(plain)
            inv = resultado_recusa(lambda: CS.inverso_projecao(proj))
            saida["acoes"][id_] = {
                "projecao_tam": len(proj),
                "projecao_sha256": sha(proj),
                "inverso_recusado": inv["recusado"],
                "identico_ao_plain": (not inv["recusado"]) and inv.get("valor") == plain,
                "inverso_codigo": inv.get("codigo"),
                "celulas_discriminantes": {
                    "r0c0": int(proj[0 * CS.STRIDE + 0]),
                    "r0c63": int(proj[0 * CS.STRIDE + 63]),
                    "r1c0": int(proj[1 * CS.STRIDE + 0]),
                    "r63c63": int(proj[63 * CS.STRIDE + 63]),
                    "padding_r0": proj[64:128].hex(),
                },
            }

        elif tipo == "padding_sujo":
            plain = pathlib.Path(acao["plain"]).read_bytes()
            proj = bytearray(CS.projetar(plain))
            linha = acao.get("linha", 0)
            proj[linha * CS.STRIDE + CS.COLUNAS] = acao.get("valor", 0x01)
            r = resultado_recusa(lambda: CS.inverso_projecao(bytes(proj)))
            saida["acoes"][id_] = {
                "buffer_sha256": sha(bytes(proj)),
                "recusado": r["recusado"],
                "codigo": r.get("codigo"),
                "mensagem": (r.get("mensagem") or "")[:200],
                "escrito_no_inverso": (not r["recusado"]) and r.get("valor") is not None,
            }

    print(json.dumps(saida, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
