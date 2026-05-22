import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createExtensionHost, type ExtensionDefinition } from "./extension-host";
import { extensionThemePreferences } from "./themes";

const createCountingDefinition = (id: string) => {
  let moduleCreations = 0;

  const definition: ExtensionDefinition = {
    id,
    name: id,
    description: "",
    contributes: "",
    icon: "Box",
    createModule: () => {
      moduleCreations += 1;
      return {
        id: `module.${id}`,
        activate(ctx) {
          ctx.renderers.registerRenderer({ id: `renderer.${id}`, render: () => null });
        },
      };
    },
  };

  return { definition, getModuleCreations: () => moduleCreations };
};

describe("createExtensionHost", () => {
  test("enabling registers the extension's contributions; disabling disposes them", () => {
    const workbench = createWorkbenchCore();
    const themePack = createCountingDefinition("theme-pack");
    const host = createExtensionHost(workbench, [themePack.definition]);

    expect(host.getEnabledIds()).toEqual([]);

    host.setEnabled("theme-pack", true);
    expect(host.isEnabled("theme-pack")).toBe(true);
    expect(workbench.renderers.getRenderer("renderer.theme-pack")).toBeDefined();

    host.setEnabled("theme-pack", false);
    expect(host.isEnabled("theme-pack")).toBe(false);
    expect(workbench.renderers.getRenderer("renderer.theme-pack")).toBeUndefined();
  });

  test("re-enabling builds a fresh module instance", () => {
    const workbench = createWorkbenchCore();
    const themePack = createCountingDefinition("theme-pack");
    const host = createExtensionHost(workbench, [themePack.definition]);

    host.setEnabled("theme-pack", true);
    host.setEnabled("theme-pack", false);
    host.setEnabled("theme-pack", true);

    expect(themePack.getModuleCreations()).toBe(2);
  });

  test("registers a definition's themes into the workbench while the extension is enabled", () => {
    const workbench = createWorkbenchCore();
    const themePack: ExtensionDefinition = {
      id: "theme-pack",
      name: "Theme Pack",
      description: "",
      contributes: "",
      icon: "Palette",
      themes: extensionThemePreferences,
      createModule: () => ({ id: "module.theme-pack", activate() {} }),
    };
    const host = createExtensionHost(workbench, [themePack]);

    expect(workbench.themes.listThemes()).toEqual([]);

    host.setEnabled("theme-pack", true);
    expect(workbench.themes.listThemes()).toEqual(extensionThemePreferences);

    host.setEnabled("theme-pack", false);
    expect(workbench.themes.listThemes()).toEqual([]);
  });

  test("notifies subscribers only on real changes", () => {
    const workbench = createWorkbenchCore();
    const themePack = createCountingDefinition("theme-pack");
    const host = createExtensionHost(workbench, [themePack.definition]);

    let notifications = 0;
    const subscription = host.subscribe(() => {
      notifications += 1;
    });

    host.setEnabled("theme-pack", true);
    host.setEnabled("theme-pack", true); // already enabled — no-op
    host.setEnabled("theme-pack", false);
    expect(notifications).toBe(2);

    subscription.dispose();
    host.setEnabled("theme-pack", true);
    expect(notifications).toBe(2);
  });
});
