import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("resolves installed browser libraries from outside the extension directory", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-shared-exports-"));
  try {
    const source = `import { exportsFor } from ${JSON.stringify(new URL("./shared-exports.ts", import.meta.url).href)};
      console.log(JSON.stringify(await Promise.all(["@chakra-ui/react", "remotion", "motion-lab/kit"].map(exportsFor))));`;
    const child = Bun.spawn([process.execPath, "--conditions=source", "--eval", source], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, stderr).toBe(0);
    const [chakra, remotion, kit] = JSON.parse(stdout);
    expect(chakra).toContain("Box");
    expect(remotion).toContain("AbsoluteFill");
    expect(kit).toContain("WorkbenchFrame");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
