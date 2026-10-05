/* fx09_matriz_isa — MATRIZ AUTORAL de chamadas, saltos, endereços curtos e
 * relativos (EXPECTATIONS-ETAPA2.md §1, linhas M1..M14).
 *
 * FIXTURE AUTORAL: não é recorte de ROM nem forma geométrica no lugar de
 * conteúdo; é código escrito para expor cada linha da matriz. As formas que o
 * montador pinado produz entram por mnemônico (o comprimento e os bytes ficam
 * na referência `fx09_matriz_isa-objdump.txt`); as que `-m68000` não emite
 * (BSR.L/ JMP com extensão 68020) entram por `.short` com o motivo declarado
 * na linha. Cada linha é uma rotina própria: [instrução da matriz][nop][rts],
 * de modo que a raiz declarada no teste seja o rótulo `mNN` e o caminho desta
 * linha não dependa da linha anterior.
 *
 * O que a matriz discrimina (defeitos medidos na frente A, briefing obl. 3):
 *   M1/M2   BSR curto (2 bytes) vs. BSR palavra (4 bytes) — A não modela o
 *           curto e leria os dois bytes seguintes como d16;
 *   M3      `61 FF` é forma 68020; o instrumento resolve a base em instr+2,
 *           a tabela de A afirma instr+4;
 *   M8/M9   `4E FA` = jmp d16(PC) (não jsr abs.W), `4E FC`/`4E FD` = extensões
 *           68020 que o instrumento recusa (não jmp abs.W/.L);
 *   M11     `0A 7C FC 00` = eori #imm,%sr (não movea.l #imm32,An); o MOVEA
 *           imediato real está em M10 (`2A 7C`);
 *   M4/M6/M12  endereço curto com bit15 ligado — regra P-absW (§1.1), onde a
 *           frente A declara zero-extensão como fato não provado por fonte
 *           primária.
 */
        .text
        .even
        .globl  fx09
fx09:
/* M1 — bsr.s: 2 bytes, disp8 com sinal, base = instr+2 (medido `61fe` = laço
 * em instr+2-2). Alvo +2 à frente para evitar disp8 = 0 (o montador recusa:
 * offset de byte nulo é o marcador da forma de extensão em word). */
m01:    bsrs    m01q
        nop
m01q:   rts

/* M2 — bsr.w positivo: 4 bytes, base = instr+2. */
        .even
m02:    bsr.w   suba
        nop
        rts

/* M2b — bsr.w negativo: disp16 com sinal, base = instr+2, alvo anterior. */
        .even
m02b:   bsr.w   m02
        nop
        rts

/* M3 — BSR.L (forma 68020; `-m68000` não a emite a partir de rótulo, então
 * entra como bytes: medido `61ff 0000 1234` = `bsrl 1236`, base instr+2).
 * Espera da ferramenta: fronteira, sem aresta e sem entrada em chamadas. */
        .even
m03:    .short  0x61ff, 0x0000, 0x1234
        nop
        rts

/* M4 — jsr (xxx).W com bit15 do endereço ligado: 4 bytes comprovados, operando
 * bruto 0x8000; instrumento EXIBE ffff8000 (P-absW, §1.1). Alvo fora da
 * região do fixture => aresta chamada com status fora-da-regiao. */
        .even
m04:    jsr     0x8000:w
        nop
        rts

/* M5 — jsr (xxx).L a rótulo dentro da região: 6 bytes, alvo literal. */
        .even
m05:    jsr     suba:l
        nop
        rts

/* M6 — jmp (xxx).W com bit15: 4 bytes, aresta de desvio SEM queda. */
        .even
m06:    jmp     0x8000:w
        nop
        rts

/* M7 — jmp (xxx).L: 6 bytes, alvo 0x800000 (dentro do barramento de 24 bits,
 * fora da região). */
        .even
m07:    jmp     0x800000:l
        nop
        rts

/* M8 — jmp d16(PC): forma 68000 VÁLIDA, porém fora da lista fechada (§3 só
 * autoriza abs.W/abs.L para JMP/JSR). A frente A rotula estes bytes como
 * `jsr abs.w` e publica um alvo inventado (medido na ROM em 0x66A40). */
        .even
m08:    jmp     0x1234(%pc)
        nop
        rts

/* M9a/M9b — extensões %100/%101 do modo 7 (d8(PC,Xn) e (xxx,PC)) = 68020;
 * o instrumento não as decodifica (`.short 0x4efc` / `.short 0x4efd`). A
 * tabela de A afirma `jmp abs.w = 4EFC` e `jmp abs.l = 4EFD`. */
        .even
m09a:   .short  0x4efc
        nop
        rts
        .even
m09b:   .short  0x4efd
        nop
        rts

/* M10 — movea.l #imm32,An (`2a7c`): imediato como FONTE. §3 só autoriza
 * imediato em MOVE, portanto aqui é fronteira; em nenhum caso consumidor. */
        .even
m10:    movea.l #0x12345678,%a5
        nop
        rts

/* M11 — a forma que A chama `movea.l #imm32,An = 0A?? FC`: medida pelo
 * instrumento como `eoriw #-1024,%sr`. A ferramenta aceita ou recusa, mas
 * NUNCA produz MOVEA nem consumidor. */
        .even
m11:    eori    #0xfc00,%sr
        nop
        rts

/* M12 — lea (xxx).W,%a0 com bit15: comprimento 4 comprovado; nenhuma alegação
 * de efetividade do endereço (P-absW). */
        .even
m12:    lea     0x8000:w,%a0
        nop
        rts

/* M13 — lea d16(PC),%a0: 4 bytes, destino = instr+2+d16 com disp NEGATIVO
 * (a única linha da tabela de A que converge com a medida). */
        .even
m13:    lea     m06(%pc),%a0
        nop
        rts

/* M14a — Scc com disp-like: `51c3` = `sf %d3`, 2 bytes. Um decoder que ler
 * `51c3` como DBcc engole a word seguinte (comprimento 4 inventado). */
        .even
m14a:   sf      %d3
        nop
        rts

/* M14b — DBcc com disp16 negativo: arestas taken (instr+2+disp) e queda. */
        .even
m14b:   dbra    %d3,m14b
        nop
        rts

/* sub-routine compartilhada dos alvos de chamada (M2/M2b/M5). */
        .even
suba:   moveq   #1,%d0
        rts
