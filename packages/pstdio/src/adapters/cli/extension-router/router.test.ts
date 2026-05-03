import { describe, expect, test } from "bun:test";
import type { CliHelpNode, ExtensionRuntime } from "pstdio-extensions";
import { decideRouterIntervention, extractPositionalTokens, isPathRegistered } from "./router";
import type { LoadedCliTree } from "./tree";

const emptyRuntime = (): ExtensionRuntime => ({
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

const loadedTree = (overrides: Partial<LoadedCliTree>): LoadedCliTree => ({
  tree: [],
  runtime: emptyRuntime(),
  collisions: {
    duplicateCliPaths: [],
    staticCollisions: [],
    refusedPathKeys: new Set(),
    blockedNamespaces: new Set(),
  },
  staticNames: new Set(["tickets", "extensions", "projects"]),
  ...overrides,
});

const labRoot: CliHelpNode = {
  segment: "lab",
  pathKey: "lab",
  children: [
    {
      segment: "counter",
      pathKey: "lab counter",
      children: [{ segment: "bump", pathKey: "lab counter bump", children: [] }],
    },
  ],
};

describe("extractPositionalTokens", () => {
  test("strips `--key value` pairs and returns positional tokens", () => {
    expect(extractPositionalTokens(["lab", "counter", "bump", "--amount", "2"])).toEqual(["lab", "counter", "bump"]);
  });

  test("preserves positional segments when --key=value is used", () => {
    expect(extractPositionalTokens(["lab", "counter", "bump", "--amount=2"])).toEqual(["lab", "counter", "bump"]);
  });
});

describe("isPathRegistered", () => {
  test("static command first segment is treated as registered", () => {
    expect(isPathRegistered(["tickets", "pull"], [], new Set(["tickets"]))).toBe(true);
  });

  test("extension namespace requires the path to fully resolve", () => {
    expect(isPathRegistered(["lab", "counter", "bump"], [labRoot], new Set())).toBe(true);
    expect(isPathRegistered(["lab", "missing"], [labRoot], new Set())).toBe(false);
  });

  test("unknown first segment is not registered", () => {
    expect(isPathRegistered(["planner", "tickets", "pull"], [labRoot], new Set())).toBe(false);
  });
});

describe("decideRouterIntervention", () => {
  test("returns recovery for a missing first-party command", () => {
    const decision = decideRouterIntervention(["planner", "tickets", "pull"], loadedTree({}));
    expect(decision.kind).toBe("recovery");
    if (decision.kind !== "recovery") return;
    expect(decision.output).toContain("pstdio.planner");
    expect(decision.output).toContain("pstdio extensions add planner");
  });

  test("recovery uses installed-disabled wording when the extension is installed", () => {
    const runtime = emptyRuntime();
    runtime.extensions.push({
      id: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      sourcePath: "/x/extension.ts",
      sourceKind: "local",
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
      definition: {} as any,
    });
    const decision = decideRouterIntervention(["planner", "tickets", "pull"], loadedTree({ runtime }));
    if (decision.kind !== "recovery") throw new Error("expected recovery");
    expect(decision.output).toContain("appears to be installed but disabled");
    expect(decision.output).toContain("pstdio extensions enable pstdio.planner");
  });

  test("does not intervene when the path is registered as an extension command", () => {
    const decision = decideRouterIntervention(["lab", "counter", "bump"], loadedTree({ tree: [labRoot] }));
    expect(decision.kind).toBe("none");
  });

  test("returns collision output when the invoked path is refused", () => {
    const decision = decideRouterIntervention(
      ["lab", "counter", "bump"],
      loadedTree({
        tree: [labRoot],
        collisions: {
          duplicateCliPaths: [
            {
              pathKey: "lab counter bump",
              providers: [
                { extensionId: "pstdio.extension-lab", commandId: "lab.counter.bump" },
                { extensionId: "acme.other-lab", commandId: "lab.counter.bump" },
              ],
            },
          ],
          staticCollisions: [],
          refusedPathKeys: new Set(["lab counter bump"]),
          blockedNamespaces: new Set(),
        },
      }),
    );
    expect(decision.kind).toBe("collision");
    if (decision.kind !== "collision") return;
    expect(decision.output).toContain("duplicate_cli_path");
    expect(decision.output).toContain("pstdio.extension-lab");
    expect(decision.output).toContain("acme.other-lab");
  });

  test("returns nothing when no positional tokens are supplied", () => {
    const decision = decideRouterIntervention([], loadedTree({}));
    expect(decision.kind).toBe("none");
  });
});
