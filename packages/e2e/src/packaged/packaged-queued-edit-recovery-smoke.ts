import { type Browser, expect } from "@playwright/test";
import type { PendingQueuedFollowUpsResponse, Session, SessionAttachment } from "pstdio-api-contracts";
import { logQueuedPhase } from "./packaged-queued-fixture";

export const expectPackagedQueuedEditRecovery = async (
  browser: Browser,
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
  scenario: "occupied" | "empty" | "remaining",
) => {
  const page = await browser.newPage({ extraHTTPHeaders: headers });
  try {
    const request = async <T>(path: string, method = "GET", data?: unknown) => {
      const response = await page.request.fetch(`${baseUrl}/v1${path}`, { method, data });
      expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
      return (await response.json()) as T;
    };
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId);
    logQueuedPhase(scenario, "create recovery session");
    const session = await request<Session>("/sessions", "POST", {
      project_id: projectId,
      title: `Edit recovery ${scenario}`,
      agent: "test.queue-smoke.harness.worker",
      prompt: "Active work",
      model: "one",
      params: { thinking: "high" },
    });
    const path = `/sessions/${session.id}/queued-follow-ups`;
    await expect
      .poll(async () => (await request<PendingQueuedFollowUpsResponse>(path)).activeRunStartedAt)
      .toBeTruthy();
    const uploaded = await page.request.post(`${baseUrl}/v1/projects/${projectId}/session-attachments`, {
      headers: { "content-type": "text/plain", "x-file-name": "saved-context.txt" },
      data: "Saved context",
    });
    expect(uploaded.ok()).toBe(true);
    const savedFile = (await uploaded.json()) as SessionAttachment;
    await request(`/sessions/${session.id}/follow-up`, "POST", {
      prompt: "Recovery request",
      model: "one",
      params: { thinking: "high" },
      attachments: [{ file_id: savedFile.file_id }],
    });
    if (scenario === "remaining")
      await request(`/sessions/${session.id}/follow-up`, "POST", { prompt: "Other request" });
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${session.id}`);
    logQueuedPhase(scenario, "open queued editor");
    await page.goto(`${baseUrl}/projects/${projectId}/session?resource=${resource}`);
    const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
    const view = page.locator("[data-workbench-instance]").filter({ has: editor });
    await expect(editor).toBeEditable();
    await expect(view).toHaveCount(1);
    if (scenario === "occupied") {
      await editor.fill("Independent draft");
      await view
        .locator('input[type="file"]')
        .last()
        .setInputFiles({
          name: "independent-draft.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Independent file"),
        });
      await expect(page.getByRole("button", { name: "Remove independent-draft.txt", exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Edit queued message: Recovery request", exact: true }).click();
    await editor.fill("Retained complete edit");
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    expect(await cancel.evaluate((element) => element.nextElementSibling?.textContent)).toBe("Update");
    await page.getByRole("button", { name: "Select model", exact: true }).click();
    await page
      .getByTestId("workspace-agent-model-options")
      .filter({ visible: true })
      .getByText("two", { exact: true })
      .click();
    await page.getByRole("button", { name: "thinking: High", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Low", exact: true }).click();
    const editUpload = page.waitForResponse(
      (response) => response.url().endsWith("/session-attachments") && response.request().method() === "POST",
    );
    await view
      .locator('input[type="file"]')
      .last()
      .setInputFiles({ name: "edited-context.txt", mimeType: "text/plain", buffer: Buffer.from("Edited context") });
    const editedFile = (await (await editUpload).json()) as SessionAttachment;
    await expect(page.getByRole("button", { name: "Remove edited-context.txt", exact: true })).toBeVisible();
    logQueuedPhase(scenario, "steer edited request and recover draft");
    const queue = await request<PendingQueuedFollowUpsResponse>(path);
    const selected = queue.requests.find((item) => item.prompt === "Recovery request")!;
    const result = await request<{ status: string }>(`${path}/${selected.queuePosition}/steer`, "POST", {
      expectedRevision: selected.revision,
      expectedRunStartedAt: queue.activeRunStartedAt,
    });
    expect(result.status, JSON.stringify(result)).toBe("accepted");
    const notice = page.getByRole("status", { name: "Queued edit notice" });
    await expect(notice).toContainText("sent");
    expect(
      await notice.evaluate((element) =>
        Boolean(element.previousElementSibling?.querySelector('[contenteditable="true"]')),
      ),
    ).toBe(true);
    await expect(editor).toHaveText("Retained complete edit");
    await expect(page.getByRole("button", { name: "Select model", exact: true })).toHaveText("two");
    await expect(page.getByRole("button", { name: "thinking: Low", exact: true })).toBeVisible();
    if (scenario === "empty") {
      await expect(page.getByRole("button", { name: "Update", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit saved draft", exact: true })).toHaveCount(0);
      await expect(notice).toContainText("moved to the draft");
      await editor.fill("Retained complete edit changed");
      await expect(notice).toHaveCount(0);
      await editor.fill("Retained complete edit");
      await expect(notice).toHaveCount(0);
      await page.getByRole("button", { name: "Remove saved-context.txt", exact: true }).click();
      await expect(page.getByRole("button", { name: "Remove saved-context.txt", exact: true })).toHaveCount(0);
      const retainedFile = await page.request.get(
        `${baseUrl}/v1/projects/${projectId}/session-attachments/${savedFile.file_id}/content`,
      );
      expect(retainedFile.ok()).toBe(true);
      await editor.press("Enter");
    } else {
      const create = page.getByRole("button", { name: "Create new queue item", exact: true });
      await expect(create).toBeEnabled();
      await create.click();
      await expect(editor).toHaveText(scenario === "occupied" ? "Independent draft" : "");
      if (scenario === "occupied")
        await expect(page.getByRole("button", { name: "Remove independent-draft.txt", exact: true })).toBeVisible();
    }
    await expect
      .poll(async () =>
        (await request<PendingQueuedFollowUpsResponse>(path)).requests.some(
          (item) => item.prompt === "Retained complete edit",
        ),
      )
      .toBe(true);
    const created = (await request<PendingQueuedFollowUpsResponse>(path)).requests.find(
      (item) => item.prompt === "Retained complete edit",
    )!;
    expect(created.model).toBe("two");
    expect(created.params).toEqual({ thinking: "low" });
    expect(created.attachments.map((file) => file.file_id)).toEqual(
      scenario === "empty" ? [editedFile.file_id] : [savedFile.file_id, editedFile.file_id],
    );
    if (scenario === "remaining")
      expect((await request<PendingQueuedFollowUpsResponse>(path)).requests[0].prompt).toBe("Other request");
  } finally {
    await page.close();
  }
};
