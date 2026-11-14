import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("the shipped native runtime writes and reopens a record after a clean shutdown", async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "native-artifact-")));
  let runtime: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    runtime = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Native artifact persistence" }, home)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    await stopProcess(runtime.child);
    runtime = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const reopened = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}`, {
      headers: runtimeAuthorization(runtime.descriptor),
    });
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ id: project.id, name: "Native artifact persistence" });
  } finally {
    if (runtime) await stopProcess(runtime.child);
    rmSync(home, { recursive: true, force: true });
  }
});
