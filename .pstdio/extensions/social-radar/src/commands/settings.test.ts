import { describe, expect, test } from "bun:test";
import { commands } from ".";
import { setup } from "./test-context";

const channelIds = async (ctx: ReturnType<typeof setup>["ctx"]) =>
  (await commands["get-settings"].run(ctx, {})).channels.map((channel) => channel.id);

describe("social radar settings", () => {
  test("concurrent pause and removal do not pause a re-added channel", async () => {
    const { ctx, storage } = setup();
    const paused = storage.collection<{ id: string }>("paused-channels");
    const collection = ctx.storage.collection.bind(ctx.storage);
    ctx.storage.collection = ((name: string) =>
      name === "paused-channels" ? paused : collection(name)) as typeof ctx.storage.collection;
    const put = paused.put.bind(paused);
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    paused.put = async (id, value) => {
      entered();
      await gate;
      return put(id, value);
    };
    const pause = commands["set-channel-paused"].run(ctx, { id: "x", paused: true });
    await ready;
    const remove = commands["remove-channel"].run(ctx, { id: "x" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await Promise.all([pause, remove]);
    await commands["add-channel"].run(ctx, { name: "X" });
    expect((await commands["get-channel-state"].run(ctx, {})).pausedChannelIds).toEqual([]);
  });

  test("replacing configured channels clears removed channel pause state", async () => {
    const { ctx } = setup();
    await commands["set-channel-paused"].run(ctx, { id: "x", paused: true });
    const { channels } = await commands["get-settings"].run(ctx, {});
    await commands["update-settings"].run(ctx, {
      input: { channels: channels.filter((channel) => channel.id !== "x") },
    });
    await commands["add-channel"].run(ctx, { name: "X" });
    expect((await commands["get-channel-state"].run(ctx, {})).pausedChannelIds).toEqual([]);
  });

  test("pauses and resumes a channel without changing its configuration", async () => {
    const { ctx, settings, storage } = setup();
    await commands["update-channel"].run(ctx, { id: "reddit", targets: ["r/LocalLLaMA"], budget: 2 });
    const before = Object.fromEntries(settings);
    await commands["set-channel-paused"].run(ctx, { id: "reddit", paused: true });
    expect(Object.fromEntries(settings)).toEqual(before);
    expect((await commands["get-channel-state"].run(ctx, {})).pausedChannelIds).toEqual(["reddit"]);
    await commands["set-channel-paused"].run(ctx, { id: "reddit", paused: false });
    expect((await commands["get-channel-state"].run(ctx, {})).pausedChannelIds).toEqual([]);
    expect(
      (await commands["get-settings"].run(ctx, {})).channels.find((channel) => channel.id === "reddit"),
    ).toMatchObject({ budget: 2, targets: ["r/LocalLLaMA"] });
    expect(await storage.collection("paused-channels").list()).toEqual([]);
  });

  test("removing a paused channel clears its pause state", async () => {
    const { ctx } = setup();
    await commands["set-channel-paused"].run(ctx, { id: "x", paused: true });
    await commands["remove-channel"].run(ctx, { id: "x" });
    await commands["add-channel"].run(ctx, { name: "X" });
    expect((await commands["get-channel-state"].run(ctx, {})).pausedChannelIds).toEqual([]);
    await expect(commands["set-channel-paused"].run(ctx, { id: "missing", paused: true })).rejects.toThrow(
      "not a channel",
    );
  });
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
