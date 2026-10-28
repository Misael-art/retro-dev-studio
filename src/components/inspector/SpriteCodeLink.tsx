// Sprite capturado da ROM → recurso SGDK → código C que o usa (Experimental). A ligação é
// gravada pela captura (pixels do sprite achados na folha do recurso); aqui ela vira atalhos
// para o ponto exato do C, na tarefa Lógica.
import { useEffect, useState } from "react";

import { useCodeFocusStore } from "../../core/codeFocusStore";
import { romCaptureLinks, type SpriteCodeRef, type SpriteLink } from "../../core/ipc/emulatorService";
import { useEditorStore } from "../../core/store/editorStore";

const CAPTURE_PREFIX = "assets/rom_capture/";

/** Ligação do sprite de uma cena capturada, carregada do `links.json` da captura. */
export function useSpriteLink(entityId: string | null, asset: string | undefined): SpriteLink | null {
  const projectDir = useEditorStore((s) => s.activeProjectDir);
  const [link, setLink] = useState<SpriteLink | null>(null);
  const captureDir = asset?.startsWith(CAPTURE_PREFIX) ? asset.slice(0, asset.lastIndexOf("/")) : null;
  useEffect(() => {
    let alive = true;
    setLink(null);
    if (!projectDir || !captureDir || !entityId) return;
    romCaptureLinks(projectDir, captureDir)
      .then((links) => alive && setLink(links[entityId] ?? null))
      .catch(() => alive && setLink(null));
    return () => {
      alive = false;
    };
  }, [projectDir, captureDir, entityId]);
  return link;
}

function refLabel(ref: SpriteCodeRef): string {
  const where = `${ref.file.split("/").pop()}:${ref.line}`;
  return ref.function ? `${ref.function}() · ${where}` : `${where} (declaração)`;
}

export function openCodeRef(ref: SpriteCodeRef, entityId: string) {
  useCodeFocusStore.getState().focusCode({ file: ref.file, nodeId: ref.node_id, line: ref.line });
  const store = useEditorStore.getState();
  if (store.activeWorkspace !== "logic") store.openStudioEditor({ focus: { task: "actions", entityId } });
}

export function SpriteCodeLinkCard({ entityId, link, compact = false }: { entityId: string; link: SpriteLink; compact?: boolean }) {
  const inFunctions = link.refs.filter((r) => r.function);
  const shown = compact ? inFunctions.slice(0, 4) : link.refs;
  return (
    <div data-testid="sprite-code-link" data-resource={link.resource} className="rounded border border-[#a6e3a1]/35 bg-[#a6e3a1]/5 px-2 py-1.5 text-[10px] text-[#cdd6f4]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#a6e3a1]">No código do jogo</p>
      <p className="mt-0.5">
        Recurso <span className="font-mono font-semibold">{link.resource}</span>
        <span className="text-[#7f849c]">
          {" "}
          · {link.sheet} ({link.rect[0]},{link.rect[1]} {link.rect[2]}×{link.rect[3]}
          {link.flipped ? ", espelhado" : ""})
        </span>
      </p>
      {shown.length === 0 ? (
        <p className="text-[#7f849c]">Nenhuma função usa este recurso diretamente.</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {shown.map((ref) => (
            <li key={`${ref.file}:${ref.line}`}>
              <button
                type="button"
                data-testid={`sprite-code-ref-${ref.file}:${ref.line}`}
                onClick={() => openCodeRef(ref, entityId)}
                title={ref.text}
                className="w-full truncate rounded border border-[#45475a] px-1.5 py-0.5 text-left hover:border-[#a6e3a1]"
              >
                {refLabel(ref)}
                {ref.via ? <span className="text-[#7f849c]"> via {ref.via}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {compact && inFunctions.length > shown.length ? (
        <p className="mt-0.5 text-[#7f849c]">+{inFunctions.length - shown.length} uso(s) na Lógica</p>
      ) : null}
    </div>
  );
}

/** Seção do Inspector: aparece só para sprites de captura com ligação encontrada. */
export function EntitySpriteCodeLink({ entityId, asset }: { entityId: string; asset: string | undefined }) {
  const link = useSpriteLink(entityId, asset);
  return link ? (
    <div className="mt-1">
      <SpriteCodeLinkCard entityId={entityId} link={link} compact />
    </div>
  ) : null;
}
