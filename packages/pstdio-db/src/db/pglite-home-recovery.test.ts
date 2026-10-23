import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePgliteHome } from "./pglite-home-recovery";
import { acquirePgliteLock } from "./pglite-lock";

const run = async (active: string, phase = "") => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "pglite-home-recovery.fixture.ts"), active, phase], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { exitCode, stderr };
};
const fixture = async (legacy: boolean) => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-home-recovery-"));
  const active = join(directory, "database");
  if (legacy) {
    await mkdir(active);
    await writeFile(join(active, "record"), "original value");
  }
  return { directory, active, transition: `${active}.engine-transfer` };
};

test("interrupted publication recovers at every directory boundary without losing original records", async () => {
  for (const phase of [
    "staging-created",
    "candidate-created",
    "candidate-verified",
    "original-moved",
    "candidate-published",
    "cleanup-complete",
  ]) {
    const f = await fixture(true);
    try {
      expect((await run(f.active, phase)).exitCode).toBe(73);
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
      expect(await Bun.file(join(f.active, ".pstdio-engine.json")).json()).toEqual({ format: 1, engine: "pglite-0.4" });
      expect(await Bun.file(join(f.transition, "owner.json")).exists()).toBe(false);
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("first-run interruption never exposes a partially initialized new home as legacy", async () => {
  for (const phase of ["staging-created", "candidate-created", "candidate-verified", "candidate-published"]) {
    const f = await fixture(false);
    try {
      expect((await run(f.active, phase)).exitCode).toBe(73);
      if (phase !== "candidate-published") expect(await readdir(f.directory)).not.toContain("database");
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("first value");
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("published homes keep later writes when interrupted cleanup resumes", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "candidate-published")).exitCode).toBe(73);
    await writeFile(join(f.active, "record"), "later committed value");
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("later committed value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("missing verified targets restore the original and report the failed publication", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "original-moved")).exitCode).toBe(73);
    await rm(join(f.transition, "target"), { recursive: true });
    const result = await run(f.active);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("restored the original");
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("an unmarked replacement and the original are both preserved as ambiguous", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "original-moved")).exitCode).toBe(73);
    await mkdir(f.active);
    await writeFile(join(f.active, "record"), "another writer");
    expect((await run(f.active)).stderr).toContain("Ambiguous");
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("another writer");
    expect(await readFile(join(f.transition, "original", "record"), "utf8")).toBe("original value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("missing originals do not promote an old prepared copy and foreign staging is preserved", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "candidate-verified")).exitCode).toBe(73);
    await rm(f.active, { recursive: true });
    expect((await run(f.active)).stderr).toContain("Missing original");
    await writeFile(join(f.transition, "owner.json"), JSON.stringify({ activePath: "/another/home" }));
    expect((await run(f.active)).stderr).toContain("Unrecognized");
    expect(await Bun.file(join(f.transition, "target", "record")).exists()).toBe(true);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("preparation failure preserves the original and the external lock excludes another process", async () => {
  const f = await fixture(true);
  const release = acquirePgliteLock(f.active);
  try {
    expect((await run(f.active)).stderr).toContain("in use");
    await expect(
      preparePgliteHome({
        activePath: f.active,
        prepare: async () => {
          throw new Error("disk full");
        },
      }),
    ).rejects.toThrow("disk full");
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
  } finally {
    release();
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("an empty active directory left by startup does not block recovery between renames", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "original-moved")).exitCode).toBe(73);
    await mkdir(f.active);
    expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("interrupted cleanup never leaves a valid current home blocked by its own transfer directory", async () => {
  for (const phase of ["cleanup-contents-removed", "cleanup-owner-removed"]) {
    const f = await fixture(true);
    try {
      expect((await run(f.active, phase)).exitCode).toBe(73);
      await writeFile(join(f.active, "record"), "newer write");
      expect(await run(f.active)).toEqual({ exitCode: 0, stderr: "" });
      expect(await readFile(join(f.active, "record"), "utf8")).toBe("newer write");
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("partial candidate identities never block rebuilding an initial home or restoring an original", async () => {
  for (const legacy of [false, true]) {
    const f = await fixture(legacy);
    try {
      expect((await run(f.active, legacy ? "original-moved" : "candidate-verified")).exitCode).toBe(73);
      await writeFile(join(f.transition, "target", ".pstdio-engine.json"), '{"format":');
      const result = await run(f.active);
      if (legacy) {
        expect(result.stderr).toContain("restored the original");
        expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
      } else {
        expect(result).toEqual({ exitCode: 0, stderr: "" });
        expect(await readFile(join(f.active, "record"), "utf8")).toBe("first value");
      }
    } finally {
      await rm(f.directory, { recursive: true, force: true });
    }
  }
});

test("partial ownership and active engine identities fail without deleting unknown data", async () => {
  const f = await fixture(true);
  try {
    expect((await run(f.active, "staging-created")).exitCode).toBe(73);
    await writeFile(join(f.transition, "owner.json"), '{"format":');
    await writeFile(join(f.transition, "unknown"), "preserve me");
    expect((await run(f.active)).stderr).toContain("Unrecognized engine transfer");
    expect(await readFile(join(f.transition, "unknown"), "utf8")).toBe("preserve me");
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
    await rm(f.transition, { recursive: true });
    await writeFile(join(f.active, ".pstdio-engine.json"), '{"format":');
    expect((await run(f.active)).exitCode).not.toBe(0);
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("cancellation between renames leaves a recoverable original and does not publish early", async () => {
  const f = await fixture(true);
  const release = acquirePgliteLock(f.active);
  const controller = new AbortController();
  try {
    await expect(
      preparePgliteHome({
        activePath: f.active,
        signal: controller.signal,
        prepare: async ({ target }) => {
          await mkdir(target);
          await writeFile(join(target, "record"), "original value");
        },
        onPhase: (phase) => {
          if (phase === "original-moved") controller.abort(new Error("cancelled publication"));
        },
      }),
    ).rejects.toThrow("cancelled publication");
    expect(await Bun.file(join(f.active, "record")).exists()).toBe(false);
    expect(await readFile(join(f.transition, "original", "record"), "utf8")).toBe("original value");
    await preparePgliteHome({
      activePath: f.active,
      prepare: async () => {
        throw new Error("verified candidate already exists");
      },
    });
    expect(await readFile(join(f.active, "record"), "utf8")).toBe("original value");
  } finally {
    release();
    await rm(f.directory, { recursive: true, force: true });
  }
});
