import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireFileMutationLock } from "pstdio-paths";
import { ExtensionAlreadyInstalledError, promotePreparedSource } from "./promote-extension-source";

test("a missing-only install recognizes a winner before checking its unused dependency reuse plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-existing-winner-"));
  const prepared = join(root, "staging/tool");
  const installed = join(root, "extensions/tool");
  try {
    mkdirSync(prepared, { recursive: true });
    mkdirSync(join(installed, "node_modules"), { recursive: true });
    writeFileSync(join(prepared, "package.json"), JSON.stringify({ version: "1.0.0" }));
    writeFileSync(join(installed, "package.json"), JSON.stringify({ version: "2.0.0" }));
    await expect(promotePreparedSource(prepared, installed, false, true)).rejects.toBeInstanceOf(
      ExtensionAlreadyInstalledError,
    );
    expect(JSON.parse(readFileSync(join(installed, "package.json"), "utf8")).version).toBe("2.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a replacement cannot preserve dependencies from a different installed source", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-stale-dependencies-"));
  const prepared = join(root, "staging/tool");
  const installed = join(root, "extensions/tool");
  try {
    mkdirSync(prepared, { recursive: true });
    mkdirSync(join(installed, "node_modules/demo"), { recursive: true });
    writeFileSync(join(prepared, "package.json"), JSON.stringify({ dependencies: { demo: "1.0.0" } }));
    writeFileSync(join(installed, "package.json"), JSON.stringify({ dependencies: { demo: "2.0.0" } }));
    writeFileSync(join(installed, "node_modules/demo/version.txt"), "2.0.0");

    await expect(promotePreparedSource(prepared, installed, true, true)).rejects.toThrow(
      "Installed extension dependencies changed while preparing the replacement",
    );
    expect(JSON.parse(readFileSync(join(installed, "package.json"), "utf8")).dependencies.demo).toBe("2.0.0");
    expect(readFileSync(join(installed, "node_modules/demo/version.txt"), "utf8")).toBe("2.0.0");
    expect(JSON.parse(readFileSync(join(prepared, "package.json"), "utf8")).dependencies.demo).toBe("1.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a competing process cannot replace a shared source while its owner holds the mutation claim", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-owner-"));
  const prepared = join(root, "staging/tool");
  const installed = join(root, "extensions/tool");
  mkdirSync(prepared, { recursive: true });
  mkdirSync(installed, { recursive: true });
  writeFileSync(join(prepared, "version.txt"), "replacement");
  writeFileSync(join(installed, "version.txt"), "original");
  const release = acquireFileMutationLock(join(root, ".extension-source-locks/tool"));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `import { promotePreparedSource } from ${JSON.stringify(join(import.meta.dir, "promote-extension-source.ts"))};
         // Exercise the existing lock expiry without spending the test's allowance waiting.
         const now = Date.now(); let ticks = 0; Date.now = () => now + ticks++ * 1000;
         await promotePreparedSource(${JSON.stringify(prepared)}, ${JSON.stringify(installed)}, true, false);`,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Timed out waiting for file mutation ownership");
    expect(readFileSync(join(installed, "version.txt"), "utf8")).toBe("original");
    expect(readFileSync(join(prepared, "version.txt"), "utf8")).toBe("replacement");
  } finally {
    release();
  }
  try {
    await promotePreparedSource(prepared, installed, true, false);
    expect(readFileSync(join(installed, "version.txt"), "utf8")).toBe("replacement");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("keeps installed dependency links readable after their folder moves", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-"));
  try {
    const prepared = join(root, "staging/tool");
    const installed = join(root, "extensions/tool");
    const provider = join(root, "provider");
    mkdirSync(join(prepared, "vendor/demo"), { recursive: true });
    mkdirSync(join(prepared, "node_modules"));
    mkdirSync(join(prepared, "node_modules/.bin"));
    mkdirSync(join(root, "extensions"));
    mkdirSync(provider);
    writeFileSync(join(prepared, "vendor/demo/index.ts"), "export default 1;");
    writeFileSync(join(provider, "index.ts"), "export default 2;");
    const modules = join(prepared, "node_modules");
    for (const name of ["demo", "alias"]) writeFileSync(join(modules, name), "");
    const [first, last] = readdirSync(modules).filter((name) => name !== ".bin");
    for (const name of [first, last]) unlinkSync(join(modules, name!));
    // Create the chain before its destination exists so Bun retains both links.
    symlinkSync(join(modules, last!), join(modules, first!), "junction");
    symlinkSync(join(modules, last!, "index.ts"), join(modules, ".bin/demo"), "file");
    symlinkSync(join(prepared, "vendor/demo"), join(modules, last!), "junction");
    symlinkSync(provider, join(prepared, "node_modules/provider"), "junction");

    await promotePreparedSource(prepared, installed, false, false);
    rmSync(join(root, "staging"), { recursive: true });

    expect(readFileSync(join(installed, "node_modules/demo/index.ts"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/alias/index.ts"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/.bin/demo"), "utf8")).toBe("export default 1;");
    expect(readFileSync(join(installed, "node_modules/provider/index.ts"), "utf8")).toBe("export default 2;");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
