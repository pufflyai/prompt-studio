import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { waitForDefaultExtensions } from "../scripts/default-extensions-readiness";
import { cleanupDirs, createProjectViaApi, createTempDir, runPstdioAsync } from "./helpers";
import { waitFor } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];
beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") } });
  await waitForDefaultExtensions(api.process, api.logPath);
}, SETUP_TIMEOUT);
afterAll(async () => {
  await api?.stop();
});
afterEach(() => cleanupDirs(dirs));

const command = async <T>(projectId: string, id: string, params: object) => {
  const res = await fetch(
    `${api.url}/v1/projects/${projectId}/extensions/commands/pstdio.planner.command.${id}/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "api", params }),
    },
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { outcome: { ok: boolean; value: T; error?: unknown } };
  if (!body.outcome.ok) throw new Error(JSON.stringify(body.outcome.error));
  return body.outcome.value;
};

test(
  "installed Planner starts and resumes independent attempts in a project without Git",
  async () => {
    const folder = createTempDir();
    dirs.push(folder);
    const project = await createProjectViaApi(api.url, "Folder attempt", folder);
    await runPstdioAsync(
      ["extensions", "add", resolve(import.meta.dirname, "../../../../extensions/pstdio-planner"), "--force"],
      folder,
      { PSTDIO_API_URL: api.url },
    );
    const workspaces = async () =>
      (await (await fetch(`${api.url}/v1/workspaces?project_id=${project.id}`)).json()) as {
        id: string;
        root_path: string;
      }[];
    const [home] = await workspaces();
    const boardPath = `${api.url}/v1/projects/${project.id}/boards/pstdio.planner.view.tickets`;
    const fields = await fetch(boardPath);
    expect(fields.status).toBe(200);
    expect((await fields.json()).fields.some((field: { id: string }) => field.id === "status")).toBe(true);
    const saved = await fetch(`${boardPath}/views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Saved ticket view", filter: { conjunction: "and", rules: [] } }),
    });
    expect(saved.status).toBe(201);
    type Started = {
      variant: { id: string; workspaceId: string; base: null };
      session: { id: string };
      workspace: { id: string };
    };
    const agent = { harnessId: "pstdio.workbench-fixture.harness.fake" };
    const ticket = await command<{ id: string }>(project.id, "create-ticket", { content: "# Write in this folder" });
    const start = await command<Started>(project.id, "run-attempt", { ticket: ticket.id, agent });
    expect(start.variant).toMatchObject({ workspaceId: home!.id, base: null });
    expect(start.variant.id).not.toBe(home!.id);
    const session = async (id: string) =>
      (await (await fetch(`${api.url}/v1/sessions/${id}`)).json()) as { status: string; cwd: string };
    expect(realpathSync((await session(start.session.id)).cwd)).toBe(realpathSync(folder));
    expect(await waitFor(async () => (await session(start.session.id)).status === "completed")).toBe(true);
    const resumed = await command<Started>(project.id, "run-attempt", { ticket: ticket.id, agent });
    expect(resumed.session.id).toBe(start.session.id);
    expect(resumed.variant.id).toBe(start.variant.id);
    expect(await waitFor(async () => (await session(start.session.id)).status === "completed")).toBe(true);
    const other = await command<{ id: string }>(project.id, "create-ticket", { content: "# Another folder task" });
    const next = await command<Started>(project.id, "run-attempt", { ticket: other.id, agent });
    expect(next.variant.id).not.toBe(start.variant.id);
    const history = await command<{ events: { attemptId: string }[] }>(project.id, "read-attempt-history", {
      attemptId: start.variant.id,
    });
    expect(history.events.length).toBeGreaterThanOrEqual(2);
    expect(history.events.every((event) => event.attemptId === start.variant.id)).toBe(true);
    expect(await workspaces()).toHaveLength(1);
    expect(existsSync(join(folder, ".git"))).toBe(false);
    expect(await waitFor(async () => (await session(next.session.id)).status === "completed")).toBe(true);
  },
  TEST_TIMEOUT,
);
