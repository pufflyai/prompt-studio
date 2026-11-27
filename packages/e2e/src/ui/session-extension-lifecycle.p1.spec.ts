import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { observeEventConnectionBudget } from "../helpers/event-connection-budget";
import { expect, test } from "../scripts/session-test";
import {
  createResourceActionsProject,
  openSessionSidePanel,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";

// Critical risk: losing access to a harness must leave the saved transcript visible.
test("a saved session opens after its harness is disabled", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  try {
    const created = await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: "Saved session",
        prompt: "Keep this transcript",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(created.ok()).toBe(true);
    const { id } = await created.json();
    const sessionPath = `/v1/sessions/${id}`;
    await expect.poll(async () => (await (await request.get(sessionPath)).json()).status).toBe("completed");
    await expect
      .poll(
        async () => (await (await request.get(`${sessionPath}/conversation/sources`)).json()).checkpoint?.length ?? 0,
      )
      .toBeGreaterThanOrEqual(2);
    const catalog = await (await request.get(`/v1/projects/${project.id}/extensions`)).json();
    const harness = catalog.extensions.find(
      (extension: { installName: string }) => extension.installName === "workbench-fixture",
    );
    expect(harness).toBeTruthy();
    const disabled = await request.patch(`/v1/projects/${project.id}/extensions/${harness.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
    expect((await request.get(`${sessionPath}/harness-commands`)).status()).toBe(400);

    await prepareResourceActionsDashboard(page, project.id);
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${id}`);
    await page.goto(`/projects/${project.id}/extensions/pstdio.session-browser/conversation?resource=${resource}`);
    await expect(page.getByRole("log").getByText('Fake Agent: completed "Keep this transcript"')).toBeVisible();
    await expect(page.getByText("Conversation action failed")).toHaveCount(0);
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
  }
});

// Critical risk: disabling a presentation provider must release its observers,
// preserve unsent work and leave execution, workspaces and Settings usable.
test("Sessions can be disabled and restored without losing drafts or stopping its agent", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  // One session opens in one panel at a time: the held agent stays in Side, another conversation is in Main.
  let heldId: string | undefined;
  let mainId: string | undefined;
  try {
    const create = async (title: string, prompt: string) => {
      const created = await request.post("/v1/sessions", {
        data: { project_id: project.id, title, prompt, agent: "pstdio.workbench-fixture.harness.fake" },
      });
      expect(created.ok()).toBe(true);
      return (await created.json()).id as string;
    };
    heldId = await create("Retained execution", "Keep working __fake_hold__");
    mainId = await create("Main conversation", "Main conversation");
    const readSession = async () => (await request.get(`/v1/sessions/${heldId}`)).json();
    await expect.poll(async () => (await readSession()).status).toBe("in_progress");
    await expect.poll(async () => Boolean((await readSession()).agent_session_id)).toBe(true);
    const before = await readSession();
    const listed = await (await request.get(`/v1/projects/${project.id}/extensions`)).json();
    const provider = listed.extensions.find(
      (entry: { installName: string }) => entry.installName === "session-browser",
    );
    expect(provider).toBeTruthy();
    const watches = new Map<string, string[]>([
      [heldId, []],
      [mainId, []],
    ]);
    const holds = new Map<string, string[]>([
      [heldId, []],
      [mainId, []],
    ]);
    const allWatches = () => [...watches.values()].flat();
    const deleted: string[] = [];
    let stops = 0;
    const budget = await observeEventConnectionBudget(page);
    page.on("request", (sent) => {
      const path = new URL(sent.url()).pathname;
      if (path.endsWith("/subscriptions") && sent.method() === "POST") {
        const body = sent.postDataJSON();
        if (body.command?.command_id === "pstdio.session-browser.command.watch")
          watches.get(body.command.body.resource?.id)?.push(body.subscription_id);
        holds.get(body.retain_session_id)?.push(body.subscription_id);
      }
      if (sent.method() === "DELETE" && path.includes("/session-stream/")) deleted.push(path.split("/").at(-1)!);
      if (path.endsWith("chat.onAction/execute") && sent.postDataJSON()?.params?.action?.type === "stop") stops++;
    });
    await prepareResourceActionsDashboard(page, project.id);
    const conversationPath = `/projects/${project.id}/extensions/pstdio.session-browser/conversation`;
    const target = `${conversationPath}?resource=${encodeURIComponent(`pstdio://extension-resource/session/${mainId}`)}`;
    await page.goto(target);
    const main = page.locator('[data-workbench-region="main"]');
    const side = page.locator('[data-workbench-region="side"]');
    const composer = '[data-testid="content-editable"][contenteditable="true"]';
    const editor = main.locator(composer).filter({ visible: true });
    await expect(editor).toBeVisible();
    await openSessionSidePanel(page, "Retained execution");
    const sideEditor = side.locator(composer).filter({ visible: true });
    await expect(sideEditor).toBeVisible();
    await expect.poll(() => watches.get(heldId!)!.length).toBe(1);
    await expect.poll(() => watches.get(mainId!)!.length).toBe(1);
    await expect.poll(() => holds.get(heldId!)!.length).toBe(1);
    expect(budget.state().active.some((url) => new URL(url).pathname === "/v1/session-stream")).toBe(true);
    const saveDraft = async (region: typeof main, text: string, file: string) => {
      await region.locator(composer).filter({ visible: true }).fill(text);
      const chooser = page.waitForEvent("filechooser");
      await region.getByRole("button", { name: "Attach files", exact: true }).click();
      await (await chooser).setFiles({ name: file, mimeType: "text/plain", buffer: Buffer.from("Durable attachment") });
      await expect(region.getByRole("button", { name: `Remove ${file}`, exact: true })).toBeVisible();
    };
    await saveDraft(side, "Retained work survives provider disablement", "retained.txt");
    await saveDraft(main, "Unsent work survives provider disablement", "main.txt");
    const tabs = await side
      .locator("[data-workbench-tab]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workbench-tab")));
    const projectNavigation = async () => {
      const back = page.getByRole("button", { name: "Back to project", exact: true });
      if (await back.isVisible()) await back.click();
    };
    await projectNavigation();
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(1);
    const disabled = await request.patch(`/v1/projects/${project.id}/extensions/${provider.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
    // Disabling the provider releases every observer it owned, in Main and in Side.
    await expect.poll(() => allWatches().every((id) => deleted.includes(id))).toBe(true);
    // Core owns saved resource membership across inactive pages and provider disablement.
    // The held agent's one shared hold remains until its retained resource is explicitly removed.
    expect(holds.get(heldId)).toHaveLength(1);
    expect(deleted).not.toContain(holds.get(heldId)![0]!);
    expect(stops).toBe(0);
    expect(await readSession()).toMatchObject({
      id: heldId,
      status: "in_progress",
      agent_session_id: before.agent_session_id,
    });
    expect((await request.get(`/v1/sessions/${heldId}/conversation`)).ok()).toBe(true);
    expect((await request.get(`/v1/workspaces/${before.workspace_id}/files`)).ok()).toBe(true);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await expect(page.getByText("Appearance", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    const enabled = await request.patch(`/v1/projects/${project.id}/extensions/${provider.id}`, {
      data: { enabled: true },
    });
    expect(enabled.ok()).toBe(true);
    await projectNavigation();
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(1);
    // Core owns panel visibility; reopening activates the existing retained tab with its draft.
    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Side Panel", exact: true })
      .getByRole("button", { name: "Reattach Side Panel", exact: true })
      .click();
    await expect(sideEditor).toContainText("Retained work survives provider disablement");
    await expect(side.getByRole("button", { name: "Remove retained.txt", exact: true })).toBeVisible();
    expect(
      await side
        .locator("[data-workbench-tab]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workbench-tab"))),
    ).toEqual(tabs);
    // History/deep-link restoration addresses Main explicitly and restores its draft.
    await page.evaluate((url) => {
      history.pushState(null, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, target);
    // The owner refreshes a linked reference to its canonical form, so compare the resource it names.
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === conversationPath &&
        defaultPageResourceCodec.fromUri(url.searchParams.get("resource") ?? "")?.id === mainId,
    );
    await expect(editor).toContainText("Unsent work survives provider disablement");
    await expect(main.getByRole("button", { name: "Remove main.txt", exact: true })).toBeVisible();
    await expect.poll(() => watches.get(heldId!)!.length).toBe(2);
    await expect.poll(() => watches.get(mainId!)!.length).toBe(2);
    expect(new Set(allWatches()).size).toBe(4);
    expect(holds.get(heldId)).toHaveLength(1);
    expect(deleted).not.toContain(holds.get(heldId)![0]!);
    expect(stops).toBe(0);
    expect(await readSession()).toMatchObject({
      id: heldId,
      status: "in_progress",
      agent_session_id: before.agent_session_id,
    });
    // The same held harness continues after presentation is restored, then exits normally.
    writeFileSync(join(before.cwd, ".fake-hold-release"), "release");
    await expect.poll(async () => (await readSession()).status).toBe("completed");
    expect((await readSession()).agent_session_id).toBe(before.agent_session_id);
    // Remove the completed test resources while this project/client are still active.
    // Project teardown can close the whole transport instead of deleting each interest.
    for (const id of [heldId, mainId]) {
      const removed = await request.delete(`/v1/sessions/${id}`);
      expect(removed.ok()).toBe(true);
      expect((await request.get(`/v1/sessions/${id}`)).status()).toBe(404);
    }
    // Server ends need no DELETE, and inactive cached views may still own interests.
    // Client disconnect is the terminal boundary that releases every remaining claim.
    await page.goto("about:blank");
    await expect.poll(() => budget.state().active.length).toBe(0);
    budget.assert();
    expect(stops).toBe(0);
    heldId = undefined;
    mainId = undefined;
  } finally {
    for (const id of [heldId, mainId])
      if (id) await request.patch(`/v1/sessions/${id}/status`, { data: { status: "cancelled" } });
    await request.delete(`/v1/projects/${project.id}`);
  }
});
