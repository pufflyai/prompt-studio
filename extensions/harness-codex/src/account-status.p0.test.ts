import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { readCodexAccountRequest } from "./account-status";

test("Quota reads initialize the native account protocol without creating a thread and release the process", async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const exit = Promise.withResolvers<{ code: number; signal: null }>();
  const methods: string[] = [];
  let stopped = false;
  stdin.on("data", (chunk) => {
    const request = JSON.parse(chunk.toString());
    methods.push(request.method);
    if (request.id === undefined) return;
    const result = request.method === "account/rateLimits/read" ? { rateLimits: { primary: { usedPercent: 25 } } } : {};
    stdout.write(JSON.stringify({ id: request.id, result }) + "\n");
  });
  const result = await readCodexAccountRequest(
    "account/rateLimits/read",
    {},
    {
      spawnProcess: () => ({
        stdin,
        stdout,
        stderr,
        onExit: exit.promise,
        kill: () => {
          stopped = true;
          stdout.end();
          stderr.end();
          stdin.end();
          exit.resolve({ code: 0, signal: null });
        },
      }),
    },
  );
  expect(result).toEqual({ rateLimits: { primary: { usedPercent: 25 } } });
  expect(methods).toEqual(["initialize", "initialized", "account/rateLimits/read"]);
  expect(stopped).toBe(true);
});
