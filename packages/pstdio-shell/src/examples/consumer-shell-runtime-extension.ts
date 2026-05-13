import type { RuntimeExtensionAdapterInput, ShellCore, WebviewDescriptor } from "../core";
import { commandPaletteMenuPath, shellExampleResources } from "./consumer-shell-example-data";

const createExtensionWebview = () =>
  ({
    title: "Extension Lab review",
    sandbox: "default",
    runtimeUrl: `data:text/html;charset=utf-8,${encodeURIComponent(
      "<style>body{font:13px system-ui;margin:0;background:#0f172a;color:#f8fafc}main{padding:24px}code{color:#93c5fd}</style><main><h1>Extension Lab</h1><p>Runtime webview contributed through the shell adapter.</p><code>extension-lab.review.panel</code></main>",
    )}`,
    capabilities: ["read-workspace", "run-command"],
  }) satisfies WebviewDescriptor;

export const createRuntimeExtension = (shell: ShellCore) =>
  ({
    extensionId: "extension-lab",
    packageName: "extension-lab",
    displayName: "Extension Lab",
    contributions: {
      resources: {
        review: { kind: "extension-review", label: "Extension review", icon: "Puzzle" },
      },
      commands: {
        "review.open": {
          title: "Open extension review",
          category: "Extensions",
          icon: "Puzzle",
          run: () => shell.resources.openResource(shellExampleResources.extensionReview),
        },
      },
      views: {
        "review.panel": {
          title: "Extension Lab review",
          slot: "main",
          resourceKinds: ["extension-review"],
          webview: createExtensionWebview(),
        },
      },
      menus: [{ path: commandPaletteMenuPath, command: "review.open", group: "Extensions", order: 80 }],
      keybindings: [{ command: "review.open", keybinding: "Meta+Shift+E", when: "project.open" }],
      preferences: {
        properties: {
          "extensionLab.reviewMode": {
            type: "string",
            enum: ["standard", "strict"],
            default: "standard",
            scope: "project",
          },
        },
      },
      activity: {
        kinds: {
          review: { kind: "extension.review", title: "Extension reviews", icon: "Puzzle" },
        },
      },
      diagnostics: {
        sources: {
          "review-lint": { title: "Review lint", icon: "ListChecks" },
        },
      },
    },
  }) satisfies RuntimeExtensionAdapterInput;
