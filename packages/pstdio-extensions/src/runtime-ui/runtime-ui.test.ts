import { describe, expect, test } from "bun:test";
import { commandRef, defineExtension, projectSlots } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../runtime/loader";
import { normalizeExtensionSources } from "../runtime/normalize";
import { groupDiagnosticsBySeverity, sortDiagnostics } from "./diagnostics-view";
import { resolveMenuContributionsForSlot } from "./slot-resolution";

const wrap = (definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  sourcePath: `/fake/${definition.namespace}/extension.ts`,
  sourceKind: "local",
  definition,
});

const labFixture = () =>
  defineExtension({
    id: "pstdio.extension-lab",
    namespace: "lab",
    name: "Lab",
    apiVersion: "1",
    commands: {
      "say-hello": {
        title: "Say hello",
        cli: true,
        menus: [
          { slot: projectSlots.headerPrimary, label: "Lab: Say hello" },
          { slot: projectSlots.commandPanel, label: "Say hello" },
        ],
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

describe("resolveMenuContributionsForSlot", () => {
  test("returns menu contributions attached to a slot ref", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);

    const items = resolveMenuContributionsForSlot(runtime, projectSlots.headerPrimary);
    expect(items.map((i) => i.command.id)).toEqual(["lab.say-hello"]);
    expect(items[0]?.contribution.label).toBe("Lab: Say hello");
  });

  test("works with raw slot ids", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);
    const items = resolveMenuContributionsForSlot(runtime, projectSlots.headerOverflow.id);
    expect(items.map((i) => i.command.id)).toEqual(["lab.counter.bump"]);
  });

  test("resolves project.commandPanel like any other menu slot", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);
    const items = resolveMenuContributionsForSlot(runtime, projectSlots.commandPanel);
    expect(items.map((i) => i.command.id)).toEqual(["lab.say-hello"]);
    expect(items.map((i) => i.command.id)).not.toContain("lab.hidden");
  });
});

describe("diagnostics view", () => {
  test("sorts errors before warnings before info", () => {
    const sorted = sortDiagnostics([
      { code: "info", severity: "info", message: "i" },
      { code: "err", severity: "error", message: "e" },
      { code: "warn", severity: "warning", message: "w" },
    ]);
    expect(sorted.map((d) => d.severity)).toEqual(["error", "warning", "info"]);
  });

  test("groups diagnostics by severity", () => {
    const groups = groupDiagnosticsBySeverity([
      { code: "warn1", severity: "warning", message: "w1" },
      { code: "err1", severity: "error", message: "e1" },
      { code: "warn2", severity: "warning", message: "w2" },
    ]);
    expect(groups.map((g) => g.severity)).toEqual(["error", "warning"]);
    expect(groups.find((g) => g.severity === "warning")?.diagnostics).toHaveLength(2);
  });
});

describe("commandRef helper from runtime-ui", () => {
  test("commandRef is re-exported alongside the runtime-ui helpers", () => {
    expect(commandRef("lab.awaken").id).toBe("lab.awaken");
  });
});
