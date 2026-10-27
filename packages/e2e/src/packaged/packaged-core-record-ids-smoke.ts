import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const coreId = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const expectCoreRecordIds = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const execute = async <T>(owner: string, command: string, params: object) => {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.${owner}.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { outcome: { ok: boolean; value: T } };
    expect(result.outcome.ok).toBe(true);
    return result.outcome.value;
  };

  const note = await execute<{ id: string }>("pstdio-notes", "notes.create", { title: "Core identity" });
  const folder = await execute<{ id: string }>("pstdio-notes", "folders.create", { title: "Core identity" });
  const tag = await execute<{ id: string }>("pstdio-planner", "ticket-tag.create", { name: "Core identity" });
  const option = await execute<{ id: string }>("pstdio-planner", "ticket-tag.create-option", {
    tagId: tag.id,
    name: "Offline",
  });
  for (const value of [note, folder, tag, option]) expect(value.id).toMatch(coreId);

  const report = await execute<{ reportId: string; filesPath: string; name: string }>(
    "pstdio-reports",
    "reports.write",
    {
      name: "core-record-ids",
      kind: "review",
      template: "review",
    },
  );
  mkdirSync(report.filesPath, { recursive: true });
  writeFileSync(join(report.filesPath, "evidence.txt"), "Core-owned evidence ID");
  await execute("pstdio-reports", "reports.save", { name: report.name });
  const saved = await execute<{ files: { id: string }[] }>("pstdio-reports", "reports.read", { id: report.reportId });
  expect(saved.files).toHaveLength(1);
  expect(saved.files[0]!.id).toMatch(coreId);
};
