import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { startupFailure } from "../testing/packaged-test-evidence";
import { createPackagedHome, disposePackagedApp, launchPackagedApp, removePackagedHome } from "./packaged-app-helpers";

test("keeps complete redacted startup evidence before home removal", async ({ browserName: _browserName }, info) => {
  const home = createPackagedHome();
  // Startup evidence does not depend on agent harnesses, so default extension downloads stay out of this test.
  const app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
  const marker = "startup-evidence-history";
  const history = `${marker}\n${"history entry\n".repeat(4_000)}`;
  for (const filename of ["logs.jsonl", "desktop-runtime.log"]) {
    const path = join(home, filename);
    writeFileSync(path, `${history}${readFileSync(path, "utf8")}\nevidence tail\n${app.runtime.token}\n`);
  }
  const failure = startupFailure(new Error("forced startup evidence check"), home, [app.runtime.token]);
  expect(failure.message).toContain("evidence tail");
  expect(failure.message).not.toContain(app.runtime.token);
  await disposePackagedApp(app);
  await removePackagedHome(home);
  // Explicit disposal and fixture teardown share the same home-removal owner.
  await removePackagedHome(home);
  for (const name of ["runtime-log", "runtime-output"]) {
    const attachments = info.attachments.filter((attachment) => attachment.name === name);
    expect(attachments).toHaveLength(1);
    const saved = readFileSync(attachments[0]!.path!, "utf8");
    expect(saved).toContain(marker);
    expect(saved.length).toBeGreaterThan(32_000);
    expect(saved).not.toContain(app.runtime.token);
  }
});
