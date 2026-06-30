import type { CommandNotice, CommandOutcome, RepoContext } from "@pstdio/sdk/extensions";
import { serializeError } from "./internals";
import type { CommandRunnerEnvironment, CommandRunnerHostDeps } from "./types";

export const collectNotices = (env: CommandRunnerEnvironment, notices: CommandNotice[]) => ({
  ...env,
  notify: {
    ...env.notify,
    toast: async (notice: CommandNotice) => {
      notices.push(notice);
      await env.notify.toast(notice);
    },
  },
});

export const withNotices = <TOutcome extends CommandOutcome>(outcome: TOutcome, notices: CommandNotice[]) =>
  notices.length > 0 ? ({ ...outcome, notices } as TOutcome) : outcome;

export const createEnvironmentCache = (
  deps: CommandRunnerHostDeps,
  projectId: string,
  repo: RepoContext | undefined,
  notices: CommandNotice[],
  workspace?: { workspaceDir?: string; workspaceId?: string },
) => {
  const environments = new Map<string, CommandRunnerEnvironment>();

  return async (owner: { extensionId: string; name: string }) => {
    const key = `${owner.extensionId}\0${owner.name}`;
    const existing = environments.get(key);
    if (existing) return existing;

    const env = collectNotices(
      await deps.buildEnvironment({
        projectId,
        extensionId: owner.extensionId,
        name: owner.name,
        repo,
        workspaceDir: workspace?.workspaceDir,
        workspaceId: workspace?.workspaceId,
      }),
      notices,
    );
    environments.set(key, env);
    return env;
  };
};

export const environmentFailedOutcome = <TResult = unknown>(err: unknown): CommandOutcome<TResult> => ({
  ok: false,
  status: "error",
  code: "environment_failed",
  reason: `Failed to build extension environment: ${err instanceof Error ? err.message : String(err)}`,
  error: serializeError(err),
});
