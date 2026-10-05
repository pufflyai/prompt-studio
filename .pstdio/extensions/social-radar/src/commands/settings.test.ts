import { describe, expect, test } from "bun:test";
import { commands } from ".";
import { setup } from "./test-context";

const channelIds = async (ctx: ReturnType<typeof setup>["ctx"]) =>
  (await commands["get-settings"].run(ctx, {})).channels.map((channel) => channel.id);

describe("social radar settings", () => {
  test("updates one channel's targets and budget without replacing other settings", async () => {
    const { ctx } = setup();
    await commands["update-channel"].run(ctx, { id: "reddit", targets: ["r/LocalLLaMA"], budget: 2 });
    await commands["update-settings"].run(ctx, { input: { brandTerms: ["Prompt Studio"], topics: ["agent flow"] } });
    const settings = await commands["get-settings"].run(ctx, {});
    expect(settings).toMatchObject({ brandTerms: ["Prompt Studio"], topics: ["agent flow"] });
    expect(settings.channels.find((channel) => channel.id === "reddit")).toMatchObject({
      targets: ["r/LocalLLaMA"],
      budget: 2,
    });
    expect(settings.channels.find((channel) => channel.id === "hn")).toMatchObject({ budget: 4 });
  });

  test("adds a custom channel, removes a built-in one, and restores it by name", async () => {
    const { ctx } = setup();
    await commands["add-channel"].run(ctx, { name: "Lobsters", url: "https://lobste.rs" });
    await commands["remove-channel"].run(ctx, { id: "x" });
    expect(await channelIds(ctx)).toEqual([
      "hn",
      "reddit",
      "bluesky",
      "devto",
      "github",
      "youtube",
      "linkedin",
      "lobsters",
    ]);
    await commands["add-channel"].run(ctx, { name: "X" });
    const settings = await commands["get-settings"].run(ctx, {});
    expect(settings.channels.at(-1)).toMatchObject({ id: "x", name: "X", budget: 3 });
    expect(settings.channels.find((channel) => channel.id === "lobsters")).toMatchObject({
      name: "Lobsters",
      url: "https://lobste.rs",
    });
  });

  test("a new channel needs a link to look at, a unique name, and the radar keeps one channel", async () => {
    const { ctx } = setup();
    await expect(commands["add-channel"].run(ctx, { name: "Lobsters" })).rejects.toThrow("Add a link");
    await expect(commands["add-channel"].run(ctx, { name: "Reddit" })).rejects.toThrow("already a channel");
    for (const id of await channelIds(ctx)) {
      if ((await channelIds(ctx)).length > 1) await commands["remove-channel"].run(ctx, { id });
    }
    const [last] = await channelIds(ctx);
    await expect(commands["remove-channel"].run(ctx, { id: last })).rejects.toThrow("at least one channel");
  });

  test("saves the research agent with its model options", async () => {
    const { ctx } = setup();
    const agent = {
      harnessId: "pstdio.harness-claude.harness.claude",
      model: "claude-opus-5-5",
      params: { effort: "high" },
    };
    await commands["set-agent"].run(ctx, { agent });
    expect((await commands["get-settings"].run(ctx, {})).agent).toEqual(agent);
  });
});
