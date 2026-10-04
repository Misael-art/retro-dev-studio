/* fx05_indirect — chamadas indiretas permanecem desconhecidas (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx05_indirect`: `jmp (An)` e `jsr (d16,An)`
 * produzem ponto-de-fronteira `indirect-opaque`, com entrada em `chamadas` de
 * `alvo = nulo` e `status = indireto-opaco`, e NENHUM alvo sugerido.
 *
 * Como o caminho para no desvio indireto, o segundo caso precisa de uma segunda
 * raiz explicita na CLI (`--root fx05 --root fx05b`): e assim que o teste
 * exercita os dois formas sem fingir continuidade.
 */
        .text
        .even
        .globl  fx05
fx05:   moveq   #0,%d0
        jmp     (%a2)         /* alvo desconhecido: caminho interrompido */
        .even
        .globl  fx05b
fx05b:  moveq   #1,%d1
        jsr     16(%a1)       /* chamada indireta: alvo = nulo no export */
        nop                   /* queda jamais alcancada por esta analise */
        rts
