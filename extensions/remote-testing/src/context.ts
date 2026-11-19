import { join } from "node:path";
import { type ExtensionContextBase, eventRef } from "@pstdio/sdk/extensions";
import { publishBranchTemplate } from "./branch-templates";
import { connectionApi } from "./connection";
import type { RunDeps } from "./runs";
import { readSettings } from "./settings";
import { gcsStorage } from "./storage";

// Views refresh when runs or environments change.
export const changed = eventRef({ extensionId: "pocketcoder.remote-testing", id: "changed" });

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

export async function runDeps(ctx: ExtensionContextBase): Promise<RunDeps> {
  const { settings, problems } = readSettings(await ctx.settings.all());
  if (problems.length) throw new Error(`Remote testing is not configured. ${problems.join(" ")}`);
  return {
    projectId: ctx.projectId,
    api: connectionApi(ctx.connections),
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

export { googleToken };
