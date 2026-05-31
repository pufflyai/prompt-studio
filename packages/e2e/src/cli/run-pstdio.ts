const cwd = process.env.PSTDIO_E2E_CWD;

if (!cwd) {
  throw new Error("PSTDIO_E2E_CWD is required");
}

process.chdir(cwd);

await import("../../../pstdio/src/index");
