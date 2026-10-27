// Paletas da cena (Experimental): resumo de ocupação e conflitos, painel completo e a seção do
// objeto selecionado. O plano exibido é o do build (IPC `scene_palette_plan`); cada ação calcula
// o plano proposto antes e só aplica sem erro novo, numa transação de desfazer.
import { useEffect, useMemo, useState } from "react";

import {
  affectedBy,
  assignResource,
  BANK_STATE_LABEL,
  createAuthoredPalette,
  createLocalVariant,
  editSharedColor,
  errorCount,
  pinBank,
  releaseUse,
  resourceOf,
  restoreFromFile,
  RESOURCE_STATE_LABEL,
  type PalettePlan,
  type PlanDiagnostic,
  type PlanResource,
  type PlanUse,
} from "../../core/palettePlan";
import { applyPalettes, palettePlanContextKey, usePalettePlanStore } from "../../core/palettePlanStore";
import { useEditorStore } from "../../core/store/editorStore";

export function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

function usePlan(): PalettePlan | null {
  const contextKey = useEditorStore(palettePlanContextKey);
  const planKey = usePalettePlanStore((s) => s.contextKey);
  const plan = usePalettePlanStore((s) => s.plan);
  const refresh = usePalettePlanStore((s) => s.refresh);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 150);
    return () => clearTimeout(t);
  }, [contextKey, refresh]);
  return planKey === contextKey ? plan : null;
}

function currentPalettes() {
  const s = useEditorStore.getState();
  return (s.activeSceneSource ?? s.activeScene)?.palettes ?? [];
}

function roleLabel(use: PlanUse): string {
  return use.role === "font" ? "texto" : use.role === "tilemap" ? "cenário" : "sprite";
}

function openUse(use: PlanUse) {
  const store = useEditorStore.getState();
  if (use.entity_id.startsWith("(")) return;
  store.setSelectedEntityId(use.entity_id);
  store.openStudioEditor({ focus: { task: use.role === "font" ? "interface" : "scene", entityId: use.entity_id } });
}

function Swatches({ colors, testid, onPick, used }: { colors: string[]; testid: string; onPick?: (i: number) => void; used?: number[] }) {
  return (
    <div className="flex flex-wrap gap-px" data-testid={testid}>
      {colors.slice(0, 16).map((c, i) => {
        const label = `índice ${i}: ${c || (i === 0 ? "transparente" : "sem cor")}${used && !used.includes(i) ? " (não usado)" : ""}`;
        const style = { background: c || "transparent" };
        return onPick && used?.includes(i) ? (
          <button
            key={i}
            type="button"
            data-testid={`${testid}-${i}`}
            data-color={c}
            aria-label={`Editar ${label}`}
            title={label}
            onClick={() => onPick(i)}
            className="h-3.5 w-3.5 rounded-sm border border-[#585b70] focus:outline focus:outline-1 focus:outline-[#f9e2af]"
            style={style}
          />
        ) : (
          <span key={i} data-testid={`${testid}-${i}`} data-color={c} title={label} aria-label={label} className="h-3.5 w-3.5 rounded-sm border border-[#313244]" style={style} />
        );
      })}
    </div>
  );
}

function Blocked({ added }: { added: PlanDiagnostic[] }) {
  if (added.length === 0) return null;
  return (
    <div data-testid="palette-blocked" role="alert" className="mt-1 rounded border border-[#f38ba8]/50 bg-[#f38ba8]/10 p-1 text-[9px] text-[#f38ba8]">
      Não aplicado — {added.map((d) => d.message).join(" ")}
      {added[0]?.actions.length ? <span className="block text-[#cdd6f4]">Para resolver: {added[0].actions.join(" · ")}</span> : null}
    </div>
  );
}

function UseButton({ resource, use }: { resource: PlanResource; use: PlanUse }) {
  const [detail, setDetail] = useState(false);
  const pinned = usePalettePlanStore((s) => s.pinnedUses === resource.id);
  const setPinned = usePalettePlanStore((s) => s.setPinnedUses);
  const id = `palette-use-${safeId(resource.id)}-${safeId(use.entity_id)}`;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        data-testid={id}
        aria-describedby={detail || pinned ? `${id}-detail` : undefined}
        onMouseEnter={() => setDetail(true)}
        onMouseLeave={() => setDetail(false)}
        onFocus={() => setDetail(true)}
        onBlur={() => setDetail(false)}
        onClick={() => {
          setPinned(resource.id);
          openUse(use);
        }}
        className="rounded border border-[#45475a] px-1 text-[9px] text-[#cdd6f4] hover:border-[#89b4fa]"
      >
        {use.entity_id} · {roleLabel(use)}
      </button>
      {detail || pinned ? (
        <span id={`${id}-detail`} data-testid={`${id}-detail`} role="tooltip" className="ml-1 text-[9px] text-[#a6adc8]">
          {use.asset ?? "fonte do texto"} · índices {use.indices.length ? `${Math.min(...use.indices)}–${Math.max(...use.indices)}` : "—"}
        </span>
      ) : null}
    </span>
  );
}

function ColorEditor({ plan, resource, index, onDone }: { plan: PalettePlan; resource: PlanResource; index: number; onDone: () => void }) {
  const [value, setValue] = useState(resource.colors[index] || "#000000");
  const [added, setAdded] = useState<PlanDiagnostic[]>([]);
  const affected = affectedBy(plan, resource, index);
  return (
    <div data-testid="palette-color-editor" className="mt-1 rounded border border-[#f9e2af]/40 p-1 text-[9px] text-[#cdd6f4]">
      <p>
        Índice {index}: {resource.colors[index]} → <span data-testid="palette-color-after">{value.toUpperCase()}</span>
      </p>
      <p data-testid="palette-impact" data-affected={affected.join(",")}>
        Muda junto: {affected.join(", ")} ({affected.length} uso{affected.length === 1 ? "" : "s"})
      </p>
      <input
        data-testid="palette-color-input"
        aria-label={`Nova cor do índice ${index}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 w-24 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono"
      />
      <button
        type="button"
        data-testid="palette-color-apply"
        disabled={!/^#[0-9a-fA-F]{6}$/.test(value)}
        onClick={async () => {
          const r = await applyPalettes(editSharedColor(currentPalettes(), resource, index, value));
          setAdded(r.added);
          if (r.applied) onDone();
        }}
        className="ml-1 rounded border border-[#a6e3a1]/50 px-1 text-[#a6e3a1] disabled:opacity-40"
      >
        Aplicar a todos os usos
      </button>
      <button type="button" data-testid="palette-color-cancel" onClick={onDone} className="ml-1 rounded border border-[#45475a] px-1">
        Cancelar
      </button>
      <Blocked added={added} />
    </div>
  );
}

function ResourceRow({ plan, resource }: { plan: PalettePlan; resource: PlanResource }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [added, setAdded] = useState<PlanDiagnostic[]>([]);
  const sid = safeId(resource.id);
  const materialized = currentPalettes().some((p) => p.id === resource.id);
  return (
    <li
      data-testid={`palette-resource-${sid}`}
      data-bank={resource.bank ?? ""}
      data-state={resource.state}
      data-references={resource.references}
      data-simultaneous={resource.simultaneous_uses}
      className="rounded border border-[#313244] p-1"
    >
      <div className="flex items-center gap-1 text-[10px] text-[#cdd6f4]">
        <span className="font-semibold">{resource.name}</span>
        <span className="text-[9px] text-[#7f849c]">
          {resource.bank !== undefined ? `banco ${resource.bank}` : RESOURCE_STATE_LABEL[resource.state]} · {resource.references} referência(s), {resource.simultaneous_uses} simultânea(s)
        </span>
      </div>
      <p className="text-[9px] text-[#585b70]" title={resource.evidence}>
        id {resource.id} · {resource.origin}
      </p>
      <Swatches colors={resource.colors} used={resource.used_indices} testid={`palette-color-${sid}`} onPick={(i) => setEditing(i)} />
      {editing !== null ? <ColorEditor plan={plan} resource={resource} index={editing} onDone={() => setEditing(null)} /> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {resource.uses.map((use) => (
          <UseButton key={use.entity_id} resource={resource} use={use} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-[#a6adc8]">
        <label>
          Banco
          <select
            data-testid={`palette-pin-${sid}`}
            value={resource.pinned_bank ?? ""}
            onChange={async (e) => {
              const bank = e.target.value === "" ? null : Number(e.target.value);
              const r = await applyPalettes(pinBank(currentPalettes(), resource, bank));
              setAdded(r.added);
            }}
            className="ml-1 rounded border border-[#45475a] bg-[#11111b]"
          >
            <option value="">automático</option>
            {plan.banks.map((b) => (
              <option key={b.bank} value={b.bank}>
                {b.bank} — {BANK_STATE_LABEL[b.state]}
                {b.resources.length && !b.resources.includes(resource.id) ? ` (compartilhar com ${b.resources.join(", ")})` : ""}
              </option>
            ))}
          </select>
        </label>
        {materialized && resource.id.startsWith("asset:") ? (
          <button
            type="button"
            data-testid={`palette-restore-${sid}`}
            onClick={async () => setAdded((await applyPalettes(restoreFromFile(currentPalettes(), resource.id))).added)}
            className="rounded border border-[#45475a] px-1"
          >
            Voltar às cores do arquivo
          </button>
        ) : null}
      </div>
      <Blocked added={added} />
    </li>
  );
}

/** Resumo compacto “Paletas — ocupação e conflitos”, que expande para o painel completo. */
export function PaletteSummary() {
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const error = usePalettePlanStore((s) => s.error);
  if (error) {
    return (
      <p data-testid="palette-summary-unavailable" className="px-3 py-1 text-[9px] text-[#7f849c]">
        Paletas: {error}
      </p>
    );
  }
  if (!plan) return null;
  const used = plan.banks.filter((b) => b.resources.length > 0).length;
  const errors = errorCount(plan);
  return (
    <div className="border-b border-[#313244] px-3 py-1">
      <button
        type="button"
        data-testid="palette-summary"
        data-used={used}
        data-errors={errors}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded border px-2 py-0.5 text-left text-[10px] ${errors ? "border-[#f38ba8]/60 text-[#f38ba8]" : "border-[#45475a] text-[#cdd6f4]"}`}
      >
        Paletas — {used}/{plan.capacity.banks} bancos ocupados · {errors} conflito(s)
      </button>
      {open ? <PalettePanelBody plan={plan} /> : null}
    </div>
  );
}

function PalettePanelBody({ plan }: { plan: PalettePlan }) {
  const ordered = useMemo(
    () => [...plan.resources].sort((a, b) => (a.bank ?? 99) - (b.bank ?? 99) || a.name.localeCompare(b.name)),
    [plan.resources]
  );
  return (
    <div data-testid="palette-panel" className="mt-1 space-y-1">
      <p className="text-[9px] text-[#7f849c]">{plan.evidence.execucao}. Ocultar no editor não libera banco da ROM.</p>
      <ul className="space-y-0.5">
        {plan.banks.map((b) => (
          <li key={b.bank} data-testid={`palette-bank-${b.bank}`} data-state={b.state} className="flex items-center gap-1 text-[9px] text-[#cdd6f4]">
            <span className="w-14">Banco {b.bank}</span>
            <span className="w-24 text-[#a6adc8]">{BANK_STATE_LABEL[b.state]}</span>
            <Swatches colors={b.colors} testid={`palette-bank-colors-${b.bank}`} />
            <span className="truncate text-[#7f849c]">{b.resources.map((r) => plan.resources.find((x) => x.id === r)?.name ?? r).join(" + ") || "—"}</span>
          </li>
        ))}
      </ul>
      {plan.diagnostics.length ? (
        <ul data-testid="palette-diagnostics" className="space-y-0.5">
          {plan.diagnostics.map((d, i) => (
            <li key={i} data-testid={`palette-diag-${i}`} data-code={d.code} data-severity={d.severity} className={`text-[9px] ${d.severity === "error" ? "text-[#f38ba8]" : "text-[#f9e2af]"}`}>
              {d.message}
              {d.uses.length ? (
                <span className="ml-1">
                  {d.uses.map((u) => (
                    <button
                      key={u}
                      type="button"
                      data-testid={`palette-diag-${i}-use-${safeId(u)}`}
                      onClick={() => {
                        const r = plan.resources.flatMap((x) => x.uses).find((x) => x.entity_id === u);
                        if (r) openUse(r);
                      }}
                      className="ml-1 underline"
                    >
                      {u}
                    </button>
                  ))}
                </span>
              ) : null}
              {d.actions.length ? <span className="block text-[#a6adc8]">Ações: {d.actions.join(" · ")}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="space-y-1">
        {ordered.map((r) => (
          <ResourceRow key={r.id} plan={plan} resource={r} />
        ))}
      </ul>
    </div>
  );
}

/** Seção do Inspector: paleta do objeto selecionado, alcance, opções e ações locais. */
export function EntityPaletteSection({ entityId }: { entityId: string }) {
  const plan = usePlan();
  const [added, setAdded] = useState<PlanDiagnostic[]>([]);
  const [newName, setNewName] = useState("Dano");
  const [newColor, setNewColor] = useState("#DA2424");
  if (!plan) return null;
  const resource = resourceOf(plan, entityId);
  if (!resource) return null;
  const others = resource.uses.filter((u) => u.entity_id !== entityId);
  const explicitOptions = plan.resources.filter((r) => r.id !== resource.id && currentPalettes().some((p) => p.id === r.id));
  const ownFile = resource.uses.find((u) => u.entity_id === entityId)?.asset;
  const isAssigned = currentPalettes().some((p) => p.uses?.includes(entityId));
  return (
    <section data-testid="inspector-palette" data-resource={resource.id} data-bank={resource.bank ?? ""} className="border-b border-[#313244] px-3 py-2 text-[10px] text-[#cdd6f4]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89b4fa]">Paleta</p>
      <p>
        <span data-testid="inspector-palette-name">{resource.name}</span>
        <span className="text-[#7f849c]"> · {resource.bank !== undefined ? `banco ${resource.bank}` : RESOURCE_STATE_LABEL[resource.state]}</span>
      </p>
      <p data-testid="inspector-palette-scope" data-others={others.length} className="text-[9px] text-[#a6adc8]">
        {others.length
          ? `Compartilhada com ${others.map((u) => u.entity_id).join(", ")}: editar as cores muda os ${others.length + 1} usos.`
          : "Só este objeto usa esta paleta."}
      </p>
      <Swatches colors={resource.colors} used={resource.used_indices} testid="inspector-palette-colors" />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <label className="text-[9px] text-[#a6adc8]">
          Usar
          <select
            data-testid="inspector-palette-assign"
            value={isAssigned ? resource.id : ""}
            onChange={async (e) => {
              const next = e.target.value === "" ? releaseUse(currentPalettes(), entityId) : assignResource(currentPalettes(), plan, entityId, e.target.value);
              setAdded((await applyPalettes(next)).added);
            }}
            className="ml-1 rounded border border-[#45475a] bg-[#11111b]"
          >
            <option value="">{ownFile ? `cores do arquivo (${ownFile.split("/").pop()})` : "padrão"}</option>
            {explicitOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {isAssigned ? <option value={resource.id}>{resource.name}</option> : null}
          </select>
        </label>
        {others.length ? (
          <button
            type="button"
            data-testid="inspector-palette-variant"
            onClick={async () => setAdded((await applyPalettes(createLocalVariant(currentPalettes(), resource, entityId))).added)}
            className="rounded border border-[#cba6f7]/50 px-1 text-[9px] text-[#cba6f7]"
            title="Copia as cores para uma paleta só deste objeto; precisa de um banco livre"
          >
            Criar variante local
          </button>
        ) : null}
        {isAssigned ? (
          <button
            type="button"
            data-testid="inspector-palette-release"
            onClick={async () => setAdded((await applyPalettes(releaseUse(currentPalettes(), entityId))).added)}
            className="rounded border border-[#45475a] px-1 text-[9px]"
          >
            Liberar (voltar às cores do arquivo)
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-[#a6adc8]">
        Nova paleta para trocas
        <input data-testid="inspector-palette-new-name" aria-label="Nome da nova paleta" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-16 rounded border border-[#45475a] bg-[#11111b] px-1" />
        <input data-testid="inspector-palette-new-color" aria-label="Cor da nova paleta" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-16 rounded border border-[#45475a] bg-[#11111b] px-1 font-mono" />
        <button
          type="button"
          data-testid="inspector-palette-new-create"
          disabled={!newName.trim() || !/^#[0-9a-fA-F]{6}$/.test(newColor)}
          onClick={async () => setAdded((await applyPalettes(createAuthoredPalette(currentPalettes(), resource, newName.trim(), newColor).palettes)).added)}
          className="rounded border border-[#45475a] px-1 disabled:opacity-40"
          title="Paleta da biblioteca: não ocupa banco até uma troca usá-la"
        >
          Criar
        </button>
      </div>
      <Blocked added={added} />
    </section>
  );
}
