import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

test("a main-thread source check reports a process-mode extension and exits", async () => {
  const root = await mkdtemp(join(tmpdir(), "check-process-backend-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "source-check",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      pstdio: { backendRuntime: "process" },
    }),
  );
  await writeFile(join(root, "extension.ts"), "export default {};");
  const checker = import.meta.resolve("./check.ts");
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "-e",
      `const { checkExtensions } = await import(${JSON.stringify(checker)});
       const result = await checkExtensions({ homeRoot: ${JSON.stringify(root)}, extensionPackages: [{ path: ${JSON.stringify(root)} }] });
       console.log(JSON.stringify({ errors: result.errorCount, extensions: result.runtime.extensions.map((ext) => ext.id) }));`,
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outputRead = new Response(child.stdout).text();
    const exit = await Promise.race([
      child.exited,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve("still running"), 4_000);
      }),
    ]);
    expect(exit).toBe(0);
    const output = await outputRead;
    expect(output).toContain('"extensions":["example.source-check"]');
  } finally {
    clearTimeout(timer);
    child.kill();
    await child.exited;
    await rm(root, { recursive: true, force: true });
  }
}, 6_000);
