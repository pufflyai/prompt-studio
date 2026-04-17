import { describe, expect, test } from "bun:test";
import type { ActionInput, PluginDefinition } from "@pstdio/sdk/plugins";
import { createPluginRegistry } from "./registry";
import type { LoadedPlugin } from "./types";

const makePlugin = (identity: string, overrides: Partial<PluginDefinition> = {}): LoadedPlugin => ({
  identity,
  filePath: `/plugins/${identity}.ts`,
  definition: {
    ...overrides,
  },
});

const makeAction = (overrides: Record<string, unknown> = {}): ActionInput =>
  ({
    key: "default",
    label: "Default",
    targetType: "ticket",
    placement: "primary",
    trigger() {},
    ...overrides,
  }) as ActionInput;

describe("createPluginRegistry", () => {
  describe("getActions", () => {
    test("returns empty array when no plugins have actions", () => {
      const registry = createPluginRegistry([makePlugin("no-actions")]);
      expect(registry.getActions()).toEqual([]);
    });

    test("returns namespaced action descriptors", () => {
      const registry = createPluginRegistry([
        makePlugin("my-plugin", {
          actions: [makeAction({ key: "do-thing", label: "Do thing" })],
        }),
      ]);

      const actions = registry.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]!.key).toBe("my-plugin/do-thing");
      expect(actions[0]!.label).toBe("Do thing");
    });

    test("includes params in action descriptors", () => {
      const params = [
        { key: "name", label: "Name", type: "text" as const },
        { key: "agent", label: "Agent", type: "agent" as const },
      ];
      const registry = createPluginRegistry([
        makePlugin("p", {
          actions: [makeAction({ key: "with-params", label: "With params", params })],
        }),
      ]);

      const actions = registry.getActions();
      expect(actions[0]!.params).toEqual(params);
    });

    test("filters by target type", () => {
      const registry = createPluginRegistry([
        makePlugin("p", {
          actions: [
            makeAction({ key: "a", label: "A", targetType: "ticket" }),
            makeAction({ key: "b", label: "B", targetType: "workspace" }),
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
          actions: [makeAction({ key: "run", label: "Run", trigger })],
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
      const registry = createPluginRegistry([
        makePlugin("my-plugin", { hooks: { preTicketCreation: () => undefined } }),
      ]);

      const handlers = registry.getHookHandlers("preTicketCreation");
      expect(handlers[0]!.pluginIdentity).toBe("my-plugin");
    });
  });

  describe("duplicate action keys", () => {
    test("throws on duplicate namespaced action keys across plugins", () => {
      expect(() =>
        createPluginRegistry([
          makePlugin("a", { actions: [makeAction({ key: "run", label: "Run" })] }),
          makePlugin("a", { actions: [makeAction({ key: "run", label: "Run 2" })] }),
        ]),
      ).toThrow("Duplicate action key");
    });
  });

  describe("getSchedules", () => {
    test("returns empty array when no plugins have schedules", () => {
      const registry = createPluginRegistry([makePlugin("no-schedules")]);
      expect(registry.getSchedules()).toEqual([]);
    });

    test("returns namespaced schedule entries", () => {
      const registry = createPluginRegistry([
        makePlugin("my-plugin", {
          schedules: [{ name: "daily-sync", cron: "0 9 * * *", trigger: async () => {} }],
        }),
      ]);

      const schedules = registry.getSchedules();
      expect(schedules).toHaveLength(1);
      expect(schedules[0]!.compositeKey).toBe("my-plugin/daily-sync");
      expect(schedules[0]!.pluginIdentity).toBe("my-plugin");
      expect(schedules[0]!.scheduleName).toBe("daily-sync");
      expect(schedules[0]!.cron).toBe("0 9 * * *");
    });

    test("collects schedules from multiple plugins", () => {
      const registry = createPluginRegistry([
        makePlugin("a", {
          schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {} }],
        }),
        makePlugin("b", {
          schedules: [{ name: "cleanup", cron: "0 0 * * *", trigger: async () => {} }],
        }),
      ]);

      const schedules = registry.getSchedules();
      expect(schedules).toHaveLength(2);
    });
  });

  describe("getSchedule", () => {
    test("returns schedule entry by composite key", () => {
      const trigger = async () => {};
      const registry = createPluginRegistry([
        makePlugin("my-plugin", {
          schedules: [{ name: "sync", cron: "0 9 * * *", trigger }],
        }),
      ]);

      const entry = registry.getSchedule("my-plugin/sync");
      expect(entry).toBeDefined();
      expect(entry!.trigger).toBe(trigger);
      expect(entry!.pluginIdentity).toBe("my-plugin");
    });

    test("returns undefined for unknown key", () => {
      const registry = createPluginRegistry([]);
      expect(registry.getSchedule("nope")).toBeUndefined();
    });
  });

  describe("duplicate schedule keys", () => {
    test("throws on duplicate composite key across plugins", () => {
      expect(() =>
        createPluginRegistry([
          makePlugin("a", {
            schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {} }],
          }),
          makePlugin("a", {
            schedules: [{ name: "sync", cron: "0 18 * * *", trigger: async () => {} }],
          }),
        ]),
      ).toThrow('Duplicate schedule key "a/sync"');
    });
  });
});
