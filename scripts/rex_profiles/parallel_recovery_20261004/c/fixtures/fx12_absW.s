/* fx12_absW — operandos absolutos curtos com bit15 ligado e desligado, montados
 * pelo INSTRUMENTO pinado (EXPECTATIONS-ETAPA3.md §5, negativos N1 e N2).
 *
 * FIXTURE AUTORAL. O que existe aqui de não-trivial é a codificação: cada linha
 * foi medida com `m68k-elf-as -m68000` + `m68k-elf-ld -Ttext 0` e o alvo que o
 * `objdump` imprime está registrado em `fx12_absW-objdump.txt`, que é a
 * referência independente consumida pelos testes. Nada deste arquivo foi escrito
 * a partir do decoder da frente C.
 *
 * Medido na sonda `rds-scratch/xe-c3-e5-probe/` (2026-10-05):
 *
 *   jsr 0x8000:w     ->  4eb8 8000      objdump: `jsr ffff8000`
 *   jsr 0xffff:w     ->  4eb8 ffff      objdump: `jsr ffffffff`
 *   jsr 0x7fff:w     ->  4eb8 7fff      objdump: `jsr 7fff`
 *   jsr 0x1:w        ->  4eb8 0001      objdump: `jsr 1`
 *   jmp 0x8000:w     ->  4ef8 8000      objdump: `jmp ffff8000`
 *   jmp 0xffff:w     ->  4ef8 ffff      objdump: `jmp ffffffff`
 *   jmp 0x7fff:w     ->  4ef8 7fff      objdump: `jmp 7fff`
 *   jmp 0x1:w        ->  4ef8 0001      objdump: `jmp 1`
 *
 * O sufixo `:w` é obrigatório: sem ele o montador escolhe sozinho a forma
 * relativo ao PC, que a lista fechada do CONTRACT §3 não autoriza para
 * JMP/JSR — mesmo motivo já registrado em `fx04_calls.s`. Os alvos são literais
 * numéricos, não rótulos: um rótulo em `0x8000` exigiria estofar o arquivo até
 * lá e o `objcopy -j .text` produziria um fixture de 32 KiB.
 *
 * Dois blocos separados porque `jmp` é terminador: o bloco A (`jsr`) continua o
 * fluxo linha a linha e é alcançado pela raiz de entrada; o bloco B (`jmp`) é
 * consultado com raiz declarada no próprio sítio. Os quatro valores de alvo são
 * os de §5 N1, e o `0x1` fica possível porque os testes mapeiam este objeto com
 * `--origin` alto (0x80000), de modo que TODOS os alvos caem fora da região —
 * nenhum raiz derivada em endereço ímpar, nenhum corpo de rotina inventado.
 */
        .text
        .even
        .globl  fx12
/* ---- bloco A: JSR (xxx).W / (xxx).L — o fluxo continua após cada chamada ---- */
fx12:   jsr     0x8000:w
        jsr     0xffff:w
        jsr     0x7fff:w
        jsr     0x1:w
        rts
/* ---- bloco B: JMP (xxx).W — transferências incondicionais, uma por raiz ---- */
        .even
fx12b:  jmp     0x8000:w
        .even
fx12c:  jmp     0xffff:w
        .even
fx12d:  jmp     0x7fff:w
        .even
fx12e:  jmp     0x1:w
