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

    expect(steps).toContain("pg_resetwal -f /home/dev/.pstdio/pstdio.db");
  });

  // The hint ships inside the published CLI, so it must not point at files that only exist in this repo.
  it("stays self-contained", () => {
    expect(pgliteRecoverySteps("/home/dev/.pstdio/pstdio.db")).not.toContain("docs/");
  });
});
