import { workbenchCommands } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { isProjectWorkspaceAttached } from "@/shared/workspaces/workspace-state";

export const registerProjectSetupCommand = (ctx: WorkbenchModuleContext) =>
  ctx.commands.registerCommand(
    { id: workbenchCommands.retryProjectSetup.id, label: "Retry project setup", category: "Project" },
    {
      execute: async (_args, context) => {
        const projectId = getDashboardSelectedProjectId(ctx);
        if (!projectId) throw new Error("Setup retry requires a selected project");
        if (context?.projectId && context.projectId !== projectId) throw new Error("The selected project changed");
        const client = getApiClient();
        const sync = await client.account.projectSyncStatus(projectId);
        if (sync.state !== "local" && !sync.offlineReady) {
          await client.account.retryProjectSync(projectId);
          return;
        }
        const projects = client.projects;
        const workspace = isProjectWorkspaceAttached(projectId)
          ? await projects.retrySetup(projectId)
          : await projects.open(projectId);
        if (workspace.setupError) throw new Error(workspace.setupError);
        if (workspace.providerState === "failed" || workspace.providerState === "provider_missing") {
          throw new Error(workspace.provider_error_json?.message ?? "Workspace provider setup failed");
        }
      },
    },
  );
