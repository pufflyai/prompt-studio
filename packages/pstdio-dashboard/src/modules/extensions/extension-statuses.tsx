import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { Disposable, WorkbenchModuleContext, WorkflowStatus } from "@pstdio/workbench";
import { WorkflowStatusSettings } from "@pstdio/workbench/react";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";

const statusesFromResponse = (response: CommandExecuteResponse) => {
  if (!response.outcome.ok) {
    throw new Error(response.outcome.reason ?? response.outcome.error?.message ?? "Status provider failed");
  }
  const value = response.outcome.value;
  if (!value || typeof value !== "object" || !("statuses" in value) || !Array.isArray(value.statuses)) {
    throw new Error("Status provider returned an invalid response");
  }
  return value.statuses as WorkflowStatus[];
};

export const registerExtensionStatuses = (
  ctx: WorkbenchModuleContext,
  input: {
    executeCommand: ExecuteDashboardExtensionCommand;
    metadata: DashboardExtensionMetadata;
    projectId: string;
  },
) =>
  (input.metadata.statuses ?? []).map((record, index) =>
    ctx.statuses.registerStatusSet(
      {
        id: record.id,
        title: resolveLocalizableString(record.title, record.extensionId),
        actions: record.actions?.map((action) => ({
          id: action.id,
          label: resolveLocalizableString(action.label, record.extensionId),
          icon: action.icon,
        })),
        query: async () =>
          statusesFromResponse(await input.executeCommand(input.projectId, record.queryHandlerId, { params: {} })),
        save: record.saveHandlerId
          ? async (statuses) =>
              statusesFromResponse(
                await input.executeCommand(input.projectId, record.saveHandlerId!, { params: { statuses } }),
              )
          : undefined,
      },
      { ownerId: record.extensionId, priority: -index },
    ),
  );

export const registerWorkflowStatusesSettings = (ctx: WorkbenchModuleContext): Disposable[] => {
  const disposables: Disposable[] = [];
  if (!ctx.settings.getSection("project")) {
    disposables.push(ctx.settings.registerSection({ id: "project", title: "Project", scope: "project" }));
  }
  disposables.push(
    ctx.settings.registerPanel({
      id: "workbench.statuses",
      title: "Statuses",
      icon: "list-checks",
      kind: "custom",
      section: "project",
      scope: "project",
      render: () => <WorkflowStatusSettings workbench={ctx} />,
    }),
  );
  return disposables;
};
