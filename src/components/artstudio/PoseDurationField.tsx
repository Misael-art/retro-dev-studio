import { describeOccurrences, nativeAnimationNames, setOccurrenceDuration } from "../../core/characterTimeline";
import { describeEntityEditLock, entityEditLock, entityLockScopeKey } from "../../core/sceneComposition";
import { useEditorStore } from "../../core/store/editorStore";

export default function PoseDurationField({ testId, canvas = false }: { testId: string; canvas?: boolean }) {
  const { entityId, animation, occurrenceId } = useEditorStore((state) => state.studio.focus);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const activeTarget = useEditorStore((state) => state.activeTarget);
  const projectSourceKind = useEditorStore((state) => state.projectSourceKind);
  const projectFps = useEditorStore((state) => state.projectFps);
  const projectSessionId = useEditorStore((state) => state.projectSessionId);
  const scenePath = useEditorStore((state) => state.activeScenePath);
  const sprite = useEditorStore((state) => state.activeScene?.entities
    .find((entity) => entity.entity_id === entityId)?.components.sprite);
  const blocked = useEditorStore((state) => canvas && entityId ? describeEntityEditLock(entityEditLock(
    entityId, state.activeScene?.layers, state.lockedEntityIdsByScene[entityLockScopeKey(state.activeProjectDir, state.activeScenePath)] ?? [],
  )) : "");
  if (!sprite || !entityId || entityId !== selectedEntityId || !animation || !occurrenceId
    || !nativeAnimationNames(sprite, activeTarget, projectSourceKind).includes(animation)) return null;
  const def = sprite.animations?.[animation];
  if (!def) return null;
  const pose = describeOccurrences(def, projectFps).find((item) => item.id === occurrenceId);
  if (!pose) return null;

  return (
    <label className="flex items-center justify-between gap-2 rounded border border-[#45475a] px-2 py-1 text-[11px] text-[color:var(--rds-text-primary)]">
      <span>{animation} · ocorrência {pose.index + 1} (ticks)</span>
      <input
        key={JSON.stringify([projectSessionId, scenePath, entityId, animation, occurrenceId, pose.ticks])}
        type="text"
        inputMode="numeric"
        data-testid={testId}
        title={blocked || undefined}
        readOnly={Boolean(blocked)}
        defaultValue={pose.ticks}
        className="w-14 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono text-[#cdd6f4]"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            event.currentTarget.value = String(pose.ticks);
            event.currentTarget.blur();
          }
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => {
          const input = event.currentTarget;
          if (blocked) {
            input.value = String(pose.ticks);
            return;
          }
          if (input.value === String(pose.ticks)) return;
          const editor = useEditorStore.getState();
          const currentSprite = editor.activeScene?.entities.find((entity) => entity.entity_id === entityId)?.components.sprite;
          if (editor.projectSessionId !== projectSessionId || editor.activeScenePath !== scenePath
            || currentSprite?.animations?.[animation] !== def) {
            input.value = String(pose.ticks);
            editor.logMessage("warn", "A pose mudou durante a edição. Confira a duração atual antes de aplicar.");
            return;
          }
          const edited = setOccurrenceDuration(def, occurrenceId, input.value, projectFps);
          if (!edited.ok) {
            input.value = String(pose.ticks);
            editor.logMessage("warn", edited.message);
            return;
          }
          if (Number(input.value) === pose.ticks) {
            input.value = String(pose.ticks);
            return;
          }
          editor.updateEntity(entityId, { components: { sprite: {
            ...currentSprite, animations: { ...currentSprite.animations, [animation]: edited.def },
          } } });
        }}
      />
    </label>
  );
}
