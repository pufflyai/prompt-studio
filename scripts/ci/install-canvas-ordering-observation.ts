import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [root, observers] = process.argv.slice(2);
if (!root || !observers) throw new Error("Expected exact-main checkout and saved diagnostic helper folder");
const destination = join(root, "packages/e2e/src/packaged");
for (const name of ["native-diagnostic-emitter.ts", "packaged-canvas-observation.ts", "canvas-ordering-observation.ts"])
  copyFileSync(join(observers, name), join(destination, name));
const path = join(destination, "packaged-canvas-install.p2.test.ts");
let source = readFileSync(path, "utf8");
const replace = (before: string, after: string) => {
  if (!source.includes(before)) throw new Error(`Diagnostic insertion no longer matches main: ${before}`);
  source = source.replace(before, after);
};
replace(
  'import { afterAll, expect, test } from "bun:test";',
  'import { afterAll, expect, test } from "bun:test";\nimport { observeCanvasOrdering } from "./canvas-ordering-observation";',
);
replace(
  "let browser: Browser | undefined;",
  "let browser: Browser | undefined;\n    let stopObservation: (() => void) | undefined;",
);
replace(
  "const page = await browser.newPage();",
  "const page = await browser.newPage();\n      stopObservation = await observeCanvasOrdering(page, startedAt, root);",
);
replace("await browser?.close();", "stopObservation?.();\n      await browser?.close();");
writeFileSync(path, source);
