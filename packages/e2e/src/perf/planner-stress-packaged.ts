import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary, PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { plannerSource } from "../packaged/packaged-planner-runtime-fixture";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../packaged/packaged-serve-helpers";

export async function startPlannerStressRuntime() {
  buildBinary();
  const home = mkdtempSync(join(tmpdir(), "pstdio-planner-stress-"));
  const started = await startPackagedServe(home, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" }).catch((error) => {
    rmSync(home, { recursive: true, force: true });
    throw error;
  });
  const stop = async () => {
    await stopProcess(started.child);
    rmSync(home, { recursive: true, force: true });
  };
  try {
    const folder = join(home, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "project" }, folder)),
    });
    if (!response.ok) throw new Error(`Creating the stress project failed: HTTP ${response.status}`);
    execFileSync(PACKAGED_BINARY_PATH, ["extensions", "add", plannerSource, "--name", "pstdio-planner"], {
      cwd: folder,
      env: {
        ...process.env,
        HOME: home,
        PSTDIO_HOME: home,
        PSTDIO_API_URL: started.baseUrl,
        PSTDIO_API_TOKEN: started.descriptor.token,
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    const connectionPath = join(home, "connection.json");
    writeFileSync(
      connectionPath,
      JSON.stringify({
        apiPort: Number(new URL(started.baseUrl).port),
        apiToken: started.descriptor.token,
        dashboardUrl: started.baseUrl,
      }),
      { mode: 0o600 },
    );
    return { connectionPath, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
