import { expect, test } from "@playwright/test";
import { enableCoreSkillsExtension, enablePlannerExtension } from "../extension-helpers";
import { executePlannerCommand, getPlannerTicketTags } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-open-code.harness.opencode");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const savePromptTemplate = (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
  content = "",
) =>
  executePlannerCommand<{ content: string; name: string }>(request, apiBase, projectId, "templates.save", {
    name,
    title: name,
    type: "prompt",
    content,
  });

const listSkillsViaApi = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/skills`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as Array<{ name: string; description: string }>;
};

const getSkillViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/skills/${encodeURIComponent(name)}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    name: string;
    description: string;
    files: { path: string; content: string; encoding: "utf8" }[];
  };
};

const closeSessionBubble = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((id: string) => {
    localStorage.setItem(
      `pstdio-project-settings/projects/${id}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

const navigateToTemplate = async (page: import("@playwright/test").Page, projectId: string, templateName: string) => {
  await bypassOnboarding(page);
  await page.goto(`/projects/${projectId}/settings`);
  await page.getByText("Templates", { exact: true }).click();
  await page.getByText("Prompt", { exact: true }).click();
  await page.getByText(templateName, { exact: true }).click();
};

test.describe("Project settings", () => {
  test("creates a template through its extension provider", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Template Action ${Date.now()}`);
    await enablePlannerExtension(request, apiBase, project.id);

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/settings`);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("extensions%2Fcommands") === false &&
        response.url().includes("extensions/commands/") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByText("Templates", { exact: true }).hover();
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByText("Template type").click();
    await page.getByText("Prompt", { exact: true }).last().click();
    await page.getByRole("button", { name: "Run" }).click();
    await createResponse;

    const templates = await executePlannerCommand<Array<{ name: string; type: string }>>(
      request,
      apiBase,
      project.id,
      "templates.list",
    );
    expect(templates).toContainEqual(expect.objectContaining({ name: "new-template", type: "prompt" }));
  });

  test("saves edited template content", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Save Flow ${Date.now()}`);
    await enablePlannerExtension(request, apiBase, project.id);
    const templateName = `save-test-${Date.now()}`;
    await savePromptTemplate(request, project.id, templateName, "Original content");

    await navigateToTemplate(page, project.id, templateName);

    const editor = page.getByRole("textbox");
    await editor.fill("Updated content");

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("extensions/commands/") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await saveResponse;

    const template = await executePlannerCommand<{ content: string }>(request, apiBase, project.id, "templates.read", {
      name: templateName,
    });
    expect(template.content).toBe("Updated content");
  });

  test("deletes a non-default status from the status manager", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Status Delete ${Date.now()}`);

    const createRes = await request.post(`${apiBase}/v1/projects/${project.id}/statuses`, {
      data: { name: "to-delete", color: "pink" },
    });
    expect(createRes.ok()).toBe(true);
    const created = (await createRes.json()) as { id: string; name: string };

    await bypassOnboarding(page);
    await closeSessionBubble(page, project.id);
    await page.goto(`/projects/${project.id}/settings?panel=ticket-statuses`);
    await expect(page.getByText("to-delete")).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: "to-delete" });
    await row.getByRole("button", { name: "Delete to-delete" }).click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Delete status?")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete status" }).click();

    // Status removed from draft, now save
    const saveButton = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveButton).toBeEnabled();

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/v1/projects/${project.id}/statuses/${created.id}`) &&
        response.request().method() === "DELETE" &&
        response.status() === 200,
    );
    await saveButton.click();
    await deleteResponse;

    const listRes = await request.get(`${apiBase}/v1/projects/${project.id}/statuses`);
    expect(listRes.ok()).toBe(true);
    const remaining = (await listRes.json()) as Array<{ name: string }>;
    expect(remaining.find((s) => s.name === "to-delete")).toBeUndefined();
  });

  test("cancel reverts status changes", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Status Cancel ${Date.now()}`);

    await request.post(`${apiBase}/v1/projects/${project.id}/statuses`, {
      data: { name: "temp-status", color: "pink" },
    });

    await bypassOnboarding(page);
    await closeSessionBubble(page, project.id);
    await page.goto(`/projects/${project.id}/settings?panel=ticket-statuses`);
    await expect(page.getByText("temp-status")).toBeVisible();

    // Delete the status from draft
    const row = page.getByRole("row").filter({ hasText: "temp-status" });
    await row.getByRole("button", { name: "Delete temp-status" }).click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByRole("button", { name: "Delete status" }).click();

    // Cancel reverts
    const cancelButton = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    // Status should reappear
    await expect(page.getByText("temp-status")).toBeVisible();
    await expect(cancelButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });

  test("status save and cancel are disabled when no changes are made", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Status Disabled ${Date.now()}`);

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/settings?panel=ticket-statuses`);
    await expect(page.getByText("Statuses", { exact: true }).first()).toBeVisible();

    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });
});

test.describe("Project settings — skills", () => {
  test("renders multi-file skill tree and switches content between sibling files", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Multi File Skills ${Date.now()}`);
    await enableCoreSkillsExtension(request, apiBase, project.id);
    const skills = await listSkillsViaApi(request, project.id);

    let multiFileSkill: { name: string; files: { path: string; content: string }[] } | null = null;
    for (const skill of skills) {
      const details = await getSkillViaApi(request, project.id, skill.name);
      if (details.files.length > 1) {
        multiFileSkill = { name: skill.name, files: details.files };
        break;
      }
    }
    expect(multiFileSkill, "expected at least one extension-backed skill with sibling files").not.toBeNull();

    const sibling = multiFileSkill!.files.find((file) => file.path !== "SKILL.md")!;
    const siblingSnippet = sibling.content
      .replace(/^---[\s\S]*?---\s*/, "")
      .split("\n")
      .map((line) => line.trim().replace(/^#+\s*/, ""))
      .find((line) => line.length > 0)!;
    expect(siblingSnippet).toBeDefined();

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/settings?panel=skill:${encodeURIComponent(multiFileSkill!.name)}`);

    const fileTree = page.getByTestId("project-skill-file-tree");
    await expect(fileTree).toBeVisible();
    await expect(fileTree.getByText("SKILL.md", { exact: true })).toBeVisible();

    const siblingLeafName = sibling.path.split("/").pop()!;
    const siblingNode = fileTree.getByText(siblingLeafName, { exact: true });
    await expect(siblingNode).toBeVisible();
    await siblingNode.click();

    await expect(page.getByTestId("project-skill-content")).toContainText(siblingSnippet);
  });

  test("shows installed skills and selected skill details", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Skills Settings ${Date.now()}`);
    await enableCoreSkillsExtension(request, apiBase, project.id);
    const skills = await listSkillsViaApi(request, project.id);
    expect(skills.length).toBeGreaterThan(0);
    const selectedSkill = skills[0];
    const selectedSkillDetails = await getSkillViaApi(request, project.id, selectedSkill.name);
    const expectedContentSnippet = (selectedSkillDetails.files.find((file) => file.path === "SKILL.md")?.content ?? "")
      .replace(/^---[\s\S]*?---\s*/, "")
      .split("\n")
      .map((line) => line.trim())
      .map((line) => line.replace(/^#+\s*/, ""))
      .find((line) => line.length > 0);
    expect(expectedContentSnippet).toBeDefined();

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/settings?panel=skill:${encodeURIComponent(selectedSkill.name)}`);

    await expect(page.getByTestId("project-skill-name")).toContainText(selectedSkill.name);
    await expect(page.getByTestId("project-skill-description")).toContainText(selectedSkillDetails.description);
    await expect(page.getByTestId("project-skill-content")).toContainText(expectedContentSnippet!);
  });

  test("persists tag option icon after update", async ({ request }) => {
    const project = await createProjectViaApi(request, `Tag Icon ${Date.now()}`);

    const tags = await getPlannerTicketTags(request, apiBase, project.id);
    const label = tags.find((t) => t.name === "label")!;
    const bugOption = label.options.find((o) => o.name === "bug")!;

    const updated = await executePlannerCommand<typeof label>(request, apiBase, project.id, "ticketTag.updateOption", {
      tagId: label.id,
      optionId: bugOption.id,
      icon: "star",
    });
    expect(updated.options.find((option) => option.id === bugOption.id)?.icon).toBe("star");

    // Verify icon persists when fetching again
    const tagsData = await getPlannerTicketTags(request, apiBase, project.id);
    const labelAfter = tagsData.find((t) => t.name === "label")!;
    const bugAfter = labelAfter.options.find((o) => o.name === "bug")!;
    expect(bugAfter.icon).toBe("star");

    // Update color without touching icon — icon should remain
    await executePlannerCommand(request, apiBase, project.id, "ticketTag.updateOption", {
      tagId: label.id,
      optionId: bugOption.id,
      color: "green",
    });

    const tagsColorData = await getPlannerTicketTags(request, apiBase, project.id);
    const bugAfterColor = tagsColorData.find((t) => t.name === "label")!.options.find((o) => o.name === "bug")!;
    expect(bugAfterColor.icon).toBe("star");
    expect(bugAfterColor.color).toBe("green");
  });
});
