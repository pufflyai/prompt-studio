// Prompt Studio's canvases are built exactly as any project's: by `pstdio-canvas build`. The
// verification page then renders that build through UI Canvas's own view code.
const run = async (command: string[]) => {
  const child = Bun.spawn(command, { cwd: "../..", stdout: "inherit", stderr: "inherit" });
  if (await child.exited) process.exit(1);
};
const out = "__test-tmp__/canvas-verification/build";
await run(["bun", "x", "--no-install", "pstdio-canvas", "build", "--out", out]);
// The build succeeds when some canvases fail; verification must not pass with broken canvases.
const manifest: { canvases: { id: string; error?: string }[] } = await Bun.file(`../../${out}/manifest.json`).json();
const failed = manifest.canvases.filter((canvas) => canvas.error);
if (failed.length) {
  for (const canvas of failed) console.error(`${canvas.id}: ${canvas.error}`);
  process.exit(1);
}
await run(["bun", "extensions/canvas/scripts/build-verification.ts"]);

export {};
