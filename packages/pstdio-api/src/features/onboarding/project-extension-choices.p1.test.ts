import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { writeExtension } from "../extensions/default-extensions-test-fixtures";

// Sources are shared by the host; only the requesting project chooses to enable them.
test("new projects reuse installed tools without inheriting another project's choices", async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-project-choices-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify(["pstdio-base-themes", "pstdio-skills"]);
  for (const name of [
    "pstdio-base-themes",
    "pstdio-skills",
    "pstdio-planner",
    "pstdio-reports",
    "pstdio-notes",
    "pstdio-artifacts",
    "harness-codex",
  ]) {
    writeExtension(join(root, "home/extensions", name === "pstdio-planner" ? "planning-alias" : name), name);
  }
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
    const app = handle.app;
    const create = async (name: string) => {
      const response = await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name })),
      });
      expect(response.status).toBe(201);
      return (await response.json()).id as string;
    };
    const first = await create("Coding");
    const second = await create("Empty");
    const enabled = async (projectId: string) =>
      (await handle!.deps.extensionService.listProjectExtensionInstances(projectId))
        .filter(({ instance }) => instance.enabled)
        .map(({ installedSource }) => installedSource.extension_id)
        .sort();
    const foundation = ["pstdio.pstdio-base-themes", "pstdio.pstdio-skills"];
    expect(await enabled(first)).toEqual(foundation);
    expect(await enabled(second)).toEqual(foundation);
    const info = await (await app.request("/v1/onboarding")).json();
    expect(info.installedExtensions).toEqual(expect.arrayContaining(["pstdio.harness-codex", "pstdio.pstdio-planner"]));
    const choose = async (projectId: string, body: unknown) => {
      const response = await app.request(`/v1/onboarding?project_id=${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      await Promise.all(
        handle!.deps.extensionInstallations
          .list()
          .filter((job) => job.projectId === projectId)
          .map((job) => handle!.deps.extensionInstallations.wait(job.id)),
      );
    };
    await choose(first, { step: "harnesses", harnesses: ["codex"] });
    expect(await enabled(first)).toEqual(["pstdio.harness-codex", ...foundation]);
    expect(await enabled(second)).toEqual(foundation);
    await choose(first, { step: "complete", workAreas: [] });
    expect(await enabled(first)).toEqual(["pstdio.harness-codex", ...foundation]);
    await choose(second, { step: "complete", workAreas: ["planning"] });
    expect(await enabled(second)).toEqual([
      "pstdio.pstdio-base-themes",
      "pstdio.pstdio-notes",
      "pstdio.pstdio-planner",
      "pstdio.pstdio-reports",
      "pstdio.pstdio-skills",
    ]);
    expect(await enabled(first)).toEqual(["pstdio.harness-codex", ...foundation]);
  } finally {
    await handle?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(root, { recursive: true, force: true });
  }
});
