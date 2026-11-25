import { expect, test } from "bun:test";
import { createDownloadSourcesFixture, until } from "./project-download-sources.fixture";

for (const [stored, failedFolder] of [
  [true, false],
  [true, true],
  [false, false],
  [false, true],
])
  test(`Download repairs failed owners while healthy first passes finish (stored: ${stored}, failed folder: ${failedFolder})`, async () => {
    const fixture = await createDownloadSourcesFixture({ stored, failedFolder });
    const { host, traffic, core, activity, folder, download, canDownload } = fixture;
    try {
      await host.deps.accountService.refresh();
      expect(await until(() => traffic.core.holding)).toBe(true);
      expect(await until(async () => Boolean((await activity.status()).error))).toBe(true);
      if (failedFolder) expect(await until(async () => Boolean((await folder.status()).error))).toBe(true);
      else expect(await until(() => traffic.folder.holding)).toBe(true);
      expect(await core.status()).toMatchObject({
        firstDownloaded: false,
        downloaded: false,
        busy: true,
        error: undefined,
      });
      expect(await activity.status()).toMatchObject({ error: "Cloud source failed; retry scheduled" });
      const failedReads = traffic.activity.reads;
      const previousFolderReads = traffic.folder.reads;
      traffic.activity.error = undefined;
      traffic.folder.error = undefined;
      expect((await download()).status).toBe(202);
      expect(await until(() => traffic.activity.holding)).toBe(true);
      expect(fixture.folderRetries).toBe(Number(failedFolder));
      if (failedFolder) expect(await until(() => traffic.folder.holding)).toBe(true);
      expect(traffic.folder.cancelled).toBe(0);
      expect(traffic.folder.reads).toBe(previousFolderReads + Number(failedFolder));
      expect(traffic.core.cancelled).toBe(0);
      expect(traffic.core.reads).toBe(1);
      expect(traffic.activity.reads).toBe(failedReads + 1);
      expect(await canDownload()).toBe(false);
      expect((await download()).status).toBe(202);
      expect(fixture.folderRetries).toBe(Number(failedFolder));
      expect({ core: traffic.core.reads, activity: traffic.activity.reads }).toEqual({
        core: 1,
        activity: failedReads + 1,
      });
      traffic.core.hold = false;
      traffic.core.finish.resolve();
      expect(
        await until(async () => {
          const status = await core.status();
          return status.firstDownloaded && status.downloaded && !status.busy;
        }),
      ).toBe(true);
      expect(await core.status()).toMatchObject({ downloaded: true, error: undefined });
      expect(traffic.core.cancelled).toBe(0);
      expect(await canDownload()).toBe(false);
      traffic.activity.hold = false;
      traffic.activity.finish.resolve();
      expect(await until(async () => (await activity.status()).downloaded)).toBe(true);
      if (failedFolder) expect(await canDownload()).toBe(false);
      traffic.folder.hold = false;
      traffic.folder.finish.resolve();
      expect(await until(async () => (await folder.status()).downloaded)).toBe(true);
      expect(traffic.folder.cancelled).toBe(0);
      expect(await until(canDownload)).toBe(true);
    } finally {
      await fixture.close();
    }
  });
