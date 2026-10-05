/**
 * Codificação 68000 usada pela barra D para autorar fixtures das frentes.
 * Cada par (mnemônico → bytes) foi ancorado em `calib-objdump.txt`
 * (registro do instrumento externo `m68k-elf-objdump`, binutils do host da
 * frente C) ou em `1031 2000` medido no adendo C §A. Nada aqui vem de
 * `src/decode.rs` de A ou C: é tabela de arquitetura, verificável byte a byte.
 *
 * Formato MOVE: [15-12]=op+size, [11-9]=reg destino, [8-6]=modo destino,
 * [5-3]=modo origem, [2-0]=reg origem. Modos: 000 Dn, 001 An, 010 (An),
 * 011 (An)+, 100 -(An), 101 d16(An), 110 d8(An,Xn), 111: 001 abs.W,
 * 010 abs.L, 011 d16(PC), 100 abs.short(68010), 111 #imediato.
 * LEA/MOVEA.L: [15-12]=0100, [11-9]=An, [8]=1, [7-5]=111, [4-2]? — na prática:
 * `4xF9 abs.L`, `4xF8 abs.W`, `4xFA d16(PC)`, `4xE9 d16(An)` (calib `45E9`).
 */

export function w16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(v & 0xffff);
  return b;
}

export function w32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(v >>> 0);
  return b;
}

/** Palavras de extensão indexadas 68000: [15]=I (0=Dn,1=An), [14-12]=índice,
 *  [11]=W/L (0=W), [10-8]=escala (0 em 68000), [7-0]=disp8.
 *  Âncora medida: `1031 2000` = move.b d8(A1,D2.W),D0 (disp 0, D2, W). */
export function extIdx({ disp = 0, reg = 0, areg = false, long = false } = {}) {
  let v = (areg ? 1 : 0) << 15;
  v |= (reg & 0b111) << 12;
  v |= (long ? 1 : 0) << 11;
  v |= disp & 0xff;
  return w16(v);
}

/** Âncoras exatas conferidas no calib-objdump (não substituir por derivadas). */
export const CALIB = Object.freeze({
  moveb_a0p_d1: "1218",            // move.b (A0)+,D1
  moveb_a2m_d3: "1622",            // move.b -(A2),D3
  moveb_a4_d5: "1a14",             // move.b (A4),D5
  moveb_d16a1_d2: "14290010",      // move.b d16(A1),D2
  moveb_d1_a0p: "10c1",            // move.b D1,(A0)+
  moveb_d5_a4: "1885",             // move.b D5,(A4)
  moveb_d2_d16a1: "13420010",      // move.b D2,d16(A1)
  movew_a3_d6: "3c13",             // move.w (A3),D6
  movew_d6_d16a2: "35460010",      // move.w D6,d16(A2)
  movel_imm_d4: "283c12345678",    // move.l #imm32,D4
  lea_d16pc_a5: "4bfa0040",        // lea d16(PC),A5
  movel_d16pc_d0: "203a0010",      // move.l d16(PC),D0
  moveq_15_d4: "780f",             // moveq #15,D4
  movew_sr_d6: "40c6",             // move.w SR,D6
  addqb_4_a3: "5813",              // addq.b #4,(A3)
  addqw_1_d3: "5243",              // addq.w #1,D3
  addl_d2_a1: "d591",              // add.l D2,(A1)
  cmpw_a2_d0: "b052",              // cmp.w (A2),D0
  bclr_2_a1: "08910002",           // bclr #2,(A1)
  tstw_abs_l: "4a7900a1000c",      // tst.w abs.L
  bra_w: "6000006a",               // bra.w d16
  bcc_w: "64000060",               // bcc.w d16
  bcc_b: "6460",                   // bcc.b d8
  bsr_w: "6100006a",               // bsr.w d16
  rts: "4e75",
  nop: "4e71",
  jmp_abs_l: "4ef912345678",       // jmp abs.L
  jmp_abs_w: "4ef81234",           // jmp abs.W
  jsr_abs_l: "4eb912345678",       // jsr abs.L
  jsr_abs_w: "4eb81234",           // jsr abs.w
  jmp_a2_ind: "4ed2",              // jmp (A2)
  trap_4: "4e44",                  // trap #4
  dbf_d0_ext: "51c0fffe",          // dbf D0, d16 (base = opcode+2)
  dbge_d2_ext: "5cca0028",         // dbge D2, d16
  movep_a0i16_d2: "05080010",      // move.p d16(A0),D2 (68010+ — fora do 68000)
  linef_f000: "f000",              // linha-F (fora do subconjunto)
  illegal_4afc: "4afc",            // illegal
  moveb_idx_a1_d2w: "10312000",    // move.b d8(A1,D2.W),D0 — medido C §A
  movel_a0p_a3: "2658",            // move.l (A0)+,A3 (MOVEA)
  moveal_imm_a1: "227c00001111",   // movea.l #imm32,A1 (fx06-objdump)
  lea_abs_l_a0: "41f900072e7c",    // lea abs.L,A0
  lea_d16a1_a2: "45e90010",        // lea d16(A1),A2
  seq_d1: "57c1",                  // seq D1
});

/** move.b (A0)+,(A1)+ = 0x12D8 — derivado da regra MOVE e espelhado no
 *  padrão `32d8` (move.w (A0)+,(A1)+) registrado pela frente B nos bytes do
 *  consumidor; a âncora estrutural é `1218`/`10c1` do calib. */
export const MOVEB_A0P_A1P = Buffer.from("12d8", "hex");
export const MOVEW_A0P_A1P = Buffer.from("32d8", "hex");
export const LEA_64_A1_A1 = Buffer.concat([Buffer.from("43e9", "hex"), w16(0x0040)]);
export const MOVEW_0_D0 = Buffer.concat([Buffer.from("303c", "hex"), w16(0)]);
export const JSR_171E_L = Buffer.concat([Buffer.from("4eb9", "hex"), w32(0x171e)]);

/** moveq #imm8,Dn: `7n II` (âncora calib `780f`). */
export function moveq(imm, dn) {
  return w16(0x7000 | ((dn & 7) << 9) | (imm & 0xff));
}

/** Forma `4xFx` de LEA/MOVEA.L com An: cabeça = `0x41C0 | (An<<9) | campo`,
 *  campos âncora: `F9` abs.L, `F8` abs.W, `FA` d16(PC).
 *  Conferido byte a byte: A0→`41F9…` (CALIB `lea_abs_l_a0`),
 *  A5→`4BFA 007C` (r2-objdump linha 0x216), A1→`43F8 9400` (FA-7 de A). */
export const LEA = Object.freeze({
  absL(an, addr) {
    return Buffer.concat([w16(0x41C0 | ((an & 7) << 9) | 0x39), w32(addr)]);
  },
  absW(an, addr) {
    return Buffer.concat([w16(0x41C0 | ((an & 7) << 9) | 0x38), w16(addr & 0xffff)]);
  },
  d16pc(an, disp) {
    return Buffer.concat([w16(0x41C0 | ((an & 7) << 9) | 0x3A), w16(disp & 0xffff)]);
  },
});

/** ISA real 68000 (âncoras objdump pinadas em CALIB): jsr abs.W=`4EB8`,
 *  jsr abs.L=`4EB9`, jmp abs.W=`4EF8`, jmp abs.L=`4EF9`. Usado nos fixtures
 *  da frente C e nos sítios do consumidor B. */
export const CALL = Object.freeze({
  bsrW(disp) {
    return Buffer.concat([w16(0x6100), w16(disp & 0xffff)]);
  },
  jsrL(addr) {
    return Buffer.concat([Buffer.from("4eb9", "hex"), w32(addr)]);
  },
  jsrW(addr) {
    return Buffer.concat([Buffer.from("4eb8", "hex"), w16(addr)]);
  },
  jmpL(addr) {
    return Buffer.concat([Buffer.from("4ef9", "hex"), w32(addr)]);
  },
  jmpW(addr) {
    return Buffer.concat([Buffer.from("4ef8", "hex"), w16(addr)]);
  },
});

/** Gramática CONGELADA da frente A (CONTRATO-A/EXPECTATIONS-A §3):
 *  `bsr.w` base=sitio+2, `bsr.l` = `61FF`+disp32 base=sitio+4,
 *  `jsr .W` = `4EFA` e `jmp .L` = `4EFD`, `jmp .W` = `4EFC` — que DIVERGEM
 *  do ISA real (`4EB8`/`4EF9`/`4EF8`). As sondas KA1 medem A contra a própria
 *  alegação dela; misturar as duas tabelas invalidaria a matriz. */
export const AGRAMA = Object.freeze({
  bsrW(disp) {
    return Buffer.concat([w16(0x6100), w16(disp & 0xffff)]);
  },
  bsrL(disp) {
    return Buffer.concat([w16(0x61ff), w32(disp >>> 0)]);
  },
  jsrL(addr) {
    return Buffer.concat([Buffer.from("4eb9", "hex"), w32(addr)]);
  },
  jsrW(addr) {
    return Buffer.concat([Buffer.from("4efa", "hex"), w16(addr)]);
  },
  jmpL(addr) {
    return Buffer.concat([Buffer.from("4efd", "hex"), w32(addr)]);
  },
  jmpW(addr) {
    return Buffer.concat([Buffer.from("4efc", "hex"), w16(addr)]);
  },
});
