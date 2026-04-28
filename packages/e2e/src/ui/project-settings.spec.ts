import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const executePlannerCommand = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  commandId: string,
  params: Record<string, unknown>,
) => {
  const res = await request.post(
    `${apiBase}/v1/projects/${projectId}/extension-commands/pstdio.planner.${commandId}/execute`,
    { data: { params } },
  );
  expect(res.ok()).toBe(true);
  return res;
};

const listPlannerStatuses = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/pstdio.planner/collections/statuses`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as {
    items: Array<{ item_id: string; value_json: { id?: string; name?: string } }>;
  };
  return body.items.map((item) => ({
    id: item.value_json.id ?? item.item_id,
    name: item.value_json.name ?? item.item_id,
  }));
};

const listPlannerTags = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const [tagsRes, optionsRes] = await Promise.all([
    request.get(`${apiBase}/v1/projects/${projectId}/extensions/pstdio.planner/collections/tags`),
    request.get(`${apiBase}/v1/projects/${projectId}/extensions/pstdio.planner/collections/tag_options`),
  ]);
  expect(tagsRes.ok()).toBe(true);
  expect(optionsRes.ok()).toBe(true);
  const tagBody = (await tagsRes.json()) as {
    items: Array<{ item_id: string; value_json: { id?: string; name?: string } }>;
  };
  const optionBody = (await optionsRes.json()) as {
    items: Array<{
      item_id: string;
      value_json: { id?: string; tagId?: string; name?: string; icon?: string | null; color?: string };
    }>;
  };
  const options = optionBody.items.map((item) => ({
    id: item.value_json.id ?? item.item_id,
    tagId: item.value_json.tagId ?? "",
    name: item.value_json.name ?? item.item_id,
    icon: item.value_json.icon ?? null,
    color: item.value_json.color ?? "gray",
  }));
  return tagBody.items.map((item) => {
    const id = item.value_json.id ?? item.item_id;
    return {
      id,
      name: item.value_json.name ?? item.item_id,
      options: options.filter((option) => option.tagId === id),
    };
  });
};

const createTemplateViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/templates`, {
    data: { name, template_type: "prompt" },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; content: string };
};

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
  await closeSessionBubble(page, projectId);
  await page.goto(`/projects/${projectId}/settings`);
  await page.getByText("Templates", { exact: true }).click();
  await page.getByText("Prompts", { exact: true }).click();
  await page.getByText(templateName, { exact: true }).click();
};

test.describe("Project settings", () => {
  test("creates a template from the dashboard dialog", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Template Action ${Date.now()}`);
    const templateName = `blank-template-${Date.now()}`;

    await bypassOnboarding(page);
    await page.goto("/projects");
    await page.getByText(project.name, { exact: true }).click();
    await page.waitForURL(`**/projects/${project.id}/tickets`);
    await page.getByRole("option", { name: "Project settings" }).click();
    await page.waitForURL(`**/projects/${project.id}/settings*`);

    await page.getByText("Templates", { exact: true }).hover();
    await page.getByRole("button", { name: "Create template" }).click();

    const createDialog = page.getByRole("dialog").last();
    await expect(createDialog.getByText("Create template", { exact: true })).toBeVisible();
    await createDialog.getByPlaceholder("Template name").fill(templateName);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/v1/projects/${project.id}/templates`) &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await createDialog.getByRole("button", { name: "Create", exact: true }).click();
    await createResponse;

    await page.getByText("Templates", { exact: true }).click();
    await page.getByText("Prompts", { exact: true }).click();
    await expect(page.getByText(templateName, { exact: true }).first()).toBeVisible();

    const templateResponse = await request.get(
      `${apiBase}/v1/projects/${project.id}/templates/${encodeURIComponent(templateName)}`,
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { content: string; name: string };
    expect(template.name).toBe(templateName);
    expect(template.content).toBe(`# ${templateName}\n`);
  });

  test("saves edited template content", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Save Flow ${Date.now()}`);
    const templateName = `save-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    const editor = page.locator("[data-lexical-editor]").first();
    await editor.click();
    await editor.pressSequentially("Updated content");

    const saveButton = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveButton).toBeEnabled();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/v1/projects/${project.id}/templates`) &&
        response.request().method() === "PUT" &&
        response.status() === 200,
    );
    await saveButton.click();
    await saveResponse;

    const templateResponse = await request.get(
      `${apiBase}/v1/projects/${project.id}/templates/${encodeURIComponent(templateName)}`,
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { content: string };
    expect(template.content).toContain("Updated content");
  });

  test("cancel reverts editor to saved content", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Cancel Flow ${Date.now()}`);
    const templateName = `cancel-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    const editor = page.locator("[data-lexical-editor]").first();
    await editor.click();
    await editor.pressSequentially("Unsaved changes");

    const cancelButton = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    await expect(cancelButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(editor).not.toContainText("Unsaved changes");
  });

  test("cancel and save are disabled when no changes are made", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Disabled Buttons ${Date.now()}`);
    const templateName = `disabled-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });

  test.skip("deletes a non-default status from the status manager", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Status Delete ${Date.now()}`);

    const createRes = await executePlannerCommand(request, project.id, "createStatus", {
      name: "to-delete",
      color: "pink",
    });
    const created = ((await createRes.json()) as { result: { id: string; name: string } }).result;
    expect(created.id).toBeTruthy();

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
        response.url().includes(`/v1/projects/${project.id}/extension-commands/pstdio.planner.deleteStatus/execute`) &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await saveButton.click();
    await deleteResponse;

    const remaining = await listPlannerStatuses(request, project.id);
    expect(remaining.find((s) => s.name === "to-delete")).toBeUndefined();
  });

  test.skip("cancel reverts status changes", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Status Cancel ${Date.now()}`);

    await executePlannerCommand(request, project.id, "createStatus", {
      name: "temp-status",
      color: "pink",
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

  test.skip("status save and cancel are disabled when no changes are made", async ({ page, request }) => {
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
    const skills = await listSkillsViaApi(request, project.id);

    let multiFileSkill: { name: string; files: { path: string; content: string }[] } | null = null;
    for (const skill of skills) {
      const details = await getSkillViaApi(request, project.id, skill.name);
      if (details.files.length > 1) {
        multiFileSkill = { name: skill.name, files: details.files };
        break;
      }
    }
    expect(multiFileSkill, "expected at least one bundled skill with sibling files").not.toBeNull();

    const sibling = multiFileSkill!.files.find((file) => file.path !== "SKILL.md")!;
    const siblingSnippet = sibling.content
      .replace(/^---[\s\S]*?---\s*/, "")
      .split("\n")
      .map((line) => line.trim().replace(/^#+\s*/, ""))
      .find((line) => line.length > 0)!;
    expect(siblingSnippet).toBeDefined();

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/settings`);
    await page.getByText("Skills", { exact: true }).click();
    await page.getByText(multiFileSkill!.name, { exact: true }).click();

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
    await page.goto(`/projects/${project.id}/settings`);
    await page.getByText("Skills", { exact: true }).click();
    await page.getByText(selectedSkill.name, { exact: true }).click();

    await expect(page.getByTestId("project-skill-name")).toContainText(selectedSkill.name);
    await expect(page.getByTestId("project-skill-description")).toContainText(selectedSkillDetails.description);
    await expect(page.getByTestId("project-skill-content")).toContainText(expectedContentSnippet!);
  });

  test.skip("persists tag option icon after update", async ({ request }) => {
    const project = await createProjectViaApi(request, `Tag Icon ${Date.now()}`);

    const tags = await listPlannerTags(request, project.id);
    const label = tags.find((t) => t.name === "label")!;
    const bugOption = label.options.find((o) => o.name === "bug")!;

    const updateRes = await executePlannerCommand(request, project.id, "updateTagOption", {
      option_id: bugOption.id,
      icon: "star",
    });
    const updated = ((await updateRes.json()) as { result: { icon: string | null } }).result;
    expect(updated.icon).toBe("star");

    // Verify icon persists when fetching again
    const tagsData = await listPlannerTags(request, project.id);
    const labelAfter = tagsData.find((t) => t.name === "label")!;
    const bugAfter = labelAfter.options.find((o) => o.name === "bug")!;
    expect(bugAfter.icon).toBe("star");

    // Update color without touching icon — icon should remain
    await executePlannerCommand(request, project.id, "updateTagOption", {
      option_id: bugOption.id,
      color: "green",
    });

    const tagsColorData = await listPlannerTags(request, project.id);
    const bugAfterColor = tagsColorData.find((t) => t.name === "label")!.options.find((o) => o.name === "bug")!;
    expect(bugAfterColor.icon).toBe("star");
    expect(bugAfterColor.color).toBe("green");
  });
});
