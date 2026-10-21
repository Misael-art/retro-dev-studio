// Trazer um som para o projeto (Experimental): diálogo nativo de arquivo, ou caminho pré-definido
// pela automação desktop (mesmo padrão do import externo), seguido da cópia validada pelo backend.
import { invoke } from "@tauri-apps/api/core";

export interface ImportedAudio {
  relative_path: string;
  sha256: string;
  report: { warnings: string[]; sample_rate: { status: string; detail: string } };
}

let nextAutomationPath: string | null = null;

export function setNextAudioImportPath(path: string): void {
  nextAutomationPath = path;
}

export async function chooseAndImportAudio(projectDir: string): Promise<ImportedAudio | null> {
  const automation = nextAutomationPath;
  nextAutomationPath = null;
  const source = automation ?? (await invoke<string | null>("pick_audio_file_dialog"));
  if (!source) return null;
  return invoke<ImportedAudio>("import_project_audio", { projectDir, sourcePath: source });
}

/** Nome de ação de SFX a partir do arquivo (identificador do driver). */
export function sfxActionFromPath(relativePath: string): string {
  const stem = relativePath.split("/").pop()?.replace(/\.wav$/i, "") ?? "som";
  const id = stem.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return /^[a-z_]/.test(id) ? id : `s_${id}`;
}
