import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createExtensionInstallEnvironment } from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import type { ExtensionInstallations } from "../../services/extension-installations";
import { isPackagedRuntime, resolveManagedBunCommand } from "../extensions/extension-bun-runner";
import { runCommand } from "../extensions/install-extension-dependencies";

interface HarnessPackageOwner {
  extensionId: string;
  name: string;
  displayName: string;
}
export const createHarnessPackages = (input: {
  installations: ExtensionInstallations;
  cacheRoot?: string;
  run?: typeof runCommand;
}) => {
  const pending = new Map<string, Promise<{ path: string }>>();
  const root = input.cacheRoot ?? join(resolvePstdioHome(), "cache", "harness-packages");
  const forHarness = (owner: HarnessPackageOwner) => ({
    ensure: (request: { name: string; version: string }) => {
      if (!/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(request.name) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(request.version))
        throw new Error("Harness packages require a package name and an exact version.");
      const target = join(
        root,
        encodeURIComponent(owner.extensionId),
        `${encodeURIComponent(request.name)}@${request.version}`,
      );
      const packagePath = join(target, "node_modules", request.name);
      const existing = pending.get(target);
      if (existing) return existing;
      const operation = (async () => {
        try {
          const manifest = JSON.parse(await readFile(join(packagePath, "package.json"), "utf8"));
          if (manifest.version === request.version) return { path: packagePath };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return input.installations.run(
          { installName: owner.name, extensionId: owner.extensionId, displayName: owner.displayName },
          async (signal) => {
            await mkdir(join(target, ".."), { recursive: true });
            const staging = await mkdtemp(`${target}.`);
            try {
              await writeFile(
                join(staging, "package.json"),
                JSON.stringify({
                  private: true,
                  dependencies: { [request.name]: request.version },
                }),
              );
              const command = resolveManagedBunCommand({
                args: ["install", "--production", "--ignore-scripts"],
                bunCacheDir: join(root, "bun-cache"),
                env: createExtensionInstallEnvironment(process.env),
                isPackaged: isPackagedRuntime(),
                processExecPath: process.execPath,
              });
              const result = await (input.run ?? runCommand)(command.file, command.args, {
                signal,
                cwd: staging,
                env: command.env,
              });
              if (result.exitCode !== 0)
                throw new Error(`Could not install ${request.name}@${request.version}: ${result.stderr.trim()}`);
              const manifest = JSON.parse(
                await readFile(join(staging, "node_modules", request.name, "package.json"), "utf8"),
              );
              if (manifest.version !== request.version)
                throw new Error("The acquired harness package has the wrong version.");
              await rm(target, { recursive: true, force: true });
              await rename(staging, target);
              return { path: packagePath };
            } finally {
              await rm(staging, { recursive: true, force: true });
            }
          },
          target,
        );
      })().finally(() => pending.delete(target));
      pending.set(target, operation);
      return operation;
    },
  });
  return { forHarness };
};
