import { workbenchCommands } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

export const registerProjectSetupCommand = (ctx: WorkbenchModuleContext) =>
  ctx.commands.registerCommand(
    { id: workbenchCommands.retryProjectSetup.id, label: "Retry project setup", category: "Project" },
    {
      execute: async (_args, context) => {
        const projectId = getDashboardSelectedProjectId(ctx);
        if (!projectId) throw new Error("Setup retry requires a selected project");
        if (context?.projectId && context.projectId !== projectId) throw new Error("The selected project changed");
        const workspace = await getApiClient().projects.retrySetup(projectId);
        if (workspace.setupError) throw new Error(workspace.setupError);
        if (workspace.providerState === "failed" || workspace.providerState === "provider_missing") {
          throw new Error(workspace.provider_error_json?.message ?? "Workspace provider setup failed");
        }
      },
    },
  );
