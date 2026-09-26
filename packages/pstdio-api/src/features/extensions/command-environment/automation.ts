import type { ExtensionAutomationApi } from "pstdio-api-contracts/extension-kernel";
import type { createAutomationService } from "../../automation/automation-service";

export const createAutomationApi = (
  getService: () => ReturnType<typeof createAutomationService>,
  owner: { projectId: string; extensionId: string },
) =>
  ({
    enqueue: ({ command, input, key }) =>
      getService().enqueueForExtension({
        ...owner,
        commandId:
          typeof command === "string" ? command : `${command.extensionId ?? owner.extensionId}.command.${command.id}`,
        input,
        key,
      }),
    get: (runId) => getService().getForExtension(owner, runId),
    list: (filter) => getService().listForExtension(owner, filter),
    cancel: (runId) => getService().cancelForExtension(owner, runId),
  }) satisfies ExtensionAutomationApi;
