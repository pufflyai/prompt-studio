import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGitWorkspaceOperation } from "./operation";

test("backing removal waits for an active checkout and leaves no late files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "git-workspace-operation-"));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const creating = runGitWorkspaceOperation("workspace", async () => {
    entered.resolve();
    await release.promise;
    writeFileSync(join(directory, "checkout.txt"), "Checkout completed");
  });
  await entered.promise;
  const removing = runGitWorkspaceOperation("workspace", async () =>
    rmSync(directory, { recursive: true, force: true }),
  );
  try {
    expect(existsSync(directory)).toBe(true);
    release.resolve();
    await creating;
    await removing;
    expect(existsSync(directory)).toBe(false);
  } finally {
    release.resolve();
    await Promise.allSettled([creating, removing]);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a failed Git mutation releases only its workspace so cleanup can proceed", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let removed = false;
  const failed = runGitWorkspaceOperation("workspace", async () => {
    entered.resolve();
    await release.promise;
    throw new Error("Checkout failed");
  });
  void failed.catch(() => {});
  await entered.promise;
  const cleanup = runGitWorkspaceOperation("workspace", async () => {
    removed = true;
  });
  expect(await runGitWorkspaceOperation("other-workspace", async () => "independent")).toBe("independent");
  release.resolve();
  await expect(failed).rejects.toThrow("Checkout failed");
  await cleanup;
  expect(removed).toBe(true);
});

test("refreshed extension handlers share active backing ownership", async () => {
  const directory = mkdtempSync(join(tmpdir(), "git-workspace-refresh-"));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const creating = runGitWorkspaceOperation("refresh-workspace", async () => {
    entered.resolve();
    await release.promise;
    writeFileSync(join(directory, "checkout.txt"), "Checkout completed");
  });
  await entered.promise;
  const refreshed: typeof import("./operation") = await import(`./operation.ts?refresh=${crypto.randomUUID()}`);
  const removing = refreshed.runGitWorkspaceOperation("refresh-workspace", async () =>
    rmSync(directory, { recursive: true, force: true }),
  );
  try {
    expect(existsSync(directory)).toBe(true);
    release.resolve();
    await creating;
    await removing;
    expect(existsSync(directory)).toBe(false);
  } finally {
    release.resolve();
    await Promise.allSettled([creating, removing]);
    rmSync(directory, { recursive: true, force: true });
  }
});
