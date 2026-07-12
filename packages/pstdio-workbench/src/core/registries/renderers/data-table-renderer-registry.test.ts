import { describe, expect, test } from "bun:test";
import { createDataTableRendererRegistry } from "./data-table-renderer-registry";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

const createRegistry = () => {
  const rendererRegistry = createWorkbenchRendererRegistry({ createHost: () => ({}) as HTMLElement });
  const tables = createDataTableRendererRegistry({ rendererRegistry });
  return { rendererRegistry, tables };
};

describe("createDataTableRendererRegistry", () => {
  test("stores a contribution and auto-registers a widget renderer", () => {
    const { rendererRegistry, tables } = createRegistry();
    tables.registerDataTableRenderer({ id: "health", title: "Health", executeQuery: () => ({ rows: [] }) }, undefined);

    expect(tables.getDataTableRenderer("health")?.title).toBe("Health");
    expect(rendererRegistry.getRenderer("health")).toBeDefined();
  });

  test("delegates rendering to the installed implementation", () => {
    const { rendererRegistry, tables } = createRegistry();
    const calls: string[] = [];
    tables.setDataTableRendererImplementation((input) => calls.push(input.dataTableRendererId));
    tables.registerDataTableRenderer({ id: "health", title: "Health", executeQuery: () => ({ rows: [] }) }, undefined);

    const renderer = rendererRegistry.getRenderer("health");
    if (!renderer || renderer.keepAlive) throw new Error("expected a widget renderer");
    renderer.render({} as Parameters<typeof renderer.render>[0]);

    expect(calls).toEqual(["health"]);
  });

  test("rejects duplicate ids and sorts contributions by priority", () => {
    const { tables } = createRegistry();
    tables.registerDataTableRenderer({ id: "low", title: "Low", executeQuery: () => ({ rows: [] }) }, { priority: 10 });
    tables.registerDataTableRenderer(
      { id: "high", title: "High", executeQuery: () => ({ rows: [] }) },
      { priority: 100 },
    );

    expect(tables.listDataTableRenderers().map((renderer) => renderer.id)).toEqual(["high", "low"]);
    expect(() =>
      tables.registerDataTableRenderer(
        { id: "low", title: "Duplicate", executeQuery: () => ({ rows: [] }) },
        undefined,
      ),
    ).toThrow("Data table renderer already registered: low");
  });

  test("emits refresh events and disposes the specialized and widget registrations", () => {
    const { rendererRegistry, tables } = createRegistry();
    const refreshed: string[] = [];
    const disposable = tables.registerDataTableRenderer(
      {
        id: "health",
        title: "Health",
        executeQuery: () => ({ rows: [] }),
      },
      undefined,
    );
    tables.onDidRefreshDataTableRenderer((event) => refreshed.push(event.dataTableRendererId));

    tables.refreshDataTableRenderer("health");
    disposable.dispose();

    expect(refreshed).toEqual(["health"]);
    expect(tables.getDataTableRenderer("health")).toBeUndefined();
    expect(rendererRegistry.getRenderer("health")).toBeUndefined();
  });
});
