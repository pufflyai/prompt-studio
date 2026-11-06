import { expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { ProjectFolderRecoveryStatus, ProjectFolderSource } from "pstdio-api-contracts";
import { startFolderRecovery } from "../../../services/relay/folder-recovery";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { documentPeer } from "../../extensions/publication/document-peer.fixture";
import { createProjectRoutes } from "../routes";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 15_000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(20);
  expect(await condition()).toBe(true);
};

test("a new device restores another device's folder copy while that device is offline and attaches it", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "folder-restore-api-")));
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const owners: ReturnType<typeof startFolderRecovery>[] = [];
  try {
    const folder = join(root, "laptop");
    await mkdir(join(folder, "src"), { recursive: true });
    await writeFile(join(folder, "src/notes.md"), "saved without a commit");
    await writeFile(join(folder, ".env"), "TOKEN=private");
    const project = await source.deps.projectService.create({ name: "Recovered folder" });
    await source.deps.workspaceService.ensureDefault({ project_id: project.id, root_path: folder, name: "Folder" });
    // The new device already has the project's records, but no folder.
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    await destination.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
    const start = (app: typeof source, environmentId: string) => {
      const owner = startFolderRecovery({
        deps: app.deps,
        config: {
          accountId: "alice",
          workbenchId: project.id,
          managerOrigin: peer.origin,
          relayOrigin: peer.origin,
          renewalGrant: "grant",
          environmentId,
        },
        signal: controller.signal,
        access: async () => ({ token: environmentId, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        schedule: { quietMs: 20, gapMs: 0 },
      });
      owners.push(owner);
      return owner;
    };
    const laptop = start(source, "laptop");
    const desktop = start(destination, "desktop");
    destination.deps.accountService.folderRecovery = async () => desktop;
    const routes = new OpenAPIHono<AppBindings>().route("/", createProjectRoutes(destination.deps));
    const call = async <T>(path: string, body?: unknown) => {
      const response = await routes.request(`/projects/${project.id}/folder/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as T };
    };
    const laptopCopy = async () =>
      (await call<ProjectFolderSource[]>("sources")).body.find((copy) => copy.deviceId === "laptop");

    // The first enrollment seeded a policy; deleting it is deliberate and the next copy records its absence.
    await until(async () => (await laptopCopy())?.policy === "node_modules/\n");
    await unlink(join(folder, ".pstignore"));
    laptop.capture();
    await until(async () => {
      const copy = await laptopCopy();
      return copy?.policy === null && copy.available;
    });
    laptop.close();
    await laptop.done;

    const listed = (await laptopCopy())!;
    const copy = { deviceId: listed.deviceId, sourceId: listed.sourceId };
    expect(listed).toMatchObject({ current: false, name: expect.any(String), folder, git: "none", files: 2 });
    const restored = join(root, "desktop");
    const started = await call<ProjectFolderRecoveryStatus>("restore", { ...copy, path: restored });
    expect(started.status).toBe(202);
    expect(started.body.restore).toMatchObject({ state: "running", destination: restored });
    let progress = started.body;
    await until(async () => {
      progress = (await call<ProjectFolderRecoveryStatus>("recovery")).body;
      return progress.restore.state !== "running";
    });
    expect(progress.restore).toMatchObject({
      state: "complete",
      error: null,
      files: { completed: 2, total: 2 },
      result: { path: restored, attached: true, git: "none", rewritten: [] },
    });
    expect(progress.download.state).toBe("complete");
    expect(await readFile(join(restored, "src/notes.md"), "utf8")).toBe("saved without a commit");
    expect(await readFile(join(restored, ".env"), "utf8")).toBe("TOKEN=private");
    expect((await destination.deps.workspaceService.getDefault(project.id))?.root_path).toBe(restored);

    // The restored folder is now this device's source; its capture keeps the copy's absent policy.
    await until(async () => (await call<ProjectFolderSource[]>("sources")).body.some((item) => item.current));
    await expect(lstat(join(restored, ".pstignore"))).rejects.toThrow();

    // A project that already has its folder here keeps it; another restore stays beside it.
    const beside = join(root, "beside");
    expect((await call("restore", { ...copy, path: beside })).status).toBe(202);
    await until(async () => (await call<ProjectFolderRecoveryStatus>("recovery")).body.restore.state !== "running");
    expect((await call<ProjectFolderRecoveryStatus>("recovery")).body.restore).toMatchObject({
      state: "complete",
      result: { path: beside, attached: false },
    });
    expect((await destination.deps.workspaceService.getDefault(project.id))?.root_path).toBe(restored);
    expect(await readFile(join(beside, "src/notes.md"), "utf8")).toBe("saved without a commit");

    const again = await call<{ code: string }>("restore", { ...copy, path: restored });
    expect(again).toMatchObject({ status: 409, body: { code: "destination_exists" } });
    const unknown = await call<{ code: string }>("restore", { ...copy, sourceId: "missing", path: join(root, "x") });
    expect(unknown).toMatchObject({ status: 409, body: { code: "source_not_found" } });
  } finally {
    controller.abort();
    await Promise.all(owners.map((owner) => owner.done));
    peer.close();
    await source.close();
    await destination.close();
    await rm(root, { recursive: true, force: true });
  }
});
