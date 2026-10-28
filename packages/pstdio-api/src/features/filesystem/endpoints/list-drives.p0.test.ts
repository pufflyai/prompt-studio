import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import { createFilesystemRoutes } from "../routes";

test("discovers drive roots on the runtime host", async () => {
  const response = await createFilesystemRoutes({}).request("/filesystem/drives");
  expect(response.status).toBe(200);
  const { drives } = (await response.json()) as { drives: { name: string; path: string }[] };
  if (process.platform !== "win32") {
    expect(drives).toEqual([]);
    return;
  }
  const homeRoot = parse(homedir()).root;
  expect(drives).toContainEqual({ name: homeRoot.slice(0, 2), path: homeRoot });
  expect(drives.map((drive) => drive.path)).toEqual(drives.map((drive) => drive.path).sort());
  for (const drive of drives) {
    expect(drive.path).toMatch(/^[A-Z]:\\$/);
    expect((await stat(drive.path)).isDirectory()).toBe(true);
  }
});

test.skipIf(process.platform !== "win32")("browses a second drive and detects its removal", async () => {
  const routes = createFilesystemRoutes({});
  const { drives } = (await (await routes.request("/filesystem/drives")).json()) as {
    drives: { name: string; path: string }[];
  };
  const letter = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(90 - index)}:`).find(
    (name) => !drives.some((drive) => drive.name === name),
  );
  expect(letter).toBeDefined();
  const folder = mkdtempSync(join(tmpdir(), "drive-navigation-"));
  mkdirSync(join(folder, "My tools"));
  const subst = join(process.env.SystemRoot!, "System32", "subst.exe");
  try {
    expect(spawnSync(subst, [letter!, folder]).status).toBe(0);
    const mounted = await (await routes.request("/filesystem/drives")).json();
    expect(mounted.drives).toContainEqual({ name: letter, path: `${letter}\\` });
    expect(mounted.drives.length).toBeGreaterThanOrEqual(2);
    const response = await routes.request(`/filesystem/list?path=${encodeURIComponent(`${letter}\\`)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).entries).toContainEqual({
      name: "My tools",
      path: realpathSync(`${letter}\\My tools`),
      isDirectory: true,
    });
    expect(spawnSync(subst, [letter!, "/D"]).status).toBe(0);
    const disconnected = await (await routes.request("/filesystem/drives")).json();
    expect(disconnected.drives).not.toContainEqual({ name: letter, path: `${letter}\\` });
    expect((await routes.request(`/filesystem/list?path=${encodeURIComponent(`${letter}\\`)}`)).status).toBe(400);
  } finally {
    spawnSync(subst, [letter!, "/D"]);
    rmSync(folder, { recursive: true, force: true });
  }
});
