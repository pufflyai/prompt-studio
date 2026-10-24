import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { engineIdentity, preparePgliteHome } from "./pglite-home-recovery";
import { acquirePgliteLock } from "./pglite-lock";

const run = async (active: string, phase = "") => {
  const child = Bun.spawn(
    [process.execPath, fileURLToPath(new URL("./pglite-home-recovery.fixture.ts", import.meta.url)), active, phase],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { exitCode, stderr };
};
const fixture = async (old: boolean) => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-home-recovery-"));
  const active = join(directory, "database");
  if (old) {
    await mkdir(active);
    await writeFile(join(active, "record"), "original value");
  }
  return { directory, active, staging: `${active}.staging`, retired: join(directory, "retired") };
};
const markCurrent = (home: string) => writeFile(join(home, ".pstdio-engine.json"), JSON.stringify(engineIdentity));

test("first-run interruption never exposes a partially initialized home", async () => {
  for (const phase of ["staging-created", "candidate-created", "candidate-verified", "candidate-published"]) {
    const f = await fixture(false);
    try {
      expect((await run(f.active, phase)).exitCode).toBe(73);
      if (phase !== "candidate-published") expect(await readdir(f.directory)).not.toContain("database");
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("first value");
      expect(await Bun.file(join(f.active, ".pstdio-engine.json")).json()).toEqual(engineIdentity);
      expect(await Bun.file(join(f.staging, "owner.json")).exists()).toBe(false);
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("a home from another release is retired before a new one is created", async () => {
  for (const marker of [undefined, '{"format":1,"engine":"pglite-0.4"}', '{"format":']) {
    const f = await fixture(true);
    try {
      if (marker) await writeFile(join(f.active, ".pstdio-engine.json"), marker);
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.retired, "record"), "utf8")).toBe("original value");
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("first value");
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("an interrupted retirement keeps the old home in place and retires it on the next start", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "retire-started")).exitCode).toBe(73);
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(f.retired, "record"), "utf8")).toBe("original value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("a current home opens as it is and keeps later writes when interrupted cleanup resumes", async () => {
  for (const phase of ["candidate-published", "cleanup-contents-removed", "cleanup-owner-removed"]) {
    const f = await fixture(false);
    try {
      expect((await run(f.active, phase)).exitCode).toBe(73);
      await writeFile(join(f.active, "record"), "later committed value");
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("later committed value");
      expect(await Bun.file(f.staging).exists()).toBe(false);
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("staged candidates never replace data and partial ones are rebuilt", async () => {
  const f = await fixture(false);
  try {
    expect((await run(f.active, "candidate-verified")).exitCode).toBe(73);
    await mkdir(f.active);
    await writeFile(join(f.active, "record"), "another writer");
    await markCurrent(f.active);
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("another writer");
    await rm(f.active, { recursive: true });
    expect((await run(f.active, "candidate-verified")).exitCode).toBe(73);
    await writeFile(join(f.staging, "target", ".pstdio-engine.json"), '{"format":');
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await Bun.file(join(f.active, ".pstdio-engine.json")).json()).toEqual(engineIdentity);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("a start stopped while it wrote staging ownership does not block the next start", async () => {
  const f = await fixture(false);
  try {
    await mkdir(f.staging);
    await writeFile(join(f.staging, "owner.json.partial"), '{"format":');
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("first value");
    expect(await Bun.file(f.staging).exists()).toBe(false);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("foreign staging is preserved for inspection", async () => {
  const f = await fixture(false);
  try {
    expect((await run(f.active, "staging-created")).exitCode).toBe(73);
    await writeFile(join(f.staging, "owner.json"), JSON.stringify({ format: 1, activePath: "/another/home" }));
    await writeFile(join(f.staging, "unknown"), "preserve me");
    expect((await run(f.active)).stderr).toContain("Unrecognized database staging");
    expect(await readFile(join(f.staging, "unknown"), "utf8")).toBe("preserve me");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("preparation failure leaves no home and the external lock excludes another process", async () => {
  const f = await fixture(false);
  const release = acquirePgliteLock(f.active);
  try {
    expect((await run(f.active)).stderr).toContain("in use");
    await expect(
      preparePgliteHome({
        activePath: f.active,
        retire: async () => {},
        prepare: async () => {
          throw new Error("disk full");
        },
      }),
    ).rejects.toThrow("disk full");
    expect(await readdir(f.directory)).not.toContain("database");
  } finally {
    release();
    await rm(f.directory, { recursive: true, force: true });
  }
});
