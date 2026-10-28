import { invoke } from "@tauri-apps/api/core";
import type { SgdkImportSummary } from "../sgdkLogicDiagnostics";

export interface OpenProjectResult {
  selected: boolean;
  path: string;
  name: string;
  base_dir?: string | null;
  notice?: string | null;
  preferred_scene_path?: string | null;
  imported_scene_paths?: string[];
  import_summary?: SgdkImportSummary | null;
}

export interface OpenProjectSourceResult {
  ok: boolean;
  message: string;
  absolute_path?: string | null;
}

export type ProjectDestinationCollisionStatus =
  | "available"
  | "occupied"
  | "existing_project";

export interface ProjectDestinationPreview {
  requested_name: string;
  suggested_name: string;
  requested_dir_name: string;
  suggested_dir_name: string;
  preferred_path: string;
  resolved_path: string;
  collision_status: ProjectDestinationCollisionStatus;
  existing_project_path?: string | null;
  existing_project_name?: string | null;
}

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description: string;
  genre: string;
  difficulty: string;
  features: string[];
  source_kind: string;
  recommended_target: "megadrive" | "snes";
  experimental: boolean;
  mega_drive_only?: boolean;
  available: boolean;
  availability_reason?: string | null;
  default_donor_path?: string | null;
}

export interface ExternalImportProfileSummary {
  id: string;
  name: string;
  family: string;
  description: string;
  source_engine: string;
  support_status: string;
  supported_levels: string[];
  recommended_target: "megadrive" | "snes";
  experimental: boolean;
  importable: boolean;
  mega_drive_only: boolean;
}

export interface SaveRamConfig {
  enabled: boolean;
  size_bytes: number;
}

export interface ProjectSettingsSnapshot {
  target: "megadrive" | "snes";
  region: string;
  video_standard: string;
  internal_rom_name: string;
  sram: SaveRamConfig;
  save_slots: number;
  debug_overlay: boolean;
  warnings: string[];
}

export type ProjectSettingsPayload = Omit<ProjectSettingsSnapshot, "warnings">;

export interface ProjectSettingsUpdateResult {
  ok: boolean;
  message: string;
  settings?: ProjectSettingsSnapshot | null;
}

export function openProjectDialog(): Promise<OpenProjectResult> {
  return invoke("open_project_dialog");
}

export function openProjectPath(projectDir: string): Promise<OpenProjectResult> {
  return invoke("open_project_path", { projectDir });
}

export function authorizeProjectAssetScope(projectDir: string): Promise<string> {
  return invoke("authorize_project_asset_scope", { projectDir });
}

export function newProjectDialog(projectName: string): Promise<OpenProjectResult> {
  return invoke("new_project_dialog", { projectName });
}

export function suggestProjectBaseDir(): Promise<string> {
  return invoke("suggest_project_base_dir");
}

export function previewProjectDestination(
  projectName: string,
  baseDir: string
): Promise<ProjectDestinationPreview> {
  return invoke("preview_project_destination", { projectName, baseDir });
}

export function createOnboardingProject(
  projectName: string,
  target: "megadrive" | "snes",
  baseDir: string
): Promise<OpenProjectResult> {
  return invoke("create_onboarding_project", { projectName, target, baseDir });
}

export function listProjectTemplates(): Promise<ProjectTemplateSummary[]> {
  return invoke("list_project_templates");
}

export function listExternalImportProfiles(): Promise<ExternalImportProfileSummary[]> {
  return invoke("list_external_import_profiles");
}

export function createProjectFromTemplate(
  projectName: string,
  target: "megadrive" | "snes",
  baseDir: string,
  templateId: string,
  donorPath?: string
): Promise<OpenProjectResult> {
  return invoke("create_project_from_template", {
    projectName,
    target,
    baseDir,
    templateId,
    donorPath,
  });
}

export function importSgdkProject(
  projectName: string,
  baseDir: string,
  sgdkPath: string
): Promise<OpenProjectResult> {
  return invoke("import_sgdk_project", {
    projectName,
    baseDir,
    sgdkPath,
  });
}

export function importMugenProject(
  projectName: string,
  baseDir: string,
  mugenPath: string
): Promise<OpenProjectResult> {
  return invoke("import_mugen_project", {
    projectName,
    baseDir,
    mugenPath,
  });
}

export function importExternalProject(
  projectName: string,
  baseDir: string,
  profileId: string,
  projectPath: string,
  mugenReview?: import("../mugenReview").MugenReviewOptions
): Promise<OpenProjectResult> {
  return invoke("import_external_project", {
    projectName,
    baseDir,
    profileId,
    projectPath,
    mugenReview: mugenReview ?? null,
  });
}

export function importLegacySgdkProject(
  projectName: string,
  sgdkPath: string
): Promise<OpenProjectResult> {
  return invoke("import_legacy_sgdk_project", {
    projectName,
    sgdkPath,
  });
}

export function setProjectTarget(
  projectDir: string,
  target: "megadrive" | "snes"
): Promise<{ ok: boolean; message: string }> {
  return invoke("set_project_target", { projectDir, target });
}

export function openProjectSourcePath(
  projectDir: string,
  relativePath: string
): Promise<OpenProjectSourceResult> {
  return invoke("open_project_source_path", { projectDir, relativePath });
}

export function getProjectSettings(projectDir: string): Promise<ProjectSettingsSnapshot> {
  return invoke("get_project_settings", { projectDir });
}

export function updateProjectSettings(
  projectDir: string,
  settings: ProjectSettingsPayload
): Promise<ProjectSettingsUpdateResult> {
  return invoke("update_project_settings", { projectDir, settings });
}

export interface CGraphNode {
  id: string;
  kind: string;
  role: "item" | "syntax" | "comment";
  label: string;
  start_line: number;
  end_line: number;
  text?: string;
  children?: CGraphNode[];
  function?: string;
  calls?: string[];
  block?: CBlock;
}

export interface CBlock {
  node_type: string;
  form: "call" | "assign";
  target: string;
  operator: string;
  args: string[];
}

export interface CGraphFile {
  schema: string;
  source_file: string;
  source_sha256: string;
  parse_error_nodes: number;
  root: CGraphNode;
}

export interface CLink {
  category: string;
  text: string;
  node_id?: string;
}

export interface CStateTransition {
  from: string;
  to: string;
  line: number;
  node_id: string;
  function?: string | null;
  /** local | caller | unguarded | unknown */
  origin?: string;
  via?: string[];
  conditions?: CLink[];
  effects?: CLink[];
}

export interface CGraphIndex {
  schema: string;
  files: {
    source_file: string;
    graph_file: string;
    source_sha256: string;
    roundtrip_exact: boolean;
    parse_error_nodes: number;
    stale: boolean;
  }[];
  functions: { file: string; name: string; line: number; node_id: string; calls: string[] }[];
  state_machines: {
    file: string;
    function: string | null;
    subject: string;
    states: string[];
    transitions: CStateTransition[];
    line: number;
    node_id: string;
  }[];
  entry_points: string[];
}

export function getSgdkCGraphIndex(projectDir: string): Promise<CGraphIndex> {
  return invoke("sgdk_c_graph_index", { projectDir });
}

export function getSgdkCGraphFile(projectDir: string, sourceFile: string): Promise<CGraphFile> {
  return invoke("sgdk_c_graph_file", { projectDir, sourceFile });
}

export function updateSgdkCGraphNode(
  projectDir: string,
  sourceFile: string,
  nodeId: string,
  text: string
): Promise<CGraphFile> {
  return invoke("sgdk_c_graph_update_node", { projectDir, sourceFile, nodeId, text });
}

export function updateSgdkCGraphBlock(
  projectDir: string,
  sourceFile: string,
  nodeId: string,
  block: CBlock
): Promise<CGraphFile> {
  return invoke("sgdk_c_graph_update_block", { projectDir, sourceFile, nodeId, block });
}

/** Sprite do jogo SGDK como o `.res` declara: quadro, grade e pontos do C que o usam. */
export interface SgdkSpriteCatalogEntry {
  name: string;
  source: string;
  asset: string | null;
  frame_width: number;
  frame_height: number;
  columns: number;
  rows: number;
  refs: import("./emulatorService").SpriteCodeRef[];
}

export function getSgdkSpriteCatalog(projectDir: string): Promise<SgdkSpriteCatalogEntry[]> {
  return invoke("sgdk_sprite_catalog", { projectDir });
}
