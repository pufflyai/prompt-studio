import { describe, expect, test } from "bun:test";
import { createControlsRendererRegistry } from "./controls-renderer-registry";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

const createRegistry = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  const controls = createControlsRendererRegistry({ rendererRegistry });
  return { rendererRegistry, controls };
};

describe("createControlsRendererRegistry", () => {
  test("stores the contribution and auto-registers a widget renderer with the same id", () => {
    const { rendererRegistry, controls } = createRegistry();

    controls.registerControlsRenderer({
      id: "ticketControls",
      title: "Ticket controls",
      executeQuery: () => ({}),
    });

    expect(controls.getControlsRenderer("ticketControls")?.title).toBe("Ticket controls");
    expect(rendererRegistry.getRenderer("ticketControls")).toBeDefined();
  });

  test("invokes the controls renderer implementation when the widget renderer renders", () => {
    const { rendererRegistry, controls } = createRegistry();
    const calls: { controlsRendererId: string }[] = [];
    controls.setControlsRendererImplementation((input) => {
      calls.push({ controlsRendererId: input.controlsRendererId });
      return null;
    });

    controls.registerControlsRenderer({
      id: "ticketControls",
      title: "Ticket controls",
      executeQuery: () => ({}),
    });

    const renderer = rendererRegistry.getRenderer("ticketControls");
    if (!renderer || renderer.keepAlive) throw new Error("expected non-keep-alive renderer");
    renderer.render({} as Parameters<typeof renderer.render>[0]);

    expect(calls).toEqual([{ controlsRendererId: "ticketControls" }]);
  });

  test("unregisters the controls renderer and its auto-registered widget renderer together", () => {
    const { rendererRegistry, controls } = createRegistry();

    const disposable = controls.registerControlsRenderer({
      id: "ticketControls",
      title: "Ticket controls",
      executeQuery: () => ({}),
    });

    expect(rendererRegistry.getRenderer("ticketControls")).toBeDefined();
    disposable.dispose();
    expect(rendererRegistry.getRenderer("ticketControls")).toBeUndefined();
    expect(controls.getControlsRenderer("ticketControls")).toBeUndefined();
  });

  test("throws when registering a controls renderer with a duplicate id", () => {
    const { controls } = createRegistry();

    controls.registerControlsRenderer({ id: "ticketControls", title: "Ticket controls", executeQuery: () => ({}) });

    expect(() =>
      controls.registerControlsRenderer({ id: "ticketControls", title: "Ticket controls", executeQuery: () => ({}) }),
    ).toThrow("Controls renderer already registered: ticketControls");
  });

  test("returns registered controls renderers sorted by priority", () => {
    const { controls } = createRegistry();

    controls.registerControlsRenderer({ id: "low", title: "Low", executeQuery: () => ({}) }, { priority: 10 });
    controls.registerControlsRenderer({ id: "high", title: "High", executeQuery: () => ({}) }, { priority: 100 });

    expect(controls.listControlsRenderers().map((renderer) => renderer.id)).toEqual(["high", "low"]);
  });

  test("notifies controls renderer refresh listeners", () => {
    const { controls } = createRegistry();
    const refreshed: string[] = [];
    controls.registerControlsRenderer({ id: "ticketControls", title: "Ticket controls", executeQuery: () => ({}) });
    controls.onDidRefreshControlsRenderer((event) => refreshed.push(event.controlsRendererId));

    controls.refreshControlsRenderer("ticketControls");

    expect(refreshed).toEqual(["ticketControls"]);
  });
});
