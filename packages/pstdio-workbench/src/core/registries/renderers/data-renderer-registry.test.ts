import { describe, expect, test } from "bun:test";
import type { AttributeDescriptor } from "./data-renderer-contracts";
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
      attributes: [],
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
      attributes: [],
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
      attributes: [],
      executeQuery: () => [],
    });

    expect(rendererRegistry.getRenderer("tickets")).toBeDefined();
    disposable.dispose();
    expect(rendererRegistry.getRenderer("tickets")).toBeUndefined();
    expect(data.getDataRenderer("tickets")).toBeUndefined();
  });

  test("throws when registering a data renderer with a duplicate id", () => {
    const { data } = createRegistry();

    data.registerDataRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] });

    expect(() =>
      data.registerDataRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] }),
    ).toThrow("Data renderer already registered: tickets");
  });

  test("returns registered data renderers sorted by priority", () => {
    const { data } = createRegistry();

    data.registerDataRenderer({ id: "low", title: "Low", attributes: [], executeQuery: () => [] }, { priority: 10 });
    data.registerDataRenderer({ id: "high", title: "High", attributes: [], executeQuery: () => [] }, { priority: 100 });

    expect(data.listDataRenderers().map((r) => r.id)).toEqual(["high", "low"]);
  });

  test("accepts an AttributesSource for the schema instead of a static array", () => {
    const { data } = createRegistry();
    const snapshot: AttributeDescriptor[] = [
      { id: "status", label: "Status", type: { kind: "enum", options: [{ value: "todo", label: "Todo" }] } },
    ];

    data.registerDataRenderer({
      id: "schema",
      title: "Schema",
      attributes: {
        subscribe: () => () => {},
        getSnapshot: () => snapshot,
      },
      executeQuery: () => [],
    });

    const registered = data.getDataRenderer("schema");
    if (!registered) throw new Error("expected the contribution to be registered");
    if (Array.isArray(registered.attributes)) throw new Error("expected a source");
    expect(registered.attributes.getSnapshot()).toBe(snapshot);
  });

  test("notifies data renderer refresh listeners", () => {
    const { data } = createRegistry();
    const refreshed: string[] = [];
    data.registerDataRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] });
    data.onDidRefreshDataRenderer((event) => refreshed.push(event.dataRendererId));

    data.refreshDataRenderer("tickets");

    expect(refreshed).toEqual(["tickets"]);
  });
});
