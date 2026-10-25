import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TestPriority } from "./test-policy";

export const testPriorities: TestPriority[] = ["P0", "P1", "P2", "P3"];
const testSuffix = /\.(test|spec|integration|bench|perf)\.tsx?$/;

export const priorityFromFile = (file: string) => {
  if (!testSuffix.test(file)) return;
  const priority = file.match(/\.p([0-3])\.(?:test|spec|integration|bench|perf)\.tsx?$/)?.[1];
  if (!priority) throw new Error(`Test file needs an explicit p0, p1, p2 or p3 priority: ${file}`);
  return `P${priority}` as TestPriority;
};

export const selectPriorityTests = (files: string[], priorities: TestPriority[]) =>
  [...new Set(files)]
    .filter((file) => {
      const priority = priorityFromFile(file);
      return priority !== undefined && priorities.includes(priority);
    })
    .sort();

export const readTestPriorities = (value = process.env.TEST_PRIORITIES) => {
  if (value === undefined) return testPriorities;
  const priorities = value.split(",");
  if (!priorities.length || priorities.some((priority) => !testPriorities.includes(priority as TestPriority)))
    throw new Error(`Unknown test priorities: ${value}`);
  return [...new Set(priorities)] as TestPriority[];
};

export const discoverTestFiles = (root: string) => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => testSuffix.test(file) && existsSync(join(root, file)));
  return selectPriorityTests(files, testPriorities);
};

export const testRunner = (file: string) => {
  if (/\.(bench|perf)\.ts$/.test(file)) return "performance";
  if (file.endsWith(".integration.ts")) return "integration";
  if (file.endsWith(".spec.ts")) {
    if (file.startsWith("clients/desktop/")) return "desktop";
    if (file.startsWith("packages/storybook-tests/")) return "component";
    if (file.startsWith("packages/e2e/src/packaged/")) return "packaged-browser";
    if (file.startsWith("packages/e2e/src/vite-terminal/")) return "vite";
    return "app";
  }
  if (file.startsWith("packages/pstdio-api/")) return "api";
  if (file.startsWith("packages/e2e/src/packaged/")) return "packaged-cli";
  if (file.startsWith("packages/e2e/src/cli/")) return "cli";
  if (file.startsWith("clients/desktop/src/e2e/")) return "browser-helper";
  return "bun";
};

export const priorityIgnorePatterns = (priorities: TestPriority[]) =>
  testPriorities
    .filter((priority) => !priorities.includes(priority))
    .map((priority) => `**/*.${priority.toLowerCase()}.*`);
