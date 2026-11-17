import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("fresh frontend guards preserve saved edits and resolution while sharing only byte-derived parsing", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-input-inspector-"));
  const entryPath = join(root, "view.ts");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "inspected-view" }));
  writeFileSync(entryPath, 'export const load = () => import("./" + "child");');
  writeFileSync(join(root, "child.ts"), "export const value = 1;");
  let imports: unknown;
  const inspect = async () => {
    const child = Bun.spawn([process.execPath, join(import.meta.dirname, "webview-input-inspector.entry.ts")], {
      cwd: root,
      stdin: Buffer.from(JSON.stringify({ packagePath: root, entryPaths: [entryPath], imports })),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    const result = JSON.parse(stdout);
    imports = [...(Array.isArray(imports) ? imports : []), ...result.imports];
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    return result.digest;
  };
  try {
    const first = await inspect();
    expect(await inspect()).toBe(first);
    const path = join(root, "child.ts");
    const before = statSync(path);
    writeFileSync(path, "export const value = 2;");
    utimesSync(path, before.atime, before.mtime);
    const edited = await inspect();
    expect(edited).not.toBe(first);
    // The importing bytes stay unchanged while resolution picks a newly added JSX module.
    rmSync(path);
    writeFileSync(join(root, "child.jsx"), "export const value = 2;");
    const resolved = await inspect();
    expect(resolved).not.toBe(edited);
    expect(readFileSync(entryPath, "utf8")).toBe('export const load = () => import("./" + "child");');
    const key = `ts\0true\0${createHash("sha256").update(readFileSync(entryPath)).digest("hex")}`;
    imports = [
      [key, ["./not-a-real-dependency"]],
      ["invalid-cache-key", []],
    ];
    expect(await inspect()).toBe(resolved);
    imports = Array.from({ length: 12_289 }, () => [key, ["./not-a-real-dependency"]]);
    expect(await inspect()).toBe(resolved);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
