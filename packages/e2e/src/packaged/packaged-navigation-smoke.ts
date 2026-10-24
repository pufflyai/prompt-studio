import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeNavigationExtension = (root: string) => {
  const source = join(root, "extension-sources", "navigation-probe");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "navigation-probe",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
      modes: [{ id: "policy", ref: { kind: "mode", id: "policy" }, label: "Policy", regions: ["main", "side", "secondary"], regionSettings: { side: { canOpen: true, canClose: false, acceptsTabs: true, resizable: false, movable: false, floatable: false } } }],
      resourceKinds: [{ id: "record", ref: { kind: "resource-kind", id: "record" } }],
      views: [{ id: "document", ref: { kind: "view", id: "document" }, title: "Document", body: { kind: "file", resourceKind: { kind: "resource-kind", id: "record" }, load: () => ({ content: "probe", editable: false }) } }],
      placements: [{ id: "reader", ref: { kind: "placement", id: "reader" }, mode: { kind: "mode", extensionId: "pstdio", id: "project" }, region: "side", replaces: [{ kind: "page-slot", page: { kind: "page", id: "record" }, id: "legacy" }], item: { kind: "binding", binding: { kinds: [{ kind: "resource-kind", id: "record" }], view: { kind: "view", id: "document" }, cardinality: "many" } } }],
      pages: [{ id: "record", ref: { kind: "page", id: "record" }, title: "Record", path: "record", parent: { kind: "page", extensionId: "pstdio", id: "start" }, mode: { kind: "mode", extensionId: "pstdio", id: "project" }, resource: { kinds: [{ kind: "resource-kind", id: "record" }] }, document: { metadataKey: "documentId" }, regionSettings: { main: { showHeader: false } }, panelView: { kind: "placement", id: "reader" }, main: { kind: "view", presentation: "page", view: { kind: "view", id: "document" }, cardinality: "one", empty: { view: { kind: "view", id: "document" }, breadcrumb: { label: "New record", icon: "add", menu: [{ id: "record", rows: [{ id: "open", label: "Open record", action: { kind: "page", page: { kind: "page", id: "record" }, resource: { type: "record", id: "record-1" } } }] }] } } }, slots: [], panels: {} }],
      commands: [{
      id: "replace-document", ref: { kind: "command", id: "replace-document" }, title: "Replace document",
      run(ctx: { navigation: { open(target: unknown): void } }) {
        ctx.navigation.open({ kind: "viewer", operation: "replace", from: { type: "record", id: "draft" }, resource: { type: "record", id: "created" }, position: { line: 4 } });
      },
    }, {
      id: "open-document", ref: { kind: "command", id: "open-document" }, title: "Open document",
      run(ctx: { navigation: { open(target: unknown): void } }) {
        ctx.navigation.open({ kind: "page", page: { kind: "page", id: "record" }, resource: { type: "record", id: "record-1", metadata: { documentId: "file-1" } }, position: { line: 2, column: 3 } });
      },
    }, {
      id: "open", ref: { kind: "command", id: "open" }, title: "Open", cli: true,
      params: { href: { type: "text" } },
      run(ctx: { navigation: { open(target: unknown): void } }, params: { href?: string }) {
        ctx.navigation.open({ kind: "href", href: params.href ?? "https://example.com/created" });
        return { id: "created" };
      },
    }] };\n`,
  );
  return source;
};

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
    expect.objectContaining({
      localId: "record",
      document: { metadataKey: "documentId" },
      regionSettings: { main: { showHeader: false } },
      panelView: { kind: "placement", id: "reader", extensionId: "test.navigation-probe" },
      main: expect.objectContaining({
        presentation: "page",
        empty: {
          view: { kind: "view", id: "document", extensionId: "test.navigation-probe" },
          breadcrumb: {
            label: "New record",
            icon: "add",
            menu: [
              {
                id: "record",
                rows: [
                  {
                    id: "open",
                    label: "Open record",
                    action: {
                      kind: "page",
                      page: { kind: "page", id: "record", extensionId: "test.navigation-probe" },
                      resource: { type: "record", id: "record-1" },
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
    }),
  );
  expect(metadata.placements).toContainEqual(
    expect.objectContaining({
      localId: "reader",
      replaces: [
        { kind: "page-slot", page: { kind: "page", id: "record", extensionId: "test.navigation-probe" }, id: "legacy" },
      ],
    }),
  );
  const replaced = await fetch(
    input.baseUrl +
      "/v1/projects/" +
      input.projectId +
      "/extensions/commands/test.navigation-probe.command.replace-document/execute",
    {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "dashboard", params: {} }),
    },
  );
  expect(replaced.status).toBe(200);
  expect(await replaced.json()).toMatchObject({
    outcome: {
      status: "success",
      navigationRequests: [
        {
          kind: "viewer",
          operation: "replace",
          from: { type: "record", id: "draft" },
          resource: { type: "record", id: "created" },
          position: { line: 4 },
        },
      ],
    },
  });
  expect(metadata.modes).toContainEqual(
    expect.objectContaining({
      localId: "policy",
      regionSettings: {
        side: { canOpen: true, canClose: false, acceptsTabs: true, resizable: false, movable: false, floatable: false },
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
