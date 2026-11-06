import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect as expectUI } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import type { KanbanRendererQueryResult, ResourceListRendererRow } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { createDeviceCommandPeer } from "./packaged-device-commands.fixture";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

type ResourceListRendererQueryResult = Omit<KanbanRendererQueryResult, "rows"> & { rows: ResourceListRendererRow[] };
let root: string;
let extensionSource: string;
let harness: string;
setupPackagedSmokeTests(async () => {
  root = await mkdtemp(join(tmpdir(), "packaged-workspace-devices-"));
  extensionSource = await preparePackagedExtensionSource(
    join(root, "source"),
    join(import.meta.dirname, "../../../../extensions/pstdio-workspaces"),
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
      `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-workspaces.${id}/execute`,
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
        rendererId: "pstdio.pstdio-workspaces.view.workspaces",
        projectId,
        invocation: { placement: "visible" },
      },
      settings: { showChildren: true },
    });
    expect(result.ok, result.reason).toBe(true);
    return result.value as ResourceListRendererQueryResult;
  };
  const details = async (deviceId: string) => {
    const result = await command("view.device-capacity.controls.query", {
      renderer: {
        rendererId: "pstdio.pstdio-workspaces.view.device-capacity",
        projectId,
        invocation: { placement: "visible" },
        pageParams: { "device-id": deviceId },
      },
    });
    expect(result.ok, result.reason).toBe(true);
    return result.value;
  };
  return { client, id: identity.environmentId, command, query, details };
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
        startPackagedServe(join(root, "a"), env).then((runtime) => (a = runtime)),
        startPackagedServe(join(root, "b"), env).then((runtime) => (b = runtime)),
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
        progress("set device limits");
        await first.command("command.set-limit", { limit: 4 });
        await second.command("command.set-limit", { limit: 7 });
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
        progress("query device menus and capacity");
        const data = await second.query();
        const device = data.attributes!.find((field) => field.id === "device")!;
        if (device.type.kind !== "enum") throw new Error("Device groups are unavailable");
        expect(device.type.options[0]!.value).toBe(second.id);
        expect(device.type.options[0]!.contextMenuActions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "details", label: "This device" }),
            expect.objectContaining({ id: "create", label: "Create workspace" }),
          ]),
        );
        const localDetails = await second.details(second.id);
        expect(localDetails.params).toContainEqual(expect.objectContaining({ id: "limit", defaultValue: 7 }));
        expect(device.type.options.find((option) => option.value === first.id)?.contextMenuActions).toEqual([
          expect.objectContaining({ id: "details", label: "Device details" }),
        ]);
        const foreign = data.rows.find((row) => row.resource?.device?.id === first.id)!;
        expect(foreign.target).toMatchObject({ kind: "page", page: { id: "history" } });
        expect(foreign.children).toContainEqual(
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
      await signInBrowser(
        page,
        runtime.descriptor,
        `/projects/${projectId}/extensions/pstdio.pstdio-workspaces/workspaces`,
      );
      progress("browser signed in");
      await expectUI(page.getByTestId("resource-list-renderer")).toBeVisible();
      progress("workspaces collection visible");
      const history = page.getByRole("option").filter({ hasText: "Device A history" });
      await expectUI(history).toBeVisible();
      await page.getByRole("tab", { name: "Compact", exact: true }).click();
      await expectUI(history).toHaveCount(0);
      await page.getByRole("tab", { name: "By device", exact: true }).click();
      await expectUI(history).toBeVisible();
      progress("Compact and By device verified");
      await history.click();
      await expectUI(page).toHaveURL(/\/session\?/);
      await expectUI(page.getByText("Private workspace history", { exact: true })).toBeVisible();
      progress("private history visible");
      progress("stop first runtime");
      if (a) await stopProcess(a.child);
      peer.setDeviceOnline(first.id, false);
      progress("query offline device and cached capacity");
      const offline = await second.query();
      const options = offline.attributes!.find((field) => field.id === "device")!.type;
      if (options.kind !== "enum") throw new Error("Device groups are unavailable");
      expect(options.options.find((option) => option.value === first.id)?.contextMenuActions).toEqual([
        expect.objectContaining({ id: "details", label: "Device details" }),
      ]);
      progress("query offline capacity controls");
      const offlineDetails = await second.details(first.id);
      expect(offlineDetails.readOnly).toBe(true);
      expect(offlineDetails.params).toContainEqual(
        expect.objectContaining({ id: "presence", value: expect.stringContaining("Offline") }),
      );
      expect(offlineDetails.params).toContainEqual(expect.objectContaining({ id: "limit", value: "4" }));
      expect((await second.client.sessions.getConversation(session.id)).messages).toContainEqual(
        expect.objectContaining({ id: "private" }),
      );
      progress("history and offline capacity verified");
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
      await rm(root, { recursive: true, force: true });
      progress("cleanup complete");
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
