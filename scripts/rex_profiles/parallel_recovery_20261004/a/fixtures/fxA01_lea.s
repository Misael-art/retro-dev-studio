/* fxA01_lea — formas LEA do subconxunto declarado (fixture autoral, letra A).
 *
 * Retificacion 68000, 2026-10-04. Ningun byte desta fixture proviene dunha
 * ROM comercial; enderezos e deslocamentos escollidos para discriminar as
 * regras medidas co instrumento (m68k-elf-as/objdump binutils 2.41):
 *   - `lea ($xxx).w` FAI extension de sinal: bit15=1 -> endereco efectivo
 *     0xFFFF8000 (non 0x00008000); bit15=0 -> 0x0000xxxx.
 *   - `lea (d16,%pc)` usa base = direccion da palabra de extension (sitio+2)
 *     e d16 signado, en positivo e negativo.
 */
        .text
        .even
        .globl  fxA01
fxA01:
        lea     0x12345678:l,%a0   /* lea.abs.L: 40 f9 12 34 56 78 (6 bytes) */
        lea     0x8000:w,%a1       /* bit15 ligado: espera ffff8000 efectivo */
        lea     0x7f00:w,%a2       /* bit15 apagado: espera 00007f00 */
        lea     (8,%pc),%a3       /* d16 positivo, base = sitio + 2 */
        lea     (-6,%pc),%a4      /* d16 negativo, base = sitio + 2 */
        nop
fxA01_fin:
