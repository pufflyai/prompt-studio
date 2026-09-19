import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPackagedNavigation = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) => {
  const view = input.metadata.views.find(
    (record) => record.extensionId === "pstdio.extension-lab" && record.localId === "zipline-board",
  );
  const record = view?.body.kind === "kanban" ? view.body : undefined;
  expect(record?.rowActivationHandlerId).toBeTruthy();
  for (const source of ["dashboard", "cli"]) {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/${record!.rowActivationHandlerId}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({
          source,
          params: {
            row: { id: "issue", title: "Issue", attributes: {}, resource: { type: "zipline-issue", id: "issue" } },
          },
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status).toBe("success");
    if (source === "dashboard")
      expect(body.outcome.navigationRequests).toEqual([
        expect.objectContaining({
          kind: "page",
          page: { kind: "page", id: "zipline-resource", extensionId: "pstdio.extension-lab" },
        }),
      ]);
    else expect(body.outcome.navigationRequests).toBeUndefined();
  }
};
