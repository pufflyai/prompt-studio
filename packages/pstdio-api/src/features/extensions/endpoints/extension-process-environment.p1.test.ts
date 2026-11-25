import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { closeBackendWorkers } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { issueAutomationToken, requestWithToken } from "../../automation/automation-runs.fixture";
import { hashExtensionSource, loadExtensionSource } from "../extension-runtime";

const OWNER_TOKEN = "owner-runtime-token";
const AGENT_KEY = "host-only-agent-key";
let root: string;
let source: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let projectId: string;
let instanceId: string;
const previous = {
  home: process.env.PSTDIO_HOME,
  defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS,
  key: process.env.EXTENSION_AGENT_KEY,
};

const entry = (revision: number) => `
export default {
  commands: [
    {
      id: "agent",
      ref: { kind: "command", id: "agent" },
      title: "Start agent",
      automation: true,
      async run(ctx, params) {
        const script = 'require("node:fs").writeFileSync(process.argv[1], ""); console.log(process.env.EXTENSION_AGENT_KEY);';
        const result = await ctx.process.run({
          command: [process.execPath, "-e", script, params.marker],
          envFromHost: ["EXTENSION_AGENT_KEY"],
        });
        return { revision: ${revision}, workerSees: process.env.EXTENSION_AGENT_KEY ?? null, stdout: result.stdout.trim() };
      },
    },
  ],
};
`;

const owner = (path: string, init: RequestInit = {}) => requestWithToken(handle.app, OWNER_TOKEN, path, init);
const permissionPath = () => `/v1/projects/${projectId}/extension-process-environment/example.agent`;
const read = async () => (await owner(permissionPath())).json();
const grant = (body: unknown, request = owner) =>
  request(permissionPath(), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const startAgent = async (marker: string) => {
  const response = await owner(`/v1/projects/${projectId}/extensions/commands/example.agent.command.agent/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: { marker } }),
  });
  return { text: await response.clone().text(), body: (await response.json()) as { outcome: Record<string, unknown> } };
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "extension-process-environment-"));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.EXTENSION_AGENT_KEY = AGENT_KEY;
  source = join(root, "agent");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "agent",
      version: "1.0.0",
      publisher: "example",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      pstdio: { backendRuntime: "process", processEnvironment: ["EXTENSION_AGENT_KEY", "EXTENSION_OTHER_KEY"] },
    }),
  );
  await writeFile(join(source, "extension.ts"), entry(1));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(root, "storage"),
    host: { kind: "standalone", token: OWNER_TOKEN },
  });
  projectId = (
    await (
      await owner("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Agents" })),
      })
    ).json()
  ).id;
  const loaded = await loadExtensionSource(source);
  const enabled = await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "agent",
    extensionId: "example.agent",
    name: "agent",
    displayName: "Agent",
    sourcePath: source,
    sourceKind: "local_path",
    sourceHash: hashExtensionSource(source),
    manifest: loaded.manifest,
  });
  instanceId = enabled.instance.id;
});

afterAll(async () => {
  await handle?.close();
  await closeBackendWorkers();
  for (const [key, value] of [
    ["PSTDIO_HOME", previous.home],
    ["PSTDIO_DEFAULT_EXTENSIONS", previous.defaults],
    ["EXTENSION_AGENT_KEY", previous.key],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
});

describe("extension process environment permissions", () => {
  test("the extension's requested names are listed with no grant, and denial starts no child", async () => {
    const extensions = await (await owner(`/v1/projects/${projectId}/extensions`)).json();
    expect(extensions.extensions[0].processEnvironment).toEqual(["EXTENSION_AGENT_KEY", "EXTENSION_OTHER_KEY"]);
    expect(await read()).toMatchObject({ requested: ["EXTENSION_AGENT_KEY", "EXTENSION_OTHER_KEY"], granted: [] });

    const marker = join(root, "denied");
    const { body } = await startAgent(marker);

    expect(body.outcome.ok).toBe(false);
    expect(JSON.stringify(body.outcome)).toContain("not granted");
    expect(existsSync(marker)).toBe(false);
  });

  test("an unknown project reports the extension as missing", async () => {
    const response = await owner("/v1/projects/missing-project/extension-process-environment/example.agent");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "extension_not_found" });
  });

  test("machine automation tokens and callers without the owner credential cannot grant or revoke", async () => {
    const { sourceIdentity } = await read();
    const { token } = await issueAutomationToken(owner, projectId, ["example.agent.command.agent"]);
    const anonymous = (path: string, init?: RequestInit) => handle.app.request(path, init);

    expect((await grant({ names: ["EXTENSION_AGENT_KEY"], sourceIdentity }, anonymous)).status).toBe(401);
    expect(
      (
        await grant({ names: ["EXTENSION_AGENT_KEY"], sourceIdentity }, (path, init) =>
          requestWithToken(handle.app, token, path, init),
        )
      ).status,
    ).toBe(401);
    expect((await requestWithToken(handle.app, token, permissionPath(), { method: "DELETE" })).status).toBe(401);
    expect((await read()).granted).toEqual([]);
  });

  test("a grant must choose requested names for the source the person saw", async () => {
    const { sourceIdentity } = await read();

    expect((await grant({ names: ["OPENAI_API_KEY"], sourceIdentity })).status).toBe(400);
    expect((await grant({ names: ["EXTENSION_AGENT_KEY"], sourceIdentity: "earlier-source" })).status).toBe(409);
  });

  test("granting forwards the selected value to the child only", async () => {
    const { sourceIdentity } = await read();
    const response = await grant({ names: ["EXTENSION_AGENT_KEY"], sourceIdentity });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ granted: ["EXTENSION_AGENT_KEY"], stale: false });

    const marker = join(root, "granted");
    const { body, text } = await startAgent(marker);

    expect(body.outcome).toMatchObject({ ok: true, value: { revision: 1, workerSees: null } });
    expect(existsSync(marker)).toBe(true);
    expect(text).not.toContain(AGENT_KEY);
  });

  test("changed source invalidates the grant until it is allowed again, and revoking retires it", async () => {
    await writeFile(join(source, "extension.ts"), entry(2));
    const reloaded = await owner(`/v1/projects/${projectId}/extensions/${instanceId}/reload`, { method: "POST" });
    expect(reloaded.status).toBe(200);

    const stale = await read();
    expect(stale).toMatchObject({ granted: [], stale: true });
    const marker = join(root, "after-update");
    expect((await startAgent(marker)).body.outcome.ok).toBe(false);
    expect(existsSync(marker)).toBe(false);

    expect((await grant({ names: ["EXTENSION_AGENT_KEY"], sourceIdentity: stale.sourceIdentity })).status).toBe(200);
    expect((await startAgent(join(root, "regranted"))).body.outcome).toMatchObject({
      ok: true,
      value: { revision: 2 },
    });

    expect((await owner(permissionPath(), { method: "DELETE" })).status).toBe(204);
    expect(await read()).toMatchObject({ granted: [], stale: false });
    expect((await startAgent(join(root, "revoked"))).body.outcome.ok).toBe(false);
  });
});
