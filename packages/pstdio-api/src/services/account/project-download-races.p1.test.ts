import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { recoveryJournalKey } from "../project-recovery/journal";
import { recoverySourceId } from "../project-recovery/local-source";
import { projectRecoveryRoot } from "../project-recovery/project-paths";
import { createDownloadSourcesFixture, until } from "./project-download-sources.fixture";

const unreadableJournal = async (fixture: Awaited<ReturnType<typeof createDownloadSourcesFixture>>) => {
  const { host, id, root, config } = fixture;
  const path = join(root, "project-folder");
  await mkdir(path);
  const workspace = await host.deps.workspaceService.ensureDefault({
    project_id: id,
    root_path: path,
    name: "Journal source",
  });
  await host.deps.workspaceService.updateProviderProjection(workspace.id, {
    execution_kind: "local",
    provider_state: "ready",
  });
  const directory = join(projectRecoveryRoot(host.deps.projectRecovery.root, id), "sources");
  await mkdir(directory, { recursive: true });
  const key = recoveryJournalKey([id, config.accountId, config.environmentId, recoverySourceId(workspace.id, path)]);
  await writeFile(join(directory, `${key}.json`), "Unreadable journal JSON");
  await expect(fixture.folder.status()).rejects.toBeInstanceOf(SyntaxError);
};

test("an unreadable native folder journal cannot prevent a failed Activity owner from retrying", async () => {
  const fixture = await createDownloadSourcesFixture();
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    await unreadableJournal(fixture);
    fixture.traffic.activity.error = undefined;
    const scheduled = await fixture.retry(fixture.id, { failedOnly: true });
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    expect(fixture.traffic.core.cancelled).toBe(0);
    fixture.traffic.activity.hold = false;
    fixture.traffic.activity.finish.resolve();
    await scheduled?.settled;
    expect(await fixture.activity.status()).toMatchObject({ downloaded: true, error: undefined });
    await expect(fixture.folder.status()).rejects.toBeInstanceOf(SyntaxError);
  } finally {
    await fixture.close();
  }
});

test("native Download admits a failed Activity retry while reporting an unreadable folder journal", async () => {
  const fixture = await createDownloadSourcesFixture();
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    await unreadableJournal(fixture);
    const status = await fetch(`${fixture.api.url.origin}/v1/account/projects/${fixture.id}/sync`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      state: "first-download-incomplete",
      folder: { capture: { state: "needs-attention", error: { code: "failed" } } },
    });
    fixture.traffic.activity.error = undefined;
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    expect(fixture.traffic.core.cancelled).toBe(0);
    expect(await fixture.canDownload()).toBe(false);
  } finally {
    await fixture.close();
  }
});

test("Download does not cancel an Activity pass that recovered while authority was being checked", async () => {
  let admitted = false;
  const release = Promise.withResolvers<void>();
  const fixture = await createDownloadSourcesFixture({
    afterStatus: async () => {
      admitted = true;
      await release.promise;
    },
  });
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => admitted)).toBe(true);
    fixture.traffic.activity.error = undefined;
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    const reads = fixture.traffic.activity.reads;
    release.resolve();
    expect(await until(() => fixture.selections === 1)).toBe(true);
    expect(fixture.traffic.activity.cancelled).toBe(0);
    expect(fixture.traffic.activity.reads).toBe(reads);
    expect(await fixture.canDownload()).toBe(false);
    expect((await fixture.download()).status).toBe(202);
    expect(fixture.selections).toBe(1);
    for (const source of Object.values(fixture.traffic)) {
      source.hold = false;
      source.finish.resolve();
    }
    expect(await until(async () => (await fixture.activity.status()).downloaded)).toBe(true);
    expect(await until(fixture.canDownload)).toBe(true);
    expect(fixture.traffic.activity.cancelled).toBe(0);
  } finally {
    release.resolve();
    await fixture.close();
  }
});

test("Download retains a reconnecting Activity pass even while its old failure is still visible", async () => {
  const fixture = await createDownloadSourcesFixture({ afterStatus: async () => {} });
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    fixture.traffic.activity.error = undefined;
    fixture.live.reconnect();
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    expect(await fixture.activity.status()).toMatchObject({
      busy: true,
      error: "Cloud source failed; retry scheduled",
    });
    const reads = fixture.traffic.activity.reads;
    const cancelled = fixture.traffic.activity.cancelled;
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => fixture.selections === 1)).toBe(true);
    expect(fixture.traffic.activity.cancelled).toBe(cancelled);
    expect(fixture.traffic.activity.reads).toBe(reads);
    expect(await fixture.canDownload()).toBe(false);
    for (const source of Object.values(fixture.traffic)) {
      source.hold = false;
      source.finish.resolve();
    }
    expect(await until(fixture.canDownload)).toBe(true);
    expect(await fixture.activity.status()).toMatchObject({ downloaded: true, error: undefined });
  } finally {
    await fixture.close();
  }
});
