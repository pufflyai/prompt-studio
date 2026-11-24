import { join } from "node:path";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { publishBranchTemplate } from "./branch-templates";
import { collectRun } from "./collection";
import { connectionApi } from "./connection";
import { enqueueEnvironmentCleanup, resumeEnvironmentCleanups } from "./environment-cleanup";
import { changed } from "./events";
import { enqueueRunLog } from "./run-log";
import type { RunDeps } from "./runs";
import { readSettings } from "./settings";
import { gcsStorage } from "./storage";

let cachedToken: { value: string; until: number } | undefined;

// The developer's Application Default Credentials; refreshed by gcloud, never stored here.
async function googleToken(ctx: ExtensionContextBase) {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const result = await ctx.process.run({
    command: ["gcloud", "auth", "application-default", "print-access-token"],
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0)
    throw new Error(`Google login is missing. Run: gcloud auth application-default login\n${result.stderr.trim()}`);
  cachedToken = { value: result.stdout.trim(), until: Date.now() + 30 * 60_000 };
  return cachedToken.value;
}

export async function projectRoot(ctx: ExtensionContextBase) {
  const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : await ctx.workspaces.getDefault();
  const root = workspace?.rootPath ?? (await ctx.workspaces.getDefault())?.rootPath;
  if (!root) throw new Error("Pass --path with the repository folder to test.");
  return root;
}

export async function runDeps(ctx: ExtensionContextBase, options: { recover?: boolean } = {}): Promise<RunDeps> {
  const { settings, problems } = readSettings(await ctx.settings.all());
  if (problems.length) throw new Error(`Remote testing is not configured. ${problems.join(" ")}`);
  if (options.recover !== false) await resumeEnvironmentCleanups(ctx);
  return {
    projectId: ctx.projectId,
    api: connectionApi(ctx.connections),
    cleanupEnvironment: (input) => enqueueEnvironmentCleanup(ctx, input),
    collectRunLog: (runId) => enqueueRunLog(ctx, runId),
    recoverRun: (runId) =>
      ctx.automation
        .enqueue({
          command: collectRun.ref,
          input: { params: { runId } },
          key: `remote-tests:collect:${runId}:first`,
        })
        .catch((error) => {
          ctx.logger.error(`Could not admit collector for uncertain submission ${runId}: ${String(error)}`);
          throw error;
        }),
    publishTemplate: (kind, source, signal) => publishBranchTemplate(ctx, kind, source, signal),
    storage: gcsStorage({
      bucket: settings.storageBucket,
      signer: settings.signerAccount,
      token: () => googleToken(ctx),
    }),
    store: ctx.storage,
    process: ctx.process,
    settings,
    async saveLog(runId, text) {
      const path = `runs/${runId}.log`;
      if (!ctx.extensionFiles) throw new Error("This project has no folder for run logs.");
      await ctx.extensionFiles.writeText(path, text);
      const root = (await ctx.workspaces.getDefault())?.rootPath;
      // The host keeps extension files under the extension ID.
      return root ? join(root, ".pstdio/extension-storage", ctx.extensionId, path) : path;
    },
    changed: () => ctx.events.emit(changed, {}),
  };
}

export { changed, googleToken };
