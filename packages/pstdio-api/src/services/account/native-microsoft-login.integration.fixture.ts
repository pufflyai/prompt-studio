import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { call, devices, type Host, login, type Status } from "./native-device-sign-in.fixture";
import { createAccountHostFixture } from "./native-host.fixture";

const root = await mkdtemp(join(tmpdir(), "native-microsoft-device-"));
let host: Host | undefined;
try {
  host = await createAccountHostFixture(root);
  console.log("NATIVE_RUNTIME_READY");
  await Bun.stdin.stream().getReader().read();

  const signedIn = await login(
    host,
    process.env.OWNER_TEST_ORIGIN!,
    process.env.OWNER_TEST_MICROSOFT_SUBJECT!,
    "microsoft",
  );
  assert.equal(signedIn.accountId, process.env.OWNER_TEST_MICROSOFT_ACCOUNT);
  assert.equal(signedIn.deviceId, (await host.deps.environmentService.get()).environmentId);

  await host.close();
  host = undefined;
  host = await createAccountHostFixture(root);
  assert.deepEqual((await call<Status>(host, "/account")).body.login, signedIn);
  assert.deepEqual(
    (await devices(host)).map(({ id, current }) => ({ id, current })),
    [{ id: signedIn.deviceId, current: true }],
  );
} finally {
  await host?.close();
  await rm(root, { recursive: true, force: true });
}
