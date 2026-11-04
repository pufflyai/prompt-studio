import type { ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTextEditingClient, type StorageRecord } from "@pstdio/sdk/extensions";
import { createSyncSpace, openState, openSummary, sealState } from "pstdio-sync/encryption";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test as base, expect } from "../scripts/playwright-test";
import {
  acceptanceOwner,
  type CloudAcceptanceDevice,
  createCloudAcceptanceFixture,
  signInCloudAcceptanceDevice,
} from "./packaged-cloud-acceptance.fixture";
import { buildBinary } from "./packaged-helpers";
import { stopProcess } from "./packaged-serve-helpers";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

interface Resources {
  root: string;
  children: Set<ChildProcess>;
  fixture?: Awaited<ReturnType<typeof createCloudAcceptanceFixture>>;
  projectId?: string;
  closeEditors: (() => Promise<void>)[];
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright inspects fixture dependency patterns.
  resources: async ({}, use, testInfo) => {
    const resources: Resources = {
      root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-cloud-acceptance-"))),
      children: new Set(),
      closeEditors: [],
    };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      failures.push(error);
    }
    if (resources.fixture) {
      try {
        await testInfo.attach("cloud-acceptance-diagnostics", {
          body: JSON.stringify(await resources.fixture.diagnostics(resources.projectId), null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        failures.push(error);
      }
    }
    // Preserve the scenario failure as well as failures from every cleanup owner.
    for (const close of resources.closeEditors) await close().catch((error) => failures.push(error));
    await stopPendingTestProcesses().catch((error) => failures.push(error));
    const cleanup = await Promise.allSettled([
      ...[...resources.children].map(stopProcess),
      resources.fixture?.peer.close(),
    ]);
    for (const result of cleanup) if (result.status === "rejected") failures.push(result.reason);
    try {
      rmSync(resources.root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, "Cloud acceptance scenario or cleanup failed");
  },
});
test.beforeAll(() => {
  buildBinary();
});

const synced = (device: CloudAcceptanceDevice, projectId: string) =>
  expect
    .poll(async () => (await device.client.account.projectSyncStatus(projectId)).state, {
      message: `${device.name}: waiting for Cloud sync`,
    })
    .toBe("synced");
const read = <T>(device: CloudAcceptanceDevice, projectId: string) =>
  device.command<T>(projectId, acceptanceOwner, "read-acceptance");
const setup = async (resources: Resources) => {
  const fixture = await createCloudAcceptanceFixture(resources.root, resources.children);
  resources.fixture = fixture;
  const starting = await Promise.allSettled(["first", "second", "third"].map(fixture.start));
  const failedStarts = starting.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (failedStarts.length) throw new AggregateError(failedStarts, "Could not start all three acceptance devices");
  const devices = starting.map((result) => (result as PromiseFulfilledResult<CloudAcceptanceDevice>).value);
  const [first, second, third] = devices as [CloudAcceptanceDevice, CloudAcceptanceDevice, CloudAcceptanceDevice];
  expect(new Set(devices.map((device) => device.home)).size).toBe(3);
  expect(new Set(devices.map((device) => device.host.child.pid)).size).toBe(3);
  expect(new Set(devices.map((device) => device.environmentId)).size).toBe(3);
  const project = await first.client.projects.create(
    folderProjectInput({ name: "phase-one-secret-project" }, first.folder),
  );
  resources.projectId = project.id;
  await first.command(project.id, acceptanceOwner, "seed-acceptance");
  await signInCloudAcceptanceDevice(first, fixture.peer.origin);
  await first.client.account.syncProject(project.id);
  await synced(first, project.id);
  for (const device of [second, third]) {
    await signInCloudAcceptanceDevice(device, fixture.peer.origin);
    await expect
      .poll(async () => (await device.client.projects.query()).items.map((row) => row.id))
      .toContain(project.id);
    await device.client.projects.chooseFolder(project.id, { path: device.folder, clone: false });
    await synced(device, project.id);
  }
  expect((await first.client.account.devices()).map((device) => device.id).sort()).toEqual(
    devices.map((device) => device.environmentId).sort(),
  );
  return { fixture, first, second, third, devices, projectId: project.id };
};
const openNote = async (resources: Resources, device: CloudAcceptanceDevice, projectId: string, noteId: string) => {
  const connection = await device.client.textEditing.connect({
    projectId,
    scope: {
      kind: "agent",
      target: { fileRendererId: "pstdio.pstdio-notes.view.note-editor", resource: { type: "note", id: noteId } },
    },
  });
  const guest = connection.guest();
  resources.closeEditors.push(() => guest.close());
  const editing = createTextEditingClient(guest.host);
  const grant = await editing.current();
  expect(grant).toBeDefined();
  const session = await editing.open({ grant: grant! });
  resources.closeEditors.unshift(() => session.close());
  const bodyStart = session.getSnapshot().text.length;
  return {
    text: () => session.getSnapshot().text.toString(),
    async insert(value: string, prepend = false) {
      session.transact((text) => text.insert(prepend ? bodyStart : text.length, value));
      await session.flush();
      await session.project();
    },
  };
};
const assertBlind = async (fixture: Awaited<ReturnType<typeof createCloudAcceptanceFixture>>, markers: string[]) => {
  const contents = await fixture.peer.inspect();
  const bytes = contents.documents.flatMap(([, document]) => [
    ...(document.payload ? [Buffer.from(document.payload, "base64")] : []),
    ...document.updates.map((update) => Buffer.from(update.payload, "base64")),
  ]);
  bytes.push(
    ...contents.retainedStates.map((state) => Buffer.from(state.payload, "base64")),
    ...contents.blobs.map((blob) => Buffer.from(blob, "base64")),
  );
  expect(bytes.length).toBeGreaterThan(0);
  for (const marker of markers) {
    expect(JSON.stringify(contents)).not.toContain(marker);
    for (const payload of bytes) expect(payload.toString("latin1")).not.toContain(marker);
  }
};

// Preparation scenario: a controlled account is not evidence of real Google or deployed service acceptance.
test("three independent packaged devices keep extension content, offline collaboration, atomic saves and local re-enable edits", async ({
  resources,
}) => {
  const { fixture, first, second, third, devices, projectId } = await setup(resources);
  const note = await first.command<{ id: string }>(projectId, "pstdio.pstdio-notes", "notes.create", {
    title: "phase-one-secret-note",
  });
  const html = "<title>phase-one-secret-artifact</title><p>phase-one-secret-file-bytes</p>";
  writeFileSync(join(first.folder, "phase-one-secret-file.html"), html);
  const artifact = await first.command<{ url: string }>(projectId, "pstdio.pstdio-artifacts", "publish", {
    file_path: "phase-one-secret-file.html",
  });
  const ticket = await first.command<{ id: string }>(projectId, "pstdio.pstdio-planner", "create-ticket", {
    content: "# phase-one-secret-ticket\n\nBefore",
  });
  for (const device of devices) await synced(device, projectId);
  const editors = [];
  for (const device of devices) editors.push(await openNote(resources, device, projectId, note.id));
  const initial = editors[0]!.text();
  await editors[0]!.insert("first\nlast");
  for (const editor of editors) await expect.poll(editor.text).toBe(`${initial}first\nlast`);

  await fixture.peer.stop();
  for (const device of devices)
    await expect.poll(async () => (await device.client.account.projectSyncStatus(projectId)).state).toBe("offline");
  await editors[0]!.insert("offline left: ", true);
  await editors[1]!.insert(": offline right");
  await first.command(projectId, acceptanceOwner, "edit-acceptance", { side: "left" });
  await second.command(projectId, acceptanceOwner, "edit-acceptance", { side: "right" });
  const migrations = await Promise.all(
    [first, second].map((device) => device.command(projectId, acceptanceOwner, "migrate-acceptance")),
  );
  expect(migrations[0]).toEqual(migrations[1]);
  await Promise.all([first, second].map((device) => device.command(projectId, acceptanceOwner, "move-acceptance")));
  const allocations = await Promise.all(
    [first, second].map((device) =>
      device.command<{ id: string; shorthand: string }>(projectId, acceptanceOwner, "allocate"),
    ),
  );
  expect(allocations[0]!.id).not.toBe(allocations[1]!.id);
  expect(allocations[0]!.shorthand).toBe(allocations[1]!.shorthand);
  await third.command(projectId, "pstdio.pstdio-planner", "update-ticket", {
    id: ticket.id,
    content: "# phase-one-secret-ticket\n\nEdited offline by third",
  });
  // Files and the record referring to their staged asset must survive the offline grace interval.
  const asset = await first.command(projectId, acceptanceOwner, "stage", {
    operationId: "offline-asset",
    content: "phase-one-secret-asset-bytes",
  });
  await first.command(projectId, acceptanceOwner, "commit", {
    group: {
      operationId: "offline-asset-reference",
      edits: [{ recordId: "offline-asset", replace: "phase-one-secret-asset-name", asset }],
    },
  });
  await fixture.peer.restart();
  for (const device of devices) await synced(device, projectId);
  for (const editor of editors)
    await expect.poll(editor.text).toBe(`${initial}offline left: first\nlast: offline right`);
  for (const device of devices) {
    await expect
      .poll(() => device.command(projectId, "pstdio.pstdio-artifacts", "read", { url: artifact.url }))
      .toMatchObject({ html });
    await expect
      .poll(() => device.command(projectId, "pstdio.pstdio-planner", "get-ticket", { id: ticket.id }))
      .toMatchObject({ content: "# phase-one-secret-ticket\n\nEdited offline by third" });
    await expect
      .poll(() => read(device, projectId))
      .toMatchObject({
        shape: {
          value: {
            title: "Left title",
            status: "right",
            nested: { left: 2, right: 2 },
            body: "FIRST\nLAST",
            items: [
              { id: "a", title: "Edited A" },
              { id: "b", title: "Edited B" },
            ],
          },
        },
      });
    const rows = await read<{ cards: StorageRecord[]; migrated: StorageRecord[] }>(device, projectId);
    expect(rows.migrated).toHaveLength(2);
    expect(rows.cards.map((row) => row.recordId).sort()).toEqual(["card-a", "card-b", "card-c"]);
    expect(new Set(rows.cards.map((row) => (row.value as { position: string }).position)).size).toBe(3);
    await expect.poll(() => read(device, projectId)).toEqual(await read(first, projectId));
    const identities = await Promise.all(
      allocations.map(({ id }) =>
        device.command<{ shorthand: string }>(projectId, acceptanceOwner, "identity", { id }),
      ),
    );
    expect(new Set(identities.map((identity) => identity.shorthand)).size).toBe(2);
    const aliases = await device.command<{ id: string }[]>(projectId, acceptanceOwner, "find-number", {
      shorthand: allocations[0]!.shorthand,
    });
    expect(aliases.map((row) => row.id).sort()).toEqual(allocations.map((row) => row.id).sort());
    expect(await device.command(projectId, acceptanceOwner, "read-acceptance-asset")).toBe(
      "phase-one-secret-asset-bytes",
    );
  }
  // Observe both receivers throughout a grouped save, using one public owner snapshot per observation.
  let observing = true;
  const observe = async (device: CloudAcceptanceDevice) => {
    const seen: unknown[][] = [];
    while (observing) {
      const { atomic } = await read<{ atomic: number[] }>(device, projectId);
      expect(atomic).toHaveLength(2);
      expect(atomic[0]).toBe(atomic[1]);
      seen.push(atomic);
    }
    return seen;
  };
  const observationFailures: unknown[] = [];
  const observations: unknown[][][] = [];
  const observers = [second, third].map((device) =>
    observe(device).then(
      (seen) => {
        observations.push(seen);
      },
      (error) => {
        observationFailures.push(error);
      },
    ),
  );
  try {
    await first.command(projectId, acceptanceOwner, "atomic-acceptance", { version: 1 });
    for (const device of devices)
      await expect.poll(async () => (await read<{ atomic: number[] }>(device, projectId)).atomic).toEqual([1, 1]);
  } catch (error) {
    observationFailures.push(error);
  } finally {
    observing = false;
    await Promise.all(observers);
  }
  if (observationFailures.length) throw new AggregateError(observationFailures, "Atomic save or observation failed");
  for (const snapshots of observations) expect(snapshots.length).toBeGreaterThan(0);
  await first.client.account.stopProjectSync(projectId);
  for (const device of [second, third])
    await device.client.projects.update(projectId, { name: "phase-one-secret-project-local" });
  for (const device of devices)
    await expect.poll(async () => (await device.client.account.projectSyncStatus(projectId)).state).toBe("local");
  await editors[0]!.insert("local first: ", true);
  await editors[1]!.insert(": local second");
  await first.client.account.syncProject(projectId);
  for (const device of [second, third])
    await device.client.projects.update(projectId, { name: "phase-one-secret-project" });
  for (const device of devices) await synced(device, projectId);
  for (const editor of editors)
    await expect
      .poll(editor.text)
      .toBe(`${initial}local first: offline left: first\nlast: offline right: local second`);
  for (const device of devices)
    await expect
      .poll(() =>
        readFileSync(
          join(device.folder, ".pstdio/extension-storage/pstdio.pstdio-notes/documents", note.id, "content.md"),
          "utf8",
        ),
      )
      .toBe(`${initial}local first: offline left: first\nlast: offline right: local second`);
  await assertBlind(fixture, [
    "phase-one-secret-project",
    "phase-one-secret-note",
    "phase-one-secret-artifact",
    "phase-one-secret-file.html",
    "phase-one-secret-file-bytes",
    "phase-one-secret-ticket",
    "phase-one-secret-asset-name",
    "phase-one-secret-asset-bytes",
  ]);
});

test("a packaged device catches up after eight trimmed replacements and a reset device receives repaired missing edits", async ({
  resources,
}) => {
  const { fixture, first, second, third, devices, projectId } = await setup(resources);
  const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [packagedProjectKey] });
  const documentId = await space.documentId(JSON.stringify([acceptanceOwner, "record-stream"]));
  const old = await fixture.peer.captureSnapshot(documentId);
  await fixture.peer.blockDevice(third.environmentId, true);
  await third.command(projectId, acceptanceOwner, "commit", {
    group: { operationId: "third-offline", edits: [{ recordId: "offline-kept", replace: "phase-one-secret-offline" }] },
  });
  let priorState = old.state.stateId;
  for (let index = 0; index < 8; index++) {
    // Preserve the existing packaged compaction workload: eight records of 200,000 bytes, under 256 KiB each.
    await first.command(projectId, acceptanceOwner, "commit", {
      group: {
        operationId: `replacement-${index}`,
        edits: Array.from({ length: 8 }, (_, record) => ({
          recordId: `large-${record}`,
          replace: `phase-one-secret-${index}${"x".repeat(200_000)}`,
        })),
      },
    });
    await expect.poll(async () => (await fixture.peer.captureSnapshot(documentId)).state.stateId).not.toBe(priorState);
    priorState = (await fixture.peer.captureSnapshot(documentId)).state.stateId;
    await fixture.peer.trim(documentId);
  }
  await fixture.peer.blockDevice(third.environmentId, false);
  await third.client.account.retryProjectSync(projectId);
  for (const device of devices) await synced(device, projectId);
  const offlineValue = async (device: CloudAcceptanceDevice) =>
    device.command<StorageRecord[]>(projectId, acceptanceOwner, "read-acceptance-records", {
      ids: ["offline-kept", "large-7"],
    });
  for (const device of devices)
    await expect
      .poll(() => offlineValue(device))
      .toMatchObject([{ value: "phase-one-secret-offline" }, { value: `phase-one-secret-7${"x".repeat(200_000)}` }]);
  // Install an authenticated, incomplete earlier state. Copying old ciphertext under new headers is invalid.
  const current = await fixture.peer.captureSnapshot(documentId);
  const contents = await fixture.peer.inspect();
  const tail = new Map(contents.documents).get(`~${documentId}`)!;
  const through = Math.max(current.state.through, ...tail.updates.map((update) => update.sequence));
  await fixture.peer.installSnapshot(
    documentId,
    await sealState(space, documentId, {
      baseStateId: current.state.stateId,
      through,
      state: await openState(space, documentId, old.state, Buffer.from(old.payload, "base64")),
      summary: await openSummary(space, documentId, old.state),
      blobIds: old.blobIds,
    }),
  );
  // No new local save: existing devices must proactively republish the missing history.
  for (const device of devices) await synced(device, projectId);
  await stopProcess(third.host.child);
  resources.children.delete(third.host.child);
  rmSync(third.home, { recursive: true, force: true });
  rmSync(third.folder, { recursive: true, force: true });
  const reset = await fixture.start("third");
  expect(reset.environmentId).not.toBe(third.environmentId);
  await signInCloudAcceptanceDevice(reset, fixture.peer.origin);
  await expect.poll(async () => (await reset.client.projects.query()).items.map((row) => row.id)).toEqual([projectId]);
  await reset.client.projects.chooseFolder(projectId, { path: reset.folder, clone: false });
  await synced(reset, projectId);
  await expect
    .poll(() => offlineValue(reset))
    .toMatchObject([{ value: "phase-one-secret-offline" }, { value: `phase-one-secret-7${"x".repeat(200_000)}` }]);
  expect(await read(reset, projectId)).toEqual(await read(second, projectId));
  await assertBlind(fixture, ["phase-one-secret-project", "phase-one-secret-offline"]);
});
