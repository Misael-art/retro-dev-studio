import { useMemo } from "react";
import { describeSceneHistory } from "../../core/sceneHistory";
import { useEditorStore, type UndoEntry } from "../../core/store/editorStore";
import type { Scene } from "../../core/ipc/sceneService";
import Dialog from "./Dialog";

const rowLimit = 8;
const button = "rounded border border-[var(--rds-border-default)] px-2 py-1 disabled:opacity-40";
const sceneFrom = (entry: UndoEntry) => entry.activeSceneSource ?? entry.activeScene;

function steps(stack: readonly UndoEntry[], current: Scene | null, redo = false) {
  return stack.slice(-rowLimit).reverse().map((entry) => {
    const other = sceneFrom(entry);
    const description = redo ? describeSceneHistory(current, other) : describeSceneHistory(other, current);
    current = other;
    return description;
  });
}

export default function SceneHistoryDialog({ onClose }: { onClose: () => void }) {
  const undoStack = useEditorStore((state) => state.undoStack);
  const redoStack = useEditorStore((state) => state.redoStack);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const scene = useEditorStore((state) => state.activeSceneSource ?? state.activeScene);
  const undoRows = useMemo(() => steps(undoStack, scene), [undoStack, scene]);
  const redoRows = useMemo(() => steps(redoStack, scene, true), [redoStack, scene]);
  return <Dialog open title="Histórico da cena" onClose={onClose} testId="scene-history"
    className="w-[min(38rem,96vw)]">
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" data-testid="scene-history-undo" className={button} disabled={!undoStack.length} onClick={undo}>Desfazer</button>
      <button type="button" data-testid="scene-history-redo" className={button} disabled={!redoStack.length} onClick={redo}>Refazer</button>
    </div>
    {(undoStack.length > rowLimit || redoStack.length > rowLimit) && <p className="mt-2 text-xs">Até {rowLimit} alterações visíveis por direção.</p>}
    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      {([["Desfazer", undoRows], ["Refazer", redoRows]] as const).map(([label, rows]) => <section key={label}>
        <h3 className="font-semibold">{label}</h3>
        {rows.length ? <ol className="space-y-1" aria-label={`Próximas operações de ${label.toLowerCase()}`}>
          {rows.map((row, index) => <li key={`${index}-${row[0]}`} className="rounded border border-[var(--rds-border-subtle)] p-2">
            {row.map((text, line) => <p key={`${line}-${text}`}>{text}</p>)}
          </li>)}
        </ol> : <p className="text-[var(--rds-text-secondary)]">Nenhuma alteração nesta direção.</p>}
      </section>)}
    </div>
  </Dialog>;
}
