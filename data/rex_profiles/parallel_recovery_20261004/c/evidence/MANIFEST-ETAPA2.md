# evidencia das amostras reservadas (letra C, ETAPA 2) — 2026-10-05

ROM BYOR somente-leitura, NAO versionada; identidade por SHA-256.
sha256=c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb  bytes=531577
Pinos: CTX(0x00D84,28)=298c991c8fa94383425a51f4c0cdd3ce48e4d989f7ca01468eaa88d2955f626c S1(0x1C024,128)=f1b9b9cdfc6f6e714b449becf87de883b0162954ef6fd8bd7f4fcf0afdd94c63 S2(0x1C6B8,128)=6f3308c397ed4c9ae07a3e6e2e86092b56a526d26b9d43062572c6e5a9def91c

## instrumento (arbitro de comprimento e alvo)

- binario: `m68k-elf-objdump` — versao `GNU objdump (GNU Binutils) 2.41`
- sha256 do binario: `e3a404cc06ecc27d861ab33af06d93e4deb8ec76533df951922d17ac839b294f`
- flags: `-b binary -m m68k -D` (offset == endereco na imagem plana)
- limite: paridade com o instrumento **nao** equivale a observacao em runtime
  (obrigacao 8). Sem execucao, sem DAC, sem VRAM.

- fixtures autorais da mesma frente (reproduzem sem a ROM):
  `scripts/rex_profiles/parallel_recovery_20261004/c/fixtures/MANIFEST.sha256`
  — montador e instrumento pinados; os digest sao conferidos por teste.

## serie bruta do comparador

Verbatim do stdout da arbitragem R1..R7 (`/home/misael/rds-scratch/xe-c2-amostras/serie-bruta.txt`):

```
OK s1 R1: 8 sitios alinhados com veredito estrutural ['instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'ponto-de-fronteira', 'dentro-regiao-nao-alcancado']
OK s1 R2: sitio impar 0x1c029 = miolo-de-instrucao (consumidor nao)
OK s1 R3: 0x1c0a6 = fora-da-regiao; instrucoes >= 0x1c0a4: []
OK s1 R4: raizes [(114724, 'referencia-estatica', 'referencia-estatica')]
OK s1 R5: 1 chamadas, todas com sitio par e instrucao provada; ruins=[]
OK s1 R6: paridade de comprimento em 8 nos comparados com 32 registros do instrumento (divergencias=0, sem registro=0)
OK s1 R6 alvo 0x1c028 = 0x1c044 (instrumento: 114756)
OK s1 R6 alvo 0x1c030 = 0x1c510 (instrumento: 115984)
OK s1 medir: status das quatro dimensoes [('comprimento', 'medido'), ('operandos', 'medido'), ('fluxo', 'medido'), ('alcance', 'medido')] agregado=proibido pendencia=[]
OK s2 R1: 8 sitios alinhados com veredito estrutural ['instrucao-de-bloco', 'instrucao-de-bloco', 'instrucao-de-bloco', 'instrucao-de-bloco', 'miolo-de-instrucao', 'miolo-de-instrucao', 'instrucao-de-bloco', 'instrucao-de-bloco']
OK s2 R2: sitio impar 0x1c6bd = miolo-de-instrucao (consumidor nao)
OK s2 R3: 0x1c73a = fora-da-regiao; instrucoes >= 0x1c738: []
OK s2 R4: raizes [(116408, 'referencia-estatica', 'referencia-estatica')]
OK s2 R5: 3 chamadas, todas com sitio par e instrucao provada; ruins=[]
OK s2 R6: paridade de comprimento em 36 nos comparados com 37 registros do instrumento (divergencias=0, sem registro=0)
OK s2 R6 alvo 0x1c6bc = 0x1c7a2 (instrumento: 116642)
OK s2 R6 alvo 0x1c6c4 = 0x1c6d8 (instrumento: 116440)
OK s2 R6 alvo 0x1c6d4 = 0x1c8da (instrumento: 116954)
OK s2 R6 alvo 0x1c6dc = 0x1c6f8 (instrumento: 116472)
OK s2 R6 alvo 0x1c6de = 0x1c6e4 (instrumento: 116452)
OK s2 R6 alvo 0x1c6e0 = 0x1c80e (instrumento: 116750)
OK s2 R6 alvo 0x1c6f4 = 0x1c8d0 (instrumento: 116944)
OK s2 R6 alvo 0x1c6fc = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c702 = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c70e = 0x1c78c (instrumento: 116620)
OK s2 R6 alvo 0x1c716 = 0x1c754 (instrumento: 116564)
OK s2 R6 alvo 0x1c722 = 0x1c734 (instrumento: 116532)
OK s2 R6 alvo 0x1c72e = 0x1c734 (instrumento: 116532)
OK s2 medir: status das quatro dimensoes [('comprimento', 'medido'), ('operandos', 'medido'), ('fluxo', 'medido'), ('alcance', 'medido')] agregado=proibido pendencia=[]
--- censo do Apêndice B (iscas; cada linha: veredito, consumidor, promovivel, alvo da ferramenta vs instrumento)
  0x005c2 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0005CA instrumento=0x5ca motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x011f0 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0011F4 instrumento=0x11f4 motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x01482 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x00148A instrumento=- motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x015c6 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0015DE instrumento=- motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x01dd8 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x001DE4 instrumento=0x1de4 motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x01dfa 61 nn   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x001E26 instrumento=0x1e26 motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x31dcc 4E FC   veredito=miolo-de-instrucao         consumidor=nao promovivel=nao alvo=None instrumento=- motivos=['miolo-de-instrucao', 'miolo-de-instrucao:0x031DCA']
  0x3ab02 2A 7C   veredito=instrucao-de-bloco         consumidor=nao promovivel=nao alvo=None instrumento=- motivos=['classe-condicional:movea']
  0x4028a 4E F8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x009009 instrumento=- motivos=['interpretacao-pendente:abs-w-bit15', 'proveniencia-nao-autoriza-vinculo:candidato']
  0x4f606 4E F8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0009F0 instrumento=- motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x4f850 2A 7C   veredito=instrucao-de-bloco         consumidor=nao promovivel=nao alvo=None instrumento=- motivos=['classe-condicional:movea']
  0x50210 4E F8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x001D74 instrumento=0x1d74 motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x66a40 4E FA   veredito=instrucao-de-bloco         consumidor=nao promovivel=nao alvo=None instrumento=- motivos=['alvo-nao-comprovado']
  0x74eec 4E B8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0003BA instrumento=0x3ba motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x77efa 4E B8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0003BA instrumento=0x3ba motivos=['proveniencia-nao-autoriza-vinculo:candidato']
  0x819da 4E B8   veredito=instrucao-de-bloco         consumidor=sim promovivel=nao alvo=0x0026D4 instrumento=- motivos=['proveniencia-nao-autoriza-vinculo:candidato']
OK R7: censo com 16 enderecos; 16 nao promovidos (raiz candidato); violacoes=0
     nota: sitios S1/S2 validados como consumidor estrutural existem na serie
OK s1: evidencia redigida versionada sha256=110e5cda4f22be65e646ea7027d2ffb3fdf9751f2f06ae56518253709f657ad3 bytes_nao_ascii=0
OK s2: evidencia redigida versionada sha256=bb6db8baaa9d644d918364588c3c5b90c7d81fd4d3517123ce32361824c0a06a bytes_nao_ascii=0
OK   censo versionado: sha256=6c446c292824c7e5a7256046abca9e0e1a6ca3862503157df1660d8a3b8954ef
FIM: divergencias criticas = 0
```

## artefatos

| artefato | sha256 | onde esta |
|---|---|---|
| censo.005C2.json | 7614afa94de1c6773f9e2523ea7660a3a822ab0735551ec2d729f93feb8f2fe9 | /home/misael/rds-scratch/xe-c2-amostras/censo.005C2.json (FORA do indice) |
| censo.011F0.json | 6060cde3eb80eaf2151383c948b116ec8ae0188710171030274487a4c2f0daf8 | /home/misael/rds-scratch/xe-c2-amostras/censo.011F0.json (FORA do indice) |
| censo.01482.json | b85fdcca908aa5f2185f48926510a7cdbb97be649a73f1bd63eac941a9da768b | /home/misael/rds-scratch/xe-c2-amostras/censo.01482.json (FORA do indice) |
| censo.015C6.json | 22d8fbbea6c8a05ef1560877ae9c5091be9b264bf1d59ea9fb744b02f618749c | /home/misael/rds-scratch/xe-c2-amostras/censo.015C6.json (FORA do indice) |
| censo.01DD8.json | 266c3fbb03418e7aa1454ee54e87b5fd80d8170a4fa1efb20fc8af3124b6fe63 | /home/misael/rds-scratch/xe-c2-amostras/censo.01DD8.json (FORA do indice) |
| censo.01DFA.json | 75da85aaf4cb050e9aeb6da50c23afdfcecbea673436aa7219b7da09e1ae1d56 | /home/misael/rds-scratch/xe-c2-amostras/censo.01DFA.json (FORA do indice) |
| censo.31DCC.json | 5e7cea8827a9925d0a47c1cfb08b0a8eed811bbfcde3649791b7b7bed9b7cdec | /home/misael/rds-scratch/xe-c2-amostras/censo.31DCC.json (FORA do indice) |
| censo.3AB02.json | 38f2a9a4c9e1918655354c5093be6febb0f79a270adf8e3175ec02754fd2df71 | /home/misael/rds-scratch/xe-c2-amostras/censo.3AB02.json (FORA do indice) |
| censo.4028A.json | fa3d231f6fa59fb21e3ef48ac2319114869c24a78d0bbaa9b6eb8a2a1397eba0 | /home/misael/rds-scratch/xe-c2-amostras/censo.4028A.json (FORA do indice) |
| censo.4F606.json | 2b45072f51ebb31a478b69fa1feca380c2113acbb3628a735575cf492de52ff6 | /home/misael/rds-scratch/xe-c2-amostras/censo.4F606.json (FORA do indice) |
| censo.4F850.json | e164c824b4bc62c99f23d1029e14ec800df02bd4cef72fef36625365910d1a8f | /home/misael/rds-scratch/xe-c2-amostras/censo.4F850.json (FORA do indice) |
| censo.50210.json | 9371766ba435874fc6dd78aff4f289cee30d268b8bd3a36217157390e3b5b22a | /home/misael/rds-scratch/xe-c2-amostras/censo.50210.json (FORA do indice) |
| censo.66A40.json | 4cf18c477ea60f227f1ae75ffd7f65c9bf624dddc3d06cda4500903b2bcaa2bf | /home/misael/rds-scratch/xe-c2-amostras/censo.66A40.json (FORA do indice) |
| censo.74EEC.json | d13aa4d64c68edd153577e2ded8545c380c7749d0fc77c0a81c7c588b544cfb5 | /home/misael/rds-scratch/xe-c2-amostras/censo.74EEC.json (FORA do indice) |
| censo.77EFA.json | 4c479a62d4a50a4fbc1a5c96e56c56cf5b92201d9e532eee1ccef39931814c57 | /home/misael/rds-scratch/xe-c2-amostras/censo.77EFA.json (FORA do indice) |
| censo.819DA.json | 0cbbe4c66bffa4eff07ae64ac5d5a263add4c7ebf7e9951c469b76c7a0a8a374 | /home/misael/rds-scratch/xe-c2-amostras/censo.819DA.json (FORA do indice) |
| s1.analise.json | c66f8c7eeabed232e099f66e2bb3d1a7514f3d38fe5e16fc7feb16b0167e116f | /home/misael/rds-scratch/xe-c2-amostras/s1.analise.json (FORA do indice) |
| s1.med.json | da5d5b1224e226aeb95cadd846fcc0afa831181ea78146bc88e860499bba450c | /home/misael/rds-scratch/xe-c2-amostras/s1.med.json (FORA do indice) |
| s1.sitio.1C024.json | 78bade8813f0d8cc5ca4d0bcc9c9ef578560c4a46f995a050f867acf6ad5c97e | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C024.json (FORA do indice) |
| s1.sitio.1C028.json | 5df86dbf6cf18b746e571a131e9cb59e96d05cba8df0ccc394e8c3778ba18542 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C028.json (FORA do indice) |
| s1.sitio.1C029.json | 3e7032eedaf8df0ffff074161defc42e62fc338643ee6c1a3e06f4c3a94c6878 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C029.json (FORA do indice) |
| s1.sitio.1C02C.json | 325f0cd04a649a6a01bd6513fa294ea3e0b554cacf8fac2e57b63f4240d355f7 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C02C.json (FORA do indice) |
| s1.sitio.1C030.json | d3ac6bc2a6a57a44c24884489afca71efb28d01db6d0fc17fce2862b18ae5043 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C030.json (FORA do indice) |
| s1.sitio.1C034.json | 61d2facd740feb947ae19be932c54c2c50219539987080a39a8467f38b825b2b | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C034.json (FORA do indice) |
| s1.sitio.1C038.json | ddb1a60e753e34350b57fce8175ba3ffc02dca2980cef331eb06cc4ca1f5f4ad | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C038.json (FORA do indice) |
| s1.sitio.1C03C.json | 5265aabfc977a5e7b89e23876703347dbaa8c95c4deb28a434711b5529c4b631 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C03C.json (FORA do indice) |
| s1.sitio.1C040.json | a2a41dc0ee79f3113af59a673789100fc2b10eac94bf511437d7862fa40d27b1 | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C040.json (FORA do indice) |
| s1.sitio.1C0A6.json | 77ac217d90690dc87bd2ea6b9c4c79604ca92acc266155f3374817f96a110d0e | /home/misael/rds-scratch/xe-c2-amostras/s1.sitio.1C0A6.json (FORA do indice) |
| s2.analise.json | 4b2c6ed1ae0310c0ea7b97a020bdf6fa52299dc6b9af4a0e15c333a3d3eef198 | /home/misael/rds-scratch/xe-c2-amostras/s2.analise.json (FORA do indice) |
| s2.med.json | 478a1d1e4178f21888b1906397beccbfb3f4c49326f56736131b683b93dcdb5c | /home/misael/rds-scratch/xe-c2-amostras/s2.med.json (FORA do indice) |
| s2.sitio.1C6B8.json | 07876660879d2ceb67e3d7df1f7e37993abb7f6145392aabb2bed4a2d26e2b4d | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6B8.json (FORA do indice) |
| s2.sitio.1C6BC.json | 88b34d07820dff78fda49f9d0c40d5a8972bed38d0be9ff3ce6c2560dbb8ca22 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6BC.json (FORA do indice) |
| s2.sitio.1C6BD.json | 217e946c67ee32a54d362d4c078f2b7b6bd33c878332fb43e772cd963e789587 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6BD.json (FORA do indice) |
| s2.sitio.1C6C0.json | b910075a37c93f06448fc9c8b4b1b0bd4f3d294a3b78d95f332b918b7c931999 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6C0.json (FORA do indice) |
| s2.sitio.1C6C4.json | 7fd91f586fc1fc5da4a1cea9d2f70fea4b1580967651b3768d47919797dd0a28 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6C4.json (FORA do indice) |
| s2.sitio.1C6C8.json | 8e55b3c49d96a7aa944a6e59b6bdc7711f7451b858e1ad03827e36bb83a9d3c6 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6C8.json (FORA do indice) |
| s2.sitio.1C6CC.json | 7538ea89c1c6a7df3ecaa5be2092d590d2cbc91e422e5763bbacce64124870cf | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6CC.json (FORA do indice) |
| s2.sitio.1C6D0.json | ed52201a0be9e749ff113a6029ebaf3c7f88011b9ef24ab05ed0e24ffba5ecad | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6D0.json (FORA do indice) |
| s2.sitio.1C6D4.json | 1c3ee1e68fd1ea77436aba814e235045ca7bd9abd843d95f040e3d2fc09ae5f3 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C6D4.json (FORA do indice) |
| s2.sitio.1C73A.json | baa74fe7c347bc9580c3b0f3be121090032e785086d8f6fd7e53565d9d1b6985 | /home/misael/rds-scratch/xe-c2-amostras/s2.sitio.1C73A.json (FORA do indice) |
| censo.005C2.objdump.txt | 7dab2a06a75fffa94f23e3ccf27a60d8a45062806fe2ca85cdfb200e68d6c857 | /home/misael/rds-scratch/xe-c2-amostras/censo.005C2.objdump.txt (FORA do indice) |
| censo.011F0.objdump.txt | 1e2bd0492bcdebe61b1b96dca6808734b952419a0e28a7af1d20e162e0c1aa6d | /home/misael/rds-scratch/xe-c2-amostras/censo.011F0.objdump.txt (FORA do indice) |
| censo.01482.objdump.txt | cbc74ef0807565de79cef9be7a58ab1f21d1930eedb1836b1dcf2598d63b6d08 | /home/misael/rds-scratch/xe-c2-amostras/censo.01482.objdump.txt (FORA do indice) |
| censo.015C6.objdump.txt | 155182c1e7cf950bd38ab23e53ede5ad7d50801c2a413d0b9547d5339f7ab70a | /home/misael/rds-scratch/xe-c2-amostras/censo.015C6.objdump.txt (FORA do indice) |
| censo.01DD8.objdump.txt | 07dda2a9385fad47d3dbd051d9bcac1223d3005f7e9c619e02d76cae88a573f6 | /home/misael/rds-scratch/xe-c2-amostras/censo.01DD8.objdump.txt (FORA do indice) |
| censo.01DFA.objdump.txt | 07dda2a9385fad47d3dbd051d9bcac1223d3005f7e9c619e02d76cae88a573f6 | /home/misael/rds-scratch/xe-c2-amostras/censo.01DFA.objdump.txt (FORA do indice) |
| censo.31DCC.objdump.txt | 8e22d475c23a20dc058da71b593368bace37fe87b0550713f01bac2f9f0009d9 | /home/misael/rds-scratch/xe-c2-amostras/censo.31DCC.objdump.txt (FORA do indice) |
| censo.3AB02.objdump.txt | 41a10eb3cdcb3abc8cb23578ddd4c871f50870c051e7466105592a9361e32502 | /home/misael/rds-scratch/xe-c2-amostras/censo.3AB02.objdump.txt (FORA do indice) |
| censo.4028A.objdump.txt | 7ba9847039394c8cd5119aae6791d6c4bd3823cd89595a4c5f01d971bac818dc | /home/misael/rds-scratch/xe-c2-amostras/censo.4028A.objdump.txt (FORA do indice) |
| censo.4F606.objdump.txt | 7e662d507ab6a5e303f65033709a4c860e7c7c3d5068f5fab010699aa8b88420 | /home/misael/rds-scratch/xe-c2-amostras/censo.4F606.objdump.txt (FORA do indice) |
| censo.4F850.objdump.txt | e4247ca92475ed8cdc5f576eec4cc84b7a78e88b824a3f7cab6dc455cbc3d444 | /home/misael/rds-scratch/xe-c2-amostras/censo.4F850.objdump.txt (FORA do indice) |
| censo.50210.objdump.txt | 8eccf30b78d4a25ca1e4ecf5312c6c0c104a7a0d9f3237bd95e94bb4592ce587 | /home/misael/rds-scratch/xe-c2-amostras/censo.50210.objdump.txt (FORA do indice) |
| censo.66A40.objdump.txt | 3673d0259efc16fa30463da979acdedbadc989c4577c147ead480194a969ec04 | /home/misael/rds-scratch/xe-c2-amostras/censo.66A40.objdump.txt (FORA do indice) |
| censo.74EEC.objdump.txt | 8b47e2bd36c1803ee84335e38053c23adcacf1f6c0311e9c71e06c2d243ef4c7 | /home/misael/rds-scratch/xe-c2-amostras/censo.74EEC.objdump.txt (FORA do indice) |
| censo.77EFA.objdump.txt | 90d58892be851801b76e04caf3d9af8b7aeff78d9afe1273b8a5b03f6d28b3ec | /home/misael/rds-scratch/xe-c2-amostras/censo.77EFA.objdump.txt (FORA do indice) |
| censo.819DA.objdump.txt | fe6b35eea374ca3509c6cc15eca1603122e7d54ff8ca04c06815bed6284dac68 | /home/misael/rds-scratch/xe-c2-amostras/censo.819DA.objdump.txt (FORA do indice) |
| s1-objdump-bruto.txt | d69015735cdfdc91ea5e4cb2c9a3014951ac672397e557e33b66e043165ca4a2 | /home/misael/rds-scratch/xe-c2-amostras/s1-objdump-bruto.txt (FORA do indice) |
| s2-objdump-bruto.txt | cf067bc2f1ecf9ae59ad5b4cf3adec788a69d6501a578aa3943508e253ffa6b4 | /home/misael/rds-scratch/xe-c2-amostras/s2-objdump-bruto.txt (FORA do indice) |
| serie-bruta.txt | e3f749d107862dbba59a5baed8dbac3852c3c7ddddab927176a2d187f9a56369 | /home/misael/rds-scratch/xe-c2-amostras/serie-bruta.txt (FORA do indice) |
| censo-iscas.redigido.json | 6c446c292824c7e5a7256046abca9e0e1a6ca3862503157df1660d8a3b8954ef | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/censo-iscas.redigido.json (versionado) |
| r1.redigido.json | d97cde0adc9f0eec654aa02bec5ff885d23067206de16faf592117b220d963d4 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r1.redigido.json (versionado) |
| r2.redigido.json | 524dd70740723b46566a5aabde775ea0ad7a165ca83599093bd4cb16d81cded3 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r2.redigido.json (versionado) |
| r3.redigido.json | c47f0f10b34fd840772ed542164088e2a9beef91c2c445f60db952b28367cfea | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/r3.redigido.json (versionado) |
| s1.redigido.json | 110e5cda4f22be65e646ea7027d2ffb3fdf9751f2f06ae56518253709f657ad3 | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/s1.redigido.json (versionado) |
| s2.redigido.json | bb6db8baaa9d644d918364588c3c5b90c7d81fd4d3517123ce32361824c0a06a | /home/misael/RDS-REX-PARALLEL-C-2026-10-04/data/rex_profiles/parallel_recovery_20261004/c/evidence/s2.redigido.json (versionado) |
