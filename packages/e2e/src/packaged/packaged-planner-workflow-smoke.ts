import { expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const expectPlannerWorkflow = async (
  baseUrl: string,
  projectId: string,
  instanceId: string,
  authorization: Record<string, string>,
  tempRoot: string,
) => {
  const headers = { ...authorization, "content-type": "application/json" };
  const settingsUrl = `${baseUrl}/v1/projects/${projectId}/extensions/${instanceId}/settings`;
  const commandsUrl = `${baseUrl}/v1/projects/${projectId}/extensions/commands`;
  const commandsResponse = await fetch(commandsUrl, { headers });
  expect(commandsResponse.status).toBe(200);
  const commands = (await commandsResponse.json()) as { commands: Array<{ id: string; cliPath?: string }> };
  expect(commands.commands).toContainEqual(
    expect.objectContaining({
      id: "pstdio.pstdio-planner.command.implementation-policy",
      cliPath: "pstdio-planner implementation-policy",
    }),
  );
  const execute = async <T>(command: string, params: Record<string, unknown> = {}, targetProjectId = projectId) => {
    const response = await fetch(
      `${baseUrl}/v1/projects/${targetProjectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { outcome: { ok: boolean; value: T } };
    expect(result.outcome.ok).toBe(true);
    return result.outcome.value;
  };
  const readPolicy = () => execute("implementation-policy");

  expect(await readPolicy()).toEqual({ adversarialReview: true, openPr: true, defaultTargetBranch: null });
  for (const [key, expected] of [
    ["implementation.adversarialReview", { adversarialReview: false, openPr: true }],
    ["implementation.openPr", { adversarialReview: false, openPr: false }],
  ] as const) {
    const response = await fetch(`${settingsUrl}/${key}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value: false }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ value: false });
    expect(await readPolicy()).toEqual({ ...expected, defaultTargetBranch: null });
  }

  const otherResponse = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Other Planner project" }),
  });
  expect(otherResponse.status).toBe(201);
  const other = (await otherResponse.json()) as { id: string };
  expect(await execute("implementation-policy", {}, other.id)).toEqual({
    adversarialReview: true,
    openPr: true,
    defaultTargetBranch: null,
  });
  expect(await execute("implementation-targets", {}, other.id)).toBeNull();

  const projectFolder = join(tempRoot, "project");
  mkdirSync(projectFolder);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: projectFolder, stdio: "pipe" });
  git("init", "-b", "main");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Initial");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("update-ref", "refs/remotes/origin/release", "HEAD");
  git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  const registerRepo = await fetch(`${baseUrl}/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "project", path: projectFolder }),
  });
  expect(registerRepo.status).toBe(201);
  expect(await execute("implementation-targets")).toEqual({
    branches: ["origin/main", "origin/release"],
    selected: "",
  });
  await execute("set-implementation-target", { branch: "origin/release" });
  expect(await readPolicy()).toMatchObject({ defaultTargetBranch: "origin/release" });
  expect(await execute("implementation-policy", {}, other.id)).toEqual({
    adversarialReview: true,
    openPr: true,
    defaultTargetBranch: null,
  });
  const settingsResponse = await fetch(settingsUrl, { headers });
  expect(await settingsResponse.json()).toMatchObject({
    settings: expect.arrayContaining([
      expect.objectContaining({
        key: "implementation.defaultTargetBranch",
        scope: "project",
        value: "origin/release",
      }),
    ]),
  });
  await execute("set-implementation-target");
  expect(await readPolicy()).toMatchObject({ defaultTargetBranch: null });

  const ticket = await execute<{ id: string }>("create-ticket", { title: "Review link reuse" });
  const url = "https://github.com/org/repo/pull/456";
  const linked = await execute<{ reviewLinks: unknown[] }>("link-review", {
    id: ticket.id,
    url,
    title: "Review changes",
  });
  await execute("link-review", { id: ticket.id, url });
  const saved = await execute<{ reviewLinks: unknown[] }>("get-ticket", { id: ticket.id });
  expect(saved.reviewLinks).toHaveLength(1);
  expect(saved.reviewLinks).toEqual(linked.reviewLinks);
};
