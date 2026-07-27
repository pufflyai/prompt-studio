import { describe, expect, test } from "bun:test";
import type { AttributeDescriptor } from "./kanban-renderer-contracts";
import { createKanbanRendererRegistry } from "./kanban-renderer-registry";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

const createRegistry = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  const data = createKanbanRendererRegistry({ rendererRegistry });
  return { rendererRegistry, data };
};

describe("createKanbanRendererRegistry", () => {
  test("stores the contribution and auto-registers a widget renderer with the same id", () => {
    const { rendererRegistry, data } = createRegistry();

    data.registerKanbanRenderer({
      id: "tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });

    expect(data.getKanbanRenderer("tickets")?.title).toBe("Tickets");
    expect(rendererRegistry.getRenderer("tickets")).toBeDefined();
  });

  test("invokes the kanban renderer implementation when the widget renderer renders", () => {
    const { rendererRegistry, data } = createRegistry();
    const calls: { kanbanRendererId: string }[] = [];
    data.setKanbanRendererImplementation((input) => {
      calls.push({ kanbanRendererId: input.kanbanRendererId });
      return null;
    });

    data.registerKanbanRenderer({
      id: "tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });

    const renderer = rendererRegistry.getRenderer("tickets");
    if (!renderer || renderer.keepAlive) throw new Error("expected non-keep-alive renderer");
    renderer.render({} as Parameters<typeof renderer.render>[0]);

    expect(calls).toEqual([{ kanbanRendererId: "tickets" }]);
  });

  test("unregisters the kanban renderer and its auto-registered widget renderer together", () => {
    const { rendererRegistry, data } = createRegistry();

    const disposable = data.registerKanbanRenderer({
      id: "tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });

    expect(rendererRegistry.getRenderer("tickets")).toBeDefined();
    disposable.dispose();
    expect(rendererRegistry.getRenderer("tickets")).toBeUndefined();
    expect(data.getKanbanRenderer("tickets")).toBeUndefined();
  });

  test("throws when registering a kanban renderer with a duplicate id", () => {
    const { data } = createRegistry();

    data.registerKanbanRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] });

    expect(() =>
      data.registerKanbanRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] }),
    ).toThrow("Kanban renderer already registered: tickets");
  });

  test("returns registered kanban renderers sorted by priority", () => {
    const { data } = createRegistry();

    data.registerKanbanRenderer({ id: "low", title: "Low", attributes: [], executeQuery: () => [] }, { priority: 10 });
    data.registerKanbanRenderer(
      { id: "high", title: "High", attributes: [], executeQuery: () => [] },
      { priority: 100 },
    );

    expect(data.listKanbanRenderers().map((r) => r.id)).toEqual(["high", "low"]);
  });

  test("accepts an AttributesSource for the schema instead of a static array", () => {
    const { data } = createRegistry();
    const snapshot: AttributeDescriptor[] = [
      { id: "status", label: "Status", type: { kind: "enum", options: [{ value: "todo", label: "Todo" }] } },
    ];

    data.registerKanbanRenderer({
      id: "schema",
      title: "Schema",
      attributes: {
        subscribe: () => () => {},
        getSnapshot: () => snapshot,
      },
      executeQuery: () => [],
    });

    const registered = data.getKanbanRenderer("schema");
    if (!registered) throw new Error("expected the contribution to be registered");
    if (Array.isArray(registered.attributes)) throw new Error("expected a source");
    expect(registered.attributes.getSnapshot()).toBe(snapshot);
  });

  test("notifies kanban renderer refresh listeners", () => {
    const { data } = createRegistry();
    const refreshed: string[] = [];
    data.registerKanbanRenderer({ id: "tickets", title: "Tickets", attributes: [], executeQuery: () => [] });
    data.onDidRefreshKanbanRenderer((event) => refreshed.push(event.kanbanRendererId));

    data.refreshKanbanRenderer("tickets");

    expect(refreshed).toEqual(["tickets"]);
  });
});
