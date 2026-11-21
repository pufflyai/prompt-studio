import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  l10n,
  params,
} from "@pstdio/sdk/extensions";
import { type Api, connectionApi } from "./connection";
import { releaseEnvironment, renewEnvironmentClaim, stopEnvironment } from "./environments";
import { changed } from "./events";

export interface EnvironmentCleanupInput {
  environmentId: string;
  runId: string;
  stop: boolean;
}

export async function cleanupRunEnvironment(
  deps: { api: Api; store: ExtensionStorageApi },
  input: EnvironmentCleanupInput,
) {
  // Keep ownership through the remote stop, even when a queued job starts after the original lease expired.
  if (!(await renewEnvironmentClaim(deps.store, input.environmentId, input.runId, 1800))) return { stopped: false };
  if (input.stop) await stopEnvironment(deps.api, input.environmentId);
  await releaseEnvironment(deps.store, input.environmentId, input.runId);
  return { stopped: input.stop };
}

export const cleanupEnvironmentCommand = defineCommand({
  id: "environments.cleanup-run",
  title: l10n("remote-testing.stop-test-environment", "Stop test environment"),
  automation: true,
  mutating: true,
  params: {
    environmentId: params.text({ label: l10n("remote-testing.environment-id", "Environment ID"), required: true }),
    runId: params.text({ label: l10n("remote-testing.run-id", "Run ID"), required: true }),
    stop: params.boolean({
      label: l10n("remote-testing.stop-test-environment", "Stop test environment"),
      default: false,
    }),
  },
  async run(ctx, input) {
    const result = await cleanupRunEnvironment(
      { api: connectionApi(ctx.connections), store: ctx.storage },
      {
        ...input,
        stop: input.stop === true,
      },
    );
    await Promise.resolve()
      .then(() => ctx.events.emit(changed, {}))
      .catch(() => {});
    return result;
  },
});

export async function enqueueEnvironmentCleanup(
  ctx: Pick<ExtensionContextBase, "automation" | "logger">,
  input: EnvironmentCleanupInput,
) {
  try {
    await ctx.automation.enqueue({
      command: cleanupEnvironmentCommand.ref,
      input: { params: { ...input } },
      key: `remote-tests:cleanup:${input.runId}:${input.environmentId}`,
    });
  } catch (error) {
    try {
      ctx.logger.error(
        `Could not queue cleanup for environment ${input.environmentId} (run ${input.runId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    } catch {}
    throw error;
  }
}
