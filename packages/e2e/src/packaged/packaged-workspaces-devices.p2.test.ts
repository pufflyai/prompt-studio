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

test(
  "installed Workspaces groups two devices and opens foreign private history without local actions",
  async () => {
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
    const a = await startPackagedServe(join(root, "a"), env);
    let b: typeof a | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      b = await startPackagedServe(join(root, "b"), env);
      const projectId = crypto.randomUUID();
      const connect = async (host: typeof a, name: string) => {
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
        const login = await client.account.login(peer.origin);
        const url = new URL(login.url);
        const callback = new URL(url.searchParams.get("callback")!);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "one-use");
        expect((await fetch(callback)).status).toBe(200);
        await client.account.syncProject(projectId);
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
        return { client, id: identity.environmentId, command, query };
      };
      const first = await connect(a, "a"),
        second = await connect(b, "b");
      await first.command("command.set-limit", { limit: 4 });
      await second.command("command.set-limit", { limit: 7 });
      const session = await first.client.sessions.create(projectId, {
        title: "Device A history",
        agent: "test.workspace-history-fixture.harness.worker",
        prompt: "Start",
      });
      await waitFor(async () => (await first.client.sessions.get(session.id)).status === "completed");
      await waitFor(async () =>
        (await second.client.sessions.query(projectId)).items.some((row) => row.id === session.id),
      );
      await waitFor(async () =>
        (await second.client.workspaces.query(projectId)).items.some((row) => row.device?.id === first.id),
      );
      const data = await second.query();
      const device = data.attributes!.find((field) => field.id === "device")!;
      if (device.type.kind !== "enum") throw new Error("Device groups are unavailable");
      expect(device.type.options[0]!.value).toBe(second.id);
      expect(device.type.options[0]!.note).toContain("7");
      expect(device.type.options.find((option) => option.value === first.id)?.canCreate).toBe(false);
      const foreign = data.rows.find((row) => row.resource?.device?.id === first.id)!;
      expect(foreign.target).toMatchObject({ kind: "page", page: { id: "history" } });
      expect(foreign.children).toContainEqual(
        expect.objectContaining({
          title: "Device A history",
          target: expect.objectContaining({ page: expect.objectContaining({ id: "session", extensionId: "pstdio" }) }),
        }),
      );
      const resource = foreign.resource!;
      expect((await second.command("command.open-terminal", {}, resource)).ok).toBe(false);
      expect((await second.command("command.rename", { id: resource.id, name: "Denied" }, resource)).ok).toBe(false);
      expect(
        (await second.command("command.read-changes", { workspaceId: resource.id, mode: "current" }, resource)).ok,
      ).toBe(false);
      expect((await second.command("command.create-file", { name: "Denied.txt" }, resource)).ok).toBe(false);
      browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      const page = await browser.newPage();
      await page.addInitScript((id) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", id);
      }, projectId);
      await signInBrowser(page, b.descriptor, `/projects/${projectId}/extensions/pstdio.pstdio-workspaces/workspaces`);
      await expectUI(page.getByTestId("resource-list-renderer")).toBeVisible();
      const history = page.getByRole("option").filter({ hasText: "Device A history" });
      await expectUI(history).toBeVisible();
      await page.getByRole("tab", { name: "Compact", exact: true }).click();
      await expectUI(history).toHaveCount(0);
      await page.getByRole("tab", { name: "By device", exact: true }).click();
      await expectUI(history).toBeVisible();
      await history.click();
      await expectUI(page).toHaveURL(/\/session\?/);
      await expectUI(page.getByText("Private workspace history", { exact: true })).toBeVisible();
      await stopProcess(a.child);
      peer.setDeviceOnline(first.id, false);
      const offline = await second.query();
      const options = offline.attributes!.find((field) => field.id === "device")!.type;
      if (options.kind !== "enum") throw new Error("Device groups are unavailable");
      expect(options.options.find((option) => option.value === first.id)?.note).toContain("Offline");
      expect(options.options.find((option) => option.value === first.id)?.note).toContain("4");
      expect((await second.client.sessions.getConversation(session.id)).messages).toContainEqual(
        expect.objectContaining({ id: "private" }),
      );
    } finally {
      await browser?.close();
      await stopProcess(a.child);
      if (b) await stopProcess(b.child);
      await peer.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
