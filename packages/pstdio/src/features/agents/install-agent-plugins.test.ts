import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  doesAgentRequirePlugins,
  installPluginsForAgent,
  OPENCODE_SESSION_BRIDGE_PLUGIN_FILE,
} from "./install-agent-plugins";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("doesAgentRequirePlugins", () => {
  test("returns true for opencode", () => {
    expect(doesAgentRequirePlugins("opencode")).toBe(true);
  });

  test("returns false for other agents", () => {
    expect(doesAgentRequirePlugins("claude-code")).toBe(false);
    expect(doesAgentRequirePlugins("fake")).toBe(false);
  });
});

describe("installPluginsForAgent", () => {
  test("installs opencode bridge plugin to project directory", async () => {
    const root = setup("local");

    const installed = await installPluginsForAgent({ root, agentId: "opencode" });

    expect(installed).toEqual([OPENCODE_SESSION_BRIDGE_PLUGIN_FILE]);
    const pluginPath = join(root, ".opencode", "plugins", OPENCODE_SESSION_BRIDGE_PLUGIN_FILE);
    expect(existsSync(pluginPath)).toBe(true);

    const content = readFileSync(pluginPath, "utf8");
    expect(content).toContain('"shell.env"');
    expect(content).toContain("resolve-session-id");
  });

  test("installs opencode bridge plugin to global directory", async () => {
    const fakeHome = setup("global-home");

    const installed = await installPluginsForAgent({
      root: setup("unused-root"),
      agentId: "opencode",
      global: true,
      homedir: fakeHome,
    });

    expect(installed).toEqual([OPENCODE_SESSION_BRIDGE_PLUGIN_FILE]);
    expect(existsSync(join(fakeHome, ".opencode", "plugins", OPENCODE_SESSION_BRIDGE_PLUGIN_FILE))).toBe(true);
  });

  test("is idempotent and preserves existing plugin customization", async () => {
    const root = setup("idempotent");
    const pluginPath = join(root, ".opencode", "plugins", OPENCODE_SESSION_BRIDGE_PLUGIN_FILE);
    mkdirSync(join(root, ".opencode", "plugins"), { recursive: true });
    writeFileSync(pluginPath, "custom plugin content", "utf8");

    const installed = await installPluginsForAgent({ root, agentId: "opencode" });

    expect(installed).toEqual([]);
    expect(readFileSync(pluginPath, "utf8")).toBe("custom plugin content");
  });

  test("returns empty array for agents without plugin artifacts", async () => {
    const root = setup("claude");

    const installed = await installPluginsForAgent({ root, agentId: "claude-code" });

    expect(installed).toEqual([]);
    expect(existsSync(join(root, ".claude", "plugins"))).toBe(false);
  });
});
