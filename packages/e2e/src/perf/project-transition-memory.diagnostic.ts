import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { preparePackagedConsumers } from "../packaged/prepared-packaged-consumers";

if (process.platform !== "darwin" || !process.env.E2E_PACKAGED_BINARY_PATH || !process.argv[2])
  throw new Error("Set the compiled E2E_PACKAGED_BINARY_PATH and pass an output directory");
const output = resolve(process.argv[2]);
mkdirSync(output, { recursive: true });
const controller = new AbortController();
const interrupt = () => controller.abort();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, interrupt);
const profile = await preparePackagedConsumers(controller.signal);
try {
  for (const name of ["E2E_EXTENSION_SOURCES", "E2E_HOME", "E2E_BUN_CACHE_DIR", "NPM_CONFIG_USERCONFIG"])
    process.env[name] = profile.env[name];
  // Resolve the installed-source profile only after preparing it, as in Playwright global setup.
  const { qualifyProjectTransitions } = await import("../packaged/packaged-project-transitions.fixture");
  for (const count of [2, 10]) {
    controller.signal.throwIfAborted();
    const directory = join(output, String(count));
    mkdirSync(directory);
    console.log(JSON.stringify({ projects: count, phase: "warming" }));
    await qualifyProjectTransitions(
      { chromium },
      count,
      {
        attach: async (name, input) => {
          const target = join(directory, `${name}.json`);
          if (input?.path) cpSync(input.path, target);
          else if (input?.body !== undefined) writeFileSync(target, input.body);
        },
      },
      true,
      controller.signal,
    );
    console.log(JSON.stringify({ projects: count, phase: "captured" }));
  }
} finally {
  await profile.close();
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, interrupt);
}
