import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopChildProcess } from "./child-process";
import { registerPendingTestProcess } from "./pending-test-processes";
import { removeTestDirectory } from "./remove-test-directory";

test("removes its owned tree without following directory links or deleting external hardlinks", async () => {
  const parent = await mkdtemp(join(tmpdir(), "owned-cleanup-"));
  try {
    const owned = join(parent, "owned ' $` Ω");
    const external = join(parent, "external");
    await mkdir(owned);
    await mkdir(external);
    const sentinel = join(external, "keep.txt");
    await writeFile(sentinel, "Keep the external target");
    await symlink(external, join(owned, "external-directory"), process.platform === "win32" ? "junction" : "dir");
    await link(sentinel, join(owned, "external-file"));
    await writeFile(join(owned, "own.txt"), "Remove this owned file");

    await removeTestDirectory(owned);

    expect(await stat(owned).catch(() => null)).toBeNull();
    expect(await readFile(sentinel, "utf8")).toBe("Keep the external target");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("removes readonly files and long Unicode paths, and accepts an already removed root", async () => {
  const parent = await mkdtemp(join(tmpdir(), "attribute-cleanup-"));
  const owned = join(parent, "owned");
  try {
    const deep = join(owned, ...Array.from({ length: 14 }, (_, index) => `directory-${index}-long-Ω`));
    await mkdir(deep, { recursive: true });
    const file = join(deep, "readonly.txt");
    await writeFile(file, "Read only");
    await chmod(file, 0o444);

    await removeTestDirectory(owned);
    await removeTestDirectory(owned);

    expect(await stat(owned).catch(() => null)).toBeNull();
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("removes a linked root without enumerating its external target", async () => {
  const parent = await mkdtemp(join(tmpdir(), "linked-root-cleanup-"));
  try {
    const external = join(parent, "external");
    await mkdir(external);
    await writeFile(join(external, "keep.txt"), "Keep the external target");
    const owned = join(parent, "owned-link");
    await symlink(external, owned, process.platform === "win32" ? "junction" : "dir");
    await removeTestDirectory(owned);
    expect(await stat(owned).catch(() => null)).toBeNull();
    expect(await readFile(join(external, "keep.txt"), "utf8")).toBe("Keep the external target");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("removes an owned home after a transient native directory handle is released", async () => {
  const parent = await mkdtemp(join(tmpdir(), "transient-cleanup-"));
  const owned = join(parent, "owned");
  await mkdir(owned);
  const holder = spawn(
    "node",
    [
      "-e",
      'process.on("message", () => setTimeout(() => process.chdir(require("node:os").tmpdir()), 1000)); process.send("ready");',
    ],
    { cwd: owned, stdio: ["ignore", "ignore", "ignore", "ipc"] },
  );
  const lifetime = registerPendingTestProcess(holder);
  try {
    await once(holder, "message", { signal: lifetime.signal });
    holder.send("release");
    await removeTestDirectory(owned);
    expect(await stat(owned).catch(() => null)).toBeNull();
  } finally {
    try {
      await stopChildProcess(holder);
    } finally {
      lifetime.finish();
      await rm(parent, { recursive: true, force: true });
    }
  }
});
