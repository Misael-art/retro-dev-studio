#!/usr/bin/env bash
# Level-zero launcher: uses the canonical bootstrap when Node is absent.
# No shell profile, HOME, global npm policy or user data is rewritten.
set -euo pipefail

usage() {
  cat <<'EOF'
RetroDev Studio — new host / managed development session
  bash scripts/new-host.sh --plan
  bash scripts/new-host.sh --install [--offline] [--certify] [--build]
  bash scripts/new-host.sh --check
  bash scripts/new-host.sh --certify [--build]
  bash scripts/new-host.sh --run npm run dev

--plan is the read-only default. --install delegates to bootstrap.sh --ensure.
Install support: Linux x64 Arch/Manjaro/BigLinux; Windows: new-host.ps1.
Optional environment: RDS_WORK_ROOT (outside repo), RDS_HOST_CACHE,
RDS_BUILD_JOBS (1..8, default 2), RDS_MIN_FREE_GIB (default 35).
No ROM, MUGEN pack, credential or private backup is downloaded/restored.
EOF
}

case "${1:---plan}" in
  -h|--help) usage; exit 0 ;;
esac
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MODE="${1:---plan}"
case "$MODE" in
  --plan|--install|--check|--certify|--build|--run) ;;
  *) usage >&2; exit 2 ;;
esac
if [[ "$MODE" == "--install" ]]; then
  for arg in "${@:2}"; do
    case "$arg" in --offline|--certify|--build) ;; *) usage >&2; exit 2 ;; esac
  done
fi

PINNED_NODE_VERSION="$(<"$PROJECT_ROOT/.node-version")"
CACHE_BASE="${RDS_HOST_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/retrodevstudio}"
NODE_BIN="$CACHE_BASE/bootstrap/node-v${PINNED_NODE_VERSION}-linux-x64/bin/node"

if [[ "$MODE" == "--plan" && ! -x "$NODE_BIN" ]] && ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Read-only plan (Node is not installed):" \
    "Checkout: $PROJECT_ROOT" "Cache: $CACHE_BASE" \
    "Work: ${RDS_WORK_ROOT:-$HOME/RetroDevStudio-work}" \
    "Install: bash scripts/new-host.sh --install --certify --build" \
    "The canonical bootstrap checks supported OS/architecture and pinned downloads." \
    "READY and GUI acceptance require fresh execution; nothing was installed."
  exit 0
fi

if [[ "$MODE" == "--install" ]]; then
  [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]] || {
    printf '%s\n' 'Unsupported OS/architecture; no installation attempted.' >&2; exit 11;
  }
  # bootstrap.sh also validates the distro before installing its substrate.
  distro="$(. /etc/os-release && printf '%s' "$ID")"
  case "$distro" in arch|manjaro|biglinux) ;; *)
    printf 'Unsupported distribution: %s. See docs/handoffs/NOVO_HOST_INICIO.md\n' "$distro" >&2
    exit 11 ;;
  esac
  export RDS_BUILD_JOBS="${RDS_BUILD_JOBS:-2}"
  [[ "$RDS_BUILD_JOBS" =~ ^[1-8]$ ]] || { printf '%s\n' 'RDS_BUILD_JOBS must be 1..8.' >&2; exit 2; }
  export CARGO_BUILD_JOBS="$RDS_BUILD_JOBS"
  export RDS_WORK_ROOT="${RDS_WORK_ROOT:-$HOME/RetroDevStudio-work}"
  # A non-hidden native tmp path avoids the recorded Ghidra hidden-folder failure.
  case "$RDS_WORK_ROOT" in /*) ;; *) printf '%s\n' 'RDS_WORK_ROOT must be absolute.' >&2; exit 2 ;; esac
  RDS_WORK_ROOT="$(realpath -m -- "$RDS_WORK_ROOT")"
  [[ "$RDS_WORK_ROOT" != "/" && "$RDS_WORK_ROOT" != "$HOME" ]] || {
    printf '%s\n' 'Work root must be a dedicated subdirectory, not HOME or /.' >&2; exit 2;
  }
  case "$RDS_WORK_ROOT/" in "$PROJECT_ROOT/"*) printf '%s\n' 'Work root must be outside checkout.' >&2; exit 2 ;; esac
  case "/$RDS_WORK_ROOT/" in */.*/|*/../*|*/./*) printf '%s\n' 'Use a non-hidden work root without dot segments.' >&2; exit 2 ;; esac
  minimum="${RDS_MIN_FREE_GIB:-35}"
  [[ "$minimum" =~ ^[1-9][0-9]*$ && "$minimum" -ge 16 ]] || {
    printf '%s\n' 'RDS_MIN_FREE_GIB must be an integer >=16.' >&2; exit 2;
  }
  # Before Node exists, check the checkout and nearest existing cache/work parents.
  for location in "$PROJECT_ROOT" "$CACHE_BASE" "$RDS_WORK_ROOT"; do
    parent="$location"
    while [[ ! -d "$parent" ]]; do parent="$(dirname -- "$parent")"; done
    available="$(df -Pk -- "$parent" | awk 'END {print $4}')"
    [[ "$available" =~ ^[0-9]+$ ]] || { printf 'Cannot measure space: %s\n' "$parent" >&2; exit 10; }
    (( available >= minimum * 1024 * 1024 )) || {
      printf 'Insufficient space at %s: need %s GiB free. No automatic deletion.\n' "$parent" "$minimum" >&2; exit 10;
    }
  done
  mkdir -p -- "$RDS_WORK_ROOT/tmp" "$RDS_WORK_ROOT/sessions"
  export TMPDIR="$RDS_WORK_ROOT/tmp"
  bootstrap_log="$RDS_WORK_ROOT/sessions/bootstrap-$(date -u +%Y%m%dT%H%M%SZ)-$$.log"
  bootstrap_args=(--ensure --profile full --skip-npm-ci)
  for arg in "${@:2}"; do [[ "$arg" != "--offline" ]] || bootstrap_args+=(--offline); done
  bash "$SCRIPT_DIR/bootstrap.sh" "${bootstrap_args[@]}" 2>&1 | tee "$bootstrap_log"
fi

if [[ -x "$NODE_BIN" ]]; then
  exec "$NODE_BIN" "$SCRIPT_DIR/new-host.mjs" "$@"
elif command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/new-host.mjs" "$@"
else
  printf '%s\n' 'Node is absent. Run: bash scripts/new-host.sh --install --certify --build' >&2
  exit 10
fi
