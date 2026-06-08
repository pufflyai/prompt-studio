import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-ticket-workspace-images-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "ticket workspace image e2e\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const registerRepoViaApi = async (request: APIRequestContext, projectId: string, path: string) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name: "ticket-workspace-images-repo", path },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const getPlannerExtensionInstanceId = async (request: APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/extensions`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { extensions: Array<{ id: string; installName: string; enabled: boolean }> };
  const planner = body.extensions.find((extension) => extension.installName === "pstdio-planner" && extension.enabled);
  expect(planner).toBeDefined();
  return planner!.id;
};

const attachGifImage = async (request: APIRequestContext, projectId: string, ticketId: string) => {
  const instanceId = await getPlannerExtensionInstanceId(request, projectId);
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  const upload = await request.post(
    `${apiBase}/v1/projects/${projectId}/extensions/${instanceId}/files?scope_type=resource&scope_id=${ticketId}`,
    {
      headers: {
        "content-type": "image/gif",
        "x-file-name": encodeURIComponent("diagram.gif"),
      },
      data: gif,
    },
  );
  expect(upload.ok()).toBe(true);
  const ref = await upload.json();
  await executePlannerCommand(request, apiBase, projectId, "attach-file", { ticketId, ref });
  return ref as { id: string; name: string };
};

const bypassOnboarding = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ currentProjectId, selectedRepoId }: { currentProjectId: string; selectedRepoId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "fake");
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, selectedRepoId: repoId },
  );
};

test("ticket detail previews image attachments and creates manual workspaces", async ({ page, request }) => {
  test.slow();
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Ticket Workspace Image E2E");
  const repoRoot = createGitRepo();
  const repo = await registerRepoViaApi(request, project.id, repoRoot);

  try {
    const ticket = await createPlannerTicket(request, apiBase, project.id, {
      content: "# Ticket image workspace\n\nPreview an attachment and create a workspace.",
    });
    await attachGifImage(request, project.id, ticket.id);
    await bypassOnboarding(page, project.id, repo.id);

    await page.goto(`/projects/${project.id}/tickets/${ticket.shorthand}`);

    const imageFile = page.getByRole("option", { name: "diagram" });
    await expect(imageFile).toBeVisible({ timeout: 15_000 });
    await imageFile.click();

    const preview = page.getByRole("img", { name: "diagram.gif" });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.getAttribute("src")).toContain("data:image/gif;base64,");
    await expect
      .poll(() => preview.evaluate((node) => (node instanceof HTMLImageElement ? node.naturalWidth : 0)))
      .toBeGreaterThan(0);

    const runAttemptResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.run-attempt/execute"),
    );
    await page.getByRole("button", { name: "Run attempt" }).click();
    await expect(page.getByRole("dialog").getByText("Run attempt")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Run" })).toBeEnabled();
    await page.getByRole("dialog").getByRole("button", { name: "Run" }).click();

    const runAttemptResponse = await runAttemptResponsePromise;
    expect(runAttemptResponse.ok()).toBe(true);
    const runAttemptBody = (await runAttemptResponse.json()) as {
      outcome: {
        ok: boolean;
        value: { session: { id: string } | null; workspace: { workspace_shorthand: string } };
      };
    };
    expect(runAttemptBody.outcome.ok).toBe(true);
    expect(runAttemptBody.outcome.value.session?.id).toBeTruthy();
    expect(runAttemptBody.outcome.value.workspace).toMatchObject({
      workspace_shorthand: `${ticket.shorthand}_A1`,
    });

    await page.getByText("Workspaces", { exact: true }).hover();
    await page.getByRole("button", { name: "New workspace" }).click();

    const workspaceResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/extensions/commands/pstdio-planner.run-attempt/execute"),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Create workspace", exact: true }).click();

    const workspaceResponse = await workspaceResponsePromise;
    expect(workspaceResponse.ok()).toBe(true);
    const body = (await workspaceResponse.json()) as {
      outcome: { ok: boolean; value: { workspace: { workspace_shorthand: string } } };
    };
    expect(body.outcome.ok).toBe(true);
    expect(body.outcome.value.workspace).toMatchObject({
      workspace_shorthand: `${ticket.shorthand}_A2`,
    });
    await page.waitForURL(`**/projects/${project.id}/tickets/${ticket.shorthand}/workspaces/${ticket.shorthand}_A2`);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
