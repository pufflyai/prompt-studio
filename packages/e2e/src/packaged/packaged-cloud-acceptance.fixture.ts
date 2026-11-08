import { type ChildProcess, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { e2eExtensions } from "../default-extensions";
import { installBuiltSdk } from "../helpers/installed-sdk";
import { startPublicTextPeer } from "./packaged-public-text-peer.fixture";
import { runtimeAuthorization, startPackagedServe } from "./packaged-serve-helpers";

export const acceptanceOwner = "example.shared-notes";
export const createCloudAcceptanceFixture = async (
  root: string,
  children: Set<ChildProcess>,
  options: { cloudUi?: boolean; signal?: AbortSignal } = {},
) => {
  options.signal?.throwIfAborted();
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  execFileSync(
    "openssl",
    [
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
    ],
    { stdio: "pipe" },
  );
  const source = join(root, "unrelated-extension");
  mkdirSync(source);
  for (const name of [
    "grouped-storage-extension.ts",
    "cloud-acceptance-commands.ts",
    "collection-observation-command.ts",
  ])
    cpSync(join(import.meta.dirname, "fixtures", name), join(source, name));
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "shared-notes",
      publisher: "example",
      version: "1.0.0",
      type: "module",
      main: "./grouped-storage-extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  // The unrelated extension consumes the packed public SDK. It has no sync, merge or crypto code.
  installBuiltSdk(source);
  const defaults = JSON.parse(e2eExtensions("pstdio-notes", "pstdio-artifacts", "pstdio-planner"));
  if (options.cloudUi) defaults.defaultExtensions.push(...JSON.parse(e2eExtensions("pstdio-cloud")).defaultExtensions);
  defaults.defaultExtensions.push({ source, installName: "shared-notes", skipInstall: true });
  const peer = await startPublicTextPeer(root, undefined, options.signal);
  const devices: CloudAcceptanceDevice[] = [];
  const start = async (name: string) => {
    options.signal?.throwIfAborted();
    const home = join(root, name);
    const folder = join(root, `${name}-folder`);
    mkdirSync(home, { recursive: true });
    mkdirSync(folder, { recursive: true });
    const logPath = join(root, `${name}.jsonl`);
    const host = await startPackagedServe(
      home,
      {
        NODE_EXTRA_CA_CERTS: cert,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(defaults),
        PSTDIO_LOG_PATH: logPath,
        PSTDIO_LOG_LEVEL: "debug",
        PSTDIO_EXTENSION_WEBVIEW_BUILDS: options.cloudUi ? "1" : "0",
        ...(options.cloudUi ? { PSTDIO_ACCOUNT_MANAGER_ORIGIN: peer.origin } : {}),
      },
      undefined,
      undefined,
      undefined,
      options.signal,
    );
    children.add(host.child);
    options.signal?.throwIfAborted();
    const client = createClient({
      baseUrl: host.baseUrl,
      token: host.descriptor.token,
      fetch: ((url, init) =>
        fetch(url, {
          ...init,
          signal: options.signal
            ? AbortSignal.any([options.signal, ...(init?.signal ? [init.signal] : [])])
            : init?.signal,
        })) as typeof fetch,
    });
    const { environmentId } = await client.runtime.environment();
    const command = async <T>(projectId: string, owner: string, id: string, params: object = {}) => {
      const response = await fetch(
        `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/${owner}.command.${id}/execute`,
        {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ params, source: "api" }),
          signal: options.signal,
        },
      );
      const body = (await response.json()) as { outcome?: { ok: boolean; value: T } };
      if (!response.ok || !body.outcome?.ok)
        throw new Error(`${name}: ${owner}.${id}: HTTP ${response.status}: ${JSON.stringify(body)}`);
      return body.outcome.value;
    };
    const device = { name, home, folder, host, client, environmentId, command, logPath, signal: options.signal };
    devices.push(device);
    return device;
  };
  // Diagnostic collection has its own stricter deadline so a dead peer cannot prevent teardown.
  const diagnostics = async (projectId?: string) => {
    const signal = AbortSignal.timeout(1_000);
    const [relay, snapshots] = await Promise.all([
      peer.inspect(signal).catch((error) => ({ error: String(error) })),
      Promise.all(
        devices.map(async (device) => ({
          name: device.name,
          environmentId: device.environmentId,
          pid: device.host.child.pid,
          exitCode: device.host.child.exitCode,
          signalCode: device.host.child.signalCode,
          status: projectId
            ? await fetch(`${device.host.baseUrl}/v1/account/projects/${projectId}/sync`, {
                headers: runtimeAuthorization(device.host.descriptor),
                signal,
              })
                .then(async (response) => ({ httpStatus: response.status, body: await response.json() }))
                .catch(String)
            : undefined,
          log: (() => {
            try {
              return readFileSync(device.logPath, "utf8");
            } catch {
              return "No runtime log";
            }
          })(),
        })),
      ),
    ]);
    return { relay, devices: snapshots };
  };
  return { peer, start, devices, diagnostics };
};

export interface CloudAcceptanceDevice {
  name: string;
  signal?: AbortSignal;
  home: string;
  folder: string;
  host: Awaited<ReturnType<typeof startPackagedServe>>;
  client: ReturnType<typeof createClient>;
  environmentId: string;
  logPath: string;
  command<T>(projectId: string, owner: string, id: string, params?: object): Promise<T>;
}
export const signInCloudAcceptanceDevice = async (device: CloudAcceptanceDevice, origin: string) => {
  const login = new URL((await device.client.account.login(origin)).url);
  const callback = new URL(login.searchParams.get("callback")!);
  callback.searchParams.set("state", login.searchParams.get("state")!);
  callback.searchParams.set("code", "controlled-fixture-login");
  const response = await fetch(callback, { signal: device.signal });
  if (!response.ok) throw new Error(`${device.name} controlled login failed: ${response.status}`);
  const status = await device.client.account.status();
  if (status.login?.deviceId !== device.environmentId || status.login.accountId !== "owner")
    throw new Error(`${device.name} was not enrolled with its own runtime identity in the shared account`);
};
