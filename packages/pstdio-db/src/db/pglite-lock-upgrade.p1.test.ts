import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquirePgliteLock as acquireLegacyLock } from "./pglite-legacy-lock.fixture";
import { acquirePgliteLock } from "./pglite-lock";

test("upgraded homes exclude older runtimes during ownership and after release", () => {
  const root = mkdtempSync(join(tmpdir(), "pglite-lock-upgrade-"));
  try {
    const path = join(root, "database");
    const release = acquirePgliteLock(path);
    try {
      expect(() => acquireLegacyLock(path)).toThrow();
    } finally {
      release();
    }
    expect(() => acquireLegacyLock(path)).toThrow();
    acquirePgliteLock(path)();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an existing old owner excludes the new runtime before the lock protocol upgrades", () => {
  const root = mkdtempSync(join(tmpdir(), "pglite-lock-old-owner-"));
  const path = join(root, "database");
  const release = acquireLegacyLock(path);
  try {
    expect(() => acquirePgliteLock(path)).toThrow("Stop its runtime");
    release();
    acquirePgliteLock(path)();
  } finally {
    release();
    rmSync(root, { recursive: true, force: true });
  }
});

test("old and new runtimes cannot both open a home during competing starts", async () => {
  const root = mkdtempSync(join(tmpdir(), "pglite-lock-mixed-start-"));
  const modules = [
    new URL("./pglite-lock.ts", import.meta.url),
    new URL("./pglite-legacy-lock.fixture.ts", import.meta.url),
  ];
  const iterations = 30;
  const children = modules.map((module, index) =>
    Bun.spawn([
      process.execPath,
      "-e",
      `
    import fs from 'node:fs'; import path from 'node:path';
    import {acquirePgliteLock} from ${JSON.stringify(module.href)};
    const [root,name,count]=process.argv.slice(1);
    for(let i=0;i<Number(count);i++) {
      const dir=path.join(root,String(i));
      while(!fs.existsSync(path.join(dir,'start'))) await Bun.sleep(1);
      try { const release=acquirePgliteLock(path.join(dir,'database'));
        fs.writeFileSync(path.join(dir,name),'acquired');
        while(!fs.existsSync(path.join(dir,'release'))) await Bun.sleep(1); release();
      } catch { fs.writeFileSync(path.join(dir,name),'rejected'); }
    }`,
      root,
      String(index),
      String(iterations),
    ]),
  );
  try {
    for (let index = 0; index < iterations; index++) {
      const directory = join(root, String(index));
      mkdirSync(directory);
      writeFileSync(join(directory, "start"), "");
      while (!["0", "1"].every((name) => existsSync(join(directory, name)))) {
        if (children.some((child) => child.exitCode !== null)) throw new Error("Mixed-version contender exited");
        await Bun.sleep(5);
      }
      const results = ["0", "1"].map((name) => readFileSync(join(directory, name), "utf8"));
      writeFileSync(join(directory, "release"), "");
      expect(results.filter((result) => result === "acquired").length).toBeLessThanOrEqual(1);
    }
    expect(await Promise.all(children.map((child) => child.exited))).toEqual([0, 0]);
  } finally {
    for (const child of children) child.kill();
    await Promise.all(children.map((child) => child.exited));
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlink cannot stand in for either permanent lock format directory", () => {
  const root = mkdtempSync(join(tmpdir(), "pglite-lock-symlink-"));
  try {
    for (const target of ["legacy", "fence", "dangling-fence"] as const) {
      const path = join(root, target);
      const empty = join(root, `${target}-target`);
      if (target !== "dangling-fence") mkdirSync(empty);
      if (target === "legacy") symlinkSync(empty, `${path}.lock`, "dir");
      else {
        mkdirSync(`${path}.lock`);
        symlinkSync(empty, join(`${path}.lock`, "sqlite-format.active"), "dir");
      }
      expect(() => acquirePgliteLock(path)).toThrow();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
