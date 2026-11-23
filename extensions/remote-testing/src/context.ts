import { join } from "node:path";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { publishBranchTemplate } from "./branch-templates";
import { brokerStorage } from "./broker-storage";
import { connectionApi } from "./connection";
import { enqueueEnvironmentCleanup } from "./environment-cleanup";
import { changed } from "./events";
import { createGoogleTokenProvider, type GoogleAuthentication } from "./google-token";
import type { RunDeps } from "./runs";
import { readSettings } from "./settings";
import { gcsStorage } from "./storage";

const tokenProvider = createGoogleTokenProvider();

async function googleToken(ctx: ExtensionContextBase) {
  const values = await ctx.settings.all();
  const mode = values.googleAuthentication ?? "application-default";
  if (!["application-default", "gcloud", "metadata"].includes(String(mode)))
    throw new Error("Select a supported Google authentication method.");
  return tokenProvider(mode as GoogleAuthentication, ctx.process);
}

export async function projectRoot(ctx: ExtensionContextBase) {
  const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : await ctx.workspaces.getDefault();
  const root = workspace?.rootPath ?? (await ctx.workspaces.getDefault())?.rootPath;
  if (!root) throw new Error("Pass --path with the repository folder to test.");
  return root;
}

export async function runDeps(ctx: ExtensionContextBase): Promise<RunDeps> {
  const values = await ctx.settings.all();
  const { settings, problems } = readSettings(values);
  if (problems.length) throw new Error(`Remote testing is not configured. ${problems.join(" ")}`);
  return {
    projectId: ctx.projectId,
    api: connectionApi(ctx.connections),
    cleanupEnvironment: (input) => enqueueEnvironmentCleanup(ctx, input),
    publishTemplate: (kind, source, signal) => publishBranchTemplate(ctx, kind, source, signal),
    storage:
      values.googleAuthentication === "broker"
        ? brokerStorage(ctx.connections)
        : gcsStorage({
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
