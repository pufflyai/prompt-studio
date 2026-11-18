import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { createProjectViaApi } from "./helpers";
import { startApi } from "./start-api";
import { SETUP_TIMEOUT } from "./timeouts";

const runProjectCommand = async (url: string, cwd: string, ...args: string[]) => {
  const process = Bun.spawn(["bun", "run", join(import.meta.dir, "run-pstdio.ts"), "projects", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...Bun.env,
      PSTDIO_API_URL: url,
      PSTDIO_API_TOKEN: "",
      PSTDIO_HOME: cwd,
      PSTDIO_E2E_CWD: cwd,
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_DISABLE_API_AUTO_START: "1",
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { stdout, stderr, exitCode };
};

test(
  "Cloud project commands require consent and keep the same operation through completion",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-cli-cloud-copies-"));
    const accountFile = join(root, "account.json");
    let projectId: string | undefined;
    let accepted = false;
    let completed = false;
    let starts = 0;
    const projectReads: string[] = [];
    const operation = () => ({
      workbenchId: projectId,
      operationId: "cloud-operation",
      state: completed ? "completed" : "deleting",
      startedAt: "2026-11-18T10:00:00Z",
      completedAt: completed ? "2026-11-18T10:01:00Z" : null,
    });
    const projects = () => (projectId && !accepted ? [{ workbenchId: projectId }] : []);
    const deletions = () => (accepted && !completed ? [operation()] : []);
    const handleDeletion = async (request: Request) => {
      if (request.method === "POST") {
        expect(await request.json()).toEqual({ confirm: true });
        accepted = true;
        starts += 1;
      }
      return accepted ? Response.json(operation()) : Response.json({ error: "No operation" }, { status: 404 });
    };
    const manager = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account") return Response.json({ features: { relay: true }, projectDeletion: true });
        if (path === "/v1/workbenches") return Response.json(projects());
        if (path === "/v1/project-deletions") return Response.json(deletions());
        if (path === "/v1/devices/presence") return Response.json({ ok: true });
        if (path === `/v1/workbenches/${projectId}/deletion`) return handleDeletion(request);
        projectReads.push(path);
        return Response.json({ error: "Fixture Cloud data unavailable" }, { status: 503 });
      },
    });
    let host: Awaited<ReturnType<typeof startApi>> | undefined;
    try {
      host = await startApi({ env: { PSTDIO_ACCOUNT_FILE: accountFile, PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
      const name = "Cloud fixture";
      const project = await createProjectViaApi(host.url, name, root);
      projectId = project.id;
      const client = createClient({ baseUrl: host.url });
      const { environmentId } = await client.runtime.environment();
      // The isolated manager supplies known membership and controls whether cleanup has completed.
      await writeFile(
        accountFile,
        JSON.stringify({
          login: {
            deviceId: environmentId,
            accountId: "fixture-account",
            managerOrigin: manager.url.origin,
            relayOrigin: manager.url.origin,
            token: "fixture-device",
          },
        }),
        { mode: 0o600 },
      );
      await client.projects.update(projectId, { name });
      const run = (...args: string[]) => runProjectCommand(host!.url, root, ...args);
      for (let attempt = 0; !(await client.account.status()).cloudProjects?.includes(projectId); attempt++) {
        if (attempt === 50) throw new Error("Fixture host did not load Cloud membership");
        await Bun.sleep(50);
      }

      const missingDiscard = await run("delete-local", projectId);
      expect(missingDiscard.exitCode).not.toBe(0);
      expect(missingDiscard.stderr).toContain("--discard-unsynced");
      expect(await client.projects.get(projectId)).toMatchObject({ id: projectId });

      const removed = await run("delete-local", projectId, "--discard-unsynced");
      expect(removed.exitCode).toBe(0);
      expect(JSON.parse(removed.stdout)).toEqual({ projectId, presence: "cloud-only" });
      const replay = await run("delete-local", projectId);
      expect(replay.exitCode).toBe(0);
      expect(JSON.parse(replay.stdout)).toEqual(JSON.parse(removed.stdout));
      const readsAfterRemoval = [...projectReads];
      const list = await run("list", "--cloud");
      expect(JSON.parse(list.stdout)).toMatchObject({ projects: [{ id: projectId, presence: "cloud-only" }] });

      const missingConfirmation = await run("delete-cloud", projectId);
      expect(missingConfirmation.exitCode).not.toBe(0);
      expect(missingConfirmation.stderr).toContain("--confirm");
      expect(starts).toBe(0);

      const start = await run("delete-cloud", projectId, "--confirm");
      expect(start.exitCode).toBe(0);
      expect(JSON.parse(start.stdout)).toMatchObject({ projectId, operationId: "cloud-operation", state: "deleting" });
      expect(start.stderr).toContain("Permanently delete");
      expect(JSON.parse((await run("deletion-status", projectId)).stdout)).toEqual(JSON.parse(start.stdout));
      completed = true;
      const retried = await run("delete-cloud", projectId, "--confirm");
      expect(JSON.parse(retried.stdout)).toMatchObject({ operationId: "cloud-operation", state: "completed" });
      expect(starts).toBe(2);
      expect(projectReads).toEqual(readsAfterRemoval);
      await expect(client.projects.get(projectId)).rejects.toMatchObject({ status: 404 });
    } finally {
      await host?.stop();
      await manager.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  },
  SETUP_TIMEOUT,
);
