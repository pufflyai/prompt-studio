// Critical checks use the same Playwright runner as the component suite.
const build = Bun.spawn(["bun", "x", "--no-install", "lerna", "run", "build:previews", "--scope", "canvas-tests"], {
  cwd: new URL("../../..", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
});
if (await build.exited) process.exit(1);
const check = Bun.spawn(
  ["bun", "run", "--cwd", "packages/canvas-tests", "test:browser", "src/ui/ui/critical-canvas.p1.spec.ts"],
  { cwd: new URL("../../..", import.meta.url).pathname, stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await check.exited;
