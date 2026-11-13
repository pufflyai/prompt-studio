import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { startPreparationWorker } from "pstdio-extensions/preparation-server";
import { recoverPreparedInstalls, retainPreparedInstall } from "./extension-install-transaction";
import { recoverPreparationStages, trackPreparationStage } from "./preparation-stages";

startPreparationWorker(async (task, data, signal) => {
  const input = data as { root: string; url: string };
  const staged = join(input.root, "stage");
  const install = join(input.root, "install");
  if (task === "hold") {
    mkdirSync(staged, { recursive: true });
    mkdirSync(install, { recursive: true });
    trackPreparationStage([staged]);
    retainPreparedInstall({
      root: install,
      installPath: join(install, "source"),
      targetPath: join(input.root, "target"),
      sourceHash: "fixture",
      preserveDependencies: false,
      replaceExisting: false,
    });
    await fetch(input.url, { signal });
  } else {
    await recoverPreparedInstalls();
    recoverPreparationStages();
  }
  return { stage: existsSync(staged), install: existsSync(install) };
});
