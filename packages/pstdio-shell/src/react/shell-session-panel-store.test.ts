import { describe, expect, it } from "bun:test";
import { createShellSessionPanelStore } from "./shell-session-panel-store";

describe("createShellSessionPanelStore", () => {
  it("defaults to bubble mode", () => {
    const store = createShellSessionPanelStore();

    expect(store.getState().mode).toBe("bubble");
  });

  it("tracks closed and attached modes", () => {
    const store = createShellSessionPanelStore("closed");

    expect(store.getState().mode).toBe("closed");

    store.getState().setMode("attached");
    expect(store.getState().mode).toBe("attached");

    store.getState().setMode("bubble");
    expect(store.getState().mode).toBe("bubble");
  });
});
