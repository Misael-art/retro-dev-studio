#!/usr/bin/env python3
"""Independent oracle for the JV09/JV10 native journey (`studio-jv-motion`, Experimental).

This is NOT the compiler or the app: it reads the project's own sprite atlas PNG with Pillow,
cuts the 32x32 source frames, and for each paused core framebuffer the journey saved it finds
the best exact match of every frame, straight and horizontally mirrored. Colors are compared on
the Mega Drive 3-bit-per-channel grid (the core expands 9-bit CRAM to RGB565/888; the source is
authored on the same grid), opaque source pixels only.

Expected, written before reading any sample:
  * run_right: a run frame (4..9), NOT mirrored; x grows between samples;
  * run_left: a run frame, MIRRORED; x shrinks between samples;
  * idle_after_right: an idle frame (0..3) not mirrored; idle_after_left: idle, mirrored;
  * air_after_left: a jump frame (10..11), mirrored; landed_after_left: idle, mirrored;
  * the run phase shows more than one distinct run frame (the cycle advances, not restarted
    every frame).

Python/Pillow/numpy are QA prerequisites only, never app dependencies.
Usage: verify-jv-motion.py <journey output dir> <atlas.png> [--frames-per-row 4] [--size 32]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

IDLE, RUN, JUMP = range(0, 4), range(4, 10), range(10, 12)
EXPECT = {
    "idle_start": (IDLE, None),
    "run_right": (RUN, False),
    "idle_after_right": (IDLE, False),
    "run_left": (RUN, True),
    "idle_after_left": (IDLE, True),
    "air_after_left": (JUMP, True),
    "landed_after_left": (IDLE, True),
}


def grid(rgb):
    return (rgb >> 5).astype(np.int16)


def frames(atlas, size, per_row):
    im = np.asarray(Image.open(atlas).convert("RGBA"))
    out = []
    rows = im.shape[0] // size
    for i in range(rows * per_row):
        y, x = (i // per_row) * size, (i % per_row) * size
        cell = im[y:y + size, x:x + size]
        out.append((grid(cell[..., :3]), cell[..., 3] > 0))
    return out


def best_match(fb, frame, mask):
    """Exact-match ratio of opaque pixels at the best position on screen."""
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    want = frame[ys, xs]
    best = (0.0, None)
    H, W = fb.shape[:2]
    for oy in range(0, H - h + 1):
        rows = fb[oy + ys]
        for ox in range(0, W - w + 1):
            got = rows[np.arange(len(xs)), ox + xs]
            ratio = float(np.all(got == want, axis=1).mean())
            if ratio > best[0]:
                best = (ratio, (ox, oy))
                if ratio == 1.0:
                    return best
    return best


def main():
    out_dir, atlas = Path(sys.argv[1]), Path(sys.argv[2])
    size = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 32
    per_row = int(sys.argv[sys.argv.index("--frames-per-row") + 1]) if "--frames-per-row" in sys.argv else 4
    report = json.loads((out_dir / "ui-report.json").read_text())
    source = frames(atlas, size, per_row)
    results, failures = [], []
    ground = max(x["y"] for x in report["samples"] if x["phase"] == "idle_start")
    for s in report["samples"]:
        raw = np.frombuffer((out_dir / s["file"]).read_bytes(), dtype=np.uint8)
        fb = grid(raw.reshape(s["height"], s["width"], 4)[..., :3])
        fb = fb[max(0, s["height"] - 96):]  # the hero walks on the floor band (bottom of screen)
        found = None
        for index, (frame, mask) in enumerate(source):
            for mirrored in (False, True):
                f, m = (frame[:, ::-1], mask[:, ::-1]) if mirrored else (frame, mask)
                ratio, at = best_match(fb, f, m)
                if found is None or ratio > found["ratio"]:
                    found = {"frame": index, "mirrored": mirrored, "ratio": ratio, "at": at}
        row = {"phase": s["phase"], "x": s["x"], "y": s["y"], **found}
        allowed, mirror = EXPECT[s["phase"]]
        if s["phase"] == "air_after_left" and s["y"] >= ground:
            allowed = IDLE  # amostra ja pousada (y medido na RAM), nao no ar
        ok = found["ratio"] == 1.0 and found["frame"] in allowed and (mirror is None or found["mirrored"] == mirror)
        row["ok"] = ok
        if not ok:
            failures.append(row)
        results.append(row)
        print(json.dumps(row))
    for phase, sign in (("run_right", 1), ("run_left", -1)):
        xs = [r["x"] for r in results if r["phase"] == phase]
        if not all(sign * (b - a) > 0 for a, b in zip(xs, xs[1:])):
            failures.append({"phase": phase, "x_not_monotonic": xs})
    distinct_run = {r["frame"] for r in results if r["phase"].startswith("run_")}
    if len(distinct_run) < 2:
        failures.append({"run_cycle_frames": sorted(distinct_run)})
    verdict = {"schema": "retrodev.jv_motion_oracle/v1", "samples": results, "distinct_run_frames": sorted(distinct_run),
               "failures": failures, "status": "PASS" if not failures else "FAIL"}
    (out_dir / "oracle-report.json").write_text(json.dumps(verdict, indent=2) + "\n")
    print(verdict["status"], json.dumps(failures))
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
