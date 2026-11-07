import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

test("project fixtures remove generated folders when their process exits and preserve supplied folders", async () => {
  const supplied = mkdtempSync(join(tmpdir(), "pstdio-supplied-project-"));
  let generated: string | undefined;
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `
      import { existsSync } from "node:fs";
      import { folderProjectInput } from ${JSON.stringify(join(import.meta.dir, "folder-project.ts"))};
      const generated = folderProjectInput({ name: "Temporary" });
      const supplied = folderProjectInput({ name: "Supplied" }, ${JSON.stringify(supplied)});
      console.log(JSON.stringify({ generated, supplied, exists: existsSync(generated.initial_workspace.params.path) }));
    `,
      ],
      { env: { ...process.env, E2E_HOME: undefined }, stdout: "pipe", stderr: "pipe" },
    );
    const result = await new Response(child.stdout).json();
    generated = result.generated.initial_workspace.params.path;
    expect(await child.exited).toBe(0);
    expect(result.exists).toBe(true);
    expect(result.supplied.initial_workspace.params.path).toBe(supplied);
    expect(existsSync(generated!)).toBe(false);
    expect(existsSync(supplied)).toBe(true);
  } finally {
    rmSync(supplied, { recursive: true, force: true });
    if (generated) rmSync(generated, { recursive: true, force: true });
  }
});

test("run-owned project folders outlive workers and are removed with the server home", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-project-owner-"));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `
        import { folderProjectInput } from ${JSON.stringify(join(import.meta.dir, "folder-project.ts"))};
        console.log(JSON.stringify(folderProjectInput({ name: "Runtime-owned" })));
      `,
      ],
      { env: { ...process.env, E2E_HOME: home }, stdout: "pipe", stderr: "pipe" },
    );
    const result = await new Response(child.stdout).json();
    const folder = result.initial_workspace.params.path as string;
    expect(await child.exited).toBe(0);
    expect(dirname(folder)).toBe(join(home, "project-folders"));
    // The server can still provision skills after its browser worker exits.
    expect(existsSync(folder)).toBe(true);
    rmSync(home, { recursive: true, force: true });
    expect(existsSync(folder)).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
