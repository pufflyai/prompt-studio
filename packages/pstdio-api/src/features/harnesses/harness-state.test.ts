import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarnessStateApi } from "./harness-state";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("stores harness state under the active pstdio home and isolates extensions", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-harness-state-"));
  roots.push(home);
  const first = createHarnessStateApi("pstdio.first", { env: { PSTDIO_HOME: home } });
  const second = createHarnessStateApi("pstdio.second", { env: { PSTDIO_HOME: home } });

  await first.set("serverUrl", "http://127.0.0.1:4096");

  expect(await first.get<string>("serverUrl")).toBe("http://127.0.0.1:4096");
  expect(await second.get("serverUrl")).toBeUndefined();
  expect(JSON.parse(readFileSync(join(home, "state/pstdio.first.json"), "utf8"))).toEqual({
    serverUrl: "http://127.0.0.1:4096",
  });

  await first.delete("serverUrl");
  expect(await first.get("serverUrl")).toBeUndefined();
});

test("stores accepted Windows device publishers in portable state files", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-harness-device-"));
  roots.push(home);
  const state = createHarnessStateApi("con.notes", { env: { PSTDIO_HOME: home } });
  await state.set("value", "kept");
  expect(JSON.parse(readFileSync(join(home, "state/_con.notes.json"), "utf8"))).toEqual({ value: "kept" });
  expect(await state.get<string>("value")).toBe("kept");
});

test.skipIf(process.platform === "win32")(
  "preserves earlier device-publisher state when its filename moves",
  async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-harness-device-migration-"));
    roots.push(home);
    mkdirSync(join(home, "state"));
    writeFileSync(join(home, "state/con.notes.json"), JSON.stringify({ value: "previous" }));
    const state = createHarnessStateApi("con.notes", { env: { PSTDIO_HOME: home } });
    expect(await state.get<string>("value")).toBe("previous");
    await state.set("next", true);
    expect(await state.get<string>("value")).toBe("previous");
  },
);

test("does not replace malformed harness state", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-harness-state-"));
  roots.push(home);
  const statePath = join(home, "state/pstdio.first.json");
  mkdirSync(join(home, "state"));
  writeFileSync(statePath, "{broken");
  const state = createHarnessStateApi("pstdio.first", { env: { PSTDIO_HOME: home } });

  await expect(state.get("serverUrl")).rejects.toThrow();
  await expect(state.set("serverUrl", "http://127.0.0.1:4096")).rejects.toThrow();
  expect(readFileSync(statePath, "utf8")).toBe("{broken");
});
