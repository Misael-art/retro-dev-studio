import { useState } from "react";

import { describeEditScope } from "../../core/editScope";
import { parseSceneJson, resolveScenePrefabs, type Scene } from "../../core/ipc/sceneService";
import { useEditorStore } from "../../core/store/editorStore";
import { applyOverrideToModel } from "../../core/projectFileOps";

const COMPONENT_LABEL: Record<string, string> = {
  sprite: "Aparência",
  collision: "Colisão",
  input: "Controle",
  physics: "Física",
  audio: "Áudio",
  logic: "Comportamento",
  camera: "Câmera",
  tilemap: "Cenário",
};

/**
 * Mostra o alcance da edição da entidade (REQ-04, Experimental): “Nesta cena” ou “Nesta instância”
 * de um modelo com N usos, as exceções locais e a ação reversível de voltar a herdar do modelo.
 */
export default function EditScopeBadge({ entityId }: { entityId: string }) {
  const activeProjectDir = useEditorStore((state) => state.activeProjectDir);
  const source = useEditorStore((state) => state.activeSceneSource);
  const resolved = useEditorStore((state) => state.activeScene);
  const replaceScenesWithHistory = useEditorStore((state) => state.replaceScenesWithHistory);
  const logMessage = useEditorStore((state) => state.logMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scope = describeEditScope(source ?? resolved, resolved, entityId);
  if (!scope) return null;

  async function revert(component: string) {
    const base = source ?? resolved;
    if (!base || !activeProjectDir) return;
    setBusy(component);
    setError(null);
    try {
      const nextSource: Scene = structuredClone(base);
      const target = nextSource.entities.find((entity) => entity.entity_id === entityId);
      if (!target) throw new Error("Entidade não encontrada na cena-fonte.");
      (target.components as Record<string, unknown>)[component] = null;
      const result = await resolveScenePrefabs(activeProjectDir, nextSource);
      const resolvedScene = result.ok ? parseSceneJson(result.scene_json) : null;
      if (!resolvedScene) throw new Error(result.error || "O modelo não pôde ser resolvido.");
      replaceScenesWithHistory(resolvedScene, nextSource);
      logMessage("info", `[Escopo] ${entityId}: ${COMPONENT_LABEL[component] ?? component} voltou a seguir o modelo.`);
    } catch (cause) {
      // Falha: nada é gravado; a cena continua no último estado válido.
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      logMessage("error", `[Escopo] Não foi possível restaurar do modelo: ${message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      data-testid="inspector-edit-scope"
      data-scope={scope.kind}
      className="mt-1 rounded border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-2 py-1 text-[9px] text-[#ddd6fe]"
    >
      <p className="font-semibold">{scope.label}</p>
      {scope.kind === "instance" ? (
        <>
          <p data-testid="inspector-edit-scope-model">
            Modelo {scope.model.replace(/\.json$/i, "")} — {scope.uses} uso{scope.uses === 1 ? "" : "s"}
          </p>
          {scope.overridden.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5">
              {scope.overridden.map((component) => (
                <li key={component} className="flex items-center gap-1">
                  <span>Exceção local: {COMPONENT_LABEL[component] ?? component}</span>
                  <button
                    type="button"
                    data-testid={`inspector-edit-scope-apply-${component}`}
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(component);
                      setError(null);
                      const outcome = await applyOverrideToModel(entityId, component);
                      setBusy(null);
                      if (!outcome.ok) setError(outcome.message);
                    }}
                    title={`Leva esta exceção para o modelo: muda as ${scope.uses} instâncias (salva o projeto; volta por Reverter)`}
                    className="rounded border border-[#a6e3a1]/60 px-1 text-[#a6e3a1] disabled:opacity-40"
                  >
                    Aplicar ao modelo ({scope.uses})
                  </button>
                  <button
                    type="button"
                    data-testid={`inspector-edit-scope-revert-${component}`}
                    disabled={busy !== null}
                    onClick={() => void revert(component)}
                    title="Remove a exceção desta instância; ela volta a seguir o modelo (pode ser desfeito)"
                    className="ml-auto rounded border border-[#a78bfa]/60 px-1 disabled:opacity-40"
                  >
                    {busy === component ? "Restaurando…" : "Restaurar do modelo"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#a6adc8]">Tudo vem do modelo; editar aqui cria uma exceção só desta instância.</p>
          )}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[#f38ba8]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
