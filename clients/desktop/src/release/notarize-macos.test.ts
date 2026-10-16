import { expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { notarizeMacApp } from "./notarize-macos";
import { runMacCommand } from "./stapler";

const credentials = { appleApiKey: "/keys/key.p8", appleApiKeyId: "KEY", appleApiIssuer: "ISSUER" };

test("resumes the same notarization submission after a status request loses its connection", async () => {
  const commands: string[][] = [];
  const pauses: number[] = [];
  let statusRequests = 0;
  await notarizeMacApp(
    "/app",
    credentials,
    async (command, args) => {
      commands.push([command, ...args]);
      if (args[1] === "submit") return { code: 0, stdout: JSON.stringify({ id: "uploaded" }), stderr: "" };
      if (args[1] === "wait") {
        statusRequests += 1;
        if (statusRequests === 1) return { code: 1, stdout: "", stderr: "Error Domain=NSURLErrorDomain Code=-1001" };
        return { code: 0, stdout: JSON.stringify({ id: "uploaded", status: "Accepted" }), stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  );
  expect(commands.filter((call) => call[2] === "submit")).toHaveLength(1);
  expect(commands.filter((call) => call[2] === "wait").map((call) => call[3])).toEqual(["uploaded", "uploaded"]);
  expect(commands.find((call) => call[2] === "submit")).not.toContain("--wait");
  expect(commands.at(-1)?.slice(0, 3)).toEqual(["xcrun", "stapler", "staple"]);
  expect(pauses).toEqual([1000]);
});

test("notarization submits the archive once and staples only after acceptance", async () => {
  const commands: string[][] = [];
  let archive = "";
  await notarizeMacApp("/Applications/Prompt Studio.app", credentials, async (command, args) => {
    commands.push([command, ...args]);
    if (command === "ditto") {
      archive = args.at(-1)!;
      expect(existsSync(dirname(archive))).toBe(true);
      writeFileSync(archive, "archive fixture");
    }
    const stdout = args[0] === "notarytool" ? JSON.stringify({ id: "submission", status: "Accepted" }) : "";
    return { code: 0, stdout, stderr: "" };
  });
  expect(commands).toHaveLength(4);
  expect(commands[1]?.slice(0, 3)).toEqual(["xcrun", "notarytool", "submit"]);
  expect(commands[1]).not.toContain("--wait");
  expect(commands[2]?.slice(0, 4)).toEqual(["xcrun", "notarytool", "wait", "submission"]);
  expect(commands[3]).toEqual(["xcrun", "stapler", "staple", "-v", "/Applications/Prompt Studio.app"]);
  expect(existsSync(dirname(archive))).toBe(false);
});

test("rejected notarization reports service diagnostics without stapling", async () => {
  const commands: string[][] = [];
  const failure = await notarizeMacApp("/app", credentials, async (command, args) => {
    commands.push([command, ...args]);
    if (args[1] === "submit")
      return { code: 0, stdout: JSON.stringify({ id: "rejected", status: "Invalid" }), stderr: "" };
    return { code: 0, stdout: "invalid signature", stderr: "" };
  }).catch((error: unknown) => error);
  expect(failure).toMatchObject({ message: expect.stringContaining("invalid signature") });
  expect(commands.map((call) => call.slice(0, 3))).toEqual([
    ["ditto", "-c", "-k"],
    ["xcrun", "notarytool", "submit"],
    ["xcrun", "notarytool", "log"],
  ]);
});

test("native command execution retains numeric failure status and both output streams", async () => {
  const result = await runMacCommand(process.execPath, [
    "-e",
    "process.stdout.write('stdout\\n'); process.stderr.write('stderr\\n'); process.exit(68)",
  ]);
  expect(result).toEqual({ code: 68, stdout: "stdout\n", stderr: "stderr\n" });
});

test("nonzero rejected submissions retain Apple's detailed log", async () => {
  const commands: string[][] = [];
  const failure = await notarizeMacApp("/app", credentials, async (command, args) => {
    commands.push([command, ...args]);
    if (args[1] === "submit")
      return { code: 65, stdout: JSON.stringify({ id: "rejected", status: "Invalid" }), stderr: "submission rejected" };
    return { code: 0, stdout: "unsigned framework", stderr: "" };
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  const message = (failure as Error).message;
  expect(message).toContain("unsigned framework");
  expect(message).toContain("submission rejected");
  expect(commands.at(-1)?.slice(0, 4)).toEqual(["xcrun", "notarytool", "log", "rejected"]);
});

test("failed log retrieval preserves the rejected submission", async () => {
  const failure = await notarizeMacApp("/app", credentials, async (_command, args) => {
    if (args[1] === "submit")
      return { code: 65, stdout: JSON.stringify({ id: "rejected", status: "Invalid" }), stderr: "submission rejected" };
    if (args[1] === "log") throw new Error("log service unavailable");
    return { code: 0, stdout: "", stderr: "" };
  }).catch((error: unknown) => error);
  expect((failure as Error).message).toContain("submission rejected");
});
