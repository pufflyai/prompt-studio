import { describe, expect, test } from "bun:test";
import { resolveIsolatedUser } from "./isolated-user";

describe("isolated development user", () => {
  test("preserves the host identity for files written through bind mounts", () => {
    expect(resolveIsolatedUser({ uid: 1234, gid: 5678 })).toEqual({ HOST_UID: "1234", HOST_GID: "5678" });
  });

  test("uses a non-root container identity on hosts without Unix user IDs", () => {
    expect(resolveIsolatedUser({})).toEqual({ HOST_UID: "1000", HOST_GID: "1000" });
  });

  test("refuses root so builds cannot create root-owned checkout files", () => {
    expect(() => resolveIsolatedUser({ uid: 0, gid: 0 })).toThrow("without sudo");
  });
});
