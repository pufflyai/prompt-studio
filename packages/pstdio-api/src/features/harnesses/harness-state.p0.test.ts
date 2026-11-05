import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarnessStateApi } from "./harness-state";

const roots: string[] = [];

test.skipIf(process.platform === "win32")("tightens existing credential state before read-only reuse", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-legacy-harness-state-"));
  roots.push(home);
  const directory = join(home, "state");
  const path = join(directory, "pstdio.private.json");
  const serverUrl = "http://opencode:private@127.0.0.1:4096";
  mkdirSync(directory);
  writeFileSync(path, JSON.stringify({ serverUrl }));
  chmodSync(directory, 0o755);
  chmodSync(path, 0o644);
  const state = createHarnessStateApi("pstdio.private", { env: { PSTDIO_HOME: home } });
  expect(await state.get("serverUrl")).toBe(serverUrl);
  expect(statSync(directory).mode & 0o777).toBe(0o700);
  expect(statSync(path).mode & 0o777).toBe(0o600);
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.skipIf(process.platform === "win32")(
  "keeps saved credentials private and tightens existing state directories",
  async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-private-harness-state-"));
    roots.push(home);
    const directory = join(home, "state");
    mkdirSync(directory);
    chmodSync(directory, 0o755);
    const state = createHarnessStateApi("pstdio.private", { env: { PSTDIO_HOME: home } });
    await state.set("serverUrl", "http://opencode:private@127.0.0.1:4096");
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "pstdio.private.json")).mode & 0o777).toBe(0o600);
  },
);

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
