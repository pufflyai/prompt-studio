import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const expectReportTemplates = async (
  metadata: WorkbenchExtensionMetadata,
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const reportType = metadata.templateTypes.find((type) => type.localId === "report");
  expect(reportType?.commands).toEqual(
    expect.objectContaining({
      list: "pstdio.pstdio-reports.command.templates.list",
      read: "pstdio.pstdio-reports.command.templates.read",
      save: "pstdio.pstdio-reports.command.templates.save",
      delete: "pstdio.pstdio-reports.command.templates.delete",
    }),
  );

  const listTemplatesRes = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(reportType!.commands!.list)}/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "api", params: {} }),
    },
  );
  expect(listTemplatesRes.status).toBe(200);
  const listTemplates = (await listTemplatesRes.json()) as {
    outcome: { ok: boolean; value?: Array<{ name: string; type: string }> };
  };
  expect(listTemplates.outcome).toEqual(
    expect.objectContaining({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ name: "review", type: "report" }),
        expect.objectContaining({ name: "change-request", type: "report" }),
      ]),
    }),
  );
};

export const expectTemplateStorage = async (
  metadata: WorkbenchExtensionMetadata,
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  await expectReportTemplates(metadata, baseUrl, projectId, headers);
  for (const type of ["prompt", "report"]) {
    const contribution = metadata.templateTypes.find((item) => item.localId === type);
    expect(contribution?.commands).toBeDefined();
    const execute = async (command: string, params: unknown) => {
      const response = await fetch(
        `${baseUrl}/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(command)}/execute`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ params }),
        },
      );
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.outcome.ok, JSON.stringify(result)).toBe(true);
      return result.outcome.value;
    };
    const commands = contribution!.commands!;
    const name = `packaged-custom-${type}`;
    const content = "Saved through the owning extension.";
    await execute(commands.save, { name, title: "Custom", type, content });
    expect(await execute(commands.read, { name })).toMatchObject({ name, type, content });
    expect(await execute(commands.list, {})).toContainEqual(expect.objectContaining({ name, type }));
    await execute(commands.delete, { name });
    expect(await execute(commands.list, {})).not.toContainEqual(expect.objectContaining({ name }));
  }
};
