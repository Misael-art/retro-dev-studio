import { describe, expect, it } from "vitest";

import { rexBridgeItems, rexInstanceKey } from "./rexBridge";
import type { RexProfileLocateResponse } from "./ipc/toolsService";

const response = {
  request_id: "r",
  app_session: "s",
  rom_sha256: "sonic",
  rom_size: 1,
  rejected: [],
  limites: [],
  matches: [
    {
      profile: { id: "sonic1.copy_grid", sha256: "p", title: "Cópia em grade", status: "demonstrado", class: "signature" },
      instances: [{ instance_offset: 0x1b6f8, selection: { mode: "signature", label: "assinatura" } }],
      rejected_by_constraint: 0,
      bound: true,
      error: null,
    },
    { profile: { id: "other", sha256: "q", title: "Outro", status: "x" }, instances: [], rejected_by_constraint: 0, bound: false, error: null },
  ],
} as unknown as RexProfileLocateResponse;

describe("rexBridge", () => {
  it("lists only located instances with stable keys", () => {
    const items = rexBridgeItems(response, "sonic");
    expect(Array.isArray(items) && items.map((i) => i.key)).toEqual([rexInstanceKey("sonic1.copy_grid", 0x1b6f8)]);
    expect(rexInstanceKey("p", 255)).toBe("p@0xff");
  });

  it("refuses a locate result from another ROM", () => {
    expect(rexBridgeItems(response, "other-rom")).toEqual({ error: expect.stringContaining("outra ROM") });
    expect(rexBridgeItems(response, null)).toMatchObject({ error: expect.any(String) });
  });
});
