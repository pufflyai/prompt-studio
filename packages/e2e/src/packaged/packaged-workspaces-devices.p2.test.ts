import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect as expectUI } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import type { KanbanRendererQueryResult, ResourceListRendererRow } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { e2eExtension } from "../default-extensions";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { createDeviceCommandPeer } from "./packaged-device-commands.fixture";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { removeTestDirectory } from "./remove-test-directory";

type ResourceListRendererQueryResult = Omit<KanbanRendererQueryResult, "rows"> & { rows: ResourceListRendererRow[] };
let root: string;
let extensionSource: string;
let sessionsSource: string;
let harness: string;
setupPackagedSmokeTests(async () => {
  root = await mkdtemp(join(tmpdir(), "packaged-workspace-devices-"));
  extensionSource = await preparePackagedExtensionSource(
    join(root, "source"),
    join(import.meta.dirname, "../../../../extensions/pstdio-workspaces"),
    { install: true },
  );
  sessionsSource = await preparePackagedExtensionSource(
    join(root, "sessions-source"),
    join(import.meta.dirname, "../../../../extensions/pstdio-session-browser"),
    { install: true },
  );
  harness = join(root, "harness");
  await mkdir(harness);
  await Bun.write(
    join(harness, "package.json"),
    JSON.stringify({
      name: "workspace-history-fixture",
      publisher: "test",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await Bun.write(
    join(harness, "extension.ts"),
    `export default {harnesses:[{id:"worker",ref:{kind:"harness",id:"worker"},label:"Worker",capabilities:()=>[],start(_ctx,input){input.events.push({op:"add",path:"/messages/0",value:{id:"private",role:"assistant",parts:[{type:"text",text:"Private workspace history"}]}});return {agentSessionId:"native",done:Promise.resolve({status:"completed"}),stop(){}};},resume(){throw new Error("Read only");},getMessages:()=>[],recoverMessages(_ctx,input){return {kind:"recovered",messages:input.knownMessages};}}]};`,
  );
});
const waitFor = async (condition: () => Promise<boolean>) => {
  while (!(await condition())) await Bun.sleep(25);
};

const connectDevice = async (
  host: Awaited<ReturnType<typeof startPackagedServe>>,
  name: string,
  projectId: string,
  peerOrigin: string,
  progress: (phase: string) => void,
) => {
  progress(`connect device ${name}`);
  const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
  const folder = join(root, name, "project");
  await mkdir(folder);
  await Bun.write(join(folder, "private.txt"), `${name} device file`);
  const identity = await client.runtime.environment();
  const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/environment-binding`, {
    method: "PUT",
    headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
    body: JSON.stringify({
      ...identity,
      name: "Workspace devices",
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    }),
  });
  expect(response.status).toBe(201);
  // Binding chooses a local folder. Select the shared providers separately,
  // as with the fixture harness below; it does not enable optional user tools.
  for (const [installName, sourcePath] of [
    ["pstdio-workspaces", extensionSource],
    ["pstdio-session-browser", sessionsSource],
  ] as const) {
    const manifest = await Bun.file(join(sourcePath, "package.json")).json();
    await client.extensions.enableInstalled(projectId, installName, {
      displayName: manifest.displayName ?? installName,
      extensionId: `${manifest.publisher}.${manifest.name}`,
      name: manifest.name,
      manifest,
      sourceKind: "local_path",
      sourcePath,
      sourceHash: null,
      sourceRef: null,
      version: manifest.version,
    });
  }
  await client.extensions.enableInstalled(projectId, "workspace-history-fixture", {
    displayName: "Workspace history fixture",
    extensionId: "test.workspace-history-fixture",
    name: "workspace-history-fixture",
    manifest: { name: "workspace-history-fixture" },
    sourceKind: "local_path",
    sourcePath: harness,
    sourceHash: null,
    sourceRef: null,
    version: null,
  });
  progress(`log in device ${name}`);
  const login = await client.account.login(peerOrigin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  expect((await fetch(callback)).status).toBe(200);
  progress(`sync project on device ${name}`);
  await client.account.syncProject(projectId);
  progress(`device ${name} connected`);
  const command = async (id: string, params: object = {}, resource?: object) => {
    const response = await fetch(
      `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.workspaces.${id}/execute`,
      {
        method: "POST",
        headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ params, resource, source: "dashboard" }),
      },
    );
    expect(response.status).toBe(200);
    return (await response.json()).outcome;
  };
  const query = async () => {
    const result = await command("view.workspaces.resourceList.query", {
      renderer: {
        rendererId: "pstdio.workspaces.view.workspaces",
        projectId,
        invocation: { placement: "visible" },
      },
      settings: {},
    });
    expect(result.ok, result.reason).toBe(true);
    return result.value as ResourceListRendererQueryResult;
  };
  return { client, id: identity.environmentId, command, query };
};

test(
  "installed Workspaces groups two devices and opens foreign private history without local actions",
  async () => {
    const started = performance.now();
    const progress = (phase: string) =>
      console.log(`Workspaces devices: ${phase} (${Math.round(performance.now() - started)}ms)`);
    progress("create TLS peer");
    const key = join(root, "key.pem"),
      cert = join(root, "cert.pem");
    expect(
      Bun.spawnSync([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ]).exitCode,
    ).toBe(0);
    const peer = createDeviceCommandPeer({ key: Bun.file(key), cert: Bun.file(cert) });
    const env = {
      NODE_EXTRA_CA_CERTS: cert,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: extensionSource, installName: "pstdio-workspaces", skipInstall: true },
        e2eExtension("pstdio-session-browser"),
        { source: harness, installName: "workspace-history-fixture", skipInstall: true },
      ]),
    };
    await mkdir(join(root, "a"));
    await mkdir(join(root, "b"));
    let a: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    let b: typeof a;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      // Both runtimes and the browser start cold inside this case and own separate state.
      const startingRuntimes = Promise.allSettled([
        startPackagedServe(join(root, "a"), env)
          .then((runtime) => (a = runtime))
          .catch((error) => {
            console.error("Workspaces device A startup failed", error);
            throw error;
          }),
        startPackagedServe(join(root, "b"), env)
          .then((runtime) => (b = runtime))
          .catch((error) => {
            console.error("Workspaces device B startup failed", error);
            throw error;
          }),
      ]);
      const openingBrowser = chromium.launch(PACKAGED_DASHBOARD_BROWSER).then((opened) => {
        browser = opened;
        progress("browser launched");
        return opened;
      });
      const preparingDevices = (async () => {
        progress("start both runtimes");
        const [firstRuntime, secondRuntime] = await startingRuntimes;
        if (firstRuntime.status === "rejected") throw firstRuntime.reason;
        if (secondRuntime.status === "rejected") throw secondRuntime.reason;
        progress("both runtimes ready");
        const projectId = crypto.randomUUID();
        const [first, second] = await Promise.all([
          connectDevice(firstRuntime.value, "a", projectId, peer.origin, progress),
          connectDevice(secondRuntime.value, "b", projectId, peer.origin, progress),
        ]);
        progress("create private history");
        const session = await first.client.sessions.create(projectId, {
          title: "Device A history",
          agent: "test.workspace-history-fixture.harness.worker",
          prompt: "Start",
        });
        progress("wait for native session completion");
        await waitFor(async () => (await first.client.sessions.get(session.id)).status === "completed");
        progress("wait for foreign history sync");
        await waitFor(async () =>
          (await second.client.sessions.query(projectId)).items.some((row) => row.id === session.id),
        );
        progress("wait for foreign workspace sync");
        await waitFor(async () =>
          (await second.client.workspaces.query(projectId)).items.some((row) => row.device?.id === first.id),
        );
        progress("query device groups and workspace history");
        const data = await second.query();
        const device = data.attributes!.find((field) => field.id === "device")!;
        if (device.type.kind !== "enum") throw new Error("Device groups are unavailable");
        expect(device.type.options[0]!.value).toBe(second.id);
        expect(device.type.options[0]!.contextMenuActions).toContainEqual(
          expect.objectContaining({
            id: "create",
            action: {
              kind: "command",
              target: { command: { kind: "command", extensionId: "pstdio.workspaces", id: "show-create" } },
            },
          }),
        );
        const foreign = data.rows.find((row) => row.resource?.device?.id === first.id)!;
        expect(foreign.target).toMatchObject({ kind: "page", page: { id: "history" } });
        const history = await second.command("view.history.resourceList.query", {
          renderer: {
            rendererId: "pstdio.workspaces.view.history",
            projectId,
            invocation: { placement: "visible" },
            resource: foreign.resource,
          },
          settings: {},
        });
        expect(history.ok, history.reason).toBe(true);
        expect(history.value.rows).toContainEqual(
          expect.objectContaining({
            title: "Device A history",
            target: expect.objectContaining({
              page: expect.objectContaining({ id: "session", extensionId: "pstdio" }),
            }),
          }),
        );
        const resource = foreign.resource!;
        expect((await second.command("command.open-terminal", {}, resource)).ok).toBe(false);
        expect((await second.command("command.rename", { id: resource.id, name: "Denied" }, resource)).ok).toBe(false);
        expect(
          (await second.command("command.read-changes", { workspaceId: resource.id, mode: "current" }, resource)).ok,
        ).toBe(false);
        expect((await second.command("command.create-file", { name: "Denied.txt" }, resource)).ok).toBe(false);
        return { first, second, session, projectId, runtime: secondRuntime.value };
      })();
      const [devices, opened] = await Promise.allSettled([preparingDevices, openingBrowser]);
      if (devices.status === "rejected") throw devices.reason;
      if (opened.status === "rejected") throw opened.reason;
      const { first, second, session, projectId, runtime } = devices.value;
      progress("open foreign history in browser");
      const page = await opened.value.newPage();
      await page.addInitScript((id) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", id);
      }, projectId);
      await signInBrowser(page, runtime.descriptor, `/projects/${projectId}/extensions/pstdio.workspaces/workspaces`);
      progress("browser signed in");
      await expectUI(page.getByTestId("resource-list-renderer")).toBeVisible();
      progress("workspaces collection visible");
      const foreignWorkspace = (await second.query()).rows.find((row) => row.resource?.device?.id === first.id);
      if (!foreignWorkspace) throw new Error("Foreign workspace is unavailable");
      await page.locator(`[role="option"][id='${JSON.stringify(["resource", foreignWorkspace.id])}']`).click();
      await expectUI(page).toHaveURL(/\/history\?/);
      await page
        .getByRole("region", { name: "Main", exact: true })
        .getByRole("option")
        .filter({ hasText: "Device A history" })
        .click();
      await expectUI(
        page
          .getByRole("region", { name: "Side Panel", exact: true })
          .getByText("Private workspace history", { exact: true }),
      ).toBeVisible();
      progress("private history visible");
      progress("stop first runtime");
      if (a) await stopProcess(a.child);
      peer.setDeviceOnline(first.id, false);
      progress("query offline workspace history");
      const offline = await second.query();
      expect(offline.rows).toContainEqual(
        expect.objectContaining({
          resource: expect.objectContaining({ device: expect.objectContaining({ id: first.id }) }),
          target: expect.objectContaining({ page: expect.objectContaining({ id: "history" }) }),
        }),
      );
      expect((await second.client.sessions.getConversation(session.id)).messages).toContainEqual(
        expect.objectContaining({ id: "private" }),
      );
      progress("online and offline history verified");
    } finally {
      progress("cleanup");
      await browser?.close();
      progress("stop first runtime");
      if (a) await stopProcess(a.child);
      progress("first runtime stopped");
      progress("stop second runtime");
      if (b) await stopProcess(b.child);
      progress("second runtime stopped");
      progress("close device peer");
      await peer.close();
      progress("device peer closed");
      progress("remove fixture directory");
      await removeTestDirectory(root);
      expect(existsSync(root)).toBe(false);
      progress("cleanup complete");
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
