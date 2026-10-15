import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removePathBestEffort } from "./install-extension-source";
import { promotePreparedSource } from "./promote-extension-source";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const createTree = () => {
  const root = mkdtempSync(join(tmpdir(), "extension-update-responsiveness-"));
  roots.push(root);
  const prepared = join(root, "staging/tool");
  for (let index = 0; index < 100; index++) {
    const dependency = join(prepared, "node_modules", `dependency-${index}`, "lib");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, "index.js"), "export default {};\n");
  }
  return { root, prepared };
};

const countHeartbeats = async (work: () => unknown) => {
  let heartbeats = 0;
  const timer = setInterval(() => heartbeats++, 0);
  try {
    await work();
    return heartbeats;
  } finally {
    clearInterval(timer);
  }
};

test("keeps the event loop running while removing the previous extension dependencies", async () => {
  const { root } = createTree();
  const heartbeats = await countHeartbeats(() => removePathBestEffort(root));

  expect(existsSync(root)).toBe(false);
  expect(heartbeats).toBeGreaterThan(0);
});

test("keeps the event loop running while preparing dependency links for replacement", async () => {
  const { root, prepared } = createTree();
  const installed = join(root, "extensions/tool");
  mkdirSync(join(root, "extensions"));
  const heartbeats = await countHeartbeats(() => promotePreparedSource(prepared, installed, false, false));

  expect(existsSync(join(installed, "node_modules/dependency-99/lib/index.js"))).toBe(true);
  expect(heartbeats).toBeGreaterThan(0);
});
