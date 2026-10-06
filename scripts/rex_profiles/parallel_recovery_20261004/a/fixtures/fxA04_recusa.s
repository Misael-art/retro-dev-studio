/* fxA04_recusa — sondas da LISTA DE RECUSA (fixture autoral, letra A).
 *
 * Este arquivo NON e un fixture aceptable: cada sonda esta nun bloco
 * comentado cun `#if` de documento. A ferramenta make-fixtures-a.sh monta
 * cada sonda por separado cun `m68k-elf-as -m68000` e Garda a SAIDA DE
 * ERRO como proba de que a forma non pertence ao perfil declarado
 * (mc68000 + extension chain16). Se algunha assembly con éxito, a
 * RECTIFICACION debe reabrirse — ese e o discriminante, non un fracaso.
 *
 *   S1  bsr.l al        -> 68020+ (61 FF); binutils -m68000 RECHAZA
 *   S2  lea ($1234).w con destino > 0xFFFFFF en modo .l: non e sonda de
 *       montador — a recusa e do decoder (AlvoForaBarramento).
 *
 * S3  dbf.b/dbrb e `bra`/`beq` con desplazamento: fora do subconxunto
 *       declarado (o montador assembla; e o noso decoder o que recusa con
 *       motivo estable). Rexistrase a forma verdadeira:
 *   S4  jmp (%a0) = 4e d0, jsr (%a2) = 4e 92: indirectos por rexistro —
 *       assemblan en 68000 pero o subconxunto recusaos (NonForma coñecida,
 *       motivo estable `fora-de-subconxunto`).
 */
        .text
        .even
        .globl  fxA04
fxA04:
        jmp     (%a0)             /* S4: 4e d0 — recusa por subconxunto */
        jsr     (%a2)             /* S4: 4e 92 — recusa por subconxunto */
        bra     fin               /* S3: 60 — recusa por subconxunto */
        beq     fin               /* S3: 67 — recusa por subconxunto */
        dbf     %d3,fin           /* S3: 51 cb — recusa por subconxunto */
        nop
fin:
        rts
