import { expect, type Request, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const isSessionStream = (sent: Request) => new URL(sent.url()).pathname === "/v1/session-stream";

test("streams every opened session over one shared connection", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Shared session stream" }) })
  ).json();
  const sessions: { id: string; title: string }[] = [];
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: { project_id: project.id, title, prompt: title, agent: "pstdio.workbench-fixture.harness.fake" },
    });
    expect(response.ok()).toBe(true);
    sessions.push(await response.json());
  }
  for (const session of sessions) {
    await expect
      .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${session.id}`)).json()).status)
      .toBe("completed");
    // A running session keeps its stream subscription open.
    await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "in_progress" } });
  }
  let open = 0;
  let mostOpen = 0;
  let opened = 0;
  const perSessionStreams: string[] = [];
  const subscribed: string[] = [];
  page.on("request", (sent) => {
    const path = new URL(sent.url()).pathname;
    if (isSessionStream(sent)) {
      opened++;
      mostOpen = Math.max(mostOpen, ++open);
    }
    if (/^\/v1\/sessions\/[^/]+\/stream$/.test(path)) perSessionStreams.push(path);
    if (path.endsWith("/subscriptions") && sent.method() === "POST") subscribed.push(sent.postDataJSON().session_id);
  });
  const closed = (sent: Request) => {
    if (isSessionStream(sent)) open--;
  };
  page.on("requestfinished", closed);
  page.on("requestfailed", closed);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("button", { name: "Session A", exact: true }).click();
  await expect.poll(() => subscribed).toEqual([sessions[0]!.id]);
  const sidenav = page.getByRole("region", { name: "Sidenav" }).first();
  await sidenav.getByRole("option", { name: "Session B", exact: true }).click();
  await expect.poll(() => subscribed).toEqual([sessions[0]!.id, sessions[1]!.id]);
  await sidenav.getByRole("option", { name: "Session A", exact: true }).click();
  await expect(page.getByText('Fake Agent: completed "Session A"', { exact: true })).toBeVisible();

  expect(opened).toBe(1);
  expect(mostOpen).toBe(1);
  expect(perSessionStreams).toEqual([]);
});
