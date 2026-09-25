import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { InstalledExtensionSource } from "pstdio-api/extensions/install-extension-source";
import { stopSmokeProcess } from "./smoke-host";
import type { createSmokeContext } from "./smoke-isolation";

export class SmokeInstallError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}
export const installSmokeSource = async (
  context: Awaited<ReturnType<typeof createSmokeContext>>,
  signal: AbortSignal,
) => {
  const outputPath = join(context.root, "install-result.json");
  const args = Bun.embeddedFiles.length ? [] : ["--conditions=source", resolve(import.meta.dirname, "../../index.ts")];
  const child = spawn(
    process.execPath,
    [...args, "--extension-smoke-install-worker", context.source, context.project, outputPath],
    { cwd: context.project, env: context.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const capture = (data: Buffer) => {
    appendFileSync(join(context.root, "evidence/install.log"), data);
    process.stderr.write(data);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  const abort = () => {
    void stopSmokeProcess(child);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", () => resolve());
    });
    signal.throwIfAborted();
    const output = JSON.parse(readFileSync(outputPath, "utf8")) as {
      installed?: InstalledExtensionSource;
      error?: string;
      exitCode?: number;
    };
    if (!output.installed)
      throw new SmokeInstallError(output.error ?? "Installation worker failed.", output.exitCode ?? 3);
    return output.installed;
  } finally {
    signal.removeEventListener("abort", abort);
    await stopSmokeProcess(child);
  }
};
