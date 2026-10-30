import { expect, test } from "bun:test";
import { join } from "node:path";
import {
  browserQuarantineReportPath,
  bunTestSelection,
  narrowStablePattern,
  playwrightQuarantineSelection,
  quarantinePattern,
} from "./test-quarantine";

test("Windows launch flakes execute once in quarantine and remain stable on other platforms", () => {
  const runner = "packaged-desktop-benchmark";
  const directory = "clients/desktop/src/e2e";
  const stable = playwrightQuarantineSelection(runner, directory, false, "win32", "x64");
  const quarantine = playwrightQuarantineSelection(runner, directory, true, "win32", "x64");
  const linux = playwrightQuarantineSelection(runner, directory, false, "linux", "x64");
  if (!("grepInvert" in stable && "grep" in quarantine && "grepInvert" in linux))
    throw new Error("Unexpected stable/quarantine selection");
  for (const name of [
    "warm attach restores the workbench within budget",
    "cold start with an empty home shows the workbench within budget",
  ]) {
    const title = `packaged-launch.p3.bench.ts ${name}`;
    expect(stable.grepInvert!.test(title)).toBe(true);
    expect(quarantine.grep!.test(title)).toBe(true);
    expect(linux.grepInvert.test(title)).toBe(false);
  }
  expect(quarantine.grep!.test("packaged-launch.p3.bench.ts sidecar crash shows recovery within budget")).toBe(false);
  expect(quarantine.repeatEach).toBe(1);
  expect(quarantine.retries).toBe(0);
  expect(browserQuarantineReportPath(runner)).toEndWith(
    "clients/desktop/test-results/packaged-benchmarks-quarantine.json",
  );
});

const cases = [
  { runner: "bun", file: "packages/db/a.test.ts", name: "keeps data (cold)", platforms: ["linux"] },
  { runner: "bun", file: "scripts/b.test.ts", name: "versions packages", platforms: ["win32"] },
  { runner: "playwright", file: "packages/e2e/a.spec.ts", name: "browser saves", platforms: ["linux"] },
];

test("compiled CLI quarantine uses the built binary without selecting source Bun cases", () => {
  const entries = [
    {
      runner: "packaged-bun",
      file: "packages/e2e/src/packaged/native.test.ts",
      name: "starts browser",
      platforms: ["win32"],
    },
    { runner: "bun", file: "packages/e2e/src/source.test.ts", name: "source behavior", platforms: ["win32"] },
  ];
  const selected = bunTestSelection(entries, "packages/e2e", "win32", true, "packaged-bun");
  expect(selected.files).toEqual([join("src", "packaged", "native.test.ts")]);
  expect(new RegExp(selected.pattern!).test("starts browser")).toBe(true);
  expect(new RegExp(selected.pattern!).test("source behavior")).toBe(false);
  expect(
    new RegExp(bunTestSelection(entries, "packages/e2e", "win32", false, "packaged-bun").pattern!).test(
      "starts browser",
    ),
  ).toBe(false);
  expect(bunTestSelection(entries, "packages/e2e", "linux", true, "packaged-bun").files).toEqual([]);
});

test("quarantine selection is limited to its runner, platform and package", () => {
  const selected = bunTestSelection(cases, "packages/db", "linux", false);
  expect(new RegExp(selected.pattern!).test("keeps data (cold)")).toBe(false);
  expect(new RegExp(selected.pattern!).test("keeps data cold")).toBe(true);
  expect(new RegExp(selected.pattern!).test("ordinary behavior")).toBe(true);
  expect(bunTestSelection(cases, "scripts", "linux", false).pattern).toBeUndefined();
  expect(new RegExp(quarantinePattern(cases, "playwright", "linux")!).test("browser saves")).toBe(true);
});

test("a native architecture quarantine leaves other machines blocking", () => {
  const cases = [
    {
      runner: "packaged-desktop",
      file: "clients/desktop/a.spec.ts",
      name: "tabs retain pages",
      platforms: ["darwin"],
      arch: "arm64",
    },
  ];
  expect(quarantinePattern(cases, "packaged-desktop", "darwin", "arm64")).toBeDefined();
  expect(
    new RegExp(quarantinePattern(cases, "packaged-desktop", "darwin", "arm64")!).test("tabs retain pages @essential"),
  ).toBe(true);
  expect(quarantinePattern(cases, "packaged-desktop", "darwin", "x64")).toBeUndefined();
  expect(quarantinePattern(cases, "packaged-desktop", "linux", "arm64")).toBeUndefined();
});

test("the quarantine lane runs only registered cases and never falls back to the full suite", () => {
  const selected = bunTestSelection(cases, "packages/db", "linux", true);
  expect(selected.files).toEqual(["a.test.ts"]);
  expect(new RegExp(selected.pattern!).test("keeps data (cold)")).toBe(true);
  expect(new RegExp(selected.pattern!).test("ordinary behavior")).toBe(false);
  expect(bunTestSelection(cases, "scripts", "linux", true).files).toEqual([]);
});

test("a caller's name filter narrows the stable lane without running quarantined cases", () => {
  const stable = bunTestSelection(cases, "packages/db", "linux", false).pattern!;
  const pattern = new RegExp(narrowStablePattern(stable, "keeps data")!);
  expect(pattern.test("keeps data cold")).toBe(true);
  expect(pattern.test("keeps data (cold)")).toBe(false);
  expect(pattern.test("ordinary behavior")).toBe(false);
  expect(narrowStablePattern(undefined, "keeps data")).toBe("keeps data");
});

test("explicit file scope selects only its registered quarantine cases", () => {
  const entries = [...cases, { runner: "bun", file: "packages/db/other.test.ts", name: "other", platforms: ["linux"] }];
  const selection = bunTestSelection(entries, "packages/db", "linux", true, "bun", ["./a.test.ts"]);
  expect(selection.files).toEqual(["a.test.ts"]);
  expect(selection.count).toBe(1);
  expect(new RegExp(selection.pattern!).test("other")).toBe(false);
});
