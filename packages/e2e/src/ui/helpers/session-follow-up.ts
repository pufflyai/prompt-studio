import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

const apiPortValue = Number(process.env.E2E_API_PORT ?? "3200");
export const apiBase = `http://localhost:${apiPortValue}`;

const POLL_INTERVALS = [250, 500, 1_000, 2_000, 3_000];
const DEFAULT_TIMEOUT_MS = 90_000;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const createFollowUpGitRepo = (input: { prefix: string; readmeContent: string }) => {
  const repoRoot = mkdtempSync(join(tmpdir(), input.prefix));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), `${input.readmeContent}\n`);
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.agents/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

export const deleteAllProjects = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);

  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) {
    const deletion = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deletion.ok()).toBe(true);
  }
};

export const createProjectViaApi = async (request: APIRequestContext, name: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};

export const registerRepoViaApi = async (request: APIRequestContext, projectId: string, name: string, path: string) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name, path },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string; path: string };
};

export interface BypassOnboardingInput {
  projectId: string;
  repoId: string;
  branch: string;
  agentId: string;
  models?: string[];
}

export const bypassOnboarding = async (page: Page, input: BypassOnboardingInput) => {
  const payload = { ...input, models: input.models ?? [] };

  await page.addInitScript(
    ({
      projectId,
      repoId,
      branch,
      agentId,
      models,
    }: {
      projectId: string;
      repoId: string;
      branch: string;
      agentId: string;
      models: string[];
    }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", agentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${projectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: agentId,
            lastSelectedModels: models,
            lastSelectedRepo: repoId,
            lastSelectedBranches: [branch],
            sessionModalState: "bubble",
            selectedSessionId: null,
            lastNonSessionsPath: null,
            chatDraftsBySession: {},
          },
          version: 0,
        }),
      );
    },
    payload,
  );
};

export const submitMessage = async (page: Page, text: string) => {
  const contentEditor = page.locator("[data-testid='content-editable'][contenteditable='true']").last();
  await contentEditor.click();
  await contentEditor.fill(text);
  await page.locator("[data-testid='send-message-button']").click();
};

export const extractSessionIdFromUrl = (url: string) => {
  const match = url.match(/\/sessions\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Could not extract session id from URL: ${url}`);
  }

  return match[1];
};

export const waitForSessionStatus = async (
  request: APIRequestContext,
  sessionId: string,
  status: string,
  options: { timeout?: number } = {},
) => {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
        expect(response.ok()).toBe(true);
        const session = (await response.json()) as { status: string };
        return session.status;
      },
      { timeout, intervals: POLL_INTERVALS },
    )
    .toBe(status);
};

export const getRenderedConversationBlocks = async (page: Page) => {
  const blocks = await page
    .locator("[role='log'] [role='textbox']")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

  return blocks.map(normalizeWhitespace).filter(Boolean);
};

export const getExactMatchIndices = (blocks: string[], expected: string) =>
  blocks.flatMap((block, index) => (block === expected ? [index] : []));

export const expectOrderedConversationBlocks = (
  blocks: string[],
  input: { firstPrompt: string; followUpPrompt: string; label: string },
) => {
  const firstPromptIndices = getExactMatchIndices(blocks, input.firstPrompt);
  const firstResponseIndices = getExactMatchIndices(blocks, "FIRST DONE");
  const followUpPromptIndices = getExactMatchIndices(blocks, input.followUpPrompt);
  const followUpResponseIndices = getExactMatchIndices(blocks, "SECOND DONE");

  expect(firstPromptIndices, `${input.label}: first user prompt should appear exactly once`).toHaveLength(1);
  expect(firstResponseIndices, `${input.label}: first assistant reply should appear exactly once`).toHaveLength(1);
  expect(followUpPromptIndices, `${input.label}: follow-up user prompt should appear exactly once`).toHaveLength(1);
  expect(followUpResponseIndices, `${input.label}: follow-up assistant reply should appear exactly once`).toHaveLength(
    1,
  );

  expect(firstPromptIndices[0]!).toBeLessThan(firstResponseIndices[0]!);
  expect(firstResponseIndices[0]!).toBeLessThan(followUpPromptIndices[0]!);
  expect(followUpPromptIndices[0]!).toBeLessThan(followUpResponseIndices[0]!);
};

export const waitForRenderedConversationBlock = async (
  page: Page,
  text: string,
  options: { timeout?: number } = {},
) => {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  await expect
    .poll(
      async () => {
        const blocks = await getRenderedConversationBlocks(page);
        return getExactMatchIndices(blocks, text).length > 0;
      },
      { timeout, intervals: POLL_INTERVALS },
    )
    .toBe(true);
};
