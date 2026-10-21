import { useCallback, useEffect, useMemo, useState } from "react";

import { getEntityDisplayName } from "../../core/entityDisplay";
import { emulatorReadMemory } from "../../core/ipc/emulatorService";
import {
  audioEventRow,
  checkRuntimeNavigation,
  collisionBoxes,
  type AudioEventRow,
  type ScreenBox,
  clientToNative,
  hitTest,
  runtimeCandidates,
  type InspectLayer,
  type PausedFrameIdentity,
  type RuntimeCandidate,
  type RuntimeEntitySample,
  type RuntimeLink,
} from "../../core/runtimeLink";
import { useEditorStore } from "../../core/store/editorStore";
import { readProjectAssetBytes, rexProfileLocate } from "../../core/ipc/toolsService";
import { sha256Bytes } from "../../core/runtimeLink";
import { rexBridgeItems, type RexBridgeItem } from "../../core/rexBridge";

let rexBridgeSeq = 0;

const LAYER_LABEL: Record<InspectLayer, string> = {
  scene: "Cenário",
  characters: "Personagens",
  interface: "Interface",
  collisions: "Colisões",
  audio: "Áudio",
};

/** Lê uma palavra de 16 bits da System RAM (sonda de observação; não altera o jogo). */
async function readWord(address: number, signed: boolean): Promise<number> {
  const result = await emulatorReadMemory(2, address & 0xffff, 2);
  if (!result.ok || !result.data || result.data.length < 2) {
    throw new Error(`Leitura de RAM falhou em ${address.toString(16)}`);
  }
  const word = result.data[0] | (result.data[1] << 8);
  return signed && word > 0x7fff ? word - 0x10000 : word;
}

async function sampleEntities(link: RuntimeLink): Promise<RuntimeEntitySample[]> {
  const out: RuntimeEntitySample[] = [];
  for (const entity of link.entities) {
    out.push({
      entity_id: entity.entity_id,
      x: await readWord(entity.symbols.x, true),
      y: await readWord(entity.symbols.y, true),
      anim: entity.symbols.anim !== null ? await readWord(entity.symbols.anim, false) : null,
      frame: entity.symbols.frame !== null ? await readWord(entity.symbols.frame, false) : null,
    });
  }
  return out;
}

/**
 * Modo Inspecionar (Experimental): no teste pausado, destaca o que o build vinculou (cenário azul,
 * personagens laranja) e abre o editor certo ao clicar. Só navega com a ROM, a época e o quadro da
 * amostra; nada é inferido do quadro composto.
 */
export default function RuntimeInspectOverlay({
  canvas,
  renderedFrames,
  paused,
}: {
  canvas: HTMLCanvasElement | null;
  renderedFrames: number;
  paused: boolean;
}) {
  const link = useEditorStore((state) => state.lastRuntimeLink);
  const romSha256 = useEditorStore((state) => state.emulatorRomIdentity?.sha256 ?? null);
  const coreEpoch = useEditorStore((state) => state.coreEpoch);
  const activeScene = useEditorStore((state) => state.activeScene);
  const openStudioEditor = useEditorStore((state) => state.openStudioEditor);
  const logMessage = useEditorStore((state) => state.logMessage);

  const [active, setActive] = useState(false);
  const [layers, setLayers] = useState<Record<InspectLayer, boolean>>({
    scene: true,
    characters: true,
    interface: true,
    collisions: false,
    audio: false,
  });
  const [sample, setSample] = useState<{
    at: PausedFrameIdentity;
    candidates: RuntimeCandidate[];
    boxes: ScreenBox[];
    audio: AudioEventRow[];
  } | null>(null);
  const [choices, setChoices] = useState<RuntimeCandidate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rexItems, setRexItems] = useState<RexBridgeItem[] | null>(null);
  const [rexBusy, setRexBusy] = useState(false);
  const romPath = useEditorStore((state) => state.emulatorRomIdentity?.path ?? null);
  const setRexBridgeRequest = useEditorStore((state) => state.setRexBridgeRequest);

  const linkMatches = Boolean(link && romSha256 && link.rom_sha256 === romSha256);
  const status = !link
    ? "Sem vínculo: compile o projeto para inspecionar."
    : !linkMatches
      ? "Executando build anterior: o vínculo é de outra ROM. Recompile para inspecionar."
      : !paused
        ? "Pause para inspecionar o quadro."
        : null;

  // Amostra a RAM do quadro pausado (e de cada passo) — nunca durante a execução.
  useEffect(() => {
    if (!active || !paused || !link || !linkMatches || coreEpoch === null || !romSha256) {
      return;
    }
    let cancelled = false;
    const at: PausedFrameIdentity = { romSha256, coreEpoch, renderedFrames };
    void (async () => {
      const samples = await sampleEntities(link);
      const camera = link.camera
        ? { x: await readWord(link.camera.x, true), y: await readWord(link.camera.y, true) }
        : { x: 0, y: 0 };
      const audio: AudioEventRow[] = [];
      for (const entity of link.entities) {
        if (!entity.event_symbols) continue;
        audio.push(
          audioEventRow(
            entity,
            await readWord(entity.event_symbols.last_anim, false),
            await readWord(entity.event_symbols.fired, false),
            await readWord(entity.event_symbols.last, false)
          )
        );
      }
      return { samples, camera, audio };
    })()
      .then(({ samples, camera, audio }) => {
        if (!cancelled) {
          setSample({ at, candidates: runtimeCandidates(link, samples, camera), boxes: collisionBoxes(link, samples, camera), audio });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [active, coreEpoch, link, linkMatches, paused, renderedFrames, romSha256]);

  const visible = useMemo(() => {
    // Amostra de outra ROM/quadro nunca é desenhada como se fosse a atual.
    if (!sample || !paused || !linkMatches || sample.at.renderedFrames !== renderedFrames) return [];
    return sample.candidates.filter((candidate) =>
      candidate.kind === "tilemap" ? layers.scene : candidate.kind === "hud" ? layers.interface : layers.characters
    );
  }, [layers.characters, layers.interface, layers.scene, linkMatches, paused, renderedFrames, sample]);

  const navigate = useCallback(
    async (candidate: RuntimeCandidate, assetHashes: Record<string, string> = {}) => {
      if (!link || !sample) return;
      const state = useEditorStore.getState();
      const check = checkRuntimeNavigation({
        assetHashes,
        link,
        sampledAt: sample.at,
        current: {
          romSha256: state.emulatorRomIdentity?.sha256 ?? null,
          coreEpoch: state.coreEpoch,
          renderedFrames,
          paused: state.emulPaused,
        },
        candidate,
        scene: state.activeScene,
      });
      setChoices(null);
      if (!check.ok && check.needsAssetHash && !(check.needsAssetHash in assetHashes)) {
        // Caminho do asset mudou: confere o CONTEÚDO antes de aceitar (mover/renomear legítimo).
        try {
          const bytes = await readProjectAssetBytes(state.activeProjectDir, check.needsAssetHash);
          await navigate(candidate, { ...assetHashes, [check.needsAssetHash]: await sha256Bytes(new Uint8Array(bytes)) });
        } catch (cause) {
          setMessage(`Não foi possível conferir o arquivo do personagem: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        return;
      }
      if (!check.ok) {
        setMessage(check.reason);
        logMessage("warn", `[Inspecionar] ${check.reason}`);
        return;
      }
      setMessage(null);
      openStudioEditor({
        focus:
          candidate.kind === "tilemap"
            ? { task: "scene", entityId: candidate.entity_id, animation: null, occurrenceId: null }
            : candidate.kind === "hud"
              ? { task: "interface", entityId: candidate.entity_id, animation: null, occurrenceId: null }
            : { task: "character", entityId: candidate.entity_id, animation: candidate.animation, occurrenceId: candidate.occurrenceId },
      });
      logMessage(
        "info",
        `[Inspecionar] ${candidate.entity_id}${candidate.animation ? ` · ${candidate.animation} · ${candidate.occurrenceId}` : ""} aberto no editor.`
      );
    },
    [link, logMessage, openStudioEditor, renderedFrames, sample]
  );

  async function locateProfiles() {
    if (!romPath || !romSha256) return;
    setRexBusy(true);
    setMessage(null);
    try {
      const response = await rexProfileLocate({ rom_path: romPath, request_id: `inspect-${Date.now()}`, profiles_dir: null, declared_regions: [] });
      const items = rexBridgeItems(response, useEditorStore.getState().emulatorRomIdentity?.sha256 ?? null);
      if ("error" in items) {
        setMessage(items.error);
        setRexItems(null);
      } else {
        setRexItems(items);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRexBusy(false);
    }
  }

  function openRex(item: RexBridgeItem) {
    if (!romPath || !romSha256) return;
    rexBridgeSeq += 1;
    setRexBridgeRequest({ seq: rexBridgeSeq, romPath, romSha256, key: item.key });
    logMessage("info", `[Inspecionar] Perfil REX ${item.key} aberto no editor do perfil.`);
  }

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!linkMatches) {
      // Sem vínculo do projeto para esta ROM: o ponto não tem identidade comprovada.
      setMessage("Desconhecido: este ponto não tem vínculo comprovado (projeto ou perfil REX). Só inspeção; nenhum editor semântico é aberto.");
      return;
    }
    if (!canvas || !sample) return;
    const rect = canvas.getBoundingClientRect();
    const point = clientToNative(
      { clientX: event.clientX, clientY: event.clientY },
      {
        left: rect.left,
        top: rect.top,
        clientLeft: canvas.clientLeft,
        clientTop: canvas.clientTop,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        width: canvas.width,
        height: canvas.height,
      }
    );
    if (!point) return;
    const hits = hitTest(visible, point);
    if (hits.length === 0) {
      setMessage(`Nada vinculado em (${point.x}, ${point.y}).`);
      return;
    }
    if (hits.length === 1) void navigate(hits[0]);
    else setChoices(hits);
  };

  const scaleX = canvas ? canvas.clientWidth / Math.max(1, canvas.width) : 1;
  const scaleY = canvas ? canvas.clientHeight / Math.max(1, canvas.height) : 1;
  const name = (id: string) => {
    const entity = activeScene?.entities.find((e) => e.entity_id === id);
    return entity ? getEntityDisplayName(entity) : id;
  };

  return (
    <>
      <div className="absolute -top-8 left-0 flex items-center gap-2 text-[10px]" data-testid="inspect-toolbar">
        <button
          type="button"
          data-testid="inspect-toggle"
          aria-pressed={active}
          title="Inspecionar: destacar e selecionar elementos do quadro pausado"
          onClick={() => {
            setActive((value) => !value);
            setChoices(null);
            setMessage(null);
          }}
          className={`rounded border px-2 py-0.5 ${active ? "border-[#f97316] text-[#fdba74]" : "border-[#45475a] text-[#a6adc8]"}`}
        >
          ◎ Inspecionar
        </button>
        {active
          ? (Object.keys(LAYER_LABEL) as InspectLayer[]).map((layer) => (
              <label key={layer} className="flex items-center gap-1 text-[#cdd6f4]">
                <input
                  type="checkbox"
                  data-testid={`inspect-layer-${layer}`}
                  checked={layers[layer]}
                  title={
                    layer === "collisions"
                      ? "Caixas da ocorrência atual (ataque/corpo) e células sólidas do mapa"
                      : layer === "audio"
                        ? "Eventos sonoros disparados até este quadro (lista, não retângulos)"
                        : undefined
                  }
                  onChange={(e) => setLayers((current) => ({ ...current, [layer]: e.target.checked }))}
                />
                {LAYER_LABEL[layer]}
              </label>
            ))
          : null}
      </div>
      {active ? (
        <div
          data-testid="inspect-overlay"
          data-sampled-frame={sample?.at.renderedFrames ?? ""}
          data-candidates={visible.length}
          className="absolute inset-0 cursor-crosshair"
          style={{ margin: canvas?.clientLeft ?? 0 }}
          onClick={handleClick}
        >
          {layers.collisions && sample && sample.at.renderedFrames === renderedFrames && linkMatches
            ? sample.boxes.map((box, index) => (
                <div
                  key={`box-${index}`}
                  data-testid={`inspect-collision-${box.kind}`}
                  data-entity={box.entity_id}
                  className={`pointer-events-none absolute border ${box.kind === "attack" ? "border-dashed border-[#ef4444]" : box.kind === "body" ? "border-[#3b82f6]" : "border-[#a3a3a3] bg-[#a3a3a3]/15"}`}
                  style={{ left: box.rect.x * scaleX, top: box.rect.y * scaleY, width: box.rect.w * scaleX, height: box.rect.h * scaleY }}
                />
              ))
            : null}
          {layers.audio && sample && sample.at.renderedFrames === renderedFrames && linkMatches ? (
            <ul
              data-testid="inspect-audio-events"
              data-frame={sample.at.renderedFrames}
              className="absolute right-1 top-1 max-w-[50%] space-y-0.5 rounded bg-black/80 p-1 text-[9px] text-[#fde68a]"
              onClick={(e) => e.stopPropagation()}
            >
              {sample.audio.length === 0 ? <li>Nenhum evento sonoro no build.</li> : null}
              {sample.audio.map((row) => (
                <li key={row.entity_id} data-testid={`inspect-audio-${row.entity_id}`} data-fired={row.fired} data-last={row.last?.id ?? ""}>
                  🔊 {name(row.entity_id)}: {row.fired} disparo(s)
                  {row.last ? ` · último “${row.last.sound}” em ${row.last.occurrence}, tick ${row.last.tick}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {visible.map((candidate) => (
            <div
              key={`${candidate.kind}-${candidate.entity_id}`}
              data-testid={`inspect-box-${candidate.entity_id}`}
              data-kind={candidate.kind}
              data-palette-bank={link?.palette?.entities[candidate.entity_id]?.[0] ?? ""}
              className={`pointer-events-none absolute border-2 ${candidate.kind === "tilemap" ? "border-[#22d3ee]" : candidate.kind === "hud" ? "border-[#ec4899]" : "border-[#f97316]"}`}
              style={{
                left: candidate.rect.x * scaleX,
                top: candidate.rect.y * scaleY,
                width: candidate.rect.w * scaleX,
                height: candidate.rect.h * scaleY,
              }}
            >
              <span
                className={`absolute -top-4 left-0 whitespace-nowrap px-1 text-[9px] font-semibold text-black ${candidate.kind === "tilemap" ? "bg-[#22d3ee]" : candidate.kind === "hud" ? "bg-[#ec4899]" : "bg-[#f97316]"}`}
              >
                {candidate.kind === "tilemap" ? "BG" : candidate.kind === "hud" ? "TEXTO" : "SPRITE"} · {name(candidate.entity_id)}
                {link?.palette?.entities[candidate.entity_id]
                  ? ` · paleta ${link.palette.entities[candidate.entity_id][2]} (banco ${link.palette.entities[candidate.entity_id][0]}, planejado)`
                  : ""}
              </span>
            </div>
          ))}
          {status ? (
            <div data-testid="inspect-status" className="absolute bottom-1 left-1 rounded bg-black/80 px-2 py-1 text-[10px] text-[#fbbf24]">
              {status}
            </div>
          ) : null}
          {!linkMatches && romSha256 ? (
            <div
              data-testid="inspect-rex"
              className="absolute left-1 top-1 max-w-[70%] rounded border border-[#45475a] bg-[#11111b]/95 p-1.5 text-[10px] text-[#cdd6f4]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold">ROM sem vínculo deste projeto</p>
              <p className="text-[#a6adc8]">Só o que um perfil REX comprovou nesta ROM pode abrir um editor.</p>
              <button
                type="button"
                data-testid="inspect-rex-locate"
                disabled={rexBusy || !romPath}
                onClick={() => void locateProfiles()}
                className="mt-1 rounded border border-[#a6e3a1]/60 px-2 text-[#a6e3a1] disabled:opacity-40"
              >
                {rexBusy ? "Localizando…" : "Localizar perfis comprovados"}
              </button>
              {rexItems ? (
                rexItems.length === 0 ? (
                  <p data-testid="inspect-rex-none" className="mt-1 text-[#fbbf24]">Nenhum perfil reconheceu esta ROM: tudo aqui é desconhecido.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5" data-testid="inspect-rex-items">
                    {rexItems.map((item, index) => (
                      <li key={item.key} className="flex items-center gap-1">
                        <span className="min-w-0 flex-1 truncate" title={`${item.selection} · ${item.status}`}>
                          {item.title} · {item.selection}
                        </span>
                        <button
                          type="button"
                          data-testid={`inspect-rex-open-${index}`}
                          onClick={() => openRex(item)}
                          className="rounded border border-[#89b4fa]/60 px-1 text-[#89b4fa]"
                        >
                          Abrir no editor do perfil
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : null}
          {message ? (
            <div role="alert" data-testid="inspect-message" className="absolute bottom-1 right-1 max-w-[60%] rounded bg-black/80 px-2 py-1 text-[10px] text-[#f38ba8]">
              {message}
            </div>
          ) : null}
          {choices ? (
            <div
              role="dialog"
              aria-label="Escolha o elemento"
              data-testid="inspect-choices"
              className="absolute left-1 top-1 rounded border border-[#45475a] bg-[#11111b] p-1 text-[10px]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-[#a6adc8]">Vários elementos aqui — escolha:</p>
              {choices.map((candidate) => (
                <button
                  key={`${candidate.kind}-${candidate.entity_id}`}
                  type="button"
                  data-testid={`inspect-choice-${candidate.entity_id}`}
                  onClick={() => void navigate(candidate)}
                  className="block w-full rounded px-1 py-0.5 text-left hover:bg-[#1e293b]"
                >
                  {candidate.kind === "tilemap" ? "Cenário" : candidate.kind === "hud" ? "Texto" : "Personagem"}: {name(candidate.entity_id)}
                  {candidate.animation ? ` · ${candidate.animation} · ${candidate.occurrenceId}` : ""}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
