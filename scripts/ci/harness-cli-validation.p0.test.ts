import { expect, test } from "bun:test";
import { installedHarnessSelection, reuseMinimumLane } from "./harness-cli-validation";

test("identical latest/minimum versions share the required minimum execution", () => {
  expect(reuseMinimumLane("latest", "0.73.1", "0.73.1", true)).toBe(true);
  expect(reuseMinimumLane("minimum", "0.73.1", "0.73.1", true)).toBe(false);
  expect(reuseMinimumLane("latest", "0.73.1", "0.74.0", true)).toBe(false);
  expect(reuseMinimumLane("latest", "0.73.1", "0.73.1", false)).toBe(false);
});

test("only the cold Windows x64 Pi 0.73.1 detection is quarantined", () => {
  const selected = installedHarnessSelection("harness-pi", "0.73.1", "win32", "x64");
  const detection = "installed Pi CLI detects the installed CLI and discovers a configured model";
  const session = "installed Pi CLI runs a tool and resumes its native session without an account";
  expect(selected.cases).toHaveLength(1);
  expect(new RegExp(selected.quarantine!).test(detection)).toBe(true);
  expect(new RegExp(selected.quarantine!).test(session)).toBe(false);
  expect(new RegExp(selected.stable).test(detection)).toBe(false);
  expect(new RegExp(selected.stable).test(session)).toBe(true);
  for (const [extension, version, platform, arch] of [
    ["harness-pi", "0.73.1", "linux", "x64"],
    ["harness-pi", "0.73.1", "win32", "arm64"],
    ["harness-pi", "0.74.0", "win32", "x64"],
    ["harness-codex", "0.73.1", "win32", "x64"],
  ] as const) {
    const other = installedHarnessSelection(extension, version, platform, arch);
    expect(other.cases).toHaveLength(0);
    expect(other.quarantine).toBeUndefined();
    expect(new RegExp(other.stable).test(detection)).toBe(true);
  }
});
