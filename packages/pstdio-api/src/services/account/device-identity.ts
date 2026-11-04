import { z } from "zod";
import type { createNativeStore, DeviceLogin } from "./native-store";

/** Keys are resolved through the manager, which authenticates and scopes every device to its owner. */
export const createDeviceIdentity = (input: {
  current: () => Promise<DeviceLogin>;
  store: ReturnType<typeof createNativeStore>;
  call: (path: string, body?: unknown, credential?: string, signal?: AbortSignal) => Promise<unknown>;
}) => {
  let registered: { token: string; key: CryptoKey } | undefined;
  return {
    async commandIdentity(signal?: AbortSignal) {
      signal?.throwIfAborted();
      const login = await input.current();
      let identity = registered?.token === login.token ? registered : undefined;
      if (!identity) {
        const keys = await input.store.signingKeys(login.token);
        await input.call("/v1/devices/signing-key", { publicKey: keys.publicKey }, login.token, signal);
        const key = await crypto.subtle.importKey(
          "pkcs8",
          Buffer.from(keys.privateKey, "base64url"),
          "Ed25519",
          false,
          ["sign"],
        );
        identity = { token: login.token, key };
        registered = identity;
      }
      // A login removed or replaced while registration waited must not sign new commands.
      if ((await input.current()).token !== login.token) throw new Error("Device login changed");
      signal?.throwIfAborted();
      return { accountId: login.accountId, deviceId: login.deviceId, key: identity.key };
    },
    async deviceSigningKey(deviceId: string, signal?: AbortSignal) {
      const result = z
        .object({ publicKey: z.string() })
        .parse(
          await input.call(`/v1/devices/${encodeURIComponent(deviceId)}/signing-key`, undefined, undefined, signal),
        );
      return crypto.subtle.importKey("raw", Buffer.from(result.publicKey, "base64url"), "Ed25519", false, ["verify"]);
    },
  };
};
