import { expect } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, realpathSync, renameSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { registerPendingTestProcess } from "../scripts/pending-test-processes";
import { waitForProcessReady } from "../scripts/process-readiness";
import { PACKAGED_BINARY_PATH, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, type startPackagedServe, stopProcess } from "./packaged-serve-helpers";

/** Use both supported CLI install modes, with fresh public artifacts and the real production provider. */
export const expectPackagedSessionsInstall = async (input: {
  started: Awaited<ReturnType<typeof startPackagedServe>>;
  tempRoot: string;
  projectFolder: string;
  projectId: string;
}) => {
  const { started, tempRoot, projectFolder, projectId } = input;
  const source = join(tempRoot, "sources/pstdio-session-browser/extension-source");
  const env = {
    PSTDIO_HOME: tempRoot,
    PSTDIO_API_URL: started.baseUrl,
    PSTDIO_API_TOKEN: started.descriptor.token,
    NPM_CONFIG_USERCONFIG: join(tempRoot, ".npmrc"),
  };
  const child = spawn(PACKAGED_BINARY_PATH, ["extensions", "dev", source, "--name", "pstdio-session-browser"], {
    cwd: projectFolder,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await expectSessionsDevelopment(child, source);
  console.log(
    await runPackagedAsync(
      ["extensions", "add", source, "--force", "--name", "pstdio-session-browser"],
      projectFolder,
      env,
    ),
  );
  const installed = realpathSync(join(tempRoot, "extensions/pstdio-session-browser"));
  expect(installed).toBe(resolve(realpathSync(tempRoot), "extensions/pstdio-session-browser"));
  const dependency = realpathSync(join(installed, "node_modules/@pstdio/sdk"));
  const localPath = relative(join(installed, "node_modules"), dependency);
  expect(localPath.startsWith("..")).toBe(false);
  console.log(`Installed @pstdio/sdk: ${dependency}`);
  // The backend provider uses the pure SDK reducer; UI is independently qualified by public consumers.
  expect(existsSync(join(installed, "node_modules/@pstdio/ui"))).toBe(false);
  // The final installed source/dependencies must work after authoring source becomes unavailable.
  renameSync(source, `${source}.unavailable`);
  expect(existsSync(source)).toBe(false);
  const response = await fetch(`${started.baseUrl}/v1/projects/${projectId}/extensions/ui`, {
    headers: runtimeAuthorization(started.descriptor),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as WorkbenchExtensionMetadata;
};

export const expectSessionsDevelopment = async (child: ChildProcess, source: string) => {
  let output = "";
  const capture = (chunk: Buffer) => {
    output += chunk.toString();
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  try {
    await waitForProcessReady(child, "Sessions dev", async () =>
      output.includes(`watching ${source}`) ? true : undefined,
    );
    expect(output).toContain("validated pstdio.pstdio-session-browser");
    expect(output).toContain("registered pstdio.pstdio-session-browser.view.conversation");
    expect(output).not.toContain("refresh failed");
  } finally {
    // Readiness owns cancellation until it returns; shutdown owns it until the watcher is reaped.
    const lifetime = registerPendingTestProcess(child);
    try {
      await stopProcess(child);
    } finally {
      lifetime.finish();
      child.stdout?.off("data", capture);
      child.stderr?.off("data", capture);
    }
  }
};
