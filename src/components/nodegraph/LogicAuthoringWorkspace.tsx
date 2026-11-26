import { lazy, Suspense, useRef } from "react";
import { Group, Panel, type PanelImperativeHandle } from "react-resizable-panels";
import { useCodeFocusStore } from "../../core/codeFocusStore";
import PoseDurationField from "../artstudio/PoseDurationField";
import LayoutSplitter from "../common/LayoutSplitter";
import { InstanceCodeView, LogicViewTabs } from "./InstanceCodeView";

const NodeGraphEditor = lazy(() => import("./NodeGraphEditor"));

export default function LogicAuthoringWorkspace({ showNativePoses }: { showNativePoses: boolean }) {
  const view = useCodeFocusStore((state) => state.logicView);
  const codePanel = useRef<PanelImperativeHandle | null>(null);
  const lastCodeWidth = useRef(42);
  return (
    <div className="flex h-full w-full flex-col">
      <LogicViewTabs />
      <div id={`logic-view-panel-${view}`} role="tabpanel" aria-labelledby={`logic-view-tab-${view}`} className="min-h-0 flex-1">
        <Group orientation="horizontal" id="logic-authoring-panes" className="h-full" onLayoutChanged={(sizes) => {
          if (view === "split" && sizes["logic-code"] && sizes["logic-nodes"]) lastCodeWidth.current = sizes["logic-code"];
        }}>
          {view !== "code" ? (
            <Panel key="nodes" id="logic-nodes" defaultSize={view === "split" ? `${100 - lastCodeWidth.current}%` : "100%"}
              minSize={view === "split" ? "36%" : 0} className="overflow-hidden">
              <div className="flex h-full min-h-0 flex-col">
                {showNativePoses ? <div className="shrink-0 border-b border-[#313244] px-2 py-1"><PoseDurationField testId="nodes-pose-duration" /></div> : null}
                <div className="relative min-h-0 flex-1">
                  <Suspense fallback={<p className="p-3 text-sm">Carregando Nós…</p>}>
                    <NodeGraphEditor />
                  </Suspense>
                </div>
              </div>
            </Panel>
          ) : null}
          {view === "split" ? (
            <LayoutSplitter key="divider" id="logic-view-divider" ariaLabel="Redimensionar Nós e Código" onResizeIntent={(intent) => {
              const panel = codePanel.current;
              if (!panel) return;
              if (intent.type === "step") panel.resize(panel.getSize().inPixels - intent.delta);
              else if (intent.type === "minimum") panel.resize("28%");
              else if (intent.type === "maximum") panel.resize("64%");
              else panel.resize("42%");
            }} />
          ) : null}
          {view !== "nodes" ? (
            <Panel key="code" id="logic-code" panelRef={codePanel} defaultSize={view === "split" ? `${lastCodeWidth.current}%` : "100%"}
              minSize={view === "split" ? "28%" : 0} className="overflow-hidden">
              <InstanceCodeView />
            </Panel>
          ) : null}
        </Group>
      </div>
    </div>
  );
}
