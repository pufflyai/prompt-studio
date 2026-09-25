import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  checkExtensionsRoot,
  dashboardExtensionHostCapabilities,
  installExtensionSource,
} from "pstdio-api/extensions/install-extension-source";
import { CLI_VERSION } from "../cli-version";

// Extension modules execute during validation. A separate process owns their
// environment, runtime cache and output for the entire production install path.
export const runSmokeInstallWorker = async (args: string[]) => {
  const [source, repoPath, outputPath] = args;
  if (!source || !repoPath || !outputPath) throw new Error("Missing extension smoke worker inputs.");
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const installed = await installExtensionSource({ source, repoPath, env: process.env, signal: controller.signal });
    const check = await checkExtensionsRoot(dirname(installed.targetPath), {
      hostCapabilities: { ...dashboardExtensionHostCapabilities, hostVersion: CLI_VERSION },
    });
    if (check.errorCount) throw new Error(JSON.stringify(check.diagnostics));
    writeFileSync(outputPath, JSON.stringify({ installed }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = message.startsWith("Dependency install failed") ? 3 : 2;
    writeFileSync(outputPath, JSON.stringify({ error: message, exitCode }));
    process.exitCode = exitCode;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
};
