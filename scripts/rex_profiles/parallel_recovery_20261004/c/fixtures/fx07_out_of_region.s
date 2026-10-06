/* fx07_out_of_region — desvio cujo alvo passa do fim da regiao (frente C).
 *
 * EXPECTATIONS-ETAPA1.md, linha `fx07_out_of_region`: aresta `desvio` com
 * `status = fora-da-regiao`, nenhum byte fora da regiao decodificado e
 * fronteira registrada no endereco da instrucao de salto.
 *
 * O teste roda com `--region 0x0:0x12`: a cabeca de `fx07` cabe, `longe` fica
 * em ~0x110, portanto fora. Os 0x100 bytes de `.space` entre os dois nunca sao
 * tocados pela analise.
 */
        .text
        .even
        .globl  fx07
fx07:   moveq   #0,%d0
        beq.w   longe
        nop
        rts
        .space  0x100
        .even
longe:  moveq   #1,%d1
        rts
