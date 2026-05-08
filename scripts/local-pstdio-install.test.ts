import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLocalPstdio } from "./local-pstdio-install";

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-local-install-test-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("installLocalPstdio", () => {
  test("sets PSTDIO_HOME to the dev root for dev-server wrappers", () => {
    const installDir = join(tempRoot, "bin");
    const result = installLocalPstdio({
      installDir,
      mode: { apiUrl: "http://localhost:19841", type: "dev-server" },
      pathEnv: installDir,
      repoRoot: "/repo",
    });

    const wrapper = readFileSync(result.destination, "utf8");
    expect(wrapper).toContain('export PSTDIO_HOME="');
    expect(wrapper).toContain("PSTDIO_HOME:-$HOME/.pstdio-dev");
    expect(wrapper).not.toContain("PSTDIO_DB_PATH");
    expect(wrapper).not.toContain("PSTDIO_STORAGE_PATH");
    expect(wrapper).not.toContain("PSTDIO_WORKSPACES_DIR");
  });
});
