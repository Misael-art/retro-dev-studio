#!/usr/bin/env python3
"""Clone a frozen native journey with fresh private paths and unchanged criteria."""
import hashlib
import json
import re
import shlex
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRATCH = Path('/home/misael/rds-scratch/commercial_recovery_20261016')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: prepare-native-reproduction.py spec freeze m3-native-FRESH-ID')
    spec_path, freeze_path = (Path(p).resolve() for p in sys.argv[1:3])
    ident = sys.argv[3]
    assert re.fullmatch(r'm3-native-[a-zA-Z0-9-]+', ident), 'invalid fresh id'
    spec = json.loads(spec_path.read_text())
    freeze = json.loads(freeze_path.read_text())
    assert freeze['inputs'][str(spec_path)] == sha(spec_path), 'spec not frozen'
    for path, digest in freeze['inputs'].items():
        assert sha(Path(path)) == digest, f'frozen input changed: {path}'
    assert sha(ROOT / 'src-tauri/target-test/debug/retro-dev-studio') == freeze['app_sha256']
    directory = SCRATCH / ('reproduce-' + ident)
    assert not (SCRATCH / ident).exists(), 'run id already used'
    directory.mkdir(exist_ok=False)
    if 'commercial_prepared' in spec:
        spec['commercial_prepared']['output'] = str(directory / 'commercial')
    new_spec, new_freeze = directory / 'journey.json', directory / 'freeze.json'
    new_spec.write_text(json.dumps(spec, indent=2) + '\n')
    del freeze['inputs'][str(spec_path)]
    freeze['inputs'][str(new_spec)] = sha(new_spec)
    freeze['reproduction'] = {'source_freeze_sha256': sha(freeze_path),
                              'change': 'fresh output/spec paths only; all acceptance criteria and binary/input hashes preserved'}
    new_freeze.write_text(json.dumps(freeze, indent=2) + '\n')
    print(shlex.join(['rtk', 'proxy', 'env', 'TMPDIR=' + str(SCRATCH / 'm5-test-tmp'),
                      'python3', str(ROOT / 'scripts/rex_profiles/commercial_recovery_20261016/run-native-journey.py'),
                      str(new_spec), str(new_freeze), ident]))


if __name__ == '__main__':
    main()
