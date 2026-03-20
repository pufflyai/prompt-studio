import { afterAll, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createAgentConfigsService } from "./agent-configs";

let close: () => Promise<void>;
let agentConfigs: ReturnType<typeof createAgentConfigsService>;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  agentConfigs = createAgentConfigsService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("agent-configs service", () => {
  test("upsert adds agent and sets is_default on first", async () => {
    await setup();

    const result = await agentConfigs.upsert("claude-code");

    expect(result.agent_id).toBe("claude-code");
    expect(result.is_default).toBe(true);
  });

  test("upsert second agent does not set is_default", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    const second = await agentConfigs.upsert("opencode");

    expect(second.is_default).toBe(false);
  });

  test("upsert is idempotent", async () => {
    await setup();

    const first = await agentConfigs.upsert("claude-code");
    const second = await agentConfigs.upsert("claude-code");

    expect(second.id).toBe(first.id);
  });

  test("list returns all configured agents", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    await agentConfigs.upsert("opencode");

    const all = await agentConfigs.list();
    expect(all).toHaveLength(2);
  });

  test("get returns agent by agent_id", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");

    const found = await agentConfigs.get("claude-code");
    expect(found).not.toBeNull();
    expect(found!.agent_id).toBe("claude-code");

    const missing = await agentConfigs.get("opencode");
    expect(missing).toBeNull();
  });

  test("remove deletes agent and reassigns default", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    await agentConfigs.upsert("opencode");

    await agentConfigs.remove("claude-code");

    const all = await agentConfigs.list();
    expect(all).toHaveLength(1);
    expect(all[0].agent_id).toBe("opencode");
    expect(all[0].is_default).toBe(true);
  });

  test("remove last agent clears all", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    await agentConfigs.remove("claude-code");

    const all = await agentConfigs.list();
    expect(all).toHaveLength(0);
  });

  test("remove returns false for non-existent agent", async () => {
    await setup();

    const removed = await agentConfigs.remove("opencode");
    expect(removed).toBe(false);
  });

  test("update sets is_default and unsets others", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    await agentConfigs.upsert("opencode");

    const result = await agentConfigs.update("opencode", { is_default: true });

    expect(result!.updated.is_default).toBe(true);
    expect(result!.clearedDefaults).toHaveLength(1);
    expect(result!.clearedDefaults[0].agent_id).toBe("claude-code");
    expect(result!.clearedDefaults[0].is_default).toBe(false);

    const claude = await agentConfigs.get("claude-code");
    expect(claude!.is_default).toBe(false);
  });

  test("update merges config overrides", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");

    const result = await agentConfigs.update("claude-code", {
      binary: "/usr/local/bin/claude",
      skills_dir: "/custom/skills",
    });

    const config = JSON.parse(result!.updated.config);
    expect(config.binary).toBe("/usr/local/bin/claude");
    expect(config.skills_dir).toBe("/custom/skills");
  });

  test("update merges config without overwriting unrelated keys", async () => {
    await setup();

    await agentConfigs.upsert("claude-code");
    await agentConfigs.update("claude-code", { binary: "/bin/claude" });
    const result = await agentConfigs.update("claude-code", { skills_dir: "/skills" });

    const config = JSON.parse(result!.updated.config);
    expect(config.binary).toBe("/bin/claude");
    expect(config.skills_dir).toBe("/skills");
  });

  test("update returns null for non-existent agent", async () => {
    await setup();

    const result = await agentConfigs.update("opencode", { is_default: true });
    expect(result).toBeNull();
  });
});
