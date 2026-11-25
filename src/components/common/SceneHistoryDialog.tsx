import { useEffect, useMemo, useRef } from "react";
import { describeSceneHistory } from "../../core/sceneHistory";
import { useEditorStore, type UndoEntry } from "../../core/store/editorStore";
import type { Scene } from "../../core/ipc/sceneService";

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
  const dialog = useRef<HTMLDialogElement>(null);
  const undoStack = useEditorStore((state) => state.undoStack);
  const redoStack = useEditorStore((state) => state.redoStack);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const scene = useEditorStore((state) => state.activeSceneSource ?? state.activeScene);
  const undoRows = useMemo(() => steps(undoStack, scene), [undoStack, scene]);
  const redoRows = useMemo(() => steps(redoStack, scene, true), [redoStack, scene]);
  useEffect(() => {
    const surface = dialog.current;
    if (surface?.showModal) surface.showModal();
    return () => { if (surface?.open) surface.close(); };
  }, []);

  return <dialog ref={dialog} data-testid="scene-history" aria-labelledby="scene-history-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="max-h-[75vh] w-[min(38rem,96vw)] rounded-lg border border-[var(--rds-border-default)] bg-[var(--rds-surface-panel)] p-4 text-[var(--rds-text-primary)] backdrop:bg-black/60">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="scene-history-title" className="font-semibold">Histórico da cena</h2>
      <button type="button" className={button} onClick={onClose} autoFocus>Fechar</button>
    </div>
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
  </dialog>;
}
