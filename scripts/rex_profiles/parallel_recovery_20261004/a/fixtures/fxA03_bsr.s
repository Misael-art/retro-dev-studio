/* fxA03_bsr — BSR curto (8 bits) e forma de deslocamento de palabra.
 *
 * Fixture autoral (letra A, retificacion 68000, 2026-10-04). Defecto
 * corrixido: o decoder antigo consumia SEMPRE 4 bytes para calquera `61 dd`,
 * comendo BSR.S de 2 bytes como se fose de palabra. Medido co instrumento:
 *   `61 dd` (dd != 00, dd != FF) = BSR.S, lonxitude 2, alvo = sitio + 2 + d8.
 *   `61 00 dd dd`                 = BSR con d16 (extension de 68010+,
 *                                    perfil declarado md68000-chain16 da
 *                                    RECTIFICACION), lonxitude 4,
 *                                    alvo = sitio + 2 + d16.
 * `61 FF` (BSR.L, familia 68020+) fica FORA do perfil: recusa explícita.
 * `bsr` sen sufixo: o montador escolhe a forma el mesmo — rexistrase o que
 * produce, non se acepta como contrato.
 */
        .text
        .even
        .globl  fxA03
fxA03:
        bsr.s   adiante           /* 61 dd curto positivo, 2 bytes */
        bsr.w   adiante           /* 61 00 dd dd, 4 bytes */
        bsr.s   fxA03             /* curto HACIA TRAS: d8 negativo */
        bsr.w   fxA03             /* palabra HACIA TRAS: d16 negativo */
        bsr     adiante           /* eleccion automatica do montador */
        nop
        nop
        nop
        nop
        nop
        nop
adiante:
        rts
