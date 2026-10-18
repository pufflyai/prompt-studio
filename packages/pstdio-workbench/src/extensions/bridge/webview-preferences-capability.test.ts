import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("webview preferences isolate undeclared names while retaining deprecated registered access", async () => {
  const workbench = createWorkbench();
  const a = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.a" });
  const b = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.b" });
  for (const name of ["lastRange", "toString", "constructor", "__proto__"]) {
    await a["preferences.set"]({ name, value: "now-6h" });
    expect(await a["preferences.get"]({ name })).toBe("now-6h");
    expect(await b["preferences.get"]({ name })).toBeUndefined();
  }
  workbench.preferences.registerSchema(
    { properties: { "a.setting": { type: "string", scope: "user" } } },
    { ownerId: "acme.a" },
  );
  const warnings: string[] = [];
  const legacy = createWorkbenchWebviewHostCapabilities({
    workbench,
    extensionId: "acme.b",
    warn: (message) => warnings.push(message),
  });
  await legacy["preferences.set"]({ name: "a.setting", value: "legacy" });
  expect(await a["preferences.get"]({ name: "a.setting" })).toBe("legacy");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("deprecated");
  workbench.preferences.registerSchema(
    { properties: { "core.setting": { type: "string", scope: "user" } } },
    { ownerId: "workbench.core" },
  );
  await legacy["preferences.set"]({ name: "core.setting", value: "shared" });
  expect(await a["preferences.get"]({ name: "core.setting" })).toBe("shared");
  expect(warnings).toHaveLength(1);
  expect(() => a["preferences.set"]({ name: "lastRange", value: "a", scope: { scope: "default" } })).toThrow(
    expect.objectContaining({ code: "preference_scope_read_only" }),
  );
});

test("preference capabilities wait for persistence and forward write failures", async () => {
  let release: (() => void) | undefined;
  let writes = 0;
  const workbench = createWorkbench({
    preferencePersistence: {
      getValue: () => undefined,
      setValue: () =>
        new Promise<void>((resolve) => {
          release = () => {
            writes++;
            resolve();
          };
        }),
    },
  });
  workbench.preferences.registerSchema({ properties: { registered: { type: "string", scope: "user" } } });
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme" });
  for (const name of ["registered", "owned"]) {
    let acknowledged = false;
    const result = Promise.resolve(capabilities["preferences.set"]({ name, value: "saved" }));
    void result.then(() => {
      acknowledged = true;
    });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    release!();
    await expect(result).resolves.toEqual({ name, value: "saved" });
  }
  expect(writes).toBe(2);
  const failing = createWorkbench({
    preferencePersistence: {
      getValue: () => undefined,
      setValue: async () => {
        throw new Error("Storage unavailable");
      },
    },
  });
  failing.preferences.registerSchema({ properties: { registered: { type: "string", scope: "user" } } });
  const failedCapabilities = createWorkbenchWebviewHostCapabilities({ workbench: failing, extensionId: "acme" });
  for (const name of ["registered", "owned"]) {
    await expect(Promise.resolve(failedCapabilities["preferences.set"]({ name, value: "saved" }))).rejects.toThrow(
      "Storage unavailable",
    );
  }
});
