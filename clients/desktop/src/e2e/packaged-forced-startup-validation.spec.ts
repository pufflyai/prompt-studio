import { renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolvePackagedLayout } from "../packaging/package-layout";
import { test } from "../testing/packaged-fixture";
import { createPackagedHome, launchPackagedApp } from "./packaged-app-helpers";

test("forced startup failure preserves historical log evidence", async () => {
  const home = createPackagedHome();
  const layout = resolvePackagedLayout(resolve(import.meta.dirname, "../.."), process.platform, process.arch);
  writeFileSync(join(home, "logs.jsonl"), `history marker\n${"historical line\n".repeat(4000)}`);
  writeFileSync(join(home, "desktop-runtime.log"), `runtime history marker\n${"historical line\n".repeat(4000)}`);
  renameSync(layout.executable, `${layout.executable}.evidence-validation`);
  try {
    await launchPackagedApp(home);
  } finally {
    renameSync(`${layout.executable}.evidence-validation`, layout.executable);
  }
});
