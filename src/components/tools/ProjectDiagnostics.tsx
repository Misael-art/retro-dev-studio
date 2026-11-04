import { useEffect, useState, type ReactNode } from "react";
import { currentProjectDiagnostics } from "../../core/projectDiagnostics";
import { sampleRuntimeEntities } from "../../core/runtimeSample";
import type { RuntimeEntitySample } from "../../core/runtimeLink";
import { useEditorStore } from "../../core/store/editorStore";
import { openProjectSourcePath } from "../../core/ipc/projectService";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 break-words rounded border border-[#45475a] bg-[#181825] p-3" aria-label={title}>
    <h3 className="font-semibold text-[#cdd6f4]">{title}</h3>
    <div className="mt-2 space-y-2 text-[#bac2de]">{children}</div>
  </section>;
}

const actionClass = "rounded border border-[#89b4fa] px-2 py-1 text-[#89b4fa] hover:bg-[#89b4fa]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#89b4fa]";
const canOpenProjectSource = (path: string) => !/^(?:\/|[A-Za-z]:[\\/])/.test(path) && !path.split(/[\\/]/).includes("..");

export default function ProjectDiagnostics({ onRequestInspector }: { onRequestInspector?: () => void }) {
  const state = useEditorStore();
  const { buildFailure, scene, hardware, artifact, link, observation } = currentProjectDiagnostics(state);
  const [sample, setSample] = useState<{
    sessionId: number; revision: number; romSha: string; coreEpoch: number;
    sampledAt: number; values: RuntimeEntitySample[];
  } | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  useEffect(() => {
    setSample(null);
    setSampleError(null);
  }, [state.projectSessionId, state.sceneRevision, state.emulatorRomIdentity?.sha256, state.coreEpoch, state.emulPaused]);
  const validSample = sample && link && state.emulPaused
    && sample.sessionId === state.projectSessionId && sample.revision === state.sceneRevision
    && sample.romSha === state.emulatorRomIdentity?.sha256 && sample.coreEpoch === state.coreEpoch
    ? sample : null;
  const map = scene?.collision_map;
  const solids = map?.data.flatMap((value, index) => value === 1 ? [index] : []) ?? [];
  const source = scene ? state.activeScenePath : "cena indisponível";

  async function readPausedVariables() {
    if (!link || !state.emulPaused || state.coreEpoch === null || !artifact) return;
    const at = { sessionId: state.projectSessionId, revision: state.sceneRevision,
      romSha: artifact.sha256, coreEpoch: state.coreEpoch };
    setSample(null);
    setSampleError(null);
    try {
      const values = await sampleRuntimeEntities(link);
      const current = useEditorStore.getState();
      const scoped = currentProjectDiagnostics(current);
      if (!scoped.link || scoped.link !== link || !current.emulPaused
        || current.projectSessionId !== at.sessionId || current.sceneRevision !== at.revision
        || current.emulatorRomIdentity?.sha256 !== at.romSha || current.coreEpoch !== at.coreEpoch) {
        setSampleError("Projeto, revisão, ROM, core ou quadro mudaram. Pause e leia novamente.");
        return;
      }
      setSample({ ...at, sampledAt: Date.now(), values });
    } catch (error) {
      const current = useEditorStore.getState();
      if (current.projectSessionId === at.sessionId && current.sceneRevision === at.revision
        && current.emulatorRomIdentity?.sha256 === at.romSha && current.coreEpoch === at.coreEpoch
        && current.emulPaused) {
        setSampleError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (!state.activeProjectDir) {
    return <div className="p-4 text-sm text-[#bac2de]">Abra um projeto para ver o diagnóstico contextual.</div>;
  }

  const metric = observation ? observation.frames * 1000 / observation.durationMs : null;
  return <div data-testid="project-diagnostics" className="grid gap-3 p-3 text-xs md:grid-cols-2">
    <div className="min-w-0 break-words text-[#94a3b8] md:col-span-2">
      Projeto {state.activeProjectName} · {state.activeTarget} · revisão {state.sceneRevision} · ROM <span className="break-all">{artifact?.sha256 ?? "indisponível"}</span>
    </div>

    <Card title="Por que não compila?">
      {buildFailure ? <>
        <p>Falha no build iniciado em {new Date(buildFailure.recordedAt).toLocaleString()} · {buildFailure.target} · revisão {buildFailure.sceneRevision}.</p>
        <ul className="list-inside list-disc space-y-1 text-[#f38ba8]">{buildFailure.messages.slice(0, 5).map((message, index) => <li key={index}>{message}</li>)}</ul>
        {buildFailure.diagnostics.map((diagnostic, index) => <div key={index} className="rounded bg-[#11111b] p-2">
          <p>{diagnostic.user_message}</p><p>Ação: {diagnostic.suggested_action}</p>
          {diagnostic.source_path && <p className="break-all">Origem: {diagnostic.source_path}{diagnostic.line ? `:${diagnostic.line}` : ""}</p>}
          {diagnostic.source_path && canOpenProjectSource(diagnostic.source_path) && <button type="button" className={actionClass} onClick={() => {
            void openProjectSourcePath(state.activeProjectDir, diagnostic.source_path!).then((result) => {
              if (!result.ok) state.logMessage("warn", result.message);
            }).catch((error: unknown) => state.logMessage("error", String(error)));
          }}>Abrir arquivo do projeto</button>}
        </div>)}
      </> : <p>Nenhuma falha de build registrada para esta sessão e revisão. Execute Build & Run para diagnosticar a compilação atual.</p>}
      <p className="text-[#94a3b8]">Origem: resultado do build do projeto atual. Unidade: mensagens de erro. Ação: corrigir a origem indicada e reconstruir.</p>
    </Card>

    <Card title="Onde há colisão?">
      {map ? <>
        <p>{solids.length} célula(s) sólida(s) em grade {map.width}×{map.height}; tile {map.tile_width}×{map.tile_height} px.</p>
        <p>{solids.length ? `Células (coluna, linha): ${solids.slice(0, 16).map((index) => `(${index % map.width}, ${Math.floor(index / map.width)})`).join(", ")}${solids.length > 16 ? ` e mais ${solids.length - 16}` : ""}.` : "Nenhuma célula sólida na cena."}</p>
      </> : <p>Mapa de colisão indisponível na cena ativa.</p>}
      <p className="text-[#94a3b8]">Origem: {source}, revisão {state.sceneRevision}, estado atual do editor. Unidade: células de grade. Ação: revisar no canvas.</p>
      <button type="button" className={actionClass} onClick={() => {
        state.setActiveWorkspace("scene"); state.setActiveViewportTab("scene"); state.setEditorMode("collision"); onRequestInspector?.();
      }}>Abrir colisão no canvas</button>
    </Card>

    <Card title="Quais estados e variáveis foram observados?">
      {!link ? <p>Observação indisponível. Compile, execute a ROM desta revisão no core e pause o jogo.</p>
        : !state.emulPaused ? <p>Pause a ROM atual para ler a RAM sem misturar quadros.</p>
          : <button type="button" className={actionClass} onClick={() => void readPausedVariables()}>Ler posição, animação e quadro na RAM</button>}
      {sampleError && <p role="alert" className="text-[#f38ba8]">{sampleError}</p>}
      {validSample && <>
        <p>Leitura em {new Date(validSample.sampledAt).toLocaleString()} · core época {validSample.coreEpoch} · ROM <span className="break-all">{validSample.romSha}</span>.</p>
        {validSample.values.length ? <ul className="space-y-1">{validSample.values.map((value) => <li key={value.entity_id}>
          <button type="button" className={actionClass} onClick={() => { state.setSelectedEntityId(value.entity_id); state.setActiveWorkspace("scene"); state.setActiveViewportTab("scene"); onRequestInspector?.(); }}>{value.entity_id}</button>
          {` x=${value.x} px, y=${value.y} px, animação=${value.anim ?? "indisponível"}, quadro=${value.frame ?? "indisponível"}`}
        </li>)}</ul> : <p>Este build não vinculou variáveis de entidades à RAM.</p>}
      </>}
      <p className="text-[#94a3b8]">Origem: vínculo do build e System RAM do Libretro pausado. Janela: leitura pontual. Unidade: pixels ou índice. Ação: selecionar entidade e corrigir na cena.</p>
    </Card>

    <Card title="Que recurso excedeu o limite?">
      {hardware ? <>
        {[
          ["VRAM", hardware.vram_used, hardware.vram_limit, "bytes"],
          ["Sprites", hardware.sprite_count, hardware.sprite_limit, "sprites"],
          ["Sprites/scanline", hardware.scanline_sprite_peak, hardware.scanline_sprite_limit, "sprites"],
          ["DMA", hardware.dma_used, hardware.dma_limit, "bytes/quadro estimados"],
          ["Paletas", hardware.palette_banks_used, hardware.palette_banks_limit, "bancos"],
          ["Camadas BG", hardware.bg_layers, hardware.bg_layers_limit, "camadas"],
        ].map(([name, used, limit, unit]) => <p key={String(name)} className={Number(used) > Number(limit) ? "text-[#f38ba8]" : ""}>{name}: {used}/{limit} {unit}{Number(used) > Number(limit) ? " · excedido" : ""}</p>)}
        {hardware.errors.map((error, index) => <p key={index} className="text-[#f38ba8]">{error}</p>)}
        {!hardware.errors.length && <p>Nenhum limite fatal reportado nesta validação.</p>}
      </> : <p>Validação de hardware indisponível para esta revisão. Abra os limites de hardware e revalide.</p>}
      <p className="text-[#94a3b8]">Origem: análise {hardware?.analysis_mode ?? "indisponível"} do projeto; revisão {state.sceneRevision}. Janela: validação da cena, não medição do core. Ação: reduzir o recurso excedido e revalidar.</p>
      <button type="button" className={actionClass} onClick={() => { state.setActiveWorkspace("scene"); onRequestInspector?.(); }}>Abrir Inspector / limites</button>
    </Card>

    <Card title="Qual medida de desempenho existe?">
      {metric === null ? <p>FPS de apresentação indisponível para a ROM e o core atuais. Execute o jogo por pelo menos um segundo.</p>
        : <p>{metric.toFixed(1)} quadros apresentados/s · {observation!.frames} quadros em {(observation!.durationMs / 1000).toFixed(2)} s · medido em {new Date(observation!.measuredAt).toLocaleTimeString()}.</p>}
      <p className="text-[#94a3b8]">Origem: quadros entregues pelo Libretro à interface; ROM <span className="break-all">{observation?.romSha256 ?? "indisponível"}</span>, core época {observation?.coreEpoch ?? "indisponível"}. Janela: {observation ? `${Math.round(observation.durationMs)} ms` : "indisponível"}. Unidade: quadros apresentados/s; não mede clock ou FPS da simulação. Ação: comparar janelas durante o jogo e investigar quedas no Profiler.</p>
    </Card>
  </div>;
}
