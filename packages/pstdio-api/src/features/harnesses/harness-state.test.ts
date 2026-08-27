import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
