// The extension runtime imports the SDK's public JavaScript exports. Build only
// that prerequisite here so an SDK failure does not suppress independent P0 checks.
for (const command of [
  ["bun", "run", "--cwd", "packages/sdk", "build:js"],
  ["bun", "run", "verify:translations"],
]) {
  const result = Bun.spawnSync(command, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
