import { expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { notarizeMacApp } from "./notarize-macos";
import { runMacCommand } from "./stapler";

const credentials = { appleApiKey: "/keys/key.p8", appleApiKeyId: "KEY", appleApiIssuer: "ISSUER" };

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
  expect(commands).toHaveLength(3);
  expect(commands[1]?.slice(0, 3)).toEqual(["xcrun", "notarytool", "submit"]);
  expect(commands[1]).toContain("--wait");
  expect(commands[2]).toEqual(["xcrun", "stapler", "staple", "-v", "/Applications/Prompt Studio.app"]);
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
    "console.log('stdout'); console.error('stderr'); process.exit(68)",
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
