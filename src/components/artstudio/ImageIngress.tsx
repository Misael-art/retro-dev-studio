import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import Dialog from "../common/Dialog";
import Icon from "../common/Icon";
import { useEditorStore, type EditorWorkspace } from "../../core/store/editorStore";
import { persistActiveScene } from "../../core/scenePersistence";
import { resolveSceneWorldMetrics } from "../../core/sceneWorldModel";
import { captureClipboardImage, editableImageTarget, imageFileInput, imageTransferSources, insertImageEntity, prepareImage, proposeImage, publishImage,
  type ImageCandidate, type ImageInput, type ImageRole, type PreparedImage } from "../../core/imageIngress";
import type { PalettePlan } from "../../core/palettePlan";
import { loadPixelArtDoc } from "../../core/ipc/artStudioService";
import { deserializePixelDoc } from "../../core/pixelEditor";
import type { PixelConversion } from "../../core/pixelEditor";
import { IMAGE_CONVERSIONS } from "../../core/imageIngress";

type Request = { source: File | ImageInput; position?: { x: number; y: number }; nativeDocument?: string; assetPath?: string; clipboard?:Promise<{prepared:PreparedImage|null;error?:unknown}> };
type Context = { project: string; session: number; scene: string; target: string };
const context = (): Context => { const s = useEditorStore.getState();return { project: s.activeProjectDir, session: s.projectSessionId, scene: s.activeScenePath, target: s.activeTarget }; };
const contextKey = () => JSON.stringify(context());
const message = (e: unknown) => e instanceof Error ? e.message : String(e);

/** Single ingress owner for scene, art and files; never a second scene writer. */
export default function ImageIngress({ onWorkspaceSelect }: { onWorkspaceSelect: (workspace: EditorWorkspace) => void }) {
  const project = useEditorStore(s => s.activeProjectDir);
  const session = useEditorStore(s => s.projectSessionId);
  const scenePath = useEditorStore(s => s.activeScenePath);
  const target = useEditorStore(s => s.activeTarget);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [candidate, setCandidate] = useState<ImageCandidate | null>(null);
  const [plan, setPlan] = useState<PalettePlan | null>(null);
  const [inserted, setInserted] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [conversion, setConversion] = useState<PixelConversion>("balanced");
  const queue = useRef<Request[]>([]);
  const active = useRef<{ request: Request; key: string; generation: number } | null>(null);
  const generation = useRef(0);

  const cancel = useCallback(() => {
    ++generation.current;active.current = null;queue.current = [];
    setPrepared(null);setBusy("");setCandidate(null);setPlan(null);setError("");setCommitting(false);
  }, []);

  const begin = useCallback(async (request: Request): Promise<void> => {
    if (active.current) {
      if (queue.current.length < 15) queue.current.push(request);
      else setError("A fila aceita 16 imagens por vez. As demais não foram importadas; solte-as novamente ao concluir este lote.");
      return;
    }
    const s = useEditorStore.getState();
    if (!s.activeProjectDir || !s.activeScene) { setNotice("Abra ou crie um projeto antes de colar uma imagem.");return; }
    if (s.activeTarget !== "megadrive") { setNotice("Entrada rápida ainda Experimental: a conversão e o plano de paletas desta versão são do Mega Drive. No SNES, use as ferramentas de imagem existentes.");return; }
    const operation = { request, key: contextKey(), generation: ++generation.current };
    active.current = operation;setInserted(null);setNotice("");setError("");setBusy("Lendo a imagem e seus quadros…");
    const current = () => active.current === operation && operation.key === contextKey() && generation.current === operation.generation;
    try {
      const input = request.source instanceof File ? await imageFileInput(request.source) : request.source;
      if (!current()) return;
      let result: PreparedImage;
      if (request.clipboard) {
        const captured=await request.clipboard;if(captured.error)throw captured.error;
        if(!current())return;
        if(!captured.prepared){active.current=null;setBusy("");setNotice("Nenhuma imagem compatível foi encontrada na área de transferência. Use Imagem ou solte o arquivo.");const next=queue.current.shift();if(next)void begin(next);return;}
        result=captured.prepared;
      } else if (request.nativeDocument && request.assetPath) {
        const raw = await loadPixelArtDoc(s.activeProjectDir,request.nativeDocument), doc = deserializePixelDoc(raw);
        result={name:doc.name.replace(/_[a-f0-9]{32}$/,""),source_relative:doc.originalSource??"",source_width:doc.width,source_height:doc.height,frame_count:doc.frames.length,
          doc_json:raw,preview_base64:"",preview_url:convertFileSrc(`${s.activeProjectDir}/${request.assetPath}`),background_mode:"native",warnings:[],suggested_role:doc.target==="plane"?"background":"sprite"};
      } else result = await prepareImage(s.activeProjectDir, input);
      if (current()) setPrepared(result);
    } catch (e) { if (current()) setError(message(e)); }
    finally { if (current()) setBusy(""); }
  }, []);

  useEffect(() => { cancel();setNotice("");setInserted(null); }, [project, session, scenePath, target, cancel]);
  useEffect(() => () => { ++generation.current;active.current = null; }, []);

  useEffect(() => {
    const positionAt = (x: number, y: number) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-scene-canvas"]');
      if (!canvas) return undefined;
      const r = canvas.getBoundingClientRect();if (x < r.left || x > r.right || y < r.top || y > r.bottom) return undefined;
      const s = useEditorStore.getState();const world = resolveSceneWorldMetrics(s.activeScene, s.activeTarget);
      return { x: Math.round(world.bounds.minX + (x-r.left)*canvas.width/r.width), y: Math.round(world.bounds.minY + (y-r.top)*canvas.height/r.height) };
    };
    const otherDialog = () => Boolean(document.querySelector('[role="dialog"]:not([data-testid="image-ingress-dialog"])'));
    const paste = (e: ClipboardEvent) => {
      if (editableImageTarget(e.target) || otherDialog() || !e.clipboardData) return;
      const sources = imageTransferSources(e.clipboardData);
      if (sources.length) {e.preventDefault();e.stopImmediatePropagation();sources.forEach(source => void begin({ source }));return;}
      const text=e.clipboardData.getData("text/plain");
      if(text || !("__TAURI_INTERNALS__" in window))return;
      const s=useEditorStore.getState();if(!s.activeProjectDir)return;
      e.preventDefault();e.stopImmediatePropagation();
      if(s.activeTarget!=="megadrive"){void begin({source:{}});return;}
      // Capture on the paste gesture, before a queued role decision can outlive
      // a later clipboard change. Rejections are retained, never left unhandled.
      const clipboard=captureClipboardImage(s.activeProjectDir).then(prepared=>({prepared}),error=>({prepared:null,error}));
      void begin({source:{},clipboard});
    };
    const drop = (e: DragEvent) => {
      if (otherDialog() || !e.dataTransfer) return;
      const sources = imageTransferSources(e.dataTransfer);if (!sources.length) return;
      e.preventDefault();e.stopImmediatePropagation();sources.forEach(source => void begin({ source, position: positionAt(e.clientX,e.clientY) }));
    };
    const over = (e: DragEvent) => { if (!otherDialog() && (Array.from(e.dataTransfer?.types ?? []).some(t => ["Files","text/html","text/uri-list"].includes(t)))) e.preventDefault(); };
    const modalKeys = (e: KeyboardEvent) => {
      if (document.querySelector('[data-testid="image-ingress-dialog"]') && !["Escape","Tab"].includes(e.key)) e.stopPropagation();
    };
    const choose = async () => {
      const paths = await open({ title: "Adicionar imagem à cena", multiple: true, filters: [{ name: "Imagens e animações", extensions: ["png","gif","jpg","jpeg","webp","bmp","ppm"] }] });
      for (const path of paths ? typeof paths === "string" ? [paths] : paths : []) void begin({ source: { path, name: path.split(/[\\/]/).pop() } });
    };
    const usePixelAsset = (event: Event) => {
      const detail=(event as CustomEvent<{document:string;asset:string}>).detail;
      if (detail?.document && detail.asset) void begin({source:{path:detail.asset},nativeDocument:detail.document,assetPath:detail.asset});
    };
    document.addEventListener("paste",paste,true);document.addEventListener("drop",drop,true);document.addEventListener("dragover",over,true);
    document.addEventListener("keydown",modalKeys,true);
    window.addEventListener("rds:choose-image",choose);
    window.addEventListener("rds:use-pixel-asset",usePixelAsset);
    let dispose: (()=>void) | undefined;let cancelled=false;
    if ("__TAURI_INTERNALS__" in window) void Promise.resolve().then(()=>getCurrentWebviewWindow().onDragDropEvent(e => {
      if (e.payload.type !== "drop" || otherDialog()) return;
      const pos=e.payload.position;for (const path of e.payload.paths) if (/\.(png|gif|jpe?g|webp|bmp|ppm)$/i.test(path)) void begin({ source: { path, name: path.split(/[\\/]/).pop() },position:positionAt(pos.x/devicePixelRatio,pos.y/devicePixelRatio) });
    })).then(fn => { if (cancelled) fn();else dispose=fn; }).catch(e => { if (!cancelled) useEditorStore.getState().logMessage("warn",`[Imagem] Arraste nativo indisponível: ${message(e)}. Colar e Adicionar imagem continuam disponíveis.`); });
    return () => { cancelled=true;dispose?.();document.removeEventListener("paste",paste,true);document.removeEventListener("drop",drop,true);document.removeEventListener("dragover",over,true);document.removeEventListener("keydown",modalKeys,true);window.removeEventListener("rds:choose-image",choose);window.removeEventListener("rds:use-pixel-asset",usePixelAsset); };
  }, [begin]);

  const finish = async (item: ImageCandidate, bank?: number) => {
    const op=active.current;if (!op) return;
    const s=useEditorStore.getState();const revision=s.sceneRevision;
    const current=()=>active.current===op && op.key===contextKey() && generation.current===op.generation;
    if (!s.activeScene || !s.activeSceneSource || !current()) return;
    if (s.activeScene.entities.some(e => e.entity_id === item.entity.entity_id)) throw new Error("Um objeto com este nome foi criado durante a conversão. Cole novamente; os dois arquivos foram preservados.");
    const proposal=await proposeImage(s.activeProjectDir,s.activeScene,item,bank);
    if (!current()) return;
    if (useEditorStore.getState().sceneRevision!==revision) throw new Error("A cena mudou durante a conversão. Cole novamente; seu trabalho foi preservado.");
    if (proposal.errors.length) {
      if (bank !== undefined) throw new Error(proposal.errors.join(" "));
      const resource=proposal.plan.resources.find(r=>r.uses.some(u=>u.entity_id===item.entity.entity_id));
      if (resource?.bank===undefined || resource.state==="conflito" || resource.state==="sem_banco") { setPlan(proposal.before);setCandidate(item);return; }
      throw new Error(proposal.errors.join(" "));
    }
    // One existing history transaction includes BOTH the object and palette use.
    setCommitting(true);setBusy("Salvando a imagem na cena…");
    let saved: boolean;
    try {
      s.replaceScenesWithHistory(proposal.scene,{...s.activeSceneSource,palettes:proposal.scene.palettes,entities:insertImageEntity(s.activeSceneSource.entities,structuredClone(item.entity))});
      s.setSelectedEntityId(item.entity.entity_id);
      saved=await persistActiveScene(s.activeProjectDir,"Imagem");
    } finally { if (current()) setCommitting(false); }
    if (!current()) return;
    setInserted(item.entity.entity_id);setNotice(`${item.prepared.name}: ${item.doc.frames.length} quadro(s), ${item.doc.width}×${item.doc.height} px. ${saved ? "Salvo no projeto." : "Alteração no editor; salvamento pendente. Mantenha a janela aberta."} ${item.prepared.warnings.join(" ")}`);
    if (op.request.nativeDocument) onWorkspaceSelect("scene");
    active.current=null;setPrepared(null);setCandidate(null);setPlan(null);
    const next=queue.current.shift();if (next) void begin(next);
  };
  const convert = async (role: ImageRole, background="auto") => {
    const op=active.current;if (!prepared || !op) return;
    setError("");setBusy("Convertendo cores e preparando todos os quadros…");
    try {
      const s=useEditorStore.getState();
      const result=op.request.nativeDocument ? prepared : await prepareImage(s.activeProjectDir,{ path:`${s.activeProjectDir}/${prepared.source_relative}`,name:prepared.name },role,background,conversion);
      if (active.current!==op || op.key!==contextKey()) return;
      const scene=useEditorStore.getState().activeScene;if (!scene) return;
      const item=await publishImage(s.activeProjectDir,result,role,scene,op.request.position);
      if (active.current!==op || op.key!==contextKey()) return;
      setPrepared(result);await finish(item);
    } catch(e) { if (active.current===op) setError(message(e)); }
    finally { if (active.current===op) setBusy("");else if (!active.current) setBusy(""); }
  };

  const convertRef=useRef(convert);convertRef.current=convert;
  useEffect(()=>{
    if (active.current?.request.nativeDocument && prepared && !busy && !candidate && !error) void convertRef.current(prepared.suggested_role);
  },[prepared,busy,candidate,error]);

  return <>
    {notice && <div data-testid="image-ingress-notice" role="status" className="rds-surface-panel rds-border-subtle fixed bottom-10 left-24 right-6 z-40 rounded-xl border p-3 text-sm shadow-xl">
      <p>{notice}</p><div className="mt-2 flex flex-wrap gap-2">
      {inserted && <><button type="button" data-testid="image-ingress-edit" className="rounded border px-3 py-2" onClick={()=>{useEditorStore.getState().setSelectedEntityId(inserted);onWorkspaceSelect("artstudio");setNotice("");}}>Editar imagem e quadros</button>
      <button type="button" className="rounded border px-3 py-2" onClick={()=>{useEditorStore.getState().setSelectedEntityId(inserted);onWorkspaceSelect("logic");setNotice("");}}>Adicionar lógica</button></>}
      <button type="button" className="rounded border px-3 py-2" onClick={()=>setNotice("")}>Fechar</button></div>
    </div>}
    <Dialog open={Boolean(active.current)} testId="image-ingress-dialog" title={busy || (plan ? "Qual paleta deve dar lugar à imagem?" : "Como usar esta imagem?")}
      description="Entrada rápida · Experimental. O original é preservado; Ctrl+Z desfaz a inserção e a troca de paleta." onClose={cancel} closeDisabled={committing}>
      {prepared && <><img alt="Prévia da imagem recebida" src={prepared.preview_url ?? `data:image/png;base64,${prepared.preview_base64}`} className="mx-auto max-h-52 max-w-full rounded bg-slate-950 object-contain [image-rendering:pixelated]"/>
      <p className="my-3 text-sm">{prepared.name} · {prepared.source_width}×{prepared.source_height} · {prepared.frame_count} quadro(s)</p>
      {!active.current?.request.nativeDocument && <details className="mb-3 rounded-lg border p-3 text-sm"><summary>Conversão: {IMAGE_CONVERSIONS.find(m => m.id === conversion)?.name}</summary><label className="mt-2 block">Método de cores<select disabled={Boolean(busy)} data-testid="image-conversion-method" value={conversion} onChange={e => setConversion(e.target.value as PixelConversion)} className="ml-2 rounded border bg-[var(--rds-surface-panel)] p-2">{IMAGE_CONVERSIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><p className="mt-2">{IMAGE_CONVERSIONS.find(m => m.id === conversion)?.description} O original permanece preservado para comparar outro método no editor.</p></details>}</>}
      {prepared && prepared.frame_count > 1 && !plan && <p className="mb-3 text-sm">Animações entram como personagem ou objeto para manter todos os quadros.</p>}
      {error && <p role="alert" className="my-3 rounded border border-red-500 p-3 text-sm">{error}</p>}
      {error && !prepared && !busy && <button type="button" className="rounded border px-3 py-2" onClick={()=>{const request=active.current?.request;if(request){active.current=null;void begin(request);}}}>Tentar novamente</button>}
      {busy ? <p aria-live="polite" className="p-3 text-sm">Processando localmente. Você pode cancelar sem substituir os objetos existentes.</p> : plan && candidate ? <div className="grid gap-3">{plan.banks.map(b=>{
        const names=plan.resources.filter(r=>r.bank===b.bank).flatMap(r=>r.uses.map(u=>useEditorStore.getState().activeScene?.entities.find(e=>e.entity_id===u.entity_id)?.display_name || u.entity_id));
        return <button key={b.bank} type="button" data-testid={`image-ingress-bank-${b.bank}`} className="rounded-xl border p-4 text-left hover:bg-violet-500/10" onClick={async()=>{const operation=active.current;setBusy("Aplicando a paleta escolhida…");setError("");try {await finish(candidate,b.bank);} catch(e){if(active.current===operation)setError(message(e));}finally{if(active.current===operation||!active.current)setBusy("");}}}>
          <strong>Paleta {String.fromCharCode(65+b.bank)}</strong><p className="mt-1 text-sm">{names.length ? `As cores de ${[...new Set(names)].join(", ")} serão trocadas. As imagens originais permanecem intactas.` : "Banco disponível."}</p></button>;
      })}</div> : active.current?.request.nativeDocument ? <p>Preparando a imagem da biblioteca…</p> : prepared && <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" data-testid="image-ingress-background" disabled={prepared.frame_count>1} className="rounded-xl border p-5 text-left hover:bg-blue-500/10 disabled:opacity-40" onClick={()=>void convert("background")}>
          <Icon name="studio-scene" size={28}/><strong className="mt-2 block">Cenário / fundo</strong><span className="mt-1 block text-sm">Mantém o fundo e prepara a imagem inteira para a cena.</span></button>
        <div className="rounded-xl border p-5"><button type="button" data-testid="image-ingress-sprite" className="w-full text-left" onClick={()=>void convert("sprite")}><Icon name="studio-art" size={28}/><strong className="mt-2 block">Personagem / objeto</strong><span className="mt-1 block text-sm">Preserva a animação e remove o fundo uniforme conectado às bordas.</span></button>
          <button type="button" data-testid="image-ingress-keep-background" className="mt-3 rounded border px-3 py-2 text-sm" onClick={()=>void convert("sprite","keep")}>Usar como objeto, mantendo o fundo</button></div>
      </div>}
    </Dialog>
  </>;
}
