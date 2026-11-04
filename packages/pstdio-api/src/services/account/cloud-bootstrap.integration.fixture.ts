import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "cloud-bootstrap-"));
process.env.PSTDIO_HOME = join(root, "home");
const { createTestApp } = await import("../../test-utils/create-test-app");
const envelope = JSON.parse(process.env.OWNER_TEST_CLOUD_ENVELOPE!);
const file = join(root, "bootstrap.json");
process.env.PSTDIO_CLOUD_BOOTSTRAP_FILE = file;
const create = () => createTestApp({ databasePath: join(root, "db"), storageRoot: root });
try {
  await writeFile(file, JSON.stringify(envelope), { mode: 0o600 });
  // The manager commits enrollment but its first response is lost. The private pending
  // credential must recover that exact identity on restart, without consuming again.
  let unexpected: Awaited<ReturnType<typeof create>> | undefined;
  try {
    await assert.rejects(async () => {
      unexpected = await create();
    });
  } finally {
    await unexpected?.close();
  }
  const recovered = await create();
  let token: string;
  try {
    await recovered.deps.accountService.refresh();
    assert.equal((await recovered.deps.environmentService.get()).environmentId, envelope.deviceId);
    assert.deepEqual((await recovered.deps.accountService.status()).login, {
      managerOrigin: envelope.managerOrigin,
      relayOrigin: envelope.relayOrigin,
      accountId: envelope.accountId,
      deviceId: envelope.deviceId,
    });
    const privateLogin = JSON.parse(await readFile(join(root, "native-account.json"), "utf8")).login;
    token = privateLogin.token;
    assert.equal((await stat(join(root, "native-account.json"))).mode & 0o777, 0o600);
    const nextDevice = crypto.randomUUID();
    const issued = await recovered.deps.accountService.issueCloudEnrollment({
      deviceId: nextDevice,
      name: "Next cloud device",
    });
    assert.equal(issued.deviceId, nextDevice);
    assert.equal(issued.accountId, envelope.accountId);
    assert.equal(issued.managerOrigin, envelope.managerOrigin);
    assert.notEqual(issued.grant, token);
    const identity = await recovered.deps.accountService.commandIdentity();
    assert.equal(identity.deviceId, envelope.deviceId);
    await assert.rejects(() => stat(file), { code: "ENOENT" });
  } finally {
    await recovered.close();
  }
  const restarted = await create();
  try {
    assert.equal((await restarted.deps.environmentService.get()).environmentId, envelope.deviceId);
    assert.equal(JSON.parse(await readFile(join(root, "native-account.json"), "utf8")).login.token, token!);
  } finally {
    await restarted.close();
  }
  await writeFile(file, JSON.stringify({ ...envelope, expiresAt: "2000-01-01T00:00:00.000Z" }), { mode: 0o600 });
  const staleEnvelope = await create();
  try {
    assert.equal(JSON.parse(await readFile(join(root, "native-account.json"), "utf8")).login.token, token!);
    await assert.rejects(() => stat(file), { code: "ENOENT" });
  } finally {
    await staleEnvelope.close();
  }
  await writeFile(file, JSON.stringify({ ...envelope, deviceId: crypto.randomUUID() }), { mode: 0o600 });
  await assert.rejects(create, /another device/);
  assert.equal(JSON.parse(await readFile(join(root, "native-account.json"), "utf8")).login.token, token!);
  console.log("CLOUD_BOOTSTRAP_RECOVERY_OK");
} finally {
  delete process.env.PSTDIO_CLOUD_BOOTSTRAP_FILE;
  await rm(root, { recursive: true, force: true });
}
