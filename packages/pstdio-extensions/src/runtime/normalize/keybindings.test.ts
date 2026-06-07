import { describe, expect, test } from "bun:test";
import { commandRef, defineExtension } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("registerKeybindings", () => {
  test("registers a keybinding with a resolved command ref", () => {
    const lab = defineExtension({
      commands: {
        "say-hello": { title: "Say hello", run: async () => undefined },
      },
      keybindings: {
        "say-hello": {
          key: "mod+shift+h",
          command: commandRef("lab.say-hello"),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings).toHaveLength(1);
    expect(runtime.keybindings[0]).toMatchObject({
      id: "lab.say-hello",
      localId: "say-hello",
      extensionId: "pstdio.lab",
      name: "lab",
      commandId: "lab.say-hello",
      key: "mod+shift+h",
      chordId: "mod+shift+H",
    });
  });

  test("accepts platform overrides and when predicates", () => {
    const lab = defineExtension({
      commands: { ping: { title: "Ping", run: async () => undefined } },
      keybindings: {
        ping: {
          key: "mod+p",
          mac: "cmd+p",
          win: "ctrl+p",
          when: { resourceType: ["lab.slide"] },
          command: "lab.ping",
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings[0]).toMatchObject({
      mac: "cmd+p",
      win: "ctrl+p",
      when: { resourceType: ["lab.slide"] },
    });
  });

  test("flags unknown command refs", () => {
    const lab = defineExtension({
      commands: { ping: { title: "Ping", run: async () => undefined } },
      keybindings: {
        ghost: { key: "mod+g", command: "lab.does-not-exist" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.keybindings).toHaveLength(0);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("unknown_keybinding_command");
  });

  test("rejects invalid chord strings", () => {
    const lab = defineExtension({
      commands: { ping: { title: "Ping", run: async () => undefined } },
      keybindings: {
        ping: { key: "hyper+xyz", command: "lab.ping" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.keybindings).toHaveLength(0);
    const codes = runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("invalid_keybinding");
  });

  test("drops conflicting chord in the same context so only the first binding fires", () => {
    const lab = defineExtension({
      commands: {
        ping: { title: "Ping", run: async () => undefined },
        pong: { title: "Pong", run: async () => undefined },
      },
      keybindings: {
        ping: { key: "mod+k", command: "lab.ping" },
        pong: { key: "mod+k", command: "lab.pong" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.keybindings.map((k) => k.id)).toEqual(["lab.ping"]);
    const conflict = runtime.diagnostics.find((d) => d.code === "duplicate_keybinding_chord");
    expect(conflict?.severity).toBe("warning");
    expect(conflict?.metadata?.conflictsWithId).toBe("lab.ping");
  });

  test("allows same chord under different when contexts", () => {
    const lab = defineExtension({
      commands: {
        next: { title: "Next", run: async () => undefined },
        confirm: { title: "Confirm", run: async () => undefined },
      },
      keybindings: {
        next: { key: "mod+enter", command: "lab.next", when: { mode: "preview" } },
        confirm: { key: "mod+enter", command: "lab.confirm", when: { mode: "edit" } },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings).toHaveLength(2);
  });

  test("flags duplicate keybinding ids across the same extension definition", () => {
    const a = defineExtension({
      commands: { ping: { title: "Ping", run: async () => undefined } },
      keybindings: { "do-it": { key: "mod+1", command: "lab.ping" } },
    });
    const b = defineExtension({
      commands: { ping: { title: "Ping", run: async () => undefined } },
      keybindings: { "do-it": { key: "mod+1", command: "lab.ping" } },
    });

    const runtime = normalizeExtensionSources([wrap("lab", a), wrap("lab", b)]);
    const codes = runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("duplicate_keybinding_id");
  });
});
