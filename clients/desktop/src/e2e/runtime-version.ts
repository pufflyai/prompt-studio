import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";
import desktopPackage from "../../package.json" with { type: "json" };

export const expectRuntimeVersionRecovery = async (
  app: ElectronApplication,
  lifecycle: Page,
  descriptor: RuntimeDescriptor,
  home: string,
) => {
  await test.step("keeps an older runtime running and retries after its version matches", async () => {
    await expect(lifecycle.getByText("version_mismatch", { exact: true })).toBeVisible();
    expect(
      app
        .context()
        .pages()
        .some((page) => page.url().startsWith(descriptor.origin)),
    ).toBe(false);
    expect(
      (
        await fetch(`${descriptor.origin}/runtime/ready`, {
          headers: { authorization: `Bearer ${descriptor.token}` },
        })
      ).ok,
    ).toBe(true);
    descriptor.appVersion = desktopPackage.version;
    writeFileSync(join(home, "runtime.json"), JSON.stringify(descriptor));
    await lifecycle.getByRole("button", { name: "Retry", exact: true }).click();
  });
};
