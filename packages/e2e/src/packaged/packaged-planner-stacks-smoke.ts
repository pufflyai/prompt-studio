import { expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";

export async function expectPackagedDependencyStacks(input: { baseUrl: string; headers: Record<string, string> }) {
  await expectDependencyStack(input, false);
  await expectDependencyStack(input, true);
}

async function expectDependencyStack(input: { baseUrl: string; headers: Record<string, string> }, conflict: boolean) {
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${input.baseUrl}/v1${path}`, {
      method,
      headers: { ...input.headers, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const bodyText = await response.text();
    expect(response.ok, `${method} ${path}: ${response.status} ${bodyText}`).toBe(true);
    return JSON.parse(bodyText);
  };
  const projectInput = folderProjectInput({
    name: conflict ? "dependency-conflict-smoke" : "dependency-stack-smoke",
    agents: ["pstdio.workbench-fixture.harness.fake"],
  });
  const folder = projectInput.initial_workspace.params.path;
  const git = (path: string, ...args: string[]) =>
    execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim();
  execFileSync("git", ["init", "-b", "main", folder]);
  git(folder, "config", "user.name", "Stack smoke");
  git(folder, "config", "user.email", "smoke@example.invalid");
  await Bun.write(join(folder, ".gitignore"), ".pstdio/\n.codex/\n.claude/\n.agents/\nnode_modules/\n");
  git(folder, "add", ".gitignore");
  git(folder, "commit", "-m", "Initialize stack smoke");
  const original = git(folder, "rev-parse", "HEAD");
  const project = await request("/projects", "POST", projectInput);
  const execute = async (name: string, params: unknown = {}, provider = "pstdio-planner") => {
    const response = await request(
      `/projects/${project.id}/extensions/commands/pstdio.${provider}.command.${name}/execute`,
      "POST",
      { params },
    );
    expect(response.outcome.status).toBe("success");
    return response.outcome.value;
  };
  const stop = async (id: string) => {
    for (let check = 0; check < 100; check++) {
      if ((await request(`/sessions/${id}`)).status === "completed") return;
      await Bun.sleep(50);
    }
    throw new Error("The fixture worker did not finish");
  };
  const commit = async (path: string, file: string, content: string) => {
    await Bun.write(join(path, file), content);
    git(path, "add", ".gitignore", file);
    git(path, "commit", "-m", file);
    return git(path, "rev-parse", "HEAD");
  };
  const dependencies: { ticketId: string; headSha: string }[] = [];
  for (const word of ["left", "right"]) {
    const ticket = await execute("create-ticket", { content: `# Add ${word}`, status: "Todo" });
    const started = await execute("run-attempt", { ticket: ticket.id });
    await stop(started.session.id);
    const headSha = await commit(
      started.workspace.root_path,
      conflict ? "words.ts" : `${word}.ts`,
      `export const ${word} = () => "${word}";\n`,
    );
    const report = await execute(
      "reports.write",
      {
        name: word,
        workspace: started.workspace.workspace_shorthand,
        kind: "change_request",
        template: "change-request",
      },
      "pstdio-reports",
    );
    const markdown = await Bun.file(report.path).text();
    const boundary = markdown.indexOf("\n---", 4);
    await Bun.write(
      report.path,
      `${markdown.slice(0, boundary + 4)}\n\n# Dependency fixture\n\nAdded ${word}.ts and checked its committed Git revision.\n`,
    );
    await execute(
      "reports.save",
      { name: report.name, workspace: started.workspace.workspace_shorthand },
      "pstdio-reports",
    );
    await execute("submit-change-request", {
      workspaceId: started.workspace.id,
      implementationSessionId: started.session.id,
      headSha,
      changeRequestReportId: report.reportId,
      expectedRevision: 0,
    });
    await execute("update-ticket", { id: ticket.id, status: "Done" });
    dependencies.push({ ticketId: ticket.id, headSha });
  }
  // Cover both a stale existing attempt and a fresh owner launched to reconcile conflicting dependencies.
  const child = await execute("create-ticket", {
    content: "# Consume both words",
    status: "Todo",
    ...(conflict ? { dependsOn: dependencies.map(({ ticketId }) => ticketId) } : {}),
  });
  const started = await execute("run-attempt", { ticket: child.id });
  await stop(started.session.id);
  let head = await commit(started.workspace.root_path, "child.ts", "export const child = true;\n");
  await execute("update-ticket", { id: child.id, dependsOn: dependencies.map(({ ticketId }) => ticketId) });
  const next = await execute("next-tickets");
  expect(next.tickets).toContainEqual(
    expect.objectContaining({ id: child.id, action: "update-stack", workspaceId: started.workspace.id }),
  );
  const update = () =>
    execute("update-stack", {
      workspaceId: started.workspace.id,
      implementationSessionId: started.session.id,
      expectedHeadSha: head,
    });
  if (conflict) {
    const response = await request(
      `/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.update-stack/execute`,
      "POST",
      {
        params: {
          workspaceId: started.workspace.id,
          implementationSessionId: started.session.id,
          expectedHeadSha: head,
        },
      },
    );
    expect(response.outcome.ok).toBe(false);
    expect(git(started.workspace.root_path, "diff", "--name-only", "--diff-filter=U")).toBe("words.ts");
    head = await commit(
      started.workspace.root_path,
      "words.ts",
      'export const left = () => "left";\nexport const right = () => "right";\n',
    );
  }
  const updated = await update();
  for (const dependency of dependencies)
    git(folder, "merge-base", "--is-ancestor", dependency.headSha, updated.headSha);
  expect(git(started.workspace.root_path, "show", conflict ? "HEAD:words.ts" : "HEAD:left.ts")).toContain("left");
  expect(git(started.workspace.root_path, "show", conflict ? "HEAD:words.ts" : "HEAD:right.ts")).toContain("right");
  expect(git(started.workspace.root_path, "show", "HEAD:child.ts")).toContain("true");
  expect(git(folder, "rev-parse", "main")).toBe(original);
  expect(
    (await execute("list-attempts")).filter((attempt: { ticketId: string }) => attempt.ticketId === child.id),
  ).toHaveLength(1);
  expect((await execute("review-requests.list", { ticket: child.id })).requests).toHaveLength(0);
  if (!conflict) {
    const ready = await execute("create-ticket", {
      content: "# Work independent of the missing workspace",
      status: "Todo",
    });
    const path = started.workspace.root_path;
    const recoveryMode = await execute("auto-build.configure", {
      enabled: true,
      prompt: "Recover the missing workspace.",
    });
    await rename(path, `${path}.missing`);
    try {
      const next = await execute("next-tickets");
      expect(next.tickets).toContainEqual(expect.objectContaining({ id: ready.id, action: "start" }));
      expect(next.tickets).toContainEqual(expect.objectContaining({ id: child.id, action: "recover-workspace" }));
      const recovery = await execute("auto-build.dispatch", { ticket: child.id, revision: recoveryMode.revision });
      expect(recovery.decision).toBe("started");
      expect(recovery.workspaceId).not.toBe(started.workspace.id);
      await stop(recovery.sessionId);
      const recoveredWorkspace = (await request(`/workspaces?project_id=${project.id}`)).find(
        (workspace: { id: string }) => workspace.id === recovery.workspaceId,
      );
      expect(recoveredWorkspace).toBeDefined();
      expect(git(recoveredWorkspace.root_path, "show", "HEAD:child.ts")).toContain("true");
      expect((await execute("read-attempt-history", { workspaceId: started.workspace.id })).attempt.state).toBe(
        "abandoned",
      );
      await execute("update-ticket", { id: child.id, status: "Done" });
      const params = { content: "# Wait for the selected recovery revision", status: "Todo", dependsOn: [child.id] };
      const dependent = await execute("create-ticket", params);
      expect(await execute("attempt-readiness", { ticket: dependent.id, base: updated.headSha })).toMatchObject({
        decision: "wait",
        reason: "dependency-not-ready",
      });
    } finally {
      await rename(`${path}.missing`, path);
      await execute("auto-build.configure", { enabled: false });
    }
    git(folder, "branch", "feature/acceptance", updated.headSha);
    const draftTicket = await execute("create-ticket", { content: "# Continue a feature draft", status: "Todo" });
    const draft = await execute("create-workspace", {
      ticket: draftTicket.id,
      provider_id: "pstdio.worktree",
      params: { base: original },
    });
    const draftPath = draft.workspace.root_path;
    const draftHead = git(draftPath, "rev-parse", "HEAD");
    await Bun.write(join(draftPath, "draft.ts"), "export const preserved = true;\n");
    git(draftPath, "add", "draft.ts");
    const status = git(draftPath, "status", "--porcelain");
    const mode = await execute("auto-build.configure", { enabled: true, prompt: "Continue the feature draft." });
    try {
      const feature = await execute("next-tickets", { base: "feature/acceptance" });
      expect(feature.tickets).toContainEqual(
        expect.objectContaining({ id: draftTicket.id, baseHeadSha: updated.headSha }),
      );
      const adopted = await execute("auto-build.dispatch", {
        ticket: draftTicket.id,
        revision: mode.revision,
        base: "feature/acceptance",
        workspaceId: draft.workspace.id,
      });
      expect(adopted).toMatchObject({ decision: "started", workspaceId: draft.workspace.id });
      await stop(adopted.sessionId);
      expect(git(draftPath, "rev-parse", "HEAD")).toBe(draftHead);
      expect(git(draftPath, "status", "--porcelain")).toBe(status);
    } finally {
      await execute("auto-build.configure", { enabled: false });
    }
  }
}
