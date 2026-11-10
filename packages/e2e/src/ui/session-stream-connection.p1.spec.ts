import { expect, type Request, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const sessionPrompt = (title: string) => `${title} __fake_hold__`;

const isSessionStream = (sent: Request) => new URL(sent.url()).pathname === "/v1/session-stream";

test("reuses one shared connection while switching observed sessions", async ({ page, request }) => {
  const project = await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: "Shared session stream" }) })
  ).json();
  const sessions: { id: string; title: string }[] = [];
  for (const title of ["Session A", "Session B"]) {
    const response = await request.post(`${apiBase}/v1/sessions`, {
      data: {
        project_id: project.id,
        title,
        prompt: sessionPrompt(title),
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(response.ok()).toBe(true);
    sessions.push(await response.json());
  }
  try {
    for (const session of sessions) {
      await expect
        .poll(async () => (await (await request.get(`${apiBase}/v1/sessions/${session.id}`)).json()).status)
        .toBe("in_progress");
    }
    let open = 0;
    let mostOpen = 0;
    let opened = 0;
    const perSessionStreams: string[] = [];
    const subscribed: string[] = [];
    const retained: string[] = [];
    const watchConnections: Array<string | undefined> = [];
    const retainConnections: Array<string | undefined> = [];
    page.on("request", (sent) => {
      const path = new URL(sent.url()).pathname;
      if (isSessionStream(sent)) {
        opened++;
        mostOpen = Math.max(mostOpen, ++open);
      }
      if (/^\/v1\/sessions\/[^/]+\/stream$/.test(path)) perSessionStreams.push(path);
      if (path.endsWith("/subscriptions") && sent.method() === "POST") {
        const subscription = sent.postDataJSON();
        // Native provider watches share this transport and carry their scoped resource
        // in the public command envelope rather than a browser transcript subscription.
        const command = subscription.command;
        const resource = command?.body.resource;
        const connection = /^\/v1\/session-stream\/([^/]+)\/subscriptions$/.exec(path)?.[1];
        if (command?.command_id === "pstdio.pstdio-session-browser.command.watch" && resource?.type === "session") {
          subscribed.push(resource.id);
          watchConnections.push(connection);
        }
        if (subscription.retain_session_id) {
          retained.push(subscription.retain_session_id);
          retainConnections.push(connection);
        }
      }
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
    const sidenav = page.getByRole("region", { name: "Sidenav" }).first();
    await sidenav.getByRole("option", { name: "Sessions", exact: true }).click();
    await sidenav.getByRole("option", { name: "Session A", exact: true }).click();
    await expect.poll(() => subscribed).toEqual([sessions[0]!.id]);
    await expect.poll(() => retained).toEqual([sessions[0]!.id]);
    const connection = watchConnections[0];
    expect(connection).toBeTruthy();
    expect(retainConnections).toEqual([connection]);
    // An unobserved compose draft may have closed its earlier connection. Saved sessions
    // must share this live ownership period without keeping that hidden draft subscribed.
    const openedWithSessionA = opened;
    await sidenav.getByRole("option", { name: "Session B", exact: true }).click();
    await expect.poll(() => subscribed).toEqual([sessions[0]!.id, sessions[1]!.id]);
    await expect.poll(() => retained).toEqual([sessions[0]!.id, sessions[1]!.id]);
    await sidenav.getByRole("option", { name: "Session A", exact: true }).click();
    await expect(page.getByRole("log").getByText(/^Fake Agent: completed "Session A/)).toBeVisible();
    await expect.poll(() => subscribed).toEqual([sessions[0]!.id, sessions[1]!.id, sessions[0]!.id]);
    await expect.poll(() => retained).toEqual([sessions[0]!.id, sessions[1]!.id, sessions[0]!.id]);

    expect(watchConnections).toEqual([connection, connection, connection]);
    expect(retainConnections).toEqual([connection, connection, connection]);
    expect(opened).toBe(openedWithSessionA);
    expect(mostOpen).toBe(1);
    expect(perSessionStreams).toEqual([]);
  } finally {
    for (const session of sessions) {
      await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "cancelled" } });
    }
  }
});
