import { expect } from "bun:test";

export const expectPackagedNavigation = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const metadataResponse = await fetch(`${input.baseUrl}/v1/projects/${input.projectId}/extensions/ui`, {
    headers: input.headers,
  });
  const metadata = await metadataResponse.json();
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({ localId: "record", document: { metadataKey: "documentId" } }),
  );
  expect(metadata.views).toContainEqual(
    expect.objectContaining({ localId: "document", instancePolicy: "per-resource" }),
  );
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({
      localId: "record",
      modes: expect.arrayContaining([{ kind: "mode", extensionId: "test.navigation-probe", id: "policy" }]),
    }),
  );
  expect(metadata.modes).toContainEqual(
    expect.objectContaining({
      localId: "policy",
      basePage: { kind: "page", extensionId: "test.navigation-probe", id: "home" },
      regionSettings: {
        side: { canOpen: true, canClose: false, acceptsTabs: true, resizable: false, floatable: false },
      },
    }),
  );
  const documentResponse = await fetch(
    `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/test.navigation-probe.command.open-document/execute`,
    {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "dashboard", params: {} }),
    },
  );
  expect(documentResponse.status).toBe(200);
  expect(await documentResponse.json()).toMatchObject({
    outcome: {
      status: "success",
      navigationRequests: [
        {
          kind: "page",
          mode: { kind: "mode", extensionId: "test.navigation-probe", id: "policy" },
          page: { extensionId: "test.navigation-probe", id: "record" },
          resource: { metadata: { documentId: "file-1" } },
          position: { line: 2, column: 3 },
        },
      ],
    },
  });
  for (const source of ["dashboard", "cli"]) {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/test.navigation-probe.command.open/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ source, params: {} }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status).toBe("success");
    expect(body.outcome.value).toEqual({ id: "created" });
    if (source === "dashboard") {
      expect(body.outcome.navigationRequests).toEqual([{ kind: "href", href: "https://example.com/created" }]);
    } else {
      expect(body.outcome.navigationRequests).toBeUndefined();
    }
  }
  const unsafe = await fetch(
    `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/test.navigation-probe.command.open/execute`,
    {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "dashboard", params: { href: "javascript:alert(1)" } }),
    },
  );
  expect(unsafe.status).toBe(200);
  expect(await unsafe.json()).toMatchObject({ outcome: { ok: false, status: "error" } });
};
