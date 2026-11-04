import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const writePackagedChoiceSource = (root: string, name: string) => {
  const source = join(root, "extensions", name);
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name,
      publisher: "pstdio",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "extension.ts"), "export default {};\n");
  return source;
};

export const writePackagedChoiceSources = (root: string) => {
  const names = ["harness-codex", "pstdio-planner", "pstdio-base-themes", "pstdio-skills"];
  for (const name of names) writePackagedChoiceSource(root, name);
  const client = writePackagedChoiceSource(root, "catalog-client");
  writeFileSync(
    join(client, "extension.ts"),
    `export default {
    projectSetup: { view: { kind: "view", id: "setup" }, hiddenSetting: "hidden" },
    settings: { properties: { hidden: { type: "boolean", scope: "device", default: false } } },
    views: [{ id: "setup", ref: { kind: "view", id: "setup" }, title: "Project setup", body: { kind: "webview", entry: { kind: "package-asset", path: "./setup.html", baseUrl: import.meta.url } } }],
    commands: [{ id: "select", ref: { kind: "command", id: "select" }, title: "Select tools", params: { names: { type: "json", required: true } }, async run(ctx, input) { await ctx.extensions.install(input.names); return ctx.extensions.list(); } }]
  };`,
  );
  writeFileSync(join(client, "setup.html"), "<html><body>Project setup</body></html>");
  // Selection resolves the configured catalog, including sources registered later in this flow.
  return [...names, "harness-pi"].map((installName) => ({
    installName,
    extensionId: `pstdio.${installName}`,
    displayName: installName,
    description: "",
    origin: { kind: "git", url: "https://example.com/probe.git", path: installName, ref: "main" },
    default: false,
  }));
};

export const expectPackagedProjectChoices = async (
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
  peerId: string,
  root: string,
) => {
  const extensions = async (id: string) =>
    (await (await fetch(`${baseUrl}/v1/projects/${id}/extensions`, { headers })).json()).extensions as {
      extensionId: string;
      enabled: boolean;
    }[];
  const enabled = async (id: string, extensionId: string) =>
    (await extensions(id)).find((entry) => entry.extensionId === extensionId)?.enabled;
  const waitForEnabled = async (id: string, extensionId: string) => {
    const deadline = Date.now() + PACKAGED_TEST_TIMEOUT;
    while (Date.now() < deadline) {
      if (await enabled(id, extensionId)) return;
      await Bun.sleep(25);
    }
    throw new Error(`Extension ${extensionId} was not enabled for project ${id} before the packaged test deadline.`);
  };
  for (const id of [projectId, peerId]) {
    expect(await enabled(id, "pstdio.harness-codex")).toBe(false);
    expect(await enabled(id, "pstdio.pstdio-planner")).toBe(false);
  }
  for (const id of [projectId, peerId]) {
    const attached = await fetch(`${baseUrl}/v1/projects/${id}/extensions/installed/catalog-client/enable`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Catalog client",
        extensionId: "pstdio.catalog-client",
        manifest: {},
        name: "catalog-client",
        sourcePath: join(root, "extensions", "catalog-client"),
        sourceKind: "local_path",
        version: "1.0.0",
      }),
    });
    expect(attached.status).toBe(200);
  }
  const metadata = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/ui`, { headers });
  expect(metadata.status).toBe(200);
  expect((await metadata.json()).projectSetups).toContainEqual(
    expect.objectContaining({ extensionId: "pstdio.catalog-client", hiddenSetting: "hidden" }),
  );
  const harness = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.catalog-client.command.select/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params: { names: ["harness-codex"] } }),
    },
  );
  expect(harness.status).toBe(200);
  await waitForEnabled(projectId, "pstdio.harness-codex");
  expect(await enabled(peerId, "pstdio.harness-codex")).toBe(false);
  const empty = await fetch(
    `${baseUrl}/v1/projects/${peerId}/extensions/commands/pstdio.catalog-client.command.select/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params: { names: ["pstdio-base-themes", "pstdio-skills"] } }),
    },
  );
  expect(empty.status).toBe(200);
  await waitForEnabled(peerId, "pstdio.pstdio-skills");
  expect(await enabled(peerId, "pstdio.pstdio-planner")).toBe(false);
  const sourcePath = writePackagedChoiceSource(root, "harness-pi");
  const registered = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/installed/harness-pi/enable`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Pi",
      extensionId: "pstdio.harness-pi",
      manifest: { id: "pstdio.harness-pi", name: "harness-pi" },
      name: "harness-pi",
      sourcePath,
      sourceKind: "local_path",
      version: "1.0.0",
    }),
  });
  expect(registered.status).toBe(200);
  const late = await fetch(
    `${baseUrl}/v1/projects/${peerId}/extensions/commands/pstdio.catalog-client.command.select/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params: { names: ["harness-pi"] } }),
    },
  );
  expect(late.status).toBe(200);
  await waitForEnabled(peerId, "pstdio.harness-pi");
  expect(await enabled(peerId, "pstdio.pstdio-planner")).toBe(false);
};
