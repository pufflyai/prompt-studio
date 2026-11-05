import { contributionRefId, type PlacementIdentity, sessionBrowser } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchCommandExecutionContext, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";

interface LegacyArgs {
  workspace?: ResourceRef;
  resource?: ResourceRef;
  from?: ResourceRef;
  workspaceId?: string;
  harnessId?: string;
  deviceId?: string;
  side?: boolean;
  sidePanel?: boolean;
  replace?: boolean;
  replacePanel?: PlacementIdentity;
  placementIdentity?: PlacementIdentity;
  sessionId?: string;
  title?: string;
  messageId?: string;
  search?: string;
}
const providerArgs = (command: string, input: LegacyArgs, context?: WorkbenchCommandExecutionContext) => {
  if (command === "new")
    return {
      workspaceId: input.workspaceId ?? input.workspace?.id,
      harnessId: input.harnessId,
      deviceId: input.deviceId ?? input.workspace?.device?.id,
      side: input.side || input.sidePanel || (context?.source === "panel-add" && context.region !== "main"),
      replace: input.replace ?? Boolean(input.replacePanel),
    };
  if (command === "switch") return { sessionId: input.sessionId, search: input.search };
  const resource = input.resource ?? context?.resource;
  return {
    sessionId: input.sessionId ?? (resource?.type === "session" ? resource.id : undefined),
    ...(command === "open" ? { side: true, replace: Boolean(input.replacePanel) } : {}),
    ...(command === "rename" ? { title: input.title } : {}),
    ...(command === "fork" ? { messageId: input.messageId } : {}),
  };
};
export const registerLegacySessionCommands = (ctx: WorkbenchModuleContext) => {
  const forwards = [
    [dashboardCommandIds.createSession, "new"],
    [dashboardCommandIds.openSessionPanel, "open"],
    [dashboardCommandIds.renameSession, "rename"],
    [dashboardCommandIds.archiveSession, "archive"],
    [dashboardCommandIds.deleteSession, "delete"],
    [dashboardCommandIds.forkSession, "fork"],
    [dashboardCommandIds.switchSession, "switch"],
  ] as const;
  for (const [id, command] of forwards)
    ctx.commands.registerCommand(
      { id, label: id },
      {
        async execute(args, context) {
          const input = (args ?? {}) as LegacyArgs;
          const execution = {
            ...context,
            resource: input.from ?? input.resource ?? context?.resource,
            placement: input.replacePanel ?? input.placementIdentity ?? context?.placement,
          };
          const commandId = contributionRefId({
            kind: "command",
            extensionId: sessionBrowser.commands.create.extensionId,
            id: command,
          });
          const params = providerArgs(command, input, context);
          const record = ctx.commands.getCommand(commandId);
          if (!record) return ctx.commands.executeCommand(commandId, params, execution);
          const prepared = (await ctx.commands.prepareCommandArgs(commandId, params, execution)) as Record<
            string,
            unknown
          >;
          if (
            Object.entries(record.command.params ?? {}).some(
              ([key, param]) => param.required && prepared?.[key] === undefined,
            )
          ) {
            ctx.commandPalette.requestParams({
              record,
              label: record.command.label,
              args: prepared,
              context: execution,
            });
            return;
          }
          return ctx.commands.executeCommand(commandId, prepared, execution);
        },
      },
    );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.openSessions, label: "Go to sessions" },
    {
      execute: () => ctx.navigation.openTarget({ kind: "page", page: sessionBrowser.pages.sessions }),
    },
  );
};
