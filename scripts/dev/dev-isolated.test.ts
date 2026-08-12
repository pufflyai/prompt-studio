import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveContainerPorts, resolveIsolatedHome } from "./dev-isolated";

describe("isolated development paths", () => {
  test("keeps every named environment in an ignored repository-local home", () => {
    expect(resolveIsolatedHome("/repo", "pstdio-desktop")).toBe(
      resolve("/repo/__test-tmp__/dev-isolated/pstdio-desktop/pstdio-home"),
    );
  });

  test("rejects a compose name that could escape the isolated root", () => {
    expect(() => resolveIsolatedHome("/repo", "../production")).toThrow("Invalid isolated stack name");
  });

  test("uses the mapped host API port inside desktop containers", () => {
    const hostPorts = { dashboard: 43001, api: 43002 };

    expect(resolveContainerPorts(hostPorts, true)).toEqual({ dashboard: 5173, api: 43002 });
    expect(resolveContainerPorts(hostPorts, false)).toEqual({ dashboard: 5173, api: 19841 });
  });
});
