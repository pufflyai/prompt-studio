import { spawn } from "node:child_process";
import { resolve } from "node:path";

const runDatabaseTests = async (packageName: string, files: string[]) => {
  if (packageName !== "pstdio-api" && packageName !== "pstdio-db")
    throw new Error(`Unknown database test package: ${packageName}`);
  if (!files.length) throw new Error("A database test row must select files");
  const args =
    packageName === "pstdio-api"
      ? [`--files=${JSON.stringify(files)}`]
      : files.map((file) => `./${file.replace(/^\.\//, "")}`);
  const child = spawn(process.execPath, ["run", "test", ...args], {
    cwd: resolve(import.meta.dir, "../../packages", packageName),
    stdio: "inherit",
    env: process.env,
  });
  return await new Promise<number>((complete) => {
    child.once("error", (error) => {
      console.error(error);
      complete(1);
    });
    child.once("exit", (code) => complete(code ?? 1));
  });
};

if (import.meta.main) {
  const packageName = process.env.CI_TEST_PACKAGE;
  if (!packageName) throw new Error("CI_TEST_PACKAGE is required");
  const selection = process.env.CI_TEST_FILES_JSON;
  if (!selection) throw new Error("CI_TEST_FILES_JSON is required");
  const files: unknown = JSON.parse(selection);
  if (!Array.isArray(files) || files.some((file) => typeof file !== "string"))
    throw new Error("CI_TEST_FILES_JSON must be a JSON array of filenames");
  process.exitCode = await runDatabaseTests(packageName, files);
}
