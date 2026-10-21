#!/usr/bin/env python3
"""Gera os NodeGraph v1 (formato do editor) da logica de controle do Sonic 1: modos, pulo e pulo duplo PROPOSTO.
Cada no carrega origem (recuperado | rotulo | PROPOSTO), endereco, bytes e asm LIDOS da ROM (objdump), e uma
expectativa textual que o gerador confere: se o disassembly nao contem o esperado, o gerador recusa.
Uso: gerar_grafos_pulo.py ROM ROM_PATCHADA OBJDUMP SAIDA_DIR   (ROM_PATCHADA so para os nos do pulo duplo)"""
import json, subprocess, sys, os, re

ROM, ROMP, OBJ, OUT = sys.argv[1:5]
rom = open(ROM, 'rb').read(); romp = open(ROMP, 'rb').read()

def dis(buf_path, addr, n):
    r = subprocess.run([OBJ, '-b', 'binary', '-m', 'm68k:68000', '-D', f'--start-address={addr}', f'--stop-address={addr+n}', buf_path],
                       capture_output=True, text=True, check=True).stdout
    lines = [l.split('\t', 2) for l in r.splitlines() if l.strip() and l.lstrip()[0] in '0123456789abcdef' and '\t' in l]
    return ' ; '.join(l[2].strip() if len(l) > 2 else '' for l in lines)

PORTS = {
 'event_update': ([], [('exec', 'exec', None)]),
 'input_pressed': ([('exec', 'exec', None)], [('exec', 'exec', None)]),
 'condition_compare': ([('exec', 'exec', None), ('a', 'data', 'int'), ('b', 'data', 'int')], [('true', 'exec', None), ('false', 'exec', None)]),
 'flow_if': ([('exec', 'exec', None), ('condition', 'data', 'bool')], [('true', 'exec', None), ('false', 'exec', None)]),
 'var_get': ([], [('value', 'data', 'int')]),
 'var_set': ([('exec', 'exec', None), ('value', 'data', 'int')], [('exec', 'exec', None)]),
 'set_velocity': ([('exec', 'exec', None), ('vx', 'data', 'int'), ('vy', 'data', 'int')], [('exec', 'exec', None)]),
 'action_sound': ([('exec', 'exec', None)], [('exec', 'exec', None)]),
 'set_animation_state': ([('exec', 'exec', None)], [('exec', 'exec', None)]),
 'sprite_move': ([('exec', 'exec', None), ('dx', 'data', 'int'), ('dy', 'data', 'int')], [('exec', 'exec', None)]),
 'fsm_state': ([('exec', 'exec', None)], [('exec', 'exec', None), ('transitions', 'exec', None)]),
 'rom_external_call': ([('exec', 'exec', None)], [('exec', 'exec', None)]),
 'rom_region_exit': ([('exec', 'exec', None)], []),
}
LABEL = {'event_update': 'On Update', 'input_pressed': 'On Input Pressed', 'condition_compare': 'Compare', 'flow_if': 'If',
         'var_get': 'Get Variable', 'var_set': 'Set Variable', 'set_velocity': 'Set Velocity', 'action_sound': 'Play Sound',
         'set_animation_state': 'Set Anim State', 'sprite_move': 'Move Sprite', 'fsm_state': 'FSM State',
         'rom_external_call': 'Chamada externa (non recuperada)', 'rom_region_exit': 'Saida da rexion'}

class G:
    def __init__(self, nome):
        self.nome = nome; self.nodes = []; self.edges = []; self.ids = set()
    def N(self, id, type, label, col, row, params=None, addr=None, n=None, expect=(), origem='recuperado do ROM', buf='orig', note=''):
        assert id not in self.ids, id; self.ids.add(id)
        p = dict(params or {})
        if 'var_name' in p:                       # o editor so aceita [A-Za-z0-9_]; o endereco/bit vai em 'descricao'
            raw = str(p['var_name']); p['descricao'] = raw
            p['var_name'] = re.sub(r'[^A-Za-z0-9_]+', '_', raw.split(' (')[0]).strip('_')
        p['origem'] = origem
        if addr is not None:
            path, data = (ROM, rom) if buf == 'orig' else (ROMP, romp)
            asm = dis(path, addr, n)
            for e in expect:
                assert e in asm, f'{id}: esperado "{e}" em "{asm}"'
            p['rom_addr'] = f'0x{addr:06X}'; p['rom_bytes'] = data[addr:addr+n].hex(); p['rom_asm'] = asm
            p['rom_buffer'] = 'ROM original' if buf == 'orig' else 'ROM com patch sonic1-pulo-duplo'
        if note: p['nota'] = note
        ins, outs = PORTS[type]
        self.nodes.append(dict(id=id, type=type, label=label, x=40 + 330 * col, y=40 + 150 * row,
            inputs=[dict(id=a, label=a, kind=b, **({'dataType': c} if c else {})) for a, b, c in ins],
            outputs=[dict(id=a, label=a, kind=b, **({'dataType': c} if c else {})) for a, b, c in outs], params=p))
    def E(self, a, ap, b, bp):
        self.edges.append(dict(id=f'e{len(self.edges)+1}', fromNode=a, fromPort=ap, toNode=b, toPort=bp))
    def save(self, nome, meta):
        d = dict(version=1, nodes=self.nodes, edges=self.edges, rex_logic_recovery=meta)
        json.dump(d, open(os.path.join(OUT, nome), 'w'), indent=1, ensure_ascii=False)

META = dict(rom_sha256='c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb', descritivo=True,
            aviso='Grafo DESCRITIVO da logica localizada; nao e codigo a compilar. Rotulos de funcoes sao do disassembly publico (dicas), nao derivados dos bytes.')
RECOV = 'recuperado do ROM'; LAB = 'rotulo (disassembly publico, nao derivado dos bytes)'

# ---------------------------------------------------------------- A: modos
A = G('modos')
A.N('entry', 'event_update', 'Sonic_Control (Obj01) a cada quadro', 0, 0, dict(rate='frame', rotulo='Obj01_Control'), 0x12C58, 4, ['tstb 0xfffff7cc'])
A.N('sel', 'rom_external_call', 'Seleciona o modo: tabela de 4 palavras indexada por status&6', 0, 1,
    dict(target='0x012CC0', understood='true', tabela='0x12CC0: 0158 017C 01A6 01C6 -> 0x12E18 0x12E3C 0x12E66 0x12E86'), 0x12C6C, 18, ['andiw #6,%d0', 'jsr %pc@(0x12cc0'])
modos = [
 ('md_normal', 'MdNormal (no chao, andando)', 'status&6 == 0', 0x12E18, [(0x133EA, 'Sonic_Jump'), (0x134D4, 'Sonic_SlopeResist'), (0x12EB0, 'Sonic_Move'), (0x13384, 'Sonic_Roll'), (0x13304, 'Sonic_LevelBound'), (0xD5DE, 'SpeedToPos'), (0x145EE, 'Sonic_AnglePos'), (0x13546, 'Sonic_SlopeRepel')]),
 ('md_air', 'MdJump (no ar)', 'status&6 == 2', 0x12E3C, [(0x13498, 'Sonic_JumpHeight'), (0x13248, 'Sonic_ChgJumpDir'), (0x13304, 'Sonic_LevelBound'), (0xD5B2, 'ObjectFall'), (0x13588, 'Sonic_JumpAngle'), (0x135A4, 'Sonic_Floor')]),
 ('md_roll', 'MdRoll (rolando no chao)', 'status&6 == 4', 0x12E66, [(0x133EA, 'Sonic_Jump'), (0x1350A, 'Sonic_RollRepel'), (0x13150, 'Sonic_RollSpeed'), (0x13304, 'Sonic_LevelBound'), (0xD5DE, 'SpeedToPos'), (0x145EE, 'Sonic_AnglePos'), (0x13546, 'Sonic_SlopeRepel')]),
 ('md_air2', 'MdJump2 (no ar, rolando)', 'status&6 == 6', 0x12E86, [(0x13498, 'Sonic_JumpHeight'), (0x13248, 'Sonic_ChgJumpDir'), (0x13304, 'Sonic_LevelBound'), (0xD5B2, 'ObjectFall'), (0x13588, 'Sonic_JumpAngle'), (0x135A4, 'Sonic_Floor')]),
]
for i, (mid, nome, sel, addr, calls) in enumerate(modos):
    A.N(mid, 'fsm_state', nome, 1 + i, 2, dict(state_name=nome.split()[0], initial=1 if i == 0 else 0, seletor=sel), addr, 4, [], LAB)
    A.E('sel', 'exec', mid, 'exec')
    prev, pport = mid, 'exec'
    for j, (ca, cn) in enumerate(calls):
        cid = f'{mid}_c{j}'
        # cada chamada e um bsr/jsr no corpo do modo; endereco do salto verificado no disassembly
        idx = next(k for k in range(addr, addr + 80) if rom[k:k+2] in (b'\x61\x00', b'\x4e\xb9') and ((rom[k] == 0x61 and (k + 2 + int.from_bytes(rom[k+2:k+4], 'big', signed=True)) == ca) or (rom[k] == 0x4e and int.from_bytes(rom[k+2:k+6], 'big') == ca)))
        ln = 4 if rom[idx] == 0x61 else 6
        A.N(cid, 'rom_external_call', f'{cn} @0x{ca:X} (corpo nao recuperado)', 1 + i, 3 + j, dict(target=f'0x{ca:06X}', understood='false', nome=cn), idx, ln, ['bsrw' if ln == 4 else 'jsr'], LAB)
        A.E(prev, pport, cid, 'exec'); prev, pport = cid, 'exec'
A.E('entry', 'exec', 'sel', 'exec')
A.save('sonic1-logica-modos.nodegraph.json', dict(META, titulo='Sonic 1 - Sonic_Control e os 4 modos (localizado)'))

# ---------------------------------------------------------------- B: pulo
B = G('pulo')
B.N('ev', 'event_update', 'Modo no chao (MdNormal/MdRoll) chama Sonic_Jump', 0, 0, dict(rate='frame'), 0x12E18, 4, ['bsrw 0x133ea'], LAB)
B.N('in', 'input_pressed', 'A, B ou C pressionado neste quadro', 0, 1, dict(pad='JOY_1', button='BUTTON_A|B|C', mascara='0x70', ram='v_jpadpress1 $FFF603'), 0x133EA, 12, ['0xfffff603', 'andib #112,%d0', 'beqw 0x1348e'])
B.N('room', 'condition_compare', 'Folga acima da cabeca >= 6 px (rotina em 0x14D48)', 0, 2, dict(operator='>=', a='folga_teto', b=6), 0x133F6, 22, ['bsrw 0x14d48', 'cmpiw #6,%d1', 'bltw 0x1348e'])
B.N('agua', 'var_get', 'status bit 6: submerso', 1, 1, dict(var_name='sonic.submerso (obStatus bit6 @$22)'), 0x13410, 6, ['btst #6,%a0@(34)'])
B.N('imp', 'condition_compare', 'Submerso?', 1, 2, dict(operator='==', a='sonic_submerso', b=1), 0x1340C, 16, ['movew #1664,%d2', 'btst #6,%a0@(34)', 'movew #896,%d2'])
B.N('d2a', 'var_set', 'impulso d2 = 0x680 (1664)', 1, 3, dict(var_name='impulso_pulo', value=1664), 0x1340C, 4, ['movew #1664,%d2'])
B.N('d2b', 'var_set', 'impulso d2 = 0x380 (896) submerso', 2, 3, dict(var_name='impulso_pulo', value=896), 0x13418, 4, ['movew #896,%d2'])
B.N('vel', 'var_set', 'vy += impulso (chao plano: vy = -0x680); vx += cos(ang-64)*d2>>8', 1, 4, dict(var_name='sonic_vy (obVelY @$12; geral: vx += cos(ang-64)*d2>>8, vy += sin(ang-64)*d2>>8)', value=-1664), 0x1341C, 32, ['subib #64,%d0', 'jsr 0x29da', 'mulsw %d2,%d1', 'addw %d1,%a0@(16)', 'addw %d0,%a0@(18)'])
B.N('ar', 'var_set', 'status bit1 = no ar; bit5 = 0', 1, 5, dict(var_name='sonic.no_ar', value=1), 0x1343C, 12, ['bset #1,%a0@(34)', 'bclr #5,%a0@(34)'])
B.N('flag', 'var_set', 'flag de pulo ($3C) = 1; $38 = 0', 1, 6, dict(var_name='sonic.pulando (obj+$3C)', value=1), 0x13448, 12, ['addql #4,%sp', 'moveb #1,%a0@(60)', 'clrb %a0@(56)'])
B.N('som', 'var_set', 'Toca o som do pulo: PlaySound_Special(0xA0)', 1, 7, dict(var_name='tocar_sfx (id do som da ROM)', value=160), 0x13454, 10, ['movew #160,%d0', 'jsr 0x139c'])
B.N('roll', 'condition_compare', 'Ja esta rolando (status bit2)?', 2, 7, dict(operator='==', a='sonic_rolando', b=1), 0x1345E, 20, ['moveb #19,%a0@(22)', 'btst #2,%a0@(34)', 'bnes 0x13490'])
B.N('anim', 'var_set', 'Anim = rolar (obAnim=2); altura 14 / largura 7; bit2 = 1', 2, 8, dict(var_name='sonic_anim (obAnim @$1C)', value=2), 0x13472, 28, ['moveb #14,%a0@(22)', 'moveb #2,%a0@(28)', 'bset #2,%a0@(34)'])
B.N('y5', 'sprite_move', 'y += 5', 2, 9, dict(target='player', dx=0, dy=5), 0x1348A, 4, ['addqw #5,%a0@(12)'])
B.N('ctl', 'var_set', 'ja rolando: status bit4 = 1 (sem controle no ar)', 3, 8, dict(var_name='sonic.sem_controle_ar', value=1), 0x13490, 6, ['bset #4,%a0@(34)'])
B.N('fim', 'rom_region_exit', 'Fim de Sonic_Jump (rts)', 1, 10, {}, 0x1348E, 2, ['rts'])
for a, ap, b, bp in [('ev', 'exec', 'in', 'exec'), ('in', 'exec', 'room', 'exec'), ('room', 'true', 'imp', 'exec'), ('agua', 'value', 'imp', 'a'),
                     ('imp', 'false', 'd2a', 'exec'), ('imp', 'true', 'd2b', 'exec'), ('d2a', 'exec', 'vel', 'exec'), ('d2b', 'exec', 'vel', 'exec'),
                     ('vel', 'exec', 'ar', 'exec'), ('ar', 'exec', 'flag', 'exec'), ('flag', 'exec', 'som', 'exec'), ('som', 'exec', 'roll', 'exec'),
                     ('roll', 'false', 'anim', 'exec'), ('anim', 'exec', 'y5', 'exec'), ('roll', 'true', 'ctl', 'exec'), ('y5', 'exec', 'fim', 'exec'), ('ctl', 'exec', 'fim', 'exec')]:
    B.E(a, ap, b, bp)
# altura variavel + gravidade no ar
B.N('ev2', 'event_update', 'Modo no ar chama Sonic_JumpHeight', 4, 0, dict(rate='frame'), 0x12E3C, 4, ['bsrw 0x13498'], LAB)
B.N('jf', 'condition_compare', 'Flag de pulo ($3C) != 0 (pulou, nao foi lancado)?', 4, 1, dict(operator='==', a='sonic_pulando', b=1), 0x13498, 6, ['tstb %a0@(60)', 'beqs 0x134c4'], note='JumpHeight @0x13498')
B.N('jfv', 'var_get', 'sonic.pulando (obj+$3C)', 5, 1, dict(var_name='sonic.pulando (obj+$3C)'), 0x13498, 4, ['tstb %a0@(60)'])
B.N('lim', 'condition_compare', 'vy < limite (-0x400; -0x200 submerso)?', 4, 2, dict(operator='<', a='sonic_vy', b=-1024), 0x1349E, 20, ['movew #-1024,%d1', 'movew #-512,%d1', 'cmpw %a0@(18),%d1'])
B.N('held', 'condition_compare', 'A/B/C segurado (v_jpadhold $FFF602)?', 4, 3, dict(operator='==', a='botao_abc_segurado', b=1), 0x134B4, 8, ['0xfffff602', 'andib #112,%d0'])
B.N('cut', 'var_set', 'vy = limite -0x400 (-0x200 submerso): corta o pulo ao soltar o botao', 4, 4, dict(var_name='sonic_vy (obVelY @$12; limite -0x200 submerso)', value=-1024), 0x134BE, 4, ['movew %d1,%a0@(18)'])
B.N('cap', 'condition_compare', 'vy < -0xFC0 (nao pulou: lancado)?', 5, 2, dict(operator='<', a='sonic_vy', b=-4032), 0x134C4, 8, ['cmpiw #-4032,%a0@(18)', 'bges 0x134d2'])
B.N('capv', 'var_set', 'vy = -0xFC0 (teto de velocidade ascendente)', 5, 3, dict(var_name='sonic_vy (obVelY @$12)', value=-4032), 0x134CA, 6, ['movew #-4032,%a0@(18)'])
B.N('fim2', 'rom_region_exit', 'rts', 4, 5, {}, 0x134C2, 2, ['rts'])
for a, ap, b, bp in [('ev2', 'exec', 'jf', 'exec'), ('jfv', 'value', 'jf', 'a'), ('jf', 'true', 'lim', 'exec'), ('jf', 'false', 'cap', 'exec'),
                     ('lim', 'true', 'held', 'exec'), ('lim', 'false', 'fim2', 'exec'), ('held', 'false', 'cut', 'exec'), ('held', 'true', 'fim2', 'exec'), ('cut', 'exec', 'fim2', 'exec'),
                     ('cap', 'true', 'capv', 'exec'), ('cap', 'false', 'fim2', 'exec'), ('capv', 'exec', 'fim2', 'exec')]:
    B.E(a, ap, b, bp)
B.N('pousa', 'event_update', 'Ao pousar o chao (Sonic_ResetOnFloor e chamada pelo codigo de colisao)', 6, 0, dict(rate='frame'), None, None, [], LAB, note='rotulo da rotina; o ponto de chamada nao foi localizado')
B.N('reset', 'var_set', 'Ao pousar (Sonic_ResetOnFloor): flag de pulo ($3C) = 0', 6, 1, dict(var_name='sonic.pulando (obj+$3C)', value=0), 0x137E4, 6, ['moveb #0,%a0@(60)'], LAB)
B.E('pousa', 'exec', 'reset', 'exec')
B.save('sonic1-logica-pulo.nodegraph.json', dict(META, titulo='Sonic 1 - Sonic_Jump e Sonic_JumpHeight (localizado)'))

# ---------------------------------------------------------------- C: pulo duplo (PROPOSTO)
C = G('duplo')
PR = 'PROPOSTO (patch sonic1-pulo-duplo.ips; nao e logica original)'
HK = 0x81C80
C.N('orig', 'event_update', 'Sonic_JumpHeight @0x13498 passa a chamar o gancho', 0, 0, dict(rate='frame'), 0x13498, 6, ['jsr 0x81c80'], PR, 'patched', 'No lugar de "tst.b $3C(a0); beq.s" (6 bytes) entra "jsr gancho".')
C.N('zero', 'condition_compare', 'Flag de pulo ($3C) == 0 (nao pulou)?', 0, 1, dict(operator='==', a='sonic_pulando', b=0), HK, 8, ['tstb %a0@(60)', 'beqw'], PR, 'patched')
C.N('pul', 'condition_compare', 'Flag de pulo ($3C) == 1 (primeiro pulo ativo)?', 1, 1, dict(operator='==', a='sonic_pulando', b=1), HK + 8, 8, ['cmpib #1,%a0@(60)', 'bnes'], PR, 'patched', '$3C: 0 chao, 1 primeiro pulo, 2 pulo duplo usado; Sonic_ResetOnFloor zera ao pousar.')
C.N('btn', 'input_pressed', 'A, B ou C pressionado agora (borda)', 1, 2, dict(pad='JOY_1', button='BUTTON_A|B|C', mascara='0x70', ram='v_jpadpress1 $FFF603'), HK + 16, 10, ['0xfffff603', 'andib #112,%d0', 'beqs'], PR, 'patched')
C.N('agua', 'var_get', 'status bit 6: submerso', 1, 1, dict(var_name='sonic.submerso (obStatus bit6 @$22)'), HK + 30, 6, ['btst #6,%a0@(34)'], PR, 'patched')
C.N('sub', 'condition_compare', 'Submerso?', 1, 2, dict(operator='==', a='sonic_submerso', b=1), HK + 26, 16, ['movew #-1664,%d0', 'btst #6,%a0@(34)', 'movew #-896,%d0'], PR, 'patched')
C.N('va', 'var_set', 'vy = -0x680 (-1664)', 1, 3, dict(var_name='sonic_vy (obVelY @$12)', value=-1664), HK + 26, 4, ['movew #-1664,%d0'], PR, 'patched')
C.N('vb', 'var_set', 'vy = -0x380 (-896) submerso', 2, 3, dict(var_name='sonic_vy (obVelY @$12)', value=-896), HK + 38, 4, ['movew #-896,%d0'], PR, 'patched')
C.N('f2', 'var_set', 'flag de pulo ($3C) = 2 (nao ha triplo)', 1, 4, dict(var_name='sonic.pulando (obj+$3C)', value=2), HK + 42, 10, ['movew %d0,%a0@(18)', 'moveb #2,%a0@(60)'], PR, 'patched')
C.N('snd', 'var_set', 'Toca o som do pulo: PlaySound_Special(0xA0)', 1, 5, dict(var_name='tocar_sfx (id do som da ROM)', value=160), HK + 52, 8, ['movew #160,%d0', 'jsr 0x139c'], PR, 'patched')
C.N('seg', 'rom_external_call', 'Segue para o corpo original de JumpHeight (rts do gancho -> 0x1349E)', 0, 6, dict(target='0x01349E', understood='true'), HK + 60, 2, ['rts'], PR, 'patched')
C.N('npu', 'rom_external_call', 'Flag == 0: gancho descarta o retorno e salta p/ 0x134C4 (ramo original "nao pulou")', 2, 6, dict(target='0x0134C4', understood='true'), HK + 62, 8, ['addql #4,%sp', 'jmp 0x134c4'], PR, 'patched')
for a, ap, b, bp in [('orig', 'exec', 'zero', 'exec'), ('zero', 'true', 'npu', 'exec'), ('zero', 'false', 'pul', 'exec'), ('pul', 'true', 'btn', 'exec'), ('pul', 'false', 'seg', 'exec'), ('btn', 'exec', 'sub', 'exec'), ('agua', 'value', 'sub', 'a'),
                     ('sub', 'false', 'va', 'exec'), ('sub', 'true', 'vb', 'exec'), ('va', 'exec', 'f2', 'exec'), ('vb', 'exec', 'f2', 'exec'), ('f2', 'exec', 'snd', 'exec'), ('snd', 'exec', 'seg', 'exec')]:
    C.E(a, ap, b, bp)
C.save('sonic1-logica-pulo-duplo-proposto.nodegraph.json', dict(META, titulo='Sonic 1 - pulo duplo PROPOSTO (patch)', nota='Nos PROPOSTOS referem-se a ROM com patch; os recuperados, a ROM original.'))
print('ok', len(A.nodes), len(B.nodes), len(C.nodes))
