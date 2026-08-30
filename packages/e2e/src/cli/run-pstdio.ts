const cwd = process.env.PSTDIO_E2E_CWD;

if (!cwd) {
  throw new Error("PSTDIO_E2E_CWD is required");
}

// Resolve workspace packages before switching to the temp repo cwd.
await import("pstdio-extensions");

process.chdir(cwd);

// An opaque specifier keeps the CLI package's path-aliased sources out of this
// package's type program; the module is only executed, never typed.
const pstdioEntrypoint = "pstdio";
await import(pstdioEntrypoint);

export {};
