import { expect } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, expect as browserExpect, chromium, type Page } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

export const waitForCloud = async (ready: () => Promise<boolean>) => {
  await browserExpect.poll(ready, { message: "Cloud project synchronization did not finish" }).toBe(true);
};
const signIn = async (client: ReturnType<typeof createClient>, origin: string) => {
  const login = new URL((await client.account.login(origin)).url);
  const callback = new URL(login.searchParams.get("callback")!);
  callback.searchParams.set("state", login.searchParams.get("state")!);
  callback.searchParams.set("code", "fixture-code");
  expect((await fetch(callback)).ok).toBe(true);
};

const startClients = async (
  homes: [string, string],
  env: [Record<string, string>, Record<string, string>],
  retain: (host: Awaited<ReturnType<typeof startPackagedServe>>, index: number) => void,
  retainBrowser: (browser: Browser) => void,
) => {
  const starts = await Promise.allSettled([
    ...homes.map(async (home, index) => retain(await startPackagedServe(home, env[index]), index)),
    chromium.launch(PACKAGED_DASHBOARD_BROWSER).then(retainBrowser),
  ]);
  const errors = starts.flatMap((start) => (start.status === "rejected" ? [start.reason] : []));
  if (errors.length) throw new AggregateError(errors, "Cloud Notes runtimes failed to start");
};

const createCertificate = (root: string) => {
  const key = join(root, "key.pem"),
    cert = join(root, "cert.pem");
  const openssl = Bun.spawnSync([
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
  ]);
  expect(openssl.exitCode).toBe(0);
  return { key, cert };
};

interface CloudProjectFixture {
  a: ReturnType<typeof createClient>;
  b: ReturnType<typeof createClient>;
  project: { id: string; name: string };
  page: Page;
  sourceFolder: string;
  second: Awaited<ReturnType<typeof startPackagedServe>>;
  phase(name: string): void;
}

// Each case owns two cold runtimes and a cold browser; neither shares warmed resources.
export const withCloudProject = async (
  kind: "notes" | "recovery",
  run: (fixture: CloudProjectFixture) => Promise<void>,
) => {
  const startedAt = performance.now();
  const phase = (name: string) =>
    console.info(`Cloud ${kind} +${Math.round(performance.now() - startedAt)}ms: ${name}`);
  const root = await mkdtemp(join(tmpdir(), `cloud-${kind}-`));
  let peer: ReturnType<typeof createPackagedSyncPeer> | undefined;
  let first: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  let second: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  let browser: Browser | undefined;
  try {
    const { key, cert } = createCertificate(root);
    peer = createPackagedSyncPeer({ key: Bun.file(key), cert: Bun.file(cert) });
    const env = { NODE_EXTRA_CA_CERTS: cert, PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" };
    const homes: [string, string] = [join(root, "a"), join(root, "b")];
    await Promise.all(homes.map((home) => mkdir(home)));
    await startClients(
      homes,
      [
        { ...env, PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(...(kind === "notes" ? ["pstdio-notes"] : [])) },
        { ...env, PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(kind === "notes" ? "pstdio-notes" : "pstdio-cloud") },
      ],
      (host, index) => {
        if (index === 0) first = host;
        else second = host;
      },
      (started) => {
        browser = started;
      },
    );
    const a = createClient({ baseUrl: first!.baseUrl, token: first!.descriptor.token });
    const b = createClient({ baseUrl: second!.baseUrl, token: second!.descriptor.token });
    phase("both runtimes and browser ready");
    const sourceFolder = join(root, "source");
    const localFolder = join(root, "local");
    await Promise.all([mkdir(sourceFolder), mkdir(localFolder)]);
    const createSource = async () => {
      const project = await a.projects.create(folderProjectInput({ name: `Cloud ${kind}` }, sourceFolder));
      if (kind === "notes") {
        const seeded = await a.extensions.execute("pstdio.pstdio-notes.command.notes.create", {
          projectId: project.id,
          params: { title: "From device A" },
          source: "api",
        });
        expect(seeded.outcome.ok).toBe(true);
      }
      return project;
    };
    const [project] = await Promise.all([
      createSource(),
      b.projects.create(folderProjectInput({ name: "Local project" }, localFolder)),
    ]);
    phase("both local projects created; sign in A");
    await signIn(a, peer.origin);
    await a.account.syncProject(project.id);
    await waitForCloud(async () => (await a.account.projectSyncStatus(project.id)).offlineReady);
    phase("A offline-ready; sign in B");
    await signIn(b, peer.origin);
    await waitForCloud(async () => (await b.projects.query()).items.some((item) => item.id === project.id));
    await waitForCloud(async () => (await b.account.projectSyncStatus(project.id)).offlineReady);
    await waitForCloud(async () => {
      const response = await fetch(`${second!.baseUrl}/v1/workspaces?project_id=${project.id}`, {
        headers: runtimeAuthorization(second!.descriptor),
      });
      const workspaces = (await response.json()) as Array<{
        is_default: boolean;
        device?: unknown;
        root_path: string | null;
      }>;
      return workspaces.some((row) => row.is_default && row.device && row.root_path);
    });
    phase("B downloaded; browser sign-in");
    expect((await b.projects.folder(project.id)).path).toBeNull();
    const page = await browser!.newPage();
    await page.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.removeItem("dashboard-wb2:selected-project:global");
    });
    page.on("pageerror", (error) => console.error(`Cloud ${kind} page error:`, error.message));
    await run({ a, b, project, page, sourceFolder, second: second!, phase });
  } finally {
    const cleanup = await Promise.allSettled([
      browser?.close(),
      first && stopProcess(first.child),
      second && stopProcess(second.child),
      peer?.stop(),
    ]);
    await rm(root, { recursive: true, force: true });
    const errors = cleanup.filter((result) => result.status === "rejected").map((result) => result.reason);
    expect(errors, "Cloud test cleanup failed").toEqual([]);
  }
};
