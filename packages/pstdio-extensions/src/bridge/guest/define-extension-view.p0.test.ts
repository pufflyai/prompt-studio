import { describe, expect, test } from "bun:test";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createGuestHost } from "./define-extension-view";

describe("createGuestHost", () => {
  test("returns host call results unchanged", async () => {
    const host = createGuestHost(
      async () => ({ ok: true, value: [{ path: "result.json", size: 12, mediaType: "application/json" }] }),
      () => () => {},
    );

    await expect(await host.call("artifacts.read", { op: "list", mount: "runs" })).toEqual([
      { path: "result.json", size: 12, mediaType: "application/json" },
    ]);
  });

  test("rethrows serialized bridge rejections as real errors", async () => {
    // RPC rejections cross the frame boundary as plain objects; guests must
    // still receive an Error with the host's message (e.g. a capability denial).
    const host = createGuestHost(
      () => Promise.reject({ message: "Webview did not declare host capability: artifacts.read:secrets" }),
      () => () => {},
    );

    const failure = host.call("artifacts.read", { op: "readText", mount: "secrets", path: "s.txt" });
    await expectRejection(failure).toBeInstanceOf(Error);
    await expectRejection(failure).toThrow("Webview did not declare host capability: artifacts.read:secrets");
  });

  test("keeps real errors intact", async () => {
    const original = new Error("boom");
    const host = createGuestHost(
      () => Promise.reject(original),
      () => () => {},
    );

    await expectRejection(host.call("commands.execute", { commandId: "test" })).toBe(original);
  });
});
