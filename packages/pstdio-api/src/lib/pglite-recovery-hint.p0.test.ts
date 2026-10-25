import { describe, expect, it } from "bun:test";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./pglite-recovery-hint";

describe("isPgliteCheckpointFailure", () => {
  it("matches the startup output PGlite produces for a damaged WAL", () => {
    expect(isPgliteCheckpointFailure("PANIC: could not locate a valid checkpoint record")).toBe(true);
    expect(isPgliteCheckpointFailure("RuntimeError: Aborted(). Build with -sASSERTIONS for more info.")).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isPgliteCheckpointFailure("ECONNREFUSED")).toBe(false);
  });
});

describe("pgliteRecoverySteps", () => {
  it("spells out the repair command against the failing database path", () => {
    const steps = pgliteRecoverySteps("/home/dev/.pstdio/pstdio.db");

    expect(steps).toContain("pg_resetwal -f '/home/dev/.pstdio/pstdio.db'");
  });

  // The command is meant to be pasted into a shell, so a home directory with a
  // space or an apostrophe still has to reach pg_resetwal as one argument.
  it("quotes a path the shell would otherwise split", () => {
    expect(pgliteRecoverySteps("/Users/dev user/.pstdio/pstdio.db")).toContain(
      "pg_resetwal -f '/Users/dev user/.pstdio/pstdio.db'",
    );
    expect(pgliteRecoverySteps("/Users/o'brien/.pstdio/pstdio.db")).toContain(
      `pg_resetwal -f '/Users/o'\\''brien/.pstdio/pstdio.db'`,
    );
  });

  // The hint ships inside the published CLI, so it must not point at files that only exist in this repo.
  it("stays self-contained", () => {
    expect(pgliteRecoverySteps("/home/dev/.pstdio/pstdio.db")).not.toContain("docs/");
  });
});
