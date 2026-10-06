#!/usr/bin/env bash
# ETAPA 3 §4 — sonda de segunda opinião sobre a CPU-alvo (obrigacao 6).
#
# O arbitro da varredura E4 e o `objdump` pinado, que e GENERICO (monta e le
# formas 68010/68020/68040). Para separar "esta forma nao existe no MC68000" de
# "esta forma existe mas nao esta na lista fechada do contrato" usamos o GAS do
# mesmo toolchain com `-m68000` explicito: ele recusa mnemonicos e combinacoes de
# operandos que a CPU-alvo nao tem. As duas opinioes juntas sao o que permite
# escrever uma linha na tabela de recusas declaradas sem apelar para memoria.
#
#   bash tools/sonda-as-68000.sh > ~/rds-scratch/sonda-as-68000-v2.txt
#
# AVISO DE METODO (registro de defeito proprio, 2026-10-05): a sonda anterior
# gerava o fonte com `printf "\t$f\n"`, e o GAS usa `%` como prefixo de registro
# (`%a0`, `%d1`). `printf` comeu cada `%aN` como especificador de formato e o
# arquivo montado saiu vazio ou truncado — o resultado foi uma lista de "recusas"
# falsa, incluida depois em rotulos de teste. Este script NAO usa printf sobre o
# texto do instrutor: escreve cada forma com um `cat` de heritedoc, uma forma por
# arquivo, e so da por montada a forma que (a) sai 0 do GAS e (b) tem o mnemonico
# pedido de volta no `objdump -d` do objeto. O fonte sai de um `cat` de heredoc,
# que nao interpreta `%` — por isso o texto do instrutor nunca passa por `printf`.
set -uo pipefail

TC="${M68K_TOOLCHAIN:-/home/misael/.cache/retrodevstudio/17f7bcf517f26552031e29fb2e06e0e20ef14025bf5e515705f318c603dfa911/source-build-m68k_gcc/source/install/bin}"
AS="$TC/m68k-elf-as"
OBJDUMP="$TC/m68k-elf-objdump"
[ -x "$AS" ] || { echo "ERRO: instrumento ausente: $AS (defina M68K_TOOLCHAIN)" >&2; exit 1; }

DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
idx=0

# Uma forma por linha. Os grupos de comentarios dao o motivo de a forma estar
# aqui: cada linha alimenta uma ou mais linhas da tabela de recusas declaradas.
FORMAS=(
    # familia ss=%11 com fonte em registrador direto (ADDA/SUBA/CMPA x MUL/DIV)
    'suba.w %a0,%a0'
    'suba.l %a1,%a2'
    'adda.w %a0,%a1'
    'adda.l %a0,%a1'
    'cmpa.w %a0,%a1'
    'cmpa.l %a3,%a4'
    'mulu.w %a0,%d0'
    'muls.l %a0,%d0'
    'divu.w %a1,%d2'
    'divs.l %a1,%d2'
    'adda.w #8,%a0'
    'suba.l #8,%a1'
    'cmpa.w #8,%a2'
    # grupos OR/SUB/CMP/AND/ADD com fonte An direta (PRM tabela 3-9)
    'sub.w %a0,%d1'
    'add.l %a0,%d1'
    'or.b %a0,%d1'
    'and.l %a0,%d1'
    'cmp.b %a0,%d1'
    'eor.b %a0,%d1'
    'move.w %a0,%d1'
    'move.l %a0,%d1'
    'move.b %a0,%d1'
    'move.b %d0,%a0'
    'movea.w %a0,%a1'
    'movea.b %a0,%a1'
    'move.l #8,%a0'
    # imediato como destino
    'ori.w #3,%a0'
    'ori.l #3,%a0'
    'addi.b #3,%a0'
    # seis familias de op1-imediato com destino An direta (prm 4-154 l.11259-11267:
    # "Only data alterable addressing modes", com a linha `An — —`)
    'ori.b #3,%a0'
    'andi.l #3,%a0'
    'subi.w #3,%a3'
    'addi.l #3,%a0'
    'eori.l #3,%a0'
    'cmpi.b #3,%a0'
    'cmpi.l #3,%a4'
    'ori.l #3,%d0'
    'ori.l #3,%a0@'
    'bset #3,%a0'
    'btst %d0,%a1'
    # unarios e familiares recusados na CPU-alvo
    'ext.l %d0'
    'ext.w %d0'
    'pack %d0,%d1'
    'unpack %d0,%d1'
    'addx.b %d0,%d1'
    'subx.l %a0@,%a1@'
    'abcd %a0@-,%a1@-'
    'sbcd %a0@,%a1@'
    'cmpm.l %a0@+,%a1@+'
    'exg %d0,%d1'
    'exg %a0,%a1'
    'movep.l %d0,%a0@(8)'
    'movep.w %d1,%a1@(8)'
    'negx.b %d0'
    'negx.l %a0@'
    'nbcd %a0@'
    'bkpt #3'
    'tas %d0'
    'tas %a0@'
    'mvs.b %d0,%d1'
    'mvz.l %d0,%d1'
    'rol.l %d0'
    'ror.l %d0'
    'roxl.w %d0'
    'roxr.b %d0'
    # grupo %1110 shift/rotacao: as quatro familias em registrador e em memoria,
    # e o tamanho da forma de memoria (prm 3.1.4 l.3605: "Memory shift and rotate
    # operations shift word operands one bit position only").
    'asl.w %a0@'
    'asr.w %a0@'
    'lsl.w %a0@'
    'lsr.w %a0@'
    'roxl.w %a0@'
    'roxr.w %a0@'
    'rol.w %a0@'
    'ror.w %a0@'
    'asl.l %a0@'
    'asl.w %a0@+'
    'asl.w (1234).w'
    'asl.w -(%a0)'
    'asl.w (8,%a0)'
    'asl.b #3,%d1'
    'asl.w %d2,%d1'
    'rol.b #3,%d1'
    'rol.w %d2,%d1'
    'roxl.b #3,%d1'
    'roxr.w %d1,%d0'
    'asl.l (16,%pc)'
    'asr.l #3,%d1'
    'moves.w %sr,%d0'
    'move.w %ccr,%d0'
    'move.w %usp,%a0'
    'stop #$2700'
    'trapv'
    'reset'
    'rtr'
    'cas.l %d0,%d1,%a0@'
    'chk #3,%d0'
    'chk.w #3,%d0'
    'tst.l #3'
    'scc %a0'
    'sf.b #3'
    'dbra %d0,#3'
    'lea %d0,%a1'
    'lea %a0,%a1'
    'lea %a0@,%a1'
    'lea %a0@+,%a1'
    'lea %a0@-,%a1'
    'pea %a0@'
    'pea #3'
    'pea %a0'
    'movem.l %d0,%a0@-'
    'movem.w %a0@+,%d0'
    'movem.l %d0,%d1'
    'jsr %a0@'
    'jmp %a0@'
    'jmp (8,%pc)'
    'move.l (8,%pc),%d0'
    'move.b (16,%pc),%d0'
    'ori.b #3,(16,%pc)'
    'btst #113,(8,%pc)'
    'dbt %d0,(8,%pc)'
    'mov3q #0,%d0'
    'eora.l #3,%a0'
    'clr.l %a0'
    'clr.l (16,%pc)'
    'link %a0,#4'
    'unlk %a0'
    'nop'
    'rts'
    'illegal'
    'fmove.l %fp0,%d0'
    # --- sondas addidas na terceira passada (2026-10-05): as linhas da tabela de
    # recusas que ainda nao tinham segunda opiniao medida. ---
    # grupo de shift: type %11 em registrador (ROL/ROR) e size %11 com <ea>
    'rol.l #3,%d0'
    'ror.b #3,%d0'
    'rol.w %d1,%d0'
    'asl.w (1234).w'
    'asr.w %a0@'
    'asl.l %a0@'
    # imediato como FONTE nos grupos de 2 operandos (b8=0, ea->Dn)
    'add.w #3,%d0'
    'or.b #3,%d1'
    'sub.l #3,%d2'
    'cmp.b #3,%d3'
    'eor.l #3,%d1'
    # familia X/BCD em registrador direto (grupo dos 960/704 words)
    'sbcd %d0,%d1'
    'abcd %d0,%d1'
    'addx.l %d0,%d1'
    'subx.w %d0,%d1'
    # Scc com destino Dn (lista 3) e com destino em modo invalido
    'scc %d0'
    'sf.b %d0'
    # --- passada 4 (2026-10-05): cada linha da tabela de recusas declaradas
    # precisa de saber QUAL metade do rotulo e regra de CPU-alvo e qual e apenas
    # a lista fechada de §3. As formas abaixo separam as duas coisas: se o alvo
    # MONTA, a recusa e limite de contrato e nao impossibilidade da maquina. ---
    # modo 7.3 = (d8,PC,Xn): existe no MC68000? (§3 so nomeia d8(An,Xn))
    'move.w (2,%pc,%d0),%d0'
    'move.w (2,%a0,%d0),%d0'
    'move.l (2,%pc,%d0.l),%d0'
    'pea (2,%pc,%d0)'
    'lea (2,%pc,%d0),%a0'
    'movem.l %d0,(2,%pc,%d1)'
    # op1 imediato com destino CCR/SR: real no alvo, e so com tamanho .W
    'ori.w #3,%sr'
    'andi.l #3,%sr'
    'eori.b #3,%ccr'
    # imediato/PC-relativo como destino nos grupos que fecham ai
    'cmpi.w #3,(16,%pc)'
    'addi.w #3,(16,%pc)'
    'bset #3,(16,%pc)'
    'btst %d0,(16,%pc)'
    'scc.b (16,%pc)'
    'seq.b (16,%pc,%d0)'
    'neg.l %a0'
    'clr.l (16,%pc,%d1)'
    'tst.l (16,%pc)'
    # --- passada 5 (2026-10-05): faltava segunda opiniao para as linhas da tabela
    # cujo rotulo mistura duas metades (CPU-alvo x lista fechada). Cada forma aqui
    # decide uma linha; as que o alvo MONTA provam que a recusa e de contrato, nao
    # de maquina. ---
    # postbyte de indice: 68000 exige bits 10-8 = %000; escala/tamanho estendido e
    # 68020. As tres formas abaixo separam o indice legal do campo estendido.
    'move.w (2,%a0,%d0.w),%d0'
    'move.w (2,%a0,%d0:l),%d0'
    'move.w (2,%a0,%d0:l:2),%d0'
    'pea (2,%pc,%d0:l:2)'
    'movem.l %d0,(2,%a0,%d1:l:2)'
    # fonte PC-relativa nos grupos gerais m->r / r->m (linhas "operando PC-relativo")
    'or.w (8,%pc),%d0'
    'add.w (8,%pc),%d1'
    'sub.l (8,%pc),%d2'
    'cmp.w (8,%pc),%d3'
    # bitop imediato com destino CCR/SR (linha "PC/CCR-SR/reservado")
    'bset #3,%sr'
    'bchg %d0,%ccr'
    # CHK com imediato nos dois tamanhos que o instrumento le (linha "chk imediato")
    'chk.l #3,%d0'
    # desvio com disp8 = 0xFF: o alvo tem BRA.B de 2 bytes com deslocamento -1?
    'bra.b #-1'
    'beq.b #-1'
    # campos de familia %100..%111 na forma de memoria do grupo %1110 (bitfield e
    # multiplicador-acumulador, lidos pelo instrumento como bf*/mac*)
    'bfextu %d1,%d1,%d1,%d4'
    'bfins %d1,%d1,%d1,%d4'
    'macl %d0,%d0'
    'mac %d0,%d0'
    # op1 imediato com tamanho %11 (lido pelo instrumento como callm/bitrev/byterev)
    'bitrev %d1,%d0'
    'callm %a0@'
    'rtm %a0@'
    # unario/move com tamanho %11 sobre CCR-SR-USP (linha "unario com tamanho %11")
    'move.l %sr,%d0'
    'move.l %ccr,%d0'
    'tas.b %a0@(8)'
    # EXT com operando de memoria (linha "EXT nao esta no subconjunto")
    'ext.w %a0@'
    # --- passada 6 (2026-10-05): fecha as linhas cuja classe ainda nao tinha
    # medicao propria. As quatro primeiras conferem a assercao escrita no
    # comentario de `src/decode.rs` (`bset %d0,(16,%pc)` recusado) contra o
    # montador, porque a sonda antiga so media `btst` na mesma forma. ---
    'bset %d0,(16,%pc)'
    'bset %d0,(16,%pc,%d1)'
    'bset %d0,(1234).w'
    'btst #3,(16,%pc,%d1)'
    'bclr #3,(16,%pc)'
    # MOVEP com An-direto (mesma linha de tabela que `modo %001`)
    'movep.l %d0,%a0'
    # Tamanhos que o alvo EMITE nas familias em que recusamos campo %11: se o
    # montador so produz %00/%01/%10, um word com %11 nao e producivel no alvo.
    'clr.l %d0'
    'clr.b %d0'
    'tst.l %d0'
    'not.l %d0'
    'neg.l %d0'
    'ori.w #3,%d0'
    'cmpi.l #3,%d0'
    'addq.l #3,%d0'
    # Scc/MOVEM/LEA/PEA nas formas que as linhas respectivas nomeiam
    'scc.b (1234).w'
    'sf %a0@'
    'movem.l %d0,%a0'
    'lea (8,%pc),%a0'
    'lea (0x1234).w,%a0'
    'pea (0x1234).w'
    # JSR/JMP com absoluto curto (linha de alvo nao comprovado)
    'jsr (0x8000).w'
    'jmp (0x8000).w'
    # --- passada 7 (2026-10-05): decide a linha "grupo %0100 fora do subconjunto"
    # (305 words) e a metade reservada das linhas de operando. O campo %100 e o
    # %110 do grupo %0100 com b8=0 sao as familias MOVE-para-CCR/SR (linha-F no
    # MC68000? medido abaixo) e o indice %aN nunca e modo de indice no alvo. ---
    'move.w %d0,%ccr'
    'move.w %d0,%sr'
    'move.l %d0,%ccr'
    'move.l %d0,(4,%a0,%a1)'
    'ori.w #3,(4,%a0,%a1)'
    'sub.l #3,(4,%a0,%a1)'
    # --- passada 8 (2026-10-05): o MOVE-para-CCR/SR (44c0/46c0) mostrou que o
    # campo %11 do grupo %0100 NAO e sempre linha-F: a metade de registros de
    # codigo monta. Falta a direcao inversa para decidir a linha "grupo %0100 fora
    # do subconjunto" (305 words), que cobre o campo %000 (onde mora o
    # MOVE-do-SR), o %100 (EXT em memoria, ja medido) e o %110. ---
    'move.w %sr,%d0'
    'move.w %sr,%ccr'
    'movem.l %d0,%a0@'
)

printf '# Sonda as -m68000 (2a opiniao sobre a CPU-alvo), 2026-10-05\n'
printf '# as sha256: %s\n' "$(sha256sum "$AS" | cut -d" " -f1)"
printf '# objdump sha256: %s\n\n' "$(sha256sum "$OBJDUMP" | cut -d" " -f1)"

montadas=0
recusadas=0
ambiguas=0
for forma in "${FORMAS[@]}"; do
    idx=$((idx + 1))
    fonte="$DIR/f$idx.s"
    obj="$DIR/f$idx.o"
    {
        printf '.text\n'
        cat <<EOF
	$forma
EOF
    } >"$fonte"
    erro="$($AS -m68000 -o "$obj" "$fonte" 2>&1)"
    status=$?
    if [ $status -ne 0 ]; then
        motivo="$(printf '%s\n' "$erro" | grep -m1 'Error:' | sed 's|.*Error: *||')"
        [ -n "$motivo" ] || motivo="$(printf '%s' "$erro" | head -1)"
        printf 'RECUSA   %-28s | %s\n' "$forma" "$motivo"
        recusadas=$((recusadas + 1))
        continue
    fi
    # O objdump separa `endereco:` / bytes / mnemonico por TAB, e os bytes de uma
    # instrucao podem ser varios grupos (`48e0 8000`). Lemos por colunas de TAB.
    linha="$($OBJDUMP -d "$obj" 2>/dev/null | awk -F'\t' '/^[ ]*[0-9a-f]+:/ {print; exit}')"
    bytes="$(printf '%s' "$linha" | cut -f2 | tr -d ' ')"
    texto="$(printf '%s' "$linha" | cut -f3)"
    mnem_pedido="$(printf '%s' "$forma" | cut -d' ' -f1 | cut -d'.' -f1)"
    mnem_lido="$(printf '%s' "$texto" | cut -d' ' -f1 | cut -d'.' -f1)"
    # O objdump do m68k cola o tamanho no mnemonico (`subaw`, `movepl`), entao a
    # comparacao e por prefixo: `subaw` comeca por `suba`. Quando o token lido NAO
    # comeca pelo mnemonico pedido, o GAS montou outra instrugao (ou o espaco e de
    # outra familia) e a linha e marcada AMBIGUA em vez de contada como prova.
    case "$mnem_lido" in
        "$mnem_pedido"*) ok=1 ;;
        *) ok=0 ;;
    esac
    if [ "$ok" -ne 1 ]; then
        printf 'AMBIGUA  %-28s | montou, mas o objdump le `%s` [%s]\n' "$forma" "$mnem_lido" "$bytes"
        ambiguas=$((ambiguas + 1))
    else
        printf 'MONTE    %-28s | %s [%s]\n' "$forma" "$texto" "$bytes"
        montadas=$((montadas + 1))
    fi
done
printf '\n# totais: montadas=%s recusadas=%s ambiguas=%s formas=%s\n' \
    "$montadas" "$recusadas" "$ambiguas" "${#FORMAS[@]}"
