import { describe, expect, test } from "bun:test";
import { commandRef, defineExtension, projectSlots } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../runtime/loader";
import { normalizeExtensionSources } from "../runtime/normalize";
import { filterCommandPanel, groupCommandPanel } from "./command-panel";
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
        commandPanel: false,
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
});

describe("filterCommandPanel", () => {
  test("hides commands opted out of the panel", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);
    const entries = filterCommandPanel(runtime);
    expect(entries.map((e) => e.command.id)).not.toContain("lab.hidden");
  });

  test("filters by query against title and id", () => {
    const runtime = normalizeExtensionSources([wrap(labFixture())]);
    expect(filterCommandPanel(runtime, { query: "bump" }).map((e) => e.command.id)).toEqual(["lab.counter.bump"]);
  });

  test("group buckets entries by group", () => {
    const lab = defineExtension({
      id: "pstdio.extension-lab",
      namespace: "lab",
      name: "Lab",
      commands: {
        a: { title: "A", commandPanel: { group: "Lab" }, run: async () => undefined },
        b: { title: "B", commandPanel: { group: "Lab" }, run: async () => undefined },
        c: { title: "C", commandPanel: { group: "Other" }, run: async () => undefined },
      },
    });
    const runtime = normalizeExtensionSources([wrap(lab)]);
    const groups = groupCommandPanel(filterCommandPanel(runtime));
    expect(groups.map((g) => g.group)).toEqual(["Lab", "Other"]);
    expect(groups[0]?.items).toHaveLength(2);
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
