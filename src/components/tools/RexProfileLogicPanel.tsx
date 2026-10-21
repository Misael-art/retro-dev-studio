import { rexInstanceKey, type RexBridgeRequest } from "../../core/rexBridge";
import { useEditorStore } from "../../core/store/editorStore";
import { useEffect, useRef, useState } from "react";
import {
  rexProfileEdit,
  rexProfileLocate,
  type RexAppObservation,
  type RexDeclaredRegion,
  type RexCuratedRecord,
  type RexProfileEditResponse,
  type RexProfileField,
  type RexProfileInfo,
  type RexProfileInstance,
  type RexProfileLocateResponse,
} from "../../core/ipc/toolsService";
import { contextIdentity, relateResult, valuesKey, type ResultKey } from "../../core/nodegraph/profileGraphBridge";
import ToolPathField from "./ToolPathField";
import { ExperimentalNotice } from "./ToolNotices";

type LogLevel = "info" | "warn" | "error" | "success";

interface Props {
  romPath: string;
  /** Pedido da ponte Studio → REX: localizar e focar esta instância (perfil@offset). */
  focusRequest?: RexBridgeRequest | null;
  logMessage?: (level: LogLevel, message: string) => void;
  /** Anexa o grafo à lógica da entidade selecionada e abre o canvas; devolve o motivo se recusar. */
  onOpenAsNodes?: (graphJson: string, romPath: string, profilesDir?: string) => Promise<{ ok: boolean; message: string }>;
  /**
   * Regra gravada na entidade no FORMATO ANTERIOR da classe semântica (bloco `recovered_rule`). Não é
   * apagada nem reescrita: o painel a mostra e oferece re-recuperar pela região gravada (migração explícita).
   */
  legacyRule?: LegacyRule | null;
}

export interface LegacyRule {
  profileId: string;
  romSha256: string;
  entry: number;
  exits: number[];
  threshold: number;
}

/** Lista de offsets em hexadecimal ("0x400, 0x444"); `null` se algum item não for um offset par válido. */
export function parseHexList(texto: string): number[] | null {
  const itens = texto.split(/[\s,;]+/).filter(Boolean);
  const out: number[] = [];
  for (const item of itens) {
    if (!/^(0x)?[0-9a-fA-F]{1,8}$/.test(item)) return null;
    const n = parseInt(item.replace(/^0x/i, ""), 16);
    if (n % 2 !== 0) return null;
    out.push(n);
  }
  return out;
}

function hex(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `0x${value.toString(16).toUpperCase().padStart(6, "0")}`;
}

function erro(cause: unknown): string {
  if (cause && typeof cause === "object") {
    const e = cause as { code?: unknown; message?: unknown };
    return `${typeof e.code === "string" ? e.code : "erro"}: ${typeof e.message === "string" ? e.message : JSON.stringify(cause)}`;
  }
  return String(cause);
}

let counter = 0;
function requestId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Valor digitado válido para o campo? Inteiro dentro do domínio aceito. */
function validar(texto: string, min: number, max: number): number | null {
  if (!/^-?\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Rótulo curto de um registro curado: de onde vem e sob o quê foi medido. Nunca diz "verdadeiro". */
function procedencia(r: RexCuratedRecord): string {
  const quando = r.measured_under.profile_form === "data" ? "medido com este perfil em dado" : "medido antes de o perfil virar dado";
  return `registro ${r.id} · relatório ${r.report.path.split("/").pop()} (SHA-256 ${r.report.sha256.slice(0, 12)}…) · binário ${r.measured_under.binary_sha256.slice(0, 12)}… · ${quando}`;
}

/**
 * As afirmações de execução de uma instância, separadas pela ORIGEM. Nada aqui é observação do
 * aplicativo: "curada" é registro histórico do repositório; "declarada" é só a palavra do autor.
 */
export function evidenciaPorOrigem(fields: RexProfileField[]): { curadas: string[]; curadasForaDoAlvo: boolean; curadasOutraRevisao: boolean; declaradas: string[] } {
  const curadas: string[] = [];
  const declaradas: string[] = [];
  let curadasForaDoAlvo = false;
  let curadasOutraRevisao = false;
  for (const f of fields) {
    for (const c of f.claims) {
      if (c.origin === "curated" && c.applicability === "this_instance") {
        curadas.push(`${f.label}: valores ${c.values.join(" e ")} (${c.level}, ${c.level_label})${c.inherited ? " — herdada: medida antes deste arquivo de perfil e transportada por equivalência" : ""} — ${c.records.map(procedencia).join("; ")}`);
      } else if (c.origin === "curated" && c.applicability === "other_revision") {
        curadasOutraRevisao = true;
      } else if (c.origin === "curated") {
        curadasForaDoAlvo = true;
      } else {
        declaradas.push(`${f.label}: o autor declara ${c.level} (${c.level_label}) para os valores ${c.values.join(" e ")}${c.declared_scope_matches ? ", citando esta ROM e instância" : ", para outra ROM ou instância"}`);
      }
    }
  }
  return { curadas, curadasForaDoAlvo, curadasOutraRevisao, declaradas };
}

/** A observação é da sessão atual do aplicativo? Observação de outra sessão não é observação atual. */
export function observacaoAtual(obs: RexAppObservation, sessaoAtual: string): boolean {
  return sessaoAtual !== "" && obs.session === sessaoAtual;
}

const PAPEL: Record<string, string> = {
  immediate: "constante",
  ea_displacement: "deslocamento de endereço efetivo (a base só existe em execução)",
  bus_address: "endereço de barramento",
  opaque: "bytes só conferidos",
};

interface Item {
  profile: RexProfileInfo;
  instance: RexProfileInstance;
}

/**
 * Lógicas reconhecidas por PERFIL (dado versionado) → campos editáveis. O painel não conhece nenhum
 * perfil: título, campos, notas, evidência e limites vêm da resposta do núcleo.
 */
export function RexProfileLogicPanel({ romPath, logMessage, onOpenAsNodes, legacyRule = null, focusRequest = null }: Props) {
  const [loc, setLoc] = useState<RexProfileLocateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [outDir, setOutDir] = useState("");
  const [profilesDir, setProfilesDir] = useState("");
  const [regionProfile, setRegionProfile] = useState("");
  const [regionEntry, setRegionEntry] = useState("");
  const [regionExits, setRegionExits] = useState("");
  const [result, setResult] = useState<{ key: ResultKey; resposta: RexProfileEditResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: ResultKey; mensagem: string } | null>(null);
  const currentKeyRef = useRef<ResultKey | null>(null);
  const [openMsg, setOpenMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const seq = useRef(0);

  // Trocar de ROM ou de pasta de perfis descarta tudo: nada de resultado de outro contexto na tela.
  useEffect(() => {
    seq.current += 1;
    setLoc(null);
    setError("");
    setEdits({});
    setResult(null);
    setFailure(null);
    setOpenMsg(null);
    setSelected(0);
  }, [romPath, profilesDir]);

  // Região declarada: só é enviada quando perfil, entrada e saídas estão todos preenchidos e válidos.
  const entradaDeclarada = parseHexList(regionEntry);
  const saidasDeclaradas = parseHexList(regionExits);
  const regiaoPreenchida = regionProfile.trim() !== "" || regionEntry.trim() !== "" || regionExits.trim() !== "";
  const regiao: RexDeclaredRegion | null =
    regionProfile.trim() !== "" && entradaDeclarada?.length === 1 && saidasDeclaradas !== null && saidasDeclaradas.length > 0
      ? { profile_id: regionProfile.trim(), entry: entradaDeclarada[0], exits: saidasDeclaradas }
      : null;
  const regiaoInvalida = regiaoPreenchida && regiao === null;

  const matches = loc?.matches ?? [];
  const items: Item[] = matches.flatMap((m) => m.instances.map((instance) => ({ profile: m.profile, instance })));
  const current: Item | null = items[selected] ?? null;
  const dir = profilesDir.trim();

  async function locate() {
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    setResult(null);
    setFailure(null);
    setEdits({});
    try {
      const next = await rexProfileLocate({ rom_path: romPath, request_id: requestId("rex-loc"), profiles_dir: dir || null, declared_regions: regiao ? [regiao] : [] });
      if (mine !== seq.current) return;
      setLoc(next);
      setSelected(0);
      const n = next.matches.reduce((a, m) => a + m.instances.length, 0);
      logMessage?.(n ? "success" : "warn", n ? `Lógicas reconhecidas: ${n} instância(s).` : "Nenhuma lógica reconhecida nesta ROM pelos perfis carregados.");
    } catch (e) {
      if (mine !== seq.current) return;
      setLoc(null);
      setError(erro(e));
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  // Ponte: ao receber um pedido, localizar nesta ROM e selecionar a instância comprovada pedida.
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const handledFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequest || handledFocus.current === focusRequest.seq || !romPath) return;
    handledFocus.current = focusRequest.seq;
    void (async () => {
      try {
        const next = await rexProfileLocate({ rom_path: romPath, request_id: requestId("rex-bridge"), profiles_dir: null, declared_regions: [] });
        if (next.rom_sha256 !== focusRequest.romSha256) {
          setFocusNote("A ROM no disco não é a que estava em execução; nada foi focado.");
          return;
        }
        setLoc(next);
        const flat = next.matches.flatMap((m) => m.instances.map((instance) => rexInstanceKey(m.profile.id, instance.instance_offset)));
        const index = flat.indexOf(focusRequest.key);
        if (index < 0) {
          setSelected(0);
          setFocusNote(`A instância ${focusRequest.key} não foi localizada de novo nesta ROM; nada foi focado.`);
        } else {
          setSelected(index);
          setFocusNote(`Aberto pela inspeção do teste: ${focusRequest.key}.`);
        }
      } catch (e) {
        setFocusNote(erro(e));
      }
    })();
  }, [focusRequest, romPath]);

  const changed: Record<string, number> = {};
  let invalid = false;
  if (current) {
    for (const f of current.instance.fields) {
      const text = edits[f.name];
      if (text === undefined || text === "") continue;
      const n = validar(text, f.min, f.max);
      if (n === null) invalid = true;
      else if (n !== f.value) changed[f.name] = n;
    }
  }
  const hasChange = Object.keys(changed).length > 0;

  const currentKey: ResultKey | null =
    current && loc
      ? { identity: contextIdentity(loc.rom_sha256, current.profile.id, current.profile.sha256), instance: current.instance.instance_offset, values: valuesKey(changed) }
      : null;
  currentKeyRef.current = currentKey;
  const relation = result && currentKey ? relateResult(result.key, currentKey) : null;
  const visibleFailure = failure && currentKey && relateResult(failure.key, currentKey) !== "outro-contexto" ? failure : null;

  async function generate() {
    if (!current || !loc || !currentKey || !hasChange || invalid) return;
    const mine = ++seq.current;
    const key = currentKey;
    const { profile, instance } = current;
    setBusy(true);
    setError("");
    setFailure(null);
    try {
      const r = await rexProfileEdit({
        rom_path: romPath,
        profile_id: profile.id,
        // identidade do PERFIL da localização: se o dado do perfil mudou depois, o núcleo recusa sem gravar
        profile_sha256: profile.sha256,
        instance_offset: instance.instance_offset,
        values: changed,
        output_dir: outDir,
        request_id: requestId("rex-edit"),
        // identidade da LOCALIZAÇÃO: se a ROM em disco mudou depois de localizar, o núcleo recusa sem gravar
        expected_rom_sha256: loc.rom_sha256,
        profiles_dir: dir || null,
        // classe semântica: a região (saídas e modo de seleção) é a da instância mostrada
        ...(instance.selection.mode !== "signature" ? { region_exits: instance.region_exits, region_selection: instance.selection.mode } : {}),
      });
      const now = currentKeyRef.current;
      if (mine !== seq.current || !now || relateResult(key, now) === "outro-contexto" || r.identity_rom_sha256 !== loc.rom_sha256 || r.profile_id !== profile.id || r.profile_sha256 !== profile.sha256 || r.instance_offset !== key.instance) return;
      setResult({ key, resposta: r });
      logMessage?.("success", `Patch gerado: ${r.patched_path}`);
    } catch (e) {
      if (mine !== seq.current) return;
      setFailure({ key, mensagem: erro(e) });
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  const inst = current?.instance ?? null;
  const prof = current?.profile ?? null;
  const romName = romPath.split(/[\\/]/).filter(Boolean).pop();
  const evidencia = evidenciaPorOrigem(inst?.fields ?? []);
  const observadoAgora = inst !== null && loc !== null && inst.observations.some((o) => o.kind === "static_form_matched" && observacaoAtual(o, loc.app_session));
  const soForma = inst ? inst.fields.filter((f) => f.static_level === "L1").map((f) => f.label) : [];
  const consistentes = inst ? inst.fields.filter((f) => f.static_level !== "L1").map((f) => f.label) : [];

  return (
    <div data-testid="jump-logic-panel" className="rounded border border-[#a6e3a1]/40 bg-[#14201a] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#a6e3a1]">Lógicas reconhecidas na ROM → Nodes editáveis (Experimental)</div>
      <ExperimentalNotice summary="Procura na ROM, por assinatura de bytes (não por endereço fixo), as lógicas que os perfis carregados descrevem, e deixa editar os números delas sem crescer a ROM. A edição gera uma CÓPIA e um patch IPS; a ROM original nunca é alterada." />
      {focusNote ? (
        <p data-testid="rex-bridge-focus-note" role="status" className="mt-1 text-[10px] text-[#f9e2af]">
          {focusNote}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" data-testid="jump-locate" disabled={busy || !romPath.trim() || regiaoInvalida} onClick={() => void locate()} className="rounded border border-[#a6e3a1]/50 px-3 py-1 text-[11px] text-[#a6e3a1] disabled:opacity-40">
          Localizar lógicas nesta ROM
        </button>
        {!romPath.trim() && <span className="text-[10px] text-[#7f849c]">Informe a ROM acima.</span>}
      </div>
      <details className="mt-2" data-testid="profile-sources">
        <summary className="cursor-pointer text-[10px] text-[#bac2de]">Perfis usados (detalhe técnico)</summary>
        <div className="mt-1 text-[9px] text-[#7f849c]">
          Um perfil é um arquivo de dados que descreve a forma de uma lógica. Os perfis que vêm com o programa são sempre tentados; opcionalmente, indique uma pasta com perfis autorais (arquivos <span className="font-mono">.json</span>). Nenhum perfil executa código.
        </div>
        <div className="mt-1">
          <ToolPathField label="Pasta de perfis autorais (opcional)" value={profilesDir} set={setProfilesDir} placeholder="/caminho/para/perfis" directory accentColor="a6e3a1" testId="profile-dir" />
        </div>
        {loc && (
          <ul data-testid="profile-list" className="mt-1 list-disc pl-4 text-[9px] text-[#bac2de]">
            {matches.map((m) => (
              <li key={m.profile.id} data-profile-id={m.profile.id} data-instances={m.instances.length}>
                {m.profile.title} · <span className="font-mono">{m.profile.id}</span> · revisão {m.profile.revision} · SHA-256 {m.profile.sha256.slice(0, 12)}… · {m.profile.origin === "builtin" ? "embutido" : "da pasta"} ·{" "}
                {m.error ? `recusado nesta ROM: ${m.error.code}` : !m.bound ? "vinculado a outras ROMs: não tentado" : `${m.instances.length} instância(s)`}
                {m.rejected_by_constraint > 0 && ` · ${m.rejected_by_constraint} ocorrência(s) descartada(s) por restrição`}
              </li>
            ))}
          </ul>
        )}
        {loc && loc.rejected.length > 0 && (
          <ul data-testid="profile-rejected" className="mt-1 list-disc pl-4 text-[9px] text-[#f9e2af]">
            {loc.rejected.map((r) => (
              <li key={r.file} data-rule={r.rule}>Arquivo recusado: <span className="font-mono">{r.file.split(/[\\/]/).pop()}</span> — {r.rule}: {r.message}</li>
            ))}
          </ul>
        )}
      </details>
      {legacyRule && (
        <div data-testid="profile-legacy-rule" className="mt-2 rounded border border-[#f9e2af]/50 bg-[#f9e2af]/10 p-2 text-[10px] text-[#f9e2af]">
          Esta entidade tem uma regra gravada no <strong>formato anterior</strong> (perfil <span className="font-mono">{legacyRule.profileId}</span>, entrada {hex(legacyRule.entry)}, saída(s) {legacyRule.exits.map(hex).join(", ")}, limiar {legacyRule.threshold}, ROM {legacyRule.romSha256.slice(0, 12)}…). Ela não foi apagada nem alterada. Para continuar a editá-la pelo fluxo atual, recupere-a de novo a partir da ROM pela mesma região.
          {loc && loc.rom_sha256 !== legacyRule.romSha256 && <span data-testid="profile-legacy-mismatch"> A ROM informada agora ({loc.rom_sha256.slice(0, 12)}…) não é a da regra gravada: o resultado abaixo é desta ROM, não daquela.</span>}
          <div className="mt-1">
            <button
              type="button"
              data-testid="profile-legacy-migrate"
              onClick={() => { setRegionProfile(legacyRule.profileId); setRegionEntry(hex(legacyRule.entry)); setRegionExits(legacyRule.exits.map(hex).join(", ")); }}
              className="rounded border border-[#f9e2af]/50 px-2 py-0.5"
            >
              Preencher a região gravada
            </button>
            <span className="ml-1 text-[9px]">Depois use "Localizar lógicas nesta ROM".</span>
          </div>
        </div>
      )}
      <details className="mt-2" data-testid="profile-region" open={regiaoPreenchida}>
        <summary className="cursor-pointer text-[10px] text-[#bac2de]">Região declarada (avançado)</summary>
        <div className="mt-1 text-[9px] text-[#7f849c]">
          Alguns perfis não localizam por assinatura: derivam a regra dos bytes dentro de uma região. Você pode <strong>declarar</strong> a região (onde começa e onde termina). Isso não é descoberta automática: o resultado fica rotulado como região declarada.
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[#cdd6f4]">
          <label>Perfil <input data-testid="region-profile" list="region-profile-list" value={regionProfile} onChange={(e) => setRegionProfile(e.target.value)} placeholder="id do perfil" className="w-64 rounded border border-[#313244] bg-transparent px-1" /></label>
          <datalist id="region-profile-list">
            {matches.filter((m) => m.profile.selection_modes.includes("declared_region")).map((m) => <option key={m.profile.id} value={m.profile.id} />)}
          </datalist>
          <label>Entrada <input data-testid="region-entry" value={regionEntry} onChange={(e) => setRegionEntry(e.target.value)} placeholder="0x000400" className="w-24 rounded border border-[#313244] bg-transparent px-1" /></label>
          <label>Saída(s) <input data-testid="region-exits" value={regionExits} onChange={(e) => setRegionExits(e.target.value)} placeholder="0x000444, 0x…" className="w-40 rounded border border-[#313244] bg-transparent px-1" /></label>
        </div>
        {regiaoInvalida && <div data-testid="region-invalid" className="mt-1 text-[10px] text-[#f38ba8]">Região incompleta ou inválida: informe o perfil, UMA entrada e ao menos uma saída, em hexadecimal e pares.</div>}
      </details>
      {error && <div data-testid="jump-error" className="mt-2 break-words text-[11px] text-[#f38ba8]">{error}</div>}
      {loc && items.length === 0 && (
        <div data-testid="jump-none" className="mt-2 text-[11px] text-[#f9e2af]">
          Nenhuma lógica reconhecida nesta ROM pelos {matches.length} perfil(is) carregado(s). Isto não significa que a ROM não tenha essa lógica: só que ela não tem a forma que os perfis conhecem.
        </div>
      )}
      {loc && items.length > 0 && (
        <>
          <div className="mt-2 text-[10px] text-[#7f849c]">ROM {loc.rom_sha256.slice(0, 16)}… · {loc.rom_size} bytes · {items.length} instância(s)</div>
          <div role="tablist" aria-label="Instâncias reconhecidas" className="mt-1 flex flex-wrap gap-1">
            {items.map((it, i) => (
              <button
                key={`${it.profile.id}:${it.instance.instance_offset}`}
                type="button"
                role="tab"
                aria-selected={selected === i}
                data-testid={`jump-tab-${i}`}
                onClick={() => { setSelected(i); setEdits({}); }}
                className={`rounded border px-2 py-1 text-[10px] ${selected === i ? "border-[#a6e3a1] bg-[#1d3326] text-[#cdd6f4]" : "border-[#313244] text-[#bac2de]"}`}
              >
                {it.profile.title} em {hex(it.instance.instance_offset)}
              </button>
            ))}
          </div>
          {inst && prof && (
            <div data-testid="jump-instance" data-jump-offset={inst.instance_offset} data-profile-id={prof.id} className="mt-2">
              <div data-testid="profile-recognized" className="text-[10px] text-[#cdd6f4]">
                Reconhecido pelo perfil <strong>{prof.title}</strong> <span className="font-mono text-[#bac2de]">({prof.id}, revisão {prof.revision}, {prof.origin === "builtin" ? "embutido" : "da pasta de perfis"})</span>.
              </div>
              <ul className="list-disc pl-4 text-[10px] text-[#bac2de]">
                {inst.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
              <div data-testid="profile-selection" data-mode={inst.selection.mode} className="mt-1 text-[10px] text-[#bac2de]">
                <strong>Como foi escolhida:</strong> {inst.selection.label}.
              </div>
              {inst.operations.length > 0 && (
                <div data-testid="profile-operations" className="mt-1 rounded border border-[#313244] p-1 text-[10px] text-[#bac2de]">
                  <strong>Operações recuperadas dos bytes da ROM (pelo analisador, não pelo perfil):</strong>
                  <ul className="list-disc pl-4">
                    {inst.operations.map((o) => (
                      <li key={o.id} data-testid={`profile-op-${o.id}`} data-opaque={o.opaque ? "sim" : "nao"} data-editable={o.editable ? "sim" : "nao"}>
                        <span className="font-mono">{o.kind}</span>{o.text ? ` — ${o.text}` : ""}
                        {o.rom_ranges.length > 0 && <span className="text-[#7f849c]"> · bytes {o.rom_ranges.map(([a, b]) => `${hex(a)}..${hex(b)}`).join(", ")}</span>}
                        {o.editable && <span className="text-[#a6e3a1]"> · editável (só o valor)</span>}
                        {o.opaque && <span className="text-[#f9e2af]"> · OPACA: registrada, não recuperada</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div data-testid="profile-declared" className="mt-1 text-[10px] text-[#7f849c]">
                <strong>Declarado (não derivado da ROM):</strong> {inst.declared.join("; ")}.
              </div>
              <div data-testid="profile-evidence" className="mt-1 rounded border border-[#313244] p-1 text-[10px] text-[#bac2de]">
                <div data-testid="profile-evidence-static">
                  <strong>Observado pelo aplicativo nesta sessão (sem rodar o jogo):</strong>{" "}
                  {!observadoAgora && <>nada: este resultado não é desta sessão. </>}
                  {observadoAgora && consistentes.length > 0 && <>forma e consistência entre as partes — {consistentes.join(", ")}. </>}
                  {observadoAgora && inst.observations.some((o) => o.kind === "operations_derived_from_bytes" && observacaoAtual(o, loc.app_session)) && <>As operações acima foram derivadas dos bytes nesta sessão. </>}
                  {observadoAgora && soForma.length > 0 && <>só a forma, sem a consistência que o pareamento daria — {soForma.join(", ")}. </>}
                  {inst.ambiguities.map((a) => <span key={a} className="text-[#f9e2af]">Ambiguidade: {a}. </span>)}
                </div>
                <div data-testid="profile-evidence-curated">
                  <strong>Evidência histórica curada (registro do repositório; o aplicativo não mediu isto):</strong>{" "}
                  {evidencia.curadas.length > 0 ? evidencia.curadas.join(" · ") + "." : "nenhuma para esta ROM e instância."}
                  {evidencia.curadasForaDoAlvo && " Há registro curado deste perfil para outra ROM ou instância; ele não vale para esta."}
                  {evidencia.curadasOutraRevisao && " Há registro curado para outra revisão deste perfil; ele não vale para este arquivo."}
                </div>
                <div data-testid="profile-evidence-declared">
                  <strong>Declarado pelo autor do perfil (não verificado):</strong>{" "}
                  {evidencia.declaradas.length > 0 ? evidencia.declaradas.join("; ") + ". Uma declaração com referências e SHA não comprova a medição." : "nada além do que está acima."}
                </div>
                <div data-testid="profile-evidence-unknown">
                  <strong>Continua desconhecido:</strong> se o jogo executa este trecho e quem o chama (o reconhecimento é pela forma dos bytes, não por execução){prof.unknown.map((u) => `; ${u}`).join("")}.
                </div>
              </div>
              {inst.details.length > 0 && (
                <div className="mt-1 text-[10px] text-[#7f849c]">
                  Campos do objeto: {inst.details.map(([l, t]) => `${l} ${t}`).join(" · ")}
                </div>
              )}
              <div data-testid="jump-alvo" className="mt-2 text-[10px] text-[#cdd6f4]">
                Editando <strong>{prof.title}</strong> na ROM <span className="font-mono">{romName}</span> (SHA-256 {loc.rom_sha256.slice(0, 12)}…), instância {hex(inst.instance_offset)}.
              </div>
              <div data-testid="profile-supported" className="mt-1 text-[9px] text-[#7f849c]">
                Suportado: trocar o valor dos números abaixo, que a ROM já tem (a ROM não cresce). Não suportado: acrescentar, remover ou reordenar lógica, nem trocar operador, endereço ou conexão — isso não é compilado. Gerar cópia NÃO compila um projeto nem recompila o grafo: grava uma cópia da ROM com esses valores e um patch IPS. Domínio aceito pelo perfil não é o mesmo que "bom no jogo".
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#a6e3a1]">Nodes (um por número editável)</div>
              <table className="mt-1 w-full text-[11px] text-[#cdd6f4]">
                <tbody>
                  {inst.fields.map((f) => {
                    const text = edits[f.name] ?? String(f.value);
                    const ok = validar(text, f.min, f.max) !== null;
                    const mask = f.width >= 4 ? 0xffffffff : (1 << (f.width * 8)) - 1;
                    return (
                      <tr key={f.name} data-testid={`jump-field-${f.name}`}>
                        <td className="py-0.5 pr-2">
                          <label htmlFor={`jump-in-${f.name}`}>{f.label}</label>
                          <div className="text-[9px] text-[#7f849c]">em {f.rom_offsets.map(hex).join(", ")} · faixa {f.min}..{f.max}</div>
                        </td>
                        <td className="py-0.5">
                          <input
                            id={`jump-in-${f.name}`}
                            data-testid={`jump-input-${f.name}`}
                            inputMode="numeric"
                            value={text}
                            aria-invalid={!ok}
                            onChange={(e) => setEdits((p) => ({ ...p, [f.name]: e.target.value }))}
                            className={`w-24 rounded border bg-transparent px-1 ${ok ? "border-[#313244]" : "border-[#f38ba8]"}`}
                          />
                          <span className="ml-2 text-[9px] text-[#7f849c]">atual {f.value} (0x{((f.value & mask) >>> 0).toString(16)})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <div className="min-w-[16rem] flex-1">
                  <ToolPathField label="Pasta de saída da cópia" value={outDir} set={setOutDir} placeholder="/caminho/para/a/pasta" directory accentColor="a6e3a1" testId="jump-outdir" />
                </div>
                <button type="button" data-testid="jump-generate" disabled={busy || !hasChange || invalid || !outDir.trim()} onClick={() => void generate()} className="rounded border border-[#a6e3a1]/50 px-3 py-1 text-[#a6e3a1] disabled:opacity-40">
                  Gerar cópia + patch
                </button>
              </div>
              {!hasChange && !invalid && <div className="mt-1 text-[9px] text-[#7f849c]">Altere ao menos um valor.</div>}
              {invalid && <div data-testid="jump-invalid" className="mt-1 text-[10px] text-[#f38ba8]">Há valor inválido: use inteiros dentro da faixa de cada campo.</div>}
              {visibleFailure && <div data-testid="jump-failure" className="mt-1 break-words text-[11px] text-[#f38ba8]">{visibleFailure.mensagem}</div>}
              {result && relation !== "outro-contexto" && (
                <div data-testid="jump-result" data-relacao={relation} className="mt-2 rounded border border-[#a6e3a1]/30 p-2 text-[10px] text-[#bac2de]">
                  {relation === "valores-anteriores" && (
                    <div data-testid="jump-result-obsoleto" className="mb-1 rounded border border-[#f9e2af]/50 bg-[#f9e2af]/10 px-1 py-0.5 text-[#f9e2af]">
                      Esta cópia corresponde aos valores ANTERIORES ({result.resposta.values_applied.map(([n, v]) => `${n}=${v}`).join(", ")}); os valores atuais do formulário são outros. Gere de novo.
                    </div>
                  )}
                  <div>Cópia{relation === "atual" ? " (corresponde aos valores atuais)" : ""}: <span className="break-all font-mono">{result.resposta.patched_path}</span></div>
                  <div>Patch IPS: <span className="break-all font-mono">{result.resposta.ips_path}</span></div>
                  <div>SHA-256 antes {result.resposta.rom_sha256_before.slice(0, 12)}… → depois {result.resposta.rom_sha256_after.slice(0, 12)}…</div>
                  <div data-testid="jump-result-flags">
                    ROM original intacta: {result.resposta.original_untouched ? "sim" : "NÃO"} · tamanho preservado: {result.resposta.size_unchanged ? "sim" : "NÃO"} · IPS reproduz a cópia: {result.resposta.ips_reproduces_copy ? "sim" : "NÃO"} · bytes alterados: {result.resposta.patches.reduce((a, p) => a + p.new.length, 0)}
                  </div>
                  <div>Relido da cópia: {result.resposta.values_after.map(([n, v]) => `${n}=${v}`).join(" · ")}</div>
                  {result.resposta.avisos.map((a) => <div key={a} className="text-[#f9e2af]">{a}</div>)}
                  <div className="mt-1 text-[#f9e2af]">Esta verificação é estrutural. O efeito no jogo se confere jogando a cópia no emulador (abra o arquivo da cópia pelo fluxo de emulação).</div>
                  <div className="mt-1">
                    <button
                      type="button"
                      data-testid="jump-play-copy"
                      onClick={() => {
                        useEditorStore.getState().setRexCopyRun({ copyPath: result.resposta.patched_path, originalPath: romPath });
                        useEditorStore.getState().requestEmulatorLaunch(result.resposta.patched_path, "Cópia editada (patch)");
                      }}
                      className="rounded border border-[#89b4fa]/50 px-2 py-0.5 text-[#89b4fa]"
                    >
                      Jogar esta cópia no emulador
                    </button>
                    <button
                      type="button"
                      data-testid="jump-play-original"
                      onClick={() => {
                        useEditorStore.getState().setRexCopyRun(null);
                        useEditorStore.getState().requestEmulatorLaunch(romPath, "ROM original");
                      }}
                      className="ml-1 rounded border border-[#f9e2af]/50 px-2 py-0.5 text-[#f9e2af]"
                      title="Reverter a execução: volta a rodar a ROM original, que nunca foi alterada"
                    >
                      Voltar à ROM original
                    </button>
                    <span className="ml-1 text-[9px] text-[#7f849c]">Usa o mesmo carregador de ROM do emulador; a ROM original não é a que roda.</span>
                  </div>
                </div>
              )}
              {onOpenAsNodes && (
                <div className="mt-2">
                  <button
                    type="button"
                    data-testid="jump-open-nodes"
                    onClick={() => {
                      const graph = inst.graph_json;
                      if (!graph) return;
                      void onOpenAsNodes(graph, romPath, dir).then((r) => {
                        setOpenMsg(r);
                        logMessage?.(r.ok ? "success" : "warn", r.message);
                      });
                    }}
                    className="rounded border border-[#a6e3a1]/50 px-3 py-1 text-[11px] text-[#a6e3a1]"
                  >
                    Abrir como nodes no editor
                  </button>
                  {openMsg && (
                    <span data-testid="jump-open-msg" data-ok={openMsg.ok ? "sim" : "nao"} className={`ml-2 text-[10px] ${openMsg.ok ? "text-[#a6e3a1]" : "text-[#f9e2af]"}`}>
                      {openMsg.message}
                    </span>
                  )}
                  <div className="mt-0.5 text-[9px] text-[#7f849c]">Depois, edite os valores dos nós no canvas e gere a cópia na ponte ao lado.</div>
                </div>
              )}
              <details className="mt-2" data-testid="profile-technical">
                <summary className="cursor-pointer text-[10px] text-[#bac2de]">Detalhes técnicos (perfil, endereços e medições)</summary>
                <div className="mt-1 text-[9px] text-[#7f849c]">
                  Perfil <span className="font-mono">{prof.id}</span> · revisão {prof.revision} · SHA-256 <span className="break-all font-mono">{prof.sha256}</span> · {prof.arch} · arquivo <span className="font-mono">{prof.file.split(/[\\/]/).pop()}</span> · autor {prof.author} ({prof.created}).
                </div>
                <div className="mt-1 text-[9px] text-[#7f849c]">
                  Instância: offset de arquivo {hex(inst.instance_offset)} · endereço de barramento {hex(inst.instance_bus_address)} · padrão âncora <span className="font-mono">{inst.anchor_pattern}</span>
                  {inst.links.map((l) => ` · ${l.relation} → ${hex(l.file_offset)}`).join("")}.
                </div>
                <table data-testid="profile-captures" className="mt-1 w-full text-[9px] text-[#7f849c]">
                  <thead><tr><th className="text-left">Captura</th><th className="text-left">Papel</th><th className="text-left">Valor</th><th className="text-left">Offset de arquivo</th><th className="text-left">Designa (barramento)</th></tr></thead>
                  <tbody>
                    {inst.captures.map((c) => (
                      <tr key={`${c.source}:${c.name}`}>
                        <td className="font-mono">{c.source}.{c.name}</td>
                        <td>{PAPEL[c.role] ?? c.role}</td>
                        <td>{c.value}</td>
                        <td>{hex(c.file_offset)}</td>
                        <td>{c.designates_bus_address === null ? "—" : `${hex(c.designates_bus_address)}${c.designates_file_offset === null ? " (fora da ROM)" : ` = arquivo ${hex(c.designates_file_offset)}`}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {prof.claims.length > 0 && (
                  <ul data-testid="profile-claims" className="mt-1 list-disc pl-4 text-[9px] text-[#7f849c]">
                    {prof.claims.map((c) => (
                      <li key={c.id}>
                        [{c.origin === "curated" ? `histórico curado: ${c.records.length} registro(s)` : "só declarado pelo autor"}] {c.level} ({c.level_label}): {c.statement} Escopo declarado: {c.roms.map(([sha, offs]) => `${sha.slice(0, 12)}… instância ${offs.map(hex).join(", ")}`).join("; ")}. Condições: {c.conditions}. Referências: {c.refs.join("; ")}.
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 text-[9px] text-[#7f849c]">Edições suportadas: {prof.editable.join(" · ")}.</div>
                <div data-testid="jump-graph" className="mt-1">
                  <div className="text-[9px] text-[#bac2de]">Grafo em nodes (NodeGraph v1, descritivo)</div>
                  <textarea readOnly value={inst.graph_json} className="mt-1 h-40 w-full rounded border border-[#313244] bg-[#0b0f14] p-1 font-mono text-[9px] text-[#7f849c]" />
                </div>
              </details>
            </div>
          )}
          <ul data-testid="jump-limits" className="mt-2 list-disc pl-4 text-[9px] text-[#7f849c]">
            {loc.limites.map((l) => <li key={l}>{l}</li>)}
            {prof?.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
