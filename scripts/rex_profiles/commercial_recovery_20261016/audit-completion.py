#!/usr/bin/env python3
"""Recheck existing mission evidence; never run an emulator or change expectations."""
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/rex_profiles/commercial_recovery_20261016'
SCRATCH = Path('/home/misael/rds-scratch/commercial_recovery_20261016')
FINAL = 'eb2ee726f5fe09516c28176c2265791df41e2b2d'
HASHES = {}


def sha(path):
    path = Path(path)
    if path not in HASHES:
        with path.open('rb') as stream:
            HASHES[path] = hashlib.file_digest(stream, 'sha256').hexdigest()
    return HASHES[path]


def read(path):
    return json.loads(Path(path).read_text())


def ips_apply(base, patch):
    assert patch[:5] == b'PATCH'
    result = bytearray(base)
    at = 5
    while patch[at:at + 3] != b'EOF':
        offset = int.from_bytes(patch[at:at + 3], 'big')
        size = int.from_bytes(patch[at + 3:at + 5], 'big')
        at += 5
        if size:
            payload = patch[at:at + size]
            assert len(payload) == size
            at += size
        else:
            count = int.from_bytes(patch[at:at + 2], 'big')
            payload = bytes([patch[at + 2]]) * count
            at += 3
        if offset + len(payload) > len(result):
            result.extend(bytes(offset + len(payload) - len(result)))
        result[offset:offset + len(payload)] = payload
    at += 3
    assert len(patch) - at in (0, 3)
    if len(patch) - at == 3:
        length = int.from_bytes(patch[at:], 'big')
        result = result[:length] + bytes(max(0, length - len(result)))
    return bytes(result)


def audit_journey(row, out):
    report_path = Path(row['report'])
    assert sha(report_path) == row['report_sha256']
    assert sha(row['run']) == row['run_sha256']
    report, run = read(report_path), read(row['run'])
    assert report['allPass'] and not report['ausentes']
    assert len(report['checks']) == row['checks'] and all(c['pass'] for c in report['checks'])
    assert run['exit_code'] == 0 and not run['owned_xvfb_alive'] and not run['owned_runner_alive']
    assert report['app_sha256'] == run['app_sha256'] == read(DATA / 'FINAL-MANIFEST.json')['app']['sha256']
    spec = read(report['spec'])
    assert sha(spec['rom']) == spec['rom_sha256']
    original = Path(spec['rom']).read_bytes()
    for copy in row['copies']:
        path = Path(copy['copy_path'])
        assert sha(path) == copy['copia_sha256']
        patch = next(p for p in path.parent.glob('*.ips') if sha(p) == copy['ips_sha256'])
        assert ips_apply(original, patch.read_bytes()) == path.read_bytes()
        offsets = [i for i, (a, b) in enumerate(zip(original, path.read_bytes())) if a != b]
        assert len(original) == path.stat().st_size
        assert offsets == spec.get('allowed_diff_offsets', [spec['declared_region']['entry'] + 16])
    names = {c['name'] for c in report['checks']}
    assert 'persistido_no_disco_com_parametro_e_vinculo' in names
    assert 'reaberto.gera_a_mesma_copia_e_o_mesmo_ips' in names
    images, pixels = 0, 0
    commercial = spec.get('commercial_prepared')
    if commercial:
        for control in ['wrong_rom', 'tampered_resource', 'out_of_domain', 'no_op']:
            assert f'control.{control}.native_publisher_refused' in names
        assert 'control.old_result_not_claimed_current' in names
        assert 'canvas.control_divergent_patch_refused' in names
        for capture in report['commercial_runs']:
            folder = Path(capture['directory'])
            linear = commercial.get('kind') == 'linear'
            raw = (folder / ('actual.rgba' if linear else 'actual180.rgba')).read_bytes()
            assert hashlib.sha256(raw).hexdigest() == capture['framebuffer_sha256']
            with Image.open(folder / ('canvas.png' if linear else 'canvas180.png')) as image:
                assert image.convert('RGBA').tobytes() == raw
            if linear:
                expected = Path(commercial['destination_references'][str(capture['width'])]).read_bytes()
                assert (folder / 'destination.bin').read_bytes() == expected
            else:
                if capture['width'] == 2:
                    assert f'{capture["etapa"]}.old_width_conditional_visual_refused' in names
                expected_path = folder / 'expected-before-final-capture.json'
                assert sha(expected_path) == capture['expectation_sha256']
                regenerated = out / f'{row["id"]}-{capture["etapa"]}-expected.json'
                command = ['rtk', 'proxy', 'python3', commercial['constructor'], commercial['expectation_spec'],
                           str(folder / 'producer179.ram'), str(capture['width']), str(regenerated)]
                subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
                assert regenerated.read_bytes() == expected_path.read_bytes()
                expected = read(regenerated)
                assert expected['capture_input'] is None
                for x, y, red, green, blue in expected['pixels']:
                    pos = (y * 320 + x) * 4
                    assert raw[pos:pos + 4] == bytes([red, green, blue, 255])
                for x, y, red, green, blue in expected['old_width_wrong_pixels']:
                    pos = (y * 320 + x) * 4
                    assert raw[pos:pos + 4] != bytes([red, green, blue, 255])
                model = read(commercial['expectation_spec'])
                world = Path(model['world_layouts'][str(capture['width'])]).read_bytes()
                assert (folder / 'actual180.ram').read_bytes()[:16384] == world
                pixels += len(expected['pixels'])
            images += 1
    else:
        visual = spec['visual']
        for label in ['original', 'original-repeat', 'copia']:
            width = spec['edit']['bytes_per_cell'] if label == 'copia' else spec['probe']['reference']['width']
            raw = report_path.parent / f'{report["prefix"]}-{label}-core.rgba'
            assert raw.read_bytes() == (Path(visual['oracle_dir']) / f'width{width}.rgba').read_bytes()
            with Image.open(report_path.parent / f'{report["prefix"]}-{label}-canvas.png') as image:
                assert image.convert('RGBA').tobytes() == raw.read_bytes()
            assert (report_path.parent / f'{report["prefix"]}-{label}-wram.bin').read_bytes() == (
                Path(visual['oracle_dir']) / f'width{width}.scope.bin').read_bytes()
            images += 1
    return {'id': row['id'], 'checks': row['checks'], 'copies_independently_applied': len(row['copies']),
            'saved_images_rechecked': images, 'commercial_conditional_pixels_rechecked': pixels,
            'origin': 'current artifact reanalysis, not a new emulator/UI execution'}


def experiment_index():
    """Index authoritative records; never turn file names into invented run IDs."""
    records = []
    paths = list(DATA.glob('*.json'))
    for folder in SCRATCH.iterdir():
        if folder.is_dir():
            for name in ['manifest.json', 'run.json', 'result.json', 'summary.json', 'launch-result.json']:
                if (folder / name).is_file():
                    paths.append(folder / name)
    for path in sorted(paths):
        payload = read(path)
        if not isinstance(payload, dict):
            continue
        if path.name.endswith('journey.json') or '-journey-v' in path.name:
            category = 'journey specification, not execution'
        elif 'freeze' in path.name or 'addendum' in path.name:
            category = 'protocol or amendment, not execution'
        elif 'protection' in path.name:
            category = 'checkpoint preservation'
        else:
            category = 'evidence record; scope and verdict belong to source'
        records.append({'record': str(path), 'sha256': sha(path), 'category': category,
                        'execution_id': payload.get('id', payload.get('run_id')),
                        'schema': payload.get('schema'),
                        'command': payload.get('command', payload.get('native_command')),
                        'budget': payload.get('budget', payload.get('budget_seconds')),
                        'hypothesis': payload.get('hypothesis'),
                        'result_status': payload.get('status', payload.get('state')),
                        'exit_code': payload.get('exit_code')})
    return {'schema': 'rex-derived-experiment-index/v1',
            'scope': 'Derived navigation index of existing versioned protocols/evidence and private execution records. '
                     'Not a second project status source, not a sum of tests or independent experiments. '
                     'Null means the field belongs to linked protocols/producer scripts or was not recorded here; '
                     'no command, budget, run ID, or outcome has been inferred.',
            'canonical_status': 'docs/06_AI_MEMORY_BANK.md',
            'experiment_journal': 'docs/rex_profiles/commercial_recovery_20261016/MISSION.md',
            'records': records}


def main():
    assert len(sys.argv) == 2, 'usage: audit-completion.py fresh-private-output-directory'
    out = Path(sys.argv[1]).resolve()
    assert out.parent == SCRATCH
    out.mkdir(exist_ok=False)
    manifest = read(DATA / 'FINAL-MANIFEST.json')
    advanced = []
    for name, expected in manifest['files'].items():
        if sha(ROOT / name) == expected:
            continue
        assert name in ['docs/06_AI_MEMORY_BANK.md', 'docs/06_CURRENT_WAVE_AI_BANK.md',
                        'docs/rex_profiles/commercial_recovery_20261016/MISSION.md'], name
        prior = subprocess.check_output(['git', 'show', FINAL + ':' + name], cwd=ROOT)
        assert hashlib.sha256(prior).hexdigest() == expected
        advanced.append(name)
    assert sha(manifest['app']['path']) == manifest['app']['sha256']
    cert = read(DATA / 'm5-final-certification.json')
    assert cert['state'] == 'READY' and cert['exit_code'] == 0
    assert len(cert['gates']) == 7 and all(g['exit_code'] == 0 for g in cert['gates'])
    for name, expected in cert['files'].items():
        assert sha(name) == expected
    complement = read(DATA / 'm5-final-complementary-qualified.json')
    assert all(g['exit_code'] == 0 for g in complement['gates'])
    for name, expected in complement['files'].items():
        assert sha(name) == expected
    assert subprocess.check_output(['git', 'diff', '--name-only', '7a03e81c', 'HEAD', '--',
                                    'src', 'src-tauri', 'package.json', 'package-lock.json',
                                    'data/rex_profiles/specs'], cwd=ROOT) == b''
    journeys = [audit_journey(row, out) for row in read(DATA / 'm5-final-native-qualified.json')['journeys']]
    traces = []
    for record in read(DATA / 'final-private-trace-audit.json')['records']:
        assert sha(record['path']) == record['sha256']
        first = last = None
        count = 0
        for line in Path(record['path']).open():
            event = json.loads(line)
            count += 1
            first = first or event
            assert event['seq'] == count and event['run_id'] == first['run_id']
            assert event['rom_sha256'] == first['rom_sha256']
            assert event['instrument_sha256'] == first['instrument_sha256']
            assert all(key in event for key in ['runtime', 'temporal_domain', 'address_space', 'clock_context', 'frame'])
            last = event
        assert last['kind'] == 'collection_end' and last['complete'] and last['dropped'] == 0
        traces.append({'id': first['run_id'], 'events': count, 'sha256': record['sha256']})
    rebuild = read(DATA / 'm4-semantic-reconstruction-qualified.json')
    for name, metadata in rebuild['artifacts'].items():
        assert sha(SCRATCH / 'm4-semantic-rebuild-001' / name) == metadata['sha256']
    generic = read(DATA / 'm5-generic-adaptation-freeze.json')
    for name, expected in {**generic['production'], **generic['profile_configuration']}.items():
        assert sha(name) == expected
    pilot = read(DATA / 'm5-pilot-freeze.json')
    assert pilot['production_changes'] == 0 and pilot['generated_at'] < generic['generated_at']
    assert all(k in pilot['expected'] for k in ['memory', 'registers', 'flags', 'reconstruction', 'negative_controls'])
    protection = read(SCRATCH / 'mission-final-protection.json')
    assert sha(protection['bundle']) == protection['bundle_sha256']
    subprocess.run(['git', 'bundle', 'verify', protection['bundle']], cwd=ROOT, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = {'schema': 'rex-completion-audit/v1', 'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'status': 'PASS_CURRENT_ARTIFACT_REANALYSIS', 'source_checkpoint': FINAL,
              'auditor_sha256': sha(Path(__file__)), 'manifest_sha256': sha(DATA / 'FINAL-MANIFEST.json'),
              'manifest_files_checked': len(manifest['files']), 'historical_documents_advanced': advanced,
              'journeys': journeys, 'traces': traces, 'host_certification_reused': cert['state'],
              'production_changed_since_final_native_and_gates': False,
              'limits': 'Reanalysis of preserved evidence, not new commercial execution, new blind holdout, or broader scope.'}
    index = out / 'experiment-index.json'
    index.write_text(json.dumps(experiment_index(), indent=2) + '\n')
    result['experiment_index'] = {'path': str(index), 'sha256': sha(index)}
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
