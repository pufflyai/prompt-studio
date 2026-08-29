import { describe, expect, test } from "bun:test";
import { createGuestHost } from "./define-extension-view";

describe("createGuestHost", () => {
  test("returns host call results unchanged", async () => {
    const host = createGuestHost(
      async () => ({ ok: true }),
      () => () => {},
    );

    await expect(host.call("artifacts.read", { op: "list", mount: "runs" })).resolves.toEqual({ ok: true });
  });

  test("rethrows serialized bridge rejections as real errors", async () => {
    // RPC rejections cross the frame boundary as plain objects; guests must
    // still receive an Error with the host's message (e.g. a capability denial).
    const host = createGuestHost(
      () => Promise.reject({ message: "Webview did not declare host capability: artifacts.read:secrets" }),
      () => () => {},
    );

    const failure = host.call("artifacts.read", { op: "readText", mount: "secrets", path: "s.txt" });
    await expect(failure).rejects.toBeInstanceOf(Error);
    await expect(failure).rejects.toThrow("Webview did not declare host capability: artifacts.read:secrets");
  });

  test("keeps real errors intact", async () => {
    const original = new Error("boom");
    const host = createGuestHost(
      () => Promise.reject(original),
      () => () => {},
    );

    await expect(host.call("commands.execute", {})).rejects.toBe(original);
  });
});
