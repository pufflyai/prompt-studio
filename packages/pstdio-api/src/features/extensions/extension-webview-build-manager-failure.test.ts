import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extensionLoadKey } from "pstdio-extensions";
import { loadExtensionSource } from "./extension-runtime";
import { setup } from "./test-utils/webview-failure-fixture";

test("reports a current failed build after only the source registration hash changes", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    expect(fixture.module()).toContain("original bundle");
    writeFileSync(fixture.entry, "export const broken = ;");
    const firstRefresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.failed.promise;
    await fixture.sources.updateLoadState(fixture.id, { source_hash: "hash-2" });
    const loaded = fixture.nextLoad();
    const joined = fixture.manager.refresh(fixture.sourcePath);
    await loaded;
    fixture.release.resolve();
    await Promise.all([firstRefresh, joined]);
    await fixture.manager.ensure(fixture.id, "pstdio.lab.view.page");
    expect(await fixture.error()).not.toBeNull();
    expect(fixture.failures.at(-1)).toMatchObject({ sourcePath: fixture.sourcePath, sourceHash: "hash-2" });
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("discards a failed build whose source inputs were repaired before it finished", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.failed.promise;
    writeFileSync(fixture.entry, 'console.log("repaired bundle");');
    fixture.release.resolve();
    await refresh;
    expect(fixture.failures).toEqual([]);
    await fixture.manager.refresh(fixture.sourcePath);
    expect(fixture.module()).toContain("repaired bundle");
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});

test("reconciles a registration change during the conditional failure report without rebuilding", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.pauseReporting();
    fixture.release.resolve();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.reporting.promise;
    await fixture.sources.updateLoadState(fixture.id, { source_hash: "hash-3" });
    const loaded = fixture.nextLoad();
    const joined = fixture.manager.refresh(fixture.sourcePath);
    await loaded;
    fixture.releaseReport.resolve();
    await Promise.all([refresh, joined]);
    expect(await fixture.sources.get(fixture.id)).toMatchObject({ status: "error", source_hash: "hash-3" });
    expect(await fixture.error()).not.toBeNull();
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("discards a failed view removed by a newer adopted definition", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.failed.promise;
    await fixture.adopt(null, "hash-2");
    await fixture.manager.refresh(fixture.sourcePath);
    fixture.release.resolve();
    await refresh;
    expect(await fixture.error()).toBeNull();
    expect((await fixture.sources.get(fixture.id))?.status).not.toBe("error");
  } finally {
    await fixture.dispose();
  }
});

test("discards a failed entry when the adopted view returns to its valid entry", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(join(fixture.sourcePath, "other.ts"), "export const broken = ;");
    await fixture.adopt("./other.ts", "hash-2");
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.failed.promise;
    await fixture.adopt("./main.ts", "hash-3");
    await fixture.manager.refresh(fixture.sourcePath);
    fixture.release.resolve();
    await refresh;
    expect(fixture.failures).toEqual([]);
    expect(fixture.module()).toContain("original bundle");
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});

test("joins the same view until its failure report finishes even when its hash is unchanged", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.pauseReporting();
    fixture.release.resolve();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.reporting.promise;
    await fixture.sources.updateRegistration(fixture.id, { status: "pending", last_error_json: null });
    const validated = {
      loadKey: extensionLoadKey(fixture.sourcePath),
      loaded: await loadExtensionSource(fixture.sourcePath),
    };
    let completed = false;
    const joined = fixture.manager.adopt(fixture.sourcePath, validated).then(() => {
      completed = true;
    });
    await Bun.sleep(0);
    const finishedBeforeReport = completed;
    const earlyError = completed ? await fixture.error() : null;
    fixture.releaseReport.resolve();
    await Promise.all([refresh, joined]);
    expect(finishedBeforeReport && earlyError === null).toBe(false);
    expect(await fixture.error()).not.toBeNull();
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("keeps an unwritten failure incomplete and reports its finished result without rebuilding", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.release.resolve();
    fixture.setReportingUnavailable(true);
    await fixture.manager.refresh(fixture.sourcePath);
    await expect(fixture.manager.adopt(fixture.sourcePath)).rejects.toThrow("Could not record");
    await expect(fixture.manager.ensure(fixture.id, "pstdio.lab.view.page")).rejects.toThrow();
    expect(await fixture.error()).toBeNull();
    fixture.setReportingUnavailable(false);
    await fixture.manager.ensure(fixture.id, "pstdio.lab.view.page");
    expect(await fixture.error()).not.toBeNull();
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("discards a successful build for a view removed by source adoption", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    const originalRevision = (await fixture.sources.get(fixture.id))?.loaded_revision;
    writeFileSync(fixture.entry, 'console.log("obsolete bundle");');
    fixture.pauseSuccess();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.succeeded.promise;
    await fixture.adopt(null, "hash-2");
    await fixture.manager.adopt(fixture.sourcePath);
    fixture.releaseSuccess.resolve();
    await refresh;
    expect(fixture.module()).toContain("original bundle");
    expect((await fixture.sources.get(fixture.id))?.loaded_revision).toBe(originalRevision);
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("reconciles a same-hash registration without a validated source before returning", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.pauseReporting();
    fixture.release.resolve();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.reporting.promise;
    await fixture.sources.updateRegistration(fixture.id, { status: "pending", last_error_json: null });
    await fixture.manager.adopt(fixture.sourcePath);
    const errorAfterRegistration = await fixture.error();
    fixture.releaseReport.resolve();
    await refresh;
    expect(errorAfterRegistration).not.toBeNull();
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("uses the current adopted view graph when an older validated source arrives late", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    const olderSource = {
      loadKey: extensionLoadKey(fixture.sourcePath),
      loaded: await loadExtensionSource(fixture.sourcePath),
    };
    writeFileSync(join(fixture.sourcePath, "other.ts"), 'console.log("current adopted bundle");');
    await fixture.adopt("./other.ts", "hash-2");
    fixture.pauseSuccess();
    const current = fixture.manager.adopt(fixture.sourcePath);
    await fixture.succeeded.promise;
    const older = fixture.manager.adopt(fixture.sourcePath, olderSource);
    await Bun.sleep(0);
    fixture.releaseSuccess.resolve();
    await Promise.all([current, older]);
    expect(fixture.module()).toContain("current adopted bundle");
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("discards a successful result when registration removed its view before adoption runs", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    const revision = (await fixture.sources.get(fixture.id))?.loaded_revision;
    writeFileSync(fixture.entry, 'console.log("removed view bundle");');
    fixture.pauseSuccess();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.succeeded.promise;
    await fixture.adopt(null, "hash-2");
    fixture.releaseSuccess.resolve();
    await refresh;
    expect(fixture.module()).toContain("original bundle");
    expect((await fixture.sources.get(fixture.id))?.loaded_revision).toBe(revision);
  } finally {
    await fixture.dispose();
  }
});

test("reconciles a successful repair after a sibling update wins its conditional status write", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.release.resolve();
    await fixture.manager.refresh(fixture.sourcePath);
    expect(await fixture.error()).not.toBeNull();
    const revision = (await fixture.sources.get(fixture.id))?.loaded_revision;
    writeFileSync(fixture.entry, 'console.log("repaired bundle");');
    fixture.pauseSuccessReport();
    const repair = fixture.manager.refresh(fixture.sourcePath);
    await fixture.successReporting.promise;
    await fixture.sources.updateLoadState(fixture.id, { last_loaded_at: new Date().toISOString() });
    fixture.releaseSuccessReport.resolve();
    await repair;
    expect(await fixture.error()).toBeNull();
    expect((await fixture.sources.get(fixture.id))?.loaded_revision).not.toBe(revision);
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});

test("retains a successful repair until its status can be recorded without rebuilding", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.release.resolve();
    await fixture.manager.refresh(fixture.sourcePath);
    writeFileSync(fixture.entry, 'console.log("repaired bundle");');
    fixture.setReportingUnavailable(true);
    await fixture.manager.refresh(fixture.sourcePath);
    await expect(fixture.manager.ensure(fixture.id)).rejects.toThrow();
    fixture.setReportingUnavailable(false);
    await fixture.manager.ensure(fixture.id);
    expect(await fixture.error()).toBeNull();
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});

test("recovers after source inspection throws without retaining rejected build work", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    const updated = 'console.log("restored bundle");';
    writeFileSync(fixture.entry, updated);
    fixture.pauseSuccess();
    const refresh = fixture.manager.refresh(fixture.sourcePath);
    await fixture.succeeded.promise;
    rmSync(fixture.entry);
    fixture.releaseSuccess.resolve();
    await refresh;
    writeFileSync(fixture.entry, updated);
    await expect(fixture.manager.adopt(fixture.sourcePath)).resolves.toBeUndefined();
    expect(fixture.module()).toContain("restored bundle");
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});
