import type { ExtensionLoggerApi, JsonObject, Localizable } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner, type RuntimeScheduleRecord } from "pstdio-extensions";
import type { RunContext } from "pstdio-scheduler";
import { createCommandEnvironment } from "../command-environment";
import type { ExtensionsRouteDeps } from "../deps";
import { createExtensionLogger } from "../extension-logger";
import type { ProjectExtensionRuntimeSnapshot } from "../project-extension-runtime-snapshot";

const scheduleTitle = (title: Localizable<string>) =>
  typeof title === "string" ? title : (title.default ?? title.$l10n);

export const executeScheduledCommand = async (input: {
  deps: ExtensionsRouteDeps;
  snapshot: ProjectExtensionRuntimeSnapshot;
  schedule: RuntimeScheduleRecord;
  workspaceId?: string;
  ctx: RunContext;
  extensionLogger?: ExtensionLoggerApi;
  beforeDispatch: () => Promise<() => boolean>;
}) => {
  const { deps, snapshot, schedule, ctx } = input;
  const projectId = snapshot.project.id;
  const runner = createCommandRunner(snapshot.runtime, {
    logger: input.extensionLogger,
    createLogger: input.extensionLogger ? () => input.extensionLogger! : createExtensionLogger,
    buildEnvironment: (ids) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        artifactMounts: snapshot.runtime.artifactMounts,
        extensionId: ids.extensionId,
        name: ids.name,
        project: snapshot.project,
        projectId: ids.projectId,
        workspaceDir: ids.workspaceDir,
        workspaceId: ids.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });
  const workspace = input.workspaceId
    ? await deps.workspaceService.get(input.workspaceId)
    : await deps.workspaceService.getDefault(projectId);
  if (input.workspaceId && !workspace) throw new Error("Scheduled workspace no longer exists.");
  if (workspace && workspace.project_id !== projectId) throw new Error("Workspace does not belong to this project.");
  const canDispatch = await input.beforeDispatch();
  if (!canDispatch()) return false;
  const outcome = await runner.execute({
    commandId: schedule.commandId,
    projectId,
    params: (schedule.params ?? {}) as JsonObject,
    workspaceId: workspace?.id,
    workspaceDir: workspace?.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
    source: "schedule",
    metadata: {
      reason: ctx.reason,
      runId: ctx.runId,
      scheduleId: schedule.id,
      scheduleTitle: scheduleTitle(schedule.title),
      scheduledFor: ctx.scheduledFor.toISOString(),
    },
  });
  if (!outcome.ok)
    throw new Error(
      `Extension schedule command "${schedule.commandId}" failed: ${outcome.reason ?? outcome.status ?? "unknown error"}`,
    );
  return true;
};
