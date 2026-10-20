import { expect, test } from "bun:test";
import { type SpaceKey, syncIdSchema } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes } from "../encoding";
import {
  createSyncSpace,
  openBlob,
  openLive,
  openState,
  openSummary,
  openUpdate,
  sealBlob,
  sealLive,
  sealState,
  sealUpdate,
  UnreadableSyncData,
} from "./index";

const secret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const firstKey: SpaceKey = { generation: 1, secret: secret() };
const projectId = "workbench-encryption";
const projectSpace = (keys: SpaceKey[] = [firstKey]) => createSyncSpace({ projectId, spaceOwner: null, keys });

test("two devices with the same keys exchange encrypted Yjs updates", async () => {
  const [laptop, desktop] = await Promise.all([projectSpace(), projectSpace()]);
  const documentId = await laptop.documentId('["notes","records"]');
  expect(await desktop.documentId('["notes","records"]')).toBe(documentId);

  const written = new Y.Doc();
  written.getText("body").insert(0, "Move the pelican mascot to the Friday keynote");
  const envelope = await sealUpdate(laptop, documentId, Y.encodeStateAsUpdate(written), []);
  expect(atob(envelope.payload)).not.toContain("pelican");

  const read = new Y.Doc();
  Y.applyUpdate(read, await openUpdate(desktop, documentId, envelope));
  expect(read.getText("body").toString()).toBe("Move the pelican mascot to the Friday keynote");
});

test("document IDs are opaque, stable per name and different in every space", async () => {
  const project = await projectSpace();
  const personal = await createSyncSpace({
    projectId,
    spaceOwner: "account-1",
    keys: [{ generation: 1, secret: secret() }],
  });
  const records = await project.documentId('["pstdio-planner","records"]');
  expect(syncIdSchema.parse(records)).not.toContain("planner");
  expect(await project.documentId('["pstdio-planner","records"]')).toBe(records);
  expect(await project.documentId('["notes","records"]')).not.toBe(records);
  expect(await personal.documentId('["pstdio-planner","records"]')).not.toBe(records);
  // A rotation adds a key but must not move existing documents.
  const rotated = await projectSpace([firstKey, { generation: 2, secret: secret() }]);
  expect(await rotated.documentId('["pstdio-planner","records"]')).toBe(records);
});

test("a device without the newest key reads older data but not data written after a rotation", async () => {
  const removed = await projectSpace();
  const remaining = await projectSpace([firstKey, { generation: 2, secret: secret() }]);
  const documentId = await remaining.documentId('["notes","records"]');
  const before = await sealUpdate(removed, documentId, new Uint8Array([1, 2, 3]), []);
  const after = await sealUpdate(remaining, documentId, new Uint8Array([4, 5, 6]), []);
  expect(await openUpdate(remaining, documentId, before)).toEqual(new Uint8Array([1, 2, 3]));
  await expect(openUpdate(removed, documentId, after)).rejects.toBeInstanceOf(UnreadableSyncData);
});

test("sealed data opens only in the place it was written for", async () => {
  const project = await projectSpace();
  const [notes, planner] = await Promise.all([project.documentId("notes"), project.documentId("planner")]);
  const update = await sealUpdate(project, notes, new Uint8Array([9]), []);
  await expect(openUpdate(project, planner, update)).rejects.toBeInstanceOf(UnreadableSyncData);
  await expect(openUpdate(project, notes, { ...update, updateId: "a-different-update-id" })).rejects.toBeInstanceOf(
    UnreadableSyncData,
  );
  const other = await projectSpace([{ generation: 1, secret: secret() }]);
  await expect(openUpdate(other, notes, update)).rejects.toBeInstanceOf(UnreadableSyncData);
});

test("latest states, summaries, blobs and live messages round-trip encrypted", async () => {
  const project = await projectSpace();
  const documentId = await project.documentId("notes");
  const blob = await sealBlob(project, new TextEncoder().encode("aurora-roadmap-final.png bytes"));
  expect(syncIdSchema.parse(blob.blobId)).toBeString();
  expect(Buffer.from(blob.bytes).includes("aurora")).toBe(false);
  expect(new TextDecoder().decode(await openBlob(project, blob.blobId, blob.bytes))).toBe(
    "aurora-roadmap-final.png bytes",
  );

  const state = await sealState(project, documentId, {
    baseStateId: null,
    through: 4,
    state: new Uint8Array([1, 1, 2]),
    summary: new Uint8Array([3, 5]),
    blobIds: [blob.blobId],
  });
  expect(state).toMatchObject({ baseStateId: null, through: 4, blobIds: [blob.blobId] });
  expect(await openState(project, documentId, state, decodeBytes(state.payload))).toEqual(new Uint8Array([1, 1, 2]));
  expect(await openSummary(project, documentId, state)).toEqual(new Uint8Array([3, 5]));
  // A relay that claims the state covers more updates would make devices skip them.
  await expect(openSummary(project, documentId, { ...state, through: 9 })).rejects.toBeInstanceOf(UnreadableSyncData);
  await expect(
    openState(project, documentId, { ...state, baseStateId: "another-state-id" }, decodeBytes(state.payload)),
  ).rejects.toBeInstanceOf(UnreadableSyncData);
  await expect(openBlob(project, blob.blobId, decodeBytes(state.payload))).rejects.toBeInstanceOf(UnreadableSyncData);

  const live = await sealLive(project, "device-a", new TextEncoder().encode("cursor 12"));
  expect(live).toMatchObject({ type: "live", spaceOwner: null });
  expect(new TextDecoder().decode(await openLive(project, { deviceId: "device-a", payload: live.payload }))).toBe(
    "cursor 12",
  );
  await expect(openLive(project, { deviceId: "device-b", payload: live.payload })).rejects.toBeInstanceOf(
    UnreadableSyncData,
  );
});
