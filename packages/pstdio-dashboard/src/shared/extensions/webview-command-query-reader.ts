import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { getCommandValue, type ResourceRef, type WebviewHostProps, workbenchCommands } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import type { WebviewCommandQueryDefinition } from "pstdio-api-contracts/extension-kernel";
import { getRuntimeApiClient } from "@/lib/api";
import {
  dashboardQueryAuthority,
  getDashboardAccountStatusQuery,
  getDashboardScopedQueries,
} from "@/lib/scoped-queries";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { publishExtensionCommandEvent } from "./extension-webview-broadcast";

interface BackendReaderInput {
  runtime: RuntimeCollections;
  projectId: string;
  queryScope: WebviewHostProps["queryScope"];
  resource?: ResourceRef;
  slot: CommandExecuteRequest["slot"];
}

/** Backend source closures never hold a frame, placement or Workbench core. */
const createBackendReader = (input: BackendReaderInput) => {
  const { runtime, projectId, queryScope, resource, slot } = input;
  const api = getRuntimeApiClient(runtime);
  const queries = getDashboardScopedQueries(runtime);
  const authority = JSON.stringify(queryScope);
  const assertAuthority = () => {
    if (runtime.isDisposed() || queries.isDisposed()) throw new Error("Command query authority is closed");
    const current = {
      runtimeId: String(runtime.id),
      ...dashboardQueryAuthority(getDashboardAccountStatusQuery(runtime).getSnapshot().data),
    };
    if (JSON.stringify(current) !== authority) throw new Error("Command query authority is closed");
  };
  return {
    assertAuthority,
    capture(command: WebviewCommandQueryDefinition["command"]) {
      return async (signal: AbortSignal) => {
        assertAuthority();
        signal.throwIfAborted();
        const response = await api.extensions.execute(
          command.commandId,
          {
            ...command,
            projectId,
            slot,
            source: "dashboard",
            resource: command.resource ?? resource,
          },
          { signal },
        );
        assertAuthority();
        signal.throwIfAborted();
        publishExtensionCommandEvent(response, { projectId }, runtime);
        return getCommandValue(response.outcome);
      };
    },
  };
};

const createBuiltinReader = (input: {
  workbench?: WorkbenchCore;
  projectId: string;
  resource?: ResourceRef;
  assertAuthority(): void;
}) => {
  const { workbench, projectId, resource, assertAuthority } = input;
  return (command: WebviewCommandQueryDefinition["command"]) => async (signal: AbortSignal) => {
    assertAuthority();
    signal.throwIfAborted();
    if (command.commandId !== workbenchCommands.recentResources.id || !workbench)
      throw new Error("This host command does not provide a finite query");
    // Core identity and retirement are fenced by the shared host query adapter around this callback.
    const value = await workbench.commands.executeCommand(command.commandId, command.params, {
      projectId,
      resource: command.resource ?? resource,
      signal,
    });
    assertAuthority();
    signal.throwIfAborted();
    return value;
  };
};

export const createDashboardCommandQueryReader = (input: BackendReaderInput & { workbench?: WorkbenchCore }) => {
  const { runtime, projectId, queryScope, resource, slot, workbench } = input;
  const backend = createBackendReader({ runtime, projectId, queryScope, resource, slot });
  const builtin = createBuiltinReader({ workbench, projectId, resource, assertAuthority: backend.assertAuthority });
  return {
    assertAuthority: backend.assertAuthority,
    captureRead: (command: WebviewCommandQueryDefinition["command"]) =>
      command.commandId.includes(".command.") ? backend.capture(command) : builtin(command),
  };
};
