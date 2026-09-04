import { describe, expect, test } from "bun:test";
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
