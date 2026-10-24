import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renamePgliteHome } from "./rename-pglite-home";

const windowsTest = process.platform === "win32" ? test : test.skip;

windowsTest("database publication waits for a temporary Windows reader to release its handle", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-publication-reader-"));
  const active = join(root, "active");
  const original = join(root, "original");
  await mkdir(active);
  await writeFile(join(active, "record"), "retained database bytes");
  const script = join(root, "reader.ps1");
  await writeFile(
    script,
    `param([string]$Path)
$reader = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
try {
  [Console]::Out.WriteLine('reader ready')
  [Console]::In.ReadLine() | Out-Null
} finally {
  $reader.Dispose()
}
`,
  );
  const child = Bun.spawn(
    ["powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", script, join(active, "record")],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stderr = new Response(child.stderr).text();
  let released = false;
  const releaseReader = () => {
    if (released) return;
    released = true;
    child.stdin.write("\n");
    child.stdin.end();
  };
  let release: ReturnType<typeof setTimeout> | undefined;
  try {
    const reader = child.stdout.getReader();
    const ready = await reader.read();
    reader.releaseLock();
    expect(new TextDecoder().decode(ready.value)).toContain("reader ready");
    const blocked = await rename(active, original).catch((error: unknown) => error);
    expect(blocked).toMatchObject({ code: "EPERM" });
    release = setTimeout(releaseReader, 30);
    const failure = await renamePgliteHome(active, original).catch((error: unknown) => error);
    expect(failure).toBeUndefined();
    expect(await readFile(join(original, "record"), "utf8")).toBe("retained database bytes");
    expect(await child.exited, await stderr).toBe(0);
  } finally {
    clearTimeout(release);
    if (child.exitCode === null) releaseReader();
    await child.exited;
    await rm(root, { recursive: true, force: true });
  }
});
