import { relative, resolve, sep } from "node:path";
import type { CoverageReport } from "./coverage-badge";

const excludedSource =
  /(^|\/)(node_modules|dist|mocks?|__tests__|__test-tmp__|__generated__|generated|e2e|storybook-tests|workbench-fixture|storage-scale-fixture|pstdio-extension-testbench)\/|\.(test|spec|bench|perf|diagnostic|integration|stories|generated)\.|\.d\.ts$|fixture|test-helpers|test-utils|test-support|test-setup|mock-data/;

export const isCoverageSource = (path: string) => !excludedSource.test(path);

export const isProductionSource = (path: string) =>
  /^(?:(?:packages|clients|services)\/[^/]+\/src\/|(?:\.pstdio\/)?extensions\/[^/]+\/(?:src\/|extension\.tsx?$))/.test(
    path,
  ) &&
  /\.tsx?$/.test(path) &&
  isCoverageSource(path);

// A dependency can appear in several reports. Merge its line hits before counting it.
export const mergeCoverageHits = (root: string, reports: CoverageReport[]) => {
  const files = new Map<string, Map<number, number>>();
  for (const report of reports) {
    let lines: Map<number, number> | undefined;
    for (const entry of report.content.split("\n")) {
      if (entry.startsWith("SF:")) {
        const path = relative(root, resolve(report.packageDir, entry.slice(3)))
          .split(sep)
          .join("/");
        lines = undefined;
        if (!path.startsWith("..") && isCoverageSource(path)) {
          lines = files.get(path) ?? new Map();
          files.set(path, lines);
        }
      } else if (lines && entry.startsWith("DA:")) {
        const [line, hits] = entry.slice(3).split(",").map(Number);
        lines.set(line, (lines.get(line) ?? 0) + hits);
      }
    }
  }
  return files;
};
