import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCliHelpExtension } from "../helpers/cli-help-extension";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { enablePackagedProjectExtension } from "./packaged-project-extensions";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("packaged command help translates parameter descriptions", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-cli-help-"));
  let child: ChildProcess | undefined;
  try {
    writeCliHelpExtension(root);
    const started = await startPackagedServe(root);
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "CLI help" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    await enablePackagedProjectExtension(started, project.id, "help-fixture");
    for (const [locale, description] of [
      ["en_US.UTF-8", "Compare the current revision."],
      ["fr_FR.UTF-8", "Comparer la révision actuelle."],
    ]) {
      const result = spawnSync(PACKAGED_BINARY_PATH, ["help-fixture", "read", "--project-id", project.id, "--help"], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PSTDIO_HOME: root,
          PSTDIO_API_URL: started.baseUrl,
          PSTDIO_API_TOKEN: started.descriptor.token,
          LC_ALL: locale,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(`--revision <number>  ${description}`);
    }
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
