// Prompt Studio's canvases are built exactly as any project's: by `pstdio-canvas build`. The
// verification page then renders that build through UI Canvas's own view code.
const run = async (command: string[]) => {
  const child = Bun.spawn(command, { cwd: "../..", stdout: "inherit", stderr: "inherit" });
  if (await child.exited) process.exit(1);
};
await run(["bun", "x", "--no-install", "pstdio-canvas", "build", "--out", "__test-tmp__/canvas-verification/build"]);
await run(["bun", "extensions/canvas/scripts/build-verification.ts"]);

export {};
