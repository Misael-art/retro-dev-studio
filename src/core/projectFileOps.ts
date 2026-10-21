// Operações de arquivo do projeto (Experimental, REQ-03/04/05): renomear/mover asset e aplicar
// exceção ao modelo escrevem arquivos fora do histórico em memória. Por isso: salvar antes, operar
// com cópia de segurança no backend, recarregar a cena do disco e declarar o limite do desfazer —
// a volta é pela cópia ("Reverter"), que devolve os bytes exatos.
import { invoke } from "@tauri-apps/api/core";

import { persistActiveScene, reloadSceneFromDisk } from "./scenePersistence";
import { useEditorStore } from "./store/editorStore";

export interface ProjectBackupInfo {
  id: string;
  reason: string;
}

export interface PathReference {
  file: string;
  pointer: string;
  value: string;
  exists: boolean;
}

export interface RenameReport {
  from: string;
  to: string;
  updated: Array<[string, number]>;
  backup: ProjectBackupInfo;
}

export interface ApplyToModelReport {
  entity_id: string;
  component: string;
  prefab: string;
  uses: number;
  backup: ProjectBackupInfo;
}

export function auditProjectPaths(projectDir: string): Promise<PathReference[]> {
  return invoke<PathReference[]>("project_audit_paths", { projectDir });
}

async function runFileOperation<T extends { backup: ProjectBackupInfo }>(
  label: string,
  operation: (projectDir: string) => Promise<T>
): Promise<{ ok: true; report: T } | { ok: false; message: string }> {
  const { activeProjectDir, logMessage, setLastFileBackup } = useEditorStore.getState();
  if (!activeProjectDir) return { ok: false, message: "Abra um projeto." };
  if (!(await persistActiveScene(activeProjectDir, label))) {
    return { ok: false, message: "A cena atual não pôde ser salva; nada foi alterado." };
  }
  try {
    const report = await operation(activeProjectDir);
    await reloadSceneFromDisk(activeProjectDir, label);
    setLastFileBackup({ id: report.backup.id, reason: report.backup.reason });
    logMessage(
      "info",
      `[${label}] Concluído. O desfazer recomeçou a partir daqui (operação de arquivo); para voltar use "Reverter" (cópia ${report.backup.id}).`
    );
    return { ok: true, report };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    logMessage("error", `[${label}] ${message}`);
    return { ok: false, message };
  }
}

export function renameProjectAsset(from: string, to: string) {
  return runFileOperation("Renomear asset", (projectDir) => invoke<RenameReport>("project_rename_asset", { projectDir, from, to }));
}

export function applyOverrideToModel(entityId: string, component: string) {
  const scenePath = useEditorStore.getState().activeScenePath;
  return runFileOperation("Aplicar ao modelo", (projectDir) =>
    invoke<ApplyToModelReport>("project_apply_override_to_model", { projectDir, scenePath, entityId, component })
  );
}

export async function revertLastFileOperation(): Promise<{ ok: boolean; message: string }> {
  const { activeProjectDir, lastFileBackup, logMessage, setLastFileBackup } = useEditorStore.getState();
  if (!activeProjectDir || !lastFileBackup) return { ok: false, message: "Nada para reverter." };
  try {
    await invoke("project_restore_backup", { projectDir: activeProjectDir, backupId: lastFileBackup.id });
    await reloadSceneFromDisk(activeProjectDir, "Reverter");
    setLastFileBackup(null);
    logMessage("info", `[Reverter] Restaurado: ${lastFileBackup.reason}.`);
    return { ok: true, message: lastFileBackup.reason };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    logMessage("error", `[Reverter] ${message}`);
    return { ok: false, message };
  }
}
