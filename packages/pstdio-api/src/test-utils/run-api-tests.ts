import { rmSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "../..");
const files = Array.from(new Bun.Glob("src/**/*.test.ts").scanSync({ cwd: packageRoot })).sort();
// Forward only coverage flags. Other callers pass their own --timeout, which would replace this runner's limit.
const coverageArgs = process.argv.slice(2).filter((arg) => arg.startsWith("--coverage"));
const coverage = coverageArgs.includes("--coverage");
let nextFile = 0;
let failures = 0;

// Each file writes its own lcov folder. Folders left by deleted test files would skew the total.
if (coverage) rmSync(resolve(packageRoot, "coverage"), { recursive: true, force: true });

// Each process owns one file's module state. See ADR 0018 for the Bun isolation limit.
const runFiles = async () => {
  while (nextFile < files.length) {
    const index = nextFile++;
    const file = files[index];
    const coverageDir = coverage ? ["--coverage-dir", `coverage/${index}`] : [];
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-orphans",
        "--conditions=source",
        "test",
        `./${file}`,
        "--timeout",
        "30000",
        "--silent",
        ...coverageArgs,
        ...coverageDir,
      ],
      { cwd: packageRoot, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    );
    if ((await child.exited) !== 0) failures += 1;
  }
};

await Promise.all([runFiles(), runFiles()]);
console.log(`API test files: ${files.length - failures} passed, ${failures} failed.`);
process.exitCode = failures === 0 ? 0 : 1;
