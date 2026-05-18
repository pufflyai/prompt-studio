import { describe, expect, test } from "bun:test";
import { createDataRendererRegistry } from "./data-renderer-registry";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

const createRegistry = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  const data = createDataRendererRegistry({ rendererRegistry });
  return { rendererRegistry, data };
};

describe("createDataRendererRegistry", () => {
  test("stores the contribution and auto-registers a widget renderer with the same id", () => {
    const { rendererRegistry, data } = createRegistry();

    data.registerDataRenderer({
      id: "tickets",
      title: "Tickets",
      executeQuery: () => [],
    });

    expect(data.getDataRenderer("tickets")?.title).toBe("Tickets");
    expect(rendererRegistry.getRenderer("tickets")).toBeDefined();
  });

  test("invokes the data renderer implementation when the widget renderer renders", () => {
    const { rendererRegistry, data } = createRegistry();
    const calls: { dataRendererId: string }[] = [];
    data.setDataRendererImplementation((input) => {
      calls.push({ dataRendererId: input.dataRendererId });
      return null;
    });

    data.registerDataRenderer({
      id: "tickets",
      title: "Tickets",
      executeQuery: () => [],
    });

    const renderer = rendererRegistry.getRenderer("tickets");
    if (!renderer || renderer.keepAlive) throw new Error("expected non-keep-alive renderer");
    renderer.render({} as Parameters<typeof renderer.render>[0]);

    expect(calls).toEqual([{ dataRendererId: "tickets" }]);
  });

  test("unregisters the data renderer and its auto-registered widget renderer together", () => {
    const { rendererRegistry, data } = createRegistry();

    const disposable = data.registerDataRenderer({
      id: "tickets",
      title: "Tickets",
      executeQuery: () => [],
    });

    expect(rendererRegistry.getRenderer("tickets")).toBeDefined();
    disposable.dispose();
    expect(rendererRegistry.getRenderer("tickets")).toBeUndefined();
    expect(data.getDataRenderer("tickets")).toBeUndefined();
  });

  test("throws when registering a data renderer with a duplicate id", () => {
    const { data } = createRegistry();

    data.registerDataRenderer({ id: "tickets", title: "Tickets", executeQuery: () => [] });

    expect(() => data.registerDataRenderer({ id: "tickets", title: "Tickets", executeQuery: () => [] })).toThrow(
      "Data renderer already registered: tickets",
    );
  });

  test("returns registered data renderers sorted by priority", () => {
    const { data } = createRegistry();

    data.registerDataRenderer({ id: "low", title: "Low", executeQuery: () => [] }, { priority: 10 });
    data.registerDataRenderer({ id: "high", title: "High", executeQuery: () => [] }, { priority: 100 });

    expect(data.listDataRenderers().map((r) => r.id)).toEqual(["high", "low"]);
  });
});
