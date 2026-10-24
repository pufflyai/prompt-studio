import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renamePgliteHome } from "./rename-pglite-home";

const windowsTest = process.platform === "win32" ? test : test.skip;

test("cancelled database publication preserves the active home", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-publication-cancelled-"));
  const active = join(root, "active");
  const original = join(root, "original");
  await mkdir(active);
  await writeFile(join(active, "record"), "retained database bytes");
  const controller = new AbortController();
  const reason = new Error("Database opening was cancelled");
  controller.abort(reason);
  try {
    const failure = await renamePgliteHome(active, original, controller.signal).catch((error: unknown) => error);
    expect(failure).toBe(reason);
    expect(await readFile(join(active, "record"), "utf8")).toBe("retained database bytes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const withWindowsReader = async (
  run: (paths: { active: string; original: string; releaseReader: () => void }) => Promise<void>,
) => {
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
  [Console]::Out.Write('reader ')
  Start-Sleep -Milliseconds 20
  [Console]::Out.WriteLine('ready')
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
  try {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let ready = "";
    try {
      while (!ready.includes("\n")) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Windows reader ended before confirming its open handle");
        ready += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    expect(ready.trim()).toBe("reader ready");
    const blocked = await rename(active, original).catch((error: unknown) => error);
    expect(blocked).toMatchObject({ code: "EPERM" });
    await run({ active, original, releaseReader });
  } finally {
    if (child.exitCode === null) releaseReader();
    const code = await child.exited;
    const error = await stderr;
    await rm(root, { recursive: true, force: true });
    expect(code, error).toBe(0);
  }
};

windowsTest("database publication waits for a temporary Windows reader to release its handle", async () => {
  await withWindowsReader(async ({ active, original, releaseReader }) => {
    const release = setTimeout(releaseReader, 30);
    try {
      const failure = await renamePgliteHome(active, original).catch((error: unknown) => error);
      expect(failure).toBeUndefined();
      expect(await readFile(join(original, "record"), "utf8")).toBe("retained database bytes");
    } finally {
      clearTimeout(release);
    }
  });
});

windowsTest("cancelling Windows publication while a reader is open preserves the active home", async () => {
  await withWindowsReader(async ({ active, original }) => {
    const controller = new AbortController();
    const reason = new Error("Database opening was cancelled");
    const cancel = setTimeout(() => controller.abort(reason), 30);
    try {
      const failure = await renamePgliteHome(active, original, controller.signal).catch((error: unknown) => error);
      expect(failure).toBe(reason);
      expect(await readFile(join(active, "record"), "utf8")).toBe("retained database bytes");
    } finally {
      clearTimeout(cancel);
    }
  });
});

windowsTest("a persistent Windows reader reports publication failure and preserves the active home", async () => {
  await withWindowsReader(async ({ active, original }) => {
    const failure = await renamePgliteHome(active, original).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "EPERM" });
    expect(await readFile(join(active, "record"), "utf8")).toBe("retained database bytes");
  });
});
