import { afterAll, beforeAll, expect, test } from "bun:test";
import { createSyncSpace, sealBlob, sealState, sealUpdate } from "pstdio-sync/encryption";
import { body, createSyncFixture, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const secrets = {
  title: "Aurora launch checklist",
  record: "Move the pelican mascot to the Friday keynote",
  fileName: "aurora-roadmap-final.png",
  extension: "pstdio-planner",
};
const fileBytes = new TextEncoder().encode(`\x89PNG plaintext marker ${crypto.randomUUID()} ${"pixels".repeat(64)}`);

test("a dump of relay storage contains no plaintext from a seeded project", async () => {
  const { sync } = fixture.open();
  const device = { accountId: randomId("account"), deviceId: randomId("device") };
  const projectKey = randomId("project");
  // The client encryption every device uses, with a project key like the account manager hands out.
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const space = await createSyncSpace({ projectId: projectKey, spaceOwner: null, keys: [{ generation: 1, secret }] });
  const documentId = await space.documentId(JSON.stringify([secrets.extension, "records"]));
  const address = { projectKey, spaceOwner: null, documentId };
  const sealedFile = await sealBlob(space, fileBytes);
  const blob = { projectKey, spaceOwner: null, blobId: sealedFile.blobId };
  const file = { sha256: sha256(sealedFile.bytes), byteLength: sealedFile.bytes.length };
  await sync.blobs.begin(blob, device, file);
  await sync.blobs.writePart(blob, 1, { ...file, body: body(sealedFile.bytes) });
  await sync.blobs.finish(blob);
  const record = { extension: secrets.extension, title: secrets.title, body: secrets.record, file: secrets.fileName };
  await sync.documents.appendUpdate(address, device, await sealUpdate(space, documentId, text(record), [blob.blobId]));
  const edited = text({ ...record, title: `${secrets.title} (edited)` });
  await sync.documents.appendUpdate(address, device, await sealUpdate(space, documentId, edited, []));
  const state = await sealState(space, documentId, {
    baseStateId: null,
    through: 1,
    state: text([record]),
    summary: text({ [secrets.extension]: 1 }),
    blobIds: [blob.blobId],
  });
  await sync.documents.replaceState(address, device, state);

  const rows = (await fixture.rows()).join("\n");
  const objects = Buffer.concat([...(await fixture.objects()).values()]);
  expect(rows).toContain(projectKey);
  expect(objects.byteLength).toBeGreaterThan(sealedFile.bytes.length);
  for (const secret of Object.values(secrets)) {
    expect(rows).not.toContain(secret);
    expect(rows).not.toContain(Buffer.from(secret).toString("base64"));
    expect(objects.indexOf(Buffer.from(secret))).toBe(-1);
  }
  expect(objects.indexOf(Buffer.from(fileBytes.subarray(0, 48)))).toBe(-1);
  expect(rows).not.toContain("image/png");
});
