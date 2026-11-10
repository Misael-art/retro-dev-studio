import type { EmulatorInputObservation } from "./ipc/emulatorService";
import type { JoypadTransition } from "./store/editorStore";

/**
 * As cinco etapas do caminho de input, sem fundi-las:
 * 1. evento nativo recebido pela UI e 2. solicitação enviada → existe uma entrada no registro (`requested`);
 * 3. aceita ou recusada pelo backend → `accepted` (com época, geração e quadro) ou `refused`;
 * 4. estado consultado pelo core → `polled` (com o quadro) ou `never_polled`;
 * 5. efeito no jogo → fora daqui (quem mede é a sonda do jogo).
 * ACEITAÇÃO (3) NÃO É CONSUMO (4): uma transição aceita pode nunca ser lida pelo core.
 */
export type CoreConsumption =
  /** o core leu o joypad com esta transição vigente (etapa 4 observada) */
  | "polled"
  /** aceita, mas substituída antes de qualquer quadro: o core NUNCA a viu (perda REAL de input) */
  | "never_polled"
  /** aceita e ainda vigente, mas nenhum quadro rodou depois dela */
  | "pending"
  /** não foi aplicada (recusada, erro, ou ainda sem resposta do backend) */
  | "not_applied"
  /** aceita, mas fora do alcance desta leitura (outra época, ou já saiu do anel do backend) */
  | "unknown";

export interface ConsumedTransition {
  seq: number;
  joypad: Record<string, boolean>;
  outcome: JoypadTransition["outcome"];
  message: string | null;
  generation: number | null;
  appliedAtFrame: number | null;
  core: CoreConsumption;
  firstPolledFrame: number | null;
  lastPolledFrame: number | null;
}

export interface InputConsumption {
  /** `false`: a leitura não pôde ser atribuída a UMA sessão (ver `reason`). */
  ok: boolean;
  reason: string;
  sessionId: string | null;
  epoch: number | null;
  framesRun: number | null;
  transitions: ConsumedTransition[];
}

/**
 * Junta o registro da UI (por sessão e sequência) com a observação do backend (por época e geração).
 * Não atribui nada entre sessões: se a sessão mudou durante a leitura, devolve `ok: false`.
 */
export function joinInputConsumption(
  sessionBefore: string | null,
  sessionAfter: string | null,
  log: JoypadTransition[],
  backend: EmulatorInputObservation,
): InputConsumption {
  if (sessionBefore === null || sessionBefore !== sessionAfter) {
    return { ok: false, reason: "a sessão de input mudou (ou não existe) durante a leitura", sessionId: sessionAfter, epoch: null, framesRun: null, transitions: [] };
  }
  const byGeneration = new Map(backend.transitions.map((t) => [t.generation, t]));
  const transitions = log
    .filter((t) => t.sessionId === sessionBefore)
    .map((t): ConsumedTransition => {
      const base = { seq: t.seq, joypad: t.joypad, outcome: t.outcome, message: t.message, generation: t.generation, appliedAtFrame: t.appliedAtFrame };
      if (t.outcome !== "accepted") return { ...base, core: "not_applied", firstPolledFrame: null, lastPolledFrame: null };
      const b = t.epoch === backend.epoch && t.generation !== null ? byGeneration.get(t.generation) : undefined;
      if (!b) return { ...base, core: "unknown", firstPolledFrame: null, lastPolledFrame: null };
      const core: CoreConsumption = b.first_polled_frame !== null ? "polled" : b.superseded_unpolled ? "never_polled" : "pending";
      return { ...base, core, firstPolledFrame: b.first_polled_frame, lastPolledFrame: b.last_polled_frame };
    });
  return { ok: true, reason: "", sessionId: sessionBefore, epoch: backend.epoch, framesRun: backend.frames_run, transitions };
}
