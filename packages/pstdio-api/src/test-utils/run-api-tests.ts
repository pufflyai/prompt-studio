import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "../..");
const files = Array.from(new Bun.Glob("src/**/*.test.ts").scanSync({ cwd: packageRoot })).sort();
let nextFile = 0;
let failures = 0;

// Each process owns one file's module state. See ADR 0018 for the Bun isolation limit.
const runFiles = async () => {
  while (nextFile < files.length) {
    const file = files[nextFile++];
    const child = Bun.spawn(
      [process.execPath, "--no-orphans", "--conditions=source", "test", `./${file}`, "--timeout", "30000", "--silent"],
      { cwd: packageRoot, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    );
    if ((await child.exited) !== 0) failures += 1;
  }
};

await Promise.all([runFiles(), runFiles()]);
console.log(`API test files: ${files.length - failures} passed, ${failures} failed.`);
process.exitCode = failures === 0 ? 0 : 1;
