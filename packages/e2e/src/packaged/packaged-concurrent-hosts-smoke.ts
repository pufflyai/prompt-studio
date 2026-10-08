import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerConcurrentHostsSmokeTests = () => {
  test("starts independent packaged hosts concurrently", async () => {
    const roots = ["first", "second"].map((name) => mkdtempSync(join(tmpdir(), `pstdio-host-${name}-`)));
    const children: ChildProcess[] = [];
    try {
      const outcomes = await Promise.allSettled(roots.map((root) => startPackagedServe(root)));
      for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") children.push(outcome.value.child);
      }
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") throw outcome.reason;
        const host = outcome.value;
        const response = await fetch(`${host.baseUrl}/v1/projects`, {
          headers: runtimeAuthorization(host.descriptor),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
      }
    } finally {
      await Promise.all(children.map(stopProcess));
      for (const root of roots) rmSync(root, { recursive: true, force: true });
    }
  });
};
