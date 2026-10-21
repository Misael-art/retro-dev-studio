#!/usr/bin/env python3
"""Run the native Sonic desktop proof on an owned, authenticated Xvfb display.

External QA only. Does not install software or change the user's display.
Supply an independently verified Xvfb executable and its SHA-256.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import select
import subprocess
import tempfile


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("xvfb", "xvfb-sha256", "app", "work", "log"):
        parser.add_argument(f"--{name}", required=True)
    # Jornadas autorais/MUGEN nao usam ROM comercial: --rom so e exigido pelos cenarios REX.
    parser.add_argument("--rom")
    parser.add_argument("--window", default="1920x1080", help="tamanho da janela do app (LxA)")
    parser.add_argument("--scenario", choices=("sonic-multiframe", "inspection-sonic-tiles", "sonic-cadence-journey", "sonic-anim-integrada", "sonic-anim-visual-diagnostico", "compositing-medicao", "sonic-sequencia-journey", "sonic-layouts-journey", "sonic-consumers-inspection", "sonic-logic-graphs", "jump-profile-journey", "jump-canvas-journey", "profile-authoring-journey", "semantic-gate-journey", "rex-prepared-observation", "jump-gameplay-journey", "nodegraph-authoring", "studio-e1", "studio-e4", "studio-e2e5", "studio-e6", "studio-scene", "studio-model", "studio-hud-camera", "studio-paletas", "mugen-real", "mugen-import"), default="sonic-multiframe")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    xvfb, app = (Path(value).resolve(strict=True) for value in (args.xvfb, args.app))
    rom = Path(args.rom).resolve(strict=True) if args.rom else None
    if rom is None and not args.scenario.startswith(("studio-", "mugen-")):
        raise SystemExit("--rom e obrigatorio para este cenario")
    win_w, win_h = (int(v) for v in args.window.lower().split("x"))
    if sha256(xvfb) != args.xvfb_sha256:
        raise SystemExit("Xvfb executable differs from the supplied immutable identity")
    work, log_path = (Path(value).resolve() for value in (args.work, args.log))
    work.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    display_process = None
    read_fd, write_fd = os.pipe()
    with tempfile.TemporaryDirectory(prefix="sonic-display-auth-", dir=work) as auth_dir, log_path.open("w") as log:
        auth = Path(auth_dir) / "authority"
        auth.touch(mode=0o600)
        cookie = secrets.token_hex(16)

        def authorize(display):
            subprocess.run(["rtk", "proxy", "xauth", "-q", "-f", str(auth)],
                           input=f"add :{display} MIT-MAGIC-COOKIE-1 {cookie}\n", text=True,
                           stdout=log, stderr=subprocess.STDOUT, check=True)

        try:
            authorize(0)
            display_process = subprocess.Popen(
                [str(xvfb), "-displayfd", str(write_fd), "-screen", "0", "1920x1080x24",
                 "-nolisten", "tcp", "-noreset", "-auth", str(auth)],
                pass_fds=(write_fd,), stdout=log, stderr=subprocess.STDOUT)
            os.close(write_fd)
            write_fd = None
            if not select.select([read_fd], [], [], 15)[0]:
                raise RuntimeError("Owned Xvfb did not become ready within 15 seconds")
            display = os.read(read_fd, 64).decode("ascii").strip()
            if not display.isdecimal() or display_process.poll() is not None:
                raise RuntimeError("Owned Xvfb did not provide a live display")
            authorize(display)
            env = os.environ.copy()
            env.pop("WAYLAND_DISPLAY", None)
            env.update(DISPLAY=f":{display}", XAUTHORITY=str(auth), GDK_BACKEND="x11",
                       GDK_SCALE="1", GDK_DPI_SCALE="1",
                       RDS_DECOMP_WORK=str(work), RDS_E2E_WINDOW_X="0", RDS_E2E_WINDOW_Y="0",
                       RDS_E2E_WINDOW_WIDTH=str(win_w), RDS_E2E_WINDOW_HEIGHT=str(win_h),
                       RDS_E2E_UI_TIMEOUT_MS="45000")
            if rom is not None:
                env["RDS_INSPECTION_ROM"] = str(rom)
            metadata = {"scenario": args.scenario, "display": env["DISPLAY"],
                        "screen": "1920x1080x24", "xvfb_sha256": sha256(xvfb),
                        "app_sha256": sha256(app), "rom_sha256": sha256(rom) if rom else None,
                        "window": f"{win_w}x{win_h}",
                        "system_display_modified": False}
            log.write(json.dumps(metadata) + "\n")
            log.flush()
            result = subprocess.run(["rtk", "proxy", "node", "scripts/e2e-tauri-build-run.mjs",
                                     "--skip-build", "--scenario", args.scenario, "--app", str(app)],
                                    cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
            metadata["exit_code"] = result.returncode
            log_path.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
            return result.returncode
        finally:
            os.close(read_fd)
            if write_fd is not None:
                os.close(write_fd)
            if display_process is not None and display_process.poll() is None:
                display_process.terminate()
                try:
                    display_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    display_process.kill()
                    display_process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
