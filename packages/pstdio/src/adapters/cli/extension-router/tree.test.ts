import { describe, expect, test } from "bun:test";
import type { ExtensionRuntime, RuntimeCliContribution } from "pstdio-extensions";
import { buildLoadedCliTree } from "./tree";

const cli = (
  partial: Partial<RuntimeCliContribution> & Pick<RuntimeCliContribution, "namespace" | "commandId" | "extensionId">,
): RuntimeCliContribution => ({
  path: partial.path ?? partial.commandId.split(".").slice(1),
  pathKey:
    partial.pathKey ?? `${partial.namespace} ${(partial.path ?? partial.commandId.split(".").slice(1)).join(" ")}`,
  ...partial,
});

const baseRuntime = (): ExtensionRuntime => ({
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  cli: [],
  schedules: [],
  artifactMounts: [],
  views: [],
  routes: [],
  navigation: [],
  settingsPanels: [],
  templateTypes: [],
  templates: [],
  skills: [],
  harnesses: [],
  workspaceTypes: [],
  diagnostics: [],
});

describe("buildLoadedCliTree", () => {
  test("removes namespaces that collide with static commands", () => {
    const runtime = baseRuntime();
    runtime.cli.push(
      cli({ namespace: "tickets", extensionId: "acme.tickets", commandId: "tickets.list", path: ["list"] }),
      cli({
        namespace: "lab",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.say.hello",
        path: ["say", "hello"],
      }),
    );

    const loaded = buildLoadedCliTree(runtime, new Set(["tickets"]));

    const namespaces = loaded.tree.map((root) => root.segment);
    expect(namespaces).toContain("lab");
    expect(namespaces).not.toContain("tickets");
    expect(loaded.collisions.staticCollisions).toHaveLength(1);
  });

  test("preserves all namespaces when there are no collisions", () => {
    const runtime = baseRuntime();
    runtime.cli.push(
      cli({
        namespace: "lab",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.say.hello",
        path: ["say", "hello"],
      }),
    );

    const loaded = buildLoadedCliTree(runtime, new Set(["projects"]));
    expect(loaded.tree.map((r) => r.segment)).toEqual(["lab"]);
    expect(loaded.collisions.staticCollisions).toHaveLength(0);
  });
});
