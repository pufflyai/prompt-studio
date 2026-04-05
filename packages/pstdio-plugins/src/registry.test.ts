import { describe, expect, test } from "bun:test";
import { createPluginRegistry } from "./registry";
import type { LoadedPlugin } from "./types";

const makePlugin = (identity: string, overrides: Partial<LoadedPlugin["definition"]> = {}): LoadedPlugin => ({
  identity,
  filePath: `/plugins/${identity}.ts`,
  definition: {
    ...overrides,
  },
});

describe("createPluginRegistry", () => {
  describe("getActions", () => {
    test("returns empty array when no plugins have actions", () => {
      const registry = createPluginRegistry([makePlugin("no-actions")]);
      expect(registry.getActions()).toEqual([]);
    });

    test("returns namespaced action descriptors", () => {
      const registry = createPluginRegistry([
        makePlugin("my-plugin", {
          actions: [
            {
              key: "do-thing",
              label: "Do thing",
              targetType: "ticket",
              placement: "primary",
              trigger() {},
            },
          ],
        }),
      ]);

      const actions = registry.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]!.key).toBe("my-plugin/do-thing");
      expect(actions[0]!.label).toBe("Do thing");
    });

    test("filters by target type", () => {
      const registry = createPluginRegistry([
        makePlugin("p", {
          actions: [
            { key: "a", label: "A", targetType: "ticket", placement: "primary", trigger() {} },
            { key: "b", label: "B", targetType: "workspace", placement: "primary", trigger() {} },
          ],
        }),
      ]);

      const ticketActions = registry.getActions("ticket");
      expect(ticketActions).toHaveLength(1);
      expect(ticketActions[0]!.key).toBe("p/a");
    });
  });

  describe("getAction", () => {
    test("returns resolved action by namespaced key", () => {
      const trigger = () => {};
      const registry = createPluginRegistry([
        makePlugin("my-plugin", {
          actions: [{ key: "run", label: "Run", targetType: "ticket", placement: "primary", trigger }],
        }),
      ]);

      const action = registry.getAction("my-plugin/run");
      expect(action).toBeDefined();
      expect(action!.trigger).toBe(trigger);
      expect(action!.pluginIdentity).toBe("my-plugin");
    });

    test("returns undefined for unknown key", () => {
      const registry = createPluginRegistry([]);
      expect(registry.getAction("nope")).toBeUndefined();
    });
  });

  describe("getHookHandlers", () => {
    test("returns handlers from multiple plugins for same hook", () => {
      const h1 = () => {};
      const h2 = () => {};

      const registry = createPluginRegistry([
        makePlugin("a", { hooks: { postSessionStart: h1 } }),
        makePlugin("b", { hooks: { postSessionStart: h2 } }),
      ]);

      const handlers = registry.getHookHandlers("postSessionStart");
      expect(handlers).toHaveLength(2);
      expect(handlers[0]!.handler).toBe(h1);
      expect(handlers[1]!.handler).toBe(h2);
    });

    test("returns empty array when no plugins define the hook", () => {
      const registry = createPluginRegistry([makePlugin("a", { hooks: {} })]);
      expect(registry.getHookHandlers("postSessionStart")).toEqual([]);
    });

    test("includes plugin identity with each handler", () => {
      const registry = createPluginRegistry([makePlugin("my-plugin", { hooks: { preTicketCreation: () => {} } })]);

      const handlers = registry.getHookHandlers("preTicketCreation");
      expect(handlers[0]!.pluginIdentity).toBe("my-plugin");
    });
  });

  describe("duplicate action keys", () => {
    test("throws on duplicate namespaced action keys across plugins", () => {
      expect(() =>
        createPluginRegistry([
          makePlugin("a", {
            actions: [{ key: "run", label: "Run", targetType: "ticket", placement: "primary", trigger() {} }],
          }),
          makePlugin("a", {
            actions: [{ key: "run", label: "Run 2", targetType: "ticket", placement: "primary", trigger() {} }],
          }),
        ]),
      ).toThrow("Duplicate action key");
    });
  });
});
