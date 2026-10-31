import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectPi } from "./detection";

test.each([
  ["0.79.0", true],
  ["1.4.0", true],
  ["0.78.1", false],
  ["0.78.0", false],
  ["0.74.0", false],
  ["0.73.1", false],
  ["not pi", false],
])("checks Pi version %s", async (stdout, available) => {
  const ctx = { process: { run: async () => ({ exitCode: 0, stdout, stderr: "" }) } } as unknown as HarnessContext;
  expect((await detectPi(ctx)).available).toBe(available);
});

test("reports a missing Pi installation", async () => {
  const ctx = {
    process: {
      run: async () => {
        throw new Error("ENOENT");
      },
    },
  } as unknown as HarnessContext;
  expect(await detectPi(ctx)).toMatchObject({ available: false, reason: expect.stringContaining("Install Pi") });
});
