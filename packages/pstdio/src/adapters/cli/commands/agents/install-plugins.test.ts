import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./install-plugins";

describe("agents install-plugins", () => {
  test("installs plugin artifacts in project mode", async () => {
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-plugins": false } as never);

    expect(installPluginsForAgent).toHaveBeenCalledWith({ root: "/repo", agentId: "opencode", global: false });
    expect(log).toHaveBeenCalledWith("Installed 1 plugin artifact(s): pstdio-session-bridge.js");
  });

  test("throws outside git repositories without --global-plugins", async () => {
    const handler = createHandler({
      cwd: () => "/cwd",
      findGitRoot: () => null,
      installPluginsForAgent: async () => [],
      log: mock(),
    });

    await expect(handler({ "agent-id": "opencode", "global-plugins": false } as never)).rejects.toThrow(
      "Not inside a git repository. Use --global-plugins or run from a git repo.",
    );
  });

  test("supports --global-plugins outside a git repository", async () => {
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);

    const handler = createHandler({
      cwd: () => "/cwd",
      findGitRoot: () => null,
      installPluginsForAgent,
      log: mock(),
    });

    await handler({ "agent-id": "opencode", "global-plugins": true } as never);

    expect(installPluginsForAgent).toHaveBeenCalledWith({ root: "/cwd", agentId: "opencode", global: true });
  });

  test("reports when agent has no plugin artifacts", async () => {
    const installPluginsForAgent = mock(async () => []);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "claude-code", "global-plugins": false } as never);

    expect(installPluginsForAgent).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('No plugin artifacts are required for agent "claude-code".');
  });
});
