import { describe, expect, test } from "bun:test";
import {
  type CommandPaletteResourceResult,
  createCommandPaletteResourceRegistry,
} from "./command-palette-resource-registry";

const result = (id: string): CommandPaletteResourceResult => ({ id, label: id, activate: () => {} });

describe("createCommandPaletteResourceRegistry", () => {
  test("registers and lists providers", () => {
    const registry = createCommandPaletteResourceRegistry();
    registry.registerProvider({ id: "a", title: "A", query: async () => [] });
    expect(registry.listProviders().map((provider) => provider.id)).toEqual(["a"]);
  });

  test("throws on duplicate provider id", () => {
    const registry = createCommandPaletteResourceRegistry();
    registry.registerProvider({ id: "a", title: "A", query: async () => [] });
    expect(() => registry.registerProvider({ id: "a", title: "A2", query: async () => [] })).toThrow();
  });

  test("unregisters via disposable", () => {
    const registry = createCommandPaletteResourceRegistry();
    const disposable = registry.registerProvider({ id: "a", title: "A", query: async () => [] });
    disposable.dispose();
    expect(registry.listProviders()).toEqual([]);
  });

  test("queries providers and aggregates results per provider", async () => {
    const registry = createCommandPaletteResourceRegistry();
    const s1 = result("s1");
    const s2 = result("s2");
    registry.registerProvider({ id: "slides", title: "Slides", query: async () => [s1, s2] });

    const results = await registry.queryProviders({ query: "intro", limit: 10 });

    expect(results).toEqual([{ providerId: "slides", title: "Slides", results: [s1, s2] }]);
  });

  test("isolates a failing provider so peers still return results", async () => {
    const registry = createCommandPaletteResourceRegistry();
    const ok = result("a");
    registry.registerProvider({ id: "ok", title: "Ok", query: async () => [ok] });
    registry.registerProvider({
      id: "boom",
      title: "Boom",
      query: async () => {
        throw new Error("provider exploded");
      },
    });

    const results = await registry.queryProviders({ query: "x", limit: 5 });

    expect(results).toEqual([
      { providerId: "ok", title: "Ok", results: [ok] },
      { providerId: "boom", title: "Boom", results: [] },
    ]);
  });

  test("refresh bumps the refresh token", () => {
    const registry = createCommandPaletteResourceRegistry();
    const before = registry.store.getState().refreshToken;
    registry.refresh();
    expect(registry.store.getState().refreshToken).toBe(before + 1);
  });
});
