# Settings

Each tool gets a settings page without building one.

## What settings give you

Prompt Studio keeps the settings of the app and of every tool in one place. A tool declares its settings, and Prompt Studio draws the fields, saves the values, and shows them on the tool's page. Tool authors do not build a settings screen, and you do not look for one in each tool.

Each setting has a scope that decides where its value is stored:

- **project**: one value per project. Two projects can use the same tool in different ways.
- **global**: one value for the installed extension, shared by all projects.
- **device**: one value for this computer. It is shared by all projects on the device and never added to synced project data.

## Use settings in Prompt Studio

Open **Settings** from the footer of the sidebar, or press **Mod+,** (Cmd+, on macOS, Ctrl+, elsewhere). Settings has these groups:

- **Workbench** holds app settings such as **Runtime**, with the project's default harness and model and **Max concurrent sessions**, and **Appearance**, where you choose the theme.
- **Project** holds settings for the current project, such as **Project folder** and **Templates**.
- **Experimental → Beta features** turns on features that start off, such as **Notifications**.

A tool's own settings are on its page in **Extensions**: choose the tool and open its **Settings** tab. Changing a field saves it. Some tools add their own section to Settings. For example, Planner adds **Settings → Project Planner** for workflow options, ticket tags, and statuses.

## Add settings to your tool

Declare settings in `defineExtension({ settings })`. Each property has a `type`, a `scope`, a `default`, and a `title`. This setting is simplified from the Codex harness:

```ts
settings: {
  properties: {
    restartAfterQuotaReset: {
      type: "boolean",
      scope: "device",
      default: false,
      title: "Restart after quota reset",
    },
  },
},
```

The tool's **Settings** tab shows a field for each `boolean`, `number`, and `string` setting. A `string` setting can offer fixed choices with `enum`, or load them from a command with `options`.

Commands read and write values with `ctx.settings.all()`, `get(key)`, `set(key, value)`, and `delete(key)`. Deleting a value restores its default. Webviews use the same methods on `client.settings` and declare the matching `extension.settings.*` capabilities.

For array or object settings, or a custom editor, write a view and place it with `defineSettingsPanel` in the `settingsPanels` contribution. Its `slot` chooses where it appears: `workbenchSlots.extensionSettings` for the tool's Settings tab, `workbenchSlots.projectSettings` for a project settings entry, or `workbenchSlots.globalSettings` for app-wide settings.

## Learn more

- [Settings](../../references/extensions/0004-contribution-api.md#settings) covers setting types, `enum`, `options`, and settings panels.
- [App-wide settings](../../references/extensions/0004-contribution-api.md#app-wide-settings) explains scopes and `ctx.settings`.
- [Extension management](0015-extension-management.md) shows where each tool's page lives.

*Updated at: 2026-11-22*
