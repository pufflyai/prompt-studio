import { expect, test } from "bun:test";
import { runStapler } from "./stapler";

for (const action of ["staple", "validate"] as const) {
  test(`${action} retries Apple ticket network failures with growing pauses`, async () => {
    const calls: string[][] = [];
    const pauses: number[] = [];
    await runStapler(
      action,
      "/Applications/Prompt Studio.app",
      async (command, args) => {
        calls.push([command, ...args]);
        return calls.length < 3
          ? { code: 68, stdout: "", stderr: "Error Domain=NSURLErrorDomain Code=-1005" }
          : { code: 0, stdout: "", stderr: "" };
      },
      async (milliseconds) => {
        pauses.push(milliseconds);
      },
    );
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(["xcrun", "stapler", action, "-v", "/Applications/Prompt Studio.app"]);
    expect(pauses).toEqual([1000, 2000]);
  });
}

test("stapler preserves failure output after all network attempts fail", async () => {
  let calls = 0;
  const pauses: number[] = [];
  const failure = await runStapler(
    "staple",
    "/app",
    async () => {
      calls += 1;
      return { code: 68, stdout: "Error Domain=NSURLErrorDomain", stderr: "Connection lost" };
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  ).catch((error: unknown) => error);
  expect(failure).toMatchObject({ message: expect.stringContaining("NSURLErrorDomain") });
  expect(calls).toBe(3);
  expect(pauses).toEqual([1000, 2000]);
});

for (const [code, stderr] of [
  [68, "Unsupported app format"],
  [65, "NSURLErrorDomain"],
] as const) {
  test(`stapler fails immediately for non-retryable status ${code}`, async () => {
    let calls = 0;
    const pauses: number[] = [];
    const failure = await runStapler(
      "validate",
      "/app",
      async () => {
        calls += 1;
        return { code, stdout: "", stderr };
      },
      async (milliseconds) => {
        pauses.push(milliseconds);
      },
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({ message: expect.stringContaining(stderr) });
    expect(calls).toBe(1);
    expect(pauses).toEqual([]);
  });
}
