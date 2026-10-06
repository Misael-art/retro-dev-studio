# Delta v1 -> v2 nas amostras da ROM BYOR (ETAPA 3, E6-1) — 2026-10-06

ROM sha256 c7da53a1…81ebb (531577 bytes), nao versionada. v1 = redigidos publicados (r1,r2,r3,s1,s2, ponto 8ea5821); v2 = rex-cfg desta worktree. Gerador: `tools/delta-v1-v2.py`. Classes: dominio fechado de E6-1.

Classes: {'alvo-corrigido': 0, 'aresta-passa-fora-da-regiao': 0, 'invariante': 110, 'motivo-removedo': 0, 'veredito-mudou': 0}

- r1 {'cobertura-v1': 160, 'cobertura-v2': 160, 'instrucoes-identicas': True, 'instrucoes-v1': 66, 'instrucoes-v2': 66, 'sha256-v2-completo': 'b5517de12a56367a74341011bf2b31e6e88f20b1f99b59de48f4ca72e42197ca'}
- r2 {'cobertura-v1': 54, 'cobertura-v2': 54, 'instrucoes-identicas': True, 'instrucoes-v1': 15, 'instrucoes-v2': 15, 'sha256-v2-completo': '9db17f0cea3a1786160d8a61f4d0415011814540af9249d3a8e4bea909fea953'}
- r3 {'cobertura-v1': 28, 'cobertura-v2': 28, 'instrucoes-identicas': True, 'instrucoes-v1': 6, 'instrucoes-v2': 6, 'sha256-v2-completo': '25ea55dc3bad8b22ad3cb667d85e3b7fd05575738fbecb193da91a351641ed76'}
- s1 {'cobertura-v1': 26, 'cobertura-v2': 26, 'instrucoes-identicas': True, 'instrucoes-v1': 8, 'instrucoes-v2': 8, 'sha256-v2-completo': '0ef3562337734940c817c26bc7c892287895e471695b039bab448cea84d6c761'}
- s2 {'cobertura-v1': 124, 'cobertura-v2': 124, 'instrucoes-identicas': True, 'instrucoes-v1': 36, 'instrucoes-v2': 36, 'sha256-v2-completo': 'c9395c61135536e8026e711e77add9add5db8d787ddefe873ab51b882cf50892'}

| amostra | sitio | tipo | v1-alvo | v2-alvo | v1-veredito | v2-veredito | classe |
|---|---|---|---|---|---|---|---|
| r1 | 0x18a6 | queda | 0x18a8 | 0x18a8 | resolvido | resolvido | invariante |
| r1 | 0x18ac | desvio | 0x18ba | 0x18ba | resolvido | resolvido | invariante |
| r1 | 0x18ac | queda | 0x18b0 | 0x18b0 | resolvido | resolvido | invariante |
| r1 | 0x18b8 | queda | 0x18ba | 0x18ba | resolvido | resolvido | invariante |
| r1 | 0x18bc | desvio | 0x18c2 | 0x18c2 | resolvido | resolvido | invariante |
| r1 | 0x18bc | queda | 0x18be | 0x18be | resolvido | resolvido | invariante |
| r1 | 0x18c0 | desvio | 0x18a8 | 0x18a8 | resolvido | resolvido | invariante |
| r1 | 0x18c8 | desvio | 0x18d6 | 0x18d6 | resolvido | resolvido | invariante |
| r1 | 0x18c8 | queda | 0x18cc | 0x18cc | resolvido | resolvido | invariante |
| r1 | 0x18d4 | queda | 0x18d6 | 0x18d6 | resolvido | resolvido | invariante |
| r1 | 0x18d8 | desvio | 0x1906 | 0x1906 | resolvido | resolvido | invariante |
| r1 | 0x18d8 | queda | 0x18da | 0x18da | resolvido | resolvido | invariante |
| r1 | 0x18dc | desvio | 0x18ea | 0x18ea | resolvido | resolvido | invariante |
| r1 | 0x18dc | queda | 0x18e0 | 0x18e0 | resolvido | resolvido | invariante |
| r1 | 0x18e8 | queda | 0x18ea | 0x18ea | resolvido | resolvido | invariante |
| r1 | 0x18ee | desvio | 0x18fc | 0x18fc | resolvido | resolvido | invariante |
| r1 | 0x18ee | queda | 0x18f2 | 0x18f2 | resolvido | resolvido | invariante |
| r1 | 0x18fa | queda | 0x18fc | 0x18fc | resolvido | resolvido | invariante |
| r1 | 0x1904 | desvio | 0x191c | 0x191c | resolvido | resolvido | invariante |
| r1 | 0x1916 | desvio | 0x1928 | 0x1928 | resolvido | resolvido | invariante |
| r1 | 0x1916 | queda | 0x1918 | 0x1918 | resolvido | resolvido | invariante |
| r1 | 0x191a | queda | 0x191c | 0x191c | resolvido | resolvido | invariante |
| r1 | 0x1922 | desvio | 0x191c | 0x191c | resolvido | resolvido | invariante |
| r1 | 0x1922 | queda | 0x1926 | 0x1926 | resolvido | resolvido | invariante |
| r1 | 0x1926 | desvio | 0x18a8 | 0x18a8 | resolvido | resolvido | invariante |
| r1 | 0x192a | desvio | 0x1938 | 0x1938 | resolvido | resolvido | invariante |
| r1 | 0x192a | queda | 0x192c | 0x192c | resolvido | resolvido | invariante |
| r1 | 0x1930 | desvio | 0x18a8 | 0x18a8 | resolvido | resolvido | invariante |
| r1 | 0x1930 | queda | 0x1934 | 0x1934 | resolvido | resolvido | invariante |
| r1 | 0x1936 | desvio | 0x191c | 0x191c | resolvido | resolvido | invariante |
| r1 | 0x193a | retorno-fronteira | - | - | indireto-opaco | indireto-opaco | invariante |
| r1 | 0x189c | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| r1 | 0x18a0 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r1 | 0x18ff | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r1 | 0x193b | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r2 | 0x20c | desvio | 0x214 | 0x214 | resolvido | resolvido | invariante |
| r2 | 0x20c | queda | 0x20e | 0x20e | resolvido | resolvido | invariante |
| r2 | 0x20e | queda | 0x214 | 0x214 | resolvido | resolvido | invariante |
| r2 | 0x214 | desvio | 0x292 | 0x292 | resolvido | resolvido | invariante |
| r2 | 0x214 | queda | 0x216 | 0x216 | resolvido | resolvido | invariante |
| r2 | 0x22a | desvio | 0x234 | 0x234 | resolvido | resolvido | invariante |
| r2 | 0x22a | queda | 0x22c | 0x22c | resolvido | resolvido | invariante |
| r2 | 0x22c | queda | 0x234 | 0x234 | resolvido | resolvido | invariante |
| r2 | 0x292 | desvio | 0x300 | 0x300 | fora-da-regiao | fora-da-regiao | invariante |
| r2 | 0x1364 | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| r2 | 0x3082 | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| r2 | 0x51bc | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| r2 | 0x745dc | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| r3 | 0x1370 | chamada | 0x189c | 0x189c | fora-da-regiao | fora-da-regiao | invariante |
| r3 | 0x1370 | queda | 0x1374 | 0x1374 | resolvido | resolvido | invariante |
| r3 | 0x1364 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| r3 | 0x1366 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r3 | 0x1369 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r3 | 0x1370 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| r3 | 0x1372 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r3 | 0x1378 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| r3 | 0x137c | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| r3 | 0x137e | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| r3 | 0x1380 | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| s1 | 0x1c028 | desvio | 0x1c044 | 0x1c044 | resolvido | resolvido | invariante |
| s1 | 0x1c028 | queda | 0x1c02a | 0x1c02a | resolvido | resolvido | invariante |
| s1 | 0x1c030 | chamada | 0x1c510 | 0x1c510 | fora-da-regiao | fora-da-regiao | invariante |
| s1 | 0x1c030 | queda | 0x1c034 | 0x1c034 | resolvido | resolvido | invariante |
| s1 | 0x1c044 | retorno-fronteira | - | - | indireto-opaco | indireto-opaco | invariante |
| s1 | 0x1c024 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s1 | 0x1c028 | sitio | 0x1c044 | 0x1c044 | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s1 | 0x1c029 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s1 | 0x1c02c | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s1 | 0x1c030 | sitio | 0x1c510 | 0x1c510 | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s1 | 0x1c034 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s1 | 0x1c038 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s1 | 0x1c03c | sitio | - | - | ponto-de-fronteira | ponto-de-fronteira | invariante |
| s1 | 0x1c040 | sitio | - | - | dentro-regiao-nao-alcancado | dentro-regiao-nao-alcancado | invariante |
| s1 | 0x1c0a6 | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6bc | desvio | 0x1c7a2 | 0x1c7a2 | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6bc | queda | 0x1c6c0 | 0x1c6c0 | resolvido | resolvido | invariante |
| s2 | 0x1c6c4 | desvio | 0x1c6d8 | 0x1c6d8 | resolvido | resolvido | invariante |
| s2 | 0x1c6c4 | queda | 0x1c6c6 | 0x1c6c6 | resolvido | resolvido | invariante |
| s2 | 0x1c6d4 | chamada | 0x1c8da | 0x1c8da | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6d4 | queda | 0x1c6d8 | 0x1c6d8 | resolvido | resolvido | invariante |
| s2 | 0x1c6dc | desvio | 0x1c6f8 | 0x1c6f8 | resolvido | resolvido | invariante |
| s2 | 0x1c6dc | queda | 0x1c6de | 0x1c6de | resolvido | resolvido | invariante |
| s2 | 0x1c6de | desvio | 0x1c6e4 | 0x1c6e4 | resolvido | resolvido | invariante |
| s2 | 0x1c6de | queda | 0x1c6e0 | 0x1c6e0 | resolvido | resolvido | invariante |
| s2 | 0x1c6e0 | chamada | 0x1c80e | 0x1c80e | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6e0 | queda | 0x1c6e4 | 0x1c6e4 | resolvido | resolvido | invariante |
| s2 | 0x1c6f4 | chamada | 0x1c8d0 | 0x1c8d0 | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6f4 | queda | 0x1c6f8 | 0x1c6f8 | resolvido | resolvido | invariante |
| s2 | 0x1c6fc | desvio | 0x1c754 | 0x1c754 | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c6fc | queda | 0x1c6fe | 0x1c6fe | resolvido | resolvido | invariante |
| s2 | 0x1c702 | desvio | 0x1c754 | 0x1c754 | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c702 | queda | 0x1c704 | 0x1c704 | resolvido | resolvido | invariante |
| s2 | 0x1c70e | desvio | 0x1c78c | 0x1c78c | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c70e | queda | 0x1c710 | 0x1c710 | resolvido | resolvido | invariante |
| s2 | 0x1c716 | desvio | 0x1c754 | 0x1c754 | fora-da-regiao | fora-da-regiao | invariante |
| s2 | 0x1c716 | queda | 0x1c718 | 0x1c718 | resolvido | resolvido | invariante |
| s2 | 0x1c722 | desvio | 0x1c734 | 0x1c734 | resolvido | resolvido | invariante |
| s2 | 0x1c722 | queda | 0x1c724 | 0x1c724 | resolvido | resolvido | invariante |
| s2 | 0x1c72e | desvio | 0x1c734 | 0x1c734 | resolvido | resolvido | invariante |
| s2 | 0x1c72e | queda | 0x1c730 | 0x1c730 | resolvido | resolvido | invariante |
| s2 | 0x1c6b8 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c6bc | sitio | 0x1c7a2 | 0x1c7a2 | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c6bd | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s2 | 0x1c6c0 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c6c4 | sitio | 0x1c6d8 | 0x1c6d8 | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c6c8 | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s2 | 0x1c6cc | sitio | - | - | miolo-de-instrucao | miolo-de-instrucao | invariante |
| s2 | 0x1c6d0 | sitio | - | - | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c6d4 | sitio | 0x1c8da | 0x1c8da | instrucao-de-bloco | instrucao-de-bloco | invariante |
| s2 | 0x1c73a | sitio | - | - | fora-da-regiao | fora-da-regiao | invariante |
