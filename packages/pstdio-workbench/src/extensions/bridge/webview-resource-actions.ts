import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import type { WorkbenchCore } from "../../core";
import { createWorkbenchResourceActions } from "../../react/menus/resource-actions";

export const createWebviewResourceActions =
  (workbench: WorkbenchCore, projectId?: string, extensionId?: string) =>
  async (input: WebviewHostCapabilityParams["resources.actions"]) => {
    const resource = { ...input.resource, projectId, extensionId: input.resource.extensionId ?? extensionId };
    const actions = createWorkbenchResourceActions(workbench, resource);
    if (input.operation === "execute") {
      const action = actions.find(({ key }) => key === input.key);
      if (!action || action.isDisabled) throw new Error("This resource action is no longer available.");
      await action.onClick?.();
      return [];
    }
    return actions.map(({ key, label, commandId, isDisabled, separatorBefore, group }) => ({
      key,
      label,
      commandId,
      isDisabled,
      separatorBefore,
      group,
      icon: commandId ? workbench.commands.getCommand(commandId)?.command.icon : undefined,
    }));
  };
