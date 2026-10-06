/* fxA02_calls — chamadas absolutas e relativas do subconxunto declarado.
 *
 * Fixture autoral (letra A, retificacion 68000, 2026-10-04). O instrumento
 * (m68k-elf-as + m68k-elf-objdump, binutils 2.41) fixou as formas:
 *   jsr abs.L = 4E B9 | jsr abs.W = 4E B8 | jsr (d16,PC) = 4E BA
 *   jmp abs.L = 4E F9 | jmp abs.W = 4E F8 | jmp (d16,PC) = 4E FA
 * As duas formas indirectas por rexistro (jmp (An)/jsr (An)) están FORA do
 * subconxunto declarado: inclúense para probar recusa explícita, non para
 * seren aceptadas. Medido (2026-10-04): `jsr/jmp 0x9400:w` imprimense como
 * alvos ffff9400 — o instrumento interpreta extension de sinal tamén nos
 * absolutos curtos de chamada, igual que en `lea .w` (ver fxA01).
 */
        .text
        .even
        .globl  fxA02
fxA02:
        jsr     0x12345678:l      /* 4e b9 12 34 56 78 */
        jsr     0x9400:w          /* 4e b8 94 00 */
        jsr     (4,%pc)           /* 4e ba — base = sitio + 2 */
        jmp     0x12345678:l      /* 4e f9 12 34 56 78 */
        jmp     0x9400:w          /* 4e f8 94 00 */
        jmp     (4,%pc)           /* 4e fa — base = sitio + 2 */
        jmp     (%a0)             /* 4e d0 (medido) — FORA do subconxunto: recusa */
        jsr     (%a2)             /* 4e 92 (medido) — FORA do subconxunto: recusa */
        nop
fxA02_fin:
