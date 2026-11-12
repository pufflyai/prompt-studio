import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { prepareUiFixtures } from "../scripts/prepare-ui-fixtures";

/** CLI, browser and benchmark fixtures use the same fresh public dependency profile. */
export const preparePackagedConsumers = async (signal: AbortSignal) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-consumers-"));
  let registry: Awaited<ReturnType<typeof startLocalWorkspaceRegistry>> | undefined;
  const close = async () => {
    const started = performance.now();
    console.log("Packaged consumer cleanup started");
    try {
      await registry?.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    console.log(`Packaged consumer cleanup completed (${Math.round(performance.now() - started)}ms)`);
  };
  try {
    const started = performance.now();
    const repoRoot = join(import.meta.dirname, "../../../..");
    const npmConfigPath = join(root, ".npmrc");
    registry = await startLocalWorkspaceRegistry({
      configPath: npmConfigPath,
      outputRoot: join(root, "registry"),
      packagePaths: [join(repoRoot, "packages/sdk"), join(repoRoot, "packages/ui")],
    });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      E2E_HOME: join(root, "home"),
      E2E_BUN_CACHE_DIR: join(root, "bun-cache"),
      NPM_CONFIG_USERCONFIG: npmConfigPath,
    };
    await prepareUiFixtures(env, signal, registry.packageArtifacts);
    signal.throwIfAborted();
    console.log(`Packaged consumer preparation completed (${Math.round(performance.now() - started)}ms)`);
    return { env, close };
  } catch (error) {
    await close();
    throw error;
  }
};
