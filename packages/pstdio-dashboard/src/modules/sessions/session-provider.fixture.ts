import { resolve } from "node:path";
import { type ExtensionContextBase, type NavigationTarget, sessionBrowserId } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { WorkbenchCore } from "@pstdio/workbench";
import { registerWorkbenchExtensionContributions } from "@pstdio/workbench/extensions";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { createWorkbenchExtensionMetadata } from "pstdio-extensions/workbench";
import { buildDashboardWorkbenchWhenExpression } from "@/shared/extensions/workbench-extension-contributions";

// Load the production declarations, rather than maintaining a second Sessions UI in tests.
const loaded = await loadExtensionSources({
  extensionPackages: [
    { path: resolve(import.meta.dir, "../../../../../extensions/pstdio-session-browser"), sourceKind: "local_path" },
    { path: resolve(import.meta.dir, "../../../../../extensions/pstdio-workspaces"), sourceKind: "local_path" },
  ],
});
const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
if (runtime.diagnostics.length) throw new Error(JSON.stringify(runtime.diagnostics));
// Resolve external owners against their real declarations, but let each test's
// Workspaces helper own its registrations instead of registering that provider twice.
const allMetadata = createWorkbenchExtensionMetadata({ runtime });
const metadata = Object.fromEntries(
  Object.entries(allMetadata).map(([key, records]) => [
    key,
    Array.isArray(records)
      ? records.filter((record: { extensionId?: string; id?: string }) =>
          key === "extensions" ? record.id === sessionBrowserId : record.extensionId === sessionBrowserId,
        )
      : records,
  ]),
) as typeof allMetadata;

export const registerSessionProvider = (
  workbench: WorkbenchCore,
  input: { projectId?: string; sessions?: Partial<ExtensionContextBase["sessions"]> } = {},
) => {
  const storage = createMemoryStorage();
  return registerWorkbenchExtensionContributions({
    workbench,
    projectId: input.projectId ?? "project-1",
    metadata,
    createKeybindingWhenExpression: buildDashboardWorkbenchWhenExpression,
    createMenuWhenExpression: (contribution) => buildDashboardWorkbenchWhenExpression(contribution.when),
    async executeCommand(commandId, body) {
      const navigationRequests: NavigationTarget[] = [];
      const ctx = makeCommandContext({
        storage,
        params: body.params ?? {},
        overrides: {
          projectId: input.projectId ?? "project-1",
          resource: body.resource,
          sessions: input.sessions,
          navigation: {
            open: (target) => {
              navigationRequests.push(target);
            },
          },
        },
      });
      const command = runtime.commands.find((item) => item.id === commandId);
      const handler = runtime.privateHandlers.find((item) => item.id === commandId);
      const value = command
        ? await command.run(ctx, body.params ?? {})
        : await handler?.handler(ctx, body.params ?? {});
      return {
        commandId,
        extensionId: "pstdio.pstdio-session-browser",
        outcome: { ok: true, status: "success", value, navigationRequests },
      };
    },
  });
};
