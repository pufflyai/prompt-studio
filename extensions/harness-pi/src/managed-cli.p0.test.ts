import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { piBunCommand, readManagedPiVersion, resolvePiCommand } from "./cli";

test("a private Pi script runs with bundled Bun and does not pass Bun mode to child tools", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-private-"));
  const entry = join(root, "cli.ts");
  writeFileSync(entry, 'console.log(JSON.stringify({version:"0.79.0",bunMode:process.env.BUN_BE_BUN??null}));');
  try {
    const resolved = resolvePiCommand({ which: () => null, managed: () => entry });
    const child = Bun.spawn([...resolved.command, "--version"], {
      env: { PATH: "/usr/bin:/bin", ...resolved.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(JSON.parse(await new Response(child.stdout).text())).toEqual({ version: "0.79.0", bunMode: null });
    expect(await child.exited).toBe(0);
    expect(resolvePiCommand({ which: () => "/global/pi", managed: () => entry }).command).toEqual(["/global/pi"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Windows Pi npm shims use their existing script with Bun", () => {
  const entry = "C:\\tools\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js";
  expect(
    resolvePiCommand({
      which: () => "C:\\tools\\pi.cmd",
      platform: "win32",
      exists: (path) => path === entry,
      managed: () => "private",
    }).command.at(-1),
  ).toBe(entry);
});

const managedBundle = () => {
  const root = mkdtempSync(join(tmpdir(), "pi-metadata-"));
  const entry = join(root, "dist/cli.js");
  mkdirSync(join(root, "dist"));
  writeFileSync(entry, 'console.log("0.79.0");');
  const writeManifest = (overrides: Record<string, unknown> = {}) =>
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "@earendil-works/pi-coding-agent",
        version: "0.79.0",
        bin: { pi: "dist/cli.js" },
        ...overrides,
      }),
    );
  writeManifest();
  return { root, entry, ...piBunCommand(entry), writeManifest };
};

test("managed metadata is reread after a version change and rejects a removed CLI", () => {
  const bundle = managedBundle();
  try {
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBe("0.79.0");
    bundle.writeManifest({ version: "0.78.1" });
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBe("0.78.1");
    unlinkSync(bundle.entry);
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
  } finally {
    rmSync(bundle.root, { recursive: true, force: true });
  }
});

test("managed metadata never substitutes for a different command or package override", () => {
  const bundle = managedBundle();
  try {
    expect(readManagedPiVersion(["external-pi"], bundle.env, bundle.entry)).toBeUndefined();
    expect(
      readManagedPiVersion([...bundle.command, "--session-dir", "elsewhere"], bundle.env, bundle.entry),
    ).toBeUndefined();
    expect(
      readManagedPiVersion(bundle.command, { ...bundle.env, PI_PACKAGE_DIR: bundle.root }, bundle.entry),
    ).toBeUndefined();
    expect(readManagedPiVersion(bundle.command, { ...bundle.env, BUN_BE_BUN: "" }, bundle.entry)).toBeUndefined();
  } finally {
    rmSync(bundle.root, { recursive: true, force: true });
  }
});

test("managed metadata requires the declared package and CLI to agree", () => {
  const bundle = managedBundle();
  try {
    bundle.writeManifest({ name: "another-agent" });
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
    const other = join(bundle.root, "dist/other.js");
    writeFileSync(other, 'console.log("0.79.0");');
    bundle.writeManifest({ bin: { pi: "dist/other.js" } });
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
    bundle.writeManifest({ version: "not a version" });
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
    writeFileSync(join(bundle.root, "package.json"), "{");
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
  } finally {
    rmSync(bundle.root, { recursive: true, force: true });
  }
});

test("managed metadata rejects a closer manifest that can change the CLI version", () => {
  const bundle = managedBundle();
  try {
    writeFileSync(join(bundle.root, "dist/package.json"), JSON.stringify({ name: "pi-binary", version: "0.78.1" }));
    expect(readManagedPiVersion(bundle.command, bundle.env, bundle.entry)).toBeUndefined();
  } finally {
    rmSync(bundle.root, { recursive: true, force: true });
  }
});
