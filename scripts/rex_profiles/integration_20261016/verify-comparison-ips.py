"""Independent QA verifier; never writes the source ROM or executes product patches."""
import hashlib
import json
import sys
from pathlib import Path

base_path, copy_path, ips_path = map(Path, sys.argv[1:4])
base, copy, ips = base_path.read_bytes(), copy_path.read_bytes(), ips_path.read_bytes()
sha = lambda data: hashlib.sha256(data).hexdigest()
spec = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else None
expected_sha = spec["input_sha256"] if spec else "8246bb88cbb3f11a45e976347e63c0a7a22bfd17bfccfc0e9bb1f7deb7f6f218"
expected_offset = spec["entry"] + 16 if spec else 0x247
target_width = spec.get("target_width", 2) if spec else None
assert target_width is None or target_width in (1, 2)
expected_byte = (base[expected_offset] & 0xCF) | (0x10 if target_width == 1 else 0x30) if spec else 6
assert len(base) >= expected_offset + 1
assert spec is not None or len(base) == 2593
assert sha(base) == expected_sha
assert len(copy) == len(base) and ips[:5] == b"PATCH"
result, cursor = bytearray(base), 5
records = []
while ips[cursor:cursor + 3] != b"EOF":
    assert cursor + 5 <= len(ips), "truncated IPS record"
    offset = int.from_bytes(ips[cursor:cursor + 3], "big")
    size = int.from_bytes(ips[cursor + 3:cursor + 5], "big")
    cursor += 5
    if size:
        data = ips[cursor:cursor + size]
        assert len(data) == size
        cursor += size
    else:
        assert cursor + 3 <= len(ips)
        count = int.from_bytes(ips[cursor:cursor + 2], "big")
        assert count > 0
        data = ips[cursor + 2:cursor + 3] * count
        cursor += 3
    assert offset + len(data) <= len(result), "patch exceeds fixed image"
    result[offset:offset + len(data)] = data
    records.append({"offset": offset, "length": len(data)})
assert cursor + 3 == len(ips), "unexpected IPS trailer"
assert bytes(result) == copy
changed = [at for at, (old, new) in enumerate(zip(base, copy)) if old != new]
assert changed == [expected_offset] and copy[expected_offset] == expected_byte
assert base_path.read_bytes() == base
print(json.dumps({"status": "passed", "base_sha256": sha(base), "copy_sha256": sha(copy),
                  "ips_sha256": sha(ips), "bytes": len(copy), "changed_offsets": changed,
                  "records": records, "original_unchanged": True}, indent=2))
