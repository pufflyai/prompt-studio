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
    let mostNetworkOpen = 0;
    let opened = 0;
    const network: Array<{ event: string; at: number }> = [];
    const perSessionStreams: string[] = [];
    const subscribed: string[] = [];
    const retained: string[] = [];
    const watchConnections: Array<string | undefined> = [];
    const retainConnections: Array<string | undefined> = [];
    page.on("request", (sent) => {
      const path = new URL(sent.url()).pathname;
      if (isSessionStream(sent)) {
        if (network.length < 128) network.push({ event: "request", at: Date.now() });
        opened++;
        mostNetworkOpen = Math.max(mostNetworkOpen, ++open);
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
      if (isSessionStream(sent)) {
        if (network.length < 128) network.push({ event: "closed", at: Date.now() });
        open--;
      }
    };
    page.on("requestfinished", closed);
    page.on("requestfailed", closed);
    await page.addInitScript(() => {
      const evidence = {
        records: [] as Array<Record<string, unknown>>,
        open: 0,
        mostOpen: 0,
        pending: 0,
        mostPending: 0,
      };
      Reflect.set(window, "sessionStreamEvidence", evidence);
      const original = window.fetch;
      window.fetch = Object.assign((...args: Parameters<typeof original>) => {
        const input = args[0];
        const url = input instanceof Request ? input.url : String(input);
        const signal = args[1]?.signal ?? (input instanceof Request ? input.signal : undefined);
        if (new URL(url, location.href).pathname !== "/v1/session-stream") return original.call(window, ...args);
        const record = { started: Date.now(), url, signalAborted: signal?.aborted } as Record<string, unknown>;
        if (evidence.records.length < 16) evidence.records.push(record);
        evidence.mostOpen = Math.max(evidence.mostOpen, ++evidence.open);
        evidence.mostPending = Math.max(evidence.mostPending, ++evidence.pending);
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          evidence.open--;
        };
        signal?.addEventListener(
          "abort",
          () => {
            record.aborted = Date.now();
            record.stack = new Error().stack;
            close();
          },
          { once: true },
        );
        if (signal?.aborted) close();
        const result = original.call(window, ...args);
        void result.then(
          () => {
            evidence.pending--;
            record.headers = Date.now();
          },
          (error: unknown) => {
            evidence.pending--;
            record.failed = Date.now();
            record.error = String(error);
            close();
          },
        );
        return result;
      }, original);
    });
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

    try {
      expect(watchConnections).toEqual([connection, connection, connection]);
      expect(retainConnections).toEqual([connection, connection, connection]);
      expect(opened).toBe(openedWithSessionA);
      // CDP can report an aborted request after its replacement starts. Keep ownership
      // and actual fetch-acquisition bounds separate; abort alone does not settle acquisition.
      const browser = await page.evaluate(() => Reflect.get(window, "sessionStreamEvidence"));
      expect(browser.mostOpen).toBe(1);
      expect(browser.mostPending).toBe(1);
      expect(perSessionStreams).toEqual([]);
    } catch (error) {
      try {
        const browser = await page.evaluate(() => Reflect.get(window, "sessionStreamEvidence"));
        await test.info().attach("session-stream-lifetime", {
          body: JSON.stringify({ browser, network, mostNetworkOpen, watchConnections, retainConnections }, null, 2),
          contentType: "application/json",
        });
      } catch (attachmentError) {
        console.error("Could not attach session stream lifetime evidence", attachmentError);
      }
      throw error;
    }
  } finally {
    for (const session of sessions) {
      await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "cancelled" } });
    }
  }
});
