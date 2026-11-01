import { expect, test } from "bun:test";
import { openDeviceCall, sealDeviceCall } from "./device-call";
import { createSyncSpace } from "./space";

test("a callee verifies the trusted caller key and binds the encrypted call to its destination and procedure", async () => {
  const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const stranger = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: Buffer.alloc(32, 7).toString("base64url") }],
  });
  const context = { callerDeviceId: "laptop", targetDeviceId: "desktop", procedure: "opaque_procedure_1234" };
  const payload = await sealDeviceCall(space, context, keys.privateKey, new TextEncoder().encode("interrupt"));
  expect(new TextDecoder().decode(await openDeviceCall(space, context, keys.publicKey, payload))).toBe("interrupt");
  const invalidKey = await openDeviceCall(space, context, stranger.publicKey, payload).catch((error) => error);
  expect(invalidKey).toBeInstanceOf(Error);
  const moved = await openDeviceCall(space, { ...context, targetDeviceId: "third" }, keys.publicKey, payload).catch(
    (error) => error,
  );
  expect(moved).toBeInstanceOf(Error);
});
