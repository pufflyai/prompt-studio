import { appendFileSync, existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { bunTestSelection, verifyPlaywrightQuarantineReport, verifyQuarantineReport } from "./test-quarantine";
import registry from "./test-quarantine.json";

const root = resolve(import.meta.dir, "../..");
const runner = process.argv[2];
const cases = registry.filter(
  (entry) =>
    entry.runner === runner &&
    entry.platforms.includes(process.platform) &&
    (!entry.arch || entry.arch === process.arch),
);
const record = (name: string, result: { executed: number; failures: number }) => {
  const line = `${name}: ${result.executed} quarantined cases executed once; ${result.failures} failed.\n`;
  console.log(line.trim());
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line);
};

if (runner === "bun" || runner === "packaged-bun") {
  const packages = new Set(
    cases.map((entry) => {
      let directory = dirname(resolve(root, entry.file));
      while (!existsSync(resolve(directory, "package.json"))) directory = dirname(directory);
      return relative(root, directory).replaceAll("\\", "/");
    }),
  );
  for (const packageDir of packages) {
    const selection = bunTestSelection(registry, packageDir, process.platform, true, runner);
    const xml = await Bun.file(resolve(root, "test-results/quarantine", packageDir, "results.xml")).text();
    record(packageDir, verifyQuarantineReport(xml, selection.count));
  }
} else if (runner === "playwright" || runner === "playwright-ui" || runner === "packaged-desktop") {
  const files: Record<string, string> = {
    playwright: "packages/e2e/test-results/packaged-browser-quarantine/results.json",
    "playwright-ui": "packages/e2e/test-results/ui-quarantine/results.json",
    "packaged-desktop": "clients/desktop/test-results/packaged-quarantine-readiness.json",
  };
  const file = files[runner];
  const report = await Bun.file(resolve(root, file)).json();
  record(
    runner,
    verifyPlaywrightQuarantineReport(
      report,
      cases.map((entry) => entry.name),
    ),
  );
} else {
  throw new Error("Choose bun, packaged-bun, playwright, playwright-ui or packaged-desktop quarantine reports.");
}
