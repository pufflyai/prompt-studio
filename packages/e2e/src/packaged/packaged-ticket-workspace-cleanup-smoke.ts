import { expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export const expectTicketWorkspaceCleanup = async (
  baseUrl: string,
  projectId: string,
  instanceId: string,
  headers: Record<string, string>,
  repo: string,
) => {
  const execute = async (command: string, params: Record<string, unknown>) => {
    const response = await fetch(
      `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { outcome: { ok: boolean; value: { id: string; shorthand: string } } };
    expect(result.outcome.ok).toBe(true);
    return result.outcome.value;
  };
  for (const enabled of [true, false]) {
    const settingUrl = `${baseUrl}/v1/projects/${projectId}/extensions/${instanceId}/settings/tickets.deleteLinkedWorkspaces`;
    expect((await fetch(settingUrl, { method: "PUT", headers, body: JSON.stringify({ value: enabled }) })).status).toBe(
      200,
    );
    const ticket = await execute("create-ticket", { title: "Packaged workspace cleanup" });
    const response = await fetch(`${baseUrl}/v1/workspaces`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: projectId,
        provider_id: "pstdio.worktree",
        shorthand_base: ticket.shorthand,
        params: { base: "HEAD" },
        anchors: [{ type: "ticket", id: ticket.id, shorthand: ticket.shorthand }],
      }),
    });
    expect(response.status).toBe(201);
    const workspace = (await response.json()) as { id: string; root_path: string; branch: string };
    expect(existsSync(workspace.root_path)).toBe(true);
    await execute("archive-ticket", { id: ticket.id });
    expect(existsSync(workspace.root_path)).toBe(!enabled);
    const branch = execFileSync("git", ["branch", "--list", "--format=%(refname:short)", workspace.branch], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    if (enabled) expect(branch).toBe("");
    else {
      expect(branch).toBe(workspace.branch);
      expect((await fetch(`${baseUrl}/v1/workspaces/${workspace.id}`, { method: "DELETE", headers })).status).toBe(200);
    }
  }
  expect(
    (
      await fetch(
        `${baseUrl}/v1/projects/${projectId}/extensions/${instanceId}/settings/tickets.deleteLinkedWorkspaces`,
        { method: "DELETE", headers },
      )
    ).status,
  ).toBe(204);
};
