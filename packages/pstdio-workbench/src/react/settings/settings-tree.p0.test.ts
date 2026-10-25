import { describe, expect, test } from "bun:test";
import type { TreeViewSection } from "../../core";
import { createSettingsRegistry } from "../../core/registries/settings/settings-registry";
import { buildSettingsTreeBody } from "./settings-tree";

describe("settings tree", () => {
  test("hides panels whose context condition does not match", async () => {
    const settings = createSettingsRegistry();
    settings.registerSection({ id: "extensions", title: "Extensions" });
    settings.registerPanel({
      kind: "schema",
      id: "conditional",
      title: "Conditional",
      section: "extensions",
      when: "templates.available",
      preferences: [],
    });

    const hidden = await buildSettingsTreeBody({
      settings,
      hasProjectScope: true,
      matchesWhen: () => false,
    });
    expect(hidden).toEqual([]);

    const visible = await buildSettingsTreeBody({
      settings,
      hasProjectScope: true,
      matchesWhen: () => true,
    });
    expect(visible[0]?.nodes.map((node) => node.label)).toEqual(["Conditional"]);
  });
});

test("settings entries appear before collections finish and each collection publishes independently", async () => {
  const settings = createSettingsRegistry();
  const skills = Promise.withResolvers<string[]>();
  const templates = Promise.withResolvers<string[]>();
  const started: string[] = [];
  settings.registerPanel({ id: "general", title: "General", kind: "schema", preferences: [] });
  for (const [id, pending] of [
    ["skills", skills],
    ["templates", templates],
  ] as const) {
    settings.registerPanel<string>({
      id,
      title: id,
      kind: "collection",
      viewId: id,
      items: () => {
        started.push(id);
        return pending.promise;
      },
      itemId: (item) => item,
      itemLabel: (item) => item,
    });
  }
  const snapshots: TreeViewSection[][] = [];
  const loading = buildSettingsTreeBody({
    settings,
    hasProjectScope: true,
    matchesWhen: () => true,
    onProgress: (sections) => snapshots.push(sections),
  });
  try {
    expect(snapshots[0]?.[0].nodes.map((node) => node.label)).toEqual(["General", "skills", "templates"]);
    expect(started).toEqual(["skills", "templates"]);
    templates.resolve(["Template"]);
    await Bun.sleep(0);
    expect(snapshots.at(-1)?.[0].nodes[2].children?.[0].label).toBe("Template");
    expect(snapshots[0][0].nodes[2].children).toEqual([]);
    expect(snapshots.at(-1)?.[0].nodes[1].children).toEqual([]);
    skills.resolve(["Skill"]);
    const final = await loading;
    expect(final[0].nodes[1].children?.[0].label).toBe("Skill");
    expect(final[0].nodes[2].children?.[0].label).toBe("Template");
  } finally {
    skills.resolve([]);
    templates.resolve([]);
    await loading;
  }
});

test("one unavailable settings collection does not block the other entries", async () => {
  const settings = createSettingsRegistry();
  for (const id of ["failed", "ready"])
    settings.registerPanel<string>({
      id,
      title: id,
      kind: "collection",
      viewId: id,
      items: () => {
        if (id === "failed") throw new Error("unavailable");
        return ["Available item"];
      },
      itemId: (item) => item,
      itemLabel: (item) => item,
    });
  const sections = await buildSettingsTreeBody({ settings, hasProjectScope: true, matchesWhen: () => true });
  expect(sections[0].nodes[0].children).toEqual([]);
  expect(sections[0].nodes[1].children?.[0].label).toBe("Available item");
});
