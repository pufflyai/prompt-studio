import { afterAll, beforeAll, expect, test } from "bun:test";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

// Stands in for client encryption (PS-821). The relay only ever receives these bytes.
const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const encrypt = async (plain: Uint8Array<ArrayBuffer>) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return new Uint8Array([...iv, ...sealed]);
};
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
  const address = { projectKey, spaceOwner: null, documentId: randomId("doc") };
  const blob = { projectKey, spaceOwner: null, blobId: randomId("blob") };
  const sealedFile = await encrypt(fileBytes);
  await sync.blobs.begin(blob, device, { sha256: sha256(sealedFile), byteLength: sealedFile.length });
  await sync.blobs.writePart(blob, 1, {
    sha256: sha256(sealedFile),
    byteLength: sealedFile.length,
    body: body(sealedFile),
  });
  await sync.blobs.finish(blob);
  const record = { extension: secrets.extension, title: secrets.title, body: secrets.record, file: secrets.fileName };
  await sync.documents.appendUpdate(address, device, {
    updateId: randomId("update"),
    payload: encode(await encrypt(text(record))),
    blobIds: [blob.blobId],
  });
  await sync.documents.appendUpdate(address, device, {
    updateId: randomId("update"),
    payload: encode(await encrypt(text({ ...record, title: `${secrets.title} (edited)` }))),
    blobIds: [],
  });
  await sync.documents.replaceState(address, device, {
    stateId: randomId("state"),
    baseStateId: null,
    through: 1,
    payload: encode(await encrypt(text([record]))),
    summary: encode(await encrypt(text({ [secrets.extension]: 1 }))),
    blobIds: [blob.blobId],
  });

  const rows = (await fixture.rows()).join("\n");
  const objects = Buffer.concat([...(await fixture.objects()).values()]);
  expect(rows).toContain(projectKey);
  expect(objects.byteLength).toBeGreaterThan(sealedFile.length);
  for (const secret of Object.values(secrets)) {
    expect(rows).not.toContain(secret);
    expect(rows).not.toContain(Buffer.from(secret).toString("base64"));
    expect(objects.indexOf(Buffer.from(secret))).toBe(-1);
  }
  expect(objects.indexOf(Buffer.from(fileBytes.subarray(0, 48)))).toBe(-1);
  expect(rows).not.toContain("image/png");
});
