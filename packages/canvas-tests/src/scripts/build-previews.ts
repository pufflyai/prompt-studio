const child = Bun.spawn(["bun", "../../.pstdio/extensions/canvas/scripts/build-verification.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exitCode = await child.exited;

export {};
