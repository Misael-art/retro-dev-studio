# HISTÓRICA — rodada anterior da PR #110 (commit de código `5f778f7e`, binário `45dabcb3…`)

Superada por `../evidencia-pr110/` (ver `MANIFEST.json`). Mantida só como registro do que foi provado **naquela** rodada, antes
de três correções: aplicador BPS estrito, exclusividade do core e as melhorias de CX. Não vale para o código atual.

- Aquele `export.bps` usava varint fora da especificação BPS no momento da captura inicial e foi **retirado do Git** junto com as
  4 capturas de tela (mostravam quadros do jogo comercial): pela política (AGENTS.md; Memory Bank "sem pixels/ROM/corpus BYOR no Git")
  esses derivados ficam fora do repositório. Eles continuam no histórico dos commits anteriores desta PR (não houve reescrita de
  histórico nem push forçado); remover do histórico exige decisão do dono do repositório (squash ou reescrita).
- Os dois relatórios JSON remanescentes (`jornada-nativa-report.json`, `oraculo-efeito.json`) contêm só hashes e coordenadas.
- O `SHA256SUMS` desta pasta descreve o estado anterior e não cobre os arquivos retirados.
