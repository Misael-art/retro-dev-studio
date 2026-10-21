// Trazer uma imagem de cenário para o projeto (Experimental): diálogo nativo, ou caminho
// pré-definido pela automação desktop (mesmo padrão do som), e cópia validada pelo backend
// para `assets/tilesets/`. A cena recebe o tilemap pelo caminho canônico de instanciação.
import { invoke } from "@tauri-apps/api/core";

export interface ImportedImage {
  relative_path: string;
  width: number;
  height: number;
  tiles_wide: number;
  tiles_high: number;
  colors: number;
  sha256: string;
  reused_existing: boolean;
  warnings: string[];
}

let nextAutomationPath: string | null = null;

export function setNextImageImportPath(path: string): void {
  nextAutomationPath = path;
}

export async function chooseAndImportImage(projectDir: string): Promise<ImportedImage | null> {
  const automation = nextAutomationPath;
  nextAutomationPath = null;
  const source = automation ?? (await invoke<string | null>("pick_image_file_dialog"));
  if (!source) return null;
  return invoke<ImportedImage>("import_project_image", { projectDir, sourcePath: source });
}
