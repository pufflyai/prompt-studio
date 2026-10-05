import { describe, expect, test } from "bun:test";
import { commands } from "../commands";
import { setup } from "../commands/test-context";
import { channelResource, settingsSection } from "../store";
import { settingsView } from "./settings-view";

type Context = ReturnType<typeof setup>["ctx"];
const renderer = (type: string, id: string) => ({ rendererId: "settings", resource: { type, id } });
const groupIds = async (ctx: Context, type: string, id: string) =>
  (await settingsView.body.query(ctx, { renderer: renderer(type, id) })).groups?.map((group) => group.id);

describe("social radar settings sections", () => {
  test("each section and channel shows only its own groups", async () => {
    const { ctx } = setup();
    expect(await groupIds(ctx, settingsSection.id, "research")).toEqual(["research"]);
    expect(await groupIds(ctx, settingsSection.id, "voice")).toEqual(["voice"]);
    expect(await groupIds(ctx, settingsSection.id, "agent")).toEqual(["agent"]);
    expect(await groupIds(ctx, channelResource.id, "reddit")).toEqual(["reddit"]);
  });

  test("applying one section keeps the settings of the others", async () => {
    const { ctx } = setup();
    await commands["update-settings"].run(ctx, { input: { topics: ["agent flow"] } });
    await commands["update-channel"].run(ctx, { id: "reddit", targets: ["r/LocalLLaMA"], budget: 2 });
    await settingsView.body.onApply(ctx, {
      renderer: renderer(settingsSection.id, "voice"),
      values: { voice: "Plain and kind." },
    });
    const settings = await commands["get-settings"].run(ctx, {});
    expect(settings).toMatchObject({ voice: "Plain and kind.", topics: ["agent flow"], scrollScreens: 3 });
    expect(settings.channels.find((channel) => channel.id === "reddit")).toMatchObject({
      targets: ["r/LocalLLaMA"],
      budget: 2,
    });
  });

  test("a custom channel keeps its link editable", async () => {
    const { ctx } = setup();
    await commands["add-channel"].run(ctx, { name: "Lobsters", url: "https://lobste.rs" });
    await settingsView.body.onApply(ctx, {
      renderer: renderer(channelResource.id, "lobsters"),
      values: { "budget-lobsters": 1, "url-lobsters": "https://lobste.rs/t/ai" },
    });
    const { channels } = await commands["get-settings"].run(ctx, {});
    expect(channels.find((channel) => channel.id === "lobsters")).toMatchObject({
      budget: 1,
      url: "https://lobste.rs/t/ai",
    });
  });
});
