# Continuity after host reinstall

**2026-10-24 addendum:** start with [NOVO_HOST_INICIO.md](NOVO_HOST_INICIO.md), the managed launcher and the [updated assessment](REAVALIACAO_PRODUTO_2026-10-24.md). Later audit lots include successful build/run/export (LOT028), although the 16 journeys remain partial and human usability has not been tested. Read the migration snapshot below as historical; its initial audit summary is superseded by this addendum. The new launcher PR is based on recovery checkpoint `95d5ef23`; it does not merge research branches or certify the reinstalled OS.

This recovery branch is a source snapshot of `a8550af0e0bdd74c44478f94d301576b988747a1` on the existing public recovery base `a2f87d86f5591724464250bcebe13266c743e210`. It does not merge, release or promote the product. Runtime source trees (src, src-tauri, crates and scripts) are byte-identical to the local Studio checkpoint. The original worktree and its branch were not rewritten.

The full local Git history, uncommitted overlays, project data, audit gallery and agent context are preserved separately in the operator's private preformat bundle. New binary captures/dumps/patch evidence is deliberately not published here; see PREFORMAT-PRIVATE-ARTIFACTS-2026-10-21.json for exact paths and hashes. Authored test ROM fixtures remain project fixtures; personal ROM collections are operator-managed and were neither copied nor deleted by this task.

Use the private LEIA-ME-ANTES-DE-FORMATAR.md and HANDOFF-NOVO-AGENTE.md to restore uncommitted work, old branches and external data. The research REA branch ee8c581f and commercial checkpoint 40a17169 remain individually recoverable from the private bundle. Do not assume main or this snapshot contains every separate research branch or its runtime evidence.

Start with the checkout's AGENTS.md and canonical Memory Bank. Provision the new OS with the supported bootstrap; verify Node .node-version, Rust rust-toolchain.toml and the host lock. Install dependencies with the lockfile. Run host:diagnose, the required gates, build:portable and host:certify. Execute the affected desktop journeys on the new binary. Old READY and old test counts are historical evidence, not certification of the reinstalled host.

Priority is closing the user journey, not claiming universal decompilation. Preserve the 61-card UX audit, independent reviews, errata and coverage. Its 16 journeys remained partial/blocked; no full human usability acceptance or Build → ROM → Emulation acceptance was established in that audit. Keep the sound pending item separate. Retain Experimental.

Cargo intermediates were safely cleaned to recover disk space. Sources, evidence and the final test executable were preserved. Fresh builds will regenerate intermediates. Do not delete rds-scratch or validation directories in bulk.

No clean-OS installation was executed before this snapshot. The private backup destination still requires operator confirmation before formatting. Authentication must be recreated; credentials and raw agent histories are not public project artifacts.
