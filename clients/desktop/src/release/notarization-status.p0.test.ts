import { expect, test } from "bun:test";
import { waitForNotarization } from "./notarization-status";

const credentials = { appleApiKey: "/keys/key.p8", appleApiKeyId: "KEY", appleApiIssuer: "ISSUER" };

test("preserves the submission and network error when status recovery is exhausted", async () => {
  const calls: string[][] = [];
  const pauses: number[] = [];
  const failure = await waitForNotarization(
    "uploaded",
    credentials,
    async (command, args) => {
      calls.push([command, ...args]);
      return { code: 1, stdout: "", stderr: "Error Domain=NSURLErrorDomain Code=-1005" };
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  ).catch((error: unknown) => error);
  expect((failure as Error).message).toContain("uploaded");
  expect((failure as Error).message).toContain("NSURLErrorDomain");
  expect(calls.map((call) => call.slice(0, 4))).toEqual(
    Array.from({ length: 3 }, () => ["xcrun", "notarytool", "wait", "uploaded"]),
  );
  expect(pauses).toEqual([1000, 2000]);
});

test("a rejected status reports Apple's log without waiting again or stapling", async () => {
  const calls: string[][] = [];
  const pauses: number[] = [];
  const failure = await waitForNotarization(
    "rejected",
    credentials,
    async (command, args) => {
      calls.push([command, ...args]);
      if (args[1] === "wait") return { code: 65, stdout: '{"status":"Invalid"}', stderr: "Not accepted" };
      return { code: 0, stdout: "unsigned framework", stderr: "" };
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  ).catch((error: unknown) => error);
  expect((failure as Error).message).toContain("unsigned framework");
  expect(calls.map((call) => call.slice(0, 4))).toEqual([
    ["xcrun", "notarytool", "wait", "rejected"],
    ["xcrun", "notarytool", "log", "rejected"],
  ]);
  expect(pauses).toEqual([]);
});

test("a permanent authentication failure stops status recovery immediately", async () => {
  let attempts = 0;
  const pauses: number[] = [];
  const failure = await waitForNotarization(
    "uploaded",
    credentials,
    async (_command, args) => {
      if (args[1] === "wait") attempts += 1;
      return { code: 1, stdout: "", stderr: "HTTP status 401: Unauthorized" };
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  ).catch((error: unknown) => error);
  expect((failure as Error).message).toContain("Unauthorized");
  expect(attempts).toBe(1);
  expect(pauses).toEqual([]);
});
