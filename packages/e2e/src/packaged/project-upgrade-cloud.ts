import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createClient, PstdioConnectionError } from "@pstdio/sdk/client";
import { signInDevice, writeCertificate } from "./packaged-folder-recovery.fixture";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { installUpgradePlanner, planner, seedUpgradeProject, upgradeApi } from "./project-upgrade-fixture";

export const checkCloudProjectUpgrade = async (
  home: string,
  evidence: string,
  baseline: string,
  candidate: string,
  limitMs: number,
) => {
  const certificate = writeCertificate(home);
  const peer = createPackagedSyncPeer({ key: Bun.file(certificate.key), cert: Bun.file(certificate.cert) });
  const running = new Set<Awaited<ReturnType<typeof startPackagedServe>>>();
  const start = async (name: string, binary: string, phase: string, signal?: AbortSignal) => {
    const directory = join(home, name);
    await mkdir(directory, { recursive: true });
    const host = await startPackagedServe(
      directory,
      {
        NODE_EXTRA_CA_CERTS: certificate.cert,
        PSTDIO_DB_PATH: join(directory, "pstdio.db"),
        PSTDIO_DEFAULT_EXTENSIONS: "",
        PSTDIO_LOG_PATH: join(evidence, `${name}-${phase}.jsonl`),
        GITHUB_TOKEN: "",
        GH_TOKEN: "",
      },
      binary,
      undefined,
      undefined,
      signal,
    );
    running.add(host);
    return { home: directory, host, client: createClient({ baseUrl: host.baseUrl, token: host.descriptor.token }) };
  };
  const stop = async (device: Awaited<ReturnType<typeof start>>) => {
    await stopProcess(device.host.child);
    running.delete(device.host);
  };
  const stopAll = async () => {
    try {
      const stopped = await Promise.allSettled([...running].map((host) => stopProcess(host.child)));
      return stopped.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    } finally {
      peer.stop();
    }
  };
  try {
    let a = await start("a", baseline, "baseline");
    const seed = await seedUpgradeProject(upgradeApi(a.host.descriptor), { home: a.home, evidence, profile: "active" });
    const commands = (device: typeof a) => planner(upgradeApi(device.host.descriptor), seed.id);
    const content = async (device: typeof a, ticket = seed.firstTicket) =>
      (await (await commands(device)).execute<{ content: string }>("get-ticket", { id: ticket })).content;
    const write = async (device: typeof a, value: string, ticket = seed.firstTicket) =>
      (await commands(device)).execute("update-ticket", { id: ticket, content: value });
    const seen = (device: typeof a, value: string, ticket = seed.firstTicket) =>
      expect(async () => assert.equal(await content(device, ticket), value)).toPass({ timeout: PACKAGED_TEST_TIMEOUT });
    const deviceId = await signInDevice(a, peer.origin);
    await a.client.account.syncProject(seed.id);
    await expect
      .poll(async () => (await a.client.account.projectSyncStatus(seed.id)).offlineReady, {
        timeout: PACKAGED_TEST_TIMEOUT,
      })
      .toBe(true);
    // Released hosts provision their default tools on first launch. Finish the first
    // device's project setup before the second cold install competes for the runner.
    let b = await start("b", baseline, "baseline");
    await signInDevice(b, peer.origin);
    await expect
      .poll(async () => (await b.client.projects.query()).items.some((p) => p.id === seed.id), {
        timeout: PACKAGED_TEST_TIMEOUT,
      })
      .toBe(true);
    await expect
      .poll(async () => (await b.client.account.projectSyncStatus(seed.id)).offlineReady, {
        timeout: PACKAGED_TEST_TIMEOUT,
      })
      .toBe(true);
    try {
      await b.client.projects.open(seed.id);
    } catch (error) {
      // Released hosts can close the idle HTTP socket while the synced folder is still
      // provisioning. Reopening the same project resumes that idempotent operation.
      if (!(error instanceof PstdioConnectionError) || (error.cause as NodeJS.ErrnoException)?.code !== "ECONNRESET")
        throw error;
      await b.client.projects.open(seed.id);
    }
    await installUpgradePlanner(upgradeApi(b.host.descriptor), seed.id);
    await seen(b, await content(a));
    console.log("[Cloud upgrade] Second released device read the saved ticket");

    const pending = "Saved on the released device while offline";
    const offlineEdit = "Saved after upgrading offline";
    const onlineEdit = "Saved after upgrading online";
    peer.blockDevice(deviceId, true);
    await write(a, pending);
    assert.equal(await content(a), pending);
    await stop(a);
    const timedEdit = async (name: string, phase: string, value: string) => {
      const started = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error(`Cloud upgrade exceeded the ${limitMs} ms limit`)),
        limitMs,
      );
      let completed = false;
      try {
        const device = await start(name, candidate, phase, controller.signal);
        await device.client.projects.open(seed.id);
        assert.equal(await content(device), pending);
        await write(device, value, seed.secondTicket);
        assert.equal(await content(device, seed.secondTicket), value);
        completed = true;
        return device;
      } finally {
        clearTimeout(timeout);
        const elapsedMs = performance.now() - started;
        await Bun.write(
          join(evidence, `${phase}-to-usable-project.json`),
          JSON.stringify({ completed, elapsedMs, limitMs }),
        );
        assert(elapsedMs <= limitMs, `${phase} Cloud upgrade and saved edit took ${Math.round(elapsedMs)} ms`);
      }
    };
    a = await timedEdit("a", "offline", offlineEdit);
    peer.blockDevice(deviceId, false);
    await seen(b, pending);
    await seen(b, offlineEdit, seed.secondTicket);
    await stop(b);
    b = await timedEdit("b", "online", onlineEdit);
    await seen(a, onlineEdit, seed.secondTicket);
    console.log("[Cloud upgrade] Both upgraded devices read the same saved ticket");
  } catch (error) {
    // A device stopped by the limit's abort can refuse the shutdown request. Report the check's own failure.
    await stopAll();
    throw error;
  }
  const cleanup = await stopAll();
  if (cleanup.length) throw new AggregateError(cleanup, "Cloud upgrade cleanup failed");
};
