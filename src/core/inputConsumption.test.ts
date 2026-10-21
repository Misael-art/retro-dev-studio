import { describe, expect, it } from "vitest";

import { joinInputConsumption } from "./inputConsumption";
import type { EmulatorInputObservation, EmulatorInputTransition } from "./ipc/emulatorService";
import type { JoypadTransition } from "./store/editorStore";

const pad = (a: boolean) => ({ a }) as never;
const ui = (seq: number, a: boolean, over: Partial<JoypadTransition> = {}): JoypadTransition => ({ sessionId: "s", seq, joypad: { a }, outcome: "accepted", epoch: 7, generation: seq, appliedAtFrame: 10, message: null, ...over });
const core = (generation: number, a: boolean, over: Partial<EmulatorInputTransition> = {}): EmulatorInputTransition => ({ generation, joypad: pad(a), applied_at_frame: 10, first_polled_frame: 11, last_polled_frame: 11, superseded_unpolled: false, ...over });
const backend = (transitions: EmulatorInputTransition[], over: Partial<EmulatorInputObservation> = {}): EmulatorInputObservation => ({ epoch: 7, frames_run: 20, generation: transitions.length, transitions, ...over });

describe("aceitação pelo backend não é consumo pelo core", () => {
  it("toque lido pelo core: aperto e soltura aceitos e consultados em quadros", () => {
    const r = joinInputConsumption("s", "s", [ui(1, true), ui(2, false)], backend([core(1, true, { first_polled_frame: 11, last_polled_frame: 13 }), core(2, false, { applied_at_frame: 13, first_polled_frame: 14, last_polled_frame: 20 })]));
    expect(r.ok).toBe(true);
    expect(r.transitions.map((t) => [t.seq, t.outcome, t.core, t.firstPolledFrame, t.lastPolledFrame])).toEqual([[1, "accepted", "polled", 11, 13], [2, "accepted", "polled", 14, 20]]);
  });

  it("perda REAL: aperto aceito e substituído antes de qualquer quadro — o core nunca o viu", () => {
    const r = joinInputConsumption("s", "s", [ui(1, true), ui(2, false)], backend([core(1, true, { first_polled_frame: null, last_polled_frame: null, superseded_unpolled: true }), core(2, false)]));
    expect(r.transitions.map((t) => [t.seq, t.outcome, t.core])).toEqual([[1, "accepted", "never_polled"], [2, "accepted", "polled"]]);
  });

  it("aceita e ainda sem quadro depois dela é pendente, não consumida", () => {
    const r = joinInputConsumption("s", "s", [ui(1, true)], backend([core(1, true, { first_polled_frame: null, last_polled_frame: null })]));
    expect(r.transitions[0].core).toBe("pending");
  });

  it("recusada, com erro ou sem resposta não foi aplicada", () => {
    const r = joinInputConsumption("s", "s", [ui(1, true, { outcome: "refused", message: "sessão de input obsoleta", generation: null, epoch: null }), ui(2, false, { outcome: "requested", generation: null, epoch: null })], backend([]));
    expect(r.transitions.map((t) => [t.outcome, t.core, t.message])).toEqual([["refused", "not_applied", "sessão de input obsoleta"], ["requested", "not_applied", null]]);
  });

  it("época diferente ou geração fora do anel do backend: desconhecido, nunca atribuído a outra transição", () => {
    const outraEpoca = joinInputConsumption("s", "s", [ui(1, true, { epoch: 6 })], backend([core(1, true)]));
    expect(outraEpoca.transitions[0].core).toBe("unknown");
    const foraDoAnel = joinInputConsumption("s", "s", [ui(1, true)], backend([core(90, true)]));
    expect(foraDoAnel.transitions[0].core).toBe("unknown");
  });

  it("sessão trocada durante a leitura: a junção é recusada; transições de outra sessão não entram", () => {
    expect(joinInputConsumption("s", "t", [ui(1, true)], backend([core(1, true)]))).toMatchObject({ ok: false, transitions: [] });
    expect(joinInputConsumption(null, null, [ui(1, true)], backend([core(1, true)])).ok).toBe(false);
    const r = joinInputConsumption("s", "s", [ui(1, true, { sessionId: "antiga" }), ui(2, false)], backend([core(1, true), core(2, false)]));
    expect(r.transitions.map((t) => t.seq)).toEqual([2]);
  });
});
