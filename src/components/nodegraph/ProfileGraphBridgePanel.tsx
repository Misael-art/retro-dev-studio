import { useEditorStore } from "../../core/store/editorStore";
import { useRef, useState } from "react";
import { rexProfileEdit, type RexProfileEditResponse } from "../../core/ipc/toolsService";
import {
  bridgeInfo,
  contextIdentity,
  editsFromGraph,
  graphStructure,
  relateResult,
  valuesKey,
  type ResultKey,
} from "../../core/nodegraph/profileGraphBridge";
import { serializeNodeGraph } from "../../core/nodegraph/nodeTypes";
import type { NodeGraph } from "../../core/nodegraph/nodeTypes";
import ToolPathField from "../tools/ToolPathField";

type LogLevel = "info" | "warn" | "error" | "success";

interface Props {
  graph: NodeGraph;
  logMessage?: (level: LogLevel, message: string) => void;
}

function erro(cause: unknown): string {
  if (cause && typeof cause === "object") {
    const e = cause as { code?: unknown; message?: unknown };
    return `${typeof e.code === "string" ? e.code : "erro"}: ${typeof e.message === "string" ? e.message : JSON.stringify(cause)}`;
  }
  return String(cause);
}

let counter = 0;

type Resultado = { key: ResultKey; resposta: RexProfileEditResponse };
type Falha = { key: ResultKey; mensagem: string };

function nomeDoArquivo(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * Edição da ROM pelo canvas (Experimental), para o grafo de QUALQUER perfil REX: perfil, instância e campos
 * vêm do próprio grafo. Os valores dos nós editáveis são lidos AO VIVO do grafo; o
 * botão envia o GRAFO ao núcleo, que o revisa contra o canônico reconstruído da ROM (não confia nos
 * metadados do frontend), deriva os valores e grava uma CÓPIA + IPS publicados juntos. Mudar um valor no
 * canvas nunca altera a ROM sozinho. Gerar uma cópia NÃO é compilar um projeto autoral.
 */
export default function ProfileGraphBridgePanel({ graph, logMessage }: Props) {
  const info = bridgeInfo(graph);
  const [romPath, setRomPath] = useState("");
  const [outDir, setOutDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const seq = useRef(0);
  const atualRef = useRef<ResultKey | null>(null);
  if (!info) return null;
  const estrutura = graphStructure(graph);
  const { changes, edits, problems } = editsFromGraph(graph);
  const atual: ResultKey = { identity: contextIdentity(info.romSha256, info.perfil, info.perfilSha256), instance: info.instanceOffset, values: valuesKey(changes) };
  atualRef.current = atual;
  const path = (info.romPath || romPath).trim();
  // classe semântica: o grafo traz como a região foi escolhida e quais nós são partes opacas
  const entrada = graph.nodes.find((n) => n.params.ponte_edicao === 1);
  const selecao = typeof entrada?.params.selecao === "string" ? entrada.params.selecao : "";
  const compare = graph.nodes.find((n) => n.type === "rom_counter_compare");
  const copy = graph.nodes.find((n) => n.type === "rom_copy_grid");
  const proposedWidth = Number(copy?.params.bytes_per_cell);
  const allowedWidths = copy?.params.allowed_widths === undefined ? [1, 2] : String(copy.params.allowed_widths).split(",").map(Number);
  const proposedStride = copy ? Number(copy.params.columns) * proposedWidth + Number(copy.params.row_gap_bytes) : 0;
  const proposedSpan = copy ? (Number(copy.params.rows) - 1) * proposedStride + Number(copy.params.columns) * proposedWidth : 0;
  const signedCompare = compare?.params.signed === "true" && compare.params.width_bits === 32;
  const opacos = graph.nodes.filter((n) => n.params.understood === "false");
  const derivados = graph.nodes.filter((n) => n.params.semantic_origin === "recovered_from_rom").length;
  const canGenerate = !busy && estrutura.canonical && edits.length > 0 && problems.length === 0 && path !== "" && outDir.trim() !== "";
  const relacao = resultado ? relateResult(resultado.key, atual) : null;
  const falhaVisivel = falha && relateResult(falha.key, atual) !== "outro-contexto" ? falha : null;

  async function generate() {
    if (!info || !canGenerate) return;
    counter += 1;
    const minha = ++seq.current;
    const key = atual;
    const requestId = `rex-canvas-${Date.now().toString(36)}-${counter}`;
    setBusy(true);
    setFalha(null);
    try {
      const r = await rexProfileEdit({
        rom_path: path,
        profile_id: info.perfil,
        // grafo gravado antes do vínculo por hash não o tem: o núcleo o revisa pela estrutura e avisa
        profile_sha256: info.perfilSha256 || null,
        instance_offset: info.instanceOffset,
        graph_json: serializeNodeGraph(graph),
        output_dir: outDir.trim(),
        request_id: requestId,
        expected_rom_sha256: info.romSha256,
        profiles_dir: info.perfilDir || null,
      });
      // resposta de um contexto que já não é o atual (troca de ROM/perfil/instância) nunca aparece
      const agora = atualRef.current;
      if (minha !== seq.current || !agora || r.request_id !== requestId || (info.perfilSha256 !== "" && r.profile_sha256 !== info.perfilSha256) || relateResult(key, agora) === "outro-contexto" || r.identity_rom_sha256 !== info.romSha256 || r.profile_id !== info.perfil || r.instance_offset !== key.instance) return;
      setResultado({ key, resposta: r });
      logMessage?.("success", `[REX] cópia gerada a partir do grafo: ${r.patched_path}`);
    } catch (e) {
      if (minha !== seq.current) return;
      setFalha({ key, mensagem: erro(e) });
    } finally {
      if (minha === seq.current) setBusy(false);
    }
  }

  return (
    <div data-testid="jump-bridge" data-identity={info.romSha256} data-instance={info.instanceOffset} data-profile={info.perfil} className="rounded border border-[#a6e3a1]/40 bg-[#14201a] px-2 py-1.5 text-[10px] leading-snug">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#a6e3a1]">Ponte ROM ↔ nodes (Experimental)</p>
      <p data-testid="jump-bridge-alvo" className="mt-1 text-[#cdd6f4]">
        Editando valores que a ROM {path ? <span className="font-mono">{nomeDoArquivo(path)}</span> : "(informe a ROM abaixo)"} já tem · SHA-256 {info.romSha256.slice(0, 12)}… · instância 0x{info.instanceOffset.toString(16).toUpperCase()}.
      </p>
      <p data-testid="jump-bridge-perfil" className="mt-1 text-[#bac2de]">
        Reconhecido pelo perfil <span className="font-mono">{info.perfil}</span>
        {info.perfilSha256 ? <> (revisão {info.perfilRevisao ?? "?"}, SHA-256 {info.perfilSha256.slice(0, 12)}…)</> : <> (grafo gravado antes do vínculo por SHA-256 do perfil: o núcleo confere a estrutura ao gerar)</>}.
        Isto é reconhecimento <strong>estático</strong> da forma; não prova que o jogo executa este trecho. O que foi medido e o que segue desconhecido está na aba Lógicas, na instância.
      </p>
      <p className="mt-1 text-[#bac2de]">
        Suportado: trocar o valor dos nós marcados como editáveis (números que a ROM já tem; ela não cresce). Não suportado: remover nós, mudar conexões, trocar campos ou acrescentar lógica; isso não é aplicado à ROM. Gerar cópia <strong>não</strong> compila um projeto nem recompila este grafo: grava uma cópia da ROM com esses valores e um patch IPS.
      </p>
      {selecao !== "" && (
        <p data-testid="jump-bridge-semantica" data-selecao={selecao} className="mt-1 text-[#bac2de]">
          Os {derivados} nós deste grafo são <strong>operações derivadas dos bytes da ROM</strong> por um analisador. A região foi {selecao === "declared_region" ? "declarada pelo usuário (entrada e saídas informadas)" : "proposta por varredura estrutural"}; nenhuma das duas é descoberta automática de rotina.
          {opacos.length > 0 && <> Parte(s) opaca(s), registrada(s) e não recuperada(s): {opacos.map((n) => n.label).join(", ")}.</>}
          {signedCompare && <span data-testid="jump-bridge-compare"> Comparação assinada de 32 bits ({String(compare?.params.operator)}).</span>}
          {copy ? <span data-testid="jump-bridge-copy"> Cópia de memória {String(copy.params.source_address)} → {String(copy.params.destination_address)} · {String(copy.params.rows)} linhas × {String(copy.params.columns)} colunas · largura base {String(copy.params.valor_original)} bytes · incremento base {String(copy.params.source_increment_bytes)} · stride base {String(copy.params.row_stride_bytes)} · gap {String(copy.params.row_gap_bytes)}. Só a largura {allowedWidths.join("↔")} é editável; mapa, alinhamento e sobreposição são revalidados. Topologia não é compilada. Estado inicial, caller e consumidor gráfico não recuperados. {allowedWidths.includes(proposedWidth) && <>Proposta: largura/incremento {proposedWidth} bytes, stride {proposedStride}, span {proposedSpan} bytes.</>}</span> : <> Só o limiar é editável: trocar operador, endereço, conexão ou a chamada externa não é compilado.</>}
        </p>
      )}
      <p data-testid="jump-bridge-observation" className="mt-1 text-[#bac2de]">Original: valores recuperados dos bytes. Proposta: alterações do canvas ainda não executadas. Resultado publicado: cópia/IPS e verificação estrutural. Resultado observado em execução: não medido por este painel; executar uma ROM não vincula automaticamente pixels ou memória a estes nodes.</p>
      {!estrutura.canonical && (
        <p data-testid="jump-bridge-estrutura" className="mt-1 rounded border border-[#f9e2af]/50 bg-[#f9e2af]/10 px-1 py-0.5 text-[#f9e2af]">
          Este grafo deixou de representar a lógica da ROM: {estrutura.motivo}. Os valores NÃO serão aplicados. Posição e organização visual continuam livres; para voltar a editar valores, abra o grafo de novo a partir da ROM.
        </p>
      )}
      {edits.length === 0 && problems.length === 0 && <p data-testid="jump-bridge-none" className="mt-1 text-[#7f849c]">Nenhum valor alterado em relação à ROM.</p>}
      {edits.length > 0 && (
        <ul data-testid="jump-bridge-edits" className="mt-1 space-y-0.5 text-[#cdd6f4]">
          {edits.map((e) => (
            <li key={e.campo} data-campo={e.campo}>{e.label}: {e.de} → <span className="text-[#a6e3a1]">{e.para}</span></li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <ul data-testid="jump-bridge-problems" className="mt-1 space-y-0.5 text-[#f38ba8]">
          {problems.map((p) => (
            <li key={p.campo} data-campo={p.campo}>{p.label}: {p.motivo}</li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[9px] text-[#7f849c]">O domínio aceito pelo perfil não é o mesmo que "bom no jogo": só os valores efetivamente medidos têm efeito demonstrado.</p>
      {!info.romPath && (
        <div className="mt-1">
          <ToolPathField label="ROM" value={romPath} set={setRomPath} placeholder="/roms/game.md" extensions={["md", "bin", "gen"]} accentColor="a6e3a1" testId="jump-bridge-rom" />
        </div>
      )}
      <div className="mt-1">
        <ToolPathField label="Pasta de saída da cópia" value={outDir} set={setOutDir} placeholder="/caminho/para/a/pasta" directory accentColor="a6e3a1" testId="jump-bridge-outdir" />
      </div>
      <button type="button" data-testid="jump-bridge-generate" disabled={!canGenerate} onClick={() => void generate()} className="mt-1 rounded border border-[#a6e3a1]/50 px-2 py-0.5 text-[#a6e3a1] disabled:opacity-40">
        Gerar cópia + patch a partir do grafo
      </button>
      {falhaVisivel && <p data-testid="jump-bridge-error" className="mt-1 break-words text-[#f38ba8]">{falhaVisivel.mensagem}</p>}
      {resultado && relacao !== "outro-contexto" && (
        <div data-testid="jump-bridge-result" data-relacao={relacao} className="mt-1 text-[#bac2de]">
          {relacao === "valores-anteriores" && (
            <p data-testid="jump-bridge-result-obsoleto" className="mb-0.5 rounded border border-[#f9e2af]/50 bg-[#f9e2af]/10 px-1 py-0.5 text-[#f9e2af]">
              Esta cópia corresponde aos valores ANTERIORES ({resultado.resposta.values_applied.map(([n, v]) => `${n}=${v}`).join(", ")}); os valores atuais do grafo são outros. Gere de novo para obter a cópia dos valores atuais.
            </p>
          )}
          <div>Cópia{relacao === "atual" ? " (corresponde aos valores atuais)" : ""}: <span className="break-all font-mono">{resultado.resposta.patched_path}</span></div>
          <div>IPS: <span className="break-all font-mono">{resultado.resposta.ips_path}</span></div>
          <div data-testid="jump-bridge-result-flags">ROM original intacta: {resultado.resposta.original_untouched ? "sim" : "NÃO"} · tamanho preservado: {resultado.resposta.size_unchanged ? "sim" : "NÃO"} · IPS reproduz a cópia: {resultado.resposta.ips_reproduces_copy ? "sim" : "NÃO"} · relido da cópia: {resultado.resposta.values_after.map(([n, v]) => `${n}=${v}`).join(" · ")}</div>
          {resultado.resposta.avisos.map((a) => <div key={a} className="text-[#f9e2af]">{a}</div>)}
          <div className="text-[#f9e2af]">Verificação estrutural; o efeito se confere jogando a cópia no emulador (abra o arquivo da cópia pelo fluxo de emulação).</div>
          <div className="mt-1">
            <button
              type="button"
              data-testid="jump-play-copy"
              onClick={() => useEditorStore.getState().requestEmulatorLaunch(resultado.resposta.patched_path, "Cópia editada (patch)")}
              className="rounded border border-[#89b4fa]/50 px-2 py-0.5 text-[#89b4fa]"
            >
              Jogar esta cópia no emulador
            </button>
            <span className="ml-1 text-[9px] text-[#7f849c]">Usa o mesmo carregador de ROM do emulador; a ROM original não é a que roda.</span>
          </div>
        </div>
      )}
    </div>
  );
}
