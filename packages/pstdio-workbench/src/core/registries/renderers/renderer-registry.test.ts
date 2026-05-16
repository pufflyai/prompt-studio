import { describe, expect, test } from "bun:test";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

describe("createWorkbenchRendererRegistry", () => {
  test("registers and resolves widget renderers by id", () => {
    const registry = createWorkbenchRendererRegistry();
    const render = () => null;

    registry.registerRenderer({ id: "project.settings", render });

    expect(registry.getRenderer("project.settings")?.render).toBe(render);
  });

  test("allows renderer replacement after dispose", () => {
    const registry = createWorkbenchRendererRegistry();
    const first = registry.registerRenderer({ id: "project.settings", render: () => "first" });

    expect(() => registry.registerRenderer({ id: "project.settings", render: () => "second" })).toThrow(
      "Renderer already registered: project.settings",
    );

    first.dispose();
    registry.registerRenderer({ id: "project.settings", render: () => "second" });

    expect(registry.getRenderer("project.settings")?.render({} as never)).toBe("second");
  });
});
