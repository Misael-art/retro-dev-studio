# Proposta — libretro alternativa com endereço de execução — 2026-10-10

Estado: **avaliação futura**. Não está implementada. Não altera o core, o binário, o motor congelado nem as provas já registradas.

O Genesis Plus GX embutido continua sendo o runtime das provas atuais. Uma segunda biblioteca pode coexistir. Ela só passa a valer para afirmações medidas nela, com identidade própria de binário. O que já foi medido no binário `40c98750dacc3086407cda8ac6f15e3b66660bd70be9d514f1eb387c6347fc25` permanece válido para esse binário.

## O que se quer

Amostrar, durante o jogo, o contador de programa do 68000 e associar essa amostra a um episódio observado (aperto, mudança de RAM, quadro). O nome dado pelo jogador continua declaração do autor. O endereço é observação do core alternativo. Os dois não formam, sozinhos, a rotina recuperada.

Isto é a opção B de `docs/14_REX_ARQUITETURA_UNIVERSAL.md`: core com gancho de PC. Continua dependência nova, com licença e manutenção, e só entra com aprovação explícita. O documento de arquitetura não foi reescrito.

## O que a pesquisa de 2026-10-10 encontrou

Nenhuma libretro publicada entrega o contador de programa ao aplicativo. A API libretro não tem essa chamada. Um core pode publicar uma função extra por `retro_get_proc_address`.

| Candidato | Fato | Limite |
|---|---|---|
| Genesis Plus GX (core atual) | O 68k já guarda `m68k.pc` e `prev_pc`. O Musashi tem `HOOK_CPU`, um gancho por instrução com o PC. Os builds libretro publicados deixam o gancho desligado. | Recompilar o mesmo core, gravar um anel de PCs ao longo do quadro e publicar a leitura. O PC só no fim do quadro cai na espera de VBlank e não identifica a rotina do episódio. |
| BlastEm libretro (`libretro/blastem`) | O executável de linha de comando tem depurador e stub GDB (`-d`, `-D`, breakpoint, backtrace). | Esse depurador não atravessa o frontend libretro. É outro emulador. |
| ClownMDEmu libretro (v1.6.12) | Opções de depuração desligam planos de vídeo e canais FM. | O README da versão libretro exclui os menus de depuração. É outro emulador, AGPLv3. |

A sonda do Sgdk Forge (`pc_profile.c`, interrupção horizontal que lê o PC empilhado) é outra técnica: o tratador é compilado dentro da ROM. Serve a um jogo SGDK reconstruído. Não se instala no Sonic comercial sem alterar a ROM e a interrupção horizontal que o jogo já usa.

## Licença, se a candidata for o Genesis Plus GX

A licença de Eke-Eke e Charles MacDonald permite redistribuir obra derivada com o fonte completo, e proíbe venda e uso em produto ou atividade comercial. Uma build modificada carrega esse dever. BlastEm e ClownMDEmu têm outras licenças e não herdam as provas feitas no GX.

## O que uma avaliação futura precisa fechar antes de medir

- Aprovação da dependência e o registro em `docs/02_TECH_STACK.md`.
- A biblioteca alternativa é um segundo runtime, com SHA próprio. As jornadas do binário `40c98750…` não são reclassificadas nem repetidas só por existir a alternativa.
- Granularidade: anel ao longo do quadro, não um único PC no fim do quadro. Dizer quantas amostras cabem num quadro e o que fica de fora.
- A amostra de PC é observação de endereço. Consumo da rotina, efeito e causalidade por edição continuam níveis separados.
- O nome do jogador permanece origem declarada.
- Não alarga a ISA, não cria outra classe e não substitui o analisador congelado.

## Fora desta proposta

Não implementa o gancho. Não troca o core das provas atuais. Não afirma desmontagem da ROM nem decompilação universal.
