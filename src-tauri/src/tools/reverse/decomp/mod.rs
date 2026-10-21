//! Núcleo estático da decompilação pareada M68K (`docs/12_DECOMPILACAO_PAREADA_PLANO.md`,
//! Fase 0 / Sprint 1, sob GO formal do operador em 2026-09-09).
//!
//! Determinístico: sem LLM, sem UI e sem comandos Tauri nesta fase. Toda ROM é BYOR
//! (host-provided, somente leitura; nada de ROM versionada no repo). Saídas persistidas
//! ficam em `RDS_DECOMP_WORK` (default `~/.retrodev/decomp_work`) e relatórios de
//! validação em `target-test/validation/decomp/` (gitignored).
//!
//! API staged: os consumidores de produção (comandos/Reverse Workspace) chegam nas
//! fases seguintes do plano; hoje o núcleo é exercido pelos testes unitários e pelo
//! runner `#[ignore]` da Etapa A — daí o `allow(dead_code)` de módulo.

#![allow(dead_code)]

pub mod decomp_orch;
pub mod extract;
pub mod fingerprint;
pub mod ghidra_bridge;
pub mod graphics_discovery;
pub mod holdout;
pub mod inspection;
pub mod logic_recovery;
pub mod object_diff;
pub mod rex_addressing;
pub mod rex_aplib;
pub mod rex_codecs;
pub mod rex_context;
pub mod rex_edit;
pub mod rex_evidence;
pub mod rex_evidence_origin;
// Superfície anterior da classe contador/comparação: só compila em teste (regressão + prova no core).
// O produto usa `rex_profile_semantic` + `rex_profile_ipc`.
#[cfg(test)]
pub mod rex_gameplay;
// Adaptadores de compatibilidade do primeiro perfil: só compilam em teste (regressão e oráculos).
mod rex_copy_grid;
#[cfg(test)]
pub mod rex_jump_ipc;
pub mod rex_kosinski;
pub mod rex_mdgfx;
pub mod rex_nemesis;
#[cfg(test)]
pub mod rex_platformer_jump;
pub mod rex_profile_engine;
pub mod rex_profile_graph;
pub mod rex_profile_ipc;
pub mod rex_profile_registry;
pub mod rex_profile_semantic;
pub mod rex_profile_spec;
#[cfg(test)]
mod rex_profile_testkit;
pub mod rex_publish;
pub mod rex_resources;
pub mod rex_sigscan;
pub mod rom_library;
pub mod sonic_cadence;
pub mod sonic_consumers;
pub mod sonic_layouts;
pub mod sonic_sequence;
pub mod sonic_sprite;
pub mod sonic_ss_walls;
pub mod sprite_composition;
pub mod symbols;
pub mod triage;
