import { expect, test } from "@playwright/test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// A fork from the wrong reply silently includes context the user meant to leave behind.
test("the reply footer forks its own message and keeps failed copies available for retry", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const response = await request.post("/v1/sessions", {
    data: {
      project_id: project.id,
      title: "Two approaches",
      prompt: "First approach",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  const source = await response.json();
  await expect
    .poll(async () => (await (await request.get(`/v1/sessions/${source.id}`)).json()).status)
    .toBe("completed");
  const first = (await (await request.get(`/v1/sessions/${source.id}/conversation`)).json()).messages.find(
    (message: { role: string }) => message.role === "assistant",
  );
  await request.post(`/v1/sessions/${source.id}/follow-up`, { data: { prompt: "Second approach" } });
  await expect
    .poll(async () => (await (await request.get(`/v1/sessions/${source.id}`)).json()).status)
    .toBe("completed");
  const fork = await (
    await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: "Two approaches (fork)",
        prompt: "",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    })
  ).json();
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", { name: "Two approaches", exact: true })
    .click();
  const reply = page.locator(`[data-chat-message-id="${first.id}"]`);
  await reply.hover();
  const button = reply.getByRole("button", { name: "Fork conversation", exact: true });
  await expect(reply.getByRole("button", { name: "Copy message", exact: true })).toBeVisible();
  await page.route(`**/v1/sessions/${source.id}/fork?*`, async (route) => {
    expect(new URL(route.request().url()).searchParams.get("messageId")).toBe(first.id);
    await route.fulfill({ status: 503, json: { error: "Copy unavailable. Try again." } });
  });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(reply.getByRole("alert")).toContainText("Copy unavailable");
  await expect(page).toHaveURL(new RegExp(source.id));
  await page.unroute(`**/v1/sessions/${source.id}/fork?*`);
  await page.route(`**/v1/sessions/${source.id}/fork?*`, (route) => route.fulfill({ status: 201, json: fork }));
  await button.click();
  await expect(page).toHaveURL(new RegExp(fork.id));
});
