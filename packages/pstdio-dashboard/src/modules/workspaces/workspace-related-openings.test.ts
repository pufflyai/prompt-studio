import { afterEach, expect, test } from "bun:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getWriter } from "@/lib/sync/collections";
import { setupWorkspaceOpening as setup } from "./workspace-related-openings.fixture";

afterEach(() => {
  for (const table of ["sessions", "workspaces", "workspace_sessions"] as const) getWriter(table)?.truncateAndWrite([]);
});

test("workspace opening waits for the initial session memberships before selecting targets", async () => {
  // Initial sync is process-wide and other tests may have completed it already.
  const child = Bun.spawn(
    [
      process.execPath,
      "--conditions",
      "production",
      "--tsconfig-override",
      "tsconfig.app.json",
      fileURLToPath(new URL("./workspace-opening-initial-sync.fixture.ts", import.meta.url)),
    ],
    {
      cwd: resolve(import.meta.dir, "../../.."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [status, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect(status, stderr).toBe(0);
});

test("the workspace owner selects its terminal in Bottom and only its latest session in Side", async () => {
  const s = setup();
  getWriter("sessions")?.truncateAndWrite([
    { id: "older", project_id: "project", title: "Older", archived: false, updated_at: "2026-10-01T00:00:00Z" },
    { id: "latest", project_id: "project", title: "Latest", archived: false, updated_at: "2026-10-02T00:00:00Z" },
    { id: "unrelated", project_id: "project", title: "Other", archived: false, updated_at: "2026-10-03T00:00:00Z" },
  ]);
  getWriter("workspace_sessions")?.truncateAndWrite([
    { id: "a", workspace_id: "workspace", session_id: "older" },
    { id: "b", workspace_id: "workspace", session_id: "latest" },
  ]);
  const openings = await s.resolve();
  expect(openings).toMatchObject([
    { resource: { type: "terminal", id: "workspace:workspace" }, autoOpen: true, region: "secondary", open: "preview" },
    { resource: { type: "session", id: "latest" }, autoOpen: true, region: "side", open: "preview" },
  ]);
  expect(s.workbench.layout.listPanelInstances("secondary")).toEqual([]);
  expect(await s.resolve({ ...s.source, projectId: "other" })).toEqual([]);
});
test("a workspace without a session returns only its terminal, while unavailable terminal contexts return nothing", async () => {
  const s = setup();
  expect(await s.resolve()).toMatchObject([{ resource: { type: "terminal" } }]);
  getWriter("workspaces")?.truncateAndWrite([]);
  expect(await s.resolve()).toEqual([]);
});
