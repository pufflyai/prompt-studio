import { expect, test } from "bun:test";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";
import { prepareHarnessPackage } from "./harness-package";

test("a usable global CLI avoids package acquisition; missing and old CLIs acquire the pinned package", async () => {
  const acquisitions: unknown[] = [];
  let version = "tool 2.0.0";
  const context = {
    process: { run: async () => ({ exitCode: 0, stdout: version, stderr: "" }) },
    packages: {
      ensure: async (input: unknown) => {
        acquisitions.push(input);
        return { path: "/cache/tool" };
      },
    },
  } as unknown as HarnessContext;
  const input = { command: ["tool"], minimumVersion: "2.0.0", name: "tool-cli", version: "2.1.0" };
  expect(await prepareHarnessPackage(context, input)).toBeNull();
  expect(acquisitions).toEqual([]);
  version = "\u001b[32m2.0.0\u001b[0m";
  expect(await prepareHarnessPackage(context, input)).toBeNull();
  expect(acquisitions).toEqual([]);
  version = "tool 1.0.0";
  expect(await prepareHarnessPackage(context, input)).toEqual({ path: "/cache/tool" });
  version = "unavailable";
  await prepareHarnessPackage(context, input);
  expect(acquisitions).toEqual([
    { name: "tool-cli", version: "2.1.0" },
    { name: "tool-cli", version: "2.1.0" },
  ]);
});
