import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "./editorStore";

/**
 * Observação de input por sessão e sequência. Os testes controlam a ORDEM das resoluções (não há relógio):
 * cada `recordJoypadAck` é a resolução da promise do IPC daquela sequência.
 */
const S = "sessao-1";
const down = { a: true };
const up = { a: false };

function log() {
  return (useEditorStore.getState() as unknown as { joypadLog?: { sessionId: string; seq: number; outcome: string; joypad: Record<string, boolean>; generation?: number | null; appliedAtFrame?: number | null }[] }).joypadLog ?? [];
}

beforeEach(() => {
  useEditorStore.getState().beginJoypadSessionHold();
  useEditorStore.setState({ joypadSessionId: S, joypadSessionHold: false });
});

describe("observação de input: aceitação pelo backend, por sessão e sequência", () => {
  it("H1 — soltura solicitada antes do ACK do aperto: o estado ATUAL não regride, mas o aperto fica registrado como aceito", () => {
    const st = useEditorStore.getState();
    st.recordJoypadRequest(S, 1, down);
    st.recordJoypadRequest(S, 2, up); // a soltura chega antes de o backend responder ao aperto
    st.recordJoypadAck(S, 1, down); // ACK do aperto, atrasado
    // proteção preservada: um ACK antigo não substitui o estado atual
    expect(useEditorStore.getState().lastJoypadAck).toBeNull();
    st.recordJoypadAck(S, 2, up);
    expect(useEditorStore.getState().lastJoypadAck).toEqual({ sessionId: S, seq: 2, joypad: up });
    // ...e ainda assim o aperto FOI aceito pelo backend: a observação por sequência tem de dizê-lo
    expect(log().map((t) => [t.seq, t.outcome, t.joypad.a])).toEqual([[1, "accepted", true], [2, "accepted", false]]);
  });

  it("H2 — um observador que lê só o último ACK depois das duas confirmações nunca vê o aperto; o registro por sequência vê", () => {
    const st = useEditorStore.getState();
    st.recordJoypadRequest(S, 1, down);
    st.recordJoypadAck(S, 1, down);
    st.recordJoypadRequest(S, 2, up);
    st.recordJoypadAck(S, 2, up);
    // a leitura única do "último ACK" (o que a jornada amostrava) só mostra a soltura
    expect(useEditorStore.getState().lastJoypadAck?.joypad.a).toBe(false);
    expect(log().filter((t) => t.joypad.a && t.outcome === "accepted").map((t) => t.seq)).toEqual([1]);
  });

  it("recusa e erro ficam registrados na sequência certa, sem virar aceitação", () => {
    const st = useEditorStore.getState();
    st.recordJoypadRequest(S, 1, down);
    st.recordJoypadRequest(S, 2, up);
    st.recordJoypadSendError(S, 1, "sessão de input obsoleta");
    st.recordJoypadAck(S, 2, up);
    expect(log().map((t) => [t.seq, t.outcome])).toEqual([[1, "refused"], [2, "accepted"]]);
  });

  it("época/sessão: confirmação de outra sessão não entra, e a troca de sessão zera o registro", () => {
    const st = useEditorStore.getState();
    st.recordJoypadRequest(S, 1, down);
    st.recordJoypadAck("sessao-antiga", 1, down);
    expect(log().map((t) => t.outcome)).toEqual(["requested"]);
    st.beginJoypadSessionHold();
    expect(log()).toEqual([]);
    useEditorStore.setState({ joypadSessionId: "sessao-2", joypadSessionHold: false });
    st.recordJoypadAck(S, 1, down); // ACK que atravessou a recarga
    expect(log()).toEqual([]);
    expect(useEditorStore.getState().lastJoypadAck).toBeNull();
  });

  it("o registro é limitado: guarda só as transições mais recentes", () => {
    const st = useEditorStore.getState();
    for (let seq = 1; seq <= 200; seq += 1) st.recordJoypadRequest(S, seq, seq % 2 ? down : up);
    expect(log().length).toBeLessThanOrEqual(64);
    expect(log()[log().length - 1]?.seq).toBe(200);
  });
});
