import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  composeMountPaths,
  resolveContainerPorts,
  resolveIsolatedBrowserTransport,
  resolveIsolatedDashboardUrl,
  resolveIsolatedDefaultExtensions,
  resolveIsolatedExtensionReleaseRef,
  resolveIsolatedHome,
} from "./dev-isolated";

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

  test("uses browser-reachable host ports for isolated terminal transport", () => {
    expect(resolveIsolatedBrowserTransport({ dashboard: 43001, api: 43002 })).toEqual({
      PSTDIO_TERMINAL_ORIGINS: "http://127.0.0.1:43001",
      PSTDIO_TERMINAL_WEBSOCKET_URL: "ws://127.0.0.1:43002/v1/terminal",
    });
  });

  test("prints the authenticated loopback origin for isolated dashboards", () => {
    expect(resolveIsolatedDashboardUrl(43001)).toBe("http://127.0.0.1:43001/");
  });

  test("seeds every first-party extension from the working tree", () => {
    const config = JSON.parse(resolveIsolatedDefaultExtensions("/repo", {})) as {
      defaultExtensions: Array<string | { installName: string; skipInstall: boolean; source: string }>;
    };

    expect(config.defaultExtensions).toEqual(
      [
        ["harness-claude-code", "extensions/harness-claude-code"],
        ["harness-codex", "extensions/harness-codex"],
        ["harness-open-code", "extensions/harness-open-code"],
        ["pstdio-base-themes", "extensions/pstdio-base-themes"],
        ["pstdio-planner", "extensions/pstdio-planner"],
        ["pstdio-planner-loops", ".pstdio/extensions/pstdio-planner-loops"],
        ["pstdio-reports", "extensions/pstdio-reports"],
        ["pstdio-skills", "extensions/pstdio-skills"],
        ["extension-lab", "extensions/extension-lab"],
        ["local-example", "infra/local/extensions/local-example"],
      ].map(([installName, source]) => ({
        force: true,
        installName,
        skipInstall: true,
        source: resolve("/repo", source!),
      })),
    );
  });

  test("keeps an explicit default extension configuration", () => {
    expect(resolveIsolatedDefaultExtensions("/repo", { PSTDIO_DEFAULT_EXTENSIONS: '["custom"]' })).toBe('["custom"]');
  });

  test("uses the Prompt Studio package release for marketplace installs", () => {
    const readFile = (path: string) => {
      expect(path).toBe(resolve("/repo/packages/pstdio/package.json"));
      return JSON.stringify({ version: "0.27.0" });
    };

    expect(resolveIsolatedExtensionReleaseRef("/repo", {}, readFile)).toBe("pstdio@0.27.0");
    expect(
      resolveIsolatedExtensionReleaseRef("/repo", { PSTDIO_EXTENSION_RELEASE_REF: "feature/extensions" }, readFile),
    ).toBe("feature/extensions");
  });
});

describe("compose mount paths", () => {
  test("uses Linux container targets for Windows host paths", () => {
    const paths = composeMountPaths({
      gitCommonDir: "C:\\repo\\.git",
      platform: "win32",
      repoRoot: "C:\\repo",
    });

    expect(paths.HOST_WORKTREE).toBe("C:\\repo");
    expect(paths.HOST_GIT_COMMON_DIR).toBe("C:\\repo\\.git");
    expect(paths.CONTAINER_WORKTREE).toBe("/workspace/prompt-studio");
    expect(paths.CONTAINER_GIT_COMMON_DIR).toBe("/workspace/git-common");
  });

  test("preserves same-path mounts away from Windows", () => {
    const paths = composeMountPaths({
      gitCommonDir: "/repo/.git",
      platform: "linux",
      repoRoot: "/repo",
    });

    expect(paths.HOST_WORKTREE).toBe("/repo");
    expect(paths.HOST_GIT_COMMON_DIR).toBe("/repo/.git");
    expect(paths.CONTAINER_WORKTREE).toBe("/repo");
    expect(paths.CONTAINER_GIT_COMMON_DIR).toBe("/repo/.git");
  });
});
