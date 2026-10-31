import { expect, test } from "bun:test";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";

test("installation capabilities read the host jobs and validate a retry before calling the owner", async () => {
  const calls: string[] = [];
  const job = {
    id: "job",
    installName: "notes",
    displayName: "Notes",
    queuedAt: "2026-10-28T00:00:00Z",
    status: "failed" as const,
  };
  const capabilities = createExtensionWebviewHostCapabilities({
    installations: {
      list: () => [job],
      retry: (id) => {
        calls.push(id);
        return { ...job, status: "queued" };
      },
    },
  });
  expect(await capabilities["extensions.installations.read"]({})).toEqual([job]);
  await capabilities["extensions.installations.retry"]({ id: "job" });
  expect(calls).toEqual(["job"]);
  await expect(
    Promise.resolve().then(() => capabilities["extensions.installations.retry"]({ id: "" })),
  ).rejects.toMatchObject({ code: "invalid_params" });
  expect(calls).toEqual(["job"]);
});
