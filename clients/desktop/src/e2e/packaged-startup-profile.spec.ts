import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { redactSensitiveText } from "pstdio-logging";
import {
  attachStartupTimings,
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";

test("profiles packaged startup", async () => {
  const home = createPackagedHome();
  const profiles = test.info().outputPath("runtime-cpu");
  const tracePath = test.info().outputPath("chromium-startup.json");
  mkdirSync(profiles, { recursive: true });
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(
      home,
      {
        BUN_OPTIONS: `--cpu-prof --cpu-prof-md --cpu-prof-dir=${profiles}`,
      },
      [
        "--trace-startup=v8,devtools.timeline,disabled-by-default-v8.cpu_profiler",
        "--trace-startup-duration=0",
        "--trace-startup-format=json",
        `--trace-startup-file=${tracePath}`,
      ],
    );
    await attachStartupTimings(app);
    await app.finishTrace();
    await runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    if (existsSync(tracePath)) {
      writeFileSync(tracePath, redactSensitiveText(readFileSync(tracePath, "utf8"), [app.runtime.token]));
    }
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
