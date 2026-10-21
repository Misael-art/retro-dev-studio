import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { getEntityDisplayName } from "../../core/entityDisplay";
import { emulatorReadMemory } from "../../core/ipc/emulatorService";
import { useEditorStore } from "../../core/store/editorStore";
import {
  adjustmentDiff,
  liveAdjustments,
  patchesFor,
  upsertAdjustment,
  type AdjustableField,
} from "../../core/testAdjustments";

async function readS16(address: number): Promise<number> {
  const r = await emulatorReadMemory(2, address & 0xffff, 2);
  if (!r.ok || r.data.length < 2) throw new Error("Leitura da RAM falhou.");
  const w = r.data[0] | (r.data[1] << 8);
  return w > 0x7fff ? w - 0x10000 : w;
}

/**
 * Ajustes do teste (Experimental, REQ-20): mover uma entidade vinculada no jogo pausado muda só a
 * execução atual. A faixa amarela lembra que é temporário; "Aplicar ao projeto" mostra o diff e
 * aplica os itens escolhidos numa única entrada de desfazer.
 */
export default function TestAdjustPanel({ paused, renderedFrames }: { paused: boolean; renderedFrames: number }) {
  const link = useEditorStore((state) => state.lastRuntimeLink);
  const romSha = useEditorStore((state) => state.emulatorRomIdentity?.sha256 ?? null);
  const epoch = useEditorStore((state) => state.coreEpoch);
  const scene = useEditorStore((state) => state.activeScene);
  const adjustments = useEditorStore((state) => state.testAdjustments);
  const setAdjustments = useEditorStore((state) => state.setTestAdjustments);
  const updateEntity = useEditorStore((state) => state.updateEntity);
  const beginHistoryCapture = useEditorStore((state) => state.beginHistoryCapture);
  const commitHistoryCapture = useEditorStore((state) => state.commitHistoryCapture);
  const logMessage = useEditorStore((state) => state.logMessage);
  const [values, setValues] = useState<Record<string, { x: number; y: number }>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const usable = Boolean(link && romSha && link.rom_sha256 === romSha && epoch !== null);
  const live = liveAdjustments(adjustments, epoch);

  useEffect(() => {
    if (!usable || !paused || !link) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const entity of link.entities) {
        next[entity.entity_id] = { x: await readS16(entity.symbols.x), y: await readS16(entity.symbols.y) };
      }
      if (!cancelled) setValues(next);
    })().catch((cause) => setError(String(cause)));
    return () => {
      cancelled = true;
    };
  }, [link, paused, renderedFrames, usable]);

  if (!usable || !link) return null;

  async function adjust(entityId: string, field: AdjustableField, raw: string) {
    const value = Number.parseInt(raw, 10);
    const linked = link!.entities.find((e) => e.entity_id === entityId);
    const entity = scene?.entities.find((e) => e.entity_id === entityId);
    if (!linked || !entity || !Number.isInteger(value) || value < -32768 || value > 32767 || epoch === null) {
      setError("Use um número inteiro de pixels.");
      return;
    }
    const address = field === "transform.x" ? linked.symbols.x : linked.symbols.y;
    const word = value & 0xffff;
    try {
      const result = await invoke<{ ok: boolean }>("emulator_write_test_memory", {
        offset: address & 0xffff,
        data: [word & 0xff, word >> 8],
        sessionEpoch: epoch,
      });
      if (!result.ok) throw new Error("A RAM não confirmou o valor escrito.");
      const projectValue = field === "transform.x" ? entity.transform.x : entity.transform.y;
      setAdjustments(upsertAdjustment(useEditorStore.getState().testAdjustments, { entityId, field, projectValue, testValue: value, epoch }));
      setValues((current) => ({
        ...current,
        [entityId]: { ...current[entityId], [field === "transform.x" ? "x" : "y"]: value },
      }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const rows = adjustmentDiff(live, scene);

  function apply() {
    const patches = patchesFor(rows, chosen, scene);
    if (patches.length === 0) return;
    beginHistoryCapture();
    for (const patch of patches) {
      updateEntity(patch.entityId, { transform: patch.transform }, { recordHistory: false });
    }
    commitHistoryCapture();
    const applied = new Set([...chosen]);
    setAdjustments(useEditorStore.getState().testAdjustments.filter((a) => !applied.has(`${a.entityId}:${a.field}`)));
    setReviewing(false);
    logMessage("info", `[Teste] ${patches.length} ajuste(s) aplicado(s) ao projeto (desfazer reverte juntos).`);
  }

  return (
    <aside data-testid="test-adjust-panel" aria-label="Ajustes do teste" className="mt-2 w-full max-w-md rounded border border-[#313244] bg-[#0b1120] p-2 text-[10px] text-[#cdd6f4]">
      <p className="mb-1 font-semibold">Ajustes do teste <span className="text-[#94a3b8]">(Experimental · posição em pixels)</span></p>
      {!paused ? <p className="text-[#94a3b8]">Pause para ajustar.</p> : null}
      <ul className="space-y-1">
        {link.entities.map((linked) => {
          const entity = scene?.entities.find((e) => e.entity_id === linked.entity_id);
          const v = values[linked.entity_id];
          return (
            <li key={linked.entity_id} className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate">{entity ? getEntityDisplayName(entity) : linked.entity_id}</span>
              {(["transform.x", "transform.y"] as AdjustableField[]).map((field) => {
                const key = `${linked.entity_id}:${field}`;
                return (
                  <label key={field} className="flex items-center gap-0.5">
                    {field === "transform.x" ? "X" : "Y"}
                    <input
                      data-testid={`test-adjust-${linked.entity_id}-${field === "transform.x" ? "x" : "y"}`}
                      type="text"
                      inputMode="numeric"
                      disabled={!paused}
                      value={drafts[key] ?? (v ? String(field === "transform.x" ? v.x : v.y) : "")}
                      onChange={(event) => setDrafts((d) => ({ ...d, [key]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                      }}
                      onBlur={() => {
                        const raw = drafts[key];
                        setDrafts((d) => {
                          const next = { ...d };
                          delete next[key];
                          return next;
                        });
                        if (raw !== undefined) void adjust(linked.entity_id, field, raw);
                      }}
                      className="w-12 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
                    />
                  </label>
                );
              })}
            </li>
          );
        })}
      </ul>
      {live.length > 0 ? (
        <div data-testid="test-adjust-banner" role="status" className="mt-2 rounded border border-[#fbbf24]/60 bg-[#fbbf24]/10 p-1.5 text-[#fde68a]">
          <p className="font-semibold">⚠ Alterações do teste são temporárias</p>
          <p>{live.length} ajuste(s) só nesta execução; não foram salvos no projeto.</p>
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              data-testid="test-adjust-review"
              onClick={() => {
                setChosen(new Set(rows.filter((r) => !r.conflict).map((r) => r.key)));
                setReviewing(true);
              }}
              className="rounded border border-[#a6e3a1]/60 px-2 text-[#a6e3a1]"
            >
              Aplicar ao projeto…
            </button>
            <button type="button" data-testid="test-adjust-discard" onClick={() => setAdjustments([])} className="rounded border border-[#334155] px-2">
              Descartar lista
            </button>
          </div>
        </div>
      ) : null}
      {reviewing ? (
        <div role="dialog" aria-label="Aplicar ajustes ao projeto" data-testid="test-adjust-diff" className="mt-2 rounded border border-[#334155] p-1.5">
          <p className="mb-1 font-semibold">Escolha o que vira propriedade do projeto:</p>
          {rows.map((row) => (
            <label key={row.key} className="flex items-center gap-1" data-testid={`test-adjust-row-${row.key}`}>
              <input
                type="checkbox"
                checked={chosen.has(row.key)}
                disabled={row.conflict}
                onChange={(event) =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(row.key);
                    else next.delete(row.key);
                    return next;
                  })
                }
              />
              {row.adjustment.entityId} · {row.adjustment.field === "transform.x" ? "posição X" : "posição Y"}:{" "}
              {row.adjustment.projectValue} → {row.adjustment.testValue}
              {row.conflict ? <span className="text-[#f38ba8]"> (o projeto mudou depois; não aplicável)</span> : null}
            </label>
          ))}
          <div className="mt-1 flex gap-1">
            <button type="button" data-testid="test-adjust-apply" disabled={chosen.size === 0} onClick={apply} className="rounded border border-[#a6e3a1]/60 px-2 text-[#a6e3a1] disabled:opacity-40">
              Aplicar selecionados
            </button>
            <button type="button" data-testid="test-adjust-cancel" onClick={() => setReviewing(false)} className="rounded border border-[#334155] px-2">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-[#f38ba8]">{error}</p> : null}
    </aside>
  );
}
