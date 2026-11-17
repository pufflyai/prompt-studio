import { afterEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureFiles } from "./files";
import type { DiagnosticRecord } from "./types";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "performance-captures-"));
  directories.push(directory);
  const files = captureFiles(directory, "project-1");
  const record: DiagnosticRecord = {
    id: randomUUID(),
    projectId: "project-1",
    kind: "cpu",
    seconds: 1,
    createdAt: new Date().toISOString(),
  };
  return { directory, files, record };
};

test("atomically merges concurrent metadata updates and keeps artifacts private", async () => {
  const { directory, files, record } = await fixture();
  await files.create(record);
  await Promise.all([
    files.update(record.id, { automationId: "run-1" }),
    files.update(record.id, { pid: process.pid }),
  ]);
  expect(await files.read(record.id)).toMatchObject({ automationId: "run-1", pid: process.pid });
  await files.writeResult(record.id, { profile: { nodes: [] } });
  expect(await files.result(record.id)).toEqual({ profile: { nodes: [] } });
  if (process.platform !== "win32") expect((await stat(join(directory, "project-1"))).mode & 0o777).toBe(0o700);
});

test("rejects traversal and oversized capture artifacts", async () => {
  const { files, record } = await fixture();
  await files.create(record);
  await expect(files.read("../elsewhere")).rejects.toThrow();
  await expect(files.writeResult(record.id, "x".repeat(16 * 1024 * 1024))).rejects.toThrow("limit");
});

test("retains ten completed captures and preserves an unfinished capture", async () => {
  const { files, record } = await fixture();
  await files.create(record);
  for (let index = 0; index < 12; index++) {
    const completed = {
      ...record,
      id: randomUUID(),
      createdAt: new Date(Date.now() + index).toISOString(),
      finishedAt: new Date().toISOString(),
    };
    await files.create(completed);
    await files.writeResult(completed.id, { index });
  }
  await files.prune();
  const saved = await files.list();
  expect(saved).toHaveLength(11);
  expect(saved.some((entry) => entry.id === record.id)).toBe(true);
  expect(saved.filter((entry) => entry.finishedAt)).toHaveLength(10);
});
