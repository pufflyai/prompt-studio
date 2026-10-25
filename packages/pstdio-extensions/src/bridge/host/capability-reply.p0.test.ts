import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "../contract";
import { createGuestHost } from "../guest/define-extension-view";
import { capabilityReply } from "./capability-reply";

test("capability denials preserve their code and nested data through guest replies", async () => {
  const gate = createHostCapabilityGate({ capabilities: {}, declaredCapabilities: [] });
  const host = createGuestHost(
    (request) => capabilityReply(() => gate.call(request)),
    () => () => {},
  );
  await expect(host.call("preferences.get", { name: "density" })).rejects.toMatchObject({
    code: "undeclared_webview_capability",
    data: { capability: "preferences.get" },
  });
  const data = { current: { revision: 2, fields: ["title", "status"] } };
  const rejected = createGuestHost(
    () =>
      capabilityReply(() => {
        throw Object.assign(new Error("Changed"), { code: "stale_revision", data });
      }),
    () => () => {},
  );
  await expect(rejected.call("commands.execute", { commandId: "save" })).rejects.toMatchObject({
    code: "stale_revision",
    message: "Changed",
    data,
  });
});

test("capability replies retain successful values including void", async () => {
  const result = { outcome: { ok: false, status: "rejected", code: "needs_review", reason: "Review" } } as const;
  const host = createGuestHost(
    () => capabilityReply(() => result),
    () => () => {},
  );
  await expect(host.call("commands.execute", { commandId: "save" })).resolves.toEqual(result);
  expect(await capabilityReply(() => undefined)).toEqual({ ok: true, value: undefined });
});
