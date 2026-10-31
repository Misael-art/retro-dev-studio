// "Próximos passos": 2–3 pontos de atenção da cena em linguagem simples, cada um com uma ação
// que leva ao lugar certo (destacar objetos, redistribuir, abrir paletas, testar).
import { useMemo, useState } from "react";

import { usePalettePlanStore } from "../../core/palettePlanStore";
import {
  ATTENTION_ACTION_LABEL,
  buildAttentionItems,
  suggestScanlineRedistribution,
  type AttentionActionId,
  type AttentionItem,
  type RedistributionMove,
} from "../../core/sceneAttention";
import { requestAppCommand, useSceneAttentionStore } from "../../core/sceneAttentionStore";
import { getEntityDisplayName } from "../../core/entityDisplay";
import { useEditorStore } from "../../core/store/editorStore";

const SEVERITY_STYLE: Record<AttentionItem["severity"], { dot: string; label: string }> = {
  blocker: { dot: "bg-[#f38ba8]", label: "Resolver" },
  warning: { dot: "bg-[#fab387]", label: "Revisar" },
  tip: { dot: "bg-[#a6e3a1]", label: "Próximo" },
};

export function useSceneAttentionItems(assets?: { missing: number; failed: number }): AttentionItem[] {
  const scene = useEditorStore((s) => s.activeScene);
  const target = useEditorStore((s) => s.activeTarget);
  const hwStatus = useEditorStore((s) => s.hwStatus);
  const palettePlan = usePalettePlanStore((s) => s.plan);
  const missing = assets?.missing ?? 0;
  const failed = assets?.failed ?? 0;
  return useMemo(
    () =>
      buildAttentionItems({
        scene,
        target: target === "snes" ? "snes" : "megadrive",
        hwStatus,
        palettePlan,
        assets: { missing, failed },
      }),
    [scene, target, hwStatus, palettePlan, missing, failed]
  );
}

/** Executa uma ação de ponto de atenção. Devolve movimentos sugeridos quando a ação é redistribuir. */
export function useAttentionActions() {
  const setFocus = useSceneAttentionStore((s) => s.setFocus);
  const focus = useSceneAttentionStore((s) => s.focus);
  const requestPalettes = useSceneAttentionStore((s) => s.requestPalettes);
  const setSelectedEntityId = useEditorStore((s) => s.setSelectedEntityId);
  const [proposal, setProposal] = useState<{ itemId: string; moves: RedistributionMove[]; projectSessionId: number; scenePath: string; revision: number } | null>(null);

  function run(item: AttentionItem, action: AttentionActionId) {
    switch (action) {
      case "show_only":
        setFocus(focus?.itemId === item.id ? null : { itemId: item.id, entityIds: item.entityIds });
        return;
      case "select_first":
        if (item.entityIds[0]) setSelectedEntityId(item.entityIds[0]);
        return;
      case "redistribute": {
        const s = useEditorStore.getState();
        if (!s.activeScene) return;
        const limit = s.hwStatus?.scanline_sprite_limit ?? (s.activeTarget === "snes" ? 32 : 20);
        const moves = suggestScanlineRedistribution(s.activeScene, s.activeTarget === "snes" ? "snes" : "megadrive", limit);
        setProposal({ itemId: item.id, moves, projectSessionId: s.projectSessionId, scenePath: s.activeScenePath, revision: s.sceneRevision });
        setFocus({ itemId: item.id, entityIds: item.entityIds });
        return;
      }
      case "open_palettes":
        if (item.entityIds[0]) setSelectedEntityId(item.entityIds[0]);
        requestPalettes();
        return;
      case "open_assets":
        requestAppCommand("tools.assetBrowser");
        return;
      case "test_scene":
        requestAppCommand("build.run");
        return;
    }
  }

  function applyProposal() {
    if (!proposal) return;
    const s = useEditorStore.getState();
    if (s.projectSessionId !== proposal.projectSessionId || s.activeScenePath !== proposal.scenePath || s.sceneRevision !== proposal.revision) {
      s.logMessage("warn", "A cena mudou. Gere uma nova sugestão de posições; nenhuma alteração foi aplicada.");
      setProposal(null);
      setFocus(null);
      return;
    }
    s.beginHistoryCapture();
    for (const move of proposal.moves) {
      const entity = s.activeScene?.entities.find((e) => e.entity_id === move.entityId);
      if (entity) s.updateEntity(move.entityId, { transform: { ...entity.transform, y: move.toY } }, { recordHistory: false });
    }
    s.commitHistoryCapture();
    s.logMessage("info", `[Atenção] ${proposal.moves.length} sprite(s) redistribuído(s). Ctrl+Z desfaz.`);
    setProposal(null);
    setFocus(null);
  }

  return { run, focus, proposal, applyProposal, cancelProposal: () => setProposal(null) };
}

function AttentionRow({
  item,
  actions,
  compact,
}: {
  item: AttentionItem;
  actions: ReturnType<typeof useAttentionActions>;
  compact?: boolean;
}) {
  const [showTech, setShowTech] = useState(false);
  const entities = useEditorStore((s) => s.activeScene?.entities);
  const style = SEVERITY_STYLE[item.severity];
  const proposal = actions.proposal?.itemId === item.id ? actions.proposal : null;
  const nameOf = (id: string) => {
    const entity = entities?.find((e) => e.entity_id === id);
    return entity ? getEntityDisplayName(entity) : id;
  };
  return (
    <li data-testid={`attention-item-${item.id}`} data-severity={item.severity} className={`rounded border border-[#313244] bg-[#181825] ${compact ? "px-2 py-1.5" : "p-2"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#cdd6f4]">{item.title}</p>
          {!compact ? <p className="mt-0.5 text-[10px] leading-relaxed text-[#a6adc8]">{item.why}</p> : null}
        </div>
        <span className="shrink-0 text-[9px] uppercase text-[#7f849c]">{style.label}</span>
      </div>
      {item.actions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
          {(compact && !proposal && actions.focus?.itemId !== item.id ? item.actions.slice(0, 2) : item.actions).map((action) => {
            const active = action === "show_only" && actions.focus?.itemId === item.id;
            return (
              <button
                key={action}
                type="button"
                data-testid={`attention-action-${item.id}-${action}`}
                aria-pressed={action === "show_only" ? active : undefined}
                onClick={() => actions.run(item, action)}
                className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                  active
                    ? "border-[#89b4fa] bg-[#89b4fa]/15 text-[#89b4fa]"
                    : "border-[#45475a] text-[#cdd6f4] hover:border-[#89b4fa] hover:text-[#89b4fa]"
                }`}
              >
                {active ? "Mostrar tudo" : ATTENTION_ACTION_LABEL[action]}
              </button>
            );
          })}
        </div>
      ) : null}
      {proposal ? (
        <div data-testid={`attention-proposal-${item.id}`} className="mt-1.5 rounded border border-[#89b4fa]/40 bg-[#11111b] p-1.5 pl-4 text-[10px]">
          {proposal.moves.length === 0 ? (
            <p className="text-[#fab387]">Sem redistribuição simples. Tente isolar esses sprites ou reduzir o tamanho deles.</p>
          ) : (
            <>
              <p className="text-[#cdd6f4]">Mover {proposal.moves.length} sprite(s) na vertical:</p>
              <ul className="mt-0.5 text-[#a6adc8]">
                {proposal.moves.map((m) => (
                  <li key={m.entityId}>
                    {nameOf(m.entityId)}: y {m.fromY} → {m.toY}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-1">
                <button type="button" data-testid={`attention-apply-${item.id}`} onClick={actions.applyProposal} className="rounded bg-[#89b4fa] px-1.5 py-0.5 font-semibold text-[#11111b]">
                  Aplicar (desfazível)
                </button>
                <button type="button" onClick={actions.cancelProposal} className="rounded border border-[#45475a] px-1.5 py-0.5 text-[#cdd6f4]">
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
      {!compact ? <button
        type="button"
        onClick={() => setShowTech((v) => !v)}
        aria-expanded={showTech}
        className="mt-1 pl-4 text-[9px] text-[#7f849c] hover:text-[#a6adc8]"
      >
        {showTech ? "▾" : "▸"} Detalhes técnicos
      </button> : null}
      {showTech ? <p className="pl-4 font-mono text-[9px] leading-relaxed text-[#7f849c]">{item.technical}</p> : null}
    </li>
  );
}

/** Lista de itens reutilizável (viewport e Inspector). */
export function AttentionList({ items, compact }: { items: AttentionItem[]; compact?: boolean }) {
  const actions = useAttentionActions();
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <AttentionRow key={item.id} item={item} actions={actions} compact={compact || index > 0} />
      ))}
    </ul>
  );
}

export default function SceneAttentionPanel({ assets }: { assets?: { missing: number; failed: number } }) {
  const items = useSceneAttentionItems(assets);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1440);
  if (items.length === 0) return null;
  const problemItems = items.filter((i) => i.kind !== "ready");
  const problems = problemItems.length;
  // Até 3 itens: os mais importantes e, sempre por último, "testar a cena".
  const visible = [...problemItems.slice(0, 2), ...items.filter((i) => i.kind === "ready")];
  const hidden = problems - Math.min(problems, 2);
  return (
    <section
      data-testid="scene-attention-panel"
      data-problems={problems}
      className="shrink-0 max-h-44 overflow-y-auto border-b border-[#313244] bg-[#11111b]/95 px-3 py-2"
    >
      <button type="button" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed} className="flex w-full items-center justify-between text-left">
        <span className="text-[11px] font-semibold text-[#cdd6f4]">
          Próximos passos{items.some((item) => item.severity === "blocker") ? " · resolver bloqueio" : problems > 0 ? ` · ${problems} ponto(s) de atenção` : " · testar a cena"}
        </span>
        <span className="text-[10px] text-[#7f849c]">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed ? (
        <div className="mt-1.5">
          <AttentionList items={visible} />
          {hidden > 0 ? <p className="mt-1 text-[9px] text-[#7f849c]">+{hidden} item(ns) depois destes.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
