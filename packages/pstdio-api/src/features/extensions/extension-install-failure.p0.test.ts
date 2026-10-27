import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitUnavailableError } from "pstdio-wt";
import { extensionInstallFailure } from "./extension-install-failure";
import { ExtensionAlreadyInstalledError } from "./install-extension-source";

test("reports that Git-backed installation is unavailable without Git", async () => {
  const response = await extensionInstallFailure(new GitUnavailableError());
  expect(response).toMatchObject({ status: 409, body: { code: "git_unavailable" } });
});

test("an incomplete installed folder still reports a replaceable conflict", async () => {
  const target = mkdtempSync(join(tmpdir(), "extension-conflict-"));
  try {
    const response = await extensionInstallFailure(new ExtensionAlreadyInstalledError(target));
    expect(response?.status).toBe(409);
    expect(response?.body).toMatchObject({ code: "extension_already_installed" });
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
