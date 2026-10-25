import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const fails of [false, true]) {
  test(`keeps the preload home through all files and removes it after ${fails ? "failure" : "success"}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-preload-lifetime-"));
    const homes = join(root, "homes.jsonl");
    try {
      for (const name of ["first", "second"]) {
        writeFileSync(
          join(root, `${name}.test.ts`),
          `import { expect, test } from "bun:test";
import { appendFileSync, existsSync } from "node:fs";
test(${JSON.stringify(name)}, () => {
  const home = process.env.PSTDIO_HOME!;
  expect(existsSync(home)).toBe(true);
  appendFileSync(${JSON.stringify(homes)}, JSON.stringify(home) + "\\n");
  expect(${fails && name === "first"}).toBe(false);
});`,
        );
      }
      const child = Bun.spawn(
        [
          process.execPath,
          "test",
          "--preload",
          join(import.meta.dir, "test-setup.ts"),
          "first.test.ts",
          "second.test.ts",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect({ exitCode, output: stdout + stderr }).toMatchObject({ exitCode: fails ? 1 : 0 });
      const paths = readFileSync(homes, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string);
      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(paths[1]);
      expect(existsSync(paths[0])).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
