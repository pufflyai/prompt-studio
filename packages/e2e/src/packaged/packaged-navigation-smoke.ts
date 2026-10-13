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
      modes: [{ id: "preview", ref: { kind: "mode", id: "preview" }, label: "Preview", regions: ["main"], basePage: { kind: "page", id: "record" } }, { id: "policy", ref: { kind: "mode", id: "policy" }, label: "Panel policy", regions: ["main", "side", "secondary"], floatingBubble: false, floating: { defaultTab: { kind: "panel", panel: { kind: "placement", id: "policy-tools" } } }, regionSettings: { side: { canOpen: false, canClose: false, acceptsTabs: false, resizable: true, movable: false, floatable: false, showHeader: false, collapsible: false }, secondary: { canOpen: true, canClose: true, defaultTab: { kind: "panel", panel: { kind: "placement", id: "policy-tools" } } } } }],
      placements: [{ id: "policy-tools", ref: { kind: "placement", id: "policy-tools" }, mode: { kind: "mode", id: "policy" }, region: "secondary", item: { kind: "view", view: { kind: "view", id: "document" }, presence: "closed" } }],
      resourceKinds: [{ id: "record", ref: { kind: "resource-kind", id: "record" } }],
      views: [{ id: "document", ref: { kind: "view", id: "document" }, title: "Document", body: { kind: "file", resourceKind: { kind: "resource-kind", id: "record" }, load: () => ({ content: "probe", editable: false }) } }],
      pages: [{ id: "record", ref: { kind: "page", id: "record" }, title: "Record", path: "record", parent: { kind: "page", extensionId: "pstdio", id: "start" }, mode: { kind: "mode", extensionId: "pstdio", id: "project" }, modes: [{ kind: "mode", extensionId: "pstdio", id: "project" }, { kind: "mode", id: "preview" }], resource: { kinds: [{ kind: "resource-kind", id: "record" }] }, document: { metadataKey: "documentId" }, main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" }, panelMenus: { right: { view: { kind: "view", id: "document" }, collapsible: false, size: { defaultPx: 200 } } }, regionSettings: { bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } }, slots: [{ id: "tools", region: "bottom", item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" } }], panels: {} }],
      commands: [{
      id: "open-document", ref: { kind: "command", id: "open-document" }, title: "Open document",
      run(ctx: { navigation: { open(target: unknown): void } }) {
        ctx.navigation.open({ kind: "page", page: { kind: "page", id: "record" }, mode: { kind: "mode", id: "preview" }, resource: { type: "record", id: "record-1", context: { type: "workspace", id: "w2", label: "Workspace 2" }, metadata: { documentId: "file-1" } }, position: { line: 2, column: 3 } });
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
      modes: [
        { extensionId: "pstdio", kind: "mode", id: "project" },
        { extensionId: "test.navigation-probe", kind: "mode", id: "preview" },
      ],
      panelMenus: {
        right: {
          view: { extensionId: "test.navigation-probe", kind: "view", id: "document" },
          collapsible: false,
          size: { defaultPx: 200 },
        },
      },
      regionSettings: { bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } },
      slots: [expect.objectContaining({ id: "tools", region: "bottom" })],
    }),
  );
  expect(metadata.modes).toContainEqual(
    expect.objectContaining({
      localId: "policy",
      floatingBubble: false,
      regionSettings: {
        side: {
          canOpen: false,
          canClose: false,
          acceptsTabs: false,
          resizable: true,
          movable: false,
          floatable: false,
          showHeader: false,
          collapsible: false,
        },
        secondary: {
          canOpen: true,
          canClose: true,
          defaultTab: {
            kind: "panel",
            panel: { kind: "placement", extensionId: "test.navigation-probe", id: "policy-tools" },
          },
        },
      },
      floating: {
        defaultTab: {
          kind: "panel",
          panel: { kind: "placement", extensionId: "test.navigation-probe", id: "policy-tools" },
        },
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
          mode: { extensionId: "test.navigation-probe", kind: "mode", id: "preview" },
          resource: {
            context: { type: "workspace", id: "w2", label: "Workspace 2" },
            metadata: { documentId: "file-1" },
          },
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
