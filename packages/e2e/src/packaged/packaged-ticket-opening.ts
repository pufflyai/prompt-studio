import { expect, type Page } from "../scripts/playwright-test";
import type { Execute } from "./packaged-planner-runtime-fixture";
import { type RuntimeDescriptor, runtimeAuthorization } from "./packaged-serve-helpers";

// Opening must keep its canonical editor usable while secondary file navigation is still loading.
export const expectIndependentTicketOpening = async (
  page: Page,
  execute: Execute,
  baseUrl: string,
  projectId: string,
  descriptor: RuntimeDescriptor,
) => {
  const ticket = await execute<{ id: string; shorthand: string }>("create-ticket", {
    content: "# Independent ticket opening\n\nCanonical content stays editable.",
  });
  const secondary = Promise.withResolvers<void>();
  let fileNavigationStarted = false;
  const pattern = "**/extensions/commands/*/execute";
  await page.route(pattern, async (route) => {
    const request = route.request();
    if (
      new URL(request.url()).pathname ===
        `/v1/projects/${projectId}/extensions/commands/pstdio.planner.view.ticket-files.tree.body/execute` &&
      request.postDataJSON()?.params?.renderer?.resource?.id === ticket.id
    ) {
      fileNavigationStarted = true;
      await secondary.promise;
    }
    await route.continue();
  });
  try {
    const file = await execute<{ id: string }>("create-ticket-file", { ticketId: ticket.id, name: "opening-proof.md" });
    await execute("update-ticket-file", { ticketId: ticket.id, fileId: file.id, content: "# Usable file navigation" });
    // Board cards carry a target already. Exercise the optimized host resolver separately.
    const opening = await page.request.post(`${baseUrl}/v1/projects/${projectId}/resource-openings`, {
      headers: runtimeAuthorization(descriptor),
      data: { resources: [{ type: "ticket", id: ticket.id, projectId, extensionId: "pstdio.planner" }] },
    });
    expect(opening.status()).toBe(200);
    expect(await opening.json()).toMatchObject([
      {
        resource: {
          id: ticket.id,
          shorthand: ticket.shorthand,
          label: `${ticket.shorthand} Independent ticket opening`,
        },
        target: { kind: "page", page: { id: "ticket", extensionId: "pstdio.planner" } },
      },
    ]);
    await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.planner/tickets`);
    const card = page.getByTestId("renderer-card").filter({ has: page.getByText(ticket.shorthand, { exact: true }) });
    await card.click();
    await expect.poll(() => fileNavigationStarted).toBe(true);
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toContainText("Canonical content stays editable.");
    await editor.press("ControlOrMeta+End");
    await editor.pressSequentially(" E4 saved while navigation is pending.");
    await expect
      .poll(async () => (await execute<{ content: string }>("get-ticket", { id: ticket.id })).content)
      .toContain("E4 saved while navigation is pending.");
    secondary.resolve();
    const fileRow = page.getByRole("option", { name: "opening-proof.md", exact: true });
    await expect(fileRow).toBeVisible();
    await expect(editor).toContainText("E4 saved while navigation is pending.");
    await fileRow.click();
    await expect(page).toHaveURL(new RegExp(`document=${file.id}`));
    await expect(editor).toContainText("Usable file navigation");
  } finally {
    secondary.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await execute("delete-ticket", { id: ticket.id });
  }
};
