import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isCardEditableParam } from "./NodeGraphEditor";
import RomValueInput from "./RomValueInput";
import { deserializeNodeGraph } from "../../core/nodegraph/nodeDefinitions";
import { readFileSync } from "node:fs";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const input = () => container.querySelector("[data-testid='v']") as HTMLInputElement;
function type(value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); });
}

describe("RomValueInput", () => {
  it("aceita negativos digitando; '-' sozinho não vira 0; só confirma inteiros", () => {
    const commit = vi.fn();
    act(() => root.render(<RomValueInput testId="v" label="x" value={-1024} faixa="-32767..-1" onCommit={commit} />));
    type("-");
    expect(commit).not.toHaveBeenCalled();
    expect(input().value).toBe("-");
    type("-1536");
    expect(commit).toHaveBeenLastCalledWith(-1536);
    type("12.5");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("fora da faixa é confirmado (a ponte mostra o problema) e marcado inválido; não corrige em silêncio", () => {
    const commit = vi.fn();
    act(() => root.render(<RomValueInput testId="v" label="x" value={-1024} faixa="-32767..-1" onCommit={commit} />));
    type("5");
    expect(commit).toHaveBeenLastCalledWith(5);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    type("-5");
    expect(input().getAttribute("aria-invalid")).toBe("false");
  });

  it("ao perder o foco com texto inválido volta ao valor do grafo; valor externo novo atualiza o campo", () => {
    const commit = vi.fn();
    act(() => root.render(<RomValueInput testId="v" label="x" value={7} faixa="1..32767" onCommit={commit} />));
    type("abc");
    act(() => { input().dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(input().value).toBe("7");
    act(() => root.render(<RomValueInput testId="v" label="x" value={9} faixa="1..32767" onCommit={commit} />));
    expect(input().value).toBe("9");
  });

  it("o cartão só trata como editável o var_set marcado como editável pela ponte", () => {
    const g = deserializeNodeGraph(readFileSync("data/rex_profiles/integration_20261007/grafos-gerados/grafo-s1-1340c.nodegraph.json", "utf8"));
    const imp = g.nodes.find((n) => n.params.campo === "imp")!;
    const vel = g.nodes.find((n) => n.id === "vel")!;
    expect(isCardEditableParam(imp, "value")).toBe(true);
    expect(isCardEditableParam(imp, "var_name")).toBe(false);
    expect(isCardEditableParam(vel, "value")).toBe(false);
  });
});
