import { describe, expect, test } from "bun:test";
import { commands } from "../commands";
import { setup } from "../commands/test-context";
import { settingsSection } from "../store";
import { settingsView } from "./settings-view";

const renderer = (section?: string) => ({
  rendererId: "settings",
  resource: section ? { type: settingsSection.id, id: section } : undefined,
});
const query = (ctx: ReturnType<typeof setup>["ctx"], section?: string) =>
  settingsView.body.query(ctx, { renderer: renderer(section) });

describe("social radar settings sections", () => {
  test("each section shows only its own groups", async () => {
    const { ctx } = setup();
    const ids = async (section?: string) => (await query(ctx, section)).groups?.map((group) => group.id);
    expect(await ids("research")).toEqual(["research"]);
    expect(await ids("voice")).toEqual(["voice"]);
    expect(await ids("channels")).toEqual(["hn", "reddit", "bluesky", "devto", "github", "youtube", "x", "linkedin"]);
    expect(await ids()).toEqual(["research"]);
  });

  test("applying one section keeps the settings of the others", async () => {
    const { ctx } = setup();
    await commands["update-settings"].run(ctx, { input: { topics: ["agent flow"] } });
    await commands["update-site"].run(ctx, { site: "reddit", targets: ["r/LocalLLaMA"], budget: 2 });
    await settingsView.body.onApply(ctx, { renderer: renderer("voice"), values: { voice: "Plain and kind." } });
    expect(await commands["get-settings"].run(ctx, {})).toMatchObject({
      voice: "Plain and kind.",
      topics: ["agent flow"],
      targets: { reddit: ["r/LocalLLaMA"] },
      budgets: { reddit: 2, scrollScreens: 3 },
    });
  });
});
