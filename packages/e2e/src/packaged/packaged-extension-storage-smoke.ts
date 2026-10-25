import { expect } from "bun:test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

export const expectExtensionDraftStorage = async (input: {
  baseUrl: string;
  projectId: string;
  projectFolder: string;
  headers: Record<string, string>;
}) => {
  const projectFolder = realpathSync(input.projectFolder);
  const execute = async (owner: string, command: string, params: Record<string, string>) => {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.${owner}.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ source: "cli", params }),
      },
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.outcome.ok).toBe(true);
    return result.outcome.value as { path: string; filesPath?: string; shorthand?: string };
  };
  const ticket = await execute("pstdio-planner", "write-ticket", { title: "Extension storage draft" });
  expect(ticket.path).toBe(
    join(projectFolder, ".pstdio/extension-storage/pstdio.pstdio-planner/tickets", ticket.shorthand!, "ticket.md"),
  );
  expect(readFileSync(ticket.path, "utf8")).toContain("Extension storage draft");
  const report = await execute("pstdio-reports", "reports.write", { kind: "review", template: "review" });
  const directory = join(projectFolder, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review");
  expect(report.path).toBe(join(directory, "report.md"));
  expect(report.filesPath).toBe(join(directory, "files"));
  expect(existsSync(report.path)).toBe(true);
};
