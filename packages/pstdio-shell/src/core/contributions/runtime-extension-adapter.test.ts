import { describe, expect, test } from "bun:test";
import { createActivityRegistry } from "../activity/activity-registry";
import { createCommandRegistry } from "../commands/command-registry";
import { createContextKeyService } from "../context/context-key-service";
import { createKeybindingRegistry } from "../keybindings/keybinding-registry";
import { createLayoutModel } from "../layout/layout-model";
import { createMenuRegistry } from "../menus/menu-registry";
import { createPreferenceRegistry } from "../preferences/preference-registry";
import { createResourceRegistry } from "../resources/resource-registry";
import { createWebviewRegistry } from "../webviews/webview-registry";
import { adaptRuntimeExtensionContributions } from "./runtime-extension-adapter";

describe("adaptRuntimeExtensionContributions", () => {
  test("maps constrained extension descriptors into shell registries", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const resources = createResourceRegistry();
    const layout = createLayoutModel();
    const menus = createMenuRegistry({ commands });
    const activity = createActivityRegistry();
    const keybindings = createKeybindingRegistry({ commands, context });
    const preferences = createPreferenceRegistry();
    const webviews = createWebviewRegistry();

    adaptRuntimeExtensionContributions(
      { activity, commands, keybindings, layout, menus, preferences, resources, webviews },
      {
        extensionId: "pstdio.extension-lab",
        packageName: "extension-lab",
        displayName: "Extension Lab",
        contributions: {
          resources: {
            counter: {
              kind: "extension-lab.counter",
              label: "Lab Counter",
              icon: "circle-plus",
            },
          },
          commands: {
            "counter.bump": {
              title: "Bump lab counter",
              category: "Lab",
              run: async () => ({ counter: 1 }),
            },
          },
          views: {
            labPage: {
              title: "Extension Lab",
              slot: "main",
              resourceKinds: ["extension-lab.counter"],
              webview: {
                entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension" },
              },
            },
          },
          menus: [
            {
              path: ["resource", "context"],
              command: "extension-lab.counter.bump",
              when: "resourceKind == 'extension-lab.counter'",
              group: "extension-lab",
            },
          ],
          keybindings: [
            {
              command: "extension-lab.counter.bump",
              keybinding: "Ctrl+Shift+L",
              when: "resourceKind == 'extension-lab.counter'",
            },
          ],
          preferences: {
            properties: {
              "extension-lab.counter.defaultIncrement": {
                type: "number",
                default: 1,
                scope: "project",
                description: "Default amount used when bumping the lab counter.",
              },
            },
          },
          activity: {
            kinds: {
              "extension-lab.counter.bumped": {
                kind: "extension-lab.counter.bumped",
                title: "Counter bumped",
                icon: "circle-plus",
              },
            },
          },
        },
      },
    );

    expect(resources.getKind("extension-lab.counter")).toMatchObject({
      source: "extension",
      ownerId: "pstdio.extension-lab",
    });
    expect(commands.getCommand("extension-lab.counter.bump")).toMatchObject({
      command: { id: "extension-lab.counter.bump", label: "Bump lab counter" },
      source: "extension",
      ownerId: "pstdio.extension-lab",
    });
    expect(layout.getWidget("extension-lab.labPage")).toMatchObject({
      area: "main",
      renderer: "webview",
      webview: {
        entry: { path: "./src/main.tsx" },
      },
    });
    expect(menus.listMenuActions(["resource", "context"])).toMatchObject([
      {
        commandId: "extension-lab.counter.bump",
        source: "extension",
        ownerId: "pstdio.extension-lab",
      },
    ]);
    expect(preferences.getSchema("extension-lab.counter.defaultIncrement")).toMatchObject({
      source: "extension",
      ownerId: "pstdio.extension-lab",
    });
    expect(activity.listKinds()).toMatchObject([
      {
        kind: "extension-lab.counter.bumped",
        source: "extension",
        ownerId: "pstdio.extension-lab",
      },
    ]);
    expect(webviews.getWebview("extension-lab.labPage")).toMatchObject({
      id: "extension-lab.labPage",
      source: "extension",
      ownerId: "pstdio.extension-lab",
    });

    context.set("resourceKind", "extension-lab.counter");
    expect(keybindings.listActiveKeybindings()).toMatchObject([
      {
        commandId: "extension-lab.counter.bump",
        source: "extension",
        ownerId: "pstdio.extension-lab",
      },
    ]);
  });

  test("rejects extension commands that target reserved shell prefixes", () => {
    const commands = createCommandRegistry();
    const resources = createResourceRegistry();
    const layout = createLayoutModel();
    const menus = createMenuRegistry({ commands });

    expect(() =>
      adaptRuntimeExtensionContributions(
        { commands, layout, menus, resources },
        {
          extensionId: "pstdio.extension-lab",
          packageName: "extension-lab",
          displayName: "Extension Lab",
          contributions: {
            commands: {
              "shell.open": {
                title: "Bump",
                run: () => undefined,
              },
            },
          },
        },
      ),
    ).toThrow("Runtime extensions cannot contribute reserved command prefix: shell.open");
  });
});
