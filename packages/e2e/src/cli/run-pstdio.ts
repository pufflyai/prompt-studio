const cwd = process.env.PSTDIO_E2E_CWD;

if (!cwd) {
  throw new Error("PSTDIO_E2E_CWD is required");
}

// Resolve workspace packages before switching to the temp repo cwd.
await import("../../../pstdio-extensions/src/index");

process.chdir(cwd);

await import("../../../pstdio/src/index");
