import { describe, expect, test } from "bun:test";
import { defineExtension, projectSlots } from "@pstdio/sdk/extensions";
import { buildCliHelpTree } from "./cli-help";
import type { LoadedExtensionSource } from "./loader";
import { normalizeExtensionSources } from "./normalize";

const wrap = (definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

const labFixture = () =>
  defineExtension({
    commands: {
      "say-hello": {
        title: "Say hello",
        cli: true,
        menus: [{ slot: projectSlots.headerPrimary, label: "Lab: Say hello" }],
        run: async () => undefined,
      },
      "counter.bump": {
        title: "Bump counter",
        cli: true,
        menus: [{ slot: projectSlots.headerOverflow, label: "Bump" }],
        run: async () => undefined,
      },
      hidden: {
        title: "Hidden",
        run: async () => undefined,
      },
    },
  });

describe("buildCliHelpTree", () => {
  test("groups CLI contributions by package name", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);
    const [labRoot] = buildCliHelpTree(runtime);
    expect(labRoot?.segment).toBe("lab");
    expect(labRoot?.children.map((c) => c.segment)).toEqual(["counter", "say-hello"]);
    expect(labRoot?.children.find((c) => c.segment === "counter")?.children[0]?.command?.commandId).toBe(
      "lab.counter.bump",
    );
  });
});
